import { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, ChevronUp, ChevronDown, UtensilsCrossed } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import { effectivePrice } from '../../types/MenuItem';
import type { CartItem } from '../../types/Order';
import { menuService } from '../../services/menuService';
import { orderService } from '../../services/orderService';
import { CategoryTabs } from '../../components/CategoryTabs';
import toast from 'react-hot-toast';

// ── Local cart (no CartContext — doesn't interfere with dine-in sessions) ─────
type CartAction =
  | { type: 'ADD';    item: MenuItem }
  | { type: 'INC';    id: string }
  | { type: 'DEC';    id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const exists = state.find((c) => c.menuItemId === action.item.id);
      if (exists) return state.map((c) => c.menuItemId === action.item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...state, { menuItemId: action.item.id, name: action.item.name, price: effectivePrice(action.item), quantity: 1 }];
    }
    case 'INC':    return state.map((c) => c.menuItemId === action.id ? { ...c, quantity: c.quantity + 1 } : c);
    case 'DEC':    return state.map((c) => c.menuItemId === action.id ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.quantity > 0);
    case 'REMOVE': return state.filter((c) => c.menuItemId !== action.id);
    case 'CLEAR':  return [];
    default:       return state;
  }
}

export function TakeawayMenuPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();

  const [categories, setCategories]   = useState<Category[]>([]);
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]         = useState(true);

  const [cart, dispatch]              = useReducer(cartReducer, []);
  const [customerName, setCustomerName] = useState('');
  const [cartOpen, setCartOpen]       = useState(false);
  const [placing, setPlacing]         = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      menuService.getCategories(restaurantId),
      menuService.getItems(restaurantId),
    ]).then(([cats, menuItems]) => {
      setCategories(cats);
      setItems(menuItems.filter((i) => i.available));
    }).catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const total     = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartQty   = (id: string) => cart.find((c) => c.menuItemId === id)?.quantity ?? 0;

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
            <ShoppingBag size={20} className="text-purple-500" />
            <h1 className="text-xl font-bold text-gray-900">Takeaway Order</h1>
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
              const qty = cartQty(item.id);
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
                    {item.discountPct > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {item.discountPct}% OFF
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">{item.description}</p>
                    )}
                    <div className="mt-2">
                      {item.discountPct > 0 ? (
                        <div>
                          <span className="text-xs text-gray-400 line-through">${item.price.toFixed(2)}</span>
                          <span className="ml-1.5 text-green-600 font-bold">${effectivePrice(item).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-purple-600 font-bold">${item.price.toFixed(2)}</span>
                      )}
                      <div className="mt-2">
                        {qty === 0 ? (
                          <button
                            onClick={() => { dispatch({ type: 'ADD', item }); }}
                            className="w-full flex items-center justify-center gap-1 bg-purple-600 text-white py-1.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                          >
                            <Plus size={14} /> Add
                          </button>
                        ) : (
                          <div className="flex items-center justify-between">
                            <button onClick={() => dispatch({ type: 'DEC', id: item.id })} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                              <Minus size={14} />
                            </button>
                            <span className="font-bold text-gray-900">{qty}</span>
                            <button onClick={() => dispatch({ type: 'INC', id: item.id })} className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700">
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
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
                  {/* Customer name */}
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
                  {cart.map((c) => (
                    <li key={c.menuItemId} className="flex items-center gap-3 py-2.5">
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => dispatch({ type: 'DEC', id: c.menuItemId })} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-bold text-gray-900 text-sm">{c.quantity}</span>
                        <button onClick={() => dispatch({ type: 'INC', id: c.menuItemId })} className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="flex-1 text-sm text-gray-700 truncate">{c.name}</span>
                      <span className="text-sm font-semibold text-gray-800 shrink-0">${(c.price * c.quantity).toFixed(2)}</span>
                      <button onClick={() => dispatch({ type: 'REMOVE', id: c.menuItemId })} className="text-gray-300 hover:text-red-400 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
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
                {placing ? 'Placing Order…' : cartOpen ? `Place Order • $${total.toFixed(2)}` : `View Order • $${total.toFixed(2)}`}
              </span>
              {cartOpen
                ? <ChevronDown size={20} onClick={(e) => { e.stopPropagation(); setCartOpen(false); }} />
                : <ChevronUp size={20} />
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
