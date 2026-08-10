// ==========================================
// VED AI DATABASE - DEMO MODE
// Founder : Sayali P. R. Pawar
// ==========================================

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