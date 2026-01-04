import { zh, Translations } from './zh';
import { en } from './en';

export type Language = 'zh' | 'en';

export const translations: Record<Language, Translations> = {
  zh,
  en,
};

export type { Translations };
export { zh, en };
