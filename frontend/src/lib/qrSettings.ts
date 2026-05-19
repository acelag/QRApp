export interface QRSettings {
  fgColor: string;
  bgColor: string;
  useLogo: boolean;
}

const KEY = 'qra_qr_settings';
const DEFAULTS: QRSettings = { fgColor: '#000000', bgColor: '#ffffff', useLogo: false };

export function loadQRSettings(): QRSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULTS };
}

export function saveQRSettings(s: QRSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
