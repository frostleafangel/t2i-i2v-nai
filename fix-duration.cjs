const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'server', 'data', 'newbie.db');
const db = new Database(DB_PATH);

console.log('Starting cleanup of generation_logs duration_ms...');

// We know the offset is exactly 8 hours because of UTC+8 vs UTC error.
// 8 hours = 28,800,000 ms.
// Let's find all rows with duration_ms > 28000000
const rowsToFix = db.prepare(`SELECT id, duration_ms FROM generation_logs WHERE duration_ms > 28000000`).all();

console.log(`Found ${rowsToFix.length} rows with inflated duration.`);

const updateStmt = db.prepare(`UPDATE generation_logs SET duration_ms = ? WHERE id = ?`);

let fixedCount = 0;
for (const row of rowsToFix) {
    let newDuration = row.duration_ms - 28800000;
    
    // If somehow the result is negative, cap it to a sensible default or the actual remainder
    if (newDuration < 0) {
        newDuration = 5000; // fallback to 5 seconds
    }
    
    updateStmt.run(newDuration, row.id);
    fixedCount++;
}

console.log(`Successfully fixed ${fixedCount} rows.`);
