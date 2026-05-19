import axios from 'axios';
import type { CartItem, Order, OrderStatus } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export const orderService = {
  placeOrder: (tableId: string, tableNumber: number, items: CartItem[], sessionId?: string, restaurantId?: string, promoCode?: string) =>
    axios
      .post<Order>(`${BASE}/orders`, { tableId, tableNumber, items, sessionId, restaurantId, orderType: 'dine-in', promoCode })
      .then((r) => r.data),

  placeTakeawayOrder: (items: CartItem[], customerName?: string, restaurantId?: string, promoCode?: string, customerPhone?: string) =>
    axios
      .post<Order>(`${BASE}/orders`, { items, orderType: 'takeaway', customerName, restaurantId, promoCode, customerPhone })
      .then((r) => r.data),

  placeRoomOrder: (roomId: string, roomNumber: number, items: CartItem[], customerName?: string, restaurantId?: string, promoCode?: string, customerPhone?: string, paymentMethod?: string) =>
    axios
      .post<Order>(`${BASE}/orders`, { roomId, roomNumber, items, orderType: 'room-service', customerName, restaurantId, promoCode, customerPhone, paymentMethod })
      .then((r) => r.data),

  getOrders: () => axios.get<Order[]>(`${BASE}/orders`).then((r) => r.data),
  getOrder:  (id: string) => axios.get<Order>(`${BASE}/orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus, paymentMethod?: string) =>
    axios.patch<Order>(`${BASE}/orders/${id}/status`, { status, paymentMethod }).then((r) => r.data),

  settleRoomCharge: (id: string, paymentMethod: string) =>
    axios.patch<Order>(`${BASE}/orders/${id}/payment-method`, { paymentMethod }).then((r) => r.data),
};
