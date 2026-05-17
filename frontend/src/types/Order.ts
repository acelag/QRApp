export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';
export type OrderType   = 'dine-in' | 'takeaway';

export interface SelectedTopping {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  size?: 'regular' | 'large';
  toppings?: SelectedTopping[];
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  size?: 'regular' | 'large';
  toppings?: SelectedTopping[];
}

export interface Order {
  id: string;
  restaurantId?: string | null;
  sessionId?: string | null;
  tableId?: string | null;
  tableNumber?: number | null;
  orderType: OrderType;
  customerName?: string | null;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}
