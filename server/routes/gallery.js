const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { galleryOps } = require('../database');

// 配置图片上传目录
const uploadDir = path.join(__dirname, '../uploads/gallery');
const thumbDir = path.join(__dirname, '../uploads/gallery/thumbnails');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
}

// 生成缩略图的辅助函数（根据宽高比智能调整）
async function generateThumbnail(inputPath, filename) {
    const thumbPath = path.join(thumbDir, filename);
    try {
        // 先读取图片元数据获取尺寸
        const metadata = await sharp(inputPath).metadata();
        const { width, height } = metadata;

        let resizeOptions;
        if (height > width) {
            // 竖图：按宽度 400px 缩放
            resizeOptions = { width: 400 };
        } else if (width > height) {
            // 横图：按高度 350px 缩放，这样在列表中显示更清晰
            resizeOptions = { height: 350 };
        } else {
            // 方图：按宽度 400px 缩放
            resizeOptions = { width: 400 };
        }

        await sharp(inputPath)
            .resize({
                ...resizeOptions,
                withoutEnlargement: true,
                fit: 'inside'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbPath.replace(/\.[^.]+$/, '.jpg'));
        return true;
    } catch (err) {
        console.error('Thumbnail generation failed:', err);
        return false;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 JPEG、PNG、WebP 格式的图片'));
        }
    }
});

// 认证中间件
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    next();
};

// 获取画廊列表
router.get('/', requireAuth, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const source = req.query.source || 'all';

    try {
        const images = galleryOps.list(page, limit, req.session.userId, source);
        const total = galleryOps.count(source);

        // 转换图片路径为 URL（缩略图 + 原图）
        const imagesWithUrls = images.map(img => {
            const thumbFilename = img.filename.replace(/\.[^.]+$/, '.jpg');
            return {
                ...img,
                thumbnailUrl: `/api/gallery/thumb/${thumbFilename}`,
                imageUrl: `/api/gallery/image/${img.filename}`
            };
        });

        res.json({
            images: imagesWithUrls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Gallery list error:', err);
        res.status(500).json({ error: '获取画廊失败' });
    }
});

// 上传图片到画廊
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        // 删除已上传的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: '请提供图片的提示词' });
    }

    try {
        // 生成缩略图
        await generateThumbnail(req.file.path, req.file.filename);

        const imageId = galleryOps.create(
            req.session.userId,
            req.file.filename,
            prompt,
            req.body.source || 'comfyui',
            req.body.metadata || null
        );

        const thumbFilename = req.file.filename.replace(/\.[^.]+$/, '.jpg');
        res.json({
            success: true,
            image: {
                id: imageId,
                filename: req.file.filename,
                thumbnailUrl: `/api/gallery/thumb/${thumbFilename}`,
                imageUrl: `/api/gallery/image/${req.file.filename}`,
                prompt
            }
        });
    } catch (err) {
        console.error('Gallery upload error:', err);
        // 删除已上传的文件
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: '上传失败' });
    }
});

// 通过 URL 上传（从历史记录上传）
router.post('/upload-url', requireAuth, async (req, res) => {
    let { imageUrl, prompt } = req.body;

    if (!imageUrl || !prompt) {
        return res.status(400).json({ error: '请提供图片 URL 和提示词' });
    }

    try {
        let buffer;

        // 检查是否是 base64 数据 URL
        if (imageUrl.startsWith('data:')) {
            // 解析 base64 数据
            const matches = imageUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
            if (!matches) {
                return res.status(400).json({ error: '无效的 base64 图片数据' });
            }
            buffer = Buffer.from(matches[2], 'base64');
        } else {
            // 处理相对 URL - 转换为绝对 URL
            if (imageUrl.startsWith('/')) {
                // 从请求头获取 host，构建绝对 URL
                const protocol = req.headers['x-forwarded-proto'] || 'https';
                const host = req.headers['x-forwarded-host'] || req.headers.host || 'newbie.rimeleaf.com';
                imageUrl = `${protocol}://${host}${imageUrl}`;
            }

            // 下载图片
            const fetch = require('node-fetch');
            const response = await fetch(imageUrl);

            if (!response.ok) {
                return res.status(400).json({ error: '无法获取图片' });
            }

            buffer = await response.buffer();
        }

        const filename = `${uuidv4()}.png`;
        const filepath = path.join(uploadDir, filename);

        fs.writeFileSync(filepath, buffer);

        // 生成缩略图
        await generateThumbnail(filepath, filename);

        const imageId = galleryOps.create(
            req.session.userId,
            filename,
            prompt,
            req.body.source || 'comfyui',
            req.body.metadata || null,
            req.body.originalUrl || imageUrl // 保存原始 URL 用于追踪已分享状态
        );

        const thumbFilename = filename.replace(/\.[^.]+$/, '.jpg');
        res.json({
            success: true,
            image: {
                id: imageId,
                filename,
                thumbnailUrl: `/api/gallery/thumb/${thumbFilename}`,
                imageUrl: `/api/gallery/image/${filename}`,
                prompt
            }
        });
    } catch (err) {
        console.error('Gallery upload-url error:', err.message, err.stack);
        res.status(500).json({ error: '上传失败: ' + err.message });
    }
});

// 获取缩略图
router.get('/thumb/:filename', (req, res) => {
    const filepath = path.join(thumbDir, req.params.filename);

    if (!fs.existsSync(filepath)) {
        // 如果缩略图不存在，返回原图
        const originalName = req.params.filename.replace('.jpg', '.png');
        const originalPath = path.join(uploadDir, originalName);
        if (fs.existsSync(originalPath)) {
            return res.sendFile(originalPath);
        }
        return res.status(404).json({ error: '图片不存在' });
    }

    res.sendFile(filepath);
});

// 获取原图
router.get('/image/:filename', (req, res) => {
    const filepath = path.join(uploadDir, req.params.filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: '图片不存在' });
    }

    res.sendFile(filepath);
});

// 点赞/取消点赞
router.post('/:id/like', requireAuth, (req, res) => {
    const imageId = parseInt(req.params.id);
    const image = galleryOps.getById(imageId, req.session.userId);

    if (!image) {
        return res.status(404).json({ error: '图片不存在' });
    }

    try {
        let liked;
        if (image.is_liked) {
            galleryOps.unlike(req.session.userId, imageId);
            liked = false;
        } else {
            galleryOps.like(req.session.userId, imageId);
            liked = true;
        }

        // 获取更新后的点赞数
        const updatedImage = galleryOps.getById(imageId, req.session.userId);

        res.json({
            success: true,
            liked,
            likesCount: updatedImage.likes_count
        });
    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 收藏/取消收藏
router.post('/:id/favorite', requireAuth, (req, res) => {
    const imageId = parseInt(req.params.id);
    const image = galleryOps.getById(imageId, req.session.userId);

    if (!image) {
        return res.status(404).json({ error: '图片不存在' });
    }

    try {
        let favorited;
        if (image.is_favorited) {
            galleryOps.unfavorite(req.session.userId, imageId);
            favorited = false;
        } else {
            galleryOps.favorite(req.session.userId, imageId);
            favorited = true;
        }

        res.json({
            success: true,
            favorited
        });
    } catch (err) {
        console.error('Favorite error:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 获取我的收藏
router.get('/favorites', requireAuth, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    try {
        const images = galleryOps.getFavorites(req.session.userId, page, limit);

        const imagesWithUrls = images.map(img => ({
            ...img,
            imageUrl: `/api/gallery/image/${img.filename}`
        }));

        res.json({
            images: imagesWithUrls
        });
    } catch (err) {
        console.error('Favorites list error:', err);
        res.status(500).json({ error: '获取收藏失败' });
    }
});

// ========== 管理员功能 ==========

// 管理员中间件
const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    if (!galleryOps.isAdmin(req.session.userId)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// 检查当前用户是否为管理员
router.get('/admin/check', requireAuth, (req, res) => {
    try {
        const isAdmin = galleryOps.isAdmin(req.session.userId);
        res.json({ isAdmin });
    } catch (err) {
        console.error('Admin check error:', err);
        res.status(500).json({ error: '检查权限失败' });
    }
});

// 软删除图片（管理员）
router.delete('/:id', requireAdmin, (req, res) => {
    const imageId = parseInt(req.params.id);

    try {
        const success = galleryOps.softDelete(imageId, req.session.userId);
        if (success) {
            res.json({ success: true, message: '图片已移至回收站' });
        } else {
            res.status(404).json({ error: '图片不存在' });
        }
    } catch (err) {
        console.error('Soft delete error:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 获取回收站列表（管理员）
router.get('/trash/list', requireAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    try {
        const images = galleryOps.listTrash(page, limit);
        const total = galleryOps.countTrash();

        const imagesWithUrls = images.map(img => {
            const thumbFilename = img.filename.replace(/\.[^.]+$/, '.jpg');
            return {
                ...img,
                thumbnailUrl: `/api/gallery/thumb/${thumbFilename}`,
                imageUrl: `/api/gallery/image/${img.filename}`
            };
        });

        res.json({
            images: imagesWithUrls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Trash list error:', err);
        res.status(500).json({ error: '获取回收站失败' });
    }
});

// 恢复图片（管理员）
router.post('/:id/restore', requireAdmin, (req, res) => {
    const imageId = parseInt(req.params.id);

    try {
        const success = galleryOps.restore(imageId);
        if (success) {
            res.json({ success: true, message: '图片已恢复' });
        } else {
            res.status(404).json({ error: '图片不存在' });
        }
    } catch (err) {
        console.error('Restore error:', err);
        res.status(500).json({ error: '恢复失败' });
    }
});

// 彻底删除图片（管理员）
router.delete('/:id/permanent', requireAdmin, (req, res) => {
    const imageId = parseInt(req.params.id);

    try {
        const filename = galleryOps.permanentDelete(imageId);
        if (filename) {
            // 删除原图和缩略图文件
            const imagePath = path.join(uploadDir, filename);
            const thumbFilename = filename.replace(/\.[^.]+$/, '.jpg');
            const thumbPath = path.join(thumbDir, thumbFilename);

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
            if (fs.existsSync(thumbPath)) {
                fs.unlinkSync(thumbPath);
            }

            res.json({ success: true, message: '图片已彻底删除' });
        } else {
            res.status(404).json({ error: '图片不存在' });
        }
    } catch (err) {
        console.error('Permanent delete error:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

module.exports = router;
