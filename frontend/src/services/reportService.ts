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

export interface PromoReportRow {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  orderCount: number;    // times used in the selected date range
  totalDiscount: number; // total discount given in the range
  avgDiscount: number;   // average discount per redemption
}

export interface PaymentMethodRow {
  method: string;     // 'cash' | 'card' | 'qr' | 'unknown' | any custom value
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
  promos: PromoReportRow[];
  paymentMethods: PaymentMethodRow[];
}

export interface TodaySummary {
  revenue: number;       // net revenue (gross - refunds)
  grossRevenue: number;
  totalRefunds: number;
  refundCount: number;
  orderCount: number;
  avgOrderValue: number;
  dineIn: number;
  takeaway: number;
  roomService: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}

export interface ShiftCloseRefund {
  id: string;
  amount: number;
  reason: string;
  method: string;
  issuedBy: string;
  createdAt: string;
  orderId: string | null;
  sessionId: string | null;
}

export interface ShiftCloseOpenSession {
  id: string;
  tableNumber: number;
  openedAt: string;
  estimatedTotal: number;
}

export interface ShiftCloseReport {
  date: string;
  generatedAt: string;
  summary: {
    grossRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    totalDiscounts: number;
    orderCount: number;
    avgOrderValue: number;
    dineIn:      { count: number; revenue: number };
    takeaway:    { count: number; revenue: number };
    roomService: { count: number; revenue: number };
  };
  paymentMethods: { method: string; count: number; revenue: number }[];
  topItems:       { name: string; quantity: number; revenue: number }[];
  refunds:        ShiftCloseRefund[];
  openSessions:   ShiftCloseOpenSession[];
}

export const reportService = {
  get: (from: string, to: string) =>
    axios.get<Report>(BASE, { params: { from, to } }).then((r) => r.data),
  getToday: () =>
    axios.get<TodaySummary>(`${BASE}/today`).then((r) => r.data),
  getShiftClose: (date?: string) =>
    axios.get<ShiftCloseReport>(`${BASE}/shift-close`, { params: date ? { date } : {} }).then((r) => r.data),
};
