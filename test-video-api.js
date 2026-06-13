/**
 * 图生视频 API 测试脚本
 * 测试 WAN 2.2 I2V 工作流
 * 
 * 使用方法:
 *   COMFY_URL=http://localhost:8188 node test-video-api.js
 *   
 * 如果有 CF Access 认证:
 *   CF_ACCESS_CLIENT_ID=xxx CF_ACCESS_CLIENT_SECRET=xxx COMFY_URL=xxx node test-video-api.js
 */

// ComfyUI API 地址
const COMFY_API_URL = process.env.COMFY_URL || 'http://localhost:8188';

// CF Access 认证（可选）
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || '';
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || '';

console.log(`\n🔧 ComfyUI API: ${COMFY_API_URL}`);
console.log(`🔐 CF Access: ${CF_ACCESS_CLIENT_ID ? '已配置' : '未配置'}\n`);

// 获取认证 headers
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
        headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
        headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
    }
    return headers;
}

// 默认负面提示词
const DEFAULT_VIDEO_NEGATIVE_PROMPT = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走";

// 视频生成工作流
function createVideoWorkflow(settings) {
    const seed = settings.seed === -1
        ? Math.floor(Math.random() * 1000000000000000)
        : settings.seed;

    const filename_prefix = `video/${new Date().toISOString().split('T')[0]}/test_${Date.now()}`;

    return {
        "422": {
            "inputs": {
                "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
                "➕ Add Lora": "",
                "model": ["911:426", 0]
            },
            "class_type": "Power Lora Loader (rgthree)",
            "_meta": { "title": "Loras LOW" }
        },
        "436": {
            "inputs": {
                "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
                "➕ Add Lora": "",
                "model": ["911:425", 0],
                "clip": ["911:1033", 0]
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
            "_meta": { "title": "Prune Outputs" }
        },
        "958": {
            "inputs": {
                "frame_rate": ["911:457", 0],
                "loop_count": 0,
                "filename_prefix": filename_prefix,
                "format": "video/h265-mp4",
                "pix_fmt": "yuv420p10le",
                "crf": 20,
                "save_metadata": true,
                "pingpong": false,
                "save_output": true,
                "images": ["911:997", 0]
            },
            "class_type": "VHS_VideoCombine",
            "_meta": { "title": "Video Combine" }
        },
        "959": {
            "inputs": { "image": settings.firstFrameImage },
            "class_type": "LoadImage",
            "_meta": { "title": "首帧图像" }
        },
        "960": {
            "inputs": { "image": "example.png" },
            "class_type": "LoadImage",
            "_meta": { "title": "末帧图像" }
        },
        "911:1008": {
            "inputs": { "value": true },
            "class_type": "PrimitiveBoolean"
        },
        "911:1018": {
            "inputs": { "value": false },
            "class_type": "PrimitiveBoolean"
        },
        "911:997": {
            "inputs": {
                "boolean": ["911:1019", 0],
                "on_true": ["911:1072:204", 0],
                "on_false": ["911:1003", 0]
            },
            "class_type": "easy ifElse"
        },
        "911:1045": {
            "inputs": {
                "text": settings.negativePrompt || DEFAULT_VIDEO_NEGATIVE_PROMPT,
                "clip": ["436", 1]
            },
            "class_type": "CLIPTextEncode",
            "_meta": { "title": "负面提示词" }
        },
        "911:1032": {
            "inputs": { "vae_name": "wan_2.1_vae.safetensors" },
            "class_type": "VAELoader"
        },
        "911:1033": {
            "inputs": {
                "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
                "type": "wan",
                "device": "default"
            },
            "class_type": "CLIPLoader"
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
            "class_type": "Display Any (rgthree)"
        },
        "911:1019": {
            "inputs": { "any_02": ["911:1018", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:1003": {
            "inputs": {
                "boolean": ["911:1016", 0],
                "on_true": ["911:1028", 0],
                "on_false": ["911:1029", 0]
            },
            "class_type": "easy ifElse"
        },
        "911:1020": {
            "inputs": { "output": "", "source": ["911:1016", 0] },
            "class_type": "Display Any (rgthree)"
        },
        "911:1029": {
            "inputs": {},
            "class_type": "Any Switch (rgthree)"
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
            "class_type": "VAEDecode"
        },
        "911:960": {
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
        "911:1016": {
            "inputs": { "any_01": ["911:1008", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:1028": {
            "inputs": { "any_01": ["911:963", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:1041": {
            "inputs": { "any_01": ["911:1037", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:1043": {
            "inputs": { "any_01": ["911:1042", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:425": {
            "inputs": {
                "shift": settings.shift || 5,
                "model": ["911:1041", 0]
            },
            "class_type": "ModelSamplingSD3",
            "_meta": { "title": "Sigma偏移 高噪声" }
        },
        "911:426": {
            "inputs": {
                "shift": settings.shift || 5,
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
            "class_type": "GetImageSize"
        },
        "911:1072:204": {
            "inputs": {
                "upscale_method": "lanczos",
                "width": ["911:1072:210", 0],
                "height": ["911:1072:211", 0],
                "crop": "disabled",
                "image": ["959", 0]
            },
            "class_type": "ImageScale"
        },
        "911:1072:213": {
            "inputs": {
                "expression": "round((a / (b / c)) / 16) * 16",
                "a": ["911:1072:212", 0],
                "b": ["911:1072:201", 0],
                "c": ["911:1072:201", 1]
            },
            "class_type": "MathExpression|pysssss"
        },
        "911:1072:212": {
            "inputs": {
                "expression": "round(sqrt(0.4 * 1000000 * (b / c)) / 16) * 16",
                "b": ["911:1072:201", 0],
                "c": ["911:1072:201", 1]
            },
            "class_type": "MathExpression|pysssss"
        },
        "911:1072:210": {
            "inputs": { "any_02": ["911:1072:212", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:1072:201": {
            "inputs": { "image": ["959", 0] },
            "class_type": "GetImageSize"
        },
        "911:1072:211": {
            "inputs": { "any_02": ["911:1072:213", 0] },
            "class_type": "Any Switch (rgthree)"
        },
        "911:457": {
            "inputs": { "value": settings.frameRate || 16 },
            "class_type": "PrimitiveFloat",
            "_meta": { "title": "帧率" }
        },
        "911:458": {
            "inputs": { "value": 30 },
            "class_type": "PrimitiveInt"
        },
        "911:1073": {
            "inputs": {
                "expression": "(round((a * b) / 8) * 8) +1",
                "a": ["911:1075", 0],
                "b": ["911:457", 0]
            },
            "class_type": "MathExpression|pysssss"
        },
        "911:1075": {
            "inputs": { "value": settings.duration || 5 },
            "class_type": "PrimitiveInt",
            "_meta": { "title": "秒数" }
        },
        "911:915": {
            "inputs": { "seed": seed },
            "class_type": "easy seed"
        },
        "911:914": {
            "inputs": {
                "steps_total": settings.steps || 4,
                "refiner_step": settings.refinerStep || 2,
                "cfg": settings.cfg || 1,
                "sampler_name": settings.samplerName || "uni_pc_bh2",
                "scheduler": settings.scheduler || "beta"
            },
            "class_type": "KSampler Config (rgthree)"
        }
    };
}

// ============ API 函数 ============

async function checkServerStatus() {
    try {
        const res = await fetch(`${COMFY_API_URL}/system_stats`, {
            headers: getAuthHeaders()
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

async function queuePrompt(workflow) {
    const headers = getAuthHeaders();
    const res = await fetch(`${COMFY_API_URL}/prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: workflow })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Queue failed: ${res.status} - ${text}`);
    }

    const data = await res.json();
    return data.prompt_id;
}

async function checkHistory(promptId) {
    const headers = getAuthHeaders();
    delete headers['Content-Type']; // GET 请求不需要

    const res = await fetch(`${COMFY_API_URL}/history/${promptId}`, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    return data[promptId] || null;
}

async function uploadImage(imagePath) {
    const fs = await import('fs');
    const path = await import('path');
    const FormData = (await import('form-data')).default;

    const filename = path.default.basename(imagePath);
    const formData = new FormData();
    formData.append('image', fs.default.createReadStream(imagePath), filename);
    formData.append('overwrite', 'true');

    const headers = {};
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
        headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
        headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
    }

    const res = await fetch(`${COMFY_API_URL}/upload/image`, {
        method: 'POST',
        headers,
        body: formData
    });

    if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
    }

    const result = await res.json();
    return result.name || filename;
}

async function waitForVideoCompletion(promptId, maxWaitMs = 600000) {
    const startTime = Date.now();
    const pollInterval = 5000; // 视频生成比较慢，5秒轮询一次

    console.log('⏳ 等待视频生成完成（视频生成通常需要几分钟）...');

    while (Date.now() - startTime < maxWaitMs) {
        const history = await checkHistory(promptId);

        if (history && history.status) {
            if (history.status.status_str === 'error') {
                return { success: false, error: '生成出错' };
            }

            if (history.status.completed) {
                const outputs = history.outputs;

                // 检查 VHS_VideoCombine 输出 (节点 958)
                if (outputs["958"]) {
                    // 检查 gifs 字段
                    if (outputs["958"].gifs && outputs["958"].gifs.length > 0) {
                        const video = outputs["958"].gifs[0];
                        return {
                            success: true,
                            filename: video.filename,
                            subfolder: video.subfolder,
                            url: `${COMFY_API_URL}/view?filename=${video.filename}&subfolder=${video.subfolder}&type=${video.type}`
                        };
                    }
                    // 检查 videos 字段
                    if (outputs["958"].videos && outputs["958"].videos.length > 0) {
                        const video = outputs["958"].videos[0];
                        return {
                            success: true,
                            filename: video.filename,
                            subfolder: video.subfolder,
                            url: `${COMFY_API_URL}/view?filename=${video.filename}&subfolder=${video.subfolder}&type=${video.type}`
                        };
                    }
                }
            }
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r⏳ 已等待 ${elapsed} 秒...`);
        await new Promise(r => setTimeout(r, pollInterval));
    }

    return { success: false, error: '超时' };
}

// ============ 测试函数 ============

async function testVideoGeneration() {
    console.log('\n📹 图生视频 API 测试');
    console.log('='.repeat(50));

    // 1. 检查服务器状态
    console.log('\n🔍 检查 ComfyUI 服务器状态...');
    const serverOnline = await checkServerStatus();

    if (!serverOnline) {
        console.log('❌ ComfyUI 服务器不可用!');
        console.log(`   请确保服务器运行在: ${COMFY_API_URL}`);
        console.log('   或设置环境变量: COMFY_URL=http://your-server:port');
        return false;
    }
    console.log('✅ 服务器在线');

    // 2. 检查是否有测试图片
    const testImagePath = process.argv[2];
    if (!testImagePath) {
        console.log('\n⚠️  请提供测试图片路径作为参数:');
        console.log('   node test-video-api.js /path/to/test-image.png');
        console.log('\n💡 或者使用 ComfyUI 已有的图片名称:');
        console.log('   node test-video-api.js "existing_image.png" --no-upload');
        return false;
    }

    // 3. 上传或使用现有图片
    let imageName;
    if (process.argv.includes('--no-upload')) {
        imageName = testImagePath;
        console.log(`\n📷 使用已有图片: ${imageName}`);
    } else {
        console.log(`\n📤 上传测试图片: ${testImagePath}`);
        try {
            imageName = await uploadImage(testImagePath);
            console.log(`✅ 上传成功: ${imageName}`);
        } catch (e) {
            console.log(`❌ 上传失败: ${e.message}`);
            return false;
        }
    }

    // 4. 创建视频生成任务
    console.log('\n🎬 创建视频生成任务...');
    const settings = {
        positivePrompt: "女性角色跳舞，舞蹈动作，扭动身体，节奏感",
        negativePrompt: DEFAULT_VIDEO_NEGATIVE_PROMPT,
        duration: 3,        // 3秒，快速测试
        frameRate: 16,
        seed: -1,
        steps: 4,
        cfg: 1,
        refinerStep: 2,
        shift: 5,
        firstFrameImage: imageName
    };

    console.log('   提示词:', settings.positivePrompt);
    console.log('   时长:', settings.duration, '秒');
    console.log('   帧率:', settings.frameRate, 'fps');
    console.log('   步数:', settings.steps);

    try {
        const workflow = createVideoWorkflow(settings);
        const promptId = await queuePrompt(workflow);
        console.log(`✅ 任务已提交: ${promptId}`);

        // 5. 等待完成
        const result = await waitForVideoCompletion(promptId);
        console.log('\n');

        if (result.success) {
            console.log('🎉 视频生成成功!');
            console.log(`   文件名: ${result.filename}`);
            console.log(`   子目录: ${result.subfolder}`);
            console.log(`   URL: ${result.url}`);
            return true;
        } else {
            console.log(`❌ 视频生成失败: ${result.error}`);
            return false;
        }
    } catch (e) {
        console.log(`\n❌ 错误: ${e.message}`);
        console.log(e.stack);
        return false;
    }
}

// ============ 主函数 ============

async function main() {
    const success = await testVideoGeneration();

    console.log('\n' + '='.repeat(50));
    console.log(success ? '✅ 测试通过!' : '❌ 测试失败');
    console.log('='.repeat(50));

    process.exit(success ? 0 : 1);
}

main().catch(e => {
    console.error('💥 测试脚本错误:', e);
    process.exit(1);
});
