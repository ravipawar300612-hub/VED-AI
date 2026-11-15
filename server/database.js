// ==========================================
// VED AI DATABASE — TURSO CLOUD (PERMANENT MEMORY ☁️)
// Founder : Sayali P. R. Pawar
// ==========================================
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('❌ DATABASE: Render mein TURSO_DATABASE_URL aur TURSO_AUTH_TOKEN env add karo!');
}

const client = createClient({ url: url, authToken: authToken });

function normArgs(params, callback) {
    if (typeof params === 'function') return { args: [], cb: params };
    return { args: Array.isArray(params) ? params : [], cb: callback };
}

const db = {
    run(query, params, callback) {
        const { args, cb } = normArgs(params, callback);
        client.execute({ sql: query, args: args })
            .then(function (res) { if (cb) cb.call({ changes: res.rowsAffected }, null); })
            .catch(function (err) { console.error('❌ DB run error:', err.message); if (cb) cb.call({ changes: 0 }, err); });
    },
    all(query, params, callback) {
        const { args, cb } = normArgs(params, callback);
        client.execute({ sql: query, args: args })
            .then(function (res) { if (cb) cb(null, res.rows); })
            .catch(function (err) { console.error('❌ DB all error:', err.message); if (cb) cb(err, []); });
    },
    get(query, params, callback) {
        const { args, cb } = normArgs(params, callback);
        client.execute({ sql: query, args: args })
            .then(function (res) { if (cb) cb(null, res.rows[0]); })
            .catch(function (err) { if (cb) cb(err, undefined); });
    },
    exec(sql, callback) {
        client.executeMultiple(sql)
            .then(function () { if (callback) callback(null); })
            .catch(function (err) { if (callback) callback(err); });
    },
    close(cb) { if (cb) cb(null); }
};

client.execute('SELECT 1')
    .then(function () { console.log('☁️ TURSO CLOUD DATABASE CONNECTED — VED ki memory ab PERMANENT!'); })
    .catch(function (e) { console.error('❌ Turso connection fail:', e.message); });

module.exports = db;