// Server Configuration
// 生产环境通过 Nginx 代理，开发环境通过环境变量配置
// 开发时在项目根目录创建 .env.local 文件，添加: VITE_COMFY_URL=http://your-server:port
const getComfyUrl = (): string => {
  // 无论是开发环境还是生产环境，都统一使用 /comfyui 路径
  // 开发环境通过 Vite proxy 转发 (见 vite.config.ts)
  // 生产环境通过 Express proxy 转发 (见 server/index.js)

  if (import.meta.env.DEV) {
    if (!import.meta.env.VITE_COMFY_URL) {
      console.warn('⚠️ VITE_COMFY_URL not set in .env.local, proxy might fail.');
    }
  }
  return '/comfyui';
};

const getStandardComfyUrl = (): string => {
  if (import.meta.env.DEV) {
    if (!import.meta.env.VITE_COMFY_URL_STANDARD) {
      console.warn('⚠️ VITE_COMFY_URL_STANDARD not set in .env.local, proxy might fail.');
    }
  }
  return '/comfyui-standard';
};

export const COMFY_API_URL = getComfyUrl();
export const COMFY_API_URL_STANDARD = getStandardComfyUrl();

// NewBie Model Constants
export const SYSTEM_PROMPT_PREFIX = `You are an assistant designed to generate high-quality anime images with the highest degree of image-text alignment based on xml format textual prompts. <Prompt Start>\n`;

export const NEGATIVE_PROMPT_DEFAULT = `<danbooru_tags>low_score_rate, worst quality, low quality, bad quality, lowres, low res, pixelated, blurry, blurred, compression artifacts, jpeg artifacts, bad anatomy, worst hands, deformed hands, deformed fingers, deformed feet, deformed toes, extra limbs, extra arms, extra legs, extra fingers, extra digits, extra digit, fused fingers, missing limbs, missing arms, missing fingers, missing toes, wrong hands, ugly hands, ugly fingers, twisted hands, flexible deformity, conjoined, disembodied, text, watermark, signature, logo, ugly, worst, very displeasing, displeasing, error, doesnotexist, unfinished, poorly drawn face, poorly drawn hands, poorly drawn feet, artistic error, bad proportions, bad perspective, out of frame, ai-generated, ai-assisted, stable diffusion, overly saturated, overly vivid, cross-eye, expressionless, scan, sketch, monochrome, simple background, abstract, sequence, lineup, 2koma, 4koma, microsoft paint \\(medium\\), artifacts, adversarial noise, has bad revision, resized, image sample,low_aesthetic</danbooru_tags>`;

export const NEGATIVE_SYSTEM_PROMPT = "You are an assistant designed to generate high-quality anime images with the highest degree of image-text alignment based on textual prompts. <Prompt Start> ";

// Recommended Parameters for NewBie
// Guide: CFG 4~5.5, Steps >= 28
export const DEFAULT_SETTINGS = {
  width: 832,
  height: 1264,
  steps: 30,
  cfg: 5,
  seed: -1,
  sampler_name: "res_multistep",
  scheduler: "linear_quadratic",
  negativePrompt: NEGATIVE_PROMPT_DEFAULT,
  enableUpscale: false, // 默认关闭自动放大
};

// Guide said: Sampler: res_multistep/euler_ancestral
// We include common ones plus the guide recommendations
export const VALID_SAMPLERS = [
  "res_multistep",
  "euler_ancestral",
  "dpmpp_2m_sde",
  "dpmpp_sde",
  "euler",
  "dpmpp_2m",
  "ddim"
];

// Guide said: Scheduler: linear_quadratic
export const VALID_SCHEDULERS = [
  "linear_quadratic", // Specific to NewBie guide
  "karras",
  "normal",
  "simple",
  "sgm_uniform",
  "exponential"
];


// NewBie workflow template matching the working ComfyUI API format
export const WORKFLOW_TEMPLATE = {
  // Diffusion Model Loader (KJ)
  "1": {
    "inputs": {
      "model_name": "NewBie-image-v0.1-exp-ep9.safetensors",
      "weight_dtype": "bf16",
      "compute_dtype": "default",
      "patch_cublaslinear": false,
      "sage_attention": "disabled",
      "enable_fp16_accumulation": false
    },
    "class_type": "DiffusionModelLoaderKJ"
  },
  // NewBie CLIP Loader
  "2": {
    "inputs": {
      "gemma_model_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/gemma3",
      "jina_clip_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/jina_clip",
      "device": "cuda",
      "dtype": "bf16",
      "cpu_offload": true,
      "enable_jina_weights": true,
      "weight_baseline_mode": "mean",
      "weight_strength": 1,
      "mask_normalization": true
    },
    "class_type": "NewBieCLIPLoader"
  },
  // VAE Loader
  "3": {
    "inputs": {
      "vae_name": "diffusion_pytorch_model.safetensors"
    },
    "class_type": "VAELoader"
  },
  // KSampler
  "4": {
    "inputs": {
      "seed": 0, // Will be filled
      "steps": 30,
      "cfg": 5,
      "sampler_name": "res_multistep",
      "scheduler": "linear_quadratic",
      "denoise": 1,
      "model": ["10", 0],
      "positive": ["5", 0],
      "negative": ["6", 0],
      "latent_image": ["7", 0]
    },
    "class_type": "KSampler"
  },
  // Positive Prompt (NewBie CLIP Text Encode)
  "5": {
    "inputs": {
      "user_prompt": "", // Will be filled
      "system_prompt": SYSTEM_PROMPT_PREFIX,
      "use_chat_template": false,
      "clip": ["2", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // Negative Prompt (NewBie CLIP Text Encode)
  "6": {
    "inputs": {
      "user_prompt": NEGATIVE_PROMPT_DEFAULT,
      "system_prompt": NEGATIVE_SYSTEM_PROMPT,
      "use_chat_template": false,
      "clip": ["2", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // Empty Latent Image
  "7": {
    "inputs": {
      "width": 832,
      "height": 1264,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  // VAE Decode
  "8": {
    "inputs": {
      "samples": ["4", 0],
      "vae": ["3", 0]
    },
    "class_type": "VAEDecode"
  },
  // RescaleCFG
  "10": {
    "inputs": {
      "multiplier": 0.7,
      "model": ["1", 0]
    },
    "class_type": "RescaleCFG"
  },
  // Save Image
  "21": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
  }
};

// 放大工作流模板 - 基于用户提供的放大api.json
// 这个工作流包含两阶段：基础生成 + 放大重绘
export const UPSCALE_WORKFLOW_TEMPLATE = {
  // 第一阶段 KSampler - 基础生成
  "3": {
    "inputs": {
      "seed": ["86", 0],
      "steps": 28,
      "cfg": 5,
      "sampler_name": "euler_ancestral",
      "scheduler": "linear_quadratic",
      "denoise": 1,
      "model": ["93:92", 0],
      "positive": ["28", 0],
      "negative": ["93:87", 0],
      "latent_image": ["51", 4]
    },
    "class_type": "KSampler"
  },
  // 正向 Prompt
  "28": {
    "inputs": {
      "user_prompt": "", // Will be filled
      "system_prompt": SYSTEM_PROMPT_PREFIX,
      "use_chat_template": false,
      "clip": ["93:88", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // 分辨率设置
  "51": {
    "inputs": {
      "width": 832,
      "height": 1216,
      "aspect_ratio": "custom",
      "swap_dimensions": "Off",
      "upscale_factor": 1,
      "batch_size": 1
    },
    "class_type": "CR SDXL Aspect Ratio"
  },
  // Seed 节点
  "86": {
    "inputs": {
      "seed": -1
    },
    "class_type": "Seed (rgthree)"
  },
  // 第二阶段 KSampler - 放大后重绘
  "94": {
    "inputs": {
      "seed": ["98", 0],
      "steps": 10,
      "cfg": 5,
      "sampler_name": "euler_ancestral",
      "scheduler": "linear_quadratic",
      "denoise": 0.4,
      "model": ["93:92", 0],
      "positive": ["28", 0],
      "negative": ["93:87", 0],
      "latent_image": ["104:102", 0]
    },
    "class_type": "KSampler"
  },
  // 放大阶段 Seed
  "98": {
    "inputs": {
      "seed": -1
    },
    "class_type": "Seed (rgthree)"
  },
  // 预览保存（第一阶段输出）
  "145": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "only_preview": true,
      "images": ["93:62", 0]
    },
    "class_type": "easy imageSave"
  },
  // 最终保存（放大后输出）
  "146": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "only_preview": false,
      "images": ["104:100", 0]
    },
    "class_type": "easy imageSave"
  },
  // VAE 解码（第一阶段）
  "93:62": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["93:90", 0]
    },
    "class_type": "VAEDecode"
  },
  // 负向 Prompt
  "93:87": {
    "inputs": {
      "user_prompt": NEGATIVE_PROMPT_DEFAULT,
      "system_prompt": NEGATIVE_SYSTEM_PROMPT,
      "use_chat_template": true,
      "clip": ["93:88", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // RescaleCFG
  "93:92": {
    "inputs": {
      "multiplier": 0.7,
      "model": ["93:91", 0]
    },
    "class_type": "RescaleCFG"
  },
  // VAE Loader
  "93:90": {
    "inputs": {
      "vae_name": "diffusion_pytorch_model.safetensors"
    },
    "class_type": "VAELoader"
  },
  // Diffusion Model Loader
  "93:89": {
    "inputs": {
      "model_name": "NewBie-image-v0.1-exp-ep9.safetensors",
      "weight_dtype": "bf16",
      "compute_dtype": "default",
      "patch_cublaslinear": false,
      "sage_attention": "disabled",
      "enable_fp16_accumulation": true
    },
    "class_type": "DiffusionModelLoaderKJ"
  },
  // Model Sampling Newbie
  "93:91": {
    "inputs": {
      "shift": 6,
      "model": ["93:89", 0]
    },
    "class_type": "ModelSamplingNewbie"
  },
  // NewBie CLIP Loader
  "93:88": {
    "inputs": {
      "gemma_model_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/gemma3",
      "jina_clip_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/jina_clip",
      "device": "cuda",
      "dtype": "bf16",
      "cpu_offload": false,
      "enable_jina_weights": true,
      "weight_baseline_mode": "mean",
      "weight_strength": 1,
      "mask_normalization": true
    },
    "class_type": "NewBieCLIPLoader"
  },
  // VAE 解码（放大后）
  "104:100": {
    "inputs": {
      "samples": ["94", 0],
      "vae": ["93:90", 0]
    },
    "class_type": "VAEDecode"
  },
  // VAE 编码（放大图像）
  "104:102": {
    "inputs": {
      "pixels": ["104:107", 0],
      "vae": ["93:90", 0]
    },
    "class_type": "VAEEncode"
  },
  // 使用模型放大图像
  "104:105": {
    "inputs": {
      "upscale_model": ["104:104", 0],
      "image": ["93:62", 0]
    },
    "class_type": "ImageUpscaleWithModel"
  },
  // 缩放图像（放大后缩回合适尺寸）
  "104:107": {
    "inputs": {
      "upscale_method": "lanczos",
      "scale_by": 0.38,
      "image": ["104:105", 0]
    },
    "class_type": "ImageScaleBy"
  },
  // 加载放大模型
  "104:104": {
    "inputs": {
      "model_name": "RealESRGAN_x4plus_anime_6B.pth"
    },
    "class_type": "UpscaleModelLoader"
  }
};

// 单独放大工作流模板 - 用于对已生成的图片进行放大
// 输入：图片 URL，输出：放大后的图片
export const UPSCALE_ONLY_WORKFLOW_TEMPLATE = {
  // 加载图片
  "1": {
    "inputs": {
      "image": "", // Will be filled with image path/filename
      "upload": "image"
    },
    "class_type": "LoadImage"
  },
  // 加载放大模型
  "2": {
    "inputs": {
      "model_name": "RealESRGAN_x4plus_anime_6B.pth"
    },
    "class_type": "UpscaleModelLoader"
  },
  // 使用模型放大图像
  "3": {
    "inputs": {
      "upscale_model": ["2", 0],
      "image": ["1", 0]
    },
    "class_type": "ImageUpscaleWithModel"
  },
  // 缩放到合适尺寸
  "4": {
    "inputs": {
      "upscale_method": "lanczos",
      "scale_by": 0.5, // 4x 放大后缩回 2x
      "image": ["3", 0]
    },
    "class_type": "ImageScaleBy"
  },
  // VAE Loader
  "5": {
    "inputs": {
      "vae_name": "diffusion_pytorch_model.safetensors"
    },
    "class_type": "VAELoader"
  },
  // VAE 编码
  "6": {
    "inputs": {
      "pixels": ["4", 0],
      "vae": ["5", 0]
    },
    "class_type": "VAEEncode"
  },
  // NewBie CLIP Loader
  "7": {
    "inputs": {
      "gemma_model_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/gemma3",
      "jina_clip_path": "/root/lanyun-tmp/newbie_project/ComfyUI-Newbie-V0.1/models/jina_clip",
      "device": "cuda",
      "dtype": "bf16",
      "cpu_offload": false,
      "enable_jina_weights": true,
      "weight_baseline_mode": "mean",
      "weight_strength": 1,
      "mask_normalization": true
    },
    "class_type": "NewBieCLIPLoader"
  },
  // 正向 Prompt
  "8": {
    "inputs": {
      "user_prompt": "", // Will be filled
      "system_prompt": SYSTEM_PROMPT_PREFIX,
      "use_chat_template": false,
      "clip": ["7", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // 负向 Prompt
  "9": {
    "inputs": {
      "user_prompt": NEGATIVE_PROMPT_DEFAULT,
      "system_prompt": NEGATIVE_SYSTEM_PROMPT,
      "use_chat_template": true,
      "clip": ["7", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  // Diffusion Model Loader
  "10": {
    "inputs": {
      "model_name": "NewBie-image-v0.1-exp-ep9.safetensors",
      "weight_dtype": "bf16",
      "compute_dtype": "default",
      "patch_cublaslinear": false,
      "sage_attention": "disabled",
      "enable_fp16_accumulation": true
    },
    "class_type": "DiffusionModelLoaderKJ"
  },
  // Model Sampling Newbie
  "11": {
    "inputs": {
      "shift": 6,
      "model": ["10", 0]
    },
    "class_type": "ModelSamplingNewbie"
  },
  // RescaleCFG
  "12": {
    "inputs": {
      "multiplier": 0.7,
      "model": ["11", 0]
    },
    "class_type": "RescaleCFG"
  },
  // KSampler - 重绘细节
  "13": {
    "inputs": {
      "seed": -1,
      "steps": 10,
      "cfg": 5,
      "sampler_name": "euler_ancestral",
      "scheduler": "linear_quadratic",
      "denoise": 0.4,
      "model": ["12", 0],
      "positive": ["8", 0],
      "negative": ["9", 0],
      "latent_image": ["6", 0]
    },
    "class_type": "KSampler"
  },
  // VAE 解码
  "14": {
    "inputs": {
      "samples": ["13", 0],
      "vae": ["5", 0]
    },
    "class_type": "VAEDecode"
  },
  // 保存图片
  "15": {
    "inputs": {
      "filename_prefix": "ComfyUI_upscaled",
      "images": ["14", 0]
    },
    "class_type": "SaveImage"
  }
};