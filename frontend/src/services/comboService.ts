const BASE = '/api/combos';

export interface ComboItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  sortOrder: number;
}

export interface Combo {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  items: ComboItem[];
}

export interface ComboPayload {
  name: string;
  description?: string;
  price: number;
  image?: string;
  active?: boolean;
  sortOrder?: number;
  items: { menuItemId: string; quantity: number }[];
}

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('qra_token') ?? ''}`,
});

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const comboService = {
  getCombos(restaurantId: string): Promise<Combo[]> {
    return fetch(`${BASE}?restaurantId=${restaurantId}`).then((r) => json<Combo[]>(r));
  },

  createCombo(data: ComboPayload): Promise<Combo> {
    return fetch(BASE, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then((r) => json<Combo>(r));
  },

  updateCombo(id: string, data: ComboPayload): Promise<Combo> {
    return fetch(`${BASE}/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then((r) => json<Combo>(r));
  },

  toggleActive(id: string, active: boolean): Promise<Combo> {
    return fetch(`${BASE}/${id}/active`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ active }) }).then((r) => json<Combo>(r));
  },

  deleteCombo(id: string): Promise<void> {
    return fetch(`${BASE}/${id}`, { method: 'DELETE', headers: headers() }).then((r) => json<void>(r));
  },
};
