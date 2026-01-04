import React, { useState, useEffect } from 'react';
import { Send, Sparkles, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { TagAutocomplete } from '../TagAutocomplete';

interface Props {
    prefixPrompt: string;
    positivePrompt: string;
    suffixPrompt: string;
    negativePrompt: string;
    onPrefixChange: (v: string) => void;
    onPositiveChange: (v: string) => void;
    onSuffixChange: (v: string) => void;
    onNegativeChange: (v: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    disabled?: boolean;
    hideGenerateButton?: boolean;
    progress?: number;
}

// 折叠状态持久化 key
const COLLAPSE_STATE_KEY = 'novelai_prompt_collapse_state';

interface CollapseState {
    prefix: boolean;
    suffix: boolean;
    negative: boolean;
}

const NovelAIPromptArea: React.FC<Props> = ({
    prefixPrompt,
    positivePrompt,
    suffixPrompt,
    negativePrompt,
    onPrefixChange,
    onPositiveChange,
    onSuffixChange,
    onNegativeChange,
    onGenerate,
    isGenerating,
    disabled,
    hideGenerateButton,
    progress = 0
}) => {
    const { t } = useLanguage();

    // 折叠状态（从 localStorage 恢复）
    const [collapsed, setCollapsed] = useState<CollapseState>(() => {
        try {
            const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
            return saved ? JSON.parse(saved) : { prefix: false, suffix: false, negative: false };
        } catch {
            return { prefix: false, suffix: false, negative: false };
        }
    });

    // 保存折叠状态到 localStorage
    useEffect(() => {
        localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(collapsed));
    }, [collapsed]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            onGenerate();
        }
    };

    // 折叠时显示的预览文本
    const CollapsedPreview = ({ text, onClick }: { text: string; onClick: () => void }) => (
        <div
            onClick={onClick}
            className="px-3 py-1.5 bg-darker/50 border border-white/5 rounded-lg text-xs text-gray-500 truncate cursor-pointer hover:bg-darker transition-colors"
        >
            {text || <span className="italic opacity-50">（空）</span>}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 sm:gap-4">
            {/* Prompt Inputs */}
            <div className="bg-surface rounded-2xl p-3 sm:p-4 border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Sparkles size={14} className="text-primary" />
                        <span>正向提示词 (Ctrl+Enter 生成)</span>
                    </div>
                    {/* 颜色图例 */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }}></span>通用</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }}></span>画师</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }}></span>作品</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}></span>角色</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }}></span>元数据</span>
                    </div>
                </div>

                {/* Prefix */}
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => setCollapsed(prev => ({ ...prev, prefix: !prev.prefix }))}
                        className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                    >
                        {collapsed.prefix ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <span className={prefixPrompt ? 'text-primary' : ''}>前置提示词</span>
                        <span className="text-[10px] opacity-50">画风/质量词</span>
                    </button>
                    {collapsed.prefix ? (
                        <CollapsedPreview text={prefixPrompt} onClick={() => setCollapsed(prev => ({ ...prev, prefix: false }))} />
                    ) : (
                        <TagAutocomplete
                            value={prefixPrompt}
                            onChange={onPrefixChange}
                            placeholder="masterpiece, best quality, ..."
                            inputType="textarea"
                            rows={1}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary placeholder-gray-600"
                            onKeyDown={handleKeyDown}
                        />
                    )}
                </div>

                {/* Main */}
                <TagAutocomplete
                    value={positivePrompt}
                    onChange={onPositiveChange}
                    placeholder="主体内容..."
                    inputType="textarea"
                    rows={3}
                    maxRows={999}
                    className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary placeholder-gray-600 resize-none font-mono text-sm leading-relaxed"
                    onKeyDown={handleKeyDown}
                />

                {/* Suffix */}
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => setCollapsed(prev => ({ ...prev, suffix: !prev.suffix }))}
                        className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                    >
                        {collapsed.suffix ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <span className={suffixPrompt ? 'text-primary' : ''}>后置提示词</span>
                        <span className="text-[10px] opacity-50">细节/修饰</span>
                    </button>
                    {collapsed.suffix ? (
                        <CollapsedPreview text={suffixPrompt} onClick={() => setCollapsed(prev => ({ ...prev, suffix: false }))} />
                    ) : (
                        <TagAutocomplete
                            value={suffixPrompt}
                            onChange={onSuffixChange}
                            placeholder="detailed, sharp focus, ..."
                            inputType="textarea"
                            rows={1}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary placeholder-gray-600"
                            onKeyDown={handleKeyDown}
                        />
                    )}
                </div>

                {/* Negative */}
                <div className="pt-3 border-t border-white/5 space-y-1">
                    <button
                        type="button"
                        onClick={() => setCollapsed(prev => ({ ...prev, negative: !prev.negative }))}
                        className="text-sm text-gray-400 flex items-center gap-1 hover:text-gray-300 transition-colors cursor-pointer w-full text-left"
                    >
                        {collapsed.negative ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <ImageIcon size={14} className="text-red-400" />
                        <span className={negativePrompt ? 'text-primary' : ''}>负面提示词</span>
                    </button>
                    {collapsed.negative ? (
                        <CollapsedPreview text={negativePrompt} onClick={() => setCollapsed(prev => ({ ...prev, negative: false }))} />
                    ) : (
                        <TagAutocomplete
                            value={negativePrompt}
                            onChange={onNegativeChange}
                            placeholder="不想要的内容..."
                            inputType="textarea"
                            rows={1}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-sm focus:outline-none focus:border-red-400/50 placeholder-gray-600 resize-none font-mono"
                            onKeyDown={handleKeyDown}
                        />
                    )}
                </div>
            </div>

            {/* Generate Button */}
            {!hideGenerateButton && (
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || disabled}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                        flex items-center justify-center gap-3 relative overflow-hidden group
                        ${isGenerating || disabled
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-purple-600 text-white hover:scale-[1.02] hover:shadow-primary/25'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>正在生成...</span>
                            {/* Progress Bar Background */}
                            <div
                                className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </>
                    ) : (
                        <>
                            <Send size={20} className="group-hover:translate-x-1 transition-transform" />
                            <span>开始生成</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default NovelAIPromptArea;
