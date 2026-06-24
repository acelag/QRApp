import axios from 'axios';

export interface BillItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  size?: 'regular' | 'large';
  toppings?: { id: string; name: string; price: number }[];
}

export interface SessionOrder {
  id: string;
  orderNumber?: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  rating?: number | null;
  feedbackNote?: string | null;
  items: { menuItemId: string; name: string; price: number; quantity: number; notes?: string; size?: 'regular' | 'large'; toppings?: { id: string; name: string; price: number }[] }[];
}

export interface Session {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  status: 'open' | 'paid' | 'closed';
  createdAt: string;
  closedAt: string | null;
  paymentMethod?: string | null;
  mergedIntoSessionId?: string | null;
  mergedSessions?: { id: string; tableNumber: number }[];
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
  markAsPaid: (sessionId: string, paymentMethod?: string) =>
    axios.patch<Session>(`${BASE}/${sessionId}/pay`, { paymentMethod }).then((r) => r.data),

  /** Manually close a session without payment — admin/manager only. */
  closeSession: (sessionId: string) =>
    axios.patch<Session>(`${BASE}/${sessionId}/close`).then((r) => r.data),

  /** Merge sessionId into intoSessionId (secondary → primary). Returns updated primary. */
  merge: (sessionId: string, intoSessionId: string) =>
    axios.patch<Session>(`${BASE}/${sessionId}/merge`, { intoSessionId }).then((r) => r.data),

  /** Detach a secondary session from its primary. Returns the now-standalone session. */
  unmerge: (sessionId: string) =>
    axios.patch<Session>(`${BASE}/${sessionId}/unmerge`).then((r) => r.data),
};
