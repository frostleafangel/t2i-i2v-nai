const express = require('express');
const router = express.Router();
const novelaiService = require('../services/novelaiService');
const novelaiQueue = require('../services/novelaiQueue');

// Middleware to check authentication with detailed logging
const requireAuth = (req, res, next) => {
    console.log('=== NovelAI Auth Debug ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request Headers:', JSON.stringify({
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-host': req.headers['x-forwarded-host']
    }, null, 2));
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', JSON.stringify(req.session, null, 2));
    console.log('Session userId:', req.session?.userId);
    console.log('========================');

    if (!req.session.userId) {
        console.log('[Auth] REJECTED - No userId in session');
        return res.status(401).json({ error: '请先登录' });
    }
    console.log('[Auth] PASSED - userId:', req.session.userId);
    next();
};

// Queue status endpoint
router.get('/queue-status', requireAuth, (req, res) => {
    const status = novelaiQueue.getStatus();
    const position = novelaiQueue.getPosition(req.session.userId);
    res.json({
        ...status,
        yourPosition: position
    });
});

router.post('/generate', requireAuth, async (req, res) => {
    const userId = req.session.userId;

    try {
        const apiKey = process.env.NOVELAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server configuration error: NOVELAI_API_KEY missing.' });
        }

        // Convert ucPreset string to number if needed
        // Heavy = 3, Light = 2, None = 0
        const ucPresetMap = {
            'Heavy': 3,
            'Light': 2,
            'None': 0,
            'heavy': 3,
            'light': 2,
            'none': 0
        };

        let ucPreset = req.body.uc_preset;
        if (typeof ucPreset === 'string') {
            ucPreset = ucPresetMap[ucPreset] ?? 3; // Default to Heavy (3)
        }

        // Only extract valid params - don't spread all of req.body to avoid invalid params
        const params = {
            prompt: req.body.prompt,
            model: req.body.model || 'nai-diffusion-3',
            width: req.body.width || 832,
            height: req.body.height || 1216,
            steps: req.body.steps || 28,
            scale: req.body.scale || req.body.cfg || 5,
            sampler: req.body.sampler || 'k_euler',
            seed: req.body.seed || -1,
            negative_prompt: req.body.negative_prompt,
            uc_preset: ucPreset,
            n_samples: 1,
            sm: req.body.sm,
            sm_dyn: req.body.sm_dyn,
            dynamic_thresholding: req.body.dynamic_thresholding,
            cfg_rescale: req.body.cfg_rescale,
            noise_schedule: req.body.noise_schedule,
            controlnet_strength: req.body.controlnet_strength,
            skip_cfg_above_sigma: req.body.skip_cfg_above_sigma,
            apiKey: apiKey,

            // NAI4 Specific Params
            character_prompts: req.body.character_prompts || req.body.characterPrompts,
            aqt_preset: req.body.aqt_preset || req.body.aqtPreset,
            use_coords: req.body.use_coords || req.body.useCoords,
            v4_prompt: req.body.v4_prompt || req.body.v4Prompt,
            v4_negative_prompt: req.body.v4_negative_prompt || req.body.v4NegativePrompt,
            extra_novelai_parameters: req.body.extra_novelai_parameters || req.body.extraNovelaiParameters,

            // Vibe Transfer Params
            reference_image_multiple: req.body.reference_image_multiple,
            reference_information_extracted_multiple: req.body.reference_information_extracted_multiple,
            reference_strength_multiple: req.body.reference_strength_multiple
        };

        // Add to queue and wait for processing
        const images = await novelaiQueue.enqueue(
            () => novelaiService.generateImage(params),
            userId
        );

        // Return successful result with image URLs
        res.json({
            success: true,
            images: images
        });

    } catch (error) {
        console.error('NovelAI Generate Error:', error);
        res.status(500).json({
            error: error.message || 'NovelAI generation failed'
        });
    }
});

module.exports = router;

