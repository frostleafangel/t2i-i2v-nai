const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// NovelAI API URL
const NOVELAI_API_URL = "https://image.novelai.net/ai/generate-image";
const UPLOAD_DIR = path.join(__dirname, '../uploads/novelai');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// NAI4 Models
const NAI4_MODELS = [
    'nai-diffusion-4-5-full',
    'nai-diffusion-4-5-curated',
    'nai-diffusion-4-full',
    'nai-diffusion-4-curated-preview',
];

const isNai4Model = (modelName) => {
    return NAI4_MODELS.includes(modelName) || modelName.startsWith("nai-diffusion-4");
};

/**
 * Generate image from NovelAI
 * Ported from novel_copy/novelai_client.py
 */
const generateImage = async (params) => {
    const {
        prompt,
        model = "nai-diffusion-3",
        width = 832,
        height = 1216,
        steps = 28,
        scale = 10.0,
        sampler = "k_euler",
        seed = -1,
        negative_prompt,
        uc_preset = 3,
        n_samples = 1,
        quality_toggle, // handled inside based on model
        sm = true,
        sm_dyn,
        dynamic_thresholding = true,
        params_version = 3,
        cfg_rescale = 0.18,
        noise_schedule = "native",
        controlnet_strength = 1.0,
        legacy = false,
        add_original_image, // handled inside
        skip_cfg_above_sigma,
        legacy_v3_extend = false,
        reference_image_multiple,
        reference_information_extracted_multiple,
        reference_strength_multiple,
        v4_prompt_object,
        v4_negative_prompt_object,
        deliberate_euler_ancestral_bug,
        prefer_brownian,
        character_prompts,
        aqt_preset,
        use_coords,
        extra_novelai_parameters, // Optional extra params dict
        apiKey
    } = params;

    if (!apiKey) {
        throw new Error("NOVELAI_API_KEY is not set.");
    }

    // Default negative prompt logic
    const finalNegativePrompt = negative_prompt === undefined || negative_prompt === null
        ? "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"
        : negative_prompt;

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
        // Note: Do NOT set Accept header - NovelAI returns ZIP file, not JSON
    };

    // Build base parameters - only include validated params for NAI3
    let parameters = {
        width,
        height,
        scale,
        sampler,
        steps,
        n_samples,
        ucPreset: uc_preset,
        sm,
        dynamic_thresholding,
        cfg_rescale,
        noise_schedule,
        negative_prompt: finalNegativePrompt,
        seed: seed
    };

    // logic from novel_copy: if seed is -1, generate logic here or pass -1?
    // In nodejs backend we can generate a random seed if it is -1, to be able to save it.
    if (parameters.seed === -1) {
        parameters.seed = Math.floor(Math.random() * 4294967295);
        console.log(`[NovelAI] Generated random seed: ${parameters.seed}`);
    }

    // controlnet_strength handling
    if (controlnet_strength !== undefined && controlnet_strength !== null) {
        parameters.controlnet_strength = controlnet_strength;
    }

    if (sm_dyn === undefined || sm_dyn === null) {
        parameters.sm_dyn = sm;
    } else {
        parameters.sm_dyn = sm_dyn;
    }

    if (!sm) {
        parameters.sm_dyn = false;
    }

    const isV4 = isNai4Model(model);

    if (isV4) {
        // NAI4 Specifics
        parameters.add_original_image = add_original_image === undefined ? true : add_original_image;
        parameters.qualityToggle = quality_toggle === undefined ? false : quality_toggle;

        if (extra_novelai_parameters && extra_novelai_parameters.aqtPreset) {
            parameters.aqtPreset = extra_novelai_parameters.aqtPreset;
        } else if (aqt_preset) {
            parameters.aqtPreset = aqt_preset;
        }

        // Remove SMEA for V4
        delete parameters.sm;
        delete parameters.sm_dyn;

        if (noise_schedule === "native") {
            parameters.noise_schedule = "karras";
        }

        // Helper to convert grid coordinates (0-4) to normalized centers (0-1)
        const getCenter = (coords) => {
            if (!coords) return null;
            // Using the mapping from NAI4 guide: 0->0.0, 1->0.1, 2->0.3, 3->0.5, 4->0.7, 5->0.9
            const doubleMapping = { 0: 0.0, 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9 };
            return {
                x: doubleMapping[coords.x] ?? (coords.x + 0.5) / 5.0,
                y: doubleMapping[coords.y] ?? (coords.y + 0.5) / 5.0
            };
        };

        let charCaptions = [];
        let charNegCaptions = [];
        let formattedCharacterPrompts = [];

        // Check if we have character prompts from frontend (camelCase or snake_case)
        const inputCharPrompts = character_prompts || extra_novelai_parameters?.characterPrompts || extra_novelai_parameters?.character_prompts;

        if (inputCharPrompts && Array.isArray(inputCharPrompts)) {
            inputCharPrompts.forEach(cp => {
                // Centers logic
                const coords = cp.coords || cp.center;
                const center = getCenter(coords);
                const centers = center ? [center] : [];

                const promptStr = cp.characterPrompt || cp.prompt || "";
                const ucStr = cp.characterNegativePrompt || cp.uc || "";

                // 1. For v4_prompt (NAI4 specific structure)
                charCaptions.push({
                    char_caption: promptStr,
                    centers: centers
                });

                charNegCaptions.push({
                    char_caption: ucStr,
                    centers: centers
                });

                // 2. For legacy/compatibility characterPrompts
                formattedCharacterPrompts.push({
                    prompt: promptStr,
                    uc: ucStr,
                    center: center // Can be null
                });
            });
        }

        // V4 Prompt Object construction
        let v4Prompt = v4_prompt_object;
        if (!v4Prompt) {
            v4Prompt = {
                caption: {
                    base_caption: prompt,
                    char_captions: charCaptions // Populated for NAI4
                },
                use_coords: extra_novelai_parameters?.use_coords ?? use_coords ?? true,
                use_order: true
            };
        } else if (charCaptions.length > 0) {
            // Frontend sent v4_prompt but empty char_captions, inject ours
            if (!v4Prompt.caption) v4Prompt.caption = { base_caption: prompt };
            v4Prompt.caption.char_captions = charCaptions;
        }

        // V4 Negative Prompt Object
        let v4NegPrompt = v4_negative_prompt_object;
        if (!v4NegPrompt) {
            v4NegPrompt = {
                caption: {
                    base_caption: finalNegativePrompt,
                    char_captions: charNegCaptions // Populated for NAI4
                },
                legacy_uc: false
            };
        } else if (charNegCaptions.length > 0) {
            // Frontend sent v4_negative_prompt but empty char_captions, inject ours
            if (!v4NegPrompt.caption) v4NegPrompt.caption = { base_caption: finalNegativePrompt };
            v4NegPrompt.caption.char_captions = charNegCaptions;
        }

        // Skip CFG calculation logic (simplified from python)
        let varietyEnabled = true;
        if (extra_novelai_parameters && extra_novelai_parameters.nai3Variety !== undefined) {
            varietyEnabled = String(extra_novelai_parameters.nai3Variety).toLowerCase() === 'true';
        }

        if (skip_cfg_above_sigma === undefined || skip_cfg_above_sigma === null) {
            if (varietyEnabled) {
                const w = width / 8;
                const h = height / 8;
                const v = Math.sqrt(4.0 * w * h / 63232);
                if (model === "nai-diffusion-4-full") {
                    parameters.skip_cfg_above_sigma = 19.0 * v;
                } else if (model === "nai-diffusion-4-5-curated") {
                    parameters.skip_cfg_above_sigma = 59.0 * v;
                }
            }
        } else {
            parameters.skip_cfg_above_sigma = skip_cfg_above_sigma;
        }

        parameters.v4_prompt = v4Prompt;
        parameters.v4_negative_prompt = v4NegPrompt;

        if (extra_novelai_parameters?.use_coords !== undefined) parameters.use_coords = extra_novelai_parameters.use_coords;
        else if (use_coords !== undefined) parameters.use_coords = use_coords;

        // Assign formatted characterPrompts
        if (formattedCharacterPrompts.length > 0) {
            parameters.characterPrompts = formattedCharacterPrompts;
        } else if (extra_novelai_parameters?.characterPrompts !== undefined) {
            parameters.characterPrompts = extra_novelai_parameters.characterPrompts;
        } else if (character_prompts !== undefined) {
            parameters.characterPrompts = character_prompts;
        }

    } else {
        // NAI3 Specifics
        // Note: Do NOT send add_original_image or qualityToggle for NAI3 - they are V4-only params

        // SMEA logic already handled above
        let varietyEnabledV3 = true;
        if (extra_novelai_parameters && extra_novelai_parameters.nai3Variety !== undefined) {
            varietyEnabledV3 = String(extra_novelai_parameters.nai3Variety).toLowerCase() === 'true';
        }

        if (skip_cfg_above_sigma === undefined || skip_cfg_above_sigma === null) {
            if (varietyEnabledV3) {
                const w = width / 8;
                const h = height / 8;
                const v = Math.sqrt(4.0 * w * h / 63232);
                parameters.skip_cfg_above_sigma = 19.0 * v;
            }
        } else {
            parameters.skip_cfg_above_sigma = skip_cfg_above_sigma;
        }
    }

    if (sampler === "k_euler_ancestral") {
        parameters.deliberate_euler_ancestral_bug = deliberate_euler_ancestral_bug === undefined ? false : deliberate_euler_ancestral_bug;
        parameters.prefer_brownian = prefer_brownian === undefined ? true : prefer_brownian;
    }

    if (reference_image_multiple) parameters.reference_image_multiple = reference_image_multiple;
    if (reference_information_extracted_multiple) parameters.reference_information_extracted_multiple = reference_information_extracted_multiple;
    if (reference_strength_multiple) parameters.reference_strength_multiple = reference_strength_multiple;

    // Merge extra params
    if (extra_novelai_parameters) {
        Object.keys(extra_novelai_parameters).forEach(key => {
            if (parameters[key] === undefined || extra_novelai_parameters[key] !== null) {
                parameters[key] = extra_novelai_parameters[key];
            }
        });
    }

    // Filter null/undefined
    const finalApiParameters = {};
    Object.keys(parameters).forEach(key => {
        if (parameters[key] !== undefined && parameters[key] !== null) {
            finalApiParameters[key] = parameters[key];
        }
    });

    const apiRequestPayload = {
        input: prompt,
        model: model,
        action: "generate",
        parameters: finalApiParameters
    };

    console.log(`[NovelAI] Requesting ${model} with seed ${parameters.seed}`);
    console.log('[NovelAI] Request payload:', JSON.stringify(apiRequestPayload, null, 2));
    console.log('[NovelAI] API Key (first 10 chars):', apiKey.substring(0, 10) + '...');

    // Use native https module instead of node-fetch for reliability
    const https = require('https');
    const requestBody = JSON.stringify(apiRequestPayload);

    const options = {
        hostname: 'image.novelai.net',
        port: 443,
        path: '/ai/generate-image',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode === 200,
                        status: res.statusCode,
                        buffer: Buffer.concat(chunks)
                    });
                });
            });

            req.on('error', reject);
            req.write(requestBody);
            req.end();
        });

        if (!response.ok) {
            throw new Error(`NovelAI API Error ${response.status}: ${response.buffer.toString()}`);
        }

        const buffer = response.buffer;

        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        const images = [];

        for (const entry of zipEntries) {
            if (entry.entryName.endsWith('.png')) {
                const fileName = `nai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
                const filePath = path.join(UPLOAD_DIR, fileName);

                fs.writeFileSync(filePath, entry.getData());

                images.push({
                    url: `/uploads/novelai/${fileName}`,
                    seed: parameters.seed
                });
                console.log(`[NovelAI] Image saved successfully: ${fileName}`);
            }
        }

        if (images.length === 0) {
            throw new Error("No images found in NovelAI response.");
        }

        return images;

    } catch (error) {
        console.error("NovelAI Service Error:", error);
        throw error;
    }
};

module.exports = {
    generateImage
};
