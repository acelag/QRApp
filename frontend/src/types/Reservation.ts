export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no-show';

export interface Reservation {
  id: string;
  restaurantId: string;
  tableId?: string | null;
  tableNumber?: number | null;
  customerName: string;
  customerPhone?: string | null;
  partySize: number;
  date: string;
  time: string;
  status: ReservationStatus;
  notes?: string | null;
  createdAt: string;
}
