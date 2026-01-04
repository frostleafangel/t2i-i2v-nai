import React from 'react';
import { LayoutTemplate, Code } from 'lucide-react';
import PromptBuilder from './PromptBuilder';
import { CharacterPrompt, GeneralPrompt } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  activeTab: 'builder' | 'raw';
  setActiveTab: (tab: 'builder' | 'raw') => void;
  characters: CharacterPrompt[];
  setCharacters: React.Dispatch<React.SetStateAction<CharacterPrompt[]>>;
  general: GeneralPrompt;
  setGeneral: React.Dispatch<React.SetStateAction<GeneralPrompt>>;
  builderOutput: string;
  setBuilderOutput: (output: string) => void;
  rawPrompt: string;
  setRawPrompt: (prompt: string) => void;
  previewingHistoryPrompt: string | null;
}

const PromptArea: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  characters,
  setCharacters,
  general,
  setGeneral,
  builderOutput,
  setBuilderOutput,
  rawPrompt,
  setRawPrompt,
  previewingHistoryPrompt
}) => {
  const { t } = useLanguage();
  
  return (
    <div className="bg-surface rounded-2xl p-6 border border-white/5 shadow-2xl relative">
      {/* Tabs */}
      <div className="flex bg-darker p-1 rounded-lg mb-4 border border-white/5">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'builder' ? 'bg-surface text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <LayoutTemplate size={14} />
          {t.promptBuilder.simpleMode}
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'raw' ? 'bg-surface text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Code size={14} />
          {t.promptBuilder.advancedMode}
        </button>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'builder' ? (
          <PromptBuilder 
            characters={characters}
            setCharacters={setCharacters}
            general={general}
            setGeneral={setGeneral}
            onPromptChange={setBuilderOutput} 
          />
        ) : (
          <div className="relative group animate-in fade-in duration-300">
            <textarea 
              value={previewingHistoryPrompt || rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              placeholder={t.promptBuilder.rawPlaceholder}
              className="w-full min-h-[300px] lg:h-[600px] bg-darker border border-white/10 rounded-xl p-4 text-sm text-gray-200 lg:overflow-auto font-mono leading-relaxed resize-none focus:outline-none focus:border-primary/50"
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-600 bg-darker px-2 py-1 rounded border border-white/5 pointer-events-none">
              {previewingHistoryPrompt ? t.promptBuilder.previewMode : t.promptBuilder.rawMode}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptArea;
