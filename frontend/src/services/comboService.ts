import axios from 'axios';

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

export const comboService = {
  getCombos(restaurantId: string): Promise<Combo[]> {
    return axios.get<Combo[]>(BASE, { params: { restaurantId } }).then((r) => r.data);
  },

  createCombo(data: ComboPayload): Promise<Combo> {
    return axios.post<Combo>(BASE, data).then((r) => r.data);
  },

  updateCombo(id: string, data: ComboPayload): Promise<Combo> {
    return axios.put<Combo>(`${BASE}/${id}`, data).then((r) => r.data);
  },

  toggleActive(id: string, active: boolean): Promise<Combo> {
    return axios.patch<Combo>(`${BASE}/${id}/active`, { active }).then((r) => r.data);
  },

  deleteCombo(id: string): Promise<void> {
    return axios.delete(`${BASE}/${id}`).then(() => {});
  },
};
