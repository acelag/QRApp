// Dark mode via the same style-injection trick used for brand theming:
// when enabled, inject overrides remapping the common neutral Tailwind
// utilities (bg-white, bg-gray-50, text-gray-*, border-gray-*) to dark
// equivalents — so the whole admin app goes dark without editing pages.

const STYLE_ID = 'qra-dark';
const KEY = 'qra-dark-mode';

const DARK_CSS = `
  body { background-color: #15151a; }

  .bg-white   { background-color: #1e1e25 !important; }
  .bg-gray-50  { background-color: #15151a !important; }
  .bg-gray-100 { background-color: #2a2a33 !important; }
  .bg-gray-200 { background-color: #343440 !important; }

  .hover\\:bg-gray-50:hover  { background-color: #26262e !important; }
  .hover\\:bg-gray-100:hover { background-color: #303039 !important; }

  .text-gray-900 { color: #f4f4f5 !important; }
  .text-gray-800 { color: #e6e6ea !important; }
  .text-gray-700 { color: #d6d6db !important; }
  .text-gray-600 { color: #bcbcc4 !important; }
  .text-gray-500 { color: #9b9ba4 !important; }
  .text-gray-400 { color: #7d7d86 !important; }
  .text-gray-300 { color: #5d5d67 !important; }

  .border-gray-50  { border-color: #232329 !important; }
  .border-gray-100 { border-color: #2a2a33 !important; }
  .border-gray-200 { border-color: #343440 !important; }
  .divide-gray-50  > * { border-color: #232329 !important; }
  .divide-gray-100 > * { border-color: #2a2a33 !important; }

  input::placeholder, textarea::placeholder { color: #6b6b74 !important; }
`;

export function applyDarkMode(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (on) {
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = DARK_CSS;
    document.documentElement.classList.add('dark');
  } else {
    el?.remove();
    document.documentElement.classList.remove('dark');
  }
}

export function isDarkMode(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** Apply the persisted preference (call once on app start). */
export function initDarkMode(): void {
  applyDarkMode(isDarkMode());
}
