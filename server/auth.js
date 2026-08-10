// ==========================================
// VED AI — AUTH (DEMO MODE, no database)
// Founder : Sayali P. R. Pawar
// ==========================================

const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const JWT_SECRET = process.env.JWT_SECRET || "ved-demo-secret-2026";

function setupAuth(app) {

    app.use(cookieParser());

    app.post("/api/register", (req, res) => {
        const { name, email } = req.body;
        if (!name || !email) return res.status(400).json({ error: "Missing fields." });
        const token = jwt.sign({ name, email }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("ved_token", token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
        res.json({ success: true, name, email });
    });

    app.post("/api/login", (req, res) => {
        const { email, name } = req.body;
        const finalEmail = email || "guest@ved.ai";
        const finalName = name || finalEmail.split("@")[0];
        const token = jwt.sign({ name: finalName, email: finalEmail }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("ved_token", token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
        res.json({ success: true, name: finalName, email: finalEmail });
    });

    app.post("/api/logout", (req, res) => {
        res.clearCookie("ved_token");
        res.json({ success: true });
    });

    app.get("/api/me", (req, res) => {
        const token = req.cookies ? req.cookies.ved_token : null;
        if (!token) return res.json({ loggedIn: false });
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            res.json({ loggedIn: true, name: decoded.name, email: decoded.email });
        } catch (e) {
            res.json({ loggedIn: false });
        }
    });
}

module.exports = setupAuth;