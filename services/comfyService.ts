import { COMFY_API_URL, WORKFLOW_TEMPLATE, UPSCALE_WORKFLOW_TEMPLATE, UPSCALE_ONLY_WORKFLOW_TEMPLATE } from "../constants";
import { GenerationSettings, QueuePromptResponse, HistoryResponse, ComfyWorkflow } from "../types";

// Helper to deep clone the template
const getWorkflowTemplate = (): ComfyWorkflow => JSON.parse(JSON.stringify(WORKFLOW_TEMPLATE));
const getUpscaleWorkflowTemplate = (): ComfyWorkflow => JSON.parse(JSON.stringify(UPSCALE_WORKFLOW_TEMPLATE));
const getUpscaleOnlyWorkflowTemplate = (): ComfyWorkflow => JSON.parse(JSON.stringify(UPSCALE_ONLY_WORKFLOW_TEMPLATE));

export const queueGeneration = async (
  positiveXml: string, 
  settings: GenerationSettings
): Promise<string> => {
  const workflow = getWorkflowTemplate();

  // 1. Set Positive Prompt (Node 5 - NewBieCLIPTextEncode)
  // user_prompt field contains the XML prompt, system_prompt is already set in template
  if (workflow["5"]) {
    workflow["5"].inputs.user_prompt = positiveXml;
  }

  // 2. Set Latent Size (Node 7 - EmptyLatentImage)
  if (workflow["7"]) {
    workflow["7"].inputs.width = settings.width;
    workflow["7"].inputs.height = settings.height;
  }

  // 3. Set Negative Prompt (Node 6 - NewBieCLIPTextEncode)
  if (workflow["6"] && settings.negativePrompt) {
    workflow["6"].inputs.user_prompt = settings.negativePrompt;
  }

  // 4. Set Sampler Settings (Node 4 - KSampler)
  if (workflow["4"]) {
    workflow["4"].inputs.steps = settings.steps;
    workflow["4"].inputs.cfg = settings.cfg;
    workflow["4"].inputs.sampler_name = settings.sampler_name;
    workflow["4"].inputs.scheduler = settings.scheduler;

    // Seed
    if (settings.seed === -1) {
      workflow["4"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
    } else {
      workflow["4"].inputs.seed = settings.seed;
    }
  }

  // 3. Send to API
  try {
    const response = await fetch(`${COMFY_API_URL}/prompt`, {
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
    console.error("Failed to queue prompt:", err);
    throw err;
  }
};

export interface QueueStatus {
  queueRunning: number;  // 正在生成的任务数
  queuePending: number;  // 排队等待的任务数
}

export const getQueueStatus = async (): Promise<QueueStatus | null> => {
  try {
    const response = await fetch(`${COMFY_API_URL}/queue`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      queueRunning: data.queue_running?.length || 0,
      queuePending: data.queue_pending?.length || 0
    };
  } catch (err) {
    console.error("Failed to get queue status:", err);
    return null;
  }
};

export type GenerationStatusResult = 
  | { status: 'completed'; imageUrl: string }
  | { status: 'pending' }
  | { status: 'not_found' }
  | { status: 'error' };

export const checkGenerationStatus = async (promptId: string): Promise<string | null> => {
  const result = await checkGenerationStatusDetailed(promptId);
  if (result.status === 'completed') return result.imageUrl;
  return null;
};

export const checkGenerationStatusDetailed = async (promptId: string): Promise<GenerationStatusResult> => {
  try {
    const response = await fetch(`${COMFY_API_URL}/history/${promptId}`);
    if (!response.ok) return { status: 'error' };

    const data: HistoryResponse = await response.json();
    
    // 如果 history 中有这个任务
    if (data[promptId]) {
      if (data[promptId].status.completed) {
        // Find the image output
        const outputs = data[promptId].outputs;
        // Node 21 is our SaveImage node
        if (outputs["21"] && outputs["21"].images.length > 0) {
          const img = outputs["21"].images[0];
          return { 
            status: 'completed', 
            imageUrl: `${COMFY_API_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}` 
          };
        }
      }
      return { status: 'pending' };
    }
    
    // history 中没有，检查队列中是否有这个任务
    const queueResponse = await fetch(`${COMFY_API_URL}/queue`);
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      const running = queueData.queue_running || [];
      const pending = queueData.queue_pending || [];
      
      // 检查是否在运行队列或等待队列中
      // ComfyUI 队列格式: [[number, prompt_id, {...}, {...}], ...]
      const inQueue = [...running, ...pending].some((item: any) => {
        if (Array.isArray(item)) {
          return item.includes(promptId);
        }
        return item === promptId || item?.prompt_id === promptId;
      });
      
      if (inQueue) {
        return { status: 'pending' };
      }
    }
    
    // 既不在 history 也不在队列中，任务真的丢失了
    return { status: 'not_found' };
  } catch (err) {
    console.error("Polling error:", err);
    return { status: 'error' };
  }
};

// ============ 放大功能相关 ============

// 使用放大工作流生成图片（生成+放大一体化）
export const queueGenerationWithUpscale = async (
  positiveXml: string,
  settings: GenerationSettings
): Promise<string> => {
  const workflow = getUpscaleWorkflowTemplate();

  // 1. Set Positive Prompt (Node 28)
  if (workflow["28"]) {
    workflow["28"].inputs.user_prompt = positiveXml;
  }

  // 2. Set Resolution (Node 51)
  if (workflow["51"]) {
    workflow["51"].inputs.width = settings.width;
    workflow["51"].inputs.height = settings.height;
  }

  // 3. Set Negative Prompt (Node 93:87)
  if (workflow["93:87"] && settings.negativePrompt) {
    workflow["93:87"].inputs.user_prompt = settings.negativePrompt;
  }

  // 4. Set First Stage Sampler Settings (Node 3)
  if (workflow["3"]) {
    workflow["3"].inputs.steps = settings.steps;
    workflow["3"].inputs.cfg = settings.cfg;
    workflow["3"].inputs.sampler_name = settings.sampler_name;
    workflow["3"].inputs.scheduler = settings.scheduler;
  }

  // 5. Set Seed (Node 86)
  if (workflow["86"]) {
    if (settings.seed === -1) {
      workflow["86"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
    } else {
      workflow["86"].inputs.seed = settings.seed;
    }
  }

  // 6. Send to API
  try {
    const response = await fetch(`${COMFY_API_URL}/prompt`, {
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
    console.error("Failed to queue upscale generation:", err);
    throw err;
  }
};

// 检查放大工作流的生成状态（输出节点是 146）
export const checkUpscaleGenerationStatus = async (promptId: string): Promise<string | null> => {
  const result = await checkUpscaleGenerationStatusDetailed(promptId);
  if (result.status === 'completed') return result.imageUrl;
  return null;
};

export const checkUpscaleGenerationStatusDetailed = async (promptId: string): Promise<GenerationStatusResult> => {
  try {
    const response = await fetch(`${COMFY_API_URL}/history/${promptId}`);
    if (!response.ok) return { status: 'error' };

    const data: HistoryResponse = await response.json();
    
    if (data[promptId]) {
      if (data[promptId].status.completed) {
        const outputs = data[promptId].outputs;
        // Node 146 is the final SaveImage node for upscaled output
        if (outputs["146"] && outputs["146"].images.length > 0) {
          const img = outputs["146"].images[0];
          return { 
            status: 'completed', 
            imageUrl: `${COMFY_API_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}` 
          };
        }
      }
      return { status: 'pending' };
    }
    
    // 检查队列
    const queueResponse = await fetch(`${COMFY_API_URL}/queue`);
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      const running = queueData.queue_running || [];
      const pending = queueData.queue_pending || [];
      
      const inQueue = [...running, ...pending].some((item: any) => {
        if (Array.isArray(item)) {
          return item.includes(promptId);
        }
        return item === promptId || item?.prompt_id === promptId;
      });
      
      if (inQueue) {
        return { status: 'pending' };
      }
    }
    
    return { status: 'not_found' };
  } catch (err) {
    console.error("Upscale polling error:", err);
    return { status: 'error' };
  }
};

// 上传图片到 ComfyUI
export const uploadImageToComfy = async (imageUrl: string): Promise<string> => {
  try {
    // 1. 从 URL 获取图片
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image');
    }
    const imageBlob = await imageResponse.blob();
    
    // 2. 创建 FormData
    const formData = new FormData();
    const filename = `upload_${Date.now()}.png`;
    formData.append('image', imageBlob, filename);
    formData.append('overwrite', 'true');
    
    // 3. 上传到 ComfyUI
    const uploadResponse = await fetch(`${COMFY_API_URL}/upload/image`, {
      method: 'POST',
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }
    
    const result = await uploadResponse.json();
    return result.name; // 返回上传后的文件名
  } catch (err) {
    console.error("Failed to upload image:", err);
    throw err;
  }
};

// 单独放大已有图片
export const queueUpscaleOnly = async (
  imageFilename: string,
  prompt: string,
  negativePrompt?: string
): Promise<string> => {
  const workflow = getUpscaleOnlyWorkflowTemplate();

  // 1. Set image filename (Node 1)
  if (workflow["1"]) {
    workflow["1"].inputs.image = imageFilename;
  }

  // 2. Set Positive Prompt (Node 8)
  if (workflow["8"]) {
    workflow["8"].inputs.user_prompt = prompt;
  }

  // 3. Set Negative Prompt (Node 9)
  if (workflow["9"] && negativePrompt) {
    workflow["9"].inputs.user_prompt = negativePrompt;
  }

  // 4. Set random seed (Node 13)
  if (workflow["13"]) {
    workflow["13"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
  }

  // 5. Send to API
  try {
    const response = await fetch(`${COMFY_API_URL}/prompt`, {
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
    console.error("Failed to queue upscale only:", err);
    throw err;
  }
};

// 检查单独放大的状态（输出节点是 15）
export const checkUpscaleOnlyStatus = async (promptId: string): Promise<string | null> => {
  const result = await checkUpscaleOnlyStatusDetailed(promptId);
  if (result.status === 'completed') return result.imageUrl;
  return null;
};

export const checkUpscaleOnlyStatusDetailed = async (promptId: string): Promise<GenerationStatusResult> => {
  try {
    const response = await fetch(`${COMFY_API_URL}/history/${promptId}`);
    if (!response.ok) return { status: 'error' };

    const data: HistoryResponse = await response.json();
    
    if (data[promptId]) {
      if (data[promptId].status.completed) {
        const outputs = data[promptId].outputs;
        // Node 15 is the SaveImage node for upscale-only workflow
        if (outputs["15"] && outputs["15"].images.length > 0) {
          const img = outputs["15"].images[0];
          return { 
            status: 'completed', 
            imageUrl: `${COMFY_API_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}` 
          };
        }
      }
      return { status: 'pending' };
    }
    
    // 检查队列
    const queueResponse = await fetch(`${COMFY_API_URL}/queue`);
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      const running = queueData.queue_running || [];
      const pending = queueData.queue_pending || [];
      
      const inQueue = [...running, ...pending].some((item: any) => {
        if (Array.isArray(item)) {
          return item.includes(promptId);
        }
        return item === promptId || item?.prompt_id === promptId;
      });
      
      if (inQueue) {
        return { status: 'pending' };
      }
    }
    
    return { status: 'not_found' };
  } catch (err) {
    console.error("Upscale only polling error:", err);
    return { status: 'error' };
  }
};