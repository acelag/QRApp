import axios from 'axios';
import type { Reservation, ReservationStatus } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/reservations`;

export interface ReservationInput {
  customerName: string;
  customerPhone?: string;
  partySize?: number;
  date: string;
  time: string;
  tableId?: string | null;
  tableNumber?: number | null;
  notes?: string;
}

export const reservationService = {
  getByDate:     (date: string)                          => axios.get<Reservation[]>(`${BASE}?date=${date}`).then((r) => r.data),
  create:        (data: ReservationInput)                => axios.post<Reservation>(BASE, data).then((r) => r.data),
  update:        (id: string, data: Partial<ReservationInput>) => axios.put<Reservation>(`${BASE}/${id}`, data).then((r) => r.data),
  updateStatus:  (id: string, status: ReservationStatus) => axios.patch<Reservation>(`${BASE}/${id}/status`, { status }).then((r) => r.data),
  remove:        (id: string)                            => axios.delete(`${BASE}/${id}`),
};
