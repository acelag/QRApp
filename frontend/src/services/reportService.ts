import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/reports`;

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  dineInOrders: number;
  takeawayOrders: number;
  avgOrderValue: number;
}

export interface DailyRow {
  date: string;
  orderCount: number;
  revenue: number;
  dineInCount: number;
  takeawayCount: number;
}

export interface ItemRow {
  name: string;
  size: 'regular' | 'large' | null;
  quantity: number;
  baseRevenue: number;
  toppingRevenue: number;
  totalRevenue: number;
}

export interface ToppingRow {
  name: string;
  timesOrdered: number;
  revenue: number;
}

export interface CategoryRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface Report {
  summary: ReportSummary;
  daily: DailyRow[];
  items: ItemRow[];
  toppings: ToppingRow[];
  categories: CategoryRow[];
}

export const reportService = {
  get: (from: string, to: string) =>
    axios.get<Report>(BASE, { params: { from, to } }).then((r) => r.data),
};
