import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { CartItem, SelectedTopping } from '../types';
import type { MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';

type Size = 'regular' | 'large';

const toppingKey = (toppings?: SelectedTopping[]) =>
  (toppings ?? []).map((t) => t.id).sort().join(',');

const itemKey = (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) =>
  `${menuItemId}|${size ?? 'regular'}|${toppingKey(toppings)}`;

// ── Persistence ──────────────────────────────────────────────────────────────

const CART_KEY_PREFIX = 'qra-saved-cart-';
const CART_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface SavedCart {
  items: CartItem[];
  tableId: string;
  tableNumber: number;
  restaurantId: string | null;
  total: number;
  savedAt: number;
}

function readSavedCart(tableId: string): SavedCart | null {
  try {
    const raw = localStorage.getItem(CART_KEY_PREFIX + tableId);
    if (!raw) return null;
    const cart: SavedCart = JSON.parse(raw);
    if (!cart.items?.length) return null;
    if (Date.now() - cart.savedAt > CART_MAX_AGE_MS) {
      localStorage.removeItem(CART_KEY_PREFIX + tableId);
      return null;
    }
    return cart;
  } catch {
    return null;
  }
}

// ── State ────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  tableId: string | null;
  tableNumber: number | null;
  sessionId: string | null;
  restaurantId: string | null;
  pendingSavedCart: SavedCart | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { menuItem: MenuItem; size?: Size; notes?: string; toppings?: SelectedTopping[] } }
  | { type: 'ADD_COMBO'; payload: { comboId: string; name: string; price: number; comboItems: string[] } }
  | { type: 'REMOVE_ITEM'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[] } }
  | { type: 'UPDATE_QTY'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[]; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { menuItemId: string; size?: Size; toppings?: SelectedTopping[]; notes: string } }
  | { type: 'BULK_ADD'; payload: { items: CartItem[] } }
  | { type: 'SET_TABLE'; payload: { tableId: string; tableNumber: number } }
  | { type: 'SET_SESSION'; payload: { sessionId: string } }
  | { type: 'SET_RESTAURANT'; payload: { restaurantId: string } }
  | { type: 'SET_PENDING_SAVED'; payload: SavedCart | null }
  | { type: 'RESTORE_SAVED' }
  | { type: 'DISCARD_SAVED' }
  | { type: 'CLEAR' };

interface CartContextValue extends CartState {
  addItem: (menuItem: MenuItem, size?: Size, notes?: string, toppings?: SelectedTopping[]) => void;
  addCombo: (comboId: string, name: string, price: number, comboItems: string[]) => void;
  removeItem: (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) => void;
  updateQty: (menuItemId: string, size?: Size, toppings?: SelectedTopping[], quantity?: number) => void;
  updateNotes: (menuItemId: string, size?: Size, toppings?: SelectedTopping[], notes?: string) => void;
  bulkAdd: (items: CartItem[]) => void;
  setTable: (tableId: string, tableNumber: number) => void;
  setSession: (sessionId: string) => void;
  setRestaurant: (restaurantId: string) => void;
  checkForSavedCart: (tableId: string) => void;
  restoreCart: () => void;
  discardCart: () => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const INITIAL_STATE: CartState = {
  items: [], tableId: null, tableNumber: null,
  sessionId: null, restaurantId: null, pendingSavedCart: null,
};

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
    case 'ADD_COMBO': {
      const { comboId, name, price, comboItems } = action.payload;
      const key = itemKey(comboId, undefined, undefined);
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
        items: [...state.items, { menuItemId: comboId, name, price, quantity: 1, comboId, comboItems }],
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
    case 'BULK_ADD': {
      const merged = [...state.items];
      for (const newItem of action.payload.items) {
        const key = itemKey(newItem.menuItemId, newItem.size, newItem.toppings);
        const idx = merged.findIndex((i) => itemKey(i.menuItemId, i.size, i.toppings) === key);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + newItem.quantity };
        } else {
          merged.push({ ...newItem });
        }
      }
      return { ...state, items: merged };
    }
    case 'SET_TABLE':
      return { ...state, tableId: action.payload.tableId, tableNumber: action.payload.tableNumber };
    case 'SET_SESSION':
      return { ...state, sessionId: action.payload.sessionId };
    case 'SET_RESTAURANT':
      return { ...state, restaurantId: action.payload.restaurantId };
    case 'SET_PENDING_SAVED':
      return { ...state, pendingSavedCart: action.payload };
    case 'RESTORE_SAVED':
      if (!state.pendingSavedCart) return state;
      return { ...state, items: state.pendingSavedCart.items, pendingSavedCart: null };
    case 'DISCARD_SAVED':
      return { ...state, pendingSavedCart: null };
    case 'CLEAR':
      return { ...state, items: [], pendingSavedCart: null };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const total = state.items.reduce((sum, i) => {
    const toppingsTotal = (i.toppings ?? []).reduce((t, tp) => t + tp.price, 0);
    return sum + (i.price + toppingsTotal) * i.quantity;
  }, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  // Tracks whether the customer has actually interacted with the cart this session.
  // Prevents the persistence effect from wiping localStorage on the initial empty render.
  const hasInteractedRef = useRef(false);

  // Persist cart to localStorage whenever items or tableId change
  useEffect(() => {
    if (!state.tableId) return;
    if (state.items.length === 0) {
      // Only clear if the user actively emptied the cart (not just initial page load)
      if (hasInteractedRef.current) {
        localStorage.removeItem(CART_KEY_PREFIX + state.tableId);
      }
      return;
    }
    hasInteractedRef.current = true;
    const snapshot: SavedCart = {
      items: state.items,
      tableId: state.tableId,
      tableNumber: state.tableNumber!,
      restaurantId: state.restaurantId,
      total,
      savedAt: Date.now(),
    };
    localStorage.setItem(CART_KEY_PREFIX + state.tableId, JSON.stringify(snapshot));
  }, [state.items, state.tableId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CartContext.Provider
      value={{
        ...state,
        total,
        itemCount,
        addItem: (menuItem, size, notes, toppings) =>
          dispatch({ type: 'ADD_ITEM', payload: { menuItem, size, notes, toppings } }),
        addCombo: (comboId, name, price, comboItems) =>
          dispatch({ type: 'ADD_COMBO', payload: { comboId, name, price, comboItems } }),
        removeItem: (menuItemId, size, toppings) =>
          dispatch({ type: 'REMOVE_ITEM', payload: { menuItemId, size, toppings } }),
        updateQty: (menuItemId, size, toppings, quantity) =>
          dispatch({ type: 'UPDATE_QTY', payload: { menuItemId, size, toppings, quantity: quantity ?? 0 } }),
        updateNotes: (menuItemId, size, toppings, notes) =>
          dispatch({ type: 'UPDATE_NOTES', payload: { menuItemId, size, toppings, notes: notes ?? '' } }),
        bulkAdd: (items) =>
          dispatch({ type: 'BULK_ADD', payload: { items } }),
        setTable: (tableId, tableNumber) =>
          dispatch({ type: 'SET_TABLE', payload: { tableId, tableNumber } }),
        setSession: (sessionId) =>
          dispatch({ type: 'SET_SESSION', payload: { sessionId } }),
        setRestaurant: (restaurantId) =>
          dispatch({ type: 'SET_RESTAURANT', payload: { restaurantId } }),
        checkForSavedCart: (tableId) => {
          const saved = readSavedCart(tableId);
          dispatch({ type: 'SET_PENDING_SAVED', payload: saved });
        },
        restoreCart: () => dispatch({ type: 'RESTORE_SAVED' }),
        discardCart: () => {
          if (state.tableId) localStorage.removeItem(CART_KEY_PREFIX + state.tableId);
          dispatch({ type: 'DISCARD_SAVED' });
        },
        clearCart: () => {
          if (state.tableId) localStorage.removeItem(CART_KEY_PREFIX + state.tableId);
          dispatch({ type: 'CLEAR' });
        },
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
