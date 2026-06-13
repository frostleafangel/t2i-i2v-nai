/**
 * 图生视频 ComfyUI 服务
 * 基于 DaSiWa WAN 2.2 I2V 工作流
 */

import { COMFY_API_URL_STANDARD } from "../constants";
import { comfyFetch, comfyPost, comfyUpload } from "./comfyFetch";
import { LoraConfig, ComfyObjectInfo } from "../types";

// 视频生成设置接口
export interface VideoGenerationSettings {
    positivePrompt: string;      // 正面提示词
    negativePrompt?: string;     // 负面提示词（有默认值）
    duration: number;            // 秒数 (1-8, 默认 5)
    frameRate: number;           // 帧率 (16 或 24)
    seed: number;                // 种子 (-1 为随机)
    steps: number;               // 步数 (默认 4)
    cfg: number;                 // CFG (默认 1)
    crf: number;                 // 视频质量 CRF (10-40, 越小质量越高)
    refinerStep: number;         // 精炼步数 (默认 2)
    shiftHigh: number;           // Sigma 偏移 (高噪声, 默认 5)
    shiftLow: number;            // Sigma 偏移 (低噪声, 默认 5)
    firstFrameImage: string;     // 首帧图片文件名（已上传到 ComfyUI）
    samplerName: string;         // 采样器名称
    scheduler: string;           // 调度器
    // LORA 设置（同时应用到 HIGH 和 LOW 模型）
    loras?: LoraConfig[];
    // 首尾帧模式 (FLF2V)
    flf2vEnabled?: boolean;      // 是否启用首尾帧模式
    lastFrameImage?: string;     // 尾帧图片文件名（已上传到 ComfyUI）
}

// 默认负面提示词
const DEFAULT_VIDEO_NEGATIVE_PROMPT = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走, censored, mosaic censoring, bar censor, pixelated, glowing, bloom, blurry, day, out of focus, low detail, bad anatomy, ugly, overexposed, underexposed, distorted face, extra limbs, cartoonish, 3d render artifacts, duplicate people, unnatural lighting, bad composition, missing shadows, low resolution, poorly textured, glitch, noise, grain, static, motionless, still frame, overall grayish, worst quality, low quality, JPEG compression artifacts, subtitles, stylized, artwork, painting, illustration, cluttered background, many people in background, three legs, walking backward, zoom out, zoom in, mouth speaking, moving mouth, talking, speaking, mute speaking, unnatural skin tone, discolored eyelid, red eyelids, red upper eyelids, no red eyeshadow, closed eyes, no wide-open innocent eyes, poorly drawn hands, extra fingers, fused fingers, poorly drawn face, deformed, disfigured, malformed limbs, thighs, fog, mist, voluminous eyelashes, blush, Disappearance,";

// 默认视频生成设置
export const DEFAULT_VIDEO_SETTINGS: Omit<VideoGenerationSettings, 'positivePrompt' | 'firstFrameImage'> = {
    negativePrompt: DEFAULT_VIDEO_NEGATIVE_PROMPT,
    duration: 5,
    frameRate: 16,
    seed: -1,
    steps: 4,
    cfg: 1,
    crf: 19,
    refinerStep: 2,
    shiftHigh: 5,
    shiftLow: 5,
    samplerName: "uni_pc_bh2",
    scheduler: "beta",
    loras: []
};

// 缓存视频模式可用的 LORA
let cachedVideoLoras: string[] | null = null;

/**
 * 获取 I2V 视频模式专用的 LORA（只返回 img2video 目录下的）
 */
export const fetchVideoLoras = async (): Promise<string[]> => {
    if (cachedVideoLoras) return cachedVideoLoras;
    try {
        console.log(`[Video] Fetching loras from: ${COMFY_API_URL_STANDARD}/object_info/LoraLoader`);
        const response = await comfyFetch(`${COMFY_API_URL_STANDARD}/object_info/LoraLoader`);
        if (!response.ok) {
            console.error(`[Video] Failed to fetch loras: ${response.status} ${response.statusText}`);
            throw new Error('Failed to fetch loras');
        }
        const data: ComfyObjectInfo = await response.json();

        let loras: string[] = [];
        if (data["LoraLoader"]?.input?.required?.lora_name) {
            const rawList = data["LoraLoader"].input.required.lora_name[0];
            if (Array.isArray(rawList)) {
                loras = rawList;
            }
        }

        // 只保留 img2video 目录下的 LORA，并去掉前缀
        loras = loras
            .filter(lora => lora.startsWith('img2video/'))
            .map(lora => lora.replace('img2video/', ''));

        console.log('[Video] Parsed loras (filtered, prefix removed):', loras);
        cachedVideoLoras = loras;
        return loras;
    } catch (err) {
        console.error("[Video] Error fetching loras:", err);
        return [];
    }
};

// 获取视频生成工作流
const getVideoWorkflow = (settings: VideoGenerationSettings) => {
    const seed = settings.seed === -1
        ? Math.floor(Math.random() * 1000000000000000)
        : settings.seed;

    const negativePrompt = settings.negativePrompt || DEFAULT_VIDEO_NEGATIVE_PROMPT;
    const filename_prefix = `video/${new Date().toISOString().split('T')[0]}/${Date.now()}`;

    // 构建 LORA 输入（Power Lora Loader 使用动态键名）
    // 格式: { "lora_name.safetensors": { "on": true, "strength": 1.0, "strengthTwo": 1.0 } }
    // 根据 LORA 名称后缀 -high / -low 分配到对应节点
    const buildLoraInputsForModel = (loras: LoraConfig[] = [], modelType: 'high' | 'low') => {
        const loraInputs: Record<string, any> = {};
        loras.slice(0, 8).forEach(lora => {
            const loraNameLower = lora.name.toLowerCase();
            const isHighLora = loraNameLower.includes('-high');
            const isLowLora = loraNameLower.includes('-low');

            // 判断是否应该添加到当前模型
            let shouldAdd = false;
            if (modelType === 'high') {
                // HIGH 模型：添加 -high 后缀的 LORA，以及无后缀的 LORA
                shouldAdd = isHighLora || (!isHighLora && !isLowLora);
            } else {
                // LOW 模型：添加 -low 后缀的 LORA，以及无后缀的 LORA
                shouldAdd = isLowLora || (!isHighLora && !isLowLora);
            }

            if (shouldAdd) {
                // 添加 img2video/ 前缀（显示时去掉了，发送时需要加回来）
                const loraPath = lora.name.includes('/') ? lora.name : `img2video/${lora.name}`;
                loraInputs[loraPath] = {
                    "on": true,
                    "strength": lora.strength,
                    "strengthTwo": lora.strength
                };
            }
        });
        return loraInputs;
    };

    const loraInputsHigh = buildLoraInputsForModel(settings.loras, 'high');
    const loraInputsLow = buildLoraInputsForModel(settings.loras, 'low');

    return {
        "422": {
            "inputs": {
                "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
                "➕ Add Lora": "",
                "model": ["911:426", 0],
                ...loraInputsLow  // 添加 LORA 到 LOW 模型
            },
            "class_type": "Power Lora Loader (rgthree)",
            "_meta": { "title": "Loras LOW" }
        },
        "436": {
            "inputs": {
                "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
                "➕ Add Lora": "",
                "model": ["911:425", 0],
                "clip": ["911:1033", 0],
                ...loraInputsHigh  // 添加 LORA 到 HIGH 模型
            },
            "class_type": "Power Lora Loader (rgthree)",
            "_meta": { "title": "Loras HIGH" }
        },
        "644": {
            "inputs": {
                "options": "Intermediate and Utility",
                "filenames": ["958", 0]
            },
            "class_type": "VHS_PruneOutputs",
            "_meta": { "title": "Prune Outputs 🎥🅥🅗🅢" }
        },
        "958": {
            "inputs": {
                "frame_rate": ["911:943", 0],
                "loop_count": 0,
                "filename_prefix": filename_prefix,
                "format": "video/h265-mp4",
                "pix_fmt": "yuv420p10le",
                "crf": settings.crf,
                "save_metadata": true,
                "pingpong": false,
                "save_output": true,
                "images": ["911:997", 0]
            },
            "class_type": "VHS_VideoCombine",
            "_meta": { "title": "Video Combine 🎥🅥🅗🅢" }
        },
        "959": {
            "inputs": { "image": settings.firstFrameImage },
            "class_type": "LoadImage",
            "_meta": { "title": "首帧图像" }
        },
        "960": {
            "inputs": { "image": settings.lastFrameImage || "example.png" },
            "class_type": "LoadImage",
            "_meta": { "title": "末帧图像" }
        },
        "911:1008": {
            "inputs": { "value": true },
            "class_type": "PrimitiveBoolean",
            "_meta": { "title": "布尔值" }
        },
        "911:1018": {
            "inputs": { "value": false },
            "class_type": "PrimitiveBoolean",
            "_meta": { "title": "布尔值" }
        },
        "911:997": {
            "inputs": {
                "boolean": ["911:1019", 0],
                "on_true": ["911:1072:204", 0],
                "on_false": ["911:937", 0]
            },
            "class_type": "easy ifElse",
            "_meta": { "title": "是否判断" }
        },
        "911:1045": {
            "inputs": {
                "text": negativePrompt,
                "clip": ["436", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": { "title": "负面提示词" }
        },
        "911:1032": {
            "inputs": { "vae_name": "wan_2.1_vae.safetensors" },
            "class_type": "VAELoader",
            "_meta": { "title": "加载VAE" }
        },
        "911:1033": {
            "inputs": {
                "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
                "type": "wan",
                "device": "default"
            },
            "class_type": "CLIPLoader",
            "_meta": { "title": "加载CLIP" }
        },
        "911:1044": {
            "inputs": {
                "text": settings.positivePrompt,
                "clip": ["436", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": { "title": "正面提示词" }
        },
        "911:1021": {
            "inputs": { "output": "", "source": ["911:1019", 0] },
            "class_type": "Display Any (rgthree)",
            "_meta": { "title": "Display Any (rgthree)" }
        },
        "911:1019": {
            "inputs": { "any_02": ["911:1018", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:1003": {
            "inputs": {
                "boolean": ["911:1016", 0],
                "on_true": ["911:1028", 0],
                "on_false": ["911:1029", 0]
            },
            "class_type": "easy ifElse",
            "_meta": { "title": "是否判断" }
        },
        "911:1020": {
            "inputs": { "output": "", "source": ["911:1016", 0] },
            "class_type": "Display Any (rgthree)",
            "_meta": { "title": "Display Any (rgthree)" }
        },
        "911:1029": {
            "inputs": {},
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:966": {
            "inputs": {
                "ckpt_name": "rife49.pth",
                "clear_cache_after_n_frames": 10,
                "multiplier": 2,
                "fast_mode": true,
                "ensemble": true,
                "scale_factor": 1,
                "frames": ["911:1003", 0]
            },
            "class_type": "RIFE VFI",
            "_meta": { "title": "RIFE VFI (插帧 2x)" }
        },
        "911:943": {
            "inputs": {
                "a": ["911:457", 0],
                "b": 2,
                "operation": "multiply"
            },
            "class_type": "easy mathFloat",
            "_meta": { "title": "帧率计算 (2x)" }
        },
        "911:938": {
            "inputs": {
                "a": ["911:1072:194", 0],
                "b": 2,
                "operation": "multiply"
            },
            "class_type": "easy mathInt",
            "_meta": { "title": "宽度计算 (2x)" }
        },
        "911:939": {
            "inputs": {
                "a": ["911:1072:194", 1],
                "b": 2,
                "operation": "multiply"
            },
            "class_type": "easy mathInt",
            "_meta": { "title": "高度计算 (2x)" }
        },
        "911:937": {
            "inputs": {
                "width": ["911:938", 0],
                "height": ["911:939", 0],
                "resize_mode": "Keep AR",
                "divisible_by": 1,
                "max_batch_size": 3,
                "sinc_window": 3,
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "precision": "fp32",
                "image": ["911:966", 0]
            },
            "class_type": "BatchResizeWithLanczos",
            "_meta": { "title": "🐇 Batch Resize w/ Lanczos (超分 2x)" }
        },
        "911:961": {
            "inputs": {
                "add_noise": "enable",
                "noise_seed": ["911:915", 0],
                "steps": ["911:914", 0],
                "cfg": ["911:914", 2],
                "sampler_name": ["911:914", 3],
                "scheduler": ["911:914", 4],
                "start_at_step": 0,
                "end_at_step": ["911:914", 1],
                "return_with_leftover_noise": "enable",
                "model": ["436", 0],
                "positive": ["911:960", 0],
                "negative": ["911:960", 1],
                "latent_image": ["911:960", 2]
            },
            "class_type": "KSamplerAdvanced",
            "_meta": { "title": "采样器（高噪声）" }
        },
        "911:968": {
            "inputs": {
                "add_noise": "disable",
                "noise_seed": ["911:915", 0],
                "steps": ["911:914", 0],
                "cfg": ["911:914", 2],
                "sampler_name": ["911:914", 3],
                "scheduler": ["911:914", 4],
                "start_at_step": ["911:914", 1],
                "end_at_step": 10000,
                "return_with_leftover_noise": "disable",
                "model": ["422", 0],
                "positive": ["911:960", 0],
                "negative": ["911:960", 1],
                "latent_image": ["911:961", 0]
            },
            "class_type": "KSamplerAdvanced",
            "_meta": { "title": "采样器（低噪声）" }
        },
        "911:963": {
            "inputs": {
                "samples": ["911:968", 0],
                "vae": ["911:1032", 0]
            },
            "class_type": "VAEDecode",
            "_meta": { "title": "VAE解码" }
        },
        // 视频生成核心节点：根据是否启用首尾帧模式选择不同节点
        "911:960": settings.flf2vEnabled ? {
            // 首尾帧模式：WanFirstLastFrameToVideo
            "inputs": {
                "width": ["911:1072:194", 0],
                "height": ["911:1072:194", 1],
                "length": ["911:1073", 0],
                "batch_size": 1,
                "positive": ["911:1044", 0],
                "negative": ["911:1045", 0],
                "vae": ["911:1032", 0],
                "start_image": ["911:1072:204", 0],
                "end_image": ["911:1056", 0]  // 尾帧图片
            },
            "class_type": "WanFirstLastFrameToVideo",
            "_meta": { "title": "Wan首尾帧到视频 (FLF2V)" }
        } : {
            // 普通模式：WanImageToVideo
            "inputs": {
                "width": ["911:1072:194", 0],
                "height": ["911:1072:194", 1],
                "length": ["911:1073", 0],
                "batch_size": 1,
                "positive": ["911:1044", 0],
                "negative": ["911:1045", 0],
                "vae": ["911:1032", 0],
                "start_image": ["911:1072:204", 0]
            },
            "class_type": "WanImageToVideo",
            "_meta": { "title": "Wan图像到视频" }
        },
        // 尾帧图片缩放节点（仅首尾帧模式使用）
        "911:1056": {
            "inputs": {
                "upscale_method": "lanczos",
                "width": ["911:1072:194", 0],
                "height": ["911:1072:194", 1],
                "crop": "center",
                "image": ["960", 0]
            },
            "class_type": "ImageScale",
            "_meta": { "title": "缩放尾帧图像" }
        },
        "911:1016": {
            "inputs": { "any_01": ["911:1008", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:1028": {
            "inputs": { "any_01": ["911:963", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:1041": {
            "inputs": { "any_01": ["911:1037", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:1043": {
            "inputs": { "any_01": ["911:1042", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Any Switch (rgthree)" }
        },
        "911:425": {
            "inputs": {
                "shift": settings.shiftHigh,
                "model": ["911:1041", 0]
            },
            "class_type": "ModelSamplingSD3",
            "_meta": { "title": "Sigma偏移 高噪声" }
        },
        "911:426": {
            "inputs": {
                "shift": settings.shiftLow,
                "model": ["911:1043", 0]
            },
            "class_type": "ModelSamplingSD3",
            "_meta": { "title": "Sigma偏移 低噪声" }
        },
        "911:1037": {
            "inputs": { "ckpt_name": "DasiwaWAN22I2V14BLightspeed_synthseductionHighV9.safetensors" },
            "class_type": "CheckpointLoaderSimple",
            "_meta": { "title": "加载检查点 高噪声" }
        },
        "911:1042": {
            "inputs": { "ckpt_name": "DasiwaWAN22I2V14BLightspeed_synthseductionLowV9.safetensors" },
            "class_type": "CheckpointLoaderSimple",
            "_meta": { "title": "加载检查点 低噪声" }
        },
        "911:1072:194": {
            "inputs": { "image": ["911:1072:204", 0] },
            "class_type": "GetImageSize",
            "_meta": { "title": "获取图像尺寸" }
        },
        "911:1072:204": {
            "inputs": {
                "upscale_method": "lanczos",
                "width": ["911:1072:210", 0],
                "height": ["911:1072:211", 0],
                "crop": "disabled",
                "image": ["959", 0]
            },
            "class_type": "ImageScale",
            "_meta": { "title": "缩放图像" }
        },
        "911:1072:213": {
            "inputs": {
                "expression": "round((a / (b / c)) / 16) * 16",
                "a": ["911:1072:212", 0],
                "b": ["911:1072:201", 0],
                "c": ["911:1072:201", 1]
            },
            "class_type": "MathExpression|pysssss",
            "_meta": { "title": "Height 🐍" }
        },
        "911:1072:212": {
            "inputs": {
                "expression": "round(sqrt(0.4 * 1000000 * (b / c)) / 16) * 16",
                "b": ["911:1072:201", 0],
                "c": ["911:1072:201", 1]
            },
            "class_type": "MathExpression|pysssss",
            "_meta": { "title": "Width 🐍" }
        },
        "911:1072:210": {
            "inputs": { "any_02": ["911:1072:212", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Width" }
        },
        "911:1072:201": {
            "inputs": { "image": ["959", 0] },
            "class_type": "GetImageSize",
            "_meta": { "title": "获取图像尺寸" }
        },
        "911:1072:211": {
            "inputs": { "any_02": ["911:1072:213", 0] },
            "class_type": "Any Switch (rgthree)",
            "_meta": { "title": "Height" }
        },
        "911:457": {
            "inputs": { "value": settings.frameRate },
            "class_type": "PrimitiveFloat",
            "_meta": { "title": "帧率 (原始)" }
        },
        "911:458": {
            "inputs": { "value": settings.crf },
            "class_type": "PrimitiveInt",
            "_meta": { "title": "CRF" }
        },
        "911:1073": {
            "inputs": {
                "expression": "(round((a * b) / 8) * 8) +1",
                "a": ["911:1075", 0],
                "b": ["911:457", 0]
            },
            "class_type": "MathExpression|pysssss",
            "_meta": { "title": "帧数逻辑 🐍" }
        },
        "911:1075": {
            "inputs": { "value": settings.duration },
            "class_type": "PrimitiveInt",
            "_meta": { "title": "秒数" }
        },
        "911:915": {
            "inputs": { "seed": seed },
            "class_type": "easy seed",
            "_meta": { "title": "随机种" }
        },
        "911:914": {
            "inputs": {
                "steps_total": settings.steps,
                "refiner_step": settings.refinerStep,
                "cfg": settings.cfg,
                "sampler_name": settings.samplerName || "uni_pc_bh2",
                "scheduler": settings.scheduler || "beta"
            },
            "class_type": "KSampler Config (rgthree)",
            "_meta": { "title": "采样" }
        },
        // 保存尾帧功能节点
        "907:908": {
            "inputs": {
                "index": -1,
                "filenames": ["958", 0]
            },
            "class_type": "VHS_SelectFilename",
            "_meta": { "title": "Select Filename 🎥🅥🅗🅢" }
        },
        "907:907": {
            "inputs": {
                "video": ["907:908", 0],
                "force_rate": 0,
                "custom_width": 0,
                "custom_height": 0,
                "frame_load_cap": 0,
                "start_time": 0,
                "format": "AnimateDiff"
            },
            "class_type": "VHS_LoadVideoFFmpegPath",
            "_meta": { "title": "Load Video FFmpeg (Path) 🎥🅥🅗🅢" }
        },
        "907:909": {
            "inputs": {
                "indexes": "-1",
                "err_if_missing": true,
                "err_if_empty": true,
                "image": ["907:907", 0]
            },
            "class_type": "VHS_SelectImages",
            "_meta": { "title": "Select Images (Last Frame) 🎥🅥🅗🅢" }
        },
        "907:903": {
            "inputs": {
                "filename_prefix": `${filename_prefix}_LASTFRAME`,
                "images": ["907:909", 0]
            },
            "class_type": "SaveImage",
            "_meta": { "title": "保存尾帧图像" }
        }
    };
};

/**
 * 上传图片到 ComfyUI 用于视频生成
 */
export const uploadImageForVideo = async (imageUrl: string): Promise<string> => {
    const startTime = Date.now();
    console.log('[Video] 1/4: Starting image upload preparation...');

    // 1. 获取图片 blob
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();

    // 2. 生成唯一文件名
    const filename = `video_frame_${Date.now()}.png`;

    // 3. 创建 FormData
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');

    // 4. 上传到 ComfyUI
    console.log('[Video] 2/4: Sending image bytes to server...');
    const uploadResponse = await comfyUpload(`${COMFY_API_URL_STANDARD}/upload/image`, formData);

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    console.log(`[Video] 3/4: Image upload successful in ${Date.now() - startTime}ms:`, result);
    return result.name || filename;
};

/**
 * 释放 ComfyUI 显存
 * 使用 UnloadAllModels 节点清理显存，并添加输出节点以确保执行
 */
export const freeVRAM = async (): Promise<void> => {
    const startTime = Date.now();
    console.log('[Video] VRAM Cleanup Sequence: Initiated');

    // 使用用户确认存在的 UnloadAllModels 节点
    // 同时添加 Display Any 节点作为输出，确保 ComfyUI 会执行此 Prompt
    const cleanupWorkflow = {
        "1": {
            "inputs": {
                "value": ""
            },
            "class_type": "UnloadAllModels",
            "_meta": { "title": "Unload All Models" }
        },
        "2": {
            "inputs": {
                "source": ["1", 0]
            },
            "class_type": "Display Any (rgthree)",
            "_meta": { "title": "Force Execution" }
        }
    };

    try {
        console.log('[Video] VRAM Cleanup Sequence: Submitting prompt...');
        const response = await comfyPost(`${COMFY_API_URL_STANDARD}/prompt`, {
            prompt: cleanupWorkflow
        });

        if (response.ok) {
            const data = await response.json();
            if (data.prompt_id) {
                console.log('[Video] VRAM Cleanup Sequence: Prompt ID', data.prompt_id);
                // 等待 8 秒让大型模型完全卸载
                console.log('[Video] VRAM Cleanup Sequence: Mandatory 8s cool-down triggered...');
                await new Promise(resolve => setTimeout(resolve, 8000));
                console.log(`[Video] VRAM Cleanup Sequence: Completed in ${Date.now() - startTime}ms`);
                return;
            }
        }

        const errorText = await response.text();
        console.warn('[Video] VRAM Cleanup Sequence: Failed to submit cleanup prompt:', response.status, errorText);
    } catch (err) {
        console.error('[Video] VRAM Cleanup Sequence: Error during submission:', err);
    }

    // 最后尝试 /free API 作为备用
    console.log('[Video] VRAM Cleanup Sequence: Trying fallback /free API...');
    try {
        await comfyPost(`${COMFY_API_URL_STANDARD}/free`, {
            unload_models: true,
            free_memory: true
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('[Video] VRAM Cleanup Sequence: Fallback successful');
    } catch (err) {
        console.warn('[Video] VRAM Cleanup Sequence: Fallback failed:', err);
    }
};

/**
 * 提交视频生成任务
 */
export const queueVideoGeneration = async (settings: VideoGenerationSettings): Promise<string> => {
    const totalStartTime = Date.now();

    // 先释放显存，避免 OOM
    await freeVRAM();

    console.log('[Video] Generation Sequence: Composing workflow JSON...');
    const workflow = getVideoWorkflow(settings);

    console.log('[Video] Generation Sequence: Submitting job to ComfyUI...');
    try {
        const response = await comfyPost(`${COMFY_API_URL_STANDARD}/prompt`, { prompt: workflow });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Video] Generation Sequence: Submission failed:', errorText);
            throw new Error(`ComfyUI Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Video] Generation Sequence: SUCCESS! Job queued in ${Date.now() - totalStartTime}ms total. PromptID:`, data.prompt_id);
        return data.prompt_id;
    } catch (err) {
        console.error("[Video] Generation Sequence: NETWORK ERROR:", err);
        throw err;
    }
};

/**
 * 检查视频生成状态
 */
export const checkVideoGenerationStatus = async (promptId: string): Promise<{
    status: 'completed' | 'pending' | 'error' | 'not_found';
    videoUrl?: string;
    lastFrameUrl?: string;  // 尾帧图片 URL
    progress?: number;
    isRunning?: boolean;
}> => {
    try {
        const response = await comfyFetch(`${COMFY_API_URL_STANDARD}/history/${promptId}`);
        if (!response.ok) return { status: 'error' };

        const data = await response.json();

        if (data[promptId]) {
            if (data[promptId].status.completed) {
                const outputs = data[promptId].outputs;
                let videoUrl: string | undefined;
                let lastFrameUrl: string | undefined;

                // 检查 VHS_VideoCombine 输出 (节点 958)
                if (outputs["958"] && outputs["958"].gifs && outputs["958"].gifs.length > 0) {
                    const video = outputs["958"].gifs[0];
                    videoUrl = `${COMFY_API_URL_STANDARD}/view?filename=${video.filename}&subfolder=${video.subfolder}&type=${video.type}`;
                }

                // 备用检查：有些版本可能输出在 videos 字段
                if (!videoUrl && outputs["958"] && outputs["958"].videos && outputs["958"].videos.length > 0) {
                    const video = outputs["958"].videos[0];
                    videoUrl = `${COMFY_API_URL_STANDARD}/view?filename=${video.filename}&subfolder=${video.subfolder}&type=${video.type}`;
                }

                // 提取尾帧 URL (节点 907:903 SaveImage 输出)
                if (outputs["907:903"] && outputs["907:903"].images && outputs["907:903"].images.length > 0) {
                    const lastFrame = outputs["907:903"].images[0];
                    lastFrameUrl = `${COMFY_API_URL_STANDARD}/view?filename=${lastFrame.filename}&subfolder=${lastFrame.subfolder}&type=${lastFrame.type}`;
                }

                if (videoUrl) {
                    return {
                        status: 'completed',
                        videoUrl,
                        lastFrameUrl
                    };
                }
            }

            // 检查错误状态
            if (data[promptId].status.status_str === 'error') {
                return { status: 'error' };
            }

            return { status: 'pending' };
        }

        // 检查队列中是否还有
        const queueResponse = await comfyFetch(`${COMFY_API_URL_STANDARD}/queue`);
        if (queueResponse.ok) {
            const queueData = await queueResponse.json();
            const running = queueData.queue_running || [];
            const pending = queueData.queue_pending || [];

            const inQueue = [...running, ...pending].some((item: any) => {
                if (Array.isArray(item)) return item.includes(promptId);
                return item === promptId || item?.prompt_id === promptId;
            });

            const isRunning = running.some((item: any) => {
                if (Array.isArray(item)) return item.includes(promptId);
                return item === promptId || item?.prompt_id === promptId;
            });

            if (inQueue) return { status: 'pending', isRunning };
        }

        return { status: 'not_found' };
    } catch (err) {
        console.error("[Video] Polling error:", err);
        return { status: 'error' };
    }
};
