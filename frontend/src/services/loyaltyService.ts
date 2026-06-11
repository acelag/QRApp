import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/loyalty`;

export interface LoyaltyConfig {
  enabled: boolean;
  pointsPerUnit: number;   // points earned per 1 currency unit
  redeemRate: number;      // points needed to earn 1 currency unit discount
  minRedeemPoints: number; // minimum points before redemption is allowed
  maxRedeemPct: number;    // max % of order payable with points
}

export interface LoyaltyAccount {
  id: string;
  restaurantId: string;
  phone: string;
  name: string | null;
  pointsBalance: number;
  lifetimePoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  orderId: string | null;
  type: 'earn' | 'redeem' | 'adjust';
  points: number;
  description: string | null;
  createdAt: string;
}

export const loyaltyService = {
  /** Admin: read / write program config */
  getConfig: () =>
    axios.get<LoyaltyConfig>(`${BASE}/config`).then(r => r.data),

  updateConfig: (cfg: Partial<LoyaltyConfig>) =>
    axios.put<LoyaltyConfig>(`${BASE}/config`, cfg).then(r => r.data),

  /** Public: one-shot lookup for cart — returns config + account (or null) */
  lookup: (restaurantId: string, phone: string) =>
    axios.get<{ config: LoyaltyConfig | null; account: LoyaltyAccount | null }>(
      `${BASE}/lookup`,
      { params: { restaurantId, phone } },
    ).then(r => r.data),

  /** Admin: paginated member list */
  getAccounts: (search?: string) =>
    axios.get<LoyaltyAccount[]>(`${BASE}/accounts`, { params: search ? { search } : undefined }).then(r => r.data),

  /** Admin: transaction history for one member */
  getTransactions: (phone: string) =>
    axios.get<LoyaltyTransaction[]>(`${BASE}/account/${encodeURIComponent(phone)}/transactions`).then(r => r.data),

  /** Admin: manually add or remove points */
  adjust: (phone: string, points: number, description?: string) =>
    axios.post<LoyaltyAccount>(`${BASE}/account/adjust`, { phone, points, description }).then(r => r.data),
};
