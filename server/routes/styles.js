const express = require('express');
const router = express.Router();
const { styleOps } = require('../database');

// 认证中间件
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    next();
};

// 后取我的风格列表
router.get('/', requireAuth, (req, res) => {
    try {
        const styles = styleOps.listByUser(req.session.userId);
        res.json({ styles });
    } catch (err) {
        console.error('List styles error:', err);
        res.status(500).json({ error: '获取风格列表失败' });
    }
});

// 获取公共风格广场
router.get('/public', (req, res) => {
    try {
        const currentUserId = req.session.userId || 0;
        const styles = styleOps.listPublic(currentUserId);
        res.json({ styles });
    } catch (err) {
        console.error('List public styles error:', err);
        res.status(500).json({ error: '获取公共风格失败' });
    }
});

// 创建新风格
router.post('/', requireAuth, (req, res) => {
    const { name, description, coverImageUrl, config, isPublic } = req.body;

    if (!name || !coverImageUrl || !config) {
        return res.status(400).json({ error: '请提供必要信息(名称、封面、配置)' });
    }

    try {
        const id = styleOps.create(
            req.session.userId,
            name,
            description,
            coverImageUrl,
            config,
            isPublic ? 1 : 0
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('Create style error:', err);
        res.status(500).json({ error: '创建风格失败' });
    }
});

// 删除风格
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const success = styleOps.delete(req.params.id, req.session.userId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '风格不存在或无权删除' });
        }
    } catch (err) {
        console.error('Delete style error:', err);
        res.status(500).json({ error: '删除风格失败' });
    }
});

// 切换公开状态
router.post('/:id/toggle-public', requireAuth, (req, res) => {
    try {
        const newStatus = styleOps.togglePublic(req.params.id, req.session.userId);
        if (newStatus !== null) {
            res.json({ success: true, is_public: newStatus });
        } else {
            res.status(404).json({ error: '风格不存在或无权操作' });
        }
    } catch (err) {
        console.error('Toggle public error:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 点赞/取消点赞
router.post('/:id/like', requireAuth, (req, res) => {
    try {
        const liked = styleOps.toggleLike(req.session.userId, req.params.id);
        const style = styleOps.getById(req.params.id); // 获取最新点赞数
        res.json({ success: true, liked, likesCount: style.likes_count });
    } catch (err) {
        console.error('Toggle like error:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

module.exports = router;
