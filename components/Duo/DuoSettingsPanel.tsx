import React, { useState } from 'react';
import { DuoGenerationSettings, LoraConfig } from '../../types';
import { Settings, Sliders, Maximize2, Brush, Edit3 } from 'lucide-react';
import { VALID_SAMPLERS, VALID_SCHEDULERS } from '../../constants';
import ModelSelector from '../Standard/ModelSelector';
import LoraSelector from '../Standard/LoraSelector';
import MaskCanvasModal from './MaskCanvasModal';

interface Props {
    settings: DuoGenerationSettings;
    onChange: (newSettings: DuoGenerationSettings) => void;
    availableModels: string[];
    availableLoras: string[];
    isLoadingResources?: boolean;
}

const DuoSettingsPanel: React.FC<Props> = ({
    settings,
    onChange,
    availableModels,
    availableLoras,
    isLoadingResources
}) => {
    const [showMaskEditor, setShowMaskEditor] = useState(false);

    const handleChange = <K extends keyof DuoGenerationSettings>(
        key: K,
        value: DuoGenerationSettings[K]
    ) => {
        onChange({ ...settings, [key]: value });
    };

    // 分辨率变化时清空自定义 mask（防止尺寸不匹配）
    const handleResolutionChange = (width: number, height: number) => {
        onChange({
            ...settings,
            width,
            height,
            customMaskData: undefined // 清空已绘制的 mask
        });
    };

    // 分辨率预设
    const resolutionPresets = [
        { label: '2:3 竖', width: 832, height: 1216 },
        { label: '1:1', width: 1024, height: 1024 },
        { label: '3:2 横', width: 1216, height: 832 },
    ];

    return (
        <>
            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                {/* 基础设置 */}
                <div className="border-b border-white/5">
                    <div className="w-full p-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                            <Settings size={16} />
                            基础设置
                        </span>
                    </div>
                    <div className="p-3 pt-0 space-y-4">
                        {/* 模型选择 */}
                        <ModelSelector
                            models={availableModels || []}
                            selectedModel={settings.model}
                            onSelect={(v) => handleChange('model', v)}
                            isLoading={isLoadingResources}
                        />

                        {/* LoRA 选择 */}
                        <LoraSelector
                            selectedLoras={settings.loras || []}
                            availableLoras={availableLoras || []}
                            onChange={(v) => handleChange('loras', v)}
                            isLoading={isLoadingResources}
                        />
                    </div>
                </div>

                {/* 分区设置 */}
                <div className="border-b border-white/5">
                    <div className="w-full p-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                            <Sliders size={16} />
                            分区设置
                        </span>
                    </div>
                    <div className="p-3 pt-0 space-y-4">
                        {/* 分区方向 */}
                        <div>
                            <span className="text-xs text-gray-500 block mb-2">分区方向</span>
                            <div className="flex gap-2">
                                {[
                                    { value: 'vertical', label: '竖向', icon: '▏▕' },
                                    { value: 'horizontal', label: '横向', icon: '▔▁' },
                                    { value: 'diagonal', label: '对角', icon: '◢◣' }
                                ].map(({ value, label, icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => handleChange('splitDirection', value as DuoGenerationSettings['splitDirection'])}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all ${settings.splitDirection === value
                                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                                            : 'bg-darker border border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="text-lg">{icon}</div>
                                        <div>{label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 自定义 Mask 开关 */}
                        <div className="pt-3 border-t border-white/5">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="flex items-center gap-2 text-xs text-gray-500">
                                    <Brush size={14} />
                                    使用手绘 Mask
                                </span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={settings.useCustomMask || false}
                                        onChange={(e) => handleChange('useCustomMask', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-darker rounded-full peer peer-checked:bg-purple-500/50 transition-colors"></div>
                                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-purple-500 peer-checked:translate-x-4 transition-all"></div>
                                </div>
                            </label>
                        </div>

                        {/* 手绘 Mask 按钮 或 预设分区控件 */}
                        {settings.useCustomMask ? (
                            <div className="space-y-2">
                                {/* 打开绘制面板按钮 */}
                                <button
                                    onClick={() => setShowMaskEditor(true)}
                                    className="w-full py-3 px-4 rounded-lg bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={16} className="text-purple-400" />
                                    <span className="text-sm text-purple-300 font-medium">打开绘制面板</span>
                                </button>
                                {/* Mask 预览 */}
                                {settings.customMaskData && (
                                    <div className="relative">
                                        <img
                                            src={settings.customMaskData}
                                            alt="Mask 预览"
                                            className="w-full rounded-lg border border-white/10"
                                        />
                                        <div className="absolute bottom-1 right-1 text-[10px] bg-black/60 px-2 py-0.5 rounded text-gray-400">
                                            已绘制
                                        </div>
                                    </div>
                                )}
                                {!settings.customMaskData && (
                                    <p className="text-xs text-gray-500 text-center py-2">
                                        点击上方按钮开始绘制分区
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>

                                {/* 分区比例 */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs text-gray-500">分区比例</span>
                                        <span className="text-xs text-purple-400">
                                            A: {Math.round(settings.splitRatio * 100)}% | B: {Math.round((1 - settings.splitRatio) * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.3"
                                        max="0.7"
                                        step="0.05"
                                        value={settings.splitRatio}
                                        onChange={(e) => handleChange('splitRatio', parseFloat(e.target.value))}
                                        className="w-full accent-purple-500"
                                    />
                                    {/* 可视化预览 */}
                                    <div className="mt-2 h-12 rounded-lg overflow-hidden border border-white/10 flex">
                                        {settings.splitDirection === 'vertical' ? (
                                            <>
                                                <div className="bg-red-500/30 flex items-center justify-center text-xs" style={{ width: `${settings.splitRatio * 100}%` }}>A</div>
                                                <div className="bg-blue-500/30 flex items-center justify-center text-xs flex-1">B</div>
                                            </>
                                        ) : settings.splitDirection === 'horizontal' ? (
                                            <div className="w-full flex flex-col">
                                                <div className="bg-red-500/30 flex items-center justify-center text-xs" style={{ height: `${settings.splitRatio * 100}%` }}>A</div>
                                                <div className="bg-blue-500/30 flex items-center justify-center text-xs flex-1">B</div>
                                            </div>
                                        ) : (
                                            <div className="w-full relative">
                                                <div className="absolute inset-0 bg-red-500/30" style={{ clipPath: `polygon(0 0, ${settings.splitRatio * 100}% 0, 0 100%)` }}></div>
                                                <div className="absolute inset-0 bg-blue-500/30" style={{ clipPath: `polygon(${settings.splitRatio * 100}% 0, 100% 0, 100% 100%, 0 100%)` }}></div>
                                                <div className="absolute top-1 left-2 text-xs">A</div>
                                                <div className="absolute bottom-1 right-2 text-xs">B</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 画布/分辨率 */}
                <div className="border-b border-white/5">
                    <div className="w-full p-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                            <Maximize2 size={16} />
                            画布设置
                        </span>
                    </div>
                    <div className="p-3 pt-0 space-y-3">
                        {/* 预设按钮 */}
                        <div className="flex flex-wrap gap-1">
                            {resolutionPresets.map(({ label, width, height }) => (
                                <button
                                    key={label}
                                    onClick={() => handleResolutionChange(width, height)}
                                    className={`px-2 py-1 text-[10px] rounded ${settings.width === width && settings.height === height
                                        ? 'bg-purple-500/30 text-purple-300'
                                        : 'bg-darker hover:bg-white/10'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* 自定义分辨率输入 */}
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                                <span className="text-[10px] text-gray-500 block mb-1">宽度 (512-1536)</span>
                                <input
                                    type="number"
                                    value={settings.width || ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                        handleChange('width', isNaN(val) ? 0 : val);
                                    }}
                                    onBlur={() => {
                                        let val = settings.width;
                                        if (val < 512) val = 512;
                                        if (val > 1536) val = 1536;
                                        if (val !== settings.width) {
                                            handleResolutionChange(val, settings.height);
                                        }
                                    }}
                                    className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs text-center focus:border-purple-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 block mb-1">高度 (512-1536)</span>
                                <input
                                    type="number"
                                    value={settings.height || ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                        handleChange('height', isNaN(val) ? 0 : val);
                                    }}
                                    onBlur={() => {
                                        let val = settings.height;
                                        if (val < 512) val = 512;
                                        if (val > 1536) val = 1536;
                                        if (val !== settings.width) {
                                            handleResolutionChange(settings.width, val);
                                        }
                                    }}
                                    className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs text-center focus:border-purple-500 outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 采样设置 */}
                <div className="border-b border-white/5">
                    <div className="w-full p-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                            <Sliders size={16} />
                            采样设置
                        </span>
                    </div>
                    <div className="p-3 pt-0 space-y-3">
                        {/* Steps */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-gray-500">步数</span>
                                <span className="text-xs text-purple-400">{settings.steps}</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="50"
                                value={settings.steps}
                                onChange={(e) => handleChange('steps', parseInt(e.target.value))}
                                className="w-full accent-purple-500"
                            />
                        </div>

                        {/* CFG */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-gray-500">CFG</span>
                                <span className="text-xs text-purple-400">{settings.cfg}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="12"
                                step="0.5"
                                value={settings.cfg}
                                onChange={(e) => handleChange('cfg', parseFloat(e.target.value))}
                                className="w-full accent-purple-500"
                            />
                        </div>

                        {/* Sampler */}
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">采样器</span>
                            <select
                                value={settings.sampler}
                                onChange={(e) => handleChange('sampler', e.target.value)}
                                className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs"
                            >
                                {VALID_SAMPLERS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Scheduler */}
                        <div>
                            <span className="text-xs text-gray-500 block mb-1">调度器</span>
                            <select
                                value={settings.scheduler}
                                onChange={(e) => handleChange('scheduler', e.target.value)}
                                className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs"
                            >
                                {VALID_SCHEDULERS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 放大设置 */}
                <div>
                    <div className="w-full p-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                            <Maximize2 size={16} />
                            放大设置
                        </span>
                    </div>
                    <div className="p-3 pt-0 space-y-3">
                        {/* 启用放大 */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-gray-500">启用放大</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={settings.enableUpscale}
                                    onChange={(e) => handleChange('enableUpscale', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-darker rounded-full peer peer-checked:bg-purple-500/50 transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-purple-500 peer-checked:translate-x-4 transition-all"></div>
                            </div>
                        </label>

                        {settings.enableUpscale && (
                            <>
                                {/* 放大倍数 */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs text-gray-500">放大倍数</span>
                                        <span className="text-xs text-purple-400">{settings.upscaleFactor}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.1"
                                        max="2"
                                        step="0.05"
                                        value={settings.upscaleFactor}
                                        onChange={(e) => handleChange('upscaleFactor', parseFloat(e.target.value))}
                                        className="w-full accent-purple-500"
                                    />
                                </div>

                                {/* 去噪强度 */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs text-gray-500">去噪强度</span>
                                        <span className="text-xs text-purple-400">{settings.upscaleDenoise}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.05"
                                        max="0.5"
                                        step="0.05"
                                        value={settings.upscaleDenoise}
                                        onChange={(e) => handleChange('upscaleDenoise', parseFloat(e.target.value))}
                                        className="w-full accent-purple-500"
                                    />
                                </div>

                                {/* 二次放大 */}
                                <label className="flex items-center justify-between cursor-pointer mt-4 pt-3 border-t border-white/5">
                                    <span className="text-xs text-gray-500">二次放大</span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={settings.enableSecondUpscale}
                                            onChange={(e) => handleChange('enableSecondUpscale', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-darker rounded-full peer peer-checked:bg-purple-500/50 transition-colors"></div>
                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-purple-500 peer-checked:translate-x-4 transition-all"></div>
                                    </div>
                                </label>

                                {settings.enableSecondUpscale && (
                                    <div className="pl-3 border-l-2 border-purple-500/30 space-y-2">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[10px] text-gray-500">倍数</span>
                                                <span className="text-[10px] text-purple-400">{settings.secondUpscaleFactor}x</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1.05"
                                                max="1.25"
                                                step="0.05"
                                                value={settings.secondUpscaleFactor}
                                                onChange={(e) => handleChange('secondUpscaleFactor', parseFloat(e.target.value))}
                                                className="w-full accent-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[10px] text-gray-500">去噪</span>
                                                <span className="text-[10px] text-purple-400">{settings.secondUpscaleDenoise}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.05"
                                                max="0.4"
                                                step="0.05"
                                                value={settings.secondUpscaleDenoise}
                                                onChange={(e) => handleChange('secondUpscaleDenoise', parseFloat(e.target.value))}
                                                className="w-full accent-purple-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 全屏手绘面板 */}
            {
                showMaskEditor && (
                    <MaskCanvasModal
                        width={settings.width || 1024}
                        height={settings.height || 1024}
                        onSave={(maskData) => handleChange('customMaskData', maskData)}
                        onClose={() => setShowMaskEditor(false)}
                        initialMaskData={settings.customMaskData}
                    />
                )
            }
        </>
    );
};

export default DuoSettingsPanel;
