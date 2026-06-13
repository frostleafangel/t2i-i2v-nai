
import { COMFY_API_URL_STANDARD } from "../constants";
import { DUO_WORKFLOW_TEMPLATE, SPLIT_DIRECTION_MAP } from "./constants_duo";
import { comfyFetch, comfyPost, comfyUpload } from "./comfyFetch";
import {
    DuoGenerationSettings,
    ComfyWorkflow,
    QueuePromptResponse,
    HistoryResponse,
    LoraConfig
} from "../types";

// Helper to deep clone the template
const getWorkflowTemplate = (): ComfyWorkflow => JSON.parse(JSON.stringify(DUO_WORKFLOW_TEMPLATE));

// 清理提示词格式：去除前导/尾随逗号、多余空格，防止 DenseDiffusion Tensor 维度不匹配
const cleanPrompt = (text: string): string => {
    return text
        .replace(/^[\s,]+/, '')  // 去除开头的空格和逗号
        .replace(/[\s,]+$/, '')  // 去除结尾的空格和逗号
        .replace(/\s*,\s*/g, ', ')  // 标准化逗号格式
        .replace(/,{2,}/g, ',')  // 去除连续逗号
        .trim();
};

// 构建 LoRA 数据 JSON
// ZmlPowerLoraLoader expects "lora_loader_data" as a JSON string with "entries" array.
const buildLoraData = (loras: LoraConfig[]): string => {
    const entries = loras.map((lora, index) => {
        // 如果 LORA 名称不包含路径分隔符，则添加 text2img/ 前缀
        // （显示时去掉了前缀，发送时需要加回来）
        const loraPath = lora.name.includes('/') ? lora.name : `text2img/${lora.name}`;
        return {
            id: `lora${index + 1}`,
            item_type: "lora",
            display_name: "",
            custom_text: "",
            lora_name: loraPath,
            weight: lora.strength,
            enabled: true,
            parent_id: null
        };
    });

    // 不再添加 "None" 条目 - 空数组可以正常工作
    // 添加 "None" 条目会导致 DenseDiffusion 的 Tensor 维度不匹配错误

    return JSON.stringify({ entries });
};

// 获取分辨率预设字符串
const getResolutionPreset = (width: number, height: number): string => {
    const presets: Record<string, string> = {
        '1024x1024': 'SDXL_1024x1024',
        '1216x832': 'SDXL_1216x832',
        '832x1216': 'SDXL_832x1216',
        '1344x768': 'SDXL_1344x768',
        '768x1344': 'SDXL_768x1344',
        '1536x640': 'SDXL_1536x640',
        '640x1536': 'SDXL_640x1536'
    };

    const key = `${width}x${height}`;
    return presets[key] || 'SDXL_1024x1024';
};

// 上传 mask 图片到 ComfyUI
const uploadMaskImage = async (base64Data: string): Promise<string> => {
    // 从 Base64 数据中提取实际的图片数据
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const binaryData = atob(base64Content);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    const fileName = `duo_mask_${Date.now()}.png`;
    const formData = new FormData();
    formData.append('image', blob, fileName);
    formData.append('overwrite', 'true');

    const response = await comfyUpload(`${COMFY_API_URL_STANDARD}/upload/image`, formData);

    if (!response.ok) {
        throw new Error(`Failed to upload mask image: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Duo] Mask image uploaded:', result);
    return result.name || fileName;
};

export const queueDuoGeneration = async (
    settings: DuoGenerationSettings
): Promise<string> => {
    const workflow = getWorkflowTemplate();

    // 1. 设置模型 (Node 6)
    workflow["6"].inputs.ckpt_name = settings.model;

    // 2. 设置 LoRA (Node 61)
    workflow["61"].inputs.lora_loader_data = buildLoraData(settings.loras);

    // 3. 处理分辨率 (替换 Node 269)
    // 原有的 Node 269 (ZML_PresetResolution) 不支持自定义分辨率，我们将其移除
    // 并使用标准的 EmptyLatentImage 节点替代
    delete workflow["269"];

    // 添加自定义 EmptyLatentImage 节点
    workflow["custom_latent"] = {
        class_type: "EmptyLatentImage",
        inputs: {
            width: settings.width,
            height: settings.height,
            batch_size: 1
        }
    };

    // 4. 更新相关节点连接
    // Node 9 (KSampler) - 连接到新的 latent
    workflow["9"].inputs.latent_image = ["custom_latent", 0];

    // 5. 处理 Mask - 自定义 Mask 或预设分割
    if (settings.useCustomMask && settings.customMaskData) {
        // 自定义 Mask 模式：使用 LoadImage + ZML_ColorToMask
        console.log("[Duo] Using custom mask mode");

        // 上传 mask 图片到 ComfyUI
        const maskFileName = await uploadMaskImage(settings.customMaskData);

        // 添加 LoadImage 节点加载 mask 图片
        workflow["custom_mask_loader"] = {
            class_type: "LoadImage",
            inputs: {
                image: maskFileName,
                upload: "image"
            }
        };

        // 添加 ZML_ColorToMask 节点将颜色转换为遮罩
        workflow["custom_color_to_mask"] = {
            class_type: "ZML_ColorToMask",
            inputs: {
                "图像": ["custom_mask_loader", 0],
                "颜色代码1": "#FF0000", // 红色 -> 角色A
                "颜色代码2": "#0000FF", // 蓝色 -> 角色B
                "颜色代码3": "#00FF00", // 绿色（占位，不使用）
                "容差": 10 // 降低容差以精确匹配颜色
            }
        };

        // 添加 SolidMask 作为全局遮罩（覆盖整个画布）
        workflow["custom_global_mask"] = {
            class_type: "SolidMask",
            inputs: {
                value: 1.0,
                width: settings.width,
                height: settings.height
            }
        };

        // 修改 DenseDiffusion 节点的 mask 输入源
        // 完全替换 144/145 的 inputs，避免残留对 270 的引用
        workflow["144"].inputs = {
            any_02: ["custom_color_to_mask", 0] // 红色 -> A
        };
        workflow["145"].inputs = {
            any_02: ["custom_color_to_mask", 1] // 蓝色 -> B
        };

        // Node 17 的全局 mask - 使用 SolidMask（覆盖整个画布）
        workflow["17"].inputs = {
            model: workflow["17"].inputs.model,
            conditioning: workflow["17"].inputs.conditioning,
            mask: ["custom_global_mask", 0],
            strength: workflow["17"].inputs.strength
        };

        // 删除预设分割节点和不再需要的节点
        delete workflow["270"];
        delete workflow["custom_solid_mask"];
        delete workflow["custom_mask_combine"];
    } else {
        // 预设 Mask 模式：使用 ZML_MaskSplitNode
        console.log("[Duo] Using preset split mode");

        // Node 270 (MaskSplitNode) - 直接传入宽/高数值
        workflow["270"].inputs["宽度"] = settings.width;
        workflow["270"].inputs["高度"] = settings.height;
        workflow["270"].inputs["分割比例"] = settings.splitRatio;
        workflow["270"].inputs["分割方向"] = SPLIT_DIRECTION_MAP[settings.splitDirection] || "竖";

        // 调试日志
        console.log("[Duo] Node 270 inputs:", JSON.stringify(workflow["270"].inputs));
        console.log("[Duo] Node 144 inputs:", JSON.stringify(workflow["144"].inputs));
        console.log("[Duo] Node 145 inputs:", JSON.stringify(workflow["145"].inputs));
        console.log("[Duo] Node 17 mask:", JSON.stringify(workflow["17"].inputs.mask));
    }

    // 5. 设置主体提示词
    // Node 67 (ZML_PromptUINode)
    workflow["67"].inputs.positive_prompt = settings.mainPrompt || "";

    // Node 36 (ZML_TextInput) - 质量词 (前置提示词)
    // 如果用户输入了前置提示词，则使用用户输入；否则使用默认值
    if (settings.qualityPrompt !== undefined) {
        workflow["36"].inputs["文本"] = settings.qualityPrompt;
    }

    // 6. 设置角色A提示词
    // Node 65 (ZML_TextInput) - 角色A 外貌细节 (Details)
    // Node 62 (ZML_PromptUINode) - 角色A 动作 (Prompt)
    // Node 21 将它们组合: 62(Action) + 65(Details)

    const charADetails = settings.characterADetails || "";
    workflow["65"].inputs["文本"] = charADetails;

    const charAPrompt = settings.characterAPrompt || "";
    workflow["62"].inputs.positive_prompt = charAPrompt;

    // 7. 设置角色B提示词
    // Node 66 (ZML_TextInput) - 角色B 外貌细节 (Details)
    // Node 64 (ZML_PromptUINode) - 角色B 动作 (Prompt)

    const charBDetails = settings.characterBDetails || "";
    workflow["66"].inputs["文本"] = charBDetails;

    const charBPrompt = settings.characterBPrompt || "";
    workflow["64"].inputs.positive_prompt = charBPrompt;

    // 8. 设置负面提示词
    // 重要：DenseDiffusion 对负面提示词长度/内容极度敏感。
    // 经测试发现：合并用户负面+预设负面会导致 Tensor 维度不匹配，但用户单独的负面提示词可以工作。
    // 解决方案：如果用户输入了负面提示词，则完全替换 Node 40 内容（不合并预设）；否则使用预设。
    // 2025-01-02：添加 cleanPrompt 清理前导/尾随逗号，防止因格式问题导致 Tensor 维度不匹配
    const userNegative = cleanPrompt(settings.negativePrompt || "");
    if (userNegative) {
        // 用户有输入，替换预设负面（末尾加换行符以匹配原始格式）
        workflow["40"].inputs["文本"] = userNegative + "\n";
    }
    // 如果用户没有输入，Node 40 保持模板中的预设负面
    // Node 39.文本1 保持模板中的空字符串

    // 13. 设置主采样器参数 (Node 9)
    workflow["9"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
    workflow["9"].inputs.steps = settings.steps;
    workflow["9"].inputs.cfg = settings.cfg;
    workflow["9"].inputs.sampler_name = settings.sampler;
    workflow["9"].inputs.scheduler = settings.scheduler;

    // 处理放大设置
    if (!settings.enableUpscale) {
        delete workflow["501"]; // UpscaleModelLoader
        delete workflow["502"]; // UltimateSDUpscale
        delete workflow["503"]; // SaveImage
        delete workflow["504"]; // ImageScale
        delete workflow["505"]; // VAEEncode
        delete workflow["506"]; // KSampler
        delete workflow["507"]; // VAEDecode
        delete workflow["508"]; // SaveImage
    } else {
        // 502. UltimateSDUpscale 设置
        workflow["502"].inputs.upscale_by = settings.upscaleFactor;
        workflow["502"].inputs.denoise = settings.upscaleDenoise;
        workflow["502"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
        workflow["502"].inputs.steps = settings.upscaleSteps || 20;
        workflow["502"].inputs.cfg = settings.upscaleCfg || 4.5;
        workflow["502"].inputs.sampler_name = settings.upscaleSampler || "res_multistep";
        workflow["502"].inputs.scheduler = settings.upscaleScheduler || "exponential";

        // 处理二次放大
        if (!settings.enableSecondUpscale) {
            delete workflow["504"];
            delete workflow["505"];
            delete workflow["506"];
            delete workflow["507"];
            delete workflow["508"];
        } else {
            // 计算二次放大目标分辨率
            const firstUpscaleWidth = Math.round(settings.width * settings.upscaleFactor);
            const firstUpscaleHeight = Math.round(settings.height * settings.upscaleFactor);
            const secondUpscaleWidth = Math.round(firstUpscaleWidth * settings.secondUpscaleFactor);
            const secondUpscaleHeight = Math.round(firstUpscaleHeight * settings.secondUpscaleFactor);

            workflow["504"].inputs.width = secondUpscaleWidth;
            workflow["504"].inputs.height = secondUpscaleHeight;

            workflow["506"].inputs.seed = Math.floor(Math.random() * 1000000000000000);
            workflow["506"].inputs.steps = settings.secondUpscaleSteps || 20;
            workflow["506"].inputs.cfg = settings.secondUpscaleCfg || 4.5;
            workflow["506"].inputs.denoise = settings.secondUpscaleDenoise || 0.15;
            workflow["506"].inputs.sampler_name = settings.secondUpscaleSampler || "res_multistep";
            workflow["506"].inputs.scheduler = settings.secondUpscaleScheduler || "exponential";
        }
    }

    const payload = { prompt: workflow };

    // DEBUG: Log the full payload being sent
    console.log("=== DUO GENERATION DEBUG ===");
    console.log("Settings received:", JSON.stringify(settings, null, 2));
    console.log("Workflow payload:", JSON.stringify(payload, null, 2));
    console.log("=== END DEBUG ===");

    const response = await comfyPost(`${COMFY_API_URL_STANDARD}/prompt`, payload);

    if (!response.ok) {
        throw new Error(`Failed to queue generation: ${response.statusText}`);
    }

    const data: QueuePromptResponse = await response.json();
    return data.prompt_id;
};


export const checkDuoGenerationStatus = async (
    promptId: string
): Promise<{
    status: 'pending' | 'completed' | 'failed' | 'not_found';
    imageUrl?: string;
    progress?: number;
    isUpscaled?: boolean;
}> => {
    try {
        const response = await comfyFetch(`${COMFY_API_URL_STANDARD}/history/${promptId}`);
        if (response.ok) {
            const historyData: HistoryResponse = await response.json();
            const history = historyData[promptId];

            if (history) {
                if (history.status && history.status.status_str === 'error') {
                    console.error("Duo generation failed:", history.status);
                    return { status: 'failed' };
                }

                if (history.outputs) {
                    // Check for Secondary Upscale Output first
                    if (history.outputs["508"] && history.outputs["508"].images && history.outputs["508"].images.length > 0) {
                        const image = history.outputs["508"].images[0];
                        const imageUrl = `${COMFY_API_URL_STANDARD}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                        return { status: 'completed', imageUrl, isUpscaled: true };
                    }

                    // Check for Primary Upscale Output
                    if (history.outputs["503"] && history.outputs["503"].images && history.outputs["503"].images.length > 0) {
                        const image = history.outputs["503"].images[0];
                        const imageUrl = `${COMFY_API_URL_STANDARD}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                        return { status: 'completed', imageUrl, isUpscaled: true };
                    }

                    // Check for Base Generation Output (Node 258)
                    if (history.outputs["258"] && history.outputs["258"].images && history.outputs["258"].images.length > 0) {
                        const image = history.outputs["258"].images[0];
                        const imageUrl = `${COMFY_API_URL_STANDARD}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                        return { status: 'completed', imageUrl, isUpscaled: false };
                    }

                    // Fallback to Verified Node 9 output if SavedImage fails? 
                    // Wait, SaveImage 258 is connected to 9.
                }
            }
        }

        // Check queue if not found in history
        const queueResponse = await comfyFetch(`${COMFY_API_URL_STANDARD}/queue`);
        if (queueResponse.ok) {
            const queueData = await queueResponse.json();
            const pendingParams = queueData.queue_pending;
            const runningParams = queueData.queue_running;

            const inPending = pendingParams.some((item: any) => item[1] === promptId);
            const inRunning = runningParams.some((item: any) => item[1] === promptId);

            if (inPending || inRunning) {
                return { status: 'pending' };
            }
        }

        return { status: 'not_found' };
    } catch (error) {
        console.error("Error checking generation status:", error);
        return { status: 'not_found' };
    }
};
