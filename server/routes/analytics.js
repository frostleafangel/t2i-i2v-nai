/**
 * 数据分析 API 路由（管理员专用）
 * 提供生图服务的使用统计数据
 */

const express = require('express');
const router = express.Router();
const { generationLogOps, galleryOps } = require('../database');

// 管理员认证中间件
const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    if (!galleryOps.isAdmin(req.session.userId)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

/**
 * GET /api/analytics/overview
 * 总览统计：总生成数、成功率、今日数据
 * Query: ?days=30
 */
router.get('/overview', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const overview = generationLogOps.getOverview(days, source);
        const today = generationLogOps.getTodayStats(source);

        res.json({
            period: { days },
            overview,
            today
        });
    } catch (err) {
        console.error('[Analytics] Overview error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/hourly
 * 按小时分布（分析使用高峰时段）
 * Query: ?days=7
 */
router.get('/hourly', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const source = req.query.source || 'all';
        const hourly = generationLogOps.getHourlyStats(days, source);
        res.json({ period: { days, source }, hourly });
    } catch (err) {
        console.error('[Analytics] Hourly error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/daily
 * 每日趋势
 * Query: ?days=30
 */
router.get('/daily', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const daily = generationLogOps.getDailyStats(days, source);
        res.json({ period: { days, source }, daily });
    } catch (err) {
        console.error('[Analytics] Daily error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/models
 * 模型使用排行
 * Query: ?days=30
 */
router.get('/models', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const models = generationLogOps.getModelStats(days, source);
        res.json({ period: { days, source }, models });
    } catch (err) {
        console.error('[Analytics] Models error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/users
 * 用户使用排行
 * Query: ?days=30
 */
router.get('/users', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const users = generationLogOps.getUserStats(days, source);
        res.json({ period: { days, source }, users });
    } catch (err) {
        console.error('[Analytics] Users error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/sources
 * 来源分布（NovelAI vs ComfyUI）
 * Query: ?days=30
 */
router.get('/sources', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const sources = generationLogOps.getSourceStats(days);
        res.json({ period: { days }, sources });
    } catch (err) {
        console.error('[Analytics] Sources error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/queue
 * 24小时排队等待耗时统计
 * Query: ?days=7&source=all
 */
router.get('/queue', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const source = req.query.source || 'all';
        const queueStats = generationLogOps.getHourlyQueueStats(days, source);
        res.json({ period: { days, source }, queueStats });
    } catch (err) {
        console.error('[Analytics] Queue stats error:', err);
        res.status(500).json({ error: '获取排队统计失败' });
    }
});

/**
 * GET /api/analytics/resolutions
 * 分辨率分布
 * Query: ?days=30
 */
router.get('/resolutions', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const resolutions = generationLogOps.getResolutionStats(days);
        res.json({ period: { days }, resolutions });
    } catch (err) {
        console.error('[Analytics] Resolutions error:', err);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

/**
 * GET /api/analytics/recent
 * 最近的生成日志
 * Query: ?limit=50
 */
router.get('/recent', requireAdmin, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const logs = generationLogOps.getRecentLogs(limit);
        res.json({ logs });
    } catch (err) {
        console.error('[Analytics] Recent error:', err);
        res.status(500).json({ error: '获取日志失败' });
    }
});

/**
 * GET /api/analytics/errors
 * 失败原因排行
 */
router.get('/errors', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const errors = generationLogOps.getErrorStats(days, source);
        res.json({ period: { days, source }, errors });
    } catch (err) {
        console.error('[Analytics] Errors list error:', err);
        res.status(500).json({ error: '获取失败排行失败' });
    }
});

/**
 * GET /api/analytics/loras
 * LoRA使用排行
 */
router.get('/loras', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const loras = generationLogOps.getLoraStats(days, source);
        res.json({ period: { days, source }, loras });
    } catch (err) {
        console.error('[Analytics] Loras list error:', err);
        res.status(500).json({ error: '获取LoRA排行失败' });
    }
});

/**
 * GET /api/analytics/activity
 * 核心用户活动热力图
 */
router.get('/activity', requireAdmin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const source = req.query.source || 'all';
        const activity = generationLogOps.getActivityHeatmap(days, source);
        res.json({ period: { days, source }, activity });
    } catch (err) {
        console.error('[Analytics] Activity heatmap error:', err);
        res.status(500).json({ error: '获取活动热点图失败' });
    }
});

module.exports = router;
