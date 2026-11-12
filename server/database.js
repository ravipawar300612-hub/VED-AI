// ==========================================
// VED AI DATABASE - REAL SQLITE (LOCAL)
// Founder : Sayali P. R. Pawar
// ==========================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file ko server folder mein save karo
const dbPath = path.join(__dirname, 'ved_database.sqlite');
console.log('🗄️ Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ SQLite database connected!');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = db;