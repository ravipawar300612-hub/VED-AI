// ==========================================
// VED AI — AUTH v2.1 (FAIL-CLOSED + AUTO-MIGRATION)
// Founder : Sayali P. R. Pawar
// ==========================================

const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const db = require("./database");

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
    console.warn("⚠️ AUTH: JWT_SECRET env not set — Render mein JWT_SECRET add karo!");
}

function hashPassword(password, salt) {
    return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

// AUTO-MIGRATION: purani/adhoori users table ko fix karo
function migrateUsers() {
    db.all("PRAGMA table_info(users)", [], (err, cols) => {
        if (err) { console.error("❌ AUTH MIGRATE pragma fail:", err.message); return; }
        const names = (cols || []).map(function (c) { return c.name; });
        if (!names.length) return;
        if (!names.includes("pass_hash")) { console.log("🔧 users: pass_hash column add kar raha..."); db.run("ALTER TABLE users ADD COLUMN pass_hash TEXT"); }
        if (!names.includes("salt")) { console.log("🔧 users: salt column add kar raha..."); db.run("ALTER TABLE users ADD COLUMN salt TEXT"); }
        if (!names.includes("name")) { console.log("🔧 users: name column add kar raha..."); db.run("ALTER TABLE users ADD COLUMN name TEXT"); }
    });
}

function setupAuth(app) {
    app.use(cookieParser());

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        pass_hash TEXT,
        salt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, [], function () {
        migrateUsers();
        console.log("✅ AUTH v2.1 ready (fail-closed mode)");
    });

    function signToken(name, email, hasHash) {
        return jwt.sign({ name: name, email: email, pwd: hasHash ? 1 : 0 }, JWT_SECRET, { expiresIn: "7d" });
    }

    function setTokenCookie(res, token) {
        res.cookie("ved_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 });
    }

    // ---------- REGISTER ----------
    app.post("/api/register", (req, res) => {
        const { name, email, password } = req.body || {};
        if (!name || !email) return res.status(400).json({ error: "Missing fields." });
        const cleanEmail = String(email).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: "Invalid email." });

        db.all("SELECT id FROM users WHERE email = ?", [cleanEmail], (err, rows) => {
            if (err) {
                console.error("❌ AUTH REGISTER SELECT FAIL:", err.message);
                return res.status(500).json({ error: "DB read fail: " + err.message });
            }
            if (rows && rows.length) return res.status(409).json({ error: "Account already exists. Login karo." });
            const salt = crypto.randomBytes(16).toString("hex");
            const pass_hash = password ? hashPassword(password, salt) : null;
            db.run("INSERT INTO users (email, name, pass_hash, salt) VALUES (?, ?, ?, ?)",
                [cleanEmail, String(name).slice(0, 60), pass_hash, salt], (err2) => {
                    if (err2) {
                        console.error("❌ AUTH REGISTER INSERT FAIL:", err2.message);
                        return res.status(500).json({ error: "Register failed: " + err2.message });
                    }
                    setTokenCookie(res, signToken(name, cleanEmail, !!pass_hash));
                    res.json({ success: true, name: name, email: cleanEmail, protected: !!pass_hash });
                });
        });
    });

    // ---------- LOGIN (FAIL-CLOSED) ----------
    app.post("/api/login", (req, res) => {
        const { email, name, password } = req.body || {};
        const cleanEmail = String(email || "guest@ved.ai").toLowerCase().trim();

        db.all("SELECT name, pass_hash, salt FROM users WHERE email = ?", [cleanEmail], (err, rows) => {
            // FAIL-CLOSED: DB error = login BLOCK (privacy first!)
            if (err) {
                console.error("❌ AUTH LOGIN SELECT FAIL:", err.message);
                return res.status(500).json({ error: "DB read fail: " + err.message });
            }
            const user = (rows && rows.length) ? rows[0] : null;

            // PROTECTED ACCOUNT: password MUST + verify
            if (user && user.pass_hash) {
                if (!password) return res.status(401).json({ error: "Password required." });
                const attempt = hashPassword(password, user.salt || "");
                let ok = false;
                try {
                    ok = crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(user.pass_hash, "hex"));
                } catch (e) { ok = false; }
                if (!ok) {
                    console.warn("🔐 Wrong password attempt for:", cleanEmail);
                    return res.status(401).json({ error: "Wrong password." });
                }
                setTokenCookie(res, signToken(user.name, cleanEmail, true));
                return res.json({ success: true, name: user.name, email: cleanEmail, protected: true });
            }

            // DEMO MODE: sirf jab account sach mein exist NAHI karta
            const finalName = user ? user.name : (name || cleanEmail.split("@")[0]);
            let pass_hash = null, salt = null;
            if (password) {
                salt = crypto.randomBytes(16).toString("hex");
                pass_hash = hashPassword(password, salt);
            }
            if (user) {
                if (pass_hash) db.run("UPDATE users SET pass_hash = ?, salt = ? WHERE email = ?", [pass_hash, salt, cleanEmail], () => {});
            } else {
                db.run("INSERT INTO users (email, name, pass_hash, salt) VALUES (?, ?, ?, ?)",
                    [cleanEmail, String(finalName).slice(0, 60), pass_hash, salt], (err2) => {
                        if (err2) console.error("❌ AUTH LOGIN INSERT FAIL:", err2.message);
                    });
            }
            setTokenCookie(res, signToken(finalName, cleanEmail, !!pass_hash));
            res.json({ success: true, name: finalName, email: cleanEmail, protected: !!pass_hash });
        });
    });

    // ---------- LOGOUT ----------
    app.post("/api/logout", (req, res) => {
        res.clearCookie("ved_token");
        res.json({ success: true });
    });

    // ---------- ME ----------
    app.get("/api/me", (req, res) => {
        const token = req.cookies ? req.cookies.ved_token : null;
        if (!token) return res.json({ loggedIn: false });
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            res.json({ loggedIn: true, name: decoded.name, email: decoded.email, protected: decoded.pwd === 1 });
        } catch (e) {
            res.json({ loggedIn: false });
        }
    });
}

module.exports = setupAuth;