import React, { useState, useEffect } from 'react';
import { Plus, X, Layers, Settings2 } from 'lucide-react';
import { LoraConfig } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
    availableLoras: string[];
    selectedLoras: LoraConfig[];
    onChange: (loras: LoraConfig[]) => void;
    isLoading?: boolean;
}

const LoraSelector: React.FC<Props> = ({ availableLoras, selectedLoras, onChange, isLoading }) => {
    const { t } = useLanguage();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    // 用于临时存储每个 LoRA 的输入值字符串，允许用户输入负号、空值等
    const [strengthInputs, setStrengthInputs] = useState<Record<number, string>>({});

    // 点击外部关闭添加菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.lora-add-container')) {
                setIsAdding(false);
            }
        };
        if (isAdding) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isAdding]);

    const handleAdd = (loraName: string) => {
        if (selectedLoras.some(l => l.name === loraName)) return;
        if (selectedLoras.length >= 4) return;

        onChange([...selectedLoras, { name: loraName, strength: 1.0 }]);
        setIsAdding(false);
        setSearchTerm('');
    };

    const handleRemove = (index: number) => {
        const newLoras = [...selectedLoras];
        newLoras.splice(index, 1);
        onChange(newLoras);
        // 清理临时输入状态
        const newInputs = { ...strengthInputs };
        delete newInputs[index];
        setStrengthInputs(newInputs);
    };

    const handleStrengthInputChange = (index: number, inputValue: string) => {
        // 允许用户输入任何值（包括负号、空字符串等）
        setStrengthInputs({ ...strengthInputs, [index]: inputValue });
    };

    const handleStrengthBlur = (index: number) => {
        const inputValue = strengthInputs[index];
        if (inputValue === undefined) return;

        // 解析并限制范围
        let parsed = parseFloat(inputValue);
        if (isNaN(parsed)) {
            parsed = 1.0; // 默认值
        }
        const clampedVal = Math.max(-10, Math.min(10, parsed));

        // 更新实际值
        const newLoras = [...selectedLoras];
        newLoras[index].strength = clampedVal;
        onChange(newLoras);

        // 清除临时输入状态，让它显示实际值
        const newInputs = { ...strengthInputs };
        delete newInputs[index];
        setStrengthInputs(newInputs);
    };

    const getDisplayValue = (index: number, actualValue: number): string => {
        // 如果有临时输入值，显示临时值；否则显示实际值
        if (strengthInputs[index] !== undefined) {
            return strengthInputs[index];
        }
        return actualValue.toString();
    };

    const filteredLoras = availableLoras.filter(l =>
        l.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedLoras.some(sl => sl.name === l)
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                    <Layers size={14} />
                    {t.standardMode.settingsPanel.loras} ({selectedLoras.length}/4)
                </label>

                {selectedLoras.length < 4 && (
                    <div className="relative lora-add-container">
                        <button
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-white/10 text-primary transition-colors border border-primary/30"
                            onClick={() => setIsAdding(!isAdding)}
                            disabled={isLoading}
                        >
                            <Plus size={12} />
                            {t.standardMode.settingsPanel.addLora}
                        </button>

                        {isAdding && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 p-2">
                                <input
                                    type="text"
                                    placeholder="Search LoRA..."
                                    className="w-full bg-black/20 border border-border rounded px-2 py-1.5 text-xs mb-2 text-white focus:outline-none focus:border-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                    {filteredLoras.length > 0 ? (
                                        filteredLoras.map(lora => (
                                            <button
                                                key={lora}
                                                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-white/10 truncate text-text-primary"
                                                onClick={() => handleAdd(lora)}
                                            >
                                                {lora}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-xs text-text-secondary text-center py-2">
                                            {t.history.empty}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                {selectedLoras.map((lora, index) => (
                    <div key={`${lora.name}-${index}`} className="bg-surface border border-border rounded-lg p-3 hover:border-white/20 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-text-primary truncate font-medium max-w-[160px]" title={lora.name}>
                                {lora.name.replace('.safetensors', '')}
                            </span>
                            {/* 删除按钮 - 始终可见 */}
                            <button
                                className="text-red-400/70 hover:text-red-400 p-1 transition-colors"
                                onClick={() => handleRemove(index)}
                                title={t.common.delete}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Settings2 size={12} className="text-text-secondary shrink-0" />
                            <span className="text-xs text-gray-500">{t.standardMode.settingsPanel.loraStrength}</span>
                            {/* 数字输入框 - 隐藏 spinner，允许负数和空值输入 */}
                            <input
                                type="text"
                                inputMode="decimal"
                                value={getDisplayValue(index, lora.strength)}
                                onChange={(e) => handleStrengthInputChange(index, e.target.value)}
                                onBlur={() => handleStrengthBlur(index)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="flex-1 bg-darker border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary text-center font-mono"
                            />
                        </div>
                    </div>
                ))}

                {selectedLoras.length === 0 && (
                    <div className="text-xs text-text-secondary text-center py-4 border border-border border-dashed rounded-lg bg-black/20">
                        {t.history.empty}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoraSelector;
