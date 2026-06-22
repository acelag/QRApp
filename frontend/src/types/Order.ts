export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'cancelled' | 'paid';
export type OrderType   = 'dine-in' | 'takeaway' | 'room-service';

export interface SelectedTopping {
  id: string;
  name: string;
  price: number;
}

export interface SelectedModifier {
  groupId?: string;
  groupName: string;
  optionId: string;
  optionName: string;
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
  modifiers?: SelectedModifier[];
  /** Set when this cart item is a combo/bundle deal */
  comboId?: string;
  /** Display names of items included in the combo */
  comboItems?: string[];
}

export interface OrderItem {
  id?: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  size?: 'regular' | 'large';
  toppings?: SelectedTopping[];
  modifiers?: SelectedModifier[];
  comboId?: string;
}

export interface Order {
  id: string;
  orderNumber?: string | null;
  restaurantId?: string | null;
  sessionId?: string | null;
  tableId?: string | null;
  tableNumber?: number | null;
  roomId?: string | null;
  roomNumber?: number | null;
  orderType: OrderType;
  customerName?: string | null;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  serviceChargeAmount?: number;
  promoCode?: string | null;
  paymentMethod?: string | null;
  customerPhone?: string | null;
  assignedWaiterId?: string | null;
  assignedWaiterName?: string | null;
  rating?: number | null;
  feedbackNote?: string | null;
  createdAt: string;
  updatedAt: string;
}
