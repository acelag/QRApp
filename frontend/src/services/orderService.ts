import axios from 'axios';
import type { CartItem, Order, OrderStatus } from '../types';

const BASE = '/api';

export const orderService = {
  placeOrder: (tableId: string, tableNumber: number, items: CartItem[], sessionId?: string, restaurantId?: string) =>
    axios
      .post<Order>(`${BASE}/orders`, { tableId, tableNumber, items, sessionId, restaurantId, orderType: 'dine-in' })
      .then((r) => r.data),

  placeTakeawayOrder: (items: CartItem[], customerName?: string, restaurantId?: string) =>
    axios
      .post<Order>(`${BASE}/orders`, { items, orderType: 'takeaway', customerName, restaurantId })
      .then((r) => r.data),

  getOrders: () => axios.get<Order[]>(`${BASE}/orders`).then((r) => r.data),
  getOrder:  (id: string) => axios.get<Order>(`${BASE}/orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus) =>
    axios.patch<Order>(`${BASE}/orders/${id}/status`, { status }).then((r) => r.data),
};
