import { createContext, useContext, useState, type ReactNode } from 'react';

interface LanguageContextValue {
  lang: string;
  setLang: (code: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('qra_lang') ?? 'en');

  const setLang = (code: string) => {
    setLangState(code);
    localStorage.setItem('qra_lang', code);
  };

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
