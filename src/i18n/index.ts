import zh from './zh.json';
import en from './en.json';

const translations = { zh, en } as const;
export type Lang = keyof typeof translations;
export const defaultLang: Lang = 'zh';
export const languages: Lang[] = ['zh', 'en'];

export function t(lang: Lang) {
  return translations[lang];
}

export function getResumeData(lang: Lang) {
  return lang === 'zh'
    ? import('../data/resume-zh.json')
    : import('../data/resume-en.json');
}

export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split('/')[1];
  if (seg === 'en') return 'en';
  return 'zh';
}

export function getOtherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}
