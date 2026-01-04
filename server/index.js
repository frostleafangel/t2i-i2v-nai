const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// Load environment variables using absolute paths
// __dirname is the server/ directory, so ../ goes to project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.server') });

const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3001;
const COMFY_URL = process.env.VITE_COMFY_URL || 'http://localhost:8188';
const COMFY_URL_STANDARD = process.env.VITE_COMFY_URL_STANDARD || 'http://localhost:8189';
const SESSION_SECRET = process.env.SESSION_SECRET || 'newbie-secret-key-please-change-in-production';

// Proxy configuration for Standard ComfyUI (Must be BEFORE generic /comfyui to prevent collision)
app.use('/comfyui-standard', createProxyMiddleware({
  target: COMFY_URL_STANDARD,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathRewrite: {
    '^/comfyui-standard': '', // Remove /comfyui-standard base path
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Standard Proxy] ${req.method} ${req.originalUrl} -> ${COMFY_URL_STANDARD}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Standard Proxy error:', err);
    res.status(500).send('Standard Proxy Error');
  }
}));

// Proxy configuration for ComfyUI
app.use('/comfyui', createProxyMiddleware({
  target: COMFY_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathRewrite: {
    '^/comfyui': '', // Remove /comfyui base path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Optional: Log proxy requests for debugging
    // console.log(`Proxying ${req.method} request to: ${COMFY_URL}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy Error');
  }
}));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[REQ] ${req.method} ${req.path} | Cookie: ${req.headers.cookie ? 'YES' : 'NO'}`);
  }
  next();
});

// Trust proxy (important for reverse proxy setups like nginx)
// This allows Express to correctly read x-forwarded-proto headers
app.set('trust proxy', 1);

// Session middleware
// Since we're behind a reverse proxy with HTTPS, we need secure cookies
const isProduction = process.env.NODE_ENV === 'production';
console.log('[Session] NODE_ENV:', process.env.NODE_ENV, ', isProduction:', isProduction);

// For production behind reverse proxy, always use secure cookies
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust the reverse proxy
  cookie: {
    secure: true, // Always true since HTTPS is handled by reverse proxy
    httpOnly: true,
    sameSite: 'none', // Required for cross-site cookies with secure
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// API Routes
const authRoutes = require('./routes/auth');
const galleryRoutes = require('./routes/gallery');
const historyRoutes = require('./routes/history');
const stylesRoutes = require('./routes/styles'); // Added stylesRoutes

app.use('/api/auth', authRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/styles', stylesRoutes); // Registered styles route
const novelaiRoutes = require('./routes/novelai');
app.use('/api/novelai', novelaiRoutes);
const vibeRoutes = require('./routes/vibe');
app.use('/api/vibe', vibeRoutes);

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, '../dist')));

const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimiter.get(ip);

  if (!record) {
    rateLimiter.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (now > record.resetTime) {
    rateLimiter.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimiter.entries()) {
    if (now > record.resetTime) {
      rateLimiter.delete(ip);
    }
  }
}, 60 * 1000);

// Token estimation (rough: 1 Chinese char ≈ 2 tokens, 1 English word ≈ 1.3 tokens)
function estimateTokens(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 2 + otherChars * 0.4);
}

const MAX_INPUT_TOKENS = 2000;

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  // Rate limit check
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '无效的请求格式' });
  }

  // Check user input token limit
  const userMessages = messages.filter(m => m.role === 'user');
  const totalUserTokens = userMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  if (totalUserTokens > MAX_INPUT_TOKENS) {
    return res.status(400).json({ error: `输入内容过长（约 ${totalUserTokens} tokens），请精简后重试（限制 ${MAX_INPUT_TOKENS} tokens）` });
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.error('SILICONFLOW_API_KEY not configured');
    return res.status(500).json({ error: '服务器配置错误' });
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'zai-org/GLM-4.6',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SiliconFlow API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'AI 服务暂时不可用' });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: '请求失败，请稍后重试' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// All other GET requests not handled before will return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Production Server running on port ${PORT}`);
  console.log(`📡 Proxying /comfyui to ${COMFY_URL}`);
  console.log(`📡 Proxying /comfyui-standard to ${COMFY_URL_STANDARD}`);
});
