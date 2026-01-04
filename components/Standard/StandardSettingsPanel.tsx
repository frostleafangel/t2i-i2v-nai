import React, { useState } from 'react';
import { StandardGenerationSettings, LoraConfig, StyleConfig } from '../../types';
import { Settings, Sliders, Hash, Activity, CalendarClock, Maximize2, Palette } from 'lucide-react';
import { VALID_SAMPLERS, VALID_SCHEDULERS } from '../../constants';
import ModelSelector from './ModelSelector';
import LoraSelector from './LoraSelector';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
    settings: StandardGenerationSettings;
    onChange: (newSettings: StandardGenerationSettings) => void;
    availableModels: string[];
    availableLoras: string[];
    availableDetectors?: string[]; // 检测器模型列表
    isLoadingResources?: boolean;
    currentImage?: string; // 当前选中的图片，作为封面
    onApplyStyle: (config: StyleConfig) => void; // 应用风格回调
    onShowStyleManager?: () => void; // 打开风格库
}

const MIN_SIZE = 512;
const MAX_SIZE = 2048;

const StandardSettingsPanel: React.FC<Props> = ({
    settings,
    onChange,
    availableModels,
    availableLoras,
    availableDetectors = [],
    isLoadingResources,
    currentImage,
    onApplyStyle,
    onShowStyleManager
}) => {
    const { t } = useLanguage();
    const [widthInput, setWidthInput] = useState(String(settings.width));
    const [heightInput, setHeightInput] = useState(String(settings.height));

    const handleChange = (key: keyof StandardGenerationSettings, value: any) => {
        onChange({ ...settings, [key]: value });
    };

    const handleLorasChange = (newLoras: LoraConfig[]) => {
        handleChange('loras', newLoras);
    };

    return (
        <div className="bg-surface rounded-2xl p-6 border border-white/5 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                    <Settings size={20} />
                    <span>{t.settings.title}</span>
                </div>
                {onShowStyleManager && (
                    <button
                        onClick={onShowStyleManager}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg text-xs font-medium hover:shadow-lg hover:scale-105 transition-all"
                    >
                        <Palette size={14} />
                        风格库
                    </button>
                )}
            </div>

            {/* Model Selector */}
            <ModelSelector
                models={availableModels}
                selectedModel={settings.model}
                onSelect={(model) => handleChange('model', model)}
                isLoading={isLoadingResources}
            />

            {/* LoRA Selector */}
            <LoraSelector
                availableLoras={availableLoras}
                selectedLoras={settings.loras}
                onChange={handleLorasChange}
                isLoading={isLoadingResources}
            />

            {/* Resolution */}
            <div className="space-y-3">
                <label className="text-sm text-gray-400 font-medium">{t.standardMode.settingsPanel.resolution}</label>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="text-xs text-gray-500 mb-1 block">{t.standardMode.settingsPanel.width}</span>
                        <input
                            type="number"
                            min={MIN_SIZE}
                            max={MAX_SIZE}
                            value={widthInput}
                            onChange={(e) => setWidthInput(e.target.value)}
                            onBlur={() => {
                                const parsed = parseInt(widthInput);
                                const clamped = isNaN(parsed) ? MIN_SIZE : Math.max(MIN_SIZE, Math.min(MAX_SIZE, parsed));
                                setWidthInput(String(clamped));
                                handleChange('width', clamped);
                            }}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 mb-1 block">{t.standardMode.settingsPanel.height}</span>
                        <input
                            type="number"
                            min={MIN_SIZE}
                            max={MAX_SIZE}
                            value={heightInput}
                            onChange={(e) => setHeightInput(e.target.value)}
                            onBlur={() => {
                                const parsed = parseInt(heightInput);
                                const clamped = isNaN(parsed) ? MIN_SIZE : Math.max(MIN_SIZE, Math.min(MAX_SIZE, parsed));
                                setHeightInput(String(clamped));
                                handleChange('height', clamped);
                            }}
                            className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setWidthInput('832'); setHeightInput('1216'); onChange({ ...settings, width: 832, height: 1216 }); }}
                        className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
                    >
                        {t.settings.portrait} (832x1216)
                    </button>
                    <button
                        onClick={() => { setWidthInput('1216'); setHeightInput('832'); onChange({ ...settings, width: 1216, height: 832 }); }}
                        className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
                    >
                        {t.settings.landscape} (1216x832)
                    </button>
                    <button
                        onClick={() => { setWidthInput('1024'); setHeightInput('1024'); onChange({ ...settings, width: 1024, height: 1024 }); }}
                        className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
                    >
                        {t.settings.square} (1024x1024)
                    </button>
                </div>
            </div>

            {/* Steps & CFG */}
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">{t.standardMode.settingsPanel.steps}</span>
                        <span className="text-primary font-mono">{settings.steps}</span>
                    </div>
                    <input
                        type="range"
                        min="20" max="60" step="1"
                        value={settings.steps}
                        onChange={(e) => handleChange('steps', parseInt(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-darker rounded-full appearance-none cursor-pointer"
                    />
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">{t.standardMode.settingsPanel.cfg}</span>
                        <span className="text-primary font-mono">{settings.cfg}</span>
                    </div>
                    <input
                        type="range"
                        min="1" max="15" step="0.5"
                        value={settings.cfg}
                        onChange={(e) => handleChange('cfg', parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-darker rounded-full appearance-none cursor-pointer"
                    />
                </div>
            </div>

            {/* Sampler & Scheduler */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Activity size={10} /> {t.standardMode.settingsPanel.sampler}
                    </label>
                    <select
                        value={settings.sampler_name}
                        onChange={(e) => handleChange('sampler_name', e.target.value)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-primary appearance-none"
                    >
                        {VALID_SAMPLERS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <CalendarClock size={10} /> {t.standardMode.settingsPanel.scheduler}
                    </label>
                    <select
                        value={settings.scheduler}
                        onChange={(e) => handleChange('scheduler', e.target.value)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-primary appearance-none"
                    >
                        {VALID_SCHEDULERS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Seed */}
            <div>
                <label className="text-sm text-gray-400 font-medium flex items-center gap-2 mb-2">
                    <Hash size={14} /> {t.standardMode.settingsPanel.seed}
                </label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        placeholder={t.standardMode.settingsPanel.randomSeed}
                        value={settings.seed}
                        onChange={(e) => handleChange('seed', parseInt(e.target.value))}
                        className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                    <button
                        onClick={() => handleChange('seed', -1)}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-xs whitespace-nowrap border border-white/5"
                    >
                        {t.settings.randomSeed}
                    </button>
                </div>
            </div>

            {/* Auto Upscale Toggle */}
            <div className="border-t border-white/5 pt-4">
                <label className="flex items-center justify-between cursor-pointer group">
                    <span className="flex items-center gap-2 text-sm text-gray-400 font-medium group-hover:text-gray-300 transition-colors">
                        <Maximize2 size={14} /> {t.standardMode.settingsPanel.upscale}
                    </span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={settings.enableUpscale}
                            onChange={(e) => handleChange('enableUpscale', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-darker rounded-full peer peer-checked:bg-primary/50 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-primary peer-checked:translate-x-5 transition-all"></div>
                    </div>
                </label>
                <p className="text-xs text-gray-600 mt-1">{t.standardMode.settingsPanel.upscaleHint}</p>

                {/* 放大参数设置 - 只在启用放大时显示 */}
                {settings.enableUpscale && (
                    <div className="mt-4 space-y-3 pl-4 border-l-2 border-primary/30">
                        {/* 放大倍数 */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500">{t.standardMode.settingsPanel.upscaleBy || '放大倍数'}</span>
                                <span className="text-xs text-primary font-mono">{settings.upscaleBy?.toFixed(2) || 1.5}x</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={2}
                                step={0.05}
                                value={settings.upscaleBy || 1.5}
                                onChange={(e) => handleChange('upscaleBy', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-darker rounded-full appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        {/* 去噪强度 */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500">{t.standardMode.settingsPanel.upscaleDenoise || '去噪强度'}</span>
                                <span className="text-xs text-primary font-mono">{settings.upscaleDenoise?.toFixed(2) || 0.2}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={settings.upscaleDenoise || 0.2}
                                onChange={(e) => handleChange('upscaleDenoise', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-darker rounded-full appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        {/* 步数 */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500">{t.standardMode.settingsPanel.steps}</span>
                                <span className="text-xs text-primary font-mono">{settings.upscaleSteps || 20}</span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={40}
                                step={1}
                                value={settings.upscaleSteps || 20}
                                onChange={(e) => handleChange('upscaleSteps', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-darker rounded-full appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        {/* CFG */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500">{t.standardMode.settingsPanel.cfg}</span>
                                <span className="text-xs text-primary font-mono">{settings.upscaleCfg?.toFixed(1) || 4.5}</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.5}
                                value={settings.upscaleCfg || 4.5}
                                onChange={(e) => handleChange('upscaleCfg', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-darker rounded-full appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        {/* 采样器 */}
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">{t.standardMode.settingsPanel.sampler}</span>
                            <select
                                value={settings.upscaleSampler || 'euler'}
                                onChange={(e) => handleChange('upscaleSampler', e.target.value)}
                                className="w-full bg-darker border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                            >
                                {VALID_SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* 调度器 */}
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">{t.standardMode.settingsPanel.scheduler}</span>
                            <select
                                value={settings.upscaleScheduler || 'karras'}
                                onChange={(e) => handleChange('upscaleScheduler', e.target.value)}
                                className="w-full bg-darker border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                            >
                                {VALID_SCHEDULERS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* 二次放大设置 - 只在启用一次放大时显示 */}
                {settings.enableUpscale && (
                    <div className="mt-4 pt-3 border-t border-white/5">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                {t.standardMode.settingsPanel.secondUpscale || '二次放大'}
                            </span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={settings.enableSecondUpscale}
                                    onChange={(e) => handleChange('enableSecondUpscale', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-darker rounded-full peer peer-checked:bg-secondary/50 transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-secondary peer-checked:translate-x-4 transition-all"></div>
                            </div>
                        </label>
                        <p className="text-[10px] text-gray-600 mt-1">{t.standardMode.settingsPanel.secondUpscaleHint || '进一步增强细节'}</p>

                        {settings.enableSecondUpscale && (
                            <div className="mt-3 space-y-2.5 pl-3 border-l-2 border-secondary/30">
                                {/* 二次放大倍数 */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-gray-500">{t.standardMode.settingsPanel.upscaleBy || '放大倍数'}</span>
                                        <span className="text-[10px] text-secondary font-mono">{settings.secondUpscaleBy?.toFixed(2) || 1.1}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={1.25}
                                        step={0.05}
                                        value={settings.secondUpscaleBy || 1.1}
                                        onChange={(e) => handleChange('secondUpscaleBy', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-darker rounded-full appearance-none cursor-pointer accent-secondary"
                                    />
                                </div>

                                {/* 二次放大去噪强度 */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-gray-500">{t.standardMode.settingsPanel.upscaleDenoise || '去噪强度'}</span>
                                        <span className="text-[10px] text-secondary font-mono">{settings.secondUpscaleDenoise?.toFixed(2) || 0.25}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={0.5}
                                        step={0.05}
                                        value={settings.secondUpscaleDenoise || 0.25}
                                        onChange={(e) => handleChange('secondUpscaleDenoise', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-darker rounded-full appearance-none cursor-pointer accent-secondary"
                                    />
                                </div>

                                {/* 二次放大步数 */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-gray-500">{t.standardMode.settingsPanel.steps}</span>
                                        <span className="text-[10px] text-secondary font-mono">{settings.secondUpscaleSteps || 20}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={10}
                                        max={40}
                                        step={1}
                                        value={settings.secondUpscaleSteps || 20}
                                        onChange={(e) => handleChange('secondUpscaleSteps', parseInt(e.target.value))}
                                        className="w-full h-1 bg-darker rounded-full appearance-none cursor-pointer accent-secondary"
                                    />
                                </div>

                                {/* 二次放大 CFG */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-gray-500">{t.standardMode.settingsPanel.cfg}</span>
                                        <span className="text-[10px] text-secondary font-mono">{settings.secondUpscaleCfg?.toFixed(1) || 5}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        step={0.5}
                                        value={settings.secondUpscaleCfg || 5}
                                        onChange={(e) => handleChange('secondUpscaleCfg', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-darker rounded-full appearance-none cursor-pointer accent-secondary"
                                    />
                                </div>

                                {/* 二次放大采样器 */}
                                <div>
                                    <span className="text-[10px] text-gray-500 block mb-1">{t.standardMode.settingsPanel.sampler}</span>
                                    <select
                                        value={settings.secondUpscaleSampler || 'euler'}
                                        onChange={(e) => handleChange('secondUpscaleSampler', e.target.value)}
                                        className="w-full bg-darker border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-secondary"
                                    >
                                        {VALID_SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* 二次放大调度器 */}
                                <div>
                                    <span className="text-[10px] text-gray-500 block mb-1">{t.standardMode.settingsPanel.scheduler}</span>
                                    <select
                                        value={settings.secondUpscaleScheduler || 'normal'}
                                        onChange={(e) => handleChange('secondUpscaleScheduler', e.target.value)}
                                        className="w-full bg-darker border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-secondary"
                                    >
                                        {VALID_SCHEDULERS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* FaceDetailer 设置 - 只在二次放大启用时显示 */}
                        {settings.enableSecondUpscale && (
                            <div className="mt-4 pt-3 border-t border-white/5">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <span className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                        面部修复
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={settings.enableFaceDetailer}
                                            onChange={(e) => handleChange('enableFaceDetailer', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-darker rounded-full peer peer-checked:bg-pink-500/50 transition-colors"></div>
                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-pink-500 peer-checked:translate-x-4 transition-all"></div>
                                    </div>
                                </label>
                                <p className="text-[10px] text-gray-600 mt-1">使用 FaceDetailer 修复面部细节</p>

                                {/* 检测器模型选择 - 只在启用 FaceDetailer 时显示 */}
                                {settings.enableFaceDetailer && (
                                    <div className="mt-3 pl-3 border-l-2 border-pink-500/30">
                                        <span className="text-[10px] text-gray-500 block mb-1">检测器模型</span>
                                        <select
                                            value={settings.faceDetectorModel || (availableDetectors[0] || 'bbox/face_yolov8m.pt')}
                                            onChange={(e) => handleChange('faceDetectorModel', e.target.value)}
                                            className="w-full bg-darker border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-pink-500"
                                        >
                                            {availableDetectors.length > 0 ? (
                                                availableDetectors.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))
                                            ) : (
                                                <option value="bbox/face_yolov8m.pt">bbox/face_yolov8m.pt</option>
                                            )}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StandardSettingsPanel;
