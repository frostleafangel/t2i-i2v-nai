
import { queueDuoGeneration } from '../services/duoComfyService';
import { DuoGenerationSettings } from '../types';

// 模拟验证脚本使用的固定参数
const testSettings: DuoGenerationSettings = {
    model: "oneObsession_v19.safetensors",
    loras: [],
    characterAPrompt: "",
    characterADetails: "1girl, solo, grey hair, medium hair, middle part, wavy ends, slender eyes, big breasts, red eyes, nail polish, nail art, blue nails, long legs",
    characterBPrompt: "",
    characterBDetails: "1girl,(blue hair),long hair,(blue eyes), smile,big breasts, gradient eyes,full body, long legs",
    mainPrompt: "[AGM86997980], [ciloranko], [wlop], [dishwasher1910], [meion], (kuroduki \\(pieat\\)), [kousaki], [ask (askzy)], [Liduke], HDR, 8K, masterpiece, best quality, amazing quality, very aesthetic, detailed eyes, sharp eyes, realistic, (flat color:2.0), haiz ai, no lineart, no outline, Flat vector, (2girls:1.3), yuri, indoor, sitting",
    negativePrompt: "",
    splitRatio: 0.5,
    splitDirection: 'vertical',
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    sampler: "euler_ancestral",
    scheduler: "karras",
    enableUpscale: false,
    upscaleFactor: 1.25,
    upscaleDenoise: 0.15,
    upscaleSteps: 20,
    upscaleCfg: 4.5,
    upscaleSampler: "res_multistep",
    upscaleScheduler: "exponential",
    enableSecondUpscale: false,
    secondUpscaleFactor: 1.1,
    secondUpscaleDenoise: 0.15,
    secondUpscaleSteps: 20,
    secondUpscaleCfg: 4.5,
    secondUpscaleSampler: "res_multistep",
    secondUpscaleScheduler: "exponential"
};

async function main() {
    try {
        console.log("Sending test generation request...");
        const promptId = await queueDuoGeneration(testSettings);
        console.log("Prompt ID:", promptId);
        console.log("Request sent successfully. Check ComfyUI for execution status.");
    } catch (error) {
        console.error("Failed:", error);
    }
}

main();
