import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { restaurantService } from '../services/restaurantService';
import { useAuth } from './AuthContext';

export const THEME_COLORS = [
  { name: 'Orange', hex: '#f97316', light: '#fff7ed', dark: '#ea6c00', border: '#fed7aa', ring: '#fdba74' },
  { name: 'Rose',   hex: '#f43f5e', light: '#fff1f2', dark: '#e11d48', border: '#fecdd3', ring: '#fda4af' },
  { name: 'Violet', hex: '#8b5cf6', light: '#f5f3ff', dark: '#7c3aed', border: '#ddd6fe', ring: '#c4b5fd' },
  { name: 'Blue',   hex: '#3b82f6', light: '#eff6ff', dark: '#2563eb', border: '#bfdbfe', ring: '#93c5fd' },
  { name: 'Teal',   hex: '#14b8a6', light: '#f0fdfa', dark: '#0d9488', border: '#99f6e4', ring: '#5eead4' },
  { name: 'Green',  hex: '#22c55e', light: '#f0fdf4', dark: '#16a34a', border: '#bbf7d0', ring: '#86efac' },
  { name: 'Amber',  hex: '#f59e0b', light: '#fffbeb', dark: '#d97706', border: '#fde68a', ring: '#fcd34d' },
  { name: 'Pink',   hex: '#ec4899', light: '#fdf2f8', dark: '#db2777', border: '#fbcfe8', ring: '#f9a8d4' },
];

export function applyTheme(hex: string) {
  const t = THEME_COLORS.find((c) => c.hex === hex) ?? THEME_COLORS[0];
  const root = document.documentElement;
  root.style.setProperty('--clr',        t.hex);
  root.style.setProperty('--clr-light',  t.light);
  root.style.setProperty('--clr-dark',   t.dark);
  root.style.setProperty('--clr-border', t.border);
  root.style.setProperty('--clr-ring',   t.ring);

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
  loadTheme: (restaurantId: string) => void;
}

const ThemeContext = createContext<ThemeCtx>({ loadTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Auto-load for authenticated admin/kitchen users
  useEffect(() => {
    if (user?.restaurantId) {
      restaurantService
        .getRestaurantInfo(user.restaurantId)
        .then((r) => applyTheme(r.themeColor ?? '#f97316'))
        .catch(() => {});
    } else if (!user) {
      applyTheme('#f97316');
    }
  }, [user?.restaurantId]);

  // Called from customer-facing pages that know their restaurantId
  const loadTheme = useCallback((restaurantId: string) => {
    restaurantService
      .getRestaurantInfo(restaurantId)
      .then((r) => applyTheme(r.themeColor ?? '#f97316'))
      .catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
