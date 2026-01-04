import React, { useState } from 'react';
import { NovelAIGenerationSettings, UCPreset, NoiseSchedule, NAI4AqtPreset, CharacterPromptConfig, VibeReference } from '../../types';
import { Settings, ChevronDown, ChevronRight, Hash, Sparkles, Zap, Wand2, Image } from 'lucide-react';
import CharacterPromptsPanel from './CharacterPromptsPanel';
import VibeTransferPanel from './VibeTransferPanel';

interface Props {
    settings: NovelAIGenerationSettings;
    onChange: (newSettings: NovelAIGenerationSettings) => void;
}

// NAI Models
const MODELS = [
    { id: 'nai-diffusion-3', name: 'NovelAI Diffusion V3' },
    { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated' },
    { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full' },
    { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated' },
    { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full' },
];

const SAMPLERS = [
    "k_euler", "k_euler_ancestral", "k_dpmpp_2s_ancestral",
    "k_dpmpp_2m", "k_dpmpp_sde", "ddim_v3"
];

const UC_PRESETS: UCPreset[] = ['Heavy', 'Light', 'None', 'Human Focus'];
const NOISE_SCHEDULES: NoiseSchedule[] = ['native', 'karras', 'exponential', 'polyexponential'];
const AQT_PRESETS: NAI4AqtPreset[] = ['safe', 'nai', 'full', 'balanced', 'anime', 'furry', 'pony'];

interface CollapsibleSectionProps {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, defaultOpen = false, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-white/5 last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-white/5 transition-colors rounded-lg px-2 -mx-2"
            >
                <div className="flex items-center gap-2 text-gray-300 font-medium text-sm">
                    {icon}
                    {title}
                </div>
                {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
            </button>
            {isOpen && <div className="pb-4 space-y-4">{children}</div>}
        </div>
    );
};

const NovelAISettingsPanel: React.FC<Props> = ({ settings, onChange }) => {

    const handleChange = <K extends keyof NovelAIGenerationSettings>(key: K, value: NovelAIGenerationSettings[K]) => {
        onChange({ ...settings, [key]: value });
    };

    const isV3 = settings.model === 'nai-diffusion-3';
    const isV4 = settings.model.startsWith('nai-diffusion-4');

    return (
        <div className="bg-surface rounded-2xl p-4 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b border-white/5">
                <Settings size={18} />
                <span>NovelAI 设置</span>
            </div>

            {/* Basic Settings - Always Open */}
            <CollapsibleSection title="基础设置" icon={<Sparkles size={14} />} defaultOpen={true}>
                {/* Model */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">模型</label>
                    <select
                        value={settings.model}
                        onChange={(e) => handleChange('model', e.target.value)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        {MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                {/* Resolution */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                        分辨率 <span className="text-gray-600">(总像素 ≤ 1472×1472 = {(1472 * 1472).toLocaleString()})</span>
                    </label>
                    {/* Custom Input Row */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                            type="number"
                            step="64"
                            min="256"
                            max="2048"
                            value={settings.width}
                            onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty or any number during typing
                                handleChange('width', val === '' ? 0 : parseInt(val) || 0);
                            }}
                            onBlur={(e) => {
                                let w = parseInt(e.target.value) || 256;
                                w = Math.max(256, Math.min(2048, w));
                                // Check total pixels
                                const maxPixels = 1472 * 1472;
                                if (w * settings.height > maxPixels) {
                                    // Reduce height to fit
                                    const newH = Math.floor(maxPixels / w);
                                    onChange({ ...settings, width: w, height: Math.max(256, newH) });
                                } else {
                                    handleChange('width', w);
                                }
                            }}
                            className="bg-darker border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                            placeholder="Width"
                        />
                        <input
                            type="number"
                            step="64"
                            min="256"
                            max="2048"
                            value={settings.height}
                            onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty or any number during typing
                                handleChange('height', val === '' ? 0 : parseInt(val) || 0);
                            }}
                            onBlur={(e) => {
                                let h = parseInt(e.target.value) || 256;
                                h = Math.max(256, Math.min(2048, h));
                                // Check total pixels
                                const maxPixels = 1472 * 1472;
                                if (settings.width * h > maxPixels) {
                                    // Reduce width to fit
                                    const newW = Math.floor(maxPixels / h);
                                    onChange({ ...settings, width: Math.max(256, newW), height: h });
                                } else {
                                    handleChange('height', h);
                                }
                            }}
                            className="bg-darker border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                            placeholder="Height"
                        />
                    </div>
                    {/* Pixel count indicator */}
                    <div className={`text-[10px] mb-2 ${settings.width * settings.height > 1472 * 1472 ? 'text-red-400' : 'text-gray-500'}`}>
                        当前像素: {(settings.width * settings.height).toLocaleString()} / {(1472 * 1472).toLocaleString()}
                    </div>
                    {/* Preset buttons */}
                    <div className="flex gap-1.5 flex-wrap">
                        {[
                            { label: '纵向', w: 832, h: 1216 },
                            { label: '横向', w: 1216, h: 832 },
                            { label: '方形', w: 1024, h: 1024 },
                        ].map(p => (
                            <button
                                key={p.label}
                                onClick={() => onChange({ ...settings, width: p.w, height: p.h })}
                                className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-all ${settings.width === p.w && settings.height === p.h
                                    ? 'bg-primary/20 border-primary/50 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                {p.label} <span className="opacity-60">{p.w}×{p.h}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* UC Preset */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">UC Preset (负面预设)</label>
                    <select
                        value={settings.ucPreset}
                        onChange={(e) => handleChange('ucPreset', e.target.value as UCPreset)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        {UC_PRESETS.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
            </CollapsibleSection>

            {/* AI Core Parameters */}
            <CollapsibleSection title="AI 核心参数" icon={<Zap size={14} />}>
                {/* Sampler */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">采样器 (Sampler)</label>
                    <select
                        value={settings.sampler}
                        onChange={(e) => handleChange('sampler', e.target.value)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        {SAMPLERS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {/* Steps */}
                <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-gray-500">生成步数 (Steps)</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold">28</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">已锁定</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-primary/20 rounded-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary w-[56%] opacity-50"></div>
                    </div>
                </div>

                {/* CFG Scale */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">CFG Scale</span>
                        <span className="text-primary font-mono">{settings.cfg}</span>
                    </div>
                    <input type="range" min="1" max="25" step="0.5" value={settings.cfg}
                        onChange={(e) => handleChange('cfg', parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-darker rounded-full appearance-none cursor-pointer"
                    />
                </div>

                {/* CFG Rescale */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">CFG Rescale</span>
                        <span className="text-primary font-mono">{settings.cfgRescale.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={settings.cfgRescale}
                        onChange={(e) => handleChange('cfgRescale', parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-darker rounded-full appearance-none cursor-pointer"
                    />
                </div>

                {/* Noise Schedule */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Noise Schedule</label>
                    <select
                        value={settings.noiseSchedule}
                        onChange={(e) => handleChange('noiseSchedule', e.target.value as NoiseSchedule)}
                        className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        {NOISE_SCHEDULES.map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>

                {/* Dynamic Thresholding */}
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-gray-400">Dynamic Thresholding</span>
                    <input type="checkbox" checked={settings.dynamicThresholding}
                        onChange={(e) => handleChange('dynamicThresholding', e.target.checked)}
                        className="accent-primary w-4 h-4"
                    />
                </label>

                {/* Seed */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Hash size={10} /> Seed</label>
                    <div className="flex gap-2">
                        <input type="number" placeholder="-1 = Random" value={settings.seed}
                            onChange={(e) => handleChange('seed', parseInt(e.target.value))}
                            className="flex-1 bg-darker border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => handleChange('seed', -1)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white text-xs border border-white/5"
                        >
                            Random
                        </button>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Model Specific Parameters */}
            <CollapsibleSection title="模型特定参数" icon={<Wand2 size={14} />}>
                {isV3 && (
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500">NAI Diffusion V3 专属</p>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-gray-400">SMEA</span>
                            <input type="checkbox" checked={settings.sm}
                                onChange={(e) => handleChange('sm', e.target.checked)}
                                className="accent-primary w-4 h-4"
                            />
                        </label>
                        {settings.sm && (
                            <label className="flex items-center justify-between cursor-pointer pl-4">
                                <span className="text-xs text-gray-400">SMEA DYN</span>
                                <input type="checkbox" checked={settings.sm_dyn}
                                    onChange={(e) => handleChange('sm_dyn', e.target.checked)}
                                    className="accent-primary w-4 h-4"
                                />
                            </label>
                        )}
                    </div>
                )}

                {isV4 && (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">NAI Diffusion V4/V4.5 专属</p>

                        {/* AQT Preset */}
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">AQT Preset</label>
                            <select
                                value={settings.aqtPreset}
                                onChange={(e) => handleChange('aqtPreset', e.target.value as NAI4AqtPreset)}
                                className="w-full bg-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                            >
                                {AQT_PRESETS.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        {/* Divide Roles */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-gray-400">Divide Roles (多角色场景)</span>
                            <input type="checkbox" checked={settings.divideRoles}
                                onChange={(e) => handleChange('divideRoles', e.target.checked)}
                                className="accent-primary w-4 h-4"
                            />
                        </label>

                        {settings.divideRoles && (
                            <div className="space-y-3">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-xs text-gray-400">AI 自动定位</span>
                                    <input type="checkbox" checked={settings.useAutoPositioning}
                                        onChange={(e) => handleChange('useAutoPositioning', e.target.checked)}
                                        className="accent-primary w-4 h-4"
                                    />
                                </label>
                                <p className="text-xs text-gray-500">
                                    {settings.useAutoPositioning
                                        ? 'AI 将自动选择角色位置'
                                        : '手动设置每个角色的具体位置'}
                                </p>
                                <CharacterPromptsPanel
                                    characterPrompts={settings.characterPrompts}
                                    useAutoPositioning={settings.useAutoPositioning}
                                    onChange={(prompts) => handleChange('characterPrompts', prompts)}
                                />
                            </div>
                        )}
                    </div>
                )}

                {!isV3 && !isV4 && (
                    <p className="text-xs text-gray-500">选择模型后查看对应参数</p>
                )}
            </CollapsibleSection>

            {/* Advanced Settings */}
            <CollapsibleSection title="高级设置" icon={<Settings size={14} />}>
                {/* Variety+ */}
                <label className="flex items-center justify-between cursor-pointer">
                    <div>
                        <span className="text-xs text-gray-400">Variety+ (多样性增强)</span>
                        <p className="text-xs text-gray-600">增加图像多样性，建议 CFG 7-9</p>
                    </div>
                    <input type="checkbox" checked={settings.varietyPlus}
                        onChange={(e) => handleChange('varietyPlus', e.target.checked)}
                        className="accent-primary w-4 h-4"
                    />
                </label>

                {/* ControlNet Strength */}
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">ControlNet Strength</span>
                        <span className="text-primary font-mono">{settings.controlnetStrength.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.05" value={settings.controlnetStrength}
                        onChange={(e) => handleChange('controlnetStrength', parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-darker rounded-full appearance-none cursor-pointer"
                    />
                </div>

                {/* Legacy Mode */}
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-gray-400">Legacy Mode</span>
                    <input type="checkbox" checked={settings.legacy}
                        onChange={(e) => handleChange('legacy', e.target.checked)}
                        className="accent-primary w-4 h-4"
                    />
                </label>

                {settings.legacy && (
                    <label className="flex items-center justify-between cursor-pointer pl-4">
                        <span className="text-xs text-gray-400">Legacy V3 Extend</span>
                        <input type="checkbox" checked={settings.legacyV3Extend}
                            onChange={(e) => handleChange('legacyV3Extend', e.target.checked)}
                            className="accent-primary w-4 h-4"
                        />
                    </label>
                )}
            </CollapsibleSection>

            {/* Vibe Transfer */}
            <CollapsibleSection title="Vibe Transfer (氛围转移)" icon={<Image size={14} />}>
                <VibeTransferPanel
                    vibeReferences={settings.vibeReferences}
                    onChange={(vibes) => handleChange('vibeReferences', vibes)}
                />
            </CollapsibleSection>
        </div>
    );
};

export default NovelAISettingsPanel;
