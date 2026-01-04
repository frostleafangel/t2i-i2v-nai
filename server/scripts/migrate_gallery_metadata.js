const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/newbie.db'));

try {
    // 1. 检查是否存在 metadata 列
    const tableInfo = db.prepare("PRAGMA table_info(gallery_images)").all();
    const hasMetadata = tableInfo.some(col => col.name === 'metadata');

    if (!hasMetadata) {
        console.log('Adding metadata column to gallery_images...');
        db.prepare('ALTER TABLE gallery_images ADD COLUMN metadata TEXT').run();
        console.log('Done.');
    } else {
        console.log('metadata column already exists.');
    }

    console.log('Migration completed successfully.');
} catch (err) {
    console.error('Migration failed:', err);
} finally {
    db.close();
}
