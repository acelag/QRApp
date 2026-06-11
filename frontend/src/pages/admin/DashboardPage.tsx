import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, TrendingUp, TrendingDown, XCircle, Banknote,
  Star, Clock, Receipt, ChefHat, CheckCircle2,
  AlertTriangle, Utensils, Search, ArrowUpRight,
} from 'lucide-react';
import { stockService, type StockItem } from '../../services/stockService';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { TrialBanner } from '../../components/TrialBanner';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
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

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  pending:   { label: 'Pending',    dot: 'bg-gray-400' },
  preparing: { label: 'Preparing',  dot: 'bg-orange-400' },
  ready:     { label: 'Ready',      dot: 'bg-green-400' },
  completed: { label: 'Completed',  dot: 'bg-blue-400' },
  cancelled: { label: 'Cancelled',  dot: 'bg-red-400' },
};

// ─────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const { fmt }  = useCurrency();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [today,      setToday]      = useState<TodaySummary | null>(null);
  const [daily,      setDaily]      = useState<DailyRow[]>([]);
  const [cats,       setCats]       = useState<CategoryRow[]>([]);
  const [heatmap,    setHeatmap]    = useState<HeatmapCell[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [orderSearch, setOrderSearch] = useState('');

  useOrderSoundAlert(orders);

  useEffect(() => {
    const fetch = () => orderService.getOrders().then(setOrders).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { stockService.list().then(setStockItems).catch(() => {}); }, []);

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

  // ── derived values ──────────────────────────────────────────────────────────
  const todayStr      = new Date().toLocaleDateString('en-CA');
  const todayOrders   = orders.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr);
  const activeOrders  = orders.filter((o) => o.status !== 'cancelled');
  const completed     = todayOrders.filter((o) => o.status === 'ready');
  const cancelled     = todayOrders.filter((o) => o.status === 'cancelled');
  const todayRevenue  = today?.revenue ?? todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;
  const lowStock      = stockItems.filter((i) => i.minThreshold > 0 && i.quantity <= i.minThreshold);

  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Trending item (most ordered today by quantity)
  const itemMap = new Map<string, { name: string; qty: number; price: number; image?: string }>();
  todayOrders.forEach((o) => {
    (o.items ?? []).forEach((it) => {
      const key = it.name;
      const cur = itemMap.get(key) ?? { name: it.name, qty: 0, price: Number(it.price), image: undefined };
      itemMap.set(key, { ...cur, qty: cur.qty + it.quantity });
    });
  });
  const trendingItem = [...itemMap.values()].sort((a, b) => b.qty - a.qty)[0] ?? null;

  // Weekly chart (7 days)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = d.toLocaleDateString('en-CA');
    const row = daily.find((r) => r.date === key);
    return {
      day:     d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: row?.revenue    ?? 0,
      orders:  row?.orderCount ?? 0,
    };
  });

  // Order types breakdown
  const dineIn   = todayOrders.filter((o) => o.orderType === 'dine-in').length;
  const takeaway = todayOrders.filter((o) => o.orderType === 'takeaway').length;
  const room     = todayOrders.filter((o) => o.orderType !== 'dine-in' && o.orderType !== 'takeaway').length;
  const orderTypeData = [
    { name: 'Dine-in',    value: dineIn,   color: '#f97316' },
    { name: 'Take-away',  value: takeaway, color: '#3b82f6' },
    { name: 'Room',       value: room,     color: '#8b5cf6' },
  ].filter((d) => d.value > 0);

  // Top categories (up to 3)
  const topCats = cats.slice(0, 3);
  const maxCatQty = Math.max(...topCats.map((c) => c.quantity), 1);

  // Peak hour
  const hourlyData = Array.from({ length: 14 }, (_, i) => {
    const h          = i + 8;
    const hourOrders = heatmap.filter((c) => c.hour === h).reduce((s, c) => s + c.orderCount, 0);
    return { hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`, orders: hourOrders };
  });
  const peakHour = [...hourlyData].sort((a, b) => b.orders - a.orders)[0];

  // Recent orders filtered
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((o) =>
      !orderSearch ||
      (o.orderNumber ?? '').toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.tableNumber != null && String(o.tableNumber).includes(orderSearch))
    )
    .slice(0, 5);

  // ── stat card data ──────────────────────────────────────────────────────────
  const stats = [
    {
      label:   'Total Orders',
      value:   todayOrders.length,
      icon:    ShoppingBag,
      bg:      'bg-orange-500',
      iconBg:  'bg-white/20',
      text:    'text-white',
      sub:     'text-orange-100',
      trend:   null,
      hero:    true,
    },
    {
      label:   'Completed',
      value:   completed.length,
      icon:    CheckCircle2,
      bg:      'bg-white',
      iconBg:  'bg-green-50',
      iconCls: 'text-green-500',
      text:    'text-gray-900',
      sub:     'text-gray-400',
      trend:   completed.length > 0 ? '+' + completed.length : null,
      up:      true,
      hero:    false,
    },
    {
      label:   'Cancelled',
      value:   cancelled.length,
      icon:    XCircle,
      bg:      'bg-white',
      iconBg:  'bg-red-50',
      iconCls: 'text-red-400',
      text:    'text-gray-900',
      sub:     'text-gray-400',
      trend:   cancelled.length > 0 ? '-' + cancelled.length : null,
      up:      false,
      hero:    false,
    },
    {
      label:   "Today's Revenue",
      value:   fmt(todayRevenue),
      icon:    Banknote,
      bg:      'bg-white',
      iconBg:  'bg-blue-50',
      iconCls: 'text-blue-500',
      text:    'text-gray-900',
      sub:     'text-gray-400',
      trend:   todayRevenue > 0 ? fmt(avgOrderValue) + ' avg' : null,
      up:      true,
      hero:    false,
    },
  ];

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f7]">
      <AdminSidebar />

      <div className="flex-1 overflow-y-auto pt-14 md:pt-0 flex flex-col">

        {/* Header */}
        <AdminHeader title="Overview" subtitle={`${greeting}, ${user?.name ?? 'Restaurant Admin'}`}>
          <div className="text-right hidden sm:block shrink-0 mr-1">
            <p className="text-sm font-bold text-gray-900 tabular-nums leading-tight">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-[11px] text-gray-400 leading-tight">
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </AdminHeader>

        <div className="px-4 md:px-6 py-5 space-y-5 flex-1">

          <TrialBanner />

          {/* ── Stat Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl p-5 shadow-sm border border-gray-100 ${s.bg}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                    <s.icon size={17} className={s.hero ? 'text-white' : s.iconCls} />
                  </div>
                  {s.trend && (
                    <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      s.hero
                        ? 'bg-white/20 text-white'
                        : s.up
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-500'
                    }`}>
                      {s.up !== undefined && (s.up
                        ? <TrendingUp size={10} />
                        : <TrendingDown size={10} />)}
                      {s.trend}
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold leading-tight ${s.text}`}>{s.value}</p>
                <p className={`text-xs mt-1 ${s.sub}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── 3-column grid ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── LEFT: Revenue chart + Recent orders ────────────────────── */}
            <div className="lg:col-span-5 space-y-5">

              {/* Revenue Trend */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Total Revenue (7 days)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{fmt(todayRevenue)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Orders
                    </span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weeklyData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#f97316" />
                        <stop offset="100%" stopColor="#fb923c" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.10)' }}
                      formatter={(v, name) => [name === 'revenue' ? fmt(Number(v ?? 0)) : v, name === 'revenue' ? 'Revenue' : 'Orders']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="orders"  stroke="#93c5fd" strokeWidth={2}   dot={false} strokeDasharray="4 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <p className="text-sm font-bold text-gray-900">Recent Orders</p>
                  <Link to="/admin/orders" className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:underline">
                    View all <ArrowUpRight size={12} />
                  </Link>
                </div>

                {/* Search */}
                <div className="px-5 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <Search size={13} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search by order # or table…"
                      className="bg-transparent flex-1 text-xs text-gray-600 outline-none placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-50">
                  {recentOrders.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-8">No orders yet</p>
                  ) : (
                    recentOrders.map((o) => {
                      const cfg = STATUS_CFG[o.status] ?? STATUS_CFG['pending'];
                      const loc = o.tableNumber ? `Table ${o.tableNumber}` : o.roomNumber ? `Room ${o.roomNumber}` : 'Takeaway';
                      const firstItem = (o.items ?? [])[0];
                      return (
                        <Link
                          key={o.id}
                          to="/admin/orders"
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                        >
                          {/* Item thumbnail / placeholder */}
                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <Utensils size={14} className="text-orange-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {firstItem?.name ?? 'Order'}{(o.items?.length ?? 0) > 1 ? ` +${(o.items?.length ?? 1) - 1}` : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {loc} · {relativeTime(o.createdAt)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-800">{fmt(Number(o.totalAmount))}</p>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-0.5`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className="text-gray-500">{cfg.label}</span>
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── MIDDLE: Categories + Order types ───────────────────────── */}
            <div className="lg:col-span-4 space-y-5">

              {/* Top Categories */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-900">Top Categories</p>
                  <Link to="/admin/reports" className="text-xs text-orange-500 font-semibold hover:underline">See all</Link>
                </div>

                {topCats.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-6">No data yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {topCats.map((cat, i) => {
                      const pct   = Math.round((cat.quantity / maxCatQty) * 100);
                      const colors = [
                        { ring: 'ring-orange-200', bg: 'bg-orange-50',  bar: 'bg-orange-500', text: 'text-orange-600' },
                        { ring: 'ring-blue-200',   bg: 'bg-blue-50',    bar: 'bg-blue-500',   text: 'text-blue-600' },
                        { ring: 'ring-purple-200', bg: 'bg-purple-50',  bar: 'bg-purple-500', text: 'text-purple-600' },
                      ][i] ?? { ring: 'ring-gray-200', bg: 'bg-gray-50', bar: 'bg-gray-400', text: 'text-gray-600' };
                      return (
                        <div key={cat.name} className={`rounded-xl p-3 ring-1 ${colors.ring} ${colors.bg} flex flex-col items-center gap-2`}>
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Utensils size={16} className={colors.text} />
                          </div>
                          <p className={`text-lg font-bold ${colors.text}`}>{pct}%</p>
                          <p className="text-[11px] text-gray-500 text-center font-medium leading-tight truncate w-full text-center">{cat.name}</p>
                          {/* mini bar */}
                          <div className="w-full h-1 bg-white rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Status widget */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Order Status</p>
                    <p className="text-xs text-gray-400">Today · {todayOrders.length} total</p>
                  </div>
                  <Link to="/admin/orders" className="w-7 h-7 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
                    <ArrowUpRight size={13} className="text-gray-400" />
                  </Link>
                </div>
                {[
                  { label: 'Active',    value: activeOrders.length,    color: 'bg-orange-400' },
                  { label: 'Completed', value: completed.length,       color: 'bg-green-400'  },
                  { label: 'Cancelled', value: cancelled.length,       color: 'bg-red-400'    },
                ].map((row) => {
                  const pct = todayOrders.length > 0 ? Math.round((row.value / todayOrders.length) * 100) : 0;
                  return (
                    <div key={row.label} className="flex items-center gap-3 mb-3 last:mb-0">
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                        <span className="text-xs text-gray-500">{row.label}</span>
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${row.color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-5 text-right">{row.value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Sales by Order Type */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-gray-900 mb-4">Sales by Order Type</p>
                {orderTypeData.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">No data yet</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={orderTypeData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={28}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.10)' }}
                          formatter={(v) => [v, 'Orders']}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {orderTypeData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      {orderTypeData.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          {d.name}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── RIGHT: Trending item + POS stats ───────────────────────── */}
            <div className="lg:col-span-3 space-y-5">

              {/* Trending Menu Item */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <p className="text-sm font-bold text-gray-900">Trending Item</p>
                  <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Today</span>
                </div>
                {trendingItem ? (
                  <>
                    <div className="mx-5 rounded-2xl overflow-hidden bg-gray-100 h-32">
                      {trendingItem.image
                        ? <img src={trendingItem.image} alt={trendingItem.name} className="w-full h-full object-cover" />
                        : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils size={28} className="text-gray-300" />
                          </div>
                        )}
                    </div>
                    <div className="px-5 pt-3 pb-5">
                      <p className="text-sm font-bold text-gray-900 truncate">{trendingItem.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} size={11} className="text-amber-400 fill-amber-400" />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{trendingItem.qty} orders</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-bold text-gray-900">{fmt(trendingItem.price)}</span>
                        <Link to="/admin/menu" className="text-xs text-orange-500 font-semibold hover:underline">View →</Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-5 pb-5">
                    <div className="h-32 rounded-2xl bg-gray-50 flex items-center justify-center">
                      <p className="text-xs text-gray-300">No orders today yet</p>
                    </div>
                  </div>
                )}
              </div>

              {/* POS Activities */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-900">POS Activities</p>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full font-medium">Today</span>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-0.5">Total Sales</p>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-bold text-gray-900">{fmt(todayRevenue)}</p>
                    {todayOrders.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-green-600 font-semibold mb-0.5">
                        <TrendingUp size={11} /> +{todayOrders.length} orders
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Total Bills', value: todayOrders.length, icon: Receipt,  color: 'text-orange-500', bg: 'bg-orange-50' },
                    { label: 'Avg Value',   value: fmt(avgOrderValue),  icon: Banknote, color: 'text-blue-500',   bg: 'bg-blue-50'   },
                    { label: 'Peak Hour',   value: peakHour?.hour ?? '–', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
                  ].map((m) => (
                    <div key={m.label} className={`${m.bg} rounded-xl p-2.5 flex flex-col items-center gap-1`}>
                      <m.icon size={14} className={m.color} />
                      <p className="text-xs font-bold text-gray-800">{m.value}</p>
                      <p className="text-[9px] text-gray-400 text-center leading-tight">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Stock alert */}
                {lowStock.length > 0 && (
                  <Link
                    to="/admin/stock"
                    className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 hover:bg-amber-100 transition-colors"
                  >
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-700">{lowStock.length} low-stock alert{lowStock.length > 1 ? 's' : ''}</p>
                      <p className="text-[10px] text-amber-500">Tap to restock →</p>
                    </div>
                  </Link>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <Link
                  to="/admin/new-order"
                  className="flex items-center gap-3 bg-orange-500 hover:bg-orange-600 transition-colors rounded-2xl px-4 py-3.5 shadow-sm"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={15} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">New Order</p>
                    <p className="text-[11px] text-orange-100">Dine-in or takeaway</p>
                  </div>
                </Link>
                <Link
                  to="/admin/orders"
                  className="relative flex items-center gap-3 bg-gray-800 hover:bg-gray-900 transition-colors rounded-2xl px-4 py-3.5 shadow-sm"
                >
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ChefHat size={15} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Live Orders</p>
                    <p className="text-[11px] text-gray-400">Manage kitchen queue</p>
                  </div>
                  {activeOrders.length > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[20px] px-1.5 py-0.5 text-center leading-none flex-shrink-0">
                      {activeOrders.length}
                    </span>
                  )}
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
