import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/stock`;

export type StockUnit = 'kg' | 'g' | 'litre' | 'ml' | 'piece' | 'box' | 'bottle' | 'packet';
export type MovementType = 'in' | 'out';

export const STOCK_UNITS: StockUnit[] = ['piece', 'kg', 'g', 'litre', 'ml', 'box', 'bottle', 'packet'];

export interface StockItem {
  id: string;
  restaurantId: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  minThreshold: number;
  costPerUnit: number;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  restaurantId: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface StockItemInput {
  name: string;
  unit: StockUnit;
  quantity?: number;
  minThreshold?: number;
  costPerUnit?: number;
  category?: string;
}

export interface MovementInput {
  type: MovementType;
  quantity: number;
  reason?: string;
  notes?: string;
}

export const MOVEMENT_REASONS_IN  = ['Purchase / Delivery', 'Return', 'Adjustment', 'Opening stock', 'Other'];
export const MOVEMENT_REASONS_OUT = ['Used in kitchen', 'Wastage / Spoilage', 'Adjustment', 'Expired', 'Other'];

export const stockService = {
  list: (): Promise<StockItem[]> =>
    axios.get<StockItem[]>(BASE).then(r => r.data),

  create: (data: StockItemInput): Promise<StockItem> =>
    axios.post<StockItem>(BASE, data).then(r => r.data),

  update: (id: string, data: Partial<StockItemInput>): Promise<StockItem> =>
    axios.patch<StockItem>(`${BASE}/${id}`, data).then(r => r.data),

  remove: (id: string): Promise<void> =>
    axios.delete(`${BASE}/${id}`).then(() => undefined),

  logMovement: (id: string, data: MovementInput): Promise<{ item: StockItem; movement: StockMovement }> =>
    axios.post(`${BASE}/${id}/movements`, data).then(r => r.data),

  getMovements: (id: string): Promise<StockMovement[]> =>
    axios.get<StockMovement[]>(`${BASE}/${id}/movements`).then(r => r.data),
};
