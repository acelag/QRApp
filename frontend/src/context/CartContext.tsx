import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { CartItem, SelectedTopping } from '../types';
import type { MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';

type Size = 'regular' | 'large';

const toppingKey = (toppings?: SelectedTopping[]) =>
  (toppings ?? []).map((t) => t.id).sort().join(',');

const itemKey = (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) =>
  `${menuItemId}|${size ?? 'regular'}|${toppingKey(toppings)}`;

interface CartState {
  items: CartItem[];
  tableId: string | null;
  tableNumber: number | null;
  sessionId: string | null;
  restaurantId: string | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { menuItem: MenuItem; size?: Size; notes?: string; toppings?: SelectedTopping[] } }
  | { type: 'REMOVE_ITEM'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[] } }
  | { type: 'UPDATE_QTY'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[]; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[]; notes: string } }
  | { type: 'SET_TABLE'; payload: { tableId: string; tableNumber: number } }
  | { type: 'SET_SESSION'; payload: { sessionId: string } }
  | { type: 'SET_RESTAURANT'; payload: { restaurantId: string } }
  | { type: 'CLEAR' };

interface CartContextValue extends CartState {
  addItem: (menuItem: MenuItem, size?: Size, notes?: string, toppings?: SelectedTopping[]) => void;
  removeItem: (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) => void;
  updateQty: (menuItemId: string, size?: Size, toppings?: SelectedTopping[], quantity?: number) => void;
  updateNotes: (menuItemId: string, size?: Size, toppings?: SelectedTopping[], notes?: string) => void;
  setTable: (tableId: string, tableNumber: number) => void;
  setSession: (sessionId: string) => void;
  setRestaurant: (restaurantId: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { menuItem, size, notes, toppings } = action.payload;
      const key = itemKey(menuItem.id, size, toppings);
      const price = effectivePrice(menuItem, size);
      const existing = state.items.find((i) => itemKey(i.menuItemId, i.size, i.toppings) === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            itemKey(i.menuItemId, i.size, i.toppings) === key ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { menuItemId: menuItem.id, name: menuItem.name, price, quantity: 1, notes, size, toppings },
        ],
      };
    }
    case 'REMOVE_ITEM': {
      const key = itemKey(action.payload.menuItemId, action.payload.size, action.payload.toppings);
      return { ...state, items: state.items.filter((i) => itemKey(i.menuItemId, i.size, i.toppings) !== key) };
    }
    case 'UPDATE_QTY': {
      const key = itemKey(action.payload.menuItemId, action.payload.size, action.payload.toppings);
      if ((action.payload.quantity ?? 0) <= 0) {
        return { ...state, items: state.items.filter((i) => itemKey(i.menuItemId, i.size, i.toppings) !== key) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          itemKey(i.menuItemId, i.size, i.toppings) === key ? { ...i, quantity: action.payload.quantity! } : i
        ),
      };
    }
    case 'UPDATE_NOTES': {
      const key = itemKey(action.payload.menuItemId, action.payload.size, action.payload.toppings);
      return {
        ...state,
        items: state.items.map((i) =>
          itemKey(i.menuItemId, i.size, i.toppings) === key ? { ...i, notes: action.payload.notes } : i
        ),
      };
    }
    case 'SET_TABLE':
      return { ...state, tableId: action.payload.tableId, tableNumber: action.payload.tableNumber };
    case 'SET_SESSION':
      return { ...state, sessionId: action.payload.sessionId };
    case 'SET_RESTAURANT':
      return { ...state, restaurantId: action.payload.restaurantId };
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], tableId: null, tableNumber: null, sessionId: null, restaurantId: null });

  const total = state.items.reduce((sum, i) => {
    const toppingsTotal = (i.toppings ?? []).reduce((t, tp) => t + tp.price, 0);
    return sum + (i.price + toppingsTotal) * i.quantity;
  }, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        ...state,
        total,
        itemCount,
        addItem: (menuItem, size, notes, toppings) =>
          dispatch({ type: 'ADD_ITEM', payload: { menuItem, size, notes, toppings } }),
        removeItem: (menuItemId, size, toppings) =>
          dispatch({ type: 'REMOVE_ITEM', payload: { menuItemId, size, toppings } }),
        updateQty: (menuItemId, size, toppings, quantity) =>
          dispatch({ type: 'UPDATE_QTY', payload: { menuItemId, size, toppings, quantity: quantity ?? 0 } }),
        updateNotes: (menuItemId, size, toppings, notes) =>
          dispatch({ type: 'UPDATE_NOTES', payload: { menuItemId, size, toppings, notes: notes ?? '' } }),
        setTable: (tableId, tableNumber) =>
          dispatch({ type: 'SET_TABLE', payload: { tableId, tableNumber } }),
        setSession: (sessionId) =>
          dispatch({ type: 'SET_SESSION', payload: { sessionId } }),
        setRestaurant: (restaurantId) =>
          dispatch({ type: 'SET_RESTAURANT', payload: { restaurantId } }),
        clearCart: () => dispatch({ type: 'CLEAR' }),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
