import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, UtensilsCrossed, ClipboardList, Clock } from 'lucide-react';
import { NotificationBell } from '../../components/NotificationBell';
import { SoundAlertToggle } from '../../components/SoundAlertToggle';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';
import type { Order, OrderStatus } from '../../types';
import type { MenuItem, Category } from '../../types';
import { orderService } from '../../services/orderService';
import { menuService } from '../../services/menuService';
import { restaurantService } from '../../services/restaurantService';
import { OrderCard } from '../../components/OrderCard';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

type KitchenTab = 'orders' | 'items';

export function KitchenPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]       = useState<KitchenTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);

  useOrderSoundAlert(orders);
  const [waitTimeMin, setWaitTimeMin]   = useState<number | null>(null);
  const [waitOpen, setWaitOpen]         = useState(false);
  const [waitSaving, setWaitSaving]     = useState(false);

  // Items tab state
  const [categories, setCategories]   = useState<Category[]>([]);
  const [menuItems, setMenuItems]     = useState<MenuItem[]>([]);
  const [toggling, setToggling]       = useState<Set<string>>(new Set());
  const [itemsLoaded, setItemsLoaded] = useState(false);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  // ── Orders polling ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(() =>
    orderService
      .getOrders()
      .then((data) =>
        setOrders(
          data
            .filter((o) => o.status === 'pending' || o.status === 'preparing')
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        ),
      )
      .catch(() => {}),
  []);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 4000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Load initial wait time
  useEffect(() => {
    if (!user?.restaurantId) return;
    restaurantService.getRestaurantInfo(user.restaurantId)
      .then((info) => setWaitTimeMin(info.waitTimeMin))
      .catch(() => {});
  }, [user?.restaurantId]);

  async function handleSetWaitTime(val: number | null) {
    if (!user?.restaurantId || waitSaving) return;
    setWaitSaving(true);
    try {
      const updated = await restaurantService.updateWaitTime(user.restaurantId, val);
      setWaitTimeMin(updated.waitTimeMin ?? null);
      setWaitOpen(false);
      toast.success(val ? `Wait time set to ${val} min` : 'Wait time cleared');
    } catch {
      toast.error('Failed to update wait time');
    } finally {
      setWaitSaving(false);
    }
  }

  // ── Load items once when Items tab is first opened ────────────────────────
  useEffect(() => {
    if (tab !== 'items' || itemsLoaded) return;
    Promise.all([menuService.getCategories(), menuService.getItems()])
      .then(([cats, items]) => {
        setCategories(cats);
        setMenuItems(items.sort((a, b) => a.name.localeCompare(b.name)));
        setItemsLoaded(true);
      })
      .catch(() => toast.error('Failed to load menu items'));
  }, [tab, itemsLoaded]);

  async function handleStatusChange(id: string, status: OrderStatus) {
    try {
      const updated = await orderService.updateStatus(id, status);
      setOrders((prev) =>
        prev
          .map((o) => (o.id === id ? updated : o))
          .filter((o) => o.status === 'pending' || o.status === 'preparing'),
      );
      toast.success(`Order marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleToggle(item: MenuItem) {
    if (toggling.has(item.id)) return;
    const next = !item.available;

    // Optimistic update
    setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: next } : i)));
    setToggling((s) => new Set(s).add(item.id));

    try {
      await menuService.setAvailability(item.id, next);
      toast.success(`"${item.name}" marked as ${next ? 'available' : 'sold out'}`);
    } catch {
      // Revert on failure
      setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: !next } : i)));
      toast.error('Failed to update availability');
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(item.id); return n; });
    }
  }

  // Items grouped by category
  const grouped = categories.map((cat) => ({
    cat,
    items: menuItems.filter((i) => i.category === cat.id),
  })).filter((g) => g.items.length > 0);

  const uncategorised = menuItems.filter((i) => !categories.find((c) => c.id === i.category));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-40">
        <Link to="/admin" className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold flex-1">Kitchen Display</h1>
        <span className="hidden sm:inline text-sm text-gray-400">{user?.name}</span>

        {/* Wait time widget */}
        <div className="relative">
          <button
            onClick={() => setWaitOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              waitTimeMin
                ? 'bg-amber-500 text-white hover:bg-amber-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Clock size={13} />
            {waitTimeMin ? `~${waitTimeMin} min` : 'Wait?'}
          </button>

          {waitOpen && (
            <div className="absolute right-0 top-9 bg-gray-800 border border-gray-700 rounded-2xl p-3 shadow-2xl z-50 min-w-[200px]">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Estimated Wait</p>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[null, 10, 15, 20, 25, 30, 45, 60].map((val) => (
                  <button
                    key={val ?? 'off'}
                    onClick={() => handleSetWaitTime(val)}
                    disabled={waitSaving}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                      waitTimeMin === val
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-amber-500 hover:text-white'
                    }`}
                  >
                    {val == null ? 'Off' : `${val}m`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SoundAlertToggle />
        <NotificationBell theme="dark" />
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      {/* Tab bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-3 sm:px-4 lg:px-6 flex gap-1 sticky top-[64px] z-30">
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'orders'
              ? 'border-orange-400 text-orange-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ClipboardList size={15} />
          Orders
          {orders.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {orders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('items')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'items'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <UtensilsCrossed size={15} />
          Item Availability
          {itemsLoaded && menuItems.filter((i) => !i.available).length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {menuItems.filter((i) => !i.available).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Orders tab ─────────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <main className="px-3 sm:px-4 lg:px-6 py-4">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 text-gray-500">
              <p className="text-2xl">👨‍🍳</p>
              <p className="mt-2">No active orders</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
              {orders.map((order, idx) => (
                <div key={order.id} className="break-inside-avoid mb-3 lg:mb-4">
                  <OrderCard
                    order={order}
                    onStatusChange={handleStatusChange}
                    showActions
                    isNext={idx === 0}
                    priority={idx + 1}
                    hidePrices
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── Items tab ──────────────────────────────────────────────────────── */}
      {tab === 'items' && (
        <main className="px-3 sm:px-4 lg:px-6 py-4 space-y-6">
          {!itemsLoaded ? (
            <div className="flex justify-center pt-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
            </div>
          ) : menuItems.length === 0 ? (
            <p className="text-center text-gray-500 pt-16">No menu items found</p>
          ) : (
            <>
              {/* Sold-out summary bar */}
              {menuItems.filter((i) => !i.available).length > 0 && (
                <div className="bg-red-900/40 border border-red-700/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-red-400 font-bold text-sm">
                    {menuItems.filter((i) => !i.available).length} item{menuItems.filter((i) => !i.available).length !== 1 ? 's' : ''} sold out
                  </span>
                  <span className="text-gray-400 text-xs flex-1">Customers cannot see or order these items</span>
                  <button
                    onClick={async () => {
                      const soldOut = menuItems.filter((i) => !i.available);
                      await Promise.all(soldOut.map((i) => handleToggle(i)));
                    }}
                    className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-full font-medium transition-colors"
                  >
                    Mark all available
                  </button>
                </div>
              )}

              {/* By category */}
              {grouped.map(({ cat, items }) => (
                <section key={cat.id}>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{cat.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {items.map((item) => (
                      <ItemToggleCard
                        key={item.id}
                        item={item}
                        loading={toggling.has(item.id)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {/* Uncategorised */}
              {uncategorised.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Other</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {uncategorised.map((item) => (
                      <ItemToggleCard
                        key={item.id}
                        item={item}
                        loading={toggling.has(item.id)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}

// ── Item toggle card ──────────────────────────────────────────────────────────

interface ItemToggleCardProps {
  item: MenuItem;
  loading: boolean;
  onToggle: (item: MenuItem) => void;
}

function ItemToggleCard({ item, loading, onToggle }: ItemToggleCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors cursor-pointer select-none ${
        item.available
          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
          : 'bg-gray-800/50 border-red-900/60'
      }`}
      onClick={() => !loading && onToggle(item)}
    >
      {/* Item image or placeholder */}
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <UtensilsCrossed size={16} className="text-gray-500" />}
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${item.available ? 'text-gray-100' : 'text-gray-500 line-through'}`}>
          {item.name}
        </p>
        <p className={`text-xs font-semibold ${item.available ? 'text-green-400' : 'text-red-400'}`}>
          {item.available ? 'Available' : 'Sold out'}
        </p>
      </div>

      {/* Toggle pill */}
      <div
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          loading ? 'opacity-50' : ''
        } ${item.available ? 'bg-green-500' : 'bg-gray-600'}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            item.available ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </div>
  );
}
