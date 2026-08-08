// ==========================================
// VED AI DATABASE
// Founder : Sayali P. R. Pawar
// ==========================================

const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./ved.db", (err) => {

    if (err) {

        console.error("❌ Database Error:", err.message);

    } else {

        console.log("✅ Connected to SQLite Database.");

    }

});

// ==========================================
// TABLES
// ==========================================

db.serialize(() => {

    // =========================
    // CHAT TABLE
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS chats (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            role TEXT,

            message TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `);

    // =========================
    // MEMORY TABLE
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS memories (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            memoryKey TEXT UNIQUE,

            memoryValue TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `);

});

module.exports = db;