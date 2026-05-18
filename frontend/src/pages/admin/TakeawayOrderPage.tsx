import { useEffect, useReducer, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Check } from 'lucide-react';

import type { Category, MenuItem } from '../../types';
import type { SelectedTopping } from '../../types/Order';
import { effectivePrice } from '../../types/MenuItem';
import type { CartItem } from '../../types/Order';
import { menuService } from '../../services/menuService';
import { orderService } from '../../services/orderService';
import { useCurrency } from '../../context/CurrencyContext';
import { ToppingSelectionModal } from '../../components/ToppingSelectionModal';
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

export function TakeawayOrderPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]       = useState(true);

  const [cart, dispatch]            = useReducer(cartReducer, []);
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing]       = useState(false);
  const [toppingModal, setToppingModal] = useState<{ item: MenuItem; size?: Size } | null>(null);
  const { fmt } = useCurrency();

  useEffect(() => {
    Promise.all([menuService.getCategories(), menuService.getItems()])
      .then(([cats, menuItems]) => {
        setCategories(cats);
        setItems(menuItems.filter((i) => i.available));
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  const cartQtyFor = (item: MenuItem, size?: Size) =>
    cart.filter((c) => c.menuItemId === item.id && c.size === size).reduce((s, c) => s + c.quantity, 0);

  const total     = cart.reduce((s, c) => s + (c.price + (c.toppings ?? []).reduce((t, tp) => t + tp.price, 0)) * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  function handleAddItem(item: MenuItem, size?: Size) {
    const hasToppings = (item.toppings ?? []).some((t) => t.available);
    if (hasToppings) {
      setToppingModal({ item, size });
    } else {
      dispatch({ type: 'ADD', item, size });
    }
  }

  async function handlePlace() {
    if (cart.length === 0) { toast.error('Add at least one item'); return; }
    setPlacing(true);
    try {
      const order = await orderService.placeTakeawayOrder(cart, customerName.trim() || undefined);
      toast.success('Takeaway order placed!');
      navigate(`/receipt/${order.id}`);
    } catch {
      toast.error('Failed to place order');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin/orders" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <ShoppingBag size={20} className="text-purple-500" />
          <h1 className="text-xl font-bold text-gray-900 flex-1">New Takeaway Order</h1>
        </div>
        {!loading && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >All</button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{c.name}</button>
            ))}
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Menu items ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center pt-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 pt-12">No items</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((item) => {
                const hasLarge = item.largePrice != null && item.largePrice > 0;
                const hasToppings = (item.toppings ?? []).some((t) => t.available);
                const regPrice = effectivePrice(item, 'regular');
                const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
                const regDisc  = item.discountPct > 0;
                const lrgDisc  = (item.largeDiscountPct ?? 0) > 0;
                const qtyReg   = cartQtyFor(item, hasLarge ? 'regular' : undefined);
                const qtyLrg   = cartQtyFor(item, 'large');
                const anyInCart = qtyReg > 0 || qtyLrg > 0;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border shadow-sm p-3 flex flex-col transition-colors ${
                      anyInCart ? 'border-orange-200' : 'border-gray-100'
                    }`}
                  >
                    <div className="relative w-full h-28 rounded-xl bg-orange-50 overflow-hidden mb-2">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>}
                      {hasToppings && (
                        <span className="absolute top-1 right-1 bg-orange-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                          + Extras
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight mb-1.5">{item.name}</p>

                    {hasLarge ? (
                      <div className="flex gap-1.5 mt-auto">
                        <div className="flex-1 flex flex-col gap-1">
                          {regDisc
                            ? <><span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span><span className="text-green-600 text-xs font-semibold">{fmt(regPrice)}</span></>
                            : <span className="text-orange-600 text-xs font-semibold">{fmt(regPrice)}</span>}
                          <button onClick={() => handleAddItem(item, 'regular')}
                            className={`flex items-center justify-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${qtyReg > 0 ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            <Plus size={11} /> Add R{qtyReg > 0 ? ` (${qtyReg})` : ''}
                          </button>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          {lrgDisc
                            ? <><span className="text-xs text-gray-400 line-through">{fmt(item.largePrice!)}</span><span className="text-green-600 text-xs font-semibold">{fmt(lrgPrice)}</span></>
                            : <span className="text-orange-600 text-xs font-semibold">{fmt(lrgPrice)}</span>}
                          <button onClick={() => handleAddItem(item, 'large')}
                            className={`flex items-center justify-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${qtyLrg > 0 ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            <Plus size={11} /> Add L{qtyLrg > 0 ? ` (${qtyLrg})` : ''}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {regDisc
                          ? <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                              <span className="text-xs text-gray-400 line-through whitespace-nowrap">{fmt(item.price)}</span>
                              <span className="text-green-600 text-sm font-semibold whitespace-nowrap">{fmt(regPrice)}</span>
                              <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">{item.discountPct}% OFF</span>
                            </div>
                          : <p className="text-orange-600 text-sm font-medium mt-0.5 whitespace-nowrap">{fmt(regPrice)}</p>}
                        <div className="mt-2">
                          <button onClick={() => handleAddItem(item, undefined)}
                            className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${qtyReg > 0 ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            <Plus size={14} /> {qtyReg > 0 ? `Add more (${qtyReg})` : 'Add'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Order summary sidebar ── */}
        <div className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-32">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <ShoppingBag size={16} className="text-purple-500" />
              <h2 className="font-semibold text-gray-900">Order Summary</h2>
              {itemCount > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </div>

            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Customer Name (optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-300"
              />
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No items yet</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {cart.map((c) => {
                  const key = cartKey(c.menuItemId, c.size, c.toppings);
                  const toppingsTotal = (c.toppings ?? []).reduce((s, t) => s + t.price, 0);
                  return (
                    <li key={key} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                            {c.size && (
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                c.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {c.size === 'large' ? 'L' : 'R'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{fmt(c.price + toppingsTotal)} × {c.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 shrink-0">
                          {fmt((c.price + toppingsTotal) * c.quantity)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => dispatch({ type: 'DEC', key })} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{c.quantity}</span>
                          <button onClick={() => dispatch({ type: 'INC', key })} className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600">
                            <Plus size={12} />
                          </button>
                          <button onClick={() => dispatch({ type: 'REMOVE', key })} className="text-gray-300 hover:text-red-400 ml-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {(c.toppings ?? []).length > 0 && (
                        <ul className="ml-2 mt-0.5 space-y-0.5">
                          {c.toppings!.map((t, ti) => (
                            <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex justify-between text-sm font-semibold text-gray-900 mb-3">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              <button
                onClick={handlePlace}
                disabled={cart.length === 0 || placing}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-2xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? (
                  <span className="animate-pulse">Placing…</span>
                ) : (
                  <><Check size={16} /> Place Takeaway Order</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

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
