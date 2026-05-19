import { useLanguage } from '../context/LanguageContext';

interface Props {
  available: { code: string; name: string }[];
}

export function MenuLangSelector({ available }: Props) {
  const { lang, setLang } = useLanguage();
  if (!available.length) return null;

  const all = [{ code: 'en', name: 'EN' }, ...available];

  return (
    <div className="flex gap-1">
      {all.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
            lang === l.code
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
