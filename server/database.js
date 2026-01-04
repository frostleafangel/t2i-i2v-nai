const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'data', 'newbie.db');

// 确保 data 目录存在
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化表结构
function initDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 邀请码表
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      used_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME
    )
  `);

  // 画廊图片表
  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      filename TEXT NOT NULL,
      prompt TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      metadata TEXT,
      source TEXT DEFAULT 'comfyui',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 点赞记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER REFERENCES users(id),
      image_id INTEGER REFERENCES gallery_images(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id)
    )
  `);

  // 收藏记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER REFERENCES users(id),
      image_id INTEGER REFERENCES gallery_images(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, image_id)
    )
  `);

  // 用户历史记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      image_url TEXT NOT NULL,
      prompt TEXT,
      negative_prompt TEXT,
      seed INTEGER,
      width INTEGER,
      height INTEGER,
      is_upscaled BOOLEAN DEFAULT 0,
      metadata TEXT,
      source TEXT DEFAULT 'comfyui',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('📦 Database initialized successfully');
}

// 用户相关操作
const userOps = {
  // 创建用户
  create: (username, password) => {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, hash);
    return result.lastInsertRowid;
  },

  // 通过用户名查找
  findByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  // 通过 ID 查找
  findById: (id) => {
    const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  },

  // 验证密码
  verifyPassword: (user, password) => {
    return bcrypt.compareSync(password, user.password_hash);
  }
};

// 邀请码相关操作
// 添加 styles 表（风格管理）
db.prepare(`
  CREATE TABLE IF NOT EXISTS styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    config TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 检查是否需要添加 user_liked_styles 表（点赞记录）
db.prepare(`
  CREATE TABLE IF NOT EXISTS user_liked_styles (
    user_id INTEGER REFERENCES users(id),
    style_id INTEGER REFERENCES styles(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, style_id)
  )
`).run();

const inviteOps = {
  // 创建邀请码
  create: (code) => {
    const stmt = db.prepare('INSERT INTO invite_codes (code) VALUES (?)');
    return stmt.run(code);
  },

  // 检查邀请码是否有效（未使用）
  isValid: (code) => {
    const stmt = db.prepare('SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL');
    return stmt.get(code);
  },

  // 使用邀请码
  use: (code, userId) => {
    const stmt = db.prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND used_by IS NULL');
    return stmt.run(userId, code);
  },

  // 列出所有邀请码
  listAll: () => {
    const stmt = db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC');
    return stmt.all();
  }
};

// 画廊相关操作
const galleryOps = {
  // 上传图片
  create: (userId, filename, prompt, source = 'comfyui', metadata = null, sourceUrl = null) => {
    const stmt = db.prepare('INSERT INTO gallery_images (user_id, filename, prompt, source, metadata, source_url) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(userId, filename, prompt, source, metadata, sourceUrl);
    return result.lastInsertRowid;
  },

  // 获取画廊列表（分页）- 排除已删除的
  list: (page = 1, limit = 20, currentUserId = null, source = 'all') => {
    const offset = (page - 1) * limit;
    let whereClause = source === 'all'
      ? 'WHERE (g.is_deleted = 0 OR g.is_deleted IS NULL)'
      : 'WHERE (g.is_deleted = 0 OR g.is_deleted IS NULL) AND g.source = ?';
    let query = `
      SELECT 
        g.*,
        u.username as author,
        CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
        CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
      FROM gallery_images g
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN likes l ON g.id = l.image_id AND l.user_id = ?
      LEFT JOIN favorites f ON g.id = f.image_id AND f.user_id = ?
      ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(query);


    if (source === 'all') {
      return stmt.all(currentUserId, currentUserId, limit, offset);
    }
    return stmt.all(currentUserId, currentUserId, source, limit, offset);
  },

  // 获取总数 - 排除已删除的
  count: (source = 'all') => {
    if (source === 'all') {
      const stmt = db.prepare('SELECT COUNT(*) as total FROM gallery_images WHERE (is_deleted = 0 OR is_deleted IS NULL)');
      return stmt.get().total;
    }
    const stmt = db.prepare('SELECT COUNT(*) as total FROM gallery_images WHERE (is_deleted = 0 OR is_deleted IS NULL) AND source = ?');
    return stmt.get(source).total;
  },

  // 获取单张图片
  getById: (id, currentUserId = null) => {
    const stmt = db.prepare(`
      SELECT 
        g.*,
        u.username as author,
        CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked,
        CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorited
      FROM gallery_images g
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN likes l ON g.id = l.image_id AND l.user_id = ?
      LEFT JOIN favorites f ON g.id = f.image_id AND f.user_id = ?
      WHERE g.id = ?
    `);
    return stmt.get(currentUserId, currentUserId, id);
  },

  // 点赞
  like: (userId, imageId) => {
    const insertStmt = db.prepare('INSERT OR IGNORE INTO likes (user_id, image_id) VALUES (?, ?)');
    const result = insertStmt.run(userId, imageId);
    if (result.changes > 0) {
      db.prepare('UPDATE gallery_images SET likes_count = likes_count + 1 WHERE id = ?').run(imageId);
    }
    return result.changes > 0;
  },

  // 取消点赞
  unlike: (userId, imageId) => {
    const deleteStmt = db.prepare('DELETE FROM likes WHERE user_id = ? AND image_id = ?');
    const result = deleteStmt.run(userId, imageId);
    if (result.changes > 0) {
      db.prepare('UPDATE gallery_images SET likes_count = likes_count - 1 WHERE id = ?').run(imageId);
    }
    return result.changes > 0;
  },

  // 收藏
  favorite: (userId, imageId) => {
    const stmt = db.prepare('INSERT OR IGNORE INTO favorites (user_id, image_id) VALUES (?, ?)');
    return stmt.run(userId, imageId).changes > 0;
  },

  // 取消收藏
  unfavorite: (userId, imageId) => {
    const stmt = db.prepare('DELETE FROM favorites WHERE user_id = ? AND image_id = ?');
    return stmt.run(userId, imageId).changes > 0;
  },

  // 获取用户收藏列表
  getFavorites: (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const stmt = db.prepare(`
      SELECT 
        g.*,
        u.username as author,
        1 as is_favorited,
        CASE WHEN l.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
      FROM favorites f
      JOIN gallery_images g ON f.image_id = g.id
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN likes l ON g.id = l.image_id AND l.user_id = ?
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(userId, userId, limit, offset);
  },

  // 检查用户是否为管理员
  isAdmin: (userId) => {
    const stmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = stmt.get(userId);
    return user && user.is_admin === 1;
  },

  // 软删除图片
  softDelete: (imageId, adminUserId) => {
    const stmt = db.prepare(`
      UPDATE gallery_images 
      SET is_deleted = 1, deleted_at = datetime('now'), deleted_by = ?
      WHERE id = ?
    `);
    return stmt.run(adminUserId, imageId).changes > 0;
  },

  // 恢复图片
  restore: (imageId) => {
    const stmt = db.prepare(`
      UPDATE gallery_images 
      SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL
      WHERE id = ?
    `);
    return stmt.run(imageId).changes > 0;
  },

  // 彻底删除图片（返回文件名以便删除文件）
  permanentDelete: (imageId) => {
    const getStmt = db.prepare('SELECT filename FROM gallery_images WHERE id = ?');
    const image = getStmt.get(imageId);
    if (!image) return null;

    // 删除相关的点赞和收藏记录
    db.prepare('DELETE FROM likes WHERE image_id = ?').run(imageId);
    db.prepare('DELETE FROM favorites WHERE image_id = ?').run(imageId);
    // 删除图片记录
    db.prepare('DELETE FROM gallery_images WHERE id = ?').run(imageId);

    return image.filename;
  },

  // 获取回收站列表
  listTrash: (page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const stmt = db.prepare(`
      SELECT 
        g.*,
        u.username as author,
        deleter.username as deleted_by_username
      FROM gallery_images g
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN users deleter ON g.deleted_by = deleter.id
      WHERE g.is_deleted = 1
      ORDER BY g.deleted_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  // 获取回收站总数
  countTrash: () => {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM gallery_images WHERE is_deleted = 1');
    return stmt.get().total;
  }
};

// 历史记录相关操作
const historyOps = {
  // 添加历史记录
  add: (userId, imageData) => {
    const stmt = db.prepare(`
      INSERT INTO user_history (user_id, image_url, prompt, negative_prompt, seed, width, height, is_upscaled, metadata, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      imageData.url,
      imageData.prompt || null,
      imageData.negativePrompt || null,
      imageData.seed || null,
      imageData.width || null,
      imageData.height || null,
      imageData.isUpscaled ? 1 : 0,
      imageData.metadata ? JSON.stringify(imageData.metadata) : null,
      imageData.source || 'comfyui'
    );
    return result.lastInsertRowid;
  },

  // 批量同步历史记录
  syncBatch: (userId, images) => {
    const stmt = db.prepare(`
      INSERT INTO user_history (user_id, image_url, prompt, negative_prompt, seed, width, height, is_upscaled, metadata, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const img of items) {
        stmt.run(
          userId,
          img.url,
          img.prompt || null,
          img.negativePrompt || null,
          img.seed || null,
          img.width || null,
          img.height || null,
          img.isUpscaled ? 1 : 0,
          img.metadata ? JSON.stringify(img.metadata) : null,
          img.source || 'comfyui',
          img.timestamp ? new Date(img.timestamp).toISOString() : new Date().toISOString()
        );
      }
    });

    insertMany(images);
    return images.length;
  },

  // 获取用户历史记录
  getByUser: (userId, limit = 100, source = null) => {
    let query = `
      SELECT * FROM user_history 
      WHERE user_id = ?
    `;
    const params = [userId];

    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(row => {
      let metadata = null;
      if (row.metadata) {
        try {
          metadata = JSON.parse(row.metadata);
        } catch (e) {
          console.warn('Failed to parse history metadata:', e);
        }
      }
      return { ...row, metadata };
    });
  },

  // 删除历史记录
  delete: (userId, historyId) => {
    const stmt = db.prepare('DELETE FROM user_history WHERE id = ? AND user_id = ?');
    return stmt.run(historyId, userId).changes > 0;
  },

  // 清理7天前的历史记录
  cleanupOldRecords: () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare('DELETE FROM user_history WHERE created_at < ?');
    const result = stmt.run(sevenDaysAgo);
    return result.changes;
  }
};

// 初始化数据库
initDatabase();

// 启动时清理一次过期记录
const cleaned = historyOps.cleanupOldRecords();
if (cleaned > 0) {
  console.log(`🧹 Cleaned up ${cleaned} expired history records`);
}

const styleOps = {
  // 创建风格
  create: (userId, name, description, coverImageUrl, config, isPublic = 0) => {
    const stmt = db.prepare('INSERT INTO styles (user_id, name, description, cover_image_url, config, is_public) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(userId, name, description, coverImageUrl, JSON.stringify(config), isPublic);
    return info.lastInsertRowid;
  },

  // 获取单个风格
  getById: (id) => {
    return db.prepare(`
      SELECT s.*, u.username as author 
      FROM styles s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `).get(id);
  },

  // 获取用户的风格
  listByUser: (userId) => {
    const rows = db.prepare('SELECT * FROM styles WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return rows.map(row => ({
      ...row,
      config: JSON.parse(row.config)
    }));
  },

  // 获取公共风格
  listPublic: (currentUserId, limit = 50) => {
    const rows = db.prepare(`
        SELECT s.*, u.username as author,
        EXISTS(SELECT 1 FROM user_liked_styles uls WHERE uls.style_id = s.id AND uls.user_id = ?) as is_liked
        FROM styles s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.is_public = 1 
        ORDER BY s.likes_count DESC, s.created_at DESC 
        LIMIT ?
    `).all(currentUserId || 0, limit);
    return rows.map(row => ({
      ...row,
      config: JSON.parse(row.config),
      is_liked: !!row.is_liked
    }));
  },

  // 删除风格
  delete: (id, userId) => {
    const result = db.prepare('DELETE FROM styles WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },

  // 切换公开状态
  togglePublic: (id, userId) => {
    const style = db.prepare('SELECT is_public FROM styles WHERE id = ? AND user_id = ?').get(id, userId);
    if (!style) return null;

    const newStatus = style.is_public ? 0 : 1;
    db.prepare('UPDATE styles SET is_public = ? WHERE id = ?').run(newStatus, id);
    return newStatus;
  },

  // 点赞/取消点赞
  toggleLike: (userId, styleId) => {
    const exists = db.prepare('SELECT 1 FROM user_liked_styles WHERE user_id = ? AND style_id = ?').get(userId, styleId);

    if (exists) {
      // 取消点赞
      db.prepare('DELETE FROM user_liked_styles WHERE user_id = ? AND style_id = ?').run(userId, styleId);
      db.prepare('UPDATE styles SET likes_count = likes_count - 1 WHERE id = ?').run(styleId);
      return false;
    } else {
      // 点赞
      db.prepare('INSERT INTO user_liked_styles (user_id, style_id) VALUES (?, ?)').run(userId, styleId);
      db.prepare('UPDATE styles SET likes_count = likes_count + 1 WHERE id = ?').run(styleId);
      return true;
    }
  }
};

module.exports = {
  db,
  userOps,
  inviteOps,
  galleryOps,
  historyOps,
  styleOps
};
