// ==========================================
// VED AI DATABASE
// Founder : Sayali P. R. Pawar
// ==========================================

// DEMO MODE - Mock Database
console.log('🎯 DEMO MODE: Mock database loaded');

const mockDb = {
    run: (query, params, callback) => { 
        if (callback) callback(null); 
    },
    all: (query, params, callback) => { 
        if (callback) callback(null, []); 
    },
    get: (query, params, callback) => { 
        if (callback) callback(null, {}); 
    }
};

module.exports = mockDb;
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