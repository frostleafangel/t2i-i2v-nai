/**
 * Migration: Add admin permission and soft-delete fields for gallery
 * 
 * Changes:
 * 1. Add is_admin column to users table
 * 2. Set frostleaf as admin
 * 3. Add soft-delete columns to gallery_images table
 */

const { db } = require('../database');

console.log('🔄 Running gallery admin migration...');

try {
    // 1. Check if is_admin column exists
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    const hasIsAdmin = userCols.some(c => c.name === 'is_admin');

    if (!hasIsAdmin) {
        console.log('  Adding is_admin column to users...');
        db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
    } else {
        console.log('  is_admin column already exists');
    }

    // 2. Set frostleaf as admin
    console.log('  Setting frostleaf as admin...');
    const result = db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'frostleaf'").run();
    console.log(`  Updated ${result.changes} user(s)`);

    // 3. Check gallery_images columns
    const galleryCols = db.prepare("PRAGMA table_info(gallery_images)").all();

    // Add is_deleted
    if (!galleryCols.some(c => c.name === 'is_deleted')) {
        console.log('  Adding is_deleted column to gallery_images...');
        db.exec('ALTER TABLE gallery_images ADD COLUMN is_deleted INTEGER DEFAULT 0');
    } else {
        console.log('  is_deleted column already exists');
    }

    // Add deleted_at
    if (!galleryCols.some(c => c.name === 'deleted_at')) {
        console.log('  Adding deleted_at column to gallery_images...');
        db.exec('ALTER TABLE gallery_images ADD COLUMN deleted_at DATETIME');
    } else {
        console.log('  deleted_at column already exists');
    }

    // Add deleted_by
    if (!galleryCols.some(c => c.name === 'deleted_by')) {
        console.log('  Adding deleted_by column to gallery_images...');
        db.exec('ALTER TABLE gallery_images ADD COLUMN deleted_by INTEGER');
    } else {
        console.log('  deleted_by column already exists');
    }

    // Verify admin user
    const admin = db.prepare("SELECT id, username, is_admin FROM users WHERE is_admin = 1").get();
    if (admin) {
        console.log(`\n✅ Admin user: ${admin.username} (id: ${admin.id})`);
    } else {
        console.log('\n⚠️ No admin user found!');
    }

    console.log('\n✅ Migration completed successfully!');

} catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
}
