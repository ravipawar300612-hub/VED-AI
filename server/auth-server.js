// ==========================================
// VED AI — AUTHENTICATION MODULE
// Self-contained: opens its own connection to
// your existing ved.db, so it doesn't need to
// touch database.js. Adds real accounts with
// hashed passwords and cookie-based sessions.
// ==========================================

const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "ved-ai-dev-secret-change-me";

function setupAuth(app) {

    const db = new sqlite3.Database(path.join(__dirname, "ved.db"));

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reset_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            code TEXT,
            expires_at INTEGER
        )
    `);

    app.use(cookieParser());

    function makeToken(user, rememberMe) {
        return jwt.sign(
            { id: user.id, name: user.name, email: user.email },
            JWT_SECRET,
            { expiresIn: rememberMe ? "30d" : "1d" }
        );
    }

    function setAuthCookie(res, token, rememberMe) {
        res.cookie("ved_token", token, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000
        });
    }

    // ---------- REGISTER ----------
    app.post("/api/register", (req, res) => {

        const { name, email, password } = req.body;

        if (!name || !email || !password || password.length < 6) {
            return res.status(400).json({ error: "Missing or invalid fields." });
        }

        db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {

            if (row) {
                return res.status(409).json({ error: "An account with this email already exists." });
            }

            const hash = bcrypt.hashSync(password, 10);

            db.run(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                [name, email, hash],
                function (err) {

                    if (err) return res.status(500).json({ error: "Could not create account." });

                    const user = { id: this.lastID, name, email };
                    const token = makeToken(user, false);
                    setAuthCookie(res, token, false);

                    res.json({ success: true, name, email });

                }
            );

        });

    });

    // ---------- LOGIN ----------
    app.post("/api/login", (req, res) => {

        const { email, password, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {

            if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                return res.status(401).json({ error: "Incorrect email or password." });
            }

            const token = makeToken(user, !!rememberMe);
            setAuthCookie(res, token, !!rememberMe);

            res.json({ success: true, name: user.name, email: user.email });

        });

    });

    // ---------- LOGOUT ----------
    app.post("/api/logout", (req, res) => {
        res.clearCookie("ved_token");
        res.json({ success: true });
    });

    // ---------- SESSION CHECK ----------
    app.get("/api/me", (req, res) => {

        const token = req.cookies.ved_token;

        if (!token) return res.status(401).json({ loggedIn: false });

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return res.status(401).json({ loggedIn: false });
            res.json({ loggedIn: true, name: decoded.name, email: decoded.email });
        });

    });

    // ---------- FORGOT PASSWORD ----------
    app.post("/api/forgot-password", (req, res) => {

        const { email } = req.body;

        if (!email) return res.status(400).json({ error: "Email is required." });

        db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {

            if (!user) {
                // Don't reveal whether the account exists.
                return res.json({ success: true });
            }

            const code = crypto.randomInt(100000, 999999).toString();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            db.run(
                "INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, ?)",
                [email, code, expiresAt]
            );

            // No email service is wired up yet, so the code just
            // prints here for testing. Once you connect an email
            // provider (e.g. nodemailer + a Gmail app password),
            // send `code` to the user's inbox here instead.
            console.log(`Password reset code for ${email}: ${code}`);

            res.json({ success: true });

        });

    });

    // ---------- VERIFY OTP ----------
    app.post("/api/verify-otp", (req, res) => {

        const { email, code } = req.body;

        if (!email || !code) return res.status(400).json({ error: "Missing email or code." });

        db.get(
            "SELECT * FROM reset_codes WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
            [email, code],
            (err, row) => {

                if (!row || row.expires_at < Date.now()) {
                    return res.status(400).json({ error: "Invalid or expired code." });
                }

                res.json({ success: true });

            }
        );

    });

    // ---------- RESET PASSWORD ----------
    app.post("/api/reset-password", (req, res) => {

        const { email, code, password } = req.body;

        if (!email || !code || !password || password.length < 6) {
            return res.status(400).json({ error: "Missing or invalid fields." });
        }

        db.get(
            "SELECT * FROM reset_codes WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
            [email, code],
            (err, row) => {

                if (!row || row.expires_at < Date.now()) {
                    return res.status(400).json({ error: "Invalid or expired code." });
                }

                const hash = bcrypt.hashSync(password, 10);

                db.run(
                    "UPDATE users SET password_hash = ? WHERE email = ?",
                    [hash, email],
                    (err) => {

                        if (err) return res.status(500).json({ error: "Could not update password." });

                        db.run("DELETE FROM reset_codes WHERE email = ?", [email]);

                        res.json({ success: true });

                    }
                );

            }
        );

    });

}

module.exports = setupAuth;