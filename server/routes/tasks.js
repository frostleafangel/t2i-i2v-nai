/**
 * 任务管理 API 路由
 * 管理 ComfyUI 任务的生命周期
 */

const express = require('express');
const router = express.Router();
const { taskOps, generationLogOps } = require('../database');

// 认证中间件
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '未登录' });
    }
    next();
};

/**
 * 获取用户的活动任务
 * GET /api/tasks/active
 */
router.get('/active', requireAuth, (req, res) => {
    try {
        const tasks = taskOps.getActiveByUser(req.session.userId);
        res.json({ tasks });
    } catch (err) {
        console.error('[Tasks] Failed to get active tasks:', err);
        res.status(500).json({ error: '获取任务失败' });
    }
});

/**
 * 获取用户的最近任务
 * GET /api/tasks
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const tasks = taskOps.getRecentByUser(req.session.userId, limit);
        res.json({ tasks });
    } catch (err) {
        console.error('[Tasks] Failed to get recent tasks:', err);
        res.status(500).json({ error: '获取任务失败' });
    }
});

/**
 * 获取单个任务详情
 * GET /api/tasks/:id
 */
router.get('/:id', requireAuth, (req, res) => {
    try {
        const task = taskOps.getById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        // 只能查看自己的任务
        if (task.user_id !== req.session.userId) {
            return res.status(403).json({ error: '无权访问' });
        }
        res.json({ task });
    } catch (err) {
        console.error('[Tasks] Failed to get task:', err);
        res.status(500).json({ error: '获取任务失败' });
    }
});

/**
 * 创建任务
 * POST /api/tasks
 * Body: { type, params }
 */
router.post('/', requireAuth, (req, res) => {
    try {
        const { id, type, params } = req.body;

        if (!id || !type) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 检查任务是否已存在
        const existing = taskOps.getById(id);
        if (existing) {
            return res.json({ task: existing, created: false });
        }

        taskOps.create(id, req.session.userId, type, params || {});
        const task = taskOps.getById(id);
        res.json({ task, created: true });
    } catch (err) {
        console.error('[Tasks] Failed to create task:', err);
        res.status(500).json({ error: '创建任务失败' });
    }
});

/**
 * 更新任务状态
 * PATCH /api/tasks/:id
 * Body: { status, result_url, error_message }
 */
router.patch('/:id', requireAuth, (req, res) => {
    try {
        const task = taskOps.getById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        if (task.user_id !== req.session.userId) {
            return res.status(403).json({ error: '无权修改' });
        }

        const { status, result_url, error_message, queue_wait_ms } = req.body;
        taskOps.updateStatus(req.params.id, status, result_url, error_message);

        // 任务完成或失败时记录生图日志
        if (status === 'completed' || status === 'failed') {
            try {
                const params = task.params || {};
                // SQLite 存入的 'YYYY-MM-DD HH:MM:SS' 是 UTC 时间，补全为 ISO 标准的 UTC 格式避免按本地时间解析导致差8小时
                const createdAtStr = task.created_at.replace(' ', 'T') + 'Z';
                const createdAt = new Date(createdAtStr).getTime();
                const duration = Date.now() - createdAt;

                let loras = null;
                if (Array.isArray(params.loras) && params.loras.length > 0) {
                    loras = JSON.stringify(params.loras.map(l => l?.name || l));
                }

                generationLogOps.log({
                    user_id: task.user_id,
                    source: task.type || 'comfyui',
                    generation_type: task.type || 'comfyui',
                    model: params.model || params.checkpoint || null,
                    width: params.width || null,
                    height: params.height || null,
                    steps: params.steps || null,
                    sampler: params.sampler || null,
                    scale: params.cfg || params.scale || null,
                    seed: params.seed || null,
                    status: status === 'completed' ? 'success' : 'failed',
                    error_message: error_message || null,
                    duration_ms: duration > 0 ? duration : null,
                    queue_wait_ms: queue_wait_ms > 0 ? queue_wait_ms : null,
                    loras: loras,
                    image_count: 1
                });
            } catch (logErr) {
                console.error('[Tasks] Failed to log generation:', logErr.message);
            }
        }

        const updated = taskOps.getById(req.params.id);
        res.json({ task: updated });
    } catch (err) {
        console.error('[Tasks] Failed to update task:', err);
        res.status(500).json({ error: '更新任务失败' });
    }
});

/**
 * 取消任务
 * POST /api/tasks/:id/cancel
 */
router.post('/:id/cancel', requireAuth, (req, res) => {
    try {
        const success = taskOps.cancel(req.params.id, req.session.userId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: '无法取消任务' });
        }
    } catch (err) {
        console.error('[Tasks] Failed to cancel task:', err);
        res.status(500).json({ error: '取消任务失败' });
    }
});

module.exports = router;

