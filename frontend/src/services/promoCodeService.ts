import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/promo-codes`;

export interface PromoCode {
  id: string;
  restaurantId: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrder: number;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ValidateResult {
  valid: boolean;
  code?: string;
  type?: 'percentage' | 'fixed';
  value?: number;
  discountAmount?: number;
  message?: string;
}

export const promoCodeService = {
  list: (): Promise<PromoCode[]> =>
    axios.get<PromoCode[]>(BASE).then((r) => r.data),

  create: (data: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minOrder?: number;
    maxUses?: number | null;
    expiresAt?: string | null;
  }): Promise<PromoCode> =>
    axios.post<PromoCode>(BASE, data).then((r) => r.data),

  update: (id: string, data: Partial<Pick<PromoCode, 'active' | 'value' | 'minOrder' | 'maxUses' | 'expiresAt'>>): Promise<PromoCode> =>
    axios.patch<PromoCode>(`${BASE}/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    axios.delete(`${BASE}/${id}`).then(() => {}),

  validate: (code: string, restaurantId: string, orderAmount: number): Promise<ValidateResult> =>
    axios.post<ValidateResult>(`${BASE}/validate`, { code, restaurantId, orderAmount }).then((r) => r.data),
};
