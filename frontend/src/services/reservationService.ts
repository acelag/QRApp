import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export type ReservationType = 'table' | 'room';
export type ReservationStatus = 'booked' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  type: ReservationType;
  tableId: string | null;
  roomId: string | null;
  tableNumber: number | null;
  roomNumber: number | null;
  roomName: string | null;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  reservedAt: string;
  durationMins: number | null;
  status: ReservationStatus;
  notes: string | null;
  createdAt: string;
}

export interface ReservationInput {
  type: ReservationType;
  tableId?: string | null;
  roomId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  partySize: number;
  reservedAt: string; // ISO
  notes?: string | null;
}

export const reservationService = {
  list: (params?: { date?: string; status?: ReservationStatus }): Promise<Reservation[]> =>
    axios.get<Reservation[]>(`${BASE}/reservations`, { params }).then((r) => r.data),

  create: (input: ReservationInput): Promise<Reservation> =>
    axios.post<Reservation>(`${BASE}/reservations`, input).then((r) => r.data),

  update: (id: string, patch: Partial<ReservationInput> & { status?: ReservationStatus }): Promise<Reservation> =>
    axios.patch<Reservation>(`${BASE}/reservations/${id}`, patch).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    axios.delete(`${BASE}/reservations/${id}`).then(() => undefined),
};
