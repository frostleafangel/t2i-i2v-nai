
// 双人模式工作流模板 (基于验证通过的极简工作流 + 放大逻辑)
// 此版本严格采用验证脚本输出的 JSON 结构（包含 Any Switch 节点）

export const DUO_WORKFLOW_TEMPLATE = {
    // 基础生成部分 (ID 来自 check_object_info 提取的 API JSON)

    // 6. CheckpointLoaderSimple - 模型
    "6": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
            "ckpt_name": "oneObsession_v19.safetensors"
        }
    },

    // 61. ZmlPowerLoraLoader - LoRA (注意 hidden 输入 lora_loader_data)
    "61": {
        "class_type": "ZmlPowerLoraLoader",
        "inputs": {
            "model": ["6", 0],
            "clip": ["6", 1],
            "lora_loader_data": "{\"entries\":[]}", // 初始为空，由服务填充
            "lora_names_hidden": ""
        }
    },

    // 269. ZML_PresetResolution - 分辨率
    "269": {
        "class_type": "ZML_PresetResolution",
        "inputs": {
            "预设": "SDXL_832x1216",
            "互换宽高": false,
            "随机模式": false,
            "批次数量": 1
        }
    },

    // 270. ZML_MaskSplitNode - 分割
    "270": {
        "class_type": "ZML_MaskSplitNode",
        "inputs": {
            "宽度": ["269", 0],
            "高度": ["269", 1],
            "分割比例": 0.5,
            "分割方向": "竖"
        }
    },

    // 67. ZML_PromptUINode - 主体提示词
    "67": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": "" // 主体 prompt
        }
    },

    // 36. ZML_TextInput - 质量词 (追加到主体)
    "36": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "masterpiece,best quality,newest,highres,absurdres,incredibly absurdres,very awa,very aesthetic,extreme aesthetic,detailed backgroud, finished,overlapping,appropriate posture,appropriate configuration,cropping,thick dense skin,ultra-precise skin,soft cheeks,"
        }
    },

    // 34. ZML_MultiTextInput3 - 组合主体提示词 (节点67 + lora触发词 + 节点36)
    "34": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": ["67", 0], // 主体
            "文本2": ["61", 5], // LoRA 触发词
            "文本3": ["36", 0], // 质量词
            "格式化标点符号": true,
            "分隔符": ","
        }
    },

    // 10. CLIPTextEncode - 主体条件
    "10": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["34", 0]
        }
    },

    // 40. ZML_TextInput - 预设负面
    "40": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "low quality, worst quality, normal quality, text, signature, jpeg artifacts, old, early, copyright name, watermark, artist name, logo, artist logo, patreon logo, blurry, cloned face, cropped, deformed, disfigured, error, out of frame, owres, poorly drawn face, username, furry girl, mole,\n"
        }
    },

    // 39. ZML_MultiTextInput3 - 负面提示词
    // 注意：文本1 必须保持为空字符串，否则会导致 DenseDiffusion 报错
    // 用户负面提示词需要在服务层直接追加到 Node 40 的预设负面中
    "39": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": "", // 必须为空！非空会导致 DenseDiffusion Tensor 维度不匹配
            "文本2": ["40", 0], // 预设负面 + 用户负面（在服务层追加）
            "格式化标点符号": true,
            "分隔符": ",",
            "文本3": ""
        }
    },

    // 11. CLIPTextEncode - 负面条件
    "11": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["39", 0]
        }
    },

    // 65. ZML_TextInput - 角色A 提示词 (用户输入)
    "65": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": ""
        }
    },

    // 62. ZML_PromptUINode - 角色A (Workflow中62其实只连到了21的input1，62是 "heads together")
    // API Json: 21.input['文本1'] = ['62',0], 21.input['文本2'] = ['65',0]
    // 65 是角色A主描述
    "62": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": ""
        }
    },

    // 21. ZML_MultiTextInput3 - 角色A 组合
    "21": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": ["62", 0],
            "文本2": ["65", 0],
            "格式化标点符号": true,
            "分隔符": ",",
            "文本3": ""
        }
    },

    // 19. CLIPTextEncode - 角色A 条件
    "19": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["21", 0]
        }
    },

    // 66. ZML_TextInput - 角色B 提示词 (用户输入)
    "66": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": ""
        }
    },

    // 64. ZML_PromptUINode - 角色B (同62)
    "64": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": ""
        }
    },

    // 26. ZML_MultiTextInput3 - 角色B 组合
    "26": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": ["64", 0],
            "文本2": ["66", 0],
            "格式化标点符号": true,
            "分隔符": ",",
            "文本3": ""
        }
    },

    // 25. CLIPTextEncode - 角色B 条件
    "25": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["26", 0]
        }
    },

    // Mask Switches (来自验证JSON)
    "144": {
        "class_type": "Any Switch (rgthree)",
        "inputs": { "any_02": ["270", 0] }
    },
    "145": {
        "class_type": "Any Switch (rgthree)",
        "inputs": { "any_02": ["270", 1] }
    },

    // DenseDiffusion Nodes
    "17": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["61", 0],
            "conditioning": ["10", 0], // 主体
            "mask": ["270", 4], // 全局mask 270[4]
            "strength": 1
        }
    },
    "15": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["17", 0],
            "conditioning": ["19", 0], // A
            "mask": ["144", 0], // 来自 Any Switch
            "strength": 1
        }
    },
    "16": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["15", 0],
            "conditioning": ["25", 0], // B
            "mask": ["145", 0], // 来自 Any Switch
            "strength": 1
        }
    },
    "18": {
        "class_type": "DenseDiffusionApplyNode",
        "inputs": {
            "model": ["16", 0]
        }
    },

    // 9. KSampler (Efficient)
    "9": {
        "class_type": "KSampler (Efficient)",
        "inputs": {
            "model": ["18", 0],
            "positive": ["18", 1],
            "negative": ["11", 0],
            "latent_image": ["269", 2],
            "optional_vae": ["6", 2],
            "seed": -1,
            "steps": 30,
            "cfg": 4.5,
            "sampler_name": "euler_ancestral",
            "scheduler": "karras",
            "denoise": 1,
            "preview_method": "latent2rgb",
            "vae_decode": "true"
        }
    },

    // 258. SaveImage (原图)
    "258": {
        "class_type": "SaveImage",
        "inputs": {
            "images": ["9", 5],
            "filename_prefix": "Duo_ComfyUI"
        }
    },

    // ==========================================
    // 放大模块 (IDs 500+)
    // ==========================================

    // 501. UpscaleModelLoader
    "501": {
        "inputs": {
            "model_name": "4x_foolhardy_Remacri.pth"
        },
        "class_type": "UpscaleModelLoader"
    },

    // 502. UltimateSDUpscale (输入连接到 Node 9 的 image [5])
    "502": {
        "inputs": {
            "image": ["9", 5],
            "model": ["61", 0], // 连接到 LoRA 输出的模型
            "positive": ["10", 0], // 主体条件
            "negative": ["11", 0], // 负面条件
            "vae": ["6", 2],
            "upscale_model": ["501", 0],
            "upscale_by": 1.25,
            "seed": -1,
            "steps": 20,
            "cfg": 4.5,
            "sampler_name": "res_multistep",
            "scheduler": "exponential",
            "denoise": 0.15,
            "mode_type": "Linear",
            "tile_width": 832,
            "tile_height": 1216,
            "mask_blur": 8,
            "tile_padding": 32,
            "seam_fix_mode": "None",
            "seam_fix_denoise": 0,
            "seam_fix_width": 64,
            "seam_fix_mask_blur": 8,
            "seam_fix_padding": 16,
            "force_uniform_tiles": true,
            "tiled_decode": false
        },
        "class_type": "UltimateSDUpscale"
    },

    // 503. SaveImage (一次放大)
    "503": {
        "inputs": {
            "filename_prefix": "Duo_ComfyUI_Upscaled",
            "images": ["502", 0]
        },
        "class_type": "SaveImage"
    },

    // 504. ImageScale - 二次放大图像缩放
    "504": {
        "inputs": {
            "image": ["502", 0],
            "upscale_method": "lanczos",
            "width": 1196, // 动态覆盖
            "height": 1748,
            "crop": "disabled"
        },
        "class_type": "ImageScale"
    },

    // 505. VAEEncode - 二次放大编码
    "505": {
        "inputs": {
            "pixels": ["504", 0],
            "vae": ["6", 2]
        },
        "class_type": "VAEEncode"
    },

    // 506. KSampler - 二次放大采样
    "506": {
        "inputs": {
            "model": ["61", 0],
            "positive": ["10", 0],
            "negative": ["11", 0],
            "latent_image": ["505", 0],
            "seed": -1,
            "steps": 20,
            "cfg": 4.5,
            "sampler_name": "res_multistep",
            "scheduler": "exponential",
            "denoise": 0.15
        },
        "class_type": "KSampler"
    },

    // 507. VAEDecode - 二次放大解码
    "507": {
        "inputs": {
            "samples": ["506", 0],
            "vae": ["6", 2]
        },
        "class_type": "VAEDecode"
    },

    // 508. SaveImage - 保存二次放大
    "508": {
        "inputs": {
            "filename_prefix": "Duo_ComfyUI_SecondUpscale",
            "images": ["507", 0]
        },
        "class_type": "SaveImage"
    }

};

// 分割方向映射
export const SPLIT_DIRECTION_MAP: Record<string, string> = {
    'vertical': '竖',
    'horizontal': '横',
    'diagonal': '对角线'
};

// 分辨率预设映射
export const DUO_RESOLUTION_PRESETS: Record<string, { width: number; height: number }> = {
    'SDXL_1024x1024': { width: 1024, height: 1024 },
    'SDXL_1216x832': { width: 1216, height: 832 },
    'SDXL_832x1216': { width: 832, height: 1216 },
    'SDXL_1344x768': { width: 1344, height: 768 },
    'SDXL_768x1344': { width: 768, height: 1344 },
    'SDXL_1536x640': { width: 1536, height: 640 },
    'SDXL_640x1536': { width: 640, height: 1536 }
};
