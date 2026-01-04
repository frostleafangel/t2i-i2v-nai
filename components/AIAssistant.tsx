import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2, Trash2, Settings2, ArrowRight } from 'lucide-react';
import { 
  ChatMessage, 
  AIConfig, 
  WELCOME_MESSAGE, 
  WELCOME_MESSAGE_EN,
  parseUserConfig, 
  buildSystemPrompt, 
  buildSystemPromptEN,
  sendChatMessage,
  extractXMLFromResponse,
  parseXMLToFields,
  ParsedPrompt
} from '../services/aiService';
import { CharacterPrompt, GeneralPrompt } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onFillBuilder: (characters: CharacterPrompt[], general: GeneralPrompt) => void;
  onFillRaw: (xml: string) => void;
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  xml?: string; // 存储提取的 XML
}

const STORAGE_KEY_CONFIG = 'newbie_ai_config';
const STORAGE_KEY_HISTORY = 'newbie_ai_history';
const MAX_HISTORY = 5; // 保留最近5轮对话

const AIAssistant: React.FC<Props> = ({ isOpen, onClose, onFillBuilder, onFillRaw }) => {
  const { t, language } = useLanguage();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载配置和历史
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse AI config:', e);
      }
    }
    
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse AI history:', e);
      }
    }
  }, []);

  // 保存历史
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages));
    }
  }, [messages]);

  // 保存配置
  useEffect(() => {
    if (config) {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    }
  }, [config]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // 添加用户消息
    const newUserMsg: StoredMessage = { role: 'user', content: userMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    
    setIsLoading(true);
    
    try {
      let systemPrompt: string;
      
      if (!config) {
        // 未配置：让 AI 帮助解析用户的风格/画质串
        if (language === 'zh') {
          systemPrompt = `你是 NewBie 图像生成助手。当前处于【配置阶段】，你的唯一任务是帮助用户配置默认风格和画质标签。

**重要：在配置阶段，你不要生成任何 XML 提示词！只做标签分类！**

用户会发送一串标签，请帮助分析并整理成两类：
1. **风格标签 (Style)**: 画风、画师名、年份、色彩风格、线条风格等
   - 例如：artist:xxx, year 2024, flat_color, no_lineart, brightly colored, monochrome 相关权重等
2. **画质标签 (Quality)**: 画质、分辨率、细节相关
   - 例如：best quality, masterpiece, very aesthetic, detailed, absurdres, ultra-detailed 等

请严格按以下格式回复（不要添加其他内容）：

✅ 配置解析完成！

**风格标签:** [整理后的风格标签，保持原格式，用逗号分隔]
**画质标签:** [整理后的画质标签，保持原格式，用逗号分隔]

配置已保存，现在你可以描述想要的画面了！

如果用户的输入不像是配置标签（比如是画面描述），请回复：
"请先发送您的默认风格和画质标签进行配置。例如：artist:xxx, flat_color, best quality, masterpiece..."`;
        } else {
          systemPrompt = `You are the NewBie image generation assistant. Currently in [Configuration Phase], your only task is to help users configure default style and quality tags.

**Important: During configuration phase, do NOT generate any XML prompts! Only categorize tags!**

Users will send a string of tags. Please analyze and organize them into two categories:
1. **Style Tags**: Art style, artist names, year, color style, line style, etc.
   - Examples: artist:xxx, year 2024, flat_color, no_lineart, brightly colored, monochrome, related weights, etc.
2. **Quality Tags**: Quality, resolution, detail related
   - Examples: best quality, masterpiece, very aesthetic, detailed, absurdres, ultra-detailed, etc.

Please reply strictly in this format (no additional content):

✅ Configuration complete!

**Style Tags:** [organized style tags, keep original format, comma separated]
**Quality Tags:** [organized quality tags, keep original format, comma separated]

Configuration saved. Now you can describe the image you want!

If user's input doesn't look like configuration tags (e.g., it's an image description), reply:
"Please send your default style and quality tags first. Example: artist:xxx, flat_color, best quality, masterpiece..."`;
        }
      } else {
        // 已配置：正常生成 XML
        systemPrompt = language === 'zh' ? buildSystemPrompt(config) : buildSystemPromptEN(config);
      }
      
      // 获取最近的对话历史（最多5轮）
      const recentMessages = messages.slice(-MAX_HISTORY * 2);
      
      const apiMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ];
      
      const response = await sendChatMessage(apiMessages);
      
      // 检查是否包含 XML
      const xml = extractXMLFromResponse(response);
      
      const assistantMsg: StoredMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        xml: xml || undefined // 存储 XML 以便后续显示填充按钮
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // 如果未配置，尝试从 AI 回复中提取配置
      if (!config) {
        // 支持中英文格式
        const styleMatch = response.match(/\*\*(?:风格标签|Style Tags?)[：:]\*\*\s*(.+)/i);
        const qualityMatch = response.match(/\*\*(?:画质标签|Quality Tags?)[：:]\*\*\s*(.+)/i);
        
        if (styleMatch && qualityMatch) {
          const newConfig = {
            defaultStyle: styleMatch[1].trim(),
            defaultQuality: qualityMatch[1].trim()
          };
          setConfig(newConfig);
        }
      }
      
    } catch (err: any) {
      setError(err.message || t.aiAssistant.requestFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillBuilder = (xml: string) => {
    const parsed = parseXMLToFields(xml);
    if (parsed) {
      // 转换为 CharacterPrompt 格式
      const characters: CharacterPrompt[] = parsed.characters.map((c, i) => ({
        id: Date.now().toString() + i,
        ...c
      }));
      
      const general: GeneralPrompt = {
        ...parsed.general,
        lighting: parsed.general.lighting || ''
      };
      
      onFillBuilder(characters, general);
      onClose();
    } else {
      setError(t.aiAssistant.xmlParseFailed);
    }
  };

  const handleFillRaw = (xml: string) => {
    onFillRaw(xml);
    onClose();
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  const handleResetConfig = () => {
    setConfig(null);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">{t.aiAssistant.title}</h2>
              <p className="text-xs text-gray-500">
                {config ? `Style: ${config.defaultStyle.substring(0, 20)}...` : t.aiAssistant.notConfigured}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleResetConfig}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
              title={t.aiAssistant.resetConfig}
            >
              <Settings2 size={18} />
            </button>
            <button 
              onClick={handleClearHistory}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
              title={t.aiAssistant.clearHistory}
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Welcome message if no history */}
          {messages.length === 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-300" dangerouslySetInnerHTML={{ 
                  __html: (language === 'zh' ? WELCOME_MESSAGE : WELCOME_MESSAGE_EN).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded">$1</code>').replace(/```([\s\S]*?)```/g, '<pre class="bg-black/30 p-2 rounded mt-2 text-xs">$1</pre>')
                }} />
              </div>
            </div>
          )}
          
          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-primary" />
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`rounded-xl p-3 ${
                  msg.role === 'user' 
                    ? 'bg-primary/20 text-white' 
                    : 'bg-darker border border-white/5 text-gray-300'
                }`}>
                  <div className="text-sm whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-black/30 p-2 rounded mt-2 text-xs overflow-x-auto"><code>$2</code></pre>')
                      .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded text-xs">$1</code>')
                  }} />
                </div>
                {/* 如果消息包含 XML，显示填充按钮 */}
                {msg.xml && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleFillBuilder(msg.xml!)}
                      className="py-1.5 px-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                    >
                      {t.aiAssistant.fillToBuilder}
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => handleFillRaw(msg.xml!)}
                      className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                    >
                      {t.aiAssistant.fillToXml}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <User size={16} className="text-gray-400" />
                </div>
              )}
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-primary" />
              </div>
              <div className="bg-darker border border-white/5 rounded-xl p-3">
                <Loader2 size={18} className="animate-spin text-primary" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                if (e.target.value.length <= 3000) { // 约 2000 tokens
                  setInput(e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={config ? t.aiAssistant.placeholder : t.aiAssistant.configFirst}
              rows={2}
              className="flex-1 bg-darker border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 bg-gradient-to-r from-primary to-secondary rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-xs text-gray-600">{t.aiAssistant.sendHint}</p>
            <p className={`text-xs ${input.length > 2500 ? 'text-orange-400' : 'text-gray-600'}`}>
              {input.length}/3000
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
