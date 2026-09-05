const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'attendance.db');

let db;

function initializeDatabase() {
    db = new Database(DB_PATH);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create participants table
    db.exec(`
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            college_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            year TEXT,
            branch TEXT,
            attendance_status TEXT DEFAULT 'absent',
            marked_at DATETIME,
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create index for faster searches
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_email ON participants(email);
        CREATE INDEX IF NOT EXISTS idx_college_id ON participants(college_id);
        CREATE INDEX IF NOT EXISTS idx_name ON participants(name);
        CREATE INDEX IF NOT EXISTS idx_phone ON participants(phone);
    `);

    console.log('Database initialized successfully');
    return db;
}

function getDb() {
    if (!db) {
        initializeDatabase();
    }
    return db;
}

module.exports = { initializeDatabase, getDb };