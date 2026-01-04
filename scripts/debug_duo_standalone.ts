
// 独立调试脚本 - 直接构造工作流并发送请求

const COMFY_URL = "http://eb36d82cf7e2469bae5bbdd93a72a2b0.cloud.lanyun.net:18189";

// 完全复制 constants_duo.ts 的模板结构
const DUO_WORKFLOW_TEMPLATE = {
    "6": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {
            "ckpt_name": "oneObsession_v19.safetensors"
        }
    },
    "61": {
        "class_type": "ZmlPowerLoraLoader",
        "inputs": {
            "model": ["6", 0],
            "clip": ["6", 1],
            "lora_loader_data": "{\"entries\":[]}",
            "lora_names_hidden": ""
        }
    },
    "269": {
        "class_type": "ZML_PresetResolution",
        "inputs": {
            "预设": "SDXL_1024x1024",
            "互换宽高": false,
            "随机模式": false,
            "批次数量": 1
        }
    },
    "270": {
        "class_type": "ZML_MaskSplitNode",
        "inputs": {
            "宽度": ["269", 0],
            "高度": ["269", 1],
            "分割比例": 0.5,
            "分割方向": "竖"
        }
    },
    "67": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": "[AGM86997980], [ciloranko], [wlop], [dishwasher1910], [meion], (kuroduki \\(pieat\\)), [kousaki], [ask (askzy)], [Liduke], HDR, 8K, masterpiece, best quality, amazing quality, very aesthetic, detailed eyes, sharp eyes, realistic, (flat color:2.0), haiz ai, no lineart, no outline, Flat vector, (2girls:1.3), yuri, indoor, sitting"
        }
    },
    "36": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "masterpiece,best quality,newest,highres,absurdres,incredibly absurdres,very awa,very aesthetic,extreme aesthetic,detailed backgroud, finished,overlapping,appropriate posture,appropriate configuration,cropping,thick dense skin,ultra-precise skin,soft cheeks,"
        }
    },
    "34": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": ["67", 0],
            "文本2": ["61", 5],
            "文本3": ["36", 0],
            "格式化标点符号": true,
            "分隔符": ","
        }
    },
    "10": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["34", 0]
        }
    },
    "40": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "low quality, worst quality, normal quality, text, signature, jpeg artifacts, old, early, copyright name, watermark, artist name, logo, artist logo, patreon logo, blurry, cloned face, cropped, deformed, disfigured, error, out of frame, owres, poorly drawn face, username, furry girl, mole,\n"
        }
    },
    "39": {
        "class_type": "ZML_MultiTextInput3",
        "inputs": {
            "文本1": "",
            "文本2": ["40", 0],
            "格式化标点符号": true,
            "分隔符": ",",
            "文本3": ""
        }
    },
    "11": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["39", 0]
        }
    },
    "65": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "1girl, 1girl, solo, grey hair, medium hair, middle part, wavy ends, slender eyes, big breasts, red eyes, nail polish, nail art, blue nails, long legs"
        }
    },
    "62": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": "heads together, "
        }
    },
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
    "19": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["21", 0]
        }
    },
    "66": {
        "class_type": "ZML_TextInput",
        "inputs": {
            "文本": "1girl, 1girl,(blue hair),long hair,(blue eyes), smile,big breasts, gradient eyes,full body, long legs"
        }
    },
    "64": {
        "class_type": "ZML_PromptUINode",
        "inputs": {
            "positive_prompt": "heads together, "
        }
    },
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
    "25": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "clip": ["61", 1],
            "text": ["26", 0]
        }
    },
    "144": {
        "class_type": "Any Switch (rgthree)",
        "inputs": { "any_01": ["270", 0] }
    },
    "145": {
        "class_type": "Any Switch (rgthree)",
        "inputs": { "any_01": ["270", 1] }
    },
    "17": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["61", 0],
            "conditioning": ["10", 0],
            "mask": ["270", 4],
            "strength": 1
        }
    },
    "15": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["17", 0],
            "conditioning": ["19", 0],
            "mask": ["144", 0],
            "strength": 1
        }
    },
    "16": {
        "class_type": "DenseDiffusionAddCondNode",
        "inputs": {
            "model": ["15", 0],
            "conditioning": ["25", 0],
            "mask": ["145", 0],
            "strength": 1
        }
    },
    "18": {
        "class_type": "DenseDiffusionApplyNode",
        "inputs": {
            "model": ["16", 0]
        }
    },
    "9": {
        "class_type": "KSampler (Efficient)",
        "inputs": {
            "model": ["18", 0],
            "positive": ["18", 1],
            "negative": ["11", 0],
            "latent_image": ["269", 2],
            "optional_vae": ["6", 2],
            "seed": Math.floor(Math.random() * 1000000000000000),
            "steps": 30,
            "cfg": 4.5,
            "sampler_name": "euler_ancestral",
            "scheduler": "karras",
            "denoise": 1,
            "preview_method": "latent2rgb",
            "vae_decode": "true"
        }
    },
    "258": {
        "class_type": "SaveImage",
        "inputs": {
            "images": ["9", 5],
            "filename_prefix": "Duo_Debug"
        }
    }
};

async function main() {
    try {
        console.log("Sending request using DUO_WORKFLOW_TEMPLATE...");
        console.log("Payload (partial):", JSON.stringify(DUO_WORKFLOW_TEMPLATE["9"], null, 2));

        const response = await fetch(`${COMFY_URL}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: DUO_WORKFLOW_TEMPLATE })
        });

        if (!response.ok) {
            throw new Error(`Failed to queue: ${response.status} ${await response.text()}`);
        }

        const data = await response.json();
        console.log("Prompt ID:", data.prompt_id);
        console.log("Request sent. Monitor ComfyUI for execution.");
    } catch (error) {
        console.error("Failed:", error);
    }
}

main();
