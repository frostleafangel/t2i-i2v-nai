/**
 * 放大功能测试脚本
 * 测试三种场景：
 * 1. 普通生图（无放大）
 * 2. 生图+自动放大
 * 3. 对已生成图片单独放大
 */

// 从 constants.ts 复制的工作流模板（转换为 JS）
const SYSTEM_PROMPT_PREFIX = `You are an assistant designed to generate high-quality anime images with the highest degree of image-text alignment based on xml format textual prompts. <Prompt Start>\n`;
const NEGATIVE_PROMPT_DEFAULT = `<danbooru_tags>low_score_rate, worst quality, low quality, bad quality, lowres, low res, pixelated, blurry, blurred, compression artifacts, jpeg artifacts, bad anatomy, worst hands, deformed hands, deformed fingers, deformed feet, deformed toes, extra limbs, extra arms, extra legs, extra fingers, extra digits, extra digit, fused fingers, missing limbs, missing arms, missing fingers, missing toes, wrong hands, ugly hands, ugly fingers, twisted hands, flexible deformity, conjoined, disembodied, text, watermark, signature, logo, ugly, worst, very displeasing, displeasing, error, doesnotexist, unfinished, poorly drawn face, poorly drawn hands, poorly drawn feet, artistic error, bad proportions, bad perspective, out of frame, ai-generated, ai-assisted, stable diffusion, overly saturated, overly vivid, cross-eye, expressionless, scan, sketch, monochrome, simple background, abstract, sequence, lineup, 2koma, 4koma, microsoft paint \\(medium\\), artifacts, adversarial noise, has bad revision, resized, image sample,low_aesthetic</danbooru_tags>`;
const NEGATIVE_SYSTEM_PROMPT = "You are the most worst anime artist in the whole universe and every image you drawn is garbage. <Prompt Start> ";

// 测试用的简单 prompt
const TEST_PROMPT = `
<character_1>
    <n>original_character</n>
    <gender>1girl</gender>
    <appearance>blue_hair, long_hair, blue_eyes</appearance>
    <clothing>white_dress</clothing>
    <expression>smile</expression>
    <action>standing</action>
    <position>solo</position>
</character_1>
<general_tags>
    <count>1girl, solo</count>
    <style>anime_style</style>
    <quality>masterpiece, best quality</quality>
    <background>simple_background, white_background</background>
    <caption>A girl with blue hair wearing a white dress, smiling.</caption>
</general_tags>
`;

// ComfyUI API 地址 - 需要根据实际情况修改
const COMFY_API_URL = process.env.COMFY_URL || 'http://localhost:8188';

console.log(`\n🔧 ComfyUI API: ${COMFY_API_URL}\n`);

// ============ 工作流模板 ============

// 1. 普通生图工作流
const WORKFLOW_TEMPLATE = {
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
  "3": {
    "inputs": { "vae_name": "diffusion_pytorch_model.safetensors" },
    "class_type": "VAELoader"
  },
  "4": {
    "inputs": {
      "seed": Math.floor(Math.random() * 1000000000000000),
      "steps": 28,
      "cfg": 5,
      "sampler_name": "euler_ancestral",
      "scheduler": "linear_quadratic",
      "denoise": 1,
      "model": ["10", 0],
      "positive": ["5", 0],
      "negative": ["6", 0],
      "latent_image": ["7", 0]
    },
    "class_type": "KSampler"
  },
  "5": {
    "inputs": {
      "user_prompt": TEST_PROMPT,
      "system_prompt": SYSTEM_PROMPT_PREFIX,
      "use_chat_template": false,
      "clip": ["2", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  "6": {
    "inputs": {
      "user_prompt": NEGATIVE_PROMPT_DEFAULT,
      "system_prompt": NEGATIVE_SYSTEM_PROMPT,
      "use_chat_template": false,
      "clip": ["2", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  "7": {
    "inputs": { "width": 512, "height": 768, "batch_size": 1 },
    "class_type": "EmptyLatentImage"
  },
  "8": {
    "inputs": { "samples": ["4", 0], "vae": ["3", 0] },
    "class_type": "VAEDecode"
  },
  "10": {
    "inputs": { "multiplier": 0.7, "model": ["1", 0] },
    "class_type": "RescaleCFG"
  },
  "21": {
    "inputs": { "filename_prefix": "test_normal", "images": ["8", 0] },
    "class_type": "SaveImage"
  }
};

// 2. 生图+放大工作流
const UPSCALE_WORKFLOW_TEMPLATE = {
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
  "28": {
    "inputs": {
      "user_prompt": TEST_PROMPT,
      "system_prompt": SYSTEM_PROMPT_PREFIX,
      "use_chat_template": false,
      "clip": ["93:88", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  "51": {
    "inputs": {
      "width": 512,
      "height": 768,
      "aspect_ratio": "custom",
      "swap_dimensions": "Off",
      "upscale_factor": 1,
      "batch_size": 1
    },
    "class_type": "CR SDXL Aspect Ratio"
  },
  "86": {
    "inputs": { "seed": Math.floor(Math.random() * 1000000000000000) },
    "class_type": "Seed (rgthree)"
  },
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
  "98": {
    "inputs": { "seed": Math.floor(Math.random() * 1000000000000000) },
    "class_type": "Seed (rgthree)"
  },
  "145": {
    "inputs": {
      "filename_prefix": "test_upscale_preview",
      "only_preview": true,
      "images": ["93:62", 0]
    },
    "class_type": "easy imageSave"
  },
  "146": {
    "inputs": {
      "filename_prefix": "test_upscale_final",
      "only_preview": false,
      "images": ["104:100", 0]
    },
    "class_type": "easy imageSave"
  },
  "93:62": {
    "inputs": { "samples": ["3", 0], "vae": ["93:90", 0] },
    "class_type": "VAEDecode"
  },
  "93:87": {
    "inputs": {
      "user_prompt": NEGATIVE_PROMPT_DEFAULT,
      "system_prompt": NEGATIVE_SYSTEM_PROMPT,
      "use_chat_template": true,
      "clip": ["93:88", 0]
    },
    "class_type": "NewBieCLIPTextEncode"
  },
  "93:92": {
    "inputs": { "multiplier": 0.7, "model": ["93:91", 0] },
    "class_type": "RescaleCFG"
  },
  "93:90": {
    "inputs": { "vae_name": "diffusion_pytorch_model.safetensors" },
    "class_type": "VAELoader"
  },
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
  "93:91": {
    "inputs": { "shift": 6, "model": ["93:89", 0] },
    "class_type": "ModelSamplingNewbie"
  },
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
  "104:100": {
    "inputs": { "samples": ["94", 0], "vae": ["93:90", 0] },
    "class_type": "VAEDecode"
  },
  "104:102": {
    "inputs": { "pixels": ["104:107", 0], "vae": ["93:90", 0] },
    "class_type": "VAEEncode"
  },
  "104:105": {
    "inputs": { "upscale_model": ["104:104", 0], "image": ["93:62", 0] },
    "class_type": "ImageUpscaleWithModel"
  },
  "104:107": {
    "inputs": { "upscale_method": "lanczos", "scale_by": 0.38, "image": ["104:105", 0] },
    "class_type": "ImageScaleBy"
  },
  "104:104": {
    "inputs": { "model_name": "RealESRGAN_x4plus_anime_6B.pth" },
    "class_type": "UpscaleModelLoader"
  }
};

// 3. 单独放大工作流（需要先上传图片）
function createUpscaleOnlyWorkflow(imageFilename) {
  return {
    "1": {
      "inputs": { "image": imageFilename, "upload": "image" },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": { "model_name": "RealESRGAN_x4plus_anime_6B.pth" },
      "class_type": "UpscaleModelLoader"
    },
    "3": {
      "inputs": { "upscale_model": ["2", 0], "image": ["1", 0] },
      "class_type": "ImageUpscaleWithModel"
    },
    "4": {
      "inputs": { "upscale_method": "lanczos", "scale_by": 0.5, "image": ["3", 0] },
      "class_type": "ImageScaleBy"
    },
    "5": {
      "inputs": { "vae_name": "diffusion_pytorch_model.safetensors" },
      "class_type": "VAELoader"
    },
    "6": {
      "inputs": { "pixels": ["4", 0], "vae": ["5", 0] },
      "class_type": "VAEEncode"
    },
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
    "8": {
      "inputs": {
        "user_prompt": TEST_PROMPT,
        "system_prompt": SYSTEM_PROMPT_PREFIX,
        "use_chat_template": false,
        "clip": ["7", 0]
      },
      "class_type": "NewBieCLIPTextEncode"
    },
    "9": {
      "inputs": {
        "user_prompt": NEGATIVE_PROMPT_DEFAULT,
        "system_prompt": NEGATIVE_SYSTEM_PROMPT,
        "use_chat_template": true,
        "clip": ["7", 0]
      },
      "class_type": "NewBieCLIPTextEncode"
    },
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
    "11": {
      "inputs": { "shift": 6, "model": ["10", 0] },
      "class_type": "ModelSamplingNewbie"
    },
    "12": {
      "inputs": { "multiplier": 0.7, "model": ["11", 0] },
      "class_type": "RescaleCFG"
    },
    "13": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000000000000),
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
    "14": {
      "inputs": { "samples": ["13", 0], "vae": ["5", 0] },
      "class_type": "VAEDecode"
    },
    "15": {
      "inputs": { "filename_prefix": "test_upscale_only", "images": ["14", 0] },
      "class_type": "SaveImage"
    }
  };
}

// ============ API 函数 ============

async function checkServerStatus() {
  try {
    const res = await fetch(`${COMFY_API_URL}/system_stats`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function queuePrompt(workflow) {
  const res = await fetch(`${COMFY_API_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${COMFY_API_URL}/history/${promptId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data[promptId] || null;
}

async function waitForCompletion(promptId, outputNode, maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const history = await checkHistory(promptId);
    
    if (history && history.status && history.status.completed) {
      const outputs = history.outputs;
      if (outputs[outputNode] && outputs[outputNode].images && outputs[outputNode].images.length > 0) {
        const img = outputs[outputNode].images[0];
        return {
          success: true,
          filename: img.filename,
          url: `${COMFY_API_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
        };
      }
    }
    
    await new Promise(r => setTimeout(r, pollInterval));
    process.stdout.write('.');
  }
  
  return { success: false, error: 'Timeout' };
}

async function uploadImage(imageUrl) {
  // 下载图片
  const imgRes = await fetch(imageUrl);
  const imgBuffer = await imgRes.arrayBuffer();
  
  // 创建 FormData
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  const filename = `upload_${Date.now()}.png`;
  formData.append('image', Buffer.from(imgBuffer), { filename, contentType: 'image/png' });
  formData.append('overwrite', 'true');
  
  // 上传
  const uploadRes = await fetch(`${COMFY_API_URL}/upload/image`, {
    method: 'POST',
    body: formData
  });
  
  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status}`);
  }
  
  const result = await uploadRes.json();
  return result.name;
}

// ============ 测试函数 ============

async function test1_NormalGeneration() {
  console.log('\n📝 测试 1: 普通生图（无放大）');
  console.log('=' .repeat(50));
  
  try {
    const promptId = await queuePrompt(WORKFLOW_TEMPLATE);
    console.log(`✅ 任务已提交: ${promptId}`);
    console.log('⏳ 等待生成完成...');
    
    const result = await waitForCompletion(promptId, '21', 180000);
    
    if (result.success) {
      console.log(`\n✅ 生成成功!`);
      console.log(`   文件名: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      return result;
    } else {
      console.log(`\n❌ 生成失败: ${result.error}`);
      return null;
    }
  } catch (e) {
    console.log(`\n❌ 错误: ${e.message}`);
    return null;
  }
}

async function test2_GenerationWithUpscale() {
  console.log('\n📝 测试 2: 生图 + 自动放大');
  console.log('=' .repeat(50));
  
  try {
    const promptId = await queuePrompt(UPSCALE_WORKFLOW_TEMPLATE);
    console.log(`✅ 任务已提交: ${promptId}`);
    console.log('⏳ 等待生成+放大完成（耗时较长）...');
    
    // 放大工作流的输出节点是 146
    const result = await waitForCompletion(promptId, '146', 300000);
    
    if (result.success) {
      console.log(`\n✅ 生成+放大成功!`);
      console.log(`   文件名: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      return result;
    } else {
      console.log(`\n❌ 生成失败: ${result.error}`);
      return null;
    }
  } catch (e) {
    console.log(`\n❌ 错误: ${e.message}`);
    return null;
  }
}

async function test3_UpscaleOnly(imageUrl) {
  console.log('\n📝 测试 3: 单独放大已有图片');
  console.log('=' .repeat(50));
  
  if (!imageUrl) {
    console.log('❌ 没有可用的图片进行放大测试');
    return null;
  }
  
  try {
    console.log('📤 上传图片到 ComfyUI...');
    const uploadedFilename = await uploadImage(imageUrl);
    console.log(`✅ 上传成功: ${uploadedFilename}`);
    
    const workflow = createUpscaleOnlyWorkflow(uploadedFilename);
    const promptId = await queuePrompt(workflow);
    console.log(`✅ 放大任务已提交: ${promptId}`);
    console.log('⏳ 等待放大完成...');
    
    // 单独放大工作流的输出节点是 15
    const result = await waitForCompletion(promptId, '15', 180000);
    
    if (result.success) {
      console.log(`\n✅ 放大成功!`);
      console.log(`   文件名: ${result.filename}`);
      console.log(`   URL: ${result.url}`);
      return result;
    } else {
      console.log(`\n❌ 放大失败: ${result.error}`);
      return null;
    }
  } catch (e) {
    console.log(`\n❌ 错误: ${e.message}`);
    return null;
  }
}

// ============ 主函数 ============

async function main() {
  console.log('🚀 NewBie 放大功能测试');
  console.log('=' .repeat(50));
  
  // 检查服务器状态
  console.log('\n🔍 检查 ComfyUI 服务器状态...');
  const serverOnline = await checkServerStatus();
  
  if (!serverOnline) {
    console.log('❌ ComfyUI 服务器不可用!');
    console.log(`   请确保服务器运行在: ${COMFY_API_URL}`);
    console.log('   或设置环境变量: COMFY_URL=http://your-server:port');
    process.exit(1);
  }
  
  console.log('✅ 服务器在线\n');
  
  // 运行测试
  const results = {
    test1: null,
    test2: null,
    test3: null
  };
  
  // 测试 1: 普通生图
  results.test1 = await test1_NormalGeneration();
  
  // 测试 2: 生图+放大
  results.test2 = await test2_GenerationWithUpscale();
  
  // 测试 3: 单独放大（使用测试1的结果）
  if (results.test1 && results.test1.url) {
    results.test3 = await test3_UpscaleOnly(results.test1.url);
  } else {
    console.log('\n⚠️ 跳过测试 3（测试 1 未成功）');
  }
  
  // 输出总结
  console.log('\n\n📊 测试结果总结');
  console.log('=' .repeat(50));
  console.log(`测试 1 (普通生图):     ${results.test1 ? '✅ 成功' : '❌ 失败'}`);
  console.log(`测试 2 (生图+放大):    ${results.test2 ? '✅ 成功' : '❌ 失败'}`);
  console.log(`测试 3 (单独放大):     ${results.test3 ? '✅ 成功' : '❌ 失败'}`);
  console.log('=' .repeat(50));
  
  const allPassed = results.test1 && results.test2 && results.test3;
  console.log(allPassed ? '\n🎉 所有测试通过!' : '\n⚠️ 部分测试失败，请检查错误信息');
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error('💥 测试脚本错误:', e);
  process.exit(1);
});
