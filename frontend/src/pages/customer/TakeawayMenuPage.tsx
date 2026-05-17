import { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, ChevronUp, ChevronDown, UtensilsCrossed } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { SelectedTopping } from '../../types/Order';
import { effectivePrice } from '../../types/MenuItem';
import type { CartItem } from '../../types/Order';
import { menuService } from '../../services/menuService';
import { restaurantService } from '../../services/restaurantService';
import { orderService } from '../../services/orderService';
import { CategoryTabs } from '../../components/CategoryTabs';
import { ToppingSelectionModal } from '../../components/ToppingSelectionModal';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

type Size = 'regular' | 'large';

const toppingKey = (toppings?: SelectedTopping[]) => (toppings ?? []).map((t) => t.id).sort().join(',');
const cartKey = (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) =>
  `${menuItemId}|${size ?? 'regular'}|${toppingKey(toppings)}`;

type CartAction =
  | { type: 'ADD';    item: MenuItem; size?: Size; toppings?: SelectedTopping[] }
  | { type: 'INC';    key: string }
  | { type: 'DEC';    key: string }
  | { type: 'REMOVE'; key: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const key = cartKey(action.item.id, action.size, action.toppings);
      const price = effectivePrice(action.item, action.size);
      const exists = state.find((c) => cartKey(c.menuItemId, c.size, c.toppings) === key);
      if (exists) return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...state, { menuItemId: action.item.id, name: action.item.name, price, quantity: 1, size: action.size, toppings: action.toppings }];
    }
    case 'INC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity + 1 } : c);
    case 'DEC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.quantity > 0);
    case 'REMOVE':
      return state.filter((c) => cartKey(c.menuItemId, c.size, c.toppings) !== action.key);
    case 'CLEAR': return [];
    default: return state;
  }
}

export function TakeawayMenuPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();

  const [categories, setCategories]   = useState<Category[]>([]);
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]         = useState(true);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; logo: string | null } | null>(null);

  const [cart, dispatch]              = useReducer(cartReducer, []);
  const [customerName, setCustomerName] = useState('');
  const [cartOpen, setCartOpen]       = useState(false);
  const [placing, setPlacing]         = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, Size>>({});
  const [toppingModal, setToppingModal] = useState<{ item: MenuItem; size?: Size } | null>(null);
  const { fmt, loadCurrency } = useCurrency();
  const { loadTheme } = useTheme();

  useEffect(() => {
    if (!restaurantId) return;
    restaurantService.getRestaurantInfo(restaurantId).then(setRestaurantInfo).catch(() => {});
    Promise.all([
      menuService.getCategories(restaurantId),
      menuService.getItems(restaurantId),
    ]).then(([cats, menuItems]) => {
      setCategories(cats);
      setItems(menuItems.filter((i) => i.available));
      if (restaurantId) { loadCurrency(restaurantId); loadTheme(restaurantId); }
    }).catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const total = cart.reduce((s, c) => s + (c.price + (c.toppings ?? []).reduce((t, tp) => t + tp.price, 0)) * c.quantity, 0);

  const getSizeFor = (item: MenuItem): Size => selectedSizes[item.id] ?? 'regular';
  const cartQtyFor = (item: MenuItem) => {
    const size = item.largePrice ? getSizeFor(item) : undefined;
    return cart.filter((c) => c.menuItemId === item.id && c.size === size).reduce((s, c) => s + c.quantity, 0);
  };

  function handleAdd(item: MenuItem) {
    const hasLarge = item.largePrice != null && item.largePrice > 0;
    const size = hasLarge ? getSizeFor(item) : undefined;
    const hasToppings = (item.toppings ?? []).some((t) => t.available);
    if (hasToppings) {
      setToppingModal({ item, size });
    } else {
      dispatch({ type: 'ADD', item, size });
    }
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const order = await orderService.placeTakeawayOrder(cart, customerName.trim() || undefined, restaurantId);
      dispatch({ type: 'CLEAR' });
      setCartOpen(false);
      navigate(`/order-success/${order.id}`);
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            {restaurantInfo?.logo
              ? <img src={restaurantInfo.logo} alt="logo" className="w-8 h-8 object-contain rounded-md" />
              : <ShoppingBag size={20} className="text-purple-500" />}
            <h1 className="text-xl font-bold text-gray-900">{restaurantInfo?.name ?? 'Takeaway Order'}</h1>
          </div>
          <p className="text-sm text-gray-400">Browse the menu and tap Add to get started</p>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>
      </header>

      {/* Menu grid */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">No items in this category</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((item) => {
              const hasLarge = item.largePrice != null && item.largePrice > 0;
              const hasToppings = (item.toppings ?? []).some((t) => t.available);
              const size = hasLarge ? getSizeFor(item) : undefined;
              const displayPrice = effectivePrice(item, size);
              const isDiscounted = size === 'large' ? (item.largeDiscountPct ?? 0) > 0 : item.discountPct > 0;
              const basePrice = size === 'large' ? item.largePrice! : item.price;
              const discountPct = size === 'large' ? (item.largeDiscountPct ?? 0) : item.discountPct;
              const qty = cartQtyFor(item);

              return (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${qty > 0 ? 'border-purple-200' : 'border-gray-100'}`}>
                  <div className="relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-36 object-cover" />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                        <UtensilsCrossed size={32} className="text-purple-300" />
                      </div>
                    )}
                    {isDiscounted && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {discountPct}% OFF
                      </span>
                    )}
                    {hasToppings && (
                      <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        + Extras
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">{item.description}</p>
                    )}
                    <div className="mt-2">
                      {hasLarge && (
                        <div className="flex gap-1 mb-2">
                          {(['regular', 'large'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setSelectedSizes((prev) => ({ ...prev, [item.id]: s }))}
                              className={`flex-1 text-xs py-0.5 rounded-lg font-medium border transition-colors ${
                                getSizeFor(item) === s
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              {s === 'regular' ? 'Reg' : 'Lrg'}
                            </button>
                          ))}
                        </div>
                      )}
                      {isDiscounted ? (
                        <div>
                          <span className="text-xs text-gray-400 line-through">{fmt(basePrice)}</span>
                          <span className="ml-1.5 text-green-600 font-bold">{fmt(displayPrice)}</span>
                        </div>
                      ) : (
                        <span className="text-purple-600 font-bold">{fmt(displayPrice)}</span>
                      )}
                      <div className="mt-2">
                        <button
                          onClick={() => handleAdd(item)}
                          className="w-full flex items-center justify-center gap-1 bg-purple-600 text-white py-1.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                        >
                          <Plus size={14} /> {qty > 0 ? `Add more (${qty})` : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart panel */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-lg mx-auto px-4 pb-4">
            {/* Expanded cart */}
            {cartOpen && (
              <div className="bg-white rounded-t-3xl shadow-2xl border border-gray-100 mb-0 max-h-[60vh] flex flex-col">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 mb-2">Your Order</p>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name (optional — helps identify your order)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-300 mb-1"
                  />
                </div>

                {/* Cart items */}
                <ul className="overflow-y-auto flex-1 divide-y divide-gray-50 px-4">
                  {cart.map((c) => {
                    const key = cartKey(c.menuItemId, c.size, c.toppings);
                    const toppingsTotal = (c.toppings ?? []).reduce((s, t) => s + t.price, 0);
                    return (
                      <li key={key} className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => dispatch({ type: 'DEC', key })} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center font-bold text-gray-900 text-sm">{c.quantity}</span>
                            <button onClick={() => dispatch({ type: 'INC', key })} className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200">
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{c.name}</span>
                            {c.size && <span className="text-xs text-purple-500 capitalize">{c.size}</span>}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 shrink-0">{fmt((c.price + toppingsTotal) * c.quantity)}</span>
                          <button onClick={() => dispatch({ type: 'REMOVE', key })} className="text-gray-300 hover:text-red-400 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {(c.toppings ?? []).length > 0 && (
                          <ul className="ml-16 mt-0.5 space-y-0.5">
                            {c.toppings!.map((t, ti) => (
                              <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Cart button */}
            <button
              onClick={() => cartOpen ? placeOrder() : setCartOpen(true)}
              disabled={placing}
              className="w-full bg-purple-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{itemCount}</span>
              <span className="font-semibold">
                {placing ? 'Placing Order…' : cartOpen ? `Place Order • ${fmt(total)}` : `View Order • ${fmt(total)}`}
              </span>
              {cartOpen
                ? <ChevronDown size={20} onClick={(e) => { e.stopPropagation(); setCartOpen(false); }} />
                : <ChevronUp size={20} />
              }
            </button>
          </div>
        </div>
      )}

      {toppingModal && (
        <ToppingSelectionModal
          item={toppingModal.item}
          size={toppingModal.size}
          onConfirm={(toppings) => {
            dispatch({ type: 'ADD', item: toppingModal.item, size: toppingModal.size, toppings });
            setToppingModal(null);
          }}
          onClose={() => setToppingModal(null)}
        />
      )}
    </div>
  );
}
