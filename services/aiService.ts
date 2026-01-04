// AI Chat Service - 通过后端代理调用硅基流动 API

const AI_API_URL = import.meta.env.DEV 
  ? 'http://localhost:3001/api/chat'
  : '/api/chat';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  defaultStyle: string;
  defaultQuality: string;
}

// 基础思维链模板
const BASE_SYSTEM_PROMPT = `你是一个专门为 NewBie-image 模型生成高质量 XML 格式提示词的智能助手。

用户已配置的默认风格: {DEFAULT_STYLE}
用户已配置的默认画质: {DEFAULT_QUALITY}

## 官方 XML 结构说明（必须严格遵守）

### character 标签内的字段：
- <n>: 角色名称，默认 original_character，已知角色用 danbooru 角色名
- <gender>: 性别，如 1girl, 1boy
- <appearance>: 外貌特征（发型、发色、眼睛、身材等 danbooru 标签）
- <clothing>: 服装配饰
- <expression>: 表情（smile, blush, crying 等）
- <action>: 动作、姿势（sitting, standing, holding 等）
- <position>: 角色在画面中的位置（如 center_left, center_right），单角色可留空

### general_tags 标签内的字段：
- <count>: 人数标签，如 "1girl, solo" 或 "2girls, multiple_girls"
- <style>: 画风标签，**保持用户配置的原始格式**
- <quality>: 画质标签
- <background>: 背景场景
- <lighting>: 光影（如 sunset, dramatic_lighting, backlighting）
- <atmosphere>: 画面情绪、氛围（如 cheerful, melancholy）
- <objects>: 场景中的物品（武器、饰品等）
- <other>: 其他未包含的标签（视角如 from_below 等）
- <caption>: 用自然英语描述整个画面，**不使用下划线**

## 规则（必须严格遵守）：
1. **下划线规则**：
   - 所有 danbooru 标签必须保留下划线：long_hair, blue_eyes, looking_at_viewer
   - 仅 <caption> 标签内去除下划线，转为自然英语：long hair, blue eyes, looking at viewer
2. 括号转义为 \\(\\)，除非是权重语法如 (xxx:1.2)
3. **用户没有提供的字段留空，不要填 unknown 或编造内容**
4. **保持用户配置的风格格式原样输出**

直接输出 XML 代码块：

\`\`\`xml
{
<character_1>
    <n>original_character</n>
    <gender>1girl</gender>
    <appearance>...</appearance>
    <clothing>...</clothing>
    <expression>...</expression>
    <action>...</action>
    <position></position>
</character_1>

<general_tags>
    <count>1girl, solo</count>
    <style>...</style>
    <quality>...</quality>
    <background>...</background>
    <lighting>...</lighting>
    <atmosphere>...</atmosphere>
    <objects>...</objects>
    <other>...</other>
    <caption>...</caption>
</general_tags>
}
\`\`\`
`;

// 初始化欢迎消息
export const WELCOME_MESSAGE = `🤖 NewBie AI 助手

我可以帮你将自然语言描述转换为 NewBie 模型的 XML 提示词格式。

**首次使用请先配置：**
请发送你的默认『风格标签』和『画质标签』，格式如下：

\`\`\`
风格: anime_style, flat_color, no_lineart
画质: very_aesthetic, masterpiece, high_resolution, detailed
\`\`\`

配置完成后，你可以直接描述想要的画面，我会生成对应的 XML 提示词。`;

export const WELCOME_MESSAGE_EN = `🤖 NewBie AI Assistant

I can help you convert natural language descriptions into XML prompts for the NewBie model.

**First-time setup:**
Please send your default "style tags" and "quality tags" in this format:

\`\`\`
Style: anime_style, flat_color, no_lineart
Quality: very_aesthetic, masterpiece, high_resolution, detailed
\`\`\`

Once configured, you can describe the image you want, and I'll generate the corresponding XML prompt.`;

// 解析用户配置 - 支持多种格式
export function parseUserConfig(message: string): AIConfig | null {
  // 格式1: 风格: xxx \n 画质: xxx
  const styleMatch = message.match(/风格[:：]\s*(.+)/);
  const qualityMatch = message.match(/画质[:：]\s*(.+)/);
  
  if (styleMatch && qualityMatch) {
    return {
      defaultStyle: styleMatch[1].trim(),
      defaultQuality: qualityMatch[1].trim()
    };
  }
  
  // 格式2: 用户直接发送一大串 tags，智能拆分
  // 检测是否包含常见的风格/画质关键词
  const styleKeywords = ['anime', 'style', 'flat_color', 'lineart', 'realistic', 'sketch', 'artist:', 'monochrome', 'colored', '::'];
  const qualityKeywords = ['quality', 'aesthetic', 'masterpiece', 'detailed', 'resolution', 'absurdres', 'highres'];
  
  const lowerMsg = message.toLowerCase();
  const hasStyleKeywords = styleKeywords.some(k => lowerMsg.includes(k));
  const hasQualityKeywords = qualityKeywords.some(k => lowerMsg.includes(k));
  
  // 如果看起来像是一串 tags（包含逗号分隔的内容）
  if ((hasStyleKeywords || hasQualityKeywords) && message.includes(',')) {
    const tags = message.split(',').map(t => t.trim()).filter(Boolean);
    
    const styleTags: string[] = [];
    const qualityTags: string[] = [];
    
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      if (qualityKeywords.some(k => lowerTag.includes(k))) {
        qualityTags.push(tag);
      } else {
        styleTags.push(tag);
      }
    }
    
    // 如果成功分类了一些 tags
    if (styleTags.length > 0 || qualityTags.length > 0) {
      return {
        defaultStyle: styleTags.join(', ') || 'anime_style',
        defaultQuality: qualityTags.join(', ') || 'very_aesthetic, masterpiece, high_resolution'
      };
    }
  }
  
  return null;
}

// 构建 System Prompt
export function buildSystemPrompt(config: AIConfig): string {
  return BASE_SYSTEM_PROMPT
    .replace(/{DEFAULT_STYLE}/g, config.defaultStyle)
    .replace(/{DEFAULT_QUALITY}/g, config.defaultQuality);
}

// 英文版 System Prompt（AI 仍然生成相同格式的 XML，只是交互语言变了）
export function buildSystemPromptEN(config: AIConfig): string {
  return `You are an AI assistant specialized in generating high-quality XML prompts for the NewBie-image model.

User's configured default style: ${config.defaultStyle}
User's configured default quality: ${config.defaultQuality}

## Official XML Structure (must follow strictly)

### Fields inside character tags:
- <n>: Character name, default original_character, use danbooru character name for known characters
- <gender>: Gender, e.g., 1girl, 1boy
- <appearance>: Physical features (hair, eyes, body type, etc. as danbooru tags)
- <clothing>: Clothing and accessories
- <expression>: Facial expression (smile, blush, crying, etc.)
- <action>: Actions, poses (sitting, standing, holding, etc.)
- <position>: Character position in frame (center_left, center_right), can be empty for single character

### Fields inside general_tags:
- <count>: Character count tags, e.g., "1girl, solo" or "2girls, multiple_girls"
- <style>: Style tags, **keep user's configured format as-is**
- <quality>: Quality tags
- <background>: Background scene
- <lighting>: Lighting (sunset, dramatic_lighting, backlighting)
- <atmosphere>: Mood, atmosphere (cheerful, melancholy)
- <objects>: Objects in scene (weapons, accessories)
- <other>: Other tags not covered above (viewpoint like from_below, etc.)
- <caption>: Natural English description of the entire scene, **no underscores**

## Rules (must follow strictly):
1. **Underscore rule**:
   - All danbooru tags must keep underscores: long_hair, blue_eyes, looking_at_viewer
   - Only <caption> removes underscores, using natural English: long hair, blue eyes, looking at viewer
2. Escape parentheses as \\(\\), unless it's weight syntax like (xxx:1.2)
3. **Leave empty fields that user didn't provide, don't fill unknown or make up content**
4. **Output user's configured style format exactly as-is**

Output XML code block directly:

\`\`\`xml
{
<character_1>
    <n>original_character</n>
    <gender>1girl</gender>
    <appearance>...</appearance>
    <clothing>...</clothing>
    <expression>...</expression>
    <action>...</action>
    <position></position>
</character_1>

<general_tags>
    <count>1girl, solo</count>
    <style>...</style>
    <quality>...</quality>
    <background>...</background>
    <lighting>...</lighting>
    <atmosphere>...</atmosphere>
    <objects>...</objects>
    <other>...</other>
    <caption>...</caption>
</general_tags>
}
\`\`\`
`;
}

// 调用 AI API
export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<string> {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '抱歉，生成失败';
}

// 从 AI 回复中提取 XML
export function extractXMLFromResponse(response: string): string | null {
  // 匹配 ```xml ... ``` 或 ``` ... ``` 中的内容
  const xmlMatch = response.match(/```(?:xml)?\s*([\s\S]*?)```/);
  if (xmlMatch) {
    return xmlMatch[1].trim();
  }
  
  // 尝试直接匹配 { ... } 包裹的 XML
  const directMatch = response.match(/\{\s*(<[\s\S]*>)\s*\}/);
  if (directMatch) {
    return `{\n${directMatch[1]}\n}`;
  }
  
  return null;
}

// 解析 XML 到简易模式字段
export interface ParsedPrompt {
  characters: Array<{
    n: string;
    gender: string;
    appearance: string;
    clothing: string;
    expression: string;
    action: string;
    position: string;
  }>;
  general: {
    count: string;
    style: string;
    background: string;
    lighting: string;
    atmosphere: string;
    quality: string;
    objects: string;
    other: string;
    caption: string;
  };
}

export function parseXMLToFields(xml: string): ParsedPrompt | null {
  try {
    const characters: ParsedPrompt['characters'] = [];
    
    // 解析所有 character 标签
    const charMatches = xml.matchAll(/<character_(\d+)>([\s\S]*?)<\/character_\1>/g);
    for (const match of charMatches) {
      const charContent = match[2];
      characters.push({
        n: extractTag(charContent, 'n') || 'original_character',
        gender: extractTag(charContent, 'gender') || '',
        appearance: extractTag(charContent, 'appearance') || '',
        clothing: extractTag(charContent, 'clothing') || '',
        expression: extractTag(charContent, 'expression') || '',
        action: extractTag(charContent, 'action') || '',
        position: extractTag(charContent, 'position') || ''
      });
    }
    
    // 解析 general_tags
    const generalMatch = xml.match(/<general_tags>([\s\S]*?)<\/general_tags>/);
    const generalContent = generalMatch ? generalMatch[1] : '';
    
    const general = {
      count: extractTag(generalContent, 'count') || '',
      style: extractTag(generalContent, 'style') || '',
      background: extractTag(generalContent, 'background') || '',
      lighting: extractTag(generalContent, 'lighting') || '',
      atmosphere: extractTag(generalContent, 'atmosphere') || '',
      quality: extractTag(generalContent, 'quality') || '',
      objects: extractTag(generalContent, 'objects') || '',
      other: extractTag(generalContent, 'other') || '',
      caption: extractTag(generalContent, 'caption') || ''
    };
    
    if (characters.length === 0) {
      return null;
    }
    
    return { characters, general };
  } catch (e) {
    console.error('Failed to parse XML:', e);
    return null;
  }
}

function extractTag(content: string, tagName: string): string {
  const match = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
  return match ? match[1].trim() : '';
}
