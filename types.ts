export enum GenerationStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  QUEUED = 'QUEUED',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string; // 负面提示词
  timestamp: number;
  width?: number;
  height?: number;
  seed?: number;
  isUpscaled?: boolean; // 是否是放大后的图片
  hasUpscaledVersion?: boolean; // 原图是否已有放大版本（用于隐藏放大按钮）
  originalId?: string; // 如果是放大图，指向原图 ID
  metadata?: any; // 额外的生成元数据（如 NovelAI 参数）
  source?: 'comfyui' | 'novelai' | 'duo';
  isShared?: boolean; // 是否已分享到画廊
}

export interface GenerationSettings {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number; // -1 for random
  sampler_name: string;
  scheduler: string;
  negativePrompt: string;
  enableUpscale: boolean; // 是否启用自动放大
}

// Builder Types
export interface CharacterPrompt {
  id: string;
  n: string;
  gender: string;
  appearance: string;
  clothing: string;
  expression: string;
  action: string;
  position: string;
}

export interface GeneralPrompt {
  count: string;
  style: string;
  background: string;
  lighting: string;
  atmosphere: string;
  quality: string;
  objects: string;
  other: string;
  caption: string;
}

// ComfyUI API Types
export interface ComfyNode {
  inputs: Record<string, any>;
  class_type: string;
  _meta?: {
    title?: string;
  };
}

// Standard Mode Types
export interface LoraConfig {
  name: string;
  strength: number;
}

export interface StandardGenerationSettings {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  sampler_name: string;
  scheduler: string;
  model: string;
  loras: LoraConfig[];
  // 三段式提示词
  prefixPrompt: string; // 前置提示词（质量词/画风）
  positivePrompt: string; // 主提示词（用户主要内容）
  suffixPrompt: string; // 后置提示词（附加修饰）
  negativePrompt: string;
  enableUpscale: boolean;
  // 一次放大设置
  upscaleBy: number; // 1-2 倍
  upscaleDenoise: number; // 0-1
  upscaleSteps: number; // 10-40
  upscaleCfg: number; // 1-10
  upscaleSampler: string;
  upscaleScheduler: string;
  // 二次放大设置
  enableSecondUpscale: boolean;
  secondUpscaleBy: number; // 1-1.25 倍
  secondUpscaleDenoise: number; // 0.2-0.4
  secondUpscaleSteps: number; // 10-40
  secondUpscaleCfg: number; // 1-10
  secondUpscaleSampler: string;
  secondUpscaleScheduler: string;
  // FaceDetailer 设置
  enableFaceDetailer: boolean;
  faceDetectorModel: string; // 检测器模型
}

// 双人模式生成设置
export interface DuoGenerationSettings {
  // 基础设置
  model: string;
  loras: LoraConfig[];

  // 角色A提示词
  characterAPrompt: string;      // 角色A动作
  characterADetails: string;     // 角色A特征（外貌等）

  // 角色B提示词
  characterBPrompt: string;      // 角色B动作
  characterBDetails: string;     // 角色B特征

  // 主体/共享提示词
  mainPrompt: string;            // 场景/环境描述
  qualityPrompt: string;         // 质量词+画风(Node 36)
  negativePrompt: string;

  // 分区设置
  splitRatio: number;            // 分割比例（0.3-0.7）
  splitDirection: 'vertical' | 'horizontal' | 'diagonal';

  // 自定义 Mask 设置
  useCustomMask: boolean;        // 是否使用手绘 Mask
  customMaskData?: string;       // Base64 编码的 PNG 图片数据

  // 画布设置
  width: number;
  height: number;

  // 采样设置
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;

  // 一次放大设置
  enableUpscale: boolean;
  upscaleFactor: number;
  upscaleDenoise: number;
  upscaleSteps: number;
  upscaleCfg: number;
  upscaleSampler: string;
  upscaleScheduler: string;

  // 二次放大设置
  enableSecondUpscale: boolean;
  secondUpscaleFactor: number;
  secondUpscaleDenoise: number;
  secondUpscaleSteps: number;
  secondUpscaleCfg: number;
  secondUpscaleSampler: string;
  secondUpscaleScheduler: string;
}

export interface ComfyObjectInfo {
  [nodeName: string]: {
    input: {
      required: Record<string, any[]>;
    };
    output: string[];
    output_name: string[];
    name: string;
    display_name: string;
    description: string;
    category: string;
    output_node: boolean;
  };
}

export interface ComfyWorkflow {
  [nodeId: string]: ComfyNode;
}

export interface QueuePromptResponse {
  prompt_id: string;
  number: number;
  node_errors: any;
}

// Style Management Types
export interface StyleConfig {
  model: string;
  loras: LoraConfig[];
  prefixPrompt: string;
  positivePrompt: string;
  suffixPrompt: string;
  negativePrompt: string;
  type?: 'comfyui' | 'novelai';
  novelai_settings?: Partial<NovelAISettings>;
}

export interface NovelAISettings {
  width: number;
  height: number;
  scale: number;
  sampler: string;
  steps: number;
  seed: number;
  n_samples: number;
  ucPreset: number;
  qualityToggle: boolean;
  uc?: string;
  // NAI4 specific
  v4_prompt?: any;
  v4_negative_prompt?: any;
  characterPrompts?: any[];
  use_coords?: boolean;
  reference_image?: string;
  reference_information_extracted?: number;
  reference_strength?: number;
  // Vibe Transfer
  reference_image_multiple?: string[];
  reference_information_extracted_multiple?: number[];
  reference_strength_multiple?: number[];
  // Other params
  sm?: boolean;
  sm_dyn?: boolean;
  dynamic_thresholding?: boolean;
  controlnet_strength?: number;
  legacy_v3_extend?: boolean;
  add_original_image?: boolean;
  cfg_rescale?: number;
  noise_schedule?: string;
  image?: string; // for img2img
  strength?: number; // for img2img
  extra_novelai_parameters?: any;
}

export interface Style {
  id: number;
  name: string;
  description: string;
  cover_image_url: string;
  config: StyleConfig;
  is_public: number;
  likes_count: number;
  is_liked?: boolean;
  author?: string;
  created_at: string;
}

export interface HistoryResponse {
  [prompt_id: string]: {
    status: {
      status_str: string;
      completed: boolean;
      messages: any[];
    };
    outputs: {
      [node_id: string]: {
        images: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

export type UCPreset = 'Heavy' | 'Light' | 'None' | 'Human Focus';
export type NoiseSchedule = 'native' | 'karras' | 'exponential' | 'polyexponential';
export type NAI4AqtPreset = 'safe' | 'nai' | 'full' | 'balanced' | 'anime' | 'furry' | 'pony';

export interface CharacterPromptConfig {
  displayName: string;
  characterPrompt: string;
  characterNegativePrompt?: string;
  coords?: { x: number; y: number }; // 5x5 grid (0-4)
}

export interface VibeReference {
  id: string;
  name: string;
  vibeData: string; // Base64 encoded
  informationExtracted: number; // 0-1
  strength: number; // 0-1
  previewUrl?: string; // Temporary blob URL (lost on refresh)
  thumbnail?: string; // Persistent base64 thumbnail (survives refresh)
}

export interface NovelAIGenerationSettings {
  // Basic
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  sampler: string;
  model: string;

  // Prompts
  prefixPrompt: string;
  positivePrompt: string;
  suffixPrompt: string;
  negativePrompt: string;
  ucPreset: UCPreset;

  // AI Core Parameters
  cfgRescale: number;
  noiseSchedule: NoiseSchedule;
  dynamicThresholding: boolean;

  // NAI3 Specific
  sm: boolean;
  sm_dyn: boolean;

  // NAI4 Specific
  aqtPreset: NAI4AqtPreset;
  divideRoles: boolean;
  characterPrompts: CharacterPromptConfig[];
  useAutoPositioning: boolean;

  // Advanced
  varietyPlus: boolean;
  legacy: boolean;
  legacyV3Extend: boolean;
  controlnetStrength: number;

  // Vibe Transfer
  vibeReferences: VibeReference[];
}

// Video Generation Types (图生视频)
export interface VideoGenerationSettings {
  positivePrompt: string;
  negativePrompt: string;
  duration: number;        // 秒数 (1-8)
  frameRate: number;       // 帧率 (16 或 24)
  seed: number;            // 随机种子 (-1 为随机)
  steps: number;           // 采样步数 (2-8)
  cfg: number;             // CFG 值 (1-3)
  crf: number;             // 视频质量 CRF (10-40, 越小质量越高)
  refinerStep: number;     // 精炼步数
  shiftHigh: number;       // Sigma 偏移 (高噪声)
  shiftLow: number;        // Sigma 偏移 (低噪声)
  samplerName: string;
  scheduler: string;
  loras?: LoraConfig[];    // LORA（同时应用到HIGH和LOW模型）
}

export interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  timestamp: number;
  duration: number;        // 视频时长（秒）
  frameRate: number;
  thumbnailUrl?: string;   // 视频缩略图
  firstFrameUrl?: string;  // 首帧图片 URL
  lastFrameUrl?: string;   // 尾帧图片 URL（用于接续生成）
  isShared?: boolean;      // 是否已分享到画廊
}