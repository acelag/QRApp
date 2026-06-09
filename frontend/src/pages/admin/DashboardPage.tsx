import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Banknote, ClipboardList,
  PlusCircle, ChefHat, CheckCircle2, Package,
  AlertTriangle, Warehouse, ArrowDownCircle, ArrowUpCircle, TrendingDown,
} from 'lucide-react';
import { stockService, type StockItem } from '../../services/stockService';
import { AdminSidebar } from '../../components/AdminSidebar';
import { TrialBanner } from '../../components/TrialBanner';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import {
  reportService,
  type TodaySummary,
  type DailyRow,
  type CategoryRow,
  type HeatmapCell,
} from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';

const PIE_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899'];

type ActivityItem = {
  id: string;
  orderNum: string;
  type: 'kitchen' | 'payment' | 'order' | 'customer';
  title: string;
  time: string;
};

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function buildActivities(orders: Order[]): ActivityItem[] {
  return [...orders]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12)
    .map((o): ActivityItem => {
      const num = o.orderNumber ?? o.id.slice(-4).toUpperCase();
      const loc = o.tableNumber ? `Table ${o.tableNumber}` : o.roomNumber ? `Room ${o.roomNumber}` : 'Takeaway';
      const time = relativeTime(o.updatedAt);
      if (o.status === 'preparing') {
        return { id: o.id, orderNum: num, type: 'kitchen',  title: 'Kitchen update: Order in progress', time };
      }
      if (o.status === 'ready') {
        return { id: o.id, orderNum: num, type: 'payment',  title: `${loc} order ready for pickup`, time };
      }
      if (o.status === 'cancelled') {
        return { id: o.id, orderNum: num, type: 'customer', title: 'Order cancelled', time };
      }
      return { id: o.id, orderNum: num, type: 'order', title: 'New order received', time };
    });
}

const ACTIVITY_ICON: Record<ActivityItem['type'], { icon: React.ElementType; bg: string; color: string }> = {
  kitchen:  { icon: ChefHat,       bg: 'bg-pink-100',   color: 'text-pink-500' },
  payment:  { icon: CheckCircle2,  bg: 'bg-green-100',  color: 'text-green-500' },
  order:    { icon: Package,       bg: 'bg-orange-100', color: 'text-orange-500' },
  customer: { icon: Package,       bg: 'bg-gray-100',   color: 'text-gray-500' },
};

export function DashboardPage() {
  const { user } = useAuth();
  const { fmt } = useCurrency();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [today,      setToday]      = useState<TodaySummary | null>(null);
  const [daily,      setDaily]      = useState<DailyRow[]>([]);
  const [cats,       setCats]       = useState<CategoryRow[]>([]);
  const [heatmap,    setHeatmap]    = useState<HeatmapCell[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  useOrderSoundAlert(orders);

  // Poll active orders every 5 seconds
  useEffect(() => {
    const fetch = () => orderService.getOrders().then(setOrders).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  // Live clock — ticks every second
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch stock items once
  useEffect(() => {
    stockService.list().then(setStockItems).catch(() => {});
  }, []);

  // Fetch today summary + last-7-days report once
  useEffect(() => {
    reportService.getToday().then(setToday).catch(() => {});

    const to   = new Date().toLocaleDateString('en-CA');
    const from = new Date(Date.now() - 6 * 86_400_000).toLocaleDateString('en-CA');
    reportService.get(from, to).then((r) => {
      setDaily(r.daily);
      setCats(r.categories);
      setHeatmap(r.heatmap);
    }).catch(() => {});
  }, []);

  const todayStr     = new Date().toLocaleDateString('en-CA');
  const todayOrders  = orders.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr);
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const todayRevenue = today?.revenue ?? todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  // Time-based greeting (uses the viewer's local time zone)
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon'
    : hour < 21 ? 'Good evening'
    : 'Good night';

  // Stock derived values
  const lowStockItems  = stockItems.filter((i) => i.minThreshold > 0 && i.quantity <= i.minThreshold);
  const outOfStockItems = stockItems.filter((i) => i.quantity === 0);
  const totalStockValue = stockItems.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Fill in all 7 days even if API returned sparse data
  const weeklyData: { day: string; revenue: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = d.toLocaleDateString('en-CA');
    const row = daily.find((r) => r.date === key);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: row?.revenue ?? 0,
    };
  });

  const pieData = cats.length > 0
    ? cats.slice(0, 6).map((c) => ({ name: c.name, value: c.quantity }))
    : [];

  const hourlyData = Array.from({ length: 14 }, (_, i) => {
    const h = i + 8; // 8 AM → 9 PM
    const hourOrders = heatmap.filter((c) => c.hour === h).reduce((s, c) => s + c.orderCount, 0);
    return { hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`, orders: hourOrders };
  });

  const activities = buildActivities(orders);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      <AdminSidebar />

      {/* ── Scrollable wrapper (main + activities stacked on mobile) ─────── */}
      <div className="flex-1 overflow-y-auto pt-14 md:pt-0 flex flex-col lg:flex-row lg:overflow-hidden">

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 lg:overflow-y-auto">
        <div className="px-4 md:px-6 py-6 space-y-6">

          {/* Subscription nudge (trial / billing issues) */}
          <TrialBanner />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">{greeting}, {user?.name ?? 'Restaurant Admin'}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-gray-400">
                {now.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* ── Stat Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Today's Orders",
                value: todayOrders.length,
                icon: ClipboardList,
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-500',
                valueCls: 'text-gray-900',
              },
              {
                label: 'Active Orders',
                value: activeOrders.length,
                icon: Activity,
                iconBg: 'bg-orange-50',
                iconColor: 'text-orange-500',
                valueCls: 'text-gray-900',
              },
              {
                label: "Today's Revenue",
                value: fmt(todayRevenue),
                icon: Banknote,
                iconBg: 'bg-green-50',
                iconColor: 'text-green-600',
                valueCls: 'text-green-600',
              },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className={`inline-flex p-2 rounded-xl mb-3 ${s.iconBg}`}>
                  <s.icon size={18} className={s.iconColor} />
                </div>
                <p className={`text-2xl font-bold ${s.valueCls}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Quick Actions ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin/new-order"
                className="flex items-center gap-4 bg-amber-900 hover:bg-amber-800 transition-colors rounded-2xl px-5 py-5 shadow-md min-w-0"
              >
                <div className="bg-white/15 p-2.5 rounded-xl flex-none">
                  <PlusCircle size={22} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm">New Order</p>
                  <p className="text-xs text-amber-200 mt-0.5 hidden sm:block">Place takeaway or dine-in order</p>
                </div>
              </Link>
              <Link
                to="/admin/orders"
                className="relative flex items-center gap-4 bg-amber-900 hover:bg-amber-800 transition-colors rounded-2xl px-5 py-5 shadow-md min-w-0"
              >
                <div className="bg-white/15 p-2.5 rounded-xl flex-none">
                  <ClipboardList size={22} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm">Live Orders</p>
                  <p className="text-xs text-amber-200 mt-0.5 hidden sm:block">Manage incoming orders</p>
                </div>
                {activeOrders.length > 0 && (
                  <span className="absolute top-3 right-3 text-xs font-bold bg-white text-amber-900 rounded-full min-w-[22px] px-1.5 py-0.5 text-center leading-none">
                    {activeOrders.length}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* ── Stock Widgets ─────────────────────────────────────────────── */}
          {stockItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Inventory Snapshot</h2>
                <Link to="/admin/stock" className="text-xs text-orange-500 font-semibold hover:underline">
                  View all →
                </Link>
              </div>

              {/* Stock stat cards */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="inline-flex p-2 rounded-xl mb-2 bg-orange-50">
                    <Warehouse size={16} className="text-orange-500" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{stockItems.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stock Items</p>
                </div>
                <div className={`bg-white rounded-2xl p-4 shadow-sm border ${lowStockItems.length > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'}`}>
                  <div className={`inline-flex p-2 rounded-xl mb-2 ${lowStockItems.length > 0 ? 'bg-amber-100' : 'bg-gray-50'}`}>
                    <AlertTriangle size={16} className={lowStockItems.length > 0 ? 'text-amber-500' : 'text-gray-400'} />
                  </div>
                  <p className={`text-xl font-bold ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{lowStockItems.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Low Stock</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="inline-flex p-2 rounded-xl mb-2 bg-blue-50">
                    <Banknote size={16} className="text-blue-500" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{fmt(totalStockValue)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stock Value</p>
                </div>
              </div>

              {/* Low stock alert list */}
              {lowStockItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50">
                    <TrendingDown size={14} className="text-amber-500" />
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} need restocking
                    </p>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {lowStockItems.slice(0, 5).map((item) => {
                      const pct = item.minThreshold > 0 ? Math.min(100, (item.quantity / item.minThreshold) * 100) : 0;
                      const isEmpty = item.quantity === 0;
                      return (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isEmpty ? 'bg-red-100' : 'bg-amber-100'}`}>
                            {isEmpty
                              ? <ArrowUpCircle size={13} className="text-red-500" />
                              : <AlertTriangle size={13} className="text-amber-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                              <span className={`text-xs font-bold shrink-0 ${isEmpty ? 'text-red-600' : 'text-amber-600'}`}>
                                {isEmpty ? 'Out of stock' : `${item.quantity} ${item.unit} left`}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isEmpty ? 'bg-red-400' : 'bg-amber-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {lowStockItems.length > 5 && (
                    <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50">
                      <Link to="/admin/stock" className="text-xs text-orange-500 font-semibold hover:underline">
                        +{lowStockItems.length - 5} more items → View in Stock
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Out of stock quick-add nudge */}
              {outOfStockItems.length > 0 && (
                <Link
                  to="/admin/stock"
                  className="flex items-center gap-3 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-colors"
                >
                  <ArrowDownCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 font-medium flex-1">
                    <span className="font-bold">{outOfStockItems.length} item{outOfStockItems.length > 1 ? 's' : ''} out of stock</span>
                    {' '}— tap to log a delivery
                  </p>
                  <span className="text-xs text-red-500 font-semibold shrink-0">Stock In →</span>
                </Link>
              )}
            </div>
          )}

          {/* ── Analytics & Insights ──────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Analytics &amp; Insights</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Weekly Revenue */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-3">Weekly Revenue Trend</p>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}
                      formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Sales by Category */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-3">Sales by Category</p>
                {pieData.length === 0 ? (
                  <div className="h-[140px] flex items-center justify-center text-xs text-gray-300">No data yet</div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ResponsiveContainer width="55%" height={140}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value" paddingAngle={2}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {pieData.map((d, i) => {
                        const total = pieData.reduce((s, x) => s + x.value, 0);
                        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                        return (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full flex-none" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="truncate text-gray-600 flex-1">{d.name}</span>
                            <span className="font-semibold text-gray-700 flex-none">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hourly Order Distribution */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">Hourly Order Distribution</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}
                    formatter={(v) => [Number(v ?? 0), 'Orders']}
                  />
                  <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>

      {/* ── Right Activities Panel ────────────────────────────────────────── */}
      <aside className="w-full lg:w-72 flex-none bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col lg:overflow-hidden">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Current Activities</p>
          <p className="text-xs text-gray-400 mt-0.5">Real-time updates</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {activities.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-8">No recent activity</p>
          ) : (
            activities.map((a) => {
              const cfg = ACTIVITY_ICON[a.type];
              return (
                <Link
                  key={a.id}
                  to="/admin/orders"
                  className="flex items-start gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-none ${cfg.bg}`}>
                    <cfg.icon size={13} className={cfg.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 leading-tight">
                      {a.title}
                    </p>
                    <p className="text-xs mt-0.5 flex items-center gap-1">
                      <span className="font-semibold text-orange-500 group-hover:underline">
                        #{a.orderNum}
                      </span>
                      <span className="text-gray-400">· {a.time}</span>
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Bottom stats */}
        <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-lg font-bold text-teal-500">{activeOrders.length}</p>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Active</p>
          </div>
          <div>
            <p className="text-lg font-bold text-teal-500">{todayOrders.length}</p>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Today</p>
          </div>
        </div>
      </aside>

      </div>{/* end scrollable wrapper */}
    </div>
  );
}
