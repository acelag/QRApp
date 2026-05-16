import axios from 'axios';
import type { Table } from '../types';

const BASE = '/api';

export const tableService = {
  getTables: () => axios.get<Table[]>(`${BASE}/tables`).then((r) => r.data),
  getTable: (id: string) => axios.get<Table>(`${BASE}/tables/${id}`).then((r) => r.data),
  createTable: (number: number, seats: number) =>
    axios.post<Table>(`${BASE}/tables`, { number, seats }).then((r) => r.data),
  updateTable: (id: string, data: Partial<Table>) =>
    axios.put<Table>(`${BASE}/tables/${id}`, data).then((r) => r.data),
  deleteTable: (id: string) => axios.delete(`${BASE}/tables/${id}`),
};
