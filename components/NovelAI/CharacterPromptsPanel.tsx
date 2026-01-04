import React from 'react';
import { CharacterPromptConfig } from '../../types';
import { Plus, Trash2, User } from 'lucide-react';

interface Props {
    characterPrompts: CharacterPromptConfig[];
    useAutoPositioning: boolean;
    onChange: (prompts: CharacterPromptConfig[]) => void;
    maxCharacters?: number;
}

const MAX_CHARACTERS = 6;

const CharacterPromptsPanel: React.FC<Props> = ({
    characterPrompts,
    useAutoPositioning,
    onChange,
    maxCharacters = MAX_CHARACTERS
}) => {
    const addCharacter = () => {
        if (characterPrompts.length >= maxCharacters) return;
        const newChar: CharacterPromptConfig = {
            displayName: `角色${characterPrompts.length + 1}`,
            characterPrompt: '',
            characterNegativePrompt: '',
            coords: { x: 2, y: 2 } // Default center
        };
        onChange([...characterPrompts, newChar]);
    };

    const removeCharacter = (index: number) => {
        const updated = characterPrompts.filter((_, i) => i !== index);
        onChange(updated);
    };

    const updateCharacter = (index: number, field: keyof CharacterPromptConfig, value: any) => {
        const updated = [...characterPrompts];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    const updateCoord = (index: number, axis: 'x' | 'y', value: number) => {
        const updated = [...characterPrompts];
        const coords = updated[index].coords || { x: 2, y: 2 };
        coords[axis] = Math.max(0, Math.min(4, value));
        updated[index] = { ...updated[index], coords };
        onChange(updated);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 font-medium flex items-center gap-2">
                    <User size={14} />
                    角色提示词 ({characterPrompts.length}/{maxCharacters})
                </span>
                <button
                    onClick={addCharacter}
                    disabled={characterPrompts.length >= maxCharacters}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${characterPrompts.length >= maxCharacters
                            ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                            : 'bg-primary/20 text-primary hover:bg-primary/30'
                        }`}
                >
                    <Plus size={12} />
                    添加角色
                </button>
            </div>

            {characterPrompts.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">
                    点击"添加角色"创建角色提示词
                </div>
            )}

            {characterPrompts.map((char, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                        <input
                            type="text"
                            value={char.displayName}
                            onChange={(e) => updateCharacter(index, 'displayName', e.target.value)}
                            placeholder={`角色${index + 1}`}
                            className="flex-1 bg-darker border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary"
                            maxLength={20}
                        />
                        <button
                            onClick={() => removeCharacter(index)}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="删除角色"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Prompt */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">角色提示词</label>
                        <textarea
                            value={char.characterPrompt}
                            onChange={(e) => updateCharacter(index, 'characterPrompt', e.target.value)}
                            placeholder="描述这个角色的特征..."
                            rows={2}
                            className="w-full bg-darker border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary resize-none"
                        />
                    </div>

                    {/* Negative Prompt */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">角色负面提示词 (可选)</label>
                        <textarea
                            value={char.characterNegativePrompt || ''}
                            onChange={(e) => updateCharacter(index, 'characterNegativePrompt', e.target.value)}
                            placeholder="不希望出现的特征..."
                            rows={1}
                            className="w-full bg-darker border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary resize-none"
                        />
                    </div>

                    {/* Position (only when not auto) */}
                    {!useAutoPositioning && (
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">位置坐标 (5x5网格 0-4)</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">X:</span>
                                    <input
                                        type="number"
                                        value={char.coords?.x ?? 2}
                                        onChange={(e) => updateCoord(index, 'x', parseInt(e.target.value) || 0)}
                                        min={0} max={4}
                                        className="w-12 bg-darker border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary text-center"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Y:</span>
                                    <input
                                        type="number"
                                        value={char.coords?.y ?? 2}
                                        onChange={(e) => updateCoord(index, 'y', parseInt(e.target.value) || 0)}
                                        min={0} max={4}
                                        className="w-12 bg-darker border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary text-center"
                                    />
                                </div>
                                <span className="text-xs text-gray-600 ml-2">
                                    (0=左/上, 4=右/下)
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CharacterPromptsPanel;
