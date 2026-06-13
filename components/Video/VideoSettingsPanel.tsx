/**
 * 视频参数设置面板
 */

import React from 'react';
import { VideoGenerationSettings, LoraConfig } from '../../types';
import { Sliders, Clock, Film, Dice5, ChevronDown, ChevronRight } from 'lucide-react';
import LoraSelector from '../Standard/LoraSelector';

interface VideoSettingsPanelProps {
    settings: VideoGenerationSettings;
    onChange: (settings: VideoGenerationSettings) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    availableLoras?: string[];
    isLoadingLoras?: boolean;
}

const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
    settings,
    onChange,
    isCollapsed = false,
    onToggleCollapse,
    availableLoras = [],
    isLoadingLoras = false
}) => {
    const handleChange = <K extends keyof VideoGenerationSettings>(
        key: K,
        value: VideoGenerationSettings[K]
    ) => {
        onChange({ ...settings, [key]: value });
    };

    const randomizeSeed = () => {
        handleChange('seed', Math.floor(Math.random() * 1000000000000000));
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-between text-white font-medium py-2"
            >
                <span className="flex items-center gap-2">
                    <Sliders size={16} className="text-primary" />
                    生成参数
                </span>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            </button>

            {!isCollapsed && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    {/* LORA 选择器 */}
                    {availableLoras.length > 0 && (
                        <LoraSelector
                            availableLoras={availableLoras}
                            selectedLoras={settings.loras || []}
                            onChange={(loras) => handleChange('loras', loras)}
                            isLoading={isLoadingLoras}
                        />
                    )}

                    {/* 时长 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400 flex items-center gap-1.5">
                                <Clock size={14} />
                                视频时长
                            </label>
                            <span className="text-sm font-medium text-white">{settings.duration} 秒</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="8"
                            step="1"
                            value={settings.duration}
                            onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>1s</span>
                            <span>8s</span>
                        </div>
                    </div>

                    {/* 帧率 */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 flex items-center gap-1.5">
                            <Film size={14} />
                            帧率
                        </label>
                        <div className="flex gap-2">
                            {[16, 24].map((fps) => (
                                <button
                                    key={fps}
                                    onClick={() => handleChange('frameRate', fps)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${settings.frameRate === fps
                                        ? 'bg-primary text-white'
                                        : 'bg-surface text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {fps} fps
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 步数 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">采样步数</label>
                            <span className="text-sm font-medium text-white">{settings.steps}</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="8"
                            step="1"
                            value={settings.steps}
                            onChange={(e) => handleChange('steps', parseInt(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>2 (快速)</span>
                            <span>8 (高质量)</span>
                        </div>
                    </div>

                    {/* 精炼步数 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">精炼步数</label>
                            <span className="text-sm font-medium text-white">{settings.refinerStep}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max={settings.steps - 1}
                            step="1"
                            value={settings.refinerStep}
                            onChange={(e) => handleChange('refinerStep', parseInt(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* CFG */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">CFG Scale</label>
                            <span className="text-sm font-medium text-white">{settings.cfg}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.5"
                            value={settings.cfg}
                            onChange={(e) => handleChange('cfg', parseFloat(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* CRF (视频质量) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">视频质量 (CRF)</label>
                            <span className="text-sm font-medium text-white">{settings.crf}</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="40"
                            step="1"
                            value={settings.crf}
                            onChange={(e) => handleChange('crf', parseInt(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>10 (高质量/大文件)</span>
                            <span>40 (低质量/小文件)</span>
                        </div>
                    </div>

                    {/* Shift High */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">Shift High</label>
                            <span className="text-sm font-medium text-white">{settings.shiftHigh}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={settings.shiftHigh}
                            onChange={(e) => handleChange('shiftHigh', parseFloat(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* Shift Low */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400">Shift Low</label>
                            <span className="text-sm font-medium text-white">{settings.shiftLow}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={settings.shiftLow}
                            onChange={(e) => handleChange('shiftLow', parseFloat(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* 采样器 */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">采样器</label>
                        <select
                            value={settings.samplerName}
                            onChange={(e) => handleChange('samplerName', e.target.value)}
                            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        >
                            <option value="uni_pc_bh2">uni_pc_bh2</option>
                            <option value="euler">euler</option>
                            <option value="euler_ancestral">euler_ancestral</option>
                            <option value="dpmpp_2m">dpmpp_2m</option>
                            <option value="dpmpp_sde">dpmpp_sde</option>
                        </select>
                    </div>

                    {/* 调度器 */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">调度器</label>
                        <select
                            value={settings.scheduler}
                            onChange={(e) => handleChange('scheduler', e.target.value)}
                            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        >
                            <option value="beta">beta</option>
                            <option value="normal">normal</option>
                            <option value="simple">simple</option>
                            <option value="karras">karras</option>
                        </select>
                    </div>

                    {/* 种子 */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 flex items-center gap-1.5">
                            <Dice5 size={14} />
                            随机种子
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={settings.seed}
                                onChange={(e) => handleChange('seed', parseInt(e.target.value) || -1)}
                                className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                placeholder="-1 为随机"
                            />
                            <button
                                onClick={randomizeSeed}
                                className="px-3 py-2 bg-surface border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-primary transition-colors"
                                title="随机生成"
                            >
                                <Dice5 size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">输入 -1 表示随机种子</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoSettingsPanel;
