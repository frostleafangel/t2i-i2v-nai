/**
 * NovelAI Vibe Transfer Encoding Service
 * 
 * Provides Vibe encoding functionality for Vibe Transfer and Character Reference
 * Ported from novel_copy/app/services/vibe_service.py
 */

const fetch = require('node-fetch');

// NovelAI Blue API base URL
const BLUE_API_BASE = "https://image.novelai.net";

/**
 * Encode an image to NovelAI Vibe binary data
 * 
 * @param {Buffer} imageData - Raw image data
 * @param {string} model - Model to use, default "nai-diffusion-4-5-curated"
 * @param {number} informationExtracted - Information extraction coefficient (0.0-1.0)
 *        - 0.7: Good for Vibe Transfer (atmosphere transfer)
 *        - 0.9: Good for Character Reference
 * @param {string} apiKey - NovelAI API Key
 * @returns {Promise<Buffer>} Encoded vibe binary data
 */
async function encodeVibe(imageData, model = "nai-diffusion-4-5-curated", informationExtracted = 1.0, apiKey) {
    if (!apiKey) {
        throw new Error("NOVELAI_API_KEY is not configured");
    }

    // Convert image to Base64
    const imageB64 = imageData.toString('base64');

    // Build request payload
    const payload = {
        image: imageB64,
        model: model,
        information_extracted: informationExtracted
    };

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };

    console.log(`[Vibe] Encoding: model=${model}, info_extracted=${informationExtracted}, image_size=${imageData.length} bytes`);

    try {
        const response = await fetch(`${BLUE_API_BASE}/ai/encode-vibe`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            timeout: 120000 // 120s timeout
        });

        if (response.ok) {
            const vibeBuffer = await response.buffer();
            console.log(`[Vibe] Encoding successful! Vibe size: ${vibeBuffer.length} bytes`);
            return vibeBuffer;
        } else {
            let errorMsg = `Vibe encoding failed: HTTP ${response.status}`;
            try {
                const errorDetail = await response.json();
                errorMsg += `, ${JSON.stringify(errorDetail)}`;
            } catch {
                const text = await response.text();
                errorMsg += `, ${text}`;
            }
            console.error(`[Vibe] ${errorMsg}`);
            throw new Error(errorMsg);
        }
    } catch (error) {
        if (error.type === 'request-timeout') {
            console.error('[Vibe] Encoding timeout');
            throw new Error('Vibe encoding timeout, please try again later');
        }
        console.error(`[Vibe] Encoding error: ${error.message}`);
        throw error;
    }
}

module.exports = {
    encodeVibe
};
