import axios from 'axios';

export interface BillItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface SessionOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { menuItemId: string; name: string; price: number; quantity: number; notes?: string }[];
}

export interface Session {
  id: string;
  tableId: string;
  tableNumber: number;
  status: 'open' | 'paid';
  createdAt: string;
  closedAt: string | null;
  orders?: SessionOrder[];
  billItems?: BillItem[];
  totalAmount?: number;
}

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/sessions`;

export const sessionService = {
  /** Create or return the existing open session for a table (public). */
  getOrCreate: (tableId: string, tableNumber: number, restaurantId: string) =>
    axios.post<Session>(BASE, { tableId, tableNumber, restaurantId }).then((r) => r.data),

  /** Full session detail with orders + aggregated bill (public). */
  getSession: (sessionId: string) =>
    axios.get<Session>(`${BASE}/${sessionId}`).then((r) => r.data),

  /** All sessions — admin only. Pass status='open'|'paid' to filter. */
  getSessions: (status?: 'open' | 'paid') =>
    axios.get<Session[]>(BASE, { params: status ? { status } : undefined }).then((r) => r.data),

  /** Mark a session as paid — admin only. */
  markAsPaid: (sessionId: string) =>
    axios.patch<Session>(`${BASE}/${sessionId}/pay`).then((r) => r.data),
};
