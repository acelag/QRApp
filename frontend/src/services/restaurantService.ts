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
  currency: string;
  logo?: string | null;
}

export interface BillingCharges {
  serviceChargePct: number;
  taxPct: number;
  currency?: string;
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'LKR', symbol: 'Rs',  name: 'Sri Lankan Rupee' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht' },
];

export const getCurrencySymbol = (code: string): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

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

  /** Public — no auth required. Returns name and logo for a restaurant. */
  getRestaurantInfo: (id: string): Promise<{ name: string; logo: string | null }> =>
    axios.get<{ name: string; logo: string | null }>(`${BASE}/restaurants/${id}/info`).then((r) => r.data),

  updateCharges: (id: string, charges: BillingCharges) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/charges`, charges).then((r) => r.data),

  updateLogo: (id: string, logo: string | null) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/logo`, { logo }).then((r) => r.data),
};
