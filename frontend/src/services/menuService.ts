import axios from 'axios';
import type { Category, MenuItem } from '../types';
import type { Topping, ModifierGroup, ModifierOption } from '../types/MenuItem';

export interface RecipeIngredient {
  id: string;
  stockItemId: string;
  stockItemName: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
}

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

  reorderItems: (items: { id: string; sortOrder: number }[]) =>
    axios.patch(`${BASE}/menu-items/reorder`, { items }).then((r) => r.data),

  bulkSetAvailability: (categoryId: string, available: boolean) =>
    axios.patch<{ updated: number; available: boolean }>(`${BASE}/menu-items/bulk-availability`, { categoryId, available }).then((r) => r.data),

  duplicateItem: (id: string) =>
    axios.post<MenuItem>(`${BASE}/menu-items/${id}/duplicate`).then((r) => r.data),

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

  // Modifier Groups
  getModifierGroups: (menuItemId: string) =>
    axios.get<ModifierGroup[]>(`${BASE}/menu-items/${menuItemId}/modifier-groups`).then((r) => r.data),

  createModifierGroup: (menuItemId: string, data: { name: string; type: 'single' | 'multi'; required: boolean }) =>
    axios.post<ModifierGroup>(`${BASE}/menu-items/${menuItemId}/modifier-groups`, data).then((r) => r.data),

  updateModifierGroup: (menuItemId: string, groupId: string, data: Partial<{ name: string; type: string; required: boolean }>) =>
    axios.patch<ModifierGroup>(`${BASE}/menu-items/${menuItemId}/modifier-groups/${groupId}`, data).then((r) => r.data),

  deleteModifierGroup: (menuItemId: string, groupId: string) =>
    axios.delete(`${BASE}/menu-items/${menuItemId}/modifier-groups/${groupId}`),

  createModifierOption: (menuItemId: string, groupId: string, data: { name: string; price: number; available?: boolean }) =>
    axios.post<ModifierOption>(`${BASE}/menu-items/${menuItemId}/modifier-groups/${groupId}/options`, data).then((r) => r.data),

  updateModifierOption: (menuItemId: string, groupId: string, optionId: string, data: Partial<{ name: string; price: number; available: boolean }>) =>
    axios.patch<ModifierOption>(`${BASE}/menu-items/${menuItemId}/modifier-groups/${groupId}/options/${optionId}`, data).then((r) => r.data),

  deleteModifierOption: (menuItemId: string, groupId: string, optionId: string) =>
    axios.delete(`${BASE}/menu-items/${menuItemId}/modifier-groups/${groupId}/options/${optionId}`),

  // Recipe / ingredient mapping
  getRecipe: (menuItemId: string) =>
    axios.get<RecipeIngredient[]>(`${BASE}/menu-items/${menuItemId}/recipe`).then((r) => r.data),

  saveRecipe: (menuItemId: string, ingredients: { stockItemId: string; quantity: number }[]) =>
    axios.put<RecipeIngredient[]>(`${BASE}/menu-items/${menuItemId}/recipe`, { ingredients }).then((r) => r.data),
};
