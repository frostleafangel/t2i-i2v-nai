const express = require('express');
const router = express.Router();
const { userOps, inviteOps } = require('../database');

// 注册（需要邀请码）
router.post('/register', (req, res) => {
    const { username, password, inviteCode } = req.body;

    // 验证输入
    if (!username || !password || !inviteCode) {
        return res.status(400).json({ error: '请填写所有字段' });
    }

    if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度需要在 2-20 字符之间' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码至少需要 6 个字符' });
    }

    // 检查邀请码
    const invite = inviteOps.isValid(inviteCode);
    if (!invite) {
        return res.status(400).json({ error: '邀请码无效或已被使用' });
    }

    // 检查用户名是否已存在
    const existingUser = userOps.findByUsername(username);
    if (existingUser) {
        return res.status(400).json({ error: '用户名已被使用' });
    }

    try {
        // 创建用户
        const userId = userOps.create(username, password);

        // 标记邀请码已使用
        inviteOps.use(inviteCode, userId);

        // 设置 session
        req.session.userId = userId;
        req.session.username = username;

        res.json({
            success: true,
            user: { id: userId, username }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 登录
router.post('/login', (req, res) => {
    console.log('=== Login Attempt ===');
    console.log('Session ID (before login):', req.sessionID);
    console.log('Session cookie config:', req.session.cookie);

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = userOps.findByUsername(username);
    if (!user) {
        console.log('[Login] Failed - user not found:', username);
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (!userOps.verifyPassword(user, password)) {
        console.log('[Login] Failed - wrong password for:', username);
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 设置 session
    req.session.userId = user.id;
    req.session.username = user.username;

    // Force session save to ensure it's persisted
    req.session.save((err) => {
        if (err) {
            console.error('[Login] Session save error:', err);
            return res.status(500).json({ error: '登录失败，请稍后重试' });
        }

        console.log('[Login] Success!');
        console.log('Session ID (after login):', req.sessionID);
        console.log('Session userId set to:', req.session.userId);
        console.log('===================');

        res.json({
            success: true,
            user: { id: user.id, username: user.username }
        });
    });
});

// 登出
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: '登出失败' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '未登录' });
    }

    const user = userOps.findById(req.session.userId);
    if (!user) {
        req.session.destroy();
        return res.status(401).json({ error: '用户不存在' });
    }

    res.json({
        user: {
            id: user.id,
            username: user.username,
            createdAt: user.created_at
        }
    });
});

module.exports = router;
