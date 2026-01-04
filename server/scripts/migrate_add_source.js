const { db } = require('../database');

console.log('Starting migration: Adding source column to user_history table...');

try {
    // Check if column already exists
    const tableInfo = db.pragma('table_info(user_history)');
    const hasSource = tableInfo.some(col => col.name === 'source');

    if (hasSource) {
        console.log('Column "source" already exists. Skipping migration.');
    } else {
        // Add column
        db.prepare('ALTER TABLE user_history ADD COLUMN source TEXT').run();
        console.log('Successfully added "source" column.');

        // Backfill data
        // Assume entries with metadata are NovelAI (as feature was just added)
        // Entries without metadata are legacy ComfyUI
        const updateNovelAI = db.prepare("UPDATE user_history SET source = 'novelai' WHERE metadata IS NOT NULL");
        const resultNAI = updateNovelAI.run();
        console.log(`Marked ${resultNAI.changes} records as 'novelai'.`);

        const updateComfy = db.prepare("UPDATE user_history SET source = 'comfyui' WHERE source IS NULL");
        const resultComfy = updateComfy.run();
        console.log(`Marked ${resultComfy.changes} records as 'comfyui'.`);
    }
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}

console.log('Migration completed successfully.');
