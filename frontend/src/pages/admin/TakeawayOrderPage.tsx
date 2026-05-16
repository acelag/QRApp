import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Check } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import { effectivePrice } from '../../types/MenuItem';
import type { CartItem } from '../../types/Order';
import { menuService } from '../../services/menuService';
import { orderService } from '../../services/orderService';
import toast from 'react-hot-toast';

export function TakeawayOrderPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]       = useState(true);

  const [cart, setCart]             = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing]       = useState(false);

  useEffect(() => {
    Promise.all([menuService.getCategories(), menuService.getItems()])
      .then(([cats, menuItems]) => {
        setCategories(cats);
        setItems(menuItems.filter((i) => i.available));
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: effectivePrice(item), quantity: 1 }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  }

  const cartQty = (menuItemId: string) => cart.find((c) => c.menuItemId === menuItemId)?.quantity ?? 0;
  const total   = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ── Place order ──────────────────────────────────────────────────────────────
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
        {/* Category tabs */}
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

      <div className="max-w-5xl mx-auto px-4 py-4 flex gap-4 items-start">
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
                const qty = cartQty(item.id);
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border shadow-sm p-3 flex flex-col transition-colors ${
                      qty > 0 ? 'border-orange-200' : 'border-gray-100'
                    }`}
                  >
                    {/* Image */}
                    <div className="w-full h-28 rounded-xl bg-orange-50 overflow-hidden mb-2 flex items-center justify-center text-3xl">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        : '🍽️'}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                    {item.discountPct > 0 ? (
                      <div className="mt-0.5">
                        <span className="text-xs text-gray-400 line-through">${item.price.toFixed(2)}</span>
                        <span className="ml-1.5 text-green-600 text-sm font-semibold">${effectivePrice(item).toFixed(2)}</span>
                        <span className="ml-1 text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{item.discountPct}% OFF</span>
                      </div>
                    ) : (
                      <p className="text-orange-600 text-sm font-medium mt-0.5">${item.price.toFixed(2)}</p>
                    )}

                    {/* Qty control */}
                    <div className="mt-2">
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full flex items-center justify-center gap-1 bg-orange-500 text-white py-1.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
                        >
                          <Plus size={14} /> Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          ><Minus size={14} /></button>
                          <span className="font-bold text-gray-900">{qty}</span>
                          <button
                            onClick={() => changeQty(item.id, +1)}
                            className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                          ><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Order summary sidebar ── */}
        <div className="w-72 shrink-0 sticky top-32">
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

            {/* Customer name */}
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

            {/* Cart items */}
            {cart.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No items yet</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {cart.map((c) => (
                  <li key={c.menuItemId} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">${c.price.toFixed(2)} × {c.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 shrink-0">
                      ${(c.price * c.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(c.menuItemId)}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    ><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}

            {/* Total + place */}
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex justify-between text-sm font-semibold text-gray-900 mb-3">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
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
    </div>
  );
}
