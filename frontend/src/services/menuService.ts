import axios from 'axios';
import type { Category, MenuItem } from '../types';

const BASE = '/api';

export const menuService = {
  getCategories: (restaurantId?: string) =>
    axios.get<Category[]>(`${BASE}/categories`, { params: restaurantId ? { restaurantId } : undefined }).then((r) => r.data),

  getItems: (restaurantId?: string, categoryId?: string) =>
    axios
      .get<MenuItem[]>(`${BASE}/menu-items`, {
        params: { ...(restaurantId ? { restaurantId } : {}), ...(categoryId ? { categoryId } : {}) },
      })
      .then((r) => r.data),

  createItem: (item: Omit<MenuItem, 'id'>) =>
    axios.post<MenuItem>(`${BASE}/menu-items`, item).then((r) => r.data),

  updateItem: (id: string, item: Partial<MenuItem>) =>
    axios.put<MenuItem>(`${BASE}/menu-items/${id}`, item).then((r) => r.data),

  deleteItem: (id: string) => axios.delete(`${BASE}/menu-items/${id}`),

  createCategory: (name: string) =>
    axios.post<Category>(`${BASE}/categories`, { name }).then((r) => r.data),

  updateCategory: (id: string, name: string) =>
    axios.patch<Category>(`${BASE}/categories/${id}`, { name }).then((r) => r.data),

  deleteCategory: (id: string) => axios.delete(`${BASE}/categories/${id}`),
};
