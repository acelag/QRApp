import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { CartItem, MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';

interface CartState {
  items: CartItem[];
  tableId: string | null;
  tableNumber: number | null;
  sessionId: string | null;
  restaurantId: string | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { menuItem: MenuItem; notes?: string } }
  | { type: 'REMOVE_ITEM'; payload: { menuItemId: string } }
  | { type: 'UPDATE_QTY'; payload: { menuItemId: string; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { menuItemId: string; notes: string } }
  | { type: 'SET_TABLE'; payload: { tableId: string; tableNumber: number } }
  | { type: 'SET_SESSION'; payload: { sessionId: string } }
  | { type: 'SET_RESTAURANT'; payload: { restaurantId: string } }
  | { type: 'CLEAR' };

interface CartContextValue extends CartState {
  addItem: (menuItem: MenuItem, notes?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQty: (menuItemId: string, quantity: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
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
      const { menuItem, notes } = action.payload;
      const existing = state.items.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { menuItemId: menuItem.id, name: menuItem.name, price: effectivePrice(menuItem), quantity: 1, notes },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.menuItemId !== action.payload.menuItemId) };
    case 'UPDATE_QTY':
      if (action.payload.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.menuItemId !== action.payload.menuItemId) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.payload.menuItemId ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    case 'UPDATE_NOTES':
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.payload.menuItemId ? { ...i, notes: action.payload.notes } : i
        ),
      };
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

  const total = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        ...state,
        total,
        itemCount,
        addItem: (menuItem, notes) => dispatch({ type: 'ADD_ITEM', payload: { menuItem, notes } }),
        removeItem: (menuItemId) => dispatch({ type: 'REMOVE_ITEM', payload: { menuItemId } }),
        updateQty: (menuItemId, quantity) => dispatch({ type: 'UPDATE_QTY', payload: { menuItemId, quantity } }),
        updateNotes: (menuItemId, notes) => dispatch({ type: 'UPDATE_NOTES', payload: { menuItemId, notes } }),
        setTable: (tableId, tableNumber) => dispatch({ type: 'SET_TABLE', payload: { tableId, tableNumber } }),
        setSession: (sessionId) => dispatch({ type: 'SET_SESSION', payload: { sessionId } }),
        setRestaurant: (restaurantId) => dispatch({ type: 'SET_RESTAURANT', payload: { restaurantId } }),
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
