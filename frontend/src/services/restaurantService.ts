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
}

export interface BillingCharges {
  serviceChargePct: number;
  taxPct: number;
}

/** Compute line-by-line charges from a subtotal and settings. */
export function computeCharges(subtotal: number, settings: BillingCharges) {
  const serviceCharge = subtotal * (settings.serviceChargePct / 100);
  const tax           = (subtotal + serviceCharge) * (settings.taxPct / 100);
  const grandTotal    = subtotal + serviceCharge + tax;
  return { serviceCharge, tax, grandTotal };
}

export const restaurantService = {
  /** Returns the restaurants visible to the current user (just own restaurant for admin). */
  getMyRestaurant: (): Promise<RestaurantSettings | null> =>
    axios
      .get<RestaurantSettings[]>(`${BASE}/restaurants`)
      .then((r) => r.data[0] ?? null),

  getRestaurantById: (id: string): Promise<RestaurantSettings> =>
    axios.get<RestaurantSettings>(`${BASE}/restaurants/${id}`).then((r) => r.data),

  updateCharges: (id: string, charges: BillingCharges) =>
    axios.patch<RestaurantSettings>(`${BASE}/restaurants/${id}/charges`, charges).then((r) => r.data),
};
