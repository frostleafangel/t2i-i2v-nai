const { db } = require('../database');

console.log('Starting migration: Adding source column to gallery_images table...');

try {
    // Check if column already exists
    const tableInfo = db.pragma('table_info(gallery_images)');
    const hasSource = tableInfo.some(col => col.name === 'source');

    if (hasSource) {
        console.log('Column "source" already exists. Skipping migration.');
    } else {
        // Add column with default 'comfyui' (since all existing gallery images are from there)
        db.prepare("ALTER TABLE gallery_images ADD COLUMN source TEXT DEFAULT 'comfyui'").run();
        console.log('Successfully added "source" column.');
    }
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}

console.log('Migration completed successfully.');
