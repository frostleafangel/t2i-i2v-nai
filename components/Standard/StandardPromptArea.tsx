import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { TagAutocomplete } from '../TagAutocomplete';

interface Props {
    prefixPrompt: string;
    positivePrompt: string;
    suffixPrompt: string;
    negativePrompt: string;
    onPrefixChange: (val: string) => void;
    onPositiveChange: (val: string) => void;
    onSuffixChange: (val: string) => void;
    onNegativeChange: (val: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    disabled?: boolean;
    hideGenerateButton?: boolean;
    progress?: number;
}

// 折叠状态持久化 key
const COLLAPSE_STATE_KEY = 'standard_prompt_collapse_state';

interface CollapseState {
    prefix: boolean;
    suffix: boolean;
    negative: boolean;
}

const StandardPromptArea: React.FC<Props> = ({
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
    progress
}) => {
    const { t } = useLanguage();
    const mainTextareaRef = useRef<HTMLTextAreaElement>(null);

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
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onGenerate();
        }
    };

    // 折叠时显示的预览文本
    const CollapsedPreview = ({ text, onClick }: { text: string; onClick: () => void }) => (
        <div
            onClick={onClick}
            className="px-3 py-1.5 bg-surface/50 border border-border rounded-lg text-xs text-gray-500 truncate cursor-pointer hover:bg-surface transition-colors"
        >
            {text || <span className="italic opacity-50">（空）</span>}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 p-4">
            {/* 前置提示词 (Prefix Prompt) */}
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, prefix: !prev.prefix }))}
                    className="text-xs font-medium text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                >
                    {collapsed.prefix ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className={prefixPrompt ? 'text-primary' : ''}>{t.standardMode.prefixPrompt || '前置提示词'}</span>
                    <span className="text-[10px] opacity-50">{t.standardMode.prefixHint || '质量词/画风'}</span>
                </button>
                {collapsed.prefix ? (
                    <CollapsedPreview text={prefixPrompt} onClick={() => setCollapsed(prev => ({ ...prev, prefix: false }))} />
                ) : (
                    <TagAutocomplete
                        value={prefixPrompt}
                        onChange={onPrefixChange}
                        onKeyDown={handleKeyDown}
                        placeholder="masterpiece, best quality, ..."
                        disabled={disabled}
                        inputType="textarea"
                        rows={1}
                        maxRows={999}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-gray-300"
                    />
                )}
            </div>

            {/* 主提示词 (Main Prompt) */}
            <div className="space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                        <span>{t.standardMode.prompt}</span>
                        <span className="text-xs opacity-50">{t.standardMode.ctrlEnterHint}</span>
                    </label>
                    {/* 颜色图例 */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }}></span>通用</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }}></span>画师</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }}></span>作品</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}></span>角色</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }}></span>元数据</span>
                    </div>
                </div>
                <div className="relative">
                    <TagAutocomplete
                        inputRef={mainTextareaRef as React.RefObject<HTMLTextAreaElement>}
                        value={positivePrompt}
                        onChange={onPositiveChange}
                        onKeyDown={handleKeyDown}
                        placeholder={t.standardMode.promptPlaceholder}
                        disabled={disabled}
                        inputType="textarea"
                        rows={3}
                        maxRows={999}
                        className="w-full bg-surface border border-border rounded-xl p-4 pr-10 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                    />
                    {positivePrompt && !disabled && (
                        <button
                            onClick={() => onPositiveChange('')}
                            className="absolute top-3 right-3 text-text-secondary hover:text-white transition-colors z-10"
                        >
                            <XCircle size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* 后置提示词 (Suffix Prompt) */}
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, suffix: !prev.suffix }))}
                    className="text-xs font-medium text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                >
                    {collapsed.suffix ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className={suffixPrompt ? 'text-primary' : ''}>{t.standardMode.suffixPrompt || '后置提示词'}</span>
                    <span className="text-[10px] opacity-50">{t.standardMode.suffixHint || '附加修饰'}</span>
                </button>
                {collapsed.suffix ? (
                    <CollapsedPreview text={suffixPrompt} onClick={() => setCollapsed(prev => ({ ...prev, suffix: false }))} />
                ) : (
                    <TagAutocomplete
                        value={suffixPrompt}
                        onChange={onSuffixChange}
                        onKeyDown={handleKeyDown}
                        placeholder="detailed, sharp focus, ..."
                        disabled={disabled}
                        inputType="textarea"
                        rows={1}
                        maxRows={999}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-gray-300"
                    />
                )}
            </div>

            {/* 负面提示词 (Negative Prompt) */}
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, negative: !prev.negative }))}
                    className="text-xs font-medium text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                >
                    {collapsed.negative ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className={negativePrompt ? 'text-primary' : ''}>{t.standardMode.negativePrompt}</span>
                </button>
                {collapsed.negative ? (
                    <CollapsedPreview text={negativePrompt} onClick={() => setCollapsed(prev => ({ ...prev, negative: false }))} />
                ) : (
                    <TagAutocomplete
                        value={negativePrompt}
                        onChange={onNegativeChange}
                        onKeyDown={handleKeyDown}
                        placeholder={t.standardMode.negativePlaceholder}
                        disabled={disabled}
                        inputType="textarea"
                        rows={1}
                        maxRows={999}
                        className="w-full bg-surface border border-border rounded-lg p-3 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none text-gray-400 focus:text-gray-300"
                    />
                )}
            </div>

            {/* Generate Button */}
            {!hideGenerateButton && (
                <button
                    onClick={onGenerate}
                    disabled={disabled || !positivePrompt.trim() || isGenerating}
                    className={`
            w-full py-4 rounded-xl font-medium text-white shadow-lg transition-all transform 
            flex items-center justify-center gap-2 relative overflow-hidden group
            ${disabled
                            ? 'bg-surface cursor-not-allowed opacity-50'
                            : isGenerating
                                ? 'bg-neutral-700 cursor-not-allowed'
                                : 'bg-primary hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]'
                        }
            `}
                >
                    {/* Shimmer effect only when NOT disabled and NOT generating */}
                    {!disabled && !isGenerating && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] translate-x-[-200%] group-hover:animate-shimmer" />
                    )}

                    {isGenerating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>{t.standardMode.generating} {progress || 0}%</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} />
                            <span>{t.standardMode.generate}</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default StandardPromptArea;
