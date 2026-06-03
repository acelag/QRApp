import { useEffect, useState } from 'react';
import { X, Search, Plus, Minus, Trash2, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import type { Order, CartItem, SelectedTopping } from '../types';
import type { MenuItem, Category } from '../types';
import { menuService } from '../services/menuService';
import { orderService } from '../services/orderService';
import { useCurrency } from '../context/CurrencyContext';
import { effectivePrice } from '../types/MenuItem';
import toast from 'react-hot-toast';

interface CartEntry {
  item: MenuItem;
  quantity: number;
  size: 'regular' | 'large';
  notes: string;
  toppings: SelectedTopping[];
  showOptions: boolean;
}

interface Props {
  order: Order;
  onClose: () => void;
  onDone: (updated: Order) => void;
}

export function AddItemsModal({ order, onClose, onDone }: Props) {
  const { fmt } = useCurrency();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      menuService.getItems(),
      menuService.getCategories(),
    ]).then(([items, cats]) => {
      setMenuItems(items.filter((i) => i.available));
      setCategories(cats);
    }).catch(() => toast.error('Could not load menu'))
      .finally(() => setLoading(false));
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const visible = menuItems.filter((i) => {
    const matchCat = activeCategory === 'all' || i.category === activeCategory;
    const matchQ   = !q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // ── Cart helpers ───────────────────────────────────────────────────────────
  function cartQty(itemId: string): number {
    return cart.filter((e) => e.item.id === itemId).reduce((s, e) => s + e.quantity, 0);
  }

  function addItem(item: MenuItem) {
    setCart((prev) => {
      // Check if there's already a default entry for this item (no size distinction yet)
      const existing = prev.findIndex(
        (e) => e.item.id === item.id && !e.showOptions && e.notes === '' && e.toppings.length === 0
      );
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [...prev, {
        item,
        quantity: 1,
        size: item.largePrice ? 'regular' : 'regular',
        notes: '',
        toppings: [],
        showOptions: false,
      }];
    });
  }

  function updateEntry(idx: number, patch: Partial<CartEntry>) {
    setCart((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }

  function removeEntry(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleTopping(idx: number, topping: SelectedTopping) {
    setCart((prev) => prev.map((e, i) => {
      if (i !== idx) return e;
      const has = e.toppings.some((t) => t.id === topping.id);
      return { ...e, toppings: has ? e.toppings.filter((t) => t.id !== topping.id) : [...e.toppings, topping] };
    }));
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const addedTotal = cart.reduce((s, e) => {
    const base = effectivePrice(e.item, e.size);
    const toppingsAmt = e.toppings.reduce((t, tp) => t + tp.price, 0);
    return s + (base + toppingsAmt) * e.quantity;
  }, 0);

  const totalItems = cart.reduce((s, e) => s + e.quantity, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const items: CartItem[] = cart.map((e) => ({
        menuItemId: e.item.id,
        name: e.item.name,
        price: effectivePrice(e.item, e.size),
        quantity: e.quantity,
        size: e.item.largePrice ? e.size : undefined,
        notes: e.notes.trim() || undefined,
        toppings: e.toppings.length ? e.toppings : undefined,
      }));
      const updated = await orderService.addItems(order.id, items);
      toast.success(`${totalItems} item${totalItems !== 1 ? 's' : ''} added to order`);
      onDone(updated);
    } catch {
      toast.error('Failed to add items');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Items</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Order {order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
              {order.tableNumber != null && ` · Table ${order.tableNumber}`}
              {order.roomNumber  != null && ` · Room ${order.roomNumber}`}
              {order.customerName && ` · ${order.customerName}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">

          {/* ── Left: Item browser ─────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 border-r border-gray-100">
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items…"
                  className="w-full bg-gray-100 rounded-full pl-8 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:bg-white transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-gray-100 shrink-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    activeCategory === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center pt-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              ) : visible.length === 0 ? (
                <p className="text-center text-gray-400 text-sm pt-10">No items found</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {visible.map((item) => {
                    const qty  = cartQty(item.id);
                    const price = effectivePrice(item);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-orange-500 font-semibold mt-0.5">{fmt(price)}
                            {item.largePrice && <span className="text-gray-400 font-normal"> / {fmt(item.largePrice)} L</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {qty > 0 && (
                            <span className="text-xs font-bold text-white bg-orange-500 w-5 h-5 rounded-full flex items-center justify-center">
                              {qty}
                            </span>
                          )}
                          <button
                            onClick={() => addItem(item)}
                            className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:scale-95 transition-all"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart additions ───────────────────────────────────────── */}
          <div className="w-full sm:w-96 flex flex-col min-h-0 border-t sm:border-t-0 border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <ShoppingCart size={15} className="text-orange-500" />
              <span className="text-sm font-bold text-gray-900">Adding</span>
              {cart.length > 0 && (
                <span className="ml-auto text-xs text-gray-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-8">
                  <ShoppingCart size={28} />
                  <p className="text-sm">Tap + to add items</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {cart.map((entry, idx) => {
                    const linePrice = (effectivePrice(entry.item, entry.size) + entry.toppings.reduce((s, t) => s + t.price, 0)) * entry.quantity;
                    return (
                      <div key={idx} className="px-4 py-3">
                        {/* Item row */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-tight">{entry.item.name}</p>
                            <p className="text-xs text-orange-500 font-semibold mt-0.5">{fmt(linePrice)}</p>
                          </div>
                          {/* Qty controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => entry.quantity > 1 ? updateEntry(idx, { quantity: entry.quantity - 1 }) : removeEntry(idx)}
                              className="w-6 h-6 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 transition-colors"
                            >
                              {entry.quantity === 1 ? <Trash2 size={11} className="text-red-400" /> : <Minus size={11} />}
                            </button>
                            <span className="text-sm font-bold w-5 text-center">{entry.quantity}</span>
                            <button
                              onClick={() => updateEntry(idx, { quantity: entry.quantity + 1 })}
                              className="w-6 h-6 rounded-full border border-orange-300 text-orange-500 flex items-center justify-center hover:bg-orange-50 transition-colors"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Options toggle */}
                        <button
                          onClick={() => updateEntry(idx, { showOptions: !entry.showOptions })}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1.5 transition-colors"
                        >
                          {entry.showOptions ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {entry.showOptions ? 'Hide options' : 'Size / notes / extras'}
                        </button>

                        {entry.showOptions && (
                          <div className="mt-2 space-y-2">
                            {/* Size */}
                            {entry.item.largePrice && (
                              <div className="flex gap-1.5">
                                {(['regular', 'large'] as const).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => updateEntry(idx, { size: s })}
                                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                      entry.size === s
                                        ? 'bg-orange-500 text-white border-orange-500'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                                    }`}
                                  >
                                    {s === 'regular' ? `Regular · ${fmt(entry.item.price)}` : `Large · ${fmt(entry.item.largePrice!)}`}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            <input
                              type="text"
                              value={entry.notes}
                              onChange={(e) => updateEntry(idx, { notes: e.target.value })}
                              placeholder="Special instructions…"
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                            />

                            {/* Toppings */}
                            {(entry.item.toppings ?? []).filter((t) => t.available).length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Extras:</p>
                                <div className="space-y-1">
                                  {(entry.item.toppings ?? []).filter((t) => t.available).map((t) => {
                                    const checked = entry.toppings.some((st) => st.id === t.id);
                                    return (
                                      <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleTopping(idx, { id: t.id, name: t.name, price: t.price })}
                                          className="rounded text-orange-500 focus:ring-orange-300"
                                        />
                                        <span className="text-xs text-gray-700 flex-1">{t.name}</span>
                                        {t.price > 0 && <span className="text-xs text-gray-400">+{fmt(t.price)}</span>}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 space-y-2 shrink-0">
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>Adding</span>
                  <span className="text-orange-600">{fmt(addedTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>New order total</span>
                  <span>{fmt(order.totalAmount + addedTotal)}</span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Adding…</>
                    : `Add ${totalItems} item${totalItems !== 1 ? 's' : ''} to Order`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
