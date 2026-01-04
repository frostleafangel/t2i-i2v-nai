/**
 * Vibe Transfer API Routes
 * 
 * POST /api/vibe/encode - Upload image and encode to Vibe data
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const vibeService = require('../services/vibeService');
const crypto = require('crypto');

// Configure multer for memory storage (we don't need to save the original image)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 35 * 1024 * 1024, // Max 35MB
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '请先登录' });
    }
    next();
};

/**
 * POST /api/vibe/encode
 * 
 * Upload an image and encode it to Vibe data
 * 
 * Body (multipart/form-data):
 *   - file: Image file
 *   - information_extracted: (optional) 0.0-1.0, default 1.0
 *   - model: (optional) Model to use for encoding
 * 
 * Response:
 *   - vibe_id: Unique ID for this vibe
 *   - vibe_data: Base64 encoded vibe binary data
 *   - information_extracted: The coefficient used
 */
router.post('/encode', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const apiKey = process.env.NOVELAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server configuration error: NOVELAI_API_KEY missing.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Parse parameters
        const informationExtracted = parseFloat(req.body.information_extracted) || 1.0;
        const model = req.body.model || 'nai-diffusion-4-5-curated';

        // Validate information_extracted
        if (informationExtracted < 0 || informationExtracted > 1) {
            return res.status(400).json({ error: 'information_extracted must be between 0 and 1' });
        }

        console.log(`[Vibe Route] Encoding image: ${req.file.originalname}, size: ${req.file.size}, model: ${model}, info: ${informationExtracted}`);

        // Call vibe encoding service
        const vibeBuffer = await vibeService.encodeVibe(
            req.file.buffer,
            model,
            informationExtracted,
            apiKey
        );

        // Convert to Base64 for frontend storage
        const vibeB64 = vibeBuffer.toString('base64');

        // Generate unique ID
        const vibeId = crypto.randomUUID();

        res.json({
            success: true,
            vibe_id: vibeId,
            vibe_data: vibeB64,
            information_extracted: informationExtracted,
            original_filename: req.file.originalname
        });

    } catch (error) {
        console.error('[Vibe Route] Encoding error:', error);
        res.status(500).json({
            error: error.message || 'Vibe encoding failed'
        });
    }
});

module.exports = router;
