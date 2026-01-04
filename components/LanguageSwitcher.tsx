import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  compact?: boolean;
}

const LanguageSwitcher: React.FC<Props> = ({ compact = false }) => {
  const { language, toggleLanguage, t } = useLanguage();

  if (compact) {
    return (
      <button
        onClick={toggleLanguage}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title={t.language.switchLanguage}
      >
        <Globe size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
      title={t.language.switchLanguage}
    >
      <Globe size={14} />
      <span>{language === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
};

export default LanguageSwitcher;
