import axios from 'axios';
import type { Table } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export type TableOccupancyStatus = 'free' | 'waiting' | 'active' | 'stale';

export interface TableStatusEntry {
  id: string;
  number: number;
  seats: number;
  sessionId: string | null;
  sessionStarted: string | null;
  orderCount: number;
  activeOrders: number;   // pending + preparing
  readyOrders: number;
  sessionTotal: number;
  lastOrderAt: string | null;
  status: TableOccupancyStatus;
}

export const tableService = {
  getTables: () => axios.get<Table[]>(`${BASE}/tables`).then((r) => r.data),
  getTable: (id: string) => axios.get<Table>(`${BASE}/tables/${id}`).then((r) => r.data),
  getStatus: () => axios.get<TableStatusEntry[]>(`${BASE}/tables/status`).then((r) => r.data),
  createTable: (number: number, seats: number) =>
    axios.post<Table>(`${BASE}/tables`, { number, seats }).then((r) => r.data),
  updateTable: (id: string, data: Partial<Table>) =>
    axios.put<Table>(`${BASE}/tables/${id}`, data).then((r) => r.data),
  deleteTable: (id: string) => axios.delete(`${BASE}/tables/${id}`),
};
