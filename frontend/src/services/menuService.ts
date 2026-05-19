import axios from 'axios';
import type { Category, MenuItem } from '../types';
import type { Topping } from '../types/MenuItem';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

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

  setAvailability: (id: string, available: boolean) =>
    axios.patch<{ id: string; name: string; available: boolean }>(`${BASE}/menu-items/${id}/availability`, { available }).then((r) => r.data),

  setStock: (id: string, stock: number | null) =>
    axios.patch<MenuItem>(`${BASE}/menu-items/${id}/stock`, { stock }).then((r) => r.data),

  createCategory: (name: string) =>
    axios.post<Category>(`${BASE}/categories`, { name }).then((r) => r.data),

  updateCategory: (id: string, name: string) =>
    axios.patch<Category>(`${BASE}/categories/${id}`, { name }).then((r) => r.data),

  deleteCategory: (id: string) => axios.delete(`${BASE}/categories/${id}`),

  // Toppings
  getToppings: (menuItemId: string) =>
    axios.get<Topping[]>(`${BASE}/menu-items/${menuItemId}/toppings`).then((r) => r.data),

  createTopping: (menuItemId: string, data: { name: string; price: number; available?: boolean }) =>
    axios.post<Topping>(`${BASE}/menu-items/${menuItemId}/toppings`, data).then((r) => r.data),

  updateTopping: (menuItemId: string, toppingId: string, data: Partial<{ name: string; price: number; available: boolean }>) =>
    axios.patch<Topping>(`${BASE}/menu-items/${menuItemId}/toppings/${toppingId}`, data).then((r) => r.data),

  deleteTopping: (menuItemId: string, toppingId: string) =>
    axios.delete(`${BASE}/menu-items/${menuItemId}/toppings/${toppingId}`),
};
