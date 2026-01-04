import { COMFY_API_URL } from "../constants";

export const SYSTEM_PROMPT_PREFIX = ""; // 标准模式通常不需要特殊的 System Prompt
export const NEGATIVE_PROMPT_DEFAULT = "lowres, (worst quality,bad quality,low quality:1.2), bad anatomy, watermark, fused hands, bad hands, boy, looking at viewer";

// 正常模型生图工作流模板
// 基于用户提供的"生图+放大 API.json"
// 注意：将 PreviewImage 改为 SaveImage 以便获取结果
export const STANDARD_WORKFLOW_TEMPLATE = {
    // 1. 加载放大模型
    "1": {
        "inputs": {
            "model_name": "4x_foolhardy_Remacri.pth"
        },
        "class_type": "UpscaleModelLoader"
    },
    // 2. Ultimate SD Upscale (放大)
    "2": {
        "inputs": {
            "upscale_by": 1.5,
            "seed": -1, // Will be filled
            "steps": 20,
            "cfg": 4.5,
            "sampler_name": "euler",
            "scheduler": "karras",
            "denoise": 0.2,
            "mode_type": "Linear",
            "tile_width": 512,
            "tile_height": 512,
            "mask_blur": 8,
            "tile_padding": 32,
            "seam_fix_mode": "None",
            "seam_fix_denoise": 1,
            "seam_fix_width": 64,
            "seam_fix_mask_blur": 8,
            "seam_fix_padding": 16,
            "force_uniform_tiles": true,
            "tiled_decode": false,
            "image": [
                "8",
                0
            ],
            "model": [
                "3",
                0
            ],
            "positive": [
                "10",
                0
            ],
            "negative": [
                "11",
                0
            ],
            "vae": [
                "3",
                2
            ],
            "upscale_model": [
                "1",
                0
            ]
        },
        "class_type": "UltimateSDUpscale"
    },
    // 3. Checkpoint Loader
    "3": {
        "inputs": {
            "ckpt_name": "hassaku_xl_illustrious_v1.3.safetensors" // Will be filled
        },
        "class_type": "CheckpointLoaderSimple"
    },
    // 7. LoRA Loader Stack
    "7": {
        "inputs": {
            "lora_01": "None",
            "strength_01": 1,
            "lora_02": "None",
            "strength_02": 1,
            "lora_03": "None",
            "strength_03": 1,
            "lora_04": "None",
            "strength_04": 1,
            "model": [
                "3",
                0
            ],
            "clip": [
                "16",
                0
            ]
        },
        "class_type": "Lora Loader Stack (rgthree)"
    },
    // 8. VAE Decode
    "8": {
        "inputs": {
            "samples": [
                "9",
                0
            ],
            "vae": [
                "3",
                2
            ]
        },
        "class_type": "VAEDecode"
    },
    // 9. KSampler
    "9": {
        "inputs": {
            "seed": -1, // Will be filled
            "steps": 30, // Will be filled
            "cfg": 5,    // Will be filled
            "sampler_name": "euler_ancestral", // Will be filled
            "scheduler": "karras",             // Will be filled
            "denoise": 1,
            "model": [
                "7",
                0
            ],
            "positive": [
                "10",
                0
            ],
            "negative": [
                "11",
                0
            ],
            "latent_image": [
                "12",
                0
            ]
        },
        "class_type": "KSampler"
    },
    // 10. Positive Prompt
    "10": {
        "inputs": {
            "text": "", // Will be filled
            "clip": [
                "7",
                1
            ]
        },
        "class_type": "CLIPTextEncode"
    },
    // 11. Negative Prompt
    "11": {
        "inputs": {
            "text": NEGATIVE_PROMPT_DEFAULT, // Will be filled
            "clip": [
                "7",
                1
            ]
        },
        "class_type": "CLIPTextEncode"
    },
    // 12. Empty Latent Image
    "12": {
        "inputs": {
            "width": 832,  // Will be filled
            "height": 1216, // Will be filled
            "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
    },
    // 14. Save Image (Original Size) - was PreviewImage in ref
    "14": {
        "inputs": {
            "filename_prefix": "Standard_ComfyUI",
            "images": [
                "8",
                0
            ]
        },
        "class_type": "SaveImage"
    },
    // 15. Save Image (Upscaled) - was PreviewImage in ref
    "15": {
        "inputs": {
            "filename_prefix": "Standard_ComfyUI_Upscaled",
            "images": [
                "2",
                0
            ]
        },
        "class_type": "SaveImage"
    },
    // 16. CLIP Set Last Layer
    "16": {
        "inputs": {
            "stop_at_clip_layer": -2,
            "clip": [
                "3",
                1
            ]
        },
        "class_type": "CLIPSetLastLayer"
    },
    // ===== 二次放大节点 =====
    // 17. ImageScale (放大一次放大后的图像)
    "17": {
        "inputs": {
            "upscale_method": "lanczos",
            "width": 1920,  // Will be calculated dynamically
            "height": 2880, // Will be calculated dynamically
            "crop": "disabled",
            "image": [
                "2",  // 从一次放大输出
                0
            ]
        },
        "class_type": "ImageScale"
    },
    // 18. VAEEncode (编码放大后的图像)
    "18": {
        "inputs": {
            "pixels": [
                "17",
                0
            ],
            "vae": [
                "3",
                2
            ]
        },
        "class_type": "VAEEncode"
    },
    // 19. KSampler (二次放大采样)
    "19": {
        "inputs": {
            "seed": -1,
            "steps": 20,
            "cfg": 5,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 0.25,
            "model": [
                "7",
                0
            ],
            "positive": [
                "10",
                0
            ],
            "negative": [
                "11",
                0
            ],
            "latent_image": [
                "18",
                0
            ]
        },
        "class_type": "KSampler"
    },
    // 20. VAEDecode (解码二次放大结果)
    "20": {
        "inputs": {
            "samples": [
                "19",
                0
            ],
            "vae": [
                "3",
                2
            ]
        },
        "class_type": "VAEDecode"
    },
    // 21. SaveImage (保存二次放大结果)
    "21": {
        "inputs": {
            "filename_prefix": "Standard_ComfyUI_SecondUpscale",
            "images": [
                "20",
                0
            ]
        },
        "class_type": "SaveImage"
    },
    // ===== FaceDetailer 面部修复节点 =====
    // 22. UltralyticsDetectorProvider (面部检测器)
    "22": {
        "inputs": {
            "model_name": "bbox/face_yolov8m.pt"
        },
        "class_type": "UltralyticsDetectorProvider"
    },
    // 23. SAMLoader (分割模型)
    "23": {
        "inputs": {
            "model_name": "sam_vit_b_01ec64.pth",
            "device_mode": "AUTO"
        },
        "class_type": "SAMLoader"
    },
    // 24. FaceDetailer (面部修复)
    "24": {
        "inputs": {
            "image": ["20", 0],           // 从二次放大的 VAEDecode 输出
            "model": ["7", 0],            // 复用 LoRA 后的模型
            "clip": ["7", 1],             // 复用 CLIP
            "vae": ["3", 2],              // 复用 VAE
            "positive": ["10", 0],        // 复用正向条件
            "negative": ["11", 0],        // 复用负向条件
            "bbox_detector": ["22", 0],   // BBox 检测器
            "sam_model_opt": ["23", 0],   // SAM 模型
            "guide_size": 512,
            "guide_size_for": true,
            "max_size": 1024,
            "seed": -1,
            "steps": 20,
            "cfg": 5,
            "sampler_name": "euler_ancestral",
            "scheduler": "normal",
            "denoise": 0.35,
            "feather": 5,
            "noise_mask": true,
            "force_inpaint": true,
            "bbox_threshold": 0.5,
            "bbox_dilation": 10,
            "bbox_crop_factor": 3,
            "sam_detection_hint": "center-1",
            "sam_dilation": 0,
            "sam_threshold": 0.93,
            "sam_bbox_expansion": 0,
            "sam_mask_hint_threshold": 0.7,
            "sam_mask_hint_use_negative": "False",
            "drop_size": 10,
            "wildcard": "",
            "cycle": 1,
            "inpaint_model": false,
            "noise_mask_feather": 20
        },
        "class_type": "FaceDetailer"
    },
    // 25. SaveImage (FaceDetailer 结果保存)
    "25": {
        "inputs": {
            "filename_prefix": "Standard_ComfyUI_FaceDetail",
            "images": ["24", 0]
        },
        "class_type": "SaveImage"
    }
};

// 这里的放大工作流暂且只定义生图+放大，单独放大逻辑可以复用 UPSCALE_ONLY_WORKFLOW_TEMPLATE 或者根据 standard 需求调整
// 目前用户提供的 reference json 只有 "加载图像放大.json" 和 "生图+放大.json"
// 如果需要单独放大，可能需要另外配置。
// 考虑到用户需求 "生图逻辑参考...工作流内容"，我们主要关注生图流程。
