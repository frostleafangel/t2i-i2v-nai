import React, { useEffect } from 'react';
import { CharacterPrompt, GeneralPrompt } from '../types';
import { Plus, Trash2, User, Layers, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  characters: CharacterPrompt[];
  setCharacters: React.Dispatch<React.SetStateAction<CharacterPrompt[]>>;
  general: GeneralPrompt;
  setGeneral: React.Dispatch<React.SetStateAction<GeneralPrompt>>;
  onPromptChange: (xml: string) => void;
}

const DEFAULT_CHARACTER: CharacterPrompt = {
  id: '1',
  n: 'character_1',
  gender: '1girl',
  appearance: 'chibi, red_eyes, blue_hair, long_hair, hair_between_eyes, head_tilt, tareme, closed_mouth',
  clothing: 'school_uniform, serafuku, white_sailor_collar, white_shirt, short_sleeves, red_neckerchief, bow, blue_skirt, miniskirt, pleated_skirt, blue_hat, mini_hat, thighhighs, grey_thighhighs, black_shoes, mary_janes',
  expression: 'happy, smile',
  action: 'standing, holding, holding_briefcase',
  position: 'center',
};

const PromptBuilder: React.FC<Props> = ({ characters, setCharacters, general, setGeneral, onPromptChange }) => {
  const { t } = useLanguage();

  // Compile XML whenever state changes
  useEffect(() => {
    const xml = buildXml();
    onPromptChange(xml);
  }, [characters, general]);

  const buildXml = () => {
    let xml = '{\n';

    // Characters
    characters.forEach((char, index) => {
      const tag = `character_${index + 1}`;
      xml += `  <${tag}>\n`;
      if (char.n) xml += `    <n>${char.n}</n>\n`;
      if (char.gender) xml += `    <gender>${char.gender}</gender>\n`;
      if (char.appearance) xml += `    <appearance>${char.appearance}</appearance>\n`;
      if (char.clothing) xml += `    <clothing>${char.clothing}</clothing>\n`;
      if (char.expression) xml += `    <expression>${char.expression}</expression>\n`;
      if (char.action) xml += `    <action>${char.action}</action>\n`;
      if (char.position) xml += `    <position>${char.position}</position>\n`;
      xml += `  </${tag}>\n\n`;
    });

    // General Tags
    xml += `  <general_tags>\n`;
    if (general.count) xml += `    <count>${general.count}</count>\n`;
    if (general.style) xml += `    <style>${general.style}</style>\n`;
    if (general.background) xml += `    <background>${general.background}</background>\n`;
    if (general.lighting) xml += `    <lighting>${general.lighting}</lighting>\n`;
    if (general.atmosphere) xml += `    <atmosphere>${general.atmosphere}</atmosphere>\n`;
    if (general.quality) xml += `    <quality>${general.quality}</quality>\n`;
    if (general.objects) xml += `    <objects>${general.objects}</objects>\n`;
    if (general.other) xml += `    <other>${general.other}</other>\n`;
    if (general.caption) xml += `    <caption>${general.caption}</caption>\n`;
    xml += `  </general_tags>\n`;

    xml += '}';
    return xml;
  };

  const addCharacter = () => {
    if (characters.length >= 6) return;
    setCharacters([...characters, { ...DEFAULT_CHARACTER, id: Date.now().toString() }]);
  };

  const removeCharacter = (id: string) => {
    if (characters.length > 1) {
      setCharacters(characters.filter(c => c.id !== id));
    }
  };

  const updateCharacter = (id: string, field: keyof CharacterPrompt, value: string) => {
    setCharacters(characters.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updateGeneral = (field: keyof GeneralPrompt, value: string) => {
    setGeneral({ ...general, [field]: value });
  };

  const renderInput = (label: string, value: string, onChange: (val: string) => void, placeholder: string = "") => (
    <div className="mb-3">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className="w-full bg-dark border border-white/10 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-primary/50 resize-none overflow-hidden field-sizing-content"
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Characters Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <User size={16} className="text-primary" />
                {t.promptBuilder.characters}
            </h3>
            <button 
                onClick={addCharacter}
                disabled={characters.length >= 6}
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                  characters.length >= 6 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-primary/20 hover:bg-primary/30 text-primary'
                }`}
            >
                <Plus size={12} /> {t.promptBuilder.addCharacter} {characters.length >= 6 && t.promptBuilder.maxReached}
            </button>
        </div>

        {characters.map((char, index) => (
          <div key={char.id} className="bg-darker/50 border border-white/5 rounded-xl p-4 relative group">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <span className="text-xs font-mono text-secondary">{'<character_' + (index + 1) + '>'}</span>
                {characters.length > 1 && (
                    <button 
                        onClick={() => removeCharacter(char.id)}
                        className="text-gray-600 hover:text-red-400 p-1"
                        title={t.promptBuilder.deleteCharacter}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {renderInput(`${t.promptBuilder.characterName} (<n>)`, char.n, (v) => updateCharacter(char.id, 'n', v), "original_character")}
                {renderInput(`${t.promptBuilder.gender} (<gender>)`, char.gender, (v) => updateCharacter(char.id, 'gender', v), "1girl")}
            </div>
            {renderInput(`${t.promptBuilder.appearance} (<appearance>)`, char.appearance, (v) => updateCharacter(char.id, 'appearance', v), "blue_hair, red_eyes, long_hair...")}
            {renderInput(`${t.promptBuilder.clothing} (<clothing>)`, char.clothing, (v) => updateCharacter(char.id, 'clothing', v), "school_uniform, skirt...")}
            <div className="grid grid-cols-2 gap-3">
                {renderInput(`${t.promptBuilder.expression} (<expression>)`, char.expression, (v) => updateCharacter(char.id, 'expression', v), "smile, blush")}
                {renderInput(`${t.promptBuilder.position} (<position>)`, char.position, (v) => updateCharacter(char.id, 'position', v), "center, left")}
            </div>
            {renderInput(`${t.promptBuilder.action} (<action>)`, char.action, (v) => updateCharacter(char.id, 'action', v), "standing, waving")}
          </div>
        ))}
      </div>

      {/* General Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 border-t border-white/5 pt-4">
            <Layers size={16} className="text-secondary" />
            {t.promptBuilder.generalTags}
        </h3>
        
        <div className="bg-darker/50 border border-white/5 rounded-xl p-4">
            {renderInput(`${t.promptBuilder.count} (<count>)`, general.count, (v) => updateGeneral('count', v), "1girl, solo")}
            {renderInput(`${t.promptBuilder.style} (<style>)`, general.style, (v) => updateGeneral('style', v), "anime_style, digital_art")}
            {renderInput(`${t.promptBuilder.background} (<background>)`, general.background, (v) => updateGeneral('background', v), "simple_background, white_background")}
            {renderInput(`${t.promptBuilder.lighting} (<lighting>)`, general.lighting, (v) => updateGeneral('lighting', v), "sunset, dramatic_lighting, backlighting")}
            {renderInput(`${t.promptBuilder.atmosphere} (<atmosphere>)`, general.atmosphere, (v) => updateGeneral('atmosphere', v), "cheerful, melancholy")}
            {renderInput(`${t.promptBuilder.quality} (<quality>)`, general.quality, (v) => updateGeneral('quality', v), "high_resolution, detailed")}
            {renderInput(`${t.promptBuilder.objects} (<objects>)`, general.objects, (v) => updateGeneral('objects', v), "flower, sword")}
            {renderInput(`${t.promptBuilder.other} (<other>)`, general.other, (v) => updateGeneral('other', v), "")}
            {renderInput(`${t.promptBuilder.caption} (<caption>)`, general.caption, (v) => updateGeneral('caption', v), "")}
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex gap-2 text-xs text-gray-400">
        <Info size={14} className="shrink-0 mt-0.5 text-primary" />
        <p>{t.promptBuilder.tip}</p>
      </div>

    </div>
  );
};

export default PromptBuilder;