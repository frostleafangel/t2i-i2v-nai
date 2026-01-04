import React, { useState } from 'react';
import { GenerationSettings } from '../types';
import { Settings, Sliders, Hash, Activity, CalendarClock, ChevronDown, ChevronUp, Ban, Maximize2 } from 'lucide-react';
import { VALID_SAMPLERS, VALID_SCHEDULERS, NEGATIVE_PROMPT_DEFAULT } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  settings: GenerationSettings;
  onChange: (newSettings: GenerationSettings) => void;
}

// 分辨率限制
const MIN_SIZE = 512;
const MAX_SIZE = 2048;

const SettingsPanel: React.FC<Props> = ({ settings, onChange }) => {
  const { t } = useLanguage();
  const [showNegative, setShowNegative] = useState(false);
  
  // 本地状态用于分辨率输入，允许用户清空输入框
  const [widthInput, setWidthInput] = useState(String(settings.width));
  const [heightInput, setHeightInput] = useState(String(settings.height));
  
  const handleChange = (key: keyof GenerationSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  // 失焦时验证分辨率范围
  const handleResolutionBlur = (key: 'width' | 'height') => {
    const value = settings[key];
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value || MIN_SIZE));
    if (clamped !== value) {
      onChange({ ...settings, [key]: clamped });
    }
  };

  return (
    <div className="bg-surface rounded-2xl p-6 border border-white/5 space-y-6">
      <div className="flex items-center gap-2 text-primary font-semibold border-b border-white/5 pb-4">
        <Settings size={20} />
        <span>{t.settings.title}</span>
      </div>

      {/* Resolution */}
      <div className="space-y-3">
        <label className="text-sm text-gray-400 font-medium">{t.settings.resolution}</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-500 mb-1 block">{t.settings.width}</span>
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
            <span className="text-xs text-gray-500 mb-1 block">{t.settings.height}</span>
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
        <p className="text-xs text-gray-600">{t.settings.range}: {MIN_SIZE} - {MAX_SIZE}</p>
        <div className="flex gap-2">
            <button 
              onClick={() => { setWidthInput('1024'); setHeightInput('1024'); onChange({...settings, width: 1024, height: 1024}); }}
              className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
            >
              {t.settings.square}
            </button>
             <button 
              onClick={() => { setWidthInput('832'); setHeightInput('1216'); onChange({...settings, width: 832, height: 1216}); }}
              className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
            >
              {t.settings.portrait}
            </button>
             <button 
              onClick={() => { setWidthInput('1216'); setHeightInput('832'); onChange({...settings, width: 1216, height: 832}); }}
              className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 border border-white/5"
            >
              {t.settings.landscape}
            </button>
        </div>
      </div>

      {/* Steps & CFG */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{t.settings.steps}</span>
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
            <span className="text-gray-400">{t.settings.cfgScale}</span>
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

      {/* Advanced Sampler & Scheduler */}
      <div className="grid grid-cols-2 gap-3">
        <div>
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Activity size={10} /> {t.settings.sampler}
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
                <CalendarClock size={10} /> {t.settings.scheduler}
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
            <Hash size={14} /> {t.settings.seed}
        </label>
        <div className="flex gap-2">
             <input 
              type="number" 
              placeholder={t.settings.randomSeed + " (-1)"}
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
            <Maximize2 size={14} /> {t.settings.autoUpscale}
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
        <p className="text-xs text-gray-600 mt-1">{t.settings.autoUpscaleHint}</p>
      </div>

      {/* Negative Prompt */}
      <div className="border-t border-white/5 pt-4">
        <button 
          onClick={() => setShowNegative(!showNegative)}
          className="w-full flex items-center justify-between text-sm text-gray-400 font-medium hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Ban size={14} /> {t.settings.negativePrompt}
          </span>
          {showNegative ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showNegative && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <textarea 
              value={settings.negativePrompt}
              onChange={(e) => handleChange('negativePrompt', e.target.value)}
              className="w-full h-32 bg-darker border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary resize-none font-mono"
            />
            <button 
              onClick={() => handleChange('negativePrompt', NEGATIVE_PROMPT_DEFAULT)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t.settings.resetToDefault}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;