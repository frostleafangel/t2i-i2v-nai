const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.server') });
const novelaiService = require('../services/novelaiService');

async function testGenerate() {
    const apiKey = process.env.NOVELAI_API_KEY;
    if (!apiKey) {
        console.error('Error: NOVELAI_API_KEY not set in .env.server');
        return;
    }

    console.log('Starting NovelAI generation test...');
    try {
        const result = await novelaiService.generateImage({
            prompt: "1girl, masterpiece, best quality, smiling",
            model: "nai-diffusion-3",
            width: 832,
            height: 1216,
            steps: 28,
            scale: 5,
            apiKey: apiKey
        });

        console.log('Generation successful!');
        console.log('Result:', result);
    } catch (error) {
        console.error('Generation failed:', error);
    }
}

testGenerate();
