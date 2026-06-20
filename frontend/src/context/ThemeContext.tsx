import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyDarkMode, isDarkMode, initDarkMode } from '../lib/darkMode';

// Fixed app theme colour — Forest green. Theme selection has been removed;
// the whole app uses this single accent (light/dark mode is still switchable).
export const THEME_COLOR = '#2a7344';

const FOREST = { light: '#eef6f1', dark: '#1f5a34', border: '#a9d2b6', ring: '#76b389' };

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--clr',        THEME_COLOR);
  root.style.setProperty('--clr-light',  FOREST.light);
  root.style.setProperty('--clr-dark',   FOREST.dark);
  root.style.setProperty('--clr-border', FOREST.border);
  root.style.setProperty('--clr-ring',   FOREST.ring);

  // Remap all Tailwind orange utilities to CSS variables — no component changes needed
  let el = document.getElementById('qra-theme');
  if (!el) {
    el = document.createElement('style');
    el.id = 'qra-theme';
    document.head.appendChild(el);
  }
  el.textContent = `
    .bg-orange-50   { background-color: var(--clr-light) !important; }
    .bg-orange-100  { background-color: var(--clr-light) !important; }
    .bg-orange-400  { background-color: var(--clr)       !important; }
    .bg-orange-500  { background-color: var(--clr)       !important; }
    .bg-orange-600  { background-color: var(--clr-dark)  !important; }
    .text-orange-400 { color: var(--clr)      !important; }
    .text-orange-500 { color: var(--clr)      !important; }
    .text-orange-600 { color: var(--clr)      !important; }
    .text-orange-700 { color: var(--clr-dark) !important; }
    .border-orange-100 { border-color: var(--clr-border) !important; }
    .border-orange-200 { border-color: var(--clr-border) !important; }
    .border-orange-300 { border-color: var(--clr-border) !important; }
    .border-orange-500 { border-color: var(--clr)        !important; }
    .hover\\:bg-orange-50:hover    { background-color: var(--clr-light) !important; }
    .hover\\:bg-orange-100:hover   { background-color: var(--clr-light) !important; }
    .hover\\:bg-orange-500:hover   { background-color: var(--clr)       !important; }
    .hover\\:bg-orange-600:hover   { background-color: var(--clr-dark)  !important; }
    .hover\\:text-orange-500:hover { color: var(--clr)                  !important; }
    .hover\\:text-orange-600:hover { color: var(--clr)                  !important; }
    .hover\\:border-orange-200:hover { border-color: var(--clr-border)  !important; }
    .hover\\:border-orange-300:hover { border-color: var(--clr-border)  !important; }
    .focus\\:ring-orange-300:focus { --tw-ring-color: var(--clr-ring)   !important; }
    .ring-orange-300 { --tw-ring-color: var(--clr-ring)                 !important; }
    .from-orange-500 { --tw-gradient-from: var(--clr)                  !important; }
    .to-orange-600   { --tw-gradient-to: var(--clr-dark)               !important; }
    .shadow-orange-200 { --tw-shadow-color: var(--clr-border)          !important; }
  `;
}

interface ThemeCtx {
  dark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ dark: false, toggleDark: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Fixed accent colour — applied once on mount.
  useEffect(() => { applyTheme(); }, []);

  // Light/dark mode (persisted in localStorage)
  const [dark, setDark] = useState<boolean>(isDarkMode);
  useEffect(() => { initDarkMode(); }, []);
  const toggleDark = useCallback(() => {
    setDark((prev) => { const next = !prev; applyDarkMode(next); return next; });
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
