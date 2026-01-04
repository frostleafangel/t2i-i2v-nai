const express = require('express');
const router = express.Router();
const { historyOps } = require('../database');

// 认证中间件
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    next();
};

// 获取用户历史记录
router.get('/', requireAuth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const source = req.query.source || 'comfyui'; // 默认为 comfyui，实现分离

    try {
        const history = historyOps.getByUser(req.session.userId, limit, source);

        // 获取该用户所有已上传到画廊的图片源 URL
        const { db } = require('../database');
        const galleryImages = db.prepare(`
            SELECT source_url FROM gallery_images 
            WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND source_url IS NOT NULL
        `).all(req.session.userId);

        // 创建已分享URL的Set用于快速查找（归一化URL，只保留路径部分）
        const normalizeUrl = (url) => {
            if (!url) return '';
            // 如果是完整URL，提取路径部分
            if (url.startsWith('http://') || url.startsWith('https://')) {
                try {
                    const urlObj = new URL(url);
                    return urlObj.pathname + urlObj.search;
                } catch (e) {
                    return url;
                }
            }
            return url;
        };
        const sharedUrls = new Set(galleryImages.map(g => normalizeUrl(g.source_url)));

        // 转换为前端期望的格式
        const formattedHistory = history.map(h => {
            // SQLite stores created_at as UTC without timezone indicator
            // Append 'Z' to parse as UTC, or extract timestamp from URL if available
            let timestamp;
            if (h.image_url && h.image_url.includes('nai_') || h.image_url && h.image_url.includes('ai_')) {
                // Extract timestamp from filename like nai_1766395809969_xxx.png
                const match = h.image_url.match(/(?:nai|ai)_(\d+)_/);
                if (match) {
                    timestamp = parseInt(match[1], 10);
                }
            }
            if (!timestamp) {
                // Fallback: parse created_at as UTC by appending Z
                const createdAtStr = h.created_at.replace(' ', 'T') + 'Z';
                timestamp = new Date(createdAtStr).getTime();
            }

            // 检查是否已分享到画廊（归一化后比较）
            const normalizedHistoryUrl = normalizeUrl(h.image_url);
            const isShared = sharedUrls.has(normalizedHistoryUrl);

            return {
                id: h.id.toString(),
                url: h.image_url,
                prompt: h.prompt,
                negativePrompt: h.negative_prompt,
                seed: h.seed,
                width: h.width,
                height: h.height,
                isUpscaled: !!h.is_upscaled,
                metadata: h.metadata,
                timestamp,
                isShared
            };
        });

        res.json({ history: formattedHistory });
    } catch (err) {
        console.error('History get error:', err);
        res.status(500).json({ error: '获取历史记录失败' });
    }
});

// 添加单条历史记录
router.post('/', requireAuth, (req, res) => {
    const imageData = req.body;
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../history_error.log');

    if (!imageData.url) {
        return res.status(400).json({ error: '缺少图片 URL' });
    }

    try {
        const id = historyOps.add(req.session.userId, imageData);
        res.json({ success: true, id });
    } catch (err) {
        const errMsg = `[${new Date().toISOString()}] History add error: ${err.message}\n${err.stack}\nImageData: ${JSON.stringify(imageData)}\n\n`;
        fs.appendFileSync(logFile, errMsg);
        console.error('History add error:', err);
        res.status(500).json({ error: '添加历史记录失败' });
    }
});

// 批量同步历史记录（从 localStorage 迁移）
router.post('/sync', requireAuth, (req, res) => {
    const { images } = req.body;

    if (!Array.isArray(images)) {
        return res.status(400).json({ error: '无效的数据格式' });
    }

    try {
        // 过滤掉已经存在的记录（通过 URL 判断）
        const existingUrls = new Set(
            historyOps.getByUser(req.session.userId, 1000).map(h => h.image_url)
        );

        const newImages = images.filter(img => img.url && !existingUrls.has(img.url));

        if (newImages.length > 0) {
            historyOps.syncBatch(req.session.userId, newImages);
        }

        res.json({
            success: true,
            synced: newImages.length,
            skipped: images.length - newImages.length
        });
    } catch (err) {
        console.error('History sync error:', err);
        res.status(500).json({ error: '同步失败' });
    }
});

// 删除历史记录
router.delete('/:id', requireAuth, (req, res) => {
    const historyId = parseInt(req.params.id);

    try {
        const deleted = historyOps.delete(req.session.userId, historyId);

        if (!deleted) {
            return res.status(404).json({ error: '记录不存在' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('History delete error:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

module.exports = router;
