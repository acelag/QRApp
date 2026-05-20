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

export interface HeatmapCell {
  dayOfWeek: number;  // 0 = Sunday … 6 = Saturday
  hour: number;       // 0 – 23
  orderCount: number;
  revenue: number;
}

export interface Report {
  summary: ReportSummary;
  daily: DailyRow[];
  items: ItemRow[];
  toppings: ToppingRow[];
  categories: CategoryRow[];
  heatmap: HeatmapCell[];
}

export interface TodaySummary {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  dineIn: number;
  takeaway: number;
  roomService: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}

export const reportService = {
  get: (from: string, to: string) =>
    axios.get<Report>(BASE, { params: { from, to } }).then((r) => r.data),
  getToday: () =>
    axios.get<TodaySummary>(`${BASE}/today`).then((r) => r.data),
};
