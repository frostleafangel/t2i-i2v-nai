import { COMFY_API_URL_STANDARD } from "../constants";
import { STANDARD_WORKFLOW_TEMPLATE } from "./constants_standard";
import {
    StandardGenerationSettings,
    ComfyWorkflow,
    ComfyObjectInfo,
    QueuePromptResponse,
    HistoryResponse,
    GeneratedImage
} from "../types";

// Helper to deep clone the template
const getWorkflowTemplate = (): ComfyWorkflow => JSON.parse(JSON.stringify(STANDARD_WORKFLOW_TEMPLATE));

// Cache for available resources
let cachedModels: string[] | null = null;
let cachedLoras: string[] | null = null;

export const fetchAvailableModels = async (): Promise<string[]> => {
    if (cachedModels) return cachedModels;
    try {
        console.log(`[Standard] Fetching models from: ${COMFY_API_URL_STANDARD}/object_info/CheckpointLoaderSimple`);
        const response = await fetch(`${COMFY_API_URL_STANDARD}/object_info/CheckpointLoaderSimple`);
        if (!response.ok) {
            console.error(`[Standard] Failed to fetch models: ${response.status} ${response.statusText}`);
            throw new Error('Failed to fetch models');
        }
        const data: ComfyObjectInfo = await response.json();
        // Use stringify to see full depth in console
        console.log('[Standard] Models response raw:', JSON.stringify(data));

        let models: string[] = [];
        if (data["CheckpointLoaderSimple"]?.input?.required?.ckpt_name) {
            const rawList = data["CheckpointLoaderSimple"].input.required.ckpt_name[0];
            console.log('[Standard] Raw ckpt_name[0]:', rawList);
            if (Array.isArray(rawList)) {
                models = rawList;
            }
        }

        console.log('[Standard] Parsed models:', models);
        cachedModels = models;
        return models;
    } catch (err) {
        console.error("Error fetching models:", err);
        return [];
    }
};

export const fetchAvailableLoras = async (): Promise<string[]> => {
    if (cachedLoras) return cachedLoras;
    try {
        // Use standard LoraLoader to get the list, it's more reliable
        console.log(`[Standard] Fetching loras from: ${COMFY_API_URL_STANDARD}/object_info/LoraLoader`);
        const response = await fetch(`${COMFY_API_URL_STANDARD}/object_info/LoraLoader`);
        if (!response.ok) {
            console.error(`[Standard] Failed to fetch loras: ${response.status} ${response.statusText}`);
            throw new Error('Failed to fetch loras');
        }
        const data: ComfyObjectInfo = await response.json();
        console.log('[Standard] Loras response raw:', JSON.stringify(data));

        let loras: string[] = [];
        if (data["LoraLoader"]?.input?.required?.lora_name) {
            const rawList = data["LoraLoader"].input.required.lora_name[0];
            console.log('[Standard] Raw lora_name[0]:', rawList);
            if (Array.isArray(rawList)) {
                loras = rawList;
            }
        }

        console.log('[Standard] Parsed loras:', loras);
        cachedLoras = loras;
        return loras;
    } catch (err) {
        // Fallback or try standard LoraLoader if Stack variant fails (though template depends on it)
        console.error("Error fetching loras:", err);
        return [];
    }
};

// Cache for available detectors
let cachedDetectors: string[] | null = null;

export const fetchAvailableDetectors = async (): Promise<string[]> => {
    if (cachedDetectors) return cachedDetectors;
    try {
        console.log(`[Standard] Fetching detectors from: ${COMFY_API_URL_STANDARD}/object_info/UltralyticsDetectorProvider`);
        const response = await fetch(`${COMFY_API_URL_STANDARD}/object_info/UltralyticsDetectorProvider`);
        if (!response.ok) {
            console.error(`[Standard] Failed to fetch detectors: ${response.status} ${response.statusText}`);
            throw new Error('Failed to fetch detectors');
        }
        const data: ComfyObjectInfo = await response.json();
        console.log('[Standard] Detectors response raw:', JSON.stringify(data));

        let detectors: string[] = [];
        if (data["UltralyticsDetectorProvider"]?.input?.required?.model_name) {
            const rawList = data["UltralyticsDetectorProvider"].input.required.model_name[0];
            console.log('[Standard] Raw model_name[0]:', rawList);
            if (Array.isArray(rawList)) {
                detectors = rawList;
            }
        }

        console.log('[Standard] Parsed detectors:', detectors);
        cachedDetectors = detectors;
        return detectors;
    } catch (err) {
        console.error("Error fetching detectors:", err);
        // 返回默认列表作为后备
        return ["bbox/face_yolov8m.pt"];
    }
};

export const queueStandardGeneration = async (
    settings: StandardGenerationSettings
): Promise<string> => {
    const workflow = getWorkflowTemplate();

    // 1. Set Model (Node 3)
    if (workflow["3"]) {
        workflow["3"].inputs.ckpt_name = settings.model;
    }

    // 2. Set LoRAs (Node 7 - Stack)
    if (workflow["7"]) {
        // Reset all to None first (template might have defaults)
        for (let i = 1; i <= 4; i++) {
            const key = `lora_0${i}`;
            const strengthKey = `strength_0${i}`;
            workflow["7"].inputs[key] = "None";
            workflow["7"].inputs[strengthKey] = 1.0;
        }

        // Fill with user selections
        settings.loras.slice(0, 4).forEach((lora, index) => {
            const i = index + 1;
            workflow["7"].inputs[`lora_0${i}`] = lora.name;
            workflow["7"].inputs[`strength_0${i}`] = lora.strength;
        });
    }

    // 3. Set Prompts (Node 10, 11)
    // 组合三段式提示词（前置 + 主 + 后置）
    const combinePrompts = (prefix: string, main: string, suffix: string): string => {
        const parts = [prefix, main, suffix]
            .map(p => p?.trim() || '') // 去掉首尾空白
            .filter(p => p.length > 0); // 过滤空字符串

        // 确保每个部分之间有逗号分隔
        return parts.map((part, index) => {
            if (index === parts.length - 1) return part; // 最后一个不需要处理
            // 如果当前部分不以逗号结尾，添加逗号
            return part.endsWith(',') ? part : `${part},`;
        }).join(' ');
    };

    const combinedPositivePrompt = combinePrompts(
        settings.prefixPrompt || '',
        settings.positivePrompt || '',
        settings.suffixPrompt || ''
    );

    if (workflow["10"]) {
        workflow["10"].inputs.text = combinedPositivePrompt;
    }
    if (workflow["11"]) {
        workflow["11"].inputs.text = settings.negativePrompt;
    }

    // 4. Set Image Size (Node 12)
    if (workflow["12"]) {
        workflow["12"].inputs.width = settings.width;
        workflow["12"].inputs.height = settings.height;
    }

    // 5. Set Sampler (Node 9)
    if (workflow["9"]) {
        workflow["9"].inputs.steps = settings.steps;
        workflow["9"].inputs.cfg = settings.cfg;
        workflow["9"].inputs.sampler_name = settings.sampler_name;
        workflow["9"].inputs.scheduler = settings.scheduler;

        // Seed handling
        if (settings.seed === -1) {
            workflow["9"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
        } else {
            workflow["9"].inputs.seed = settings.seed;
        }
    }

    // 6. Handle Upscale
    if (!settings.enableUpscale) {
        // Disable upscale by removing nodes
        delete workflow["1"]; // UpscaleModelLoader
        delete workflow["2"]; // UltimateSDUpscale
        delete workflow["15"]; // SaveImage (Upscaled)
        // Also disable second upscale nodes
        delete workflow["17"]; // ImageScale
        delete workflow["18"]; // VAEEncode
        delete workflow["19"]; // KSampler
        delete workflow["20"]; // VAEDecode
        delete workflow["21"]; // SaveImage (SecondUpscale)
        // 禁用 FaceDetailer
        delete workflow["22"]; // UltralyticsDetectorProvider
        delete workflow["23"]; // SAMLoader
        delete workflow["24"]; // FaceDetailer
        delete workflow["25"]; // SaveImage (FaceDetail)
    } else {
        // Configure Upscale Node (Node 2)
        if (workflow["2"]) {
            workflow["2"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
            // 设置放大倍数（之前遗漏了这个参数，导致使用模板默认值而非用户设置值）
            workflow["2"].inputs.upscale_by = settings.upscaleBy || 1.5;
            // 设置采样参数
            workflow["2"].inputs.steps = settings.upscaleSteps || 20;
            workflow["2"].inputs.cfg = settings.upscaleCfg ?? 4.5;
            // 设置去噪强度、采样器、调度器
            workflow["2"].inputs.denoise = settings.upscaleDenoise ?? 0.2;
            workflow["2"].inputs.sampler_name = settings.upscaleSampler || "euler";
            workflow["2"].inputs.scheduler = settings.upscaleScheduler || "karras";
            // 瓦片尺寸与底图尺寸相同
            workflow["2"].inputs.tile_width = settings.width;
            workflow["2"].inputs.tile_height = settings.height;
        }

        // 7. Handle Second Upscale
        if (!settings.enableSecondUpscale) {
            // Disable second upscale by removing nodes
            delete workflow["17"]; // ImageScale
            delete workflow["18"]; // VAEEncode
            delete workflow["19"]; // KSampler
            delete workflow["20"]; // VAEDecode
            delete workflow["21"]; // SaveImage (SecondUpscale)
            // 如果没有二次放大，也禁用 FaceDetailer
            delete workflow["22"]; // UltralyticsDetectorProvider
            delete workflow["23"]; // SAMLoader
            delete workflow["24"]; // FaceDetailer
            delete workflow["25"]; // SaveImage (FaceDetail)
        } else {
            // Configure second upscale nodes
            // Calculate target size for second upscale
            const firstUpscaleWidth = Math.round(settings.width * (settings.upscaleBy || 1.5));
            const firstUpscaleHeight = Math.round(settings.height * (settings.upscaleBy || 1.5));
            const secondUpscaleBy = settings.secondUpscaleBy || 1.1;
            const secondWidth = Math.round(firstUpscaleWidth * secondUpscaleBy);
            const secondHeight = Math.round(firstUpscaleHeight * secondUpscaleBy);

            // Node 17: ImageScale - set target dimensions
            if (workflow["17"]) {
                workflow["17"].inputs.width = secondWidth;
                workflow["17"].inputs.height = secondHeight;
            }

            // Node 19: KSampler - configure sampling parameters
            if (workflow["19"]) {
                workflow["19"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
                workflow["19"].inputs.steps = settings.secondUpscaleSteps || 20;
                workflow["19"].inputs.cfg = settings.secondUpscaleCfg ?? 5;
                workflow["19"].inputs.denoise = settings.secondUpscaleDenoise || 0.25;
                // 使用独立的二次放大采样器和调度器设置
                workflow["19"].inputs.sampler_name = settings.secondUpscaleSampler || "euler";
                workflow["19"].inputs.scheduler = settings.secondUpscaleScheduler || "normal";
            }

            // 8. Handle FaceDetailer - 根据开关控制
            if (settings.enableFaceDetailer) {
                // 设置检测器模型
                if (workflow["22"]) {
                    workflow["22"].inputs.model_name = settings.faceDetectorModel || "bbox/face_yolov8m.pt";
                }
                // 设置 seed
                if (workflow["24"]) {
                    workflow["24"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
                }
            } else {
                // 禁用 FaceDetailer
                delete workflow["22"]; // UltralyticsDetectorProvider
                delete workflow["23"]; // SAMLoader
                delete workflow["24"]; // FaceDetailer
                delete workflow["25"]; // SaveImage (FaceDetail)
            }
        }
    }

    // 7. Send to API
    try {
        const response = await fetch(`${COMFY_API_URL_STANDARD}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow }),
        });

        if (!response.ok) {
            throw new Error(`ComfyUI Error: ${response.status} ${response.statusText}`);
        }

        const data: QueuePromptResponse = await response.json();
        return data.prompt_id;
    } catch (err) {
        console.error("Failed to queue standard prompt:", err);
        throw err;
    }
};

export const checkStandardGenerationStatus = async (promptId: string): Promise<{ status: 'completed' | 'pending' | 'error' | 'not_found', imageUrl?: string, isUpscaled?: boolean }> => {
    try {
        const response = await fetch(`${COMFY_API_URL_STANDARD}/history/${promptId}`);
        if (!response.ok) return { status: 'error' };

        const data: HistoryResponse = await response.json();

        if (data[promptId]) {
            if (data[promptId].status.completed) {
                const outputs = data[promptId].outputs;

                // Priority 1: Check Node 25 (FaceDetailer output) - highest priority
                if (outputs["25"] && outputs["25"].images.length > 0) {
                    const img = outputs["25"].images[0];
                    return {
                        status: 'completed',
                        imageUrl: `${COMFY_API_URL_STANDARD}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
                        isUpscaled: true
                    };
                }

                // Priority 2: Check Node 21 (Second Upscaled)
                if (outputs["21"] && outputs["21"].images.length > 0) {
                    const img = outputs["21"].images[0];
                    return {
                        status: 'completed',
                        imageUrl: `${COMFY_API_URL_STANDARD}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
                        isUpscaled: true
                    };
                }

                // Priority 3: Check Node 15 (First Upscaled)
                if (outputs["15"] && outputs["15"].images.length > 0) {
                    const img = outputs["15"].images[0];
                    return {
                        status: 'completed',
                        imageUrl: `${COMFY_API_URL_STANDARD}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
                        isUpscaled: true
                    };
                }

                // Priority 4: Check Node 14 (Original)
                if (outputs["14"] && outputs["14"].images.length > 0) {
                    const img = outputs["14"].images[0];
                    return {
                        status: 'completed',
                        imageUrl: `${COMFY_API_URL_STANDARD}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
                        isUpscaled: false
                    };
                }
            }
            return { status: 'pending' };
        }

        // Check queue
        const queueResponse = await fetch(`${COMFY_API_URL_STANDARD}/queue`);
        if (queueResponse.ok) {
            const queueData = await queueResponse.json();
            const running = queueData.queue_running || [];
            const pending = queueData.queue_pending || [];

            const inQueue = [...running, ...pending].some((item: any) => {
                if (Array.isArray(item)) return item.includes(promptId);
                return item === promptId || item?.prompt_id === promptId;
            });

            if (inQueue) return { status: 'pending' };
        }

        return { status: 'not_found' };

    } catch (err) {
        console.error("Polling error:", err);
        return { status: 'error' };
    }
};

// 上传图片到 ComfyUI 服务器用于放大
export const uploadImageForUpscale = async (imageUrl: string): Promise<string> => {
    // 1. 获取图片 blob
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();

    // 2. 生成唯一文件名
    const filename = `upscale_${Date.now()}.png`;

    // 3. 创建 FormData
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');

    // 4. 上传到 ComfyUI
    const uploadResponse = await fetch(`${COMFY_API_URL_STANDARD}/upload/image`, {
        method: 'POST',
        body: formData
    });

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    console.log('[Standard Upscale] Uploaded image:', result);
    return result.name || filename;
};

// 放大工作流模板 - 基于 加载图像放大.json，增加二次放大
// 固定参数：一次放大 1.25x + 二次放大 1x（仅细节增强）
const UPSCALE_WORKFLOW_TEMPLATE: ComfyWorkflow = {
    "1": {
        "class_type": "UpscaleModelLoader",
        "inputs": {
            "model_name": "4x_foolhardy_Remacri.pth"
        }
    },
    "2": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "",
            "clip": ["6", 1]
        }
    },
    "3": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "",
            "clip": ["6", 1]
        }
    },
    "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
            "ckpt_name": "hassaku_xl_illustrious_v1.3.safetensors"
        }
    },
    "5": {
        "class_type": "CLIPSetLastLayer",
        "inputs": {
            "stop_at_clip_layer": -2,
            "clip": ["4", 1]
        }
    },
    "6": {
        "class_type": "Lora Loader Stack (rgthree)",
        "inputs": {
            "model": ["4", 0],
            "clip": ["5", 0],
            "lora_01": "None",
            "strength_01": 1,
            "lora_02": "None",
            "strength_02": 1,
            "lora_03": "None",
            "strength_03": 1,
            "lora_04": "None",
            "strength_04": 1
        }
    },
    "7": {
        "class_type": "LoadImage",
        "inputs": {
            "image": "",
            "upload": "image"
        }
    },
    "8": {
        "class_type": "UltimateSDUpscale",
        "inputs": {
            "image": ["7", 0],
            "model": ["4", 0],
            "positive": ["2", 0],
            "negative": ["3", 0],
            "vae": ["4", 2],
            "upscale_model": ["1", 0],
            "upscale_by": 1.25, // 固定一次放大 1.25x
            "seed": 0,
            "steps": 20,
            "cfg": 4.5,
            "sampler_name": "euler",
            "scheduler": "karras",
            "denoise": 0.2,
            "mode_type": "Linear",
            "tile_width": 832,
            "tile_height": 1216,
            "mask_blur": 8,
            "tile_padding": 32,
            "seam_fix_mode": "None",
            "seam_fix_denoise": 1,
            "seam_fix_width": 64,
            "seam_fix_mask_blur": 8,
            "seam_fix_padding": 16,
            "force_uniform_tiles": true,
            "tiled_decode": false
        }
    },
    // ===== 二次放大节点（1x 仅细节增强） =====
    "10": {
        "class_type": "VAEEncode",
        "inputs": {
            "pixels": ["8", 0],
            "vae": ["4", 2]
        }
    },
    "11": {
        "class_type": "KSampler",
        "inputs": {
            "seed": 0,
            "steps": 20,
            "cfg": 5,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 0.25,
            "model": ["6", 0],
            "positive": ["2", 0],
            "negative": ["3", 0],
            "latent_image": ["10", 0]
        }
    },
    "12": {
        "class_type": "VAEDecode",
        "inputs": {
            "samples": ["11", 0],
            "vae": ["4", 2]
        }
    },
    "9": {
        "class_type": "SaveImage",
        "inputs": {
            "filename_prefix": "standard_upscaled",
            "images": ["12", 0] // 输出二次放大结果
        }
    }
};

// 入队放大任务 - 使用固定参数（一次放大 1.25x + 二次放大 1x）
export const queueStandardUpscale = async (
    imageName: string,
    positivePrompt: string,
    negativePrompt: string,
    model: string
): Promise<string> => {
    const workflow: ComfyWorkflow = JSON.parse(JSON.stringify(UPSCALE_WORKFLOW_TEMPLATE));

    // 设置模型
    workflow["4"].inputs.ckpt_name = model;

    // 设置提示词
    workflow["2"].inputs.text = positivePrompt;
    workflow["3"].inputs.text = negativePrompt;

    // 设置加载的图片
    workflow["7"].inputs.image = imageName;

    // 设置随机种子
    workflow["8"].inputs.seed = Math.floor(Math.random() * 1000000000000000);  // 一次放大
    workflow["11"].inputs.seed = Math.floor(Math.random() * 1000000000000000); // 二次放大

    console.log('[Standard Upscale] Queueing upscale workflow (1.25x + 1x):', workflow);

    const response = await fetch(`${COMFY_API_URL_STANDARD}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
    });

    if (!response.ok) {
        throw new Error(`ComfyUI Upscale Error: ${response.status}`);
    }

    const data: QueuePromptResponse = await response.json();
    return data.prompt_id;
};

// 检查放大任务状态
export const checkStandardUpscaleStatus = async (promptId: string): Promise<{ status: 'completed' | 'pending' | 'error' | 'not_found', imageUrl?: string }> => {
    try {
        const response = await fetch(`${COMFY_API_URL_STANDARD}/history/${promptId}`);
        if (!response.ok) return { status: 'not_found' };

        const data: HistoryResponse = await response.json();

        if (data[promptId]) {
            if (data[promptId].status.completed) {
                const outputs = data[promptId].outputs;
                // 检查放大输出节点 9
                if (outputs["9"] && outputs["9"].images.length > 0) {
                    const img = outputs["9"].images[0];
                    return {
                        status: 'completed',
                        imageUrl: `${COMFY_API_URL_STANDARD}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
                    };
                }
            }
            // 如果在历史记录中但状态不是 completed (通常是 error)
            if (data[promptId].status.status_str === 'error') {
                return { status: 'error' };
            }
            return { status: 'pending' };
        }

        // 检查队列
        const queueResponse = await fetch(`${COMFY_API_URL_STANDARD}/queue`);
        if (queueResponse.ok) {
            const queueData = await queueResponse.json();
            const running = queueData.queue_running || [];
            const pending = queueData.queue_pending || [];
            const inQueue = [...running, ...pending].some((item: any) => {
                if (Array.isArray(item)) return item.includes(promptId);
                return item === promptId || item?.prompt_id === promptId;
            });
            if (inQueue) return { status: 'pending' };
        }

        return { status: 'not_found' };
    } catch (err) {
        console.error("Upscale polling error:", err);
        return { status: 'not_found' };
    }
};
