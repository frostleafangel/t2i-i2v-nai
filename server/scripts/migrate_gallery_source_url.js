/**
 * Migration: Add source_url column to gallery_images for tracking original history URL
 */

const { db } = require('../database');

console.log('🔄 Adding source_url column to gallery_images...');

try {
    const cols = db.prepare("PRAGMA table_info(gallery_images)").all();
    const hasSourceUrl = cols.some(c => c.name === 'source_url');

    if (!hasSourceUrl) {
        db.exec('ALTER TABLE gallery_images ADD COLUMN source_url TEXT');
        console.log('✅ Added source_url column');
    } else {
        console.log('ℹ️ source_url column already exists');
    }

    console.log('✅ Migration completed');
} catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
}
