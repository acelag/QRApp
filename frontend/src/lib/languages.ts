export interface Language { code: string; name: string; flag: string; }

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'es', name: 'Español',    flag: '🇪🇸' },
  { code: 'fr', name: 'Français',   flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'ar', name: 'العربية',    flag: '🇸🇦' },
  { code: 'zh', name: '中文',        flag: '🇨🇳' },
  { code: 'ja', name: '日本語',      flag: '🇯🇵' },
  { code: 'hi', name: 'हिन्दी',     flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்',      flag: '🇱🇰' },
  { code: 'si', name: 'සිංහල',      flag: '🇱🇰' },
  { code: 'pt', name: 'Português',  flag: '🇵🇹' },
  { code: 'ru', name: 'Русский',    flag: '🇷🇺' },
  { code: 'ko', name: '한국어',      flag: '🇰🇷' },
  { code: 'tr', name: 'Türkçe',     flag: '🇹🇷' },
  { code: 'it', name: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
];

export function langLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

export function langFlag(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag ?? '🌐';
}
