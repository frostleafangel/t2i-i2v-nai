import React, { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Box } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
    models: string[];
    selectedModel: string;
    onSelect: (model: string) => void;
    isLoading?: boolean;
}

const ModelSelector: React.FC<Props> = ({ models, selectedModel, onSelect, isLoading }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.model-selector-container')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 model-selector-container relative z-20">
            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Box size={14} />
                {t.standardMode.settingsPanel.model}
            </label>

            <div className="relative">
                <button
                    className="w-full flex items-center justify-between p-3 bg-darker border border-border rounded-lg hover:border-primary transition-colors text-left"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="truncate pr-2">
                        {selectedModel || t.common.loading}
                    </span>
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin text-text-secondary" />
                    ) : (
                        <ChevronDown
                            size={16}
                            className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    )}
                </button>

                {isOpen && !isLoading && models.length > 0 && (
                    <div className="absolute w-full mt-1 py-1 bg-surface border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                        {models.map((model) => (
                            <button
                                key={model}
                                className={`w-full px-3 py-2 text-left hover:bg-white/5 transition-colors text-sm truncate ${model === selectedModel ? 'text-primary' : 'text-text-primary'
                                    }`}
                                onClick={() => {
                                    onSelect(model);
                                    setIsOpen(false);
                                }}
                            >
                                {model}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelSelector;
