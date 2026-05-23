import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'EN',   full: 'English', flag: '🇬🇧' },
  { code: 'si', label: 'සිං',  full: 'සිංහල',  flag: '🇱🇰' },
  { code: 'ja', label: '日本語', full: '日本語',  flag: '🇯🇵' },
];

interface Props {
  /** 'buttons' = pill button group (default), 'select' = compact dropdown */
  variant?: 'buttons' | 'select';
  className?: string;
}

export function LanguageSwitcher({ variant = 'buttons', className = '' }: Props) {
  const { i18n } = useTranslation();
  const current = i18n.language.split('-')[0]; // normalize 'en-US' → 'en'

  if (variant === 'select') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Globe size={14} className="text-gray-400 shrink-0" />
        <select
          value={current}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300 bg-white text-gray-700"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.full}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Globe size={13} className="text-gray-400 shrink-0 mr-0.5" />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => i18n.changeLanguage(l.code)}
          title={l.full}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
            current === l.code
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
