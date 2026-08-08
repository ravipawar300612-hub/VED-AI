const db = require("./database");

// Save Memory
function saveMemory(key, value) {

    db.run(
        "INSERT INTO memories(memoryKey, memoryValue) VALUES(?, ?)",
        [key, value]
    );

}

// Read Memory
function getAllMemories(callback) {

    db.all(
        "SELECT * FROM memories",
        [],
        (err, rows) => {

            callback(rows);

        }
    );

}

module.exports = {
    saveMemory,
    getAllMemories
};