import { useEffect, useReducer, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, UtensilsCrossed, Check, Loader2, BedDouble } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { Table, Room } from '../../types';
import type { SelectedTopping } from '../../types/Order';
import type { CartItem } from '../../types/Order';
import { effectivePrice } from '../../types/MenuItem';
import { menuService } from '../../services/menuService';
import { orderService } from '../../services/orderService';
import { tableService } from '../../services/tableService';
import { roomService } from '../../services/roomService';
import { sessionService } from '../../services/sessionService';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { ToppingSelectionModal } from '../../components/ToppingSelectionModal';
import toast from 'react-hot-toast';

type OrderMode = 'takeaway' | 'dine-in' | 'room-service';
type Size = 'regular' | 'large';

const toppingKey = (toppings?: SelectedTopping[]) => (toppings ?? []).map((t) => t.id).sort().join(',');
const cartKey = (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) =>
  `${menuItemId}|${size ?? 'regular'}|${toppingKey(toppings)}`;

type CartAction =
  | { type: 'ADD';       item: MenuItem; size?: Size; toppings?: SelectedTopping[]; notes?: string }
  | { type: 'INC';       key: string }
  | { type: 'DEC';       key: string }
  | { type: 'REMOVE';    key: string }
  | { type: 'SET_NOTES'; key: string; notes: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const key = cartKey(action.item.id, action.size, action.toppings);
      const price = effectivePrice(action.item, action.size);
      const exists = state.find((c) => cartKey(c.menuItemId, c.size, c.toppings) === key);
      if (exists) return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...state, { menuItemId: action.item.id, name: action.item.name, price, quantity: 1, size: action.size, toppings: action.toppings, notes: action.notes }];
    }
    case 'INC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity + 1 } : c);
    case 'DEC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.quantity > 0);
    case 'REMOVE':
      return state.filter((c) => cartKey(c.menuItemId, c.size, c.toppings) !== action.key);
    case 'SET_NOTES':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, notes: action.notes || undefined } : c);
    case 'CLEAR': return [];
    default: return state;
  }
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fmt } = useCurrency();

  const [mode, setMode] = useState<OrderMode>('takeaway');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const [cart, dispatch] = useReducer(cartReducer, []);
  const [customerName, setCustomerName] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [placing, setPlacing] = useState(false);
  const [toppingModal, setToppingModal] = useState<{ item: MenuItem } | null>(null);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      menuService.getCategories(),
      menuService.getItems(),
      tableService.getTables(),
      roomService.getRooms(),
    ])
      .then(([cats, menuItems, tbls, rms]) => {
        setCategories(cats);
        setItems(menuItems.filter((i) => i.available));
        setTables(tbls.sort((a, b) => a.number - b.number));
        setRooms(rms.sort((a, b) => a.number - b.number));
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  // Clear cart and selection when switching mode
  function switchMode(m: OrderMode) {
    setMode(m);
    dispatch({ type: 'CLEAR' });
    setSelectedTable(null);
    setSelectedRoom(null);
    setCustomerName('');
  }

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const total = cart.reduce((s, c) => s + (c.price + (c.toppings ?? []).reduce((t, tp) => t + tp.price, 0)) * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  function handleAddItem(item: MenuItem) {
    const hasLarge = (item.largePrice ?? 0) > 0;
    const hasToppings = (item.toppings ?? []).some((t) => t.available);
    if (hasLarge || hasToppings) {
      setToppingModal({ item });
    } else {
      dispatch({ type: 'ADD', item });
    }
  }

  async function handlePlace() {
    if (cart.length === 0) { toast.error('Add at least one item'); return; }
    if (mode === 'dine-in' && !selectedTable) { toast.error('Select a table'); return; }
    if (mode === 'room-service' && !selectedRoom) { toast.error('Select a room'); return; }

    setPlacing(true);
    try {
      if (mode === 'takeaway') {
        const order = await orderService.placeTakeawayOrder(cart, customerName.trim() || undefined);
        toast.success('Takeaway order placed!');
        navigate(`/receipt/${order.id}`);
      } else if (mode === 'dine-in') {
        const table = selectedTable!;
        const restaurantId = user?.restaurantId ?? '';
        const session = await sessionService.getOrCreate(table.id, table.number, restaurantId);
        const order = await orderService.placeOrder(table.id, table.number, cart, session.id);
        toast.success(`Dine-in order placed for Table ${table.number}!`);
        navigate(`/receipt/${order.id}`);
      } else {
        const room = selectedRoom!;
        const restaurantId = user?.restaurantId ?? '';
        const order = await orderService.placeRoomOrder(room.id, room.number, cart, customerName.trim() || undefined, restaurantId);
        toast.success(`Room service order placed for Room ${room.number}!`);
        navigate(`/receipt/${order.id}`);
      }
    } catch {
      toast.error('Failed to place order');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">New Order</h1>
        </div>

        {/* Mode tabs */}
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2">
          <button
            onClick={() => switchMode('takeaway')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'takeaway' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingBag size={13} /> Takeaway
          </button>
          <button
            onClick={() => switchMode('dine-in')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'dine-in' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <UtensilsCrossed size={13} /> Dine-in
          </button>
          <button
            onClick={() => switchMode('room-service')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'room-service' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BedDouble size={13} /> Room Service
          </button>
        </div>

        {/* Category tabs */}
        {!loading && (
          <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2 overflow-x-auto">
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

      <div className="px-3 sm:px-4 lg:px-6 py-4 flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Menu grid ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center pt-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 pt-12">No items</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((item) => {
                const hasLarge = (item.largePrice ?? 0) > 0;
                const hasToppings = (item.toppings ?? []).some((t) => t.available);
                const regPrice = effectivePrice(item, 'regular');
                const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
                const regDisc = item.discountPct > 0;
                const totalInCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border shadow-sm p-3 flex flex-col transition-colors ${
                      totalInCart > 0 ? 'border-orange-200' : 'border-gray-100'
                    }`}
                  >
                    <div className="relative w-full h-28 rounded-xl bg-orange-50 overflow-hidden mb-2">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>}
                      {(hasToppings || hasLarge) && (
                        <span className="absolute top-1 right-1 bg-orange-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                          {hasToppings ? '+ Extras' : 'R / L'}
                        </span>
                      )}
                      {totalInCart > 0 && (
                        <span className="absolute top-1 left-1 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {totalInCart}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight mb-1">{item.name}</p>
                    {regDisc
                      ? <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 mb-1">
                          <span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span>
                          <span className="text-green-600 text-sm font-semibold">{fmt(regPrice)}</span>
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{item.discountPct}% OFF</span>
                        </div>
                      : <p className="text-orange-600 text-sm font-medium mb-1">{fmt(regPrice)}{hasLarge ? ` / L ${fmt(lrgPrice)}` : ''}</p>}
                    <div className="mt-auto">
                      <button
                        onClick={() => handleAddItem(item)}
                        className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                          totalInCart > 0 ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        <Plus size={14} /> {totalInCart > 0 ? 'Add more' : 'Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-40 space-y-3">

          {/* Table selector — dine-in only */}
          {mode === 'dine-in' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Select Table</p>
              {tables.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tables found</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTable(selectedTable?.id === t.id ? null : t)}
                      className={`h-12 rounded-xl font-bold text-sm transition-colors ${
                        selectedTable?.id === t.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-600'
                      }`}
                    >
                      {t.number}
                    </button>
                  ))}
                </div>
              )}
              {selectedTable && (
                <p className="text-xs text-orange-600 font-medium mt-2 text-center">
                  Table {selectedTable.number} · {selectedTable.seats} seats
                </p>
              )}
            </div>
          )}

          {/* Room selector — room-service only */}
          {mode === 'room-service' && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Select Room</p>
              {rooms.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No rooms found</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoom(selectedRoom?.id === r.id ? null : r)}
                      title={r.name ?? undefined}
                      className={`h-12 rounded-xl font-bold text-sm transition-colors ${
                        selectedRoom?.id === r.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      {r.number}
                    </button>
                  ))}
                </div>
              )}
              {selectedRoom && (
                <p className="text-xs text-blue-600 font-medium mt-2 text-center">
                  Room {selectedRoom.number}{selectedRoom.name ? ` — ${selectedRoom.name}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Customer / guest name — takeaway or room-service */}
          {(mode === 'takeaway' || mode === 'room-service') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                {mode === 'room-service' ? 'Guest Name' : 'Customer Name'}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John (optional)"
                className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none ${
                  mode === 'room-service' ? 'focus:ring-1 focus:ring-blue-300' : 'focus:ring-1 focus:ring-purple-300'
                }`}
              />
            </div>
          )}

          {/* Cart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="font-semibold text-gray-900 flex-1">Order Summary</span>
              {itemCount > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
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
                      {/* Inline notes */}
                      <div className="mt-1">
                        {editingNotesKey === key ? (
                          <input
                            autoFocus
                            type="text"
                            value={c.notes ?? ''}
                            onChange={(e) => dispatch({ type: 'SET_NOTES', key, notes: e.target.value })}
                            onBlur={() => setEditingNotesKey(null)}
                            placeholder="e.g. no onions, less spicy…"
                            className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingNotesKey(key)}
                            className="text-xs text-orange-400 hover:text-orange-600"
                          >
                            {c.notes ? `📝 ${c.notes}` : '+ Add note'}
                          </button>
                        )}
                      </div>
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
                disabled={
                  cart.length === 0 || placing ||
                  (mode === 'dine-in' && !selectedTable) ||
                  (mode === 'room-service' && !selectedRoom)
                }
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'takeaway'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : mode === 'room-service'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {placing
                  ? <><Loader2 size={16} className="animate-spin" /> Placing…</>
                  : mode === 'takeaway'
                  ? <><Check size={16} /> Place Takeaway Order</>
                  : mode === 'room-service'
                  ? <><Check size={16} /> Place Room Service Order{selectedRoom ? ` · Room ${selectedRoom.number}` : ''}</>
                  : <><Check size={16} /> Place Dine-in Order{selectedTable ? ` · Table ${selectedTable.number}` : ''}</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {toppingModal && (
        <ToppingSelectionModal
          item={toppingModal.item}
          onConfirm={(toppings, size, notes) => {
            dispatch({ type: 'ADD', item: toppingModal.item, size, toppings, notes });
            setToppingModal(null);
          }}
          onClose={() => setToppingModal(null)}
        />
      )}
    </div>
  );
}
