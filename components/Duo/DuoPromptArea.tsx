import React, { useState, useEffect } from 'react';
import { DuoGenerationSettings } from '../../types';
import { Sparkles, ChevronDown, ChevronRight, User, Users, Image as ImageIcon, ArrowRightLeft } from 'lucide-react';
import { TagAutocomplete } from '../TagAutocomplete';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
    settings: DuoGenerationSettings;
    onSettingsChange: (settings: DuoGenerationSettings) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    progress: number;
    hideGenerateButton?: boolean;
}

// Persist collapse state like Standard Mode
const COLLAPSE_STATE_KEY = 'duo_prompt_collapse_state';

interface CollapseState {
    quality: boolean;
    main: boolean;
    characterA: boolean;
    characterB: boolean;
    negative: boolean;
}

const DuoPromptArea: React.FC<Props> = ({
    settings,
    onSettingsChange,
    onGenerate,
    isGenerating,
    progress,
    hideGenerateButton = false
}) => {
    // We can use language context if we want to localize later, for now hardcoded Chinese as per DuoApp
    const { t } = useLanguage();

    const [collapsed, setCollapsed] = useState<CollapseState>(() => {
        try {
            const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
            return saved ? JSON.parse(saved) : { quality: false, main: false, characterA: false, characterB: false, negative: false };
        } catch {
            return { quality: false, main: false, characterA: false, characterB: false, negative: false };
        }
    });

    useEffect(() => {
        localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(collapsed));
    }, [collapsed]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onGenerate();
        }
    };

    const handleChange = <K extends keyof DuoGenerationSettings>(
        key: K,
        value: DuoGenerationSettings[K]
    ) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const toggleCollapse = (key: keyof CollapseState) => {
        setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Preview component for collapsed sections
    const CollapsedPreview = ({ text, onClick, placeholder = "（空）" }: { text: string; onClick: () => void; placeholder?: string }) => (
        <div
            onClick={onClick}
            className="px-3 py-1.5 bg-surface/50 border border-white/5 rounded-lg text-xs text-gray-500 truncate cursor-pointer hover:bg-surface transition-colors"
        >
            {text || <span className="italic opacity-50">{placeholder}</span>}
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="bg-surface rounded-2xl border border-white/5 p-3 flex flex-col gap-4">

                {/* 1. Quality/Prefix Prompt */}
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => toggleCollapse('quality')}
                        className="text-xs font-medium text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                    >
                        {collapsed.quality ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <Sparkles size={12} className="text-yellow-400" />
                        <span className={settings.qualityPrompt ? 'text-primary' : ''}>前置提示词</span>
                        <span className="text-[10px] opacity-50">画风/质量</span>
                    </button>
                    {collapsed.quality ? (
                        <CollapsedPreview text={settings.qualityPrompt} onClick={() => toggleCollapse('quality')} />
                    ) : (
                        <TagAutocomplete
                            value={settings.qualityPrompt}
                            onChange={(v) => handleChange('qualityPrompt', v)}
                            onKeyDown={handleKeyDown}
                            placeholder="masterpiece, best quality, aesthetic..."
                            inputType="textarea"
                            rows={1}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-gray-300"
                        />
                    )}
                </div>

                {/* 2. Main Prompt (Scene/Environment) */}
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => toggleCollapse('main')}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-300 hover:text-gray-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {collapsed.main ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <Users size={14} className="text-purple-400" />
                            <span>主体提示词</span>
                            <span className="text-xs text-gray-500 font-normal">场景/环境 (Ctrl+Enter 生成)</span>
                        </div>
                    </button>

                    {!collapsed.main ? (
                        <TagAutocomplete
                            value={settings.mainPrompt}
                            onChange={(v) => handleChange('mainPrompt', v)}
                            onKeyDown={handleKeyDown}
                            placeholder="2girls, yuri, hug, school classroom..."
                            inputType="textarea"
                            rows={3}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary transition-all resize-none text-white"
                        />
                    ) : (
                        <div onClick={() => toggleCollapse('main')} className="pt-1">
                            <CollapsedPreview
                                text={settings.mainPrompt}
                                onClick={() => toggleCollapse('main')}
                            />
                        </div>
                    )}
                </div>

                {/* 3. Character A Section */}
                <div className="space-y-1 border-t border-white/5 pt-2">
                    <button
                        type="button"
                        onClick={() => toggleCollapse('characterA')}
                        className="w-full flex items-center justify-between text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {collapsed.characterA ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <div className="w-2 h-2 rounded-full bg-red-500/70" />
                            <span className={settings.characterAPrompt || settings.characterADetails ? 'text-red-400' : ''}>角色 A</span>
                        </div>
                    </button>

                    {!collapsed.characterA ? (
                        <div className="pl-4 space-y-3 pt-1">
                            {/* Action/Pose */}
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">动作/姿势</label>
                                <TagAutocomplete
                                    value={settings.characterAPrompt}
                                    onChange={(v) => handleChange('characterAPrompt', v)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="standing, looking at viewer, smile..."
                                    inputType="textarea"
                                    rows={1}
                                    maxRows={999}
                                    className="w-full bg-darker border border-red-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 text-gray-300"
                                />
                            </div>
                            {/* Appearance */}
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">外貌特征</label>
                                <TagAutocomplete
                                    value={settings.characterADetails}
                                    onChange={(v) => handleChange('characterADetails', v)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="1girl, white hair, blue eyes..."
                                    inputType="textarea"
                                    rows={1}
                                    maxRows={999}
                                    className="w-full bg-darker border border-red-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 text-gray-300"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="pl-4 pt-1" onClick={() => toggleCollapse('characterA')}>
                            <CollapsedPreview
                                text={[settings.characterAPrompt, settings.characterADetails].filter(Boolean).join(' | ')}
                                onClick={() => toggleCollapse('characterA')}
                                placeholder="点击设置角色A详情"
                            />
                        </div>
                    )}
                </div>

                {/* 4. Character B Section */}
                <div className="space-y-1 border-t border-white/5 pt-2 relative">
                    {/* Swap Button - Centered on divider */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <button
                            type="button"
                            onClick={() => {
                                onSettingsChange({
                                    ...settings,
                                    characterADetails: settings.characterBDetails,
                                    characterBDetails: settings.characterADetails
                                });
                            }}
                            className="bg-darker border border-white/10 hover:border-purple-500 text-gray-500 hover:text-purple-400 rounded-full p-1 transition-all shadow-sm"
                            title="交换 AB 外貌 (保持动作不变)"
                        >
                            <ArrowRightLeft size={12} />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => toggleCollapse('characterB')}
                        className="w-full flex items-center justify-between text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {collapsed.characterB ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <div className="w-2 h-2 rounded-full bg-blue-500/70" />
                            <span className={settings.characterBPrompt || settings.characterBDetails ? 'text-blue-400' : ''}>角色 B</span>
                        </div>
                    </button>

                    {!collapsed.characterB ? (
                        <div className="pl-4 space-y-3 pt-1">
                            {/* Action/Pose */}
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">动作/姿势</label>
                                <TagAutocomplete
                                    value={settings.characterBPrompt}
                                    onChange={(v) => handleChange('characterBPrompt', v)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="sitting, looking away..."
                                    inputType="textarea"
                                    rows={1}
                                    maxRows={999}
                                    className="w-full bg-darker border border-blue-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-gray-300"
                                />
                            </div>
                            {/* Appearance */}
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">外貌特征</label>
                                <TagAutocomplete
                                    value={settings.characterBDetails}
                                    onChange={(v) => handleChange('characterBDetails', v)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="1girl, black hair, red eyes..."
                                    inputType="textarea"
                                    rows={1}
                                    maxRows={999}
                                    className="w-full bg-darker border border-blue-500/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-gray-300"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="pl-4 pt-1" onClick={() => toggleCollapse('characterB')}>
                            <CollapsedPreview
                                text={[settings.characterBPrompt, settings.characterBDetails].filter(Boolean).join(' | ')}
                                onClick={() => toggleCollapse('characterB')}
                                placeholder="点击设置角色B详情"
                            />
                        </div>
                    )}
                </div>

                {/* 5. Negative Prompt */}
                <div className="space-y-1 border-t border-white/5 pt-2">
                    <button
                        type="button"
                        onClick={() => toggleCollapse('negative')}
                        className="text-xs font-medium text-gray-500 flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer w-full text-left"
                    >
                        {collapsed.negative ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <ImageIcon size={12} className="text-red-400" />
                        <span className={settings.negativePrompt ? 'text-primary' : ''}>负面提示词</span>
                    </button>
                    {collapsed.negative ? (
                        <CollapsedPreview text={settings.negativePrompt} onClick={() => toggleCollapse('negative')} />
                    ) : (
                        <TagAutocomplete
                            value={settings.negativePrompt}
                            onChange={(v) => handleChange('negativePrompt', v)}
                            onKeyDown={handleKeyDown}
                            placeholder="lowres, bad quality, worst quality..."
                            inputType="textarea"
                            rows={1}
                            maxRows={999}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-400/50 text-gray-400"
                        />
                    )}
                </div>
            </div>

            {/* Generate Button */}
            {!hideGenerateButton && (
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || !settings.model}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                        flex items-center justify-center gap-3 relative overflow-hidden group
                        ${isGenerating || !settings.model
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-[1.02] hover:shadow-purple-500/25'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>生成中... {progress}%</span>
                            {/* Progress Bar Background */}
                            <div
                                className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </>
                    ) : (
                        <>
                            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                            <span>生成双人图</span>
                        </>
                    )}
                </button>
            )}
            {!hideGenerateButton && !settings.model && (
                <p className="text-xs text-red-400 text-center">请先选择模型</p>
            )}
        </div>
    );
};

export default DuoPromptArea;
