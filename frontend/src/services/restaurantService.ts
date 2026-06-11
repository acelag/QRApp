import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  serviceChargePct: number;
  taxPct: number;
  serviceChargeName?: string;
  taxName?: string;
  currency: string;
  logo?: string | null;
  themeColor?: string | null;
  orderNumberPrefix?: string;
  waitTimeMin?: number | null;
  timezone?: string;
  roomServiceOpen?: string | null;
  roomServiceClose?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  welcomeImageUrl?: string | null;
  loginMedia?: string[];
  loginVideoUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
  welcomeHeading?: string | null;
  welcomeTagline?: string | null;
  receiptPrinterIp?:   string | null;
  receiptPrinterPort?: number;
  kitchenPrinterIp?:   string | null;
  kitchenPrinterPort?: number;
  printerType?:        'epson' | 'star';
  autoPrintKitchen?:   boolean;
  autoPrintReceipt?:   boolean;
  // Receipt customization
  receiptHeaderLine1?:   string;
  receiptHeaderLine2?:   string;
  receiptFooterLine1?:   string;
  receiptFooterLine2?:   string;
  receiptShowOrderNo?:   boolean;
  receiptShowUnitPrice?: boolean;
}

/** Public restaurant info used by customer-facing pages (welcome screen, menus). */
export interface RestaurantInfo {
  name: string;
  logo: string | null;
  themeColor: string | null;
  waitTimeMin: number | null;
  roomServiceOpen: string | null;
  roomServiceClose: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  welcomeImageUrl: string | null;
  tiktokUrl: string | null;
  whatsappUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  welcomeHeading: string | null;
  welcomeTagline: string | null;
  /** Billing rates — included so customer cart pages can show tax/SC breakdown */
  serviceChargePct: number;
  taxPct: number;
  serviceChargeName: string;
  taxName: string;
}

/** Public branded-login info fetched by slug for /login/:slug. */
export interface LoginBranding {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  themeColor: string;
  loginMedia: string[];
  loginVideoUrl: string | null;
}

/** Fields the admin can edit in the welcome-screen / social design area. */
export interface SocialSettings {
  facebookUrl: string | null;
  instagramUrl: string | null;
  welcomeImageUrl: string | null;
  tiktokUrl: string | null;
  whatsappUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  welcomeHeading: string | null;
  welcomeTagline: string | null;
}

export interface BillingCharges {
  serviceChargePct: number;
  taxPct: number;
  currency?: string;
  serviceChargeName?: string;
  taxName?: string;
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'LKR', symbol: 'Rs.',  name: 'Sri Lankan Rupee' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht' },
];

export const getCurrencySymbol = (code: string): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

/** Currencies where fractional units are never shown (e.g. LKR, JPY). */
const ZERO_DECIMAL = new Set(['JPY', 'LKR']);

/**
 * Format a monetary amount with the correct symbol, thousand separators,
 * and decimal places for the given ISO currency code.
 *
 * Examples:
 *   formatCurrency(1500,    'LKR') → "Rs. 1,500"
 *   formatCurrency(1500.50, 'USD') → "$ 1,500.50"
 *   formatCurrency(1500,    'JPY') → "¥ 1,500"
 */
export function formatCurrency(amount: number, code: string): string {
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
  const symbol   = getCurrencySymbol(code);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

/** Compute line-by-line charges from a subtotal and settings. */
export function computeCharges(subtotal: number, settings: Pick<BillingCharges, 'serviceChargePct' | 'taxPct'>) {
  const serviceCharge = subtotal * (settings.serviceChargePct / 100);
  const tax           = (subtotal + serviceCharge) * (settings.taxPct / 100);
  const grandTotal    = subtotal + serviceCharge + tax;
  return { serviceCharge, tax, grandTotal };
}

export const restaurantService = {
  getMyRestaurant: (): Promise<RestaurantSettings | null> =>
    axios.get<RestaurantSettings[]>(`${BASE}/restaurants`).then((r) => r.data[0] ?? null),

  getRestaurantById: (id: string): Promise<RestaurantSettings> =>
    axios.get<RestaurantSettings>(`${BASE}/restaurants/${id}`).then((r) => r.data),

  /** Public — no auth required. Returns the currency code for a restaurant. */
  getRestaurantCurrency: (id: string): Promise<string> =>
    axios.get<{ currency: string }>(`${BASE}/restaurants/${id}/currency`).then((r) => r.data.currency),

  /** Public — no auth required. Returns name, logo, theme, wait time, room-service hours, social links, and welcome-screen content for a restaurant. */
  getRestaurantInfo: (id: string): Promise<RestaurantInfo> =>
    axios.get<RestaurantInfo>(`${BASE}/restaurants/${id}/info`).then((r) => r.data),

  /** Public — no auth required. Branded-login info (logo, theme, slider images, video) by slug. */
  getBrandingBySlug: (slug: string): Promise<LoginBranding> =>
    axios.get<LoginBranding>(`${BASE}/restaurants/by-slug/${encodeURIComponent(slug)}/branding`).then((r) => r.data),

  updateLoginBranding: (id: string, data: { loginMedia: string[]; loginVideoUrl: string | null }) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/login-branding`, data).then((r) => r.data),

  updateCharges: (id: string, charges: BillingCharges) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/charges`, charges).then((r) => r.data),

  updateLogo: (id: string, logo: string | null) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/logo`, { logo }).then((r) => r.data),

  updateTheme: (id: string, themeColor: string) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/theme`, { themeColor }).then((r) => r.data),

  updateOrderPrefix: (id: string, orderNumberPrefix: string) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/order-prefix`, { orderNumberPrefix }).then((r) => r.data),

  updateWaitTime: (id: string, waitTimeMin: number | null) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/wait-time`, { waitTimeMin }).then((r) => r.data),

  updateTimezone: (id: string, timezone: string) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/timezone`, { timezone }).then((r) => r.data),

  updateRoomServiceHours: (id: string, roomServiceOpen: string | null, roomServiceClose: string | null) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/room-service-hours`, { roomServiceOpen, roomServiceClose }).then((r) => r.data),

  updateSocial: (id: string, social: SocialSettings) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/social`, social).then((r) => r.data),

  updatePrinter: (id: string, payload: {
    receiptPrinterIp: string | null; receiptPrinterPort: number;
    kitchenPrinterIp: string | null; kitchenPrinterPort: number;
    printerType: 'epson' | 'star'; autoPrintKitchen: boolean; autoPrintReceipt: boolean;
  }) => axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/printer`, payload).then((r) => r.data),

  updateReceiptConfig: (id: string, config: {
    receiptHeaderLine1: string; receiptHeaderLine2: string;
    receiptFooterLine1: string; receiptFooterLine2: string;
    receiptShowOrderNo: boolean; receiptShowUnitPrice: boolean;
  }) => axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/receipt-config`, config).then((r) => r.data),
};
