const { db } = require('../database');

console.log('Starting migration: Adding metadata column to user_history table...');

try {
    // Check if column already exists
    const tableInfo = db.pragma('table_info(user_history)');
    const hasMetadata = tableInfo.some(col => col.name === 'metadata');

    if (hasMetadata) {
        console.log('Column "metadata" already exists. Skipping migration.');
    } else {
        db.prepare('ALTER TABLE user_history ADD COLUMN metadata TEXT').run();
        console.log('Successfully added "metadata" column to user_history table.');
    }
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}

console.log('Migration completed successfully.');
