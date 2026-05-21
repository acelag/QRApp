import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, UtensilsCrossed, ChefHat, LogOut, Settings,
  Receipt, BarChart2, LayoutList, LayoutGrid, PlusCircle, MonitorPlay,
  BedDouble, Tag, CreditCard, UserCheck, Trophy, ShoppingBag, MapPin,
  Medal, LayoutDashboard, Eye, Activity, Banknote, QrCode,
} from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { reportService, type TodaySummary } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { fmt } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [today, setToday]   = useState<TodaySummary | null>(null);
  const [gridView, setGridView] = useState(() => localStorage.getItem('dash-view') === 'grid');

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  useEffect(() => {
    const fetch = () => orderService.getOrders().then(setOrders).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    reportService.getToday().then(setToday).catch(() => {});
  }, []);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayOrders  = orders.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr);
  const activeOrders = orders.filter((o) => o.status !== 'ready');
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  const stats = [
    {
      label: "Today's Orders",
      value: todayOrders.length,
      icon: ClipboardList,
      iconCls: 'bg-blue-50 text-blue-500',
      bar: 'bg-blue-400',
      valueCls: 'text-blue-600',
    },
    {
      label: 'Active Orders',
      value: activeOrders.length,
      icon: Activity,
      iconCls: 'bg-red-50 text-red-500',
      bar: 'bg-red-400',
      valueCls: 'text-red-600',
    },
    {
      label: "Today's Revenue",
      value: fmt(todayRevenue),
      icon: Banknote,
      iconCls: 'bg-green-50 text-green-600',
      bar: 'bg-green-400',
      valueCls: 'text-green-700',
    },
  ];

  const navItems: {
    to: string;
    href?: string;
    label: string;
    icon: React.ElementType;
    desc: string;
    primary?: boolean;
    badge?: number;
  }[] = [
    { to: '/admin/new-order',          label: 'New Order',          icon: PlusCircle,     desc: 'Place takeaway or dine-in order',       primary: true },
    { to: '/admin/orders',             label: 'Live Orders',        icon: ClipboardList,  desc: 'Manage incoming orders',                primary: true, badge: activeOrders.length },
    { to: '/admin/bills',              label: 'Bills',              icon: Receipt,        desc: 'Table bills & takeaway receipts' },
    { to: '/admin/reports',            label: 'Reports',            icon: BarChart2,      desc: 'Sales & item performance' },
    { to: '/admin/menu',               label: 'Menu Items',         icon: UtensilsCrossed, desc: 'Add, edit, delete items' },
    { to: '/admin/locations',          label: 'Tables & Rooms',     icon: QrCode,         desc: 'Manage tables, rooms & QR codes' },
    { to: '/admin/table-status',       label: 'Table Status',       icon: LayoutDashboard, desc: 'Live grid — open / occupied / stale' },
    { to: '/kitchen',                  label: 'Kitchen Display',    icon: ChefHat,        desc: 'Live kitchen order view' },
    { to: '/admin/ready-display',      label: 'Ready Display',      icon: MonitorPlay,    desc: 'Show orders ready for pickup' },
    { to: '/admin/promo-codes',        label: 'Promo Codes',        icon: Tag,            desc: 'Discount & promo codes' },
    { to: '/admin/room-charges',       label: 'Room Charges',       icon: CreditCard,     desc: 'Pending charge-to-room bills' },
    { to: '/admin/waiters',            label: 'Waiters',            icon: UserCheck,      desc: 'Manage waiter staff list' },
    { to: '/admin/staff-performance',  label: 'Staff Performance',  icon: Trophy,         desc: 'Waiter leaderboard & stats' },
    ...(user?.restaurantId ? [{
      to: '#',
      href: `/takeaway/${user.restaurantId}`,
      label: 'Preview Menu',
      icon: Eye,
      desc: 'Open live menu as a customer',
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGridView((v) => { const next = !v; localStorage.setItem('dash-view', next ? 'grid' : 'list'); return next; })}
                className="p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                title={gridView ? 'Switch to list view' : 'Switch to grid view'}
              >
                {gridView ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
              </button>
              <Link
                to="/admin/settings"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 transition-colors px-3 py-1.5 rounded-xl hover:bg-orange-50"
              >
                <Settings size={16} />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 min-w-0 ${
                i === 2 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <div className={`h-1 ${s.bar}`} />
              <div className="p-3 sm:p-4">
                <div className={`inline-flex p-2 rounded-xl mb-2 ${s.iconCls}`}>
                  <s.icon size={18} />
                </div>
                <p className={`text-xl font-bold truncate ${s.valueCls}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Today's breakdown ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Medal size={16} className="text-orange-500" />
              <h2 className="font-bold text-gray-900 text-sm">Today's Breakdown</h2>
            </div>
            <Link to="/admin/reports" className="text-xs text-orange-500 font-medium hover:underline">
              Full Report →
            </Link>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Dine-in',   value: today?.dineIn      ?? '—', icon: MapPin,    color: 'text-orange-500' },
              { label: 'Takeaway',  value: today?.takeaway    ?? '—', icon: ShoppingBag, color: 'text-purple-500' },
              { label: 'Room Svc',  value: today?.roomService ?? '—', icon: BedDouble,  color: 'text-blue-500' },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center py-3 gap-0.5">
                <t.icon size={13} className={t.color} />
                <span className="text-lg font-bold text-gray-900">{t.value}</span>
                <span className="text-xs text-gray-400">{t.label}</span>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 text-sm">
            <span className="text-gray-500">Avg. order value</span>
            <span className="font-semibold text-gray-900">
              {today ? fmt(today.avgOrderValue) : '—'}
            </span>
          </div>

          <div className="px-5 py-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Top Items Today</p>
            {!today || today.topItems.length === 0 ? (
              <p className="text-xs text-gray-300 py-2 text-center">No orders yet today</p>
            ) : (
              <ol className="space-y-1.5">
                {today.topItems.map((item, i) => (
                  <li key={item.name} className="flex items-center gap-2.5 text-sm">
                    <span className={`text-xs font-bold w-5 text-center shrink-0 ${
                      i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'
                    }`}>{i + 1}</span>
                    <span className="flex-1 text-gray-700 truncate">{item.name}</span>
                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shrink-0">
                      ×{item.quantity}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0 w-20 text-right">{fmt(item.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ── Navigation grid / list ─────────────────────────────────── */}
        {gridView ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {navItems.map((item) => {
              const isPrimary = !!item.primary;
              const cls = isPrimary
                ? 'relative bg-orange-500 rounded-2xl p-4 shadow-md shadow-orange-200 border border-orange-400 flex flex-col items-center text-center gap-3 hover:bg-orange-600 transition-colors'
                : 'relative bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center gap-3 hover:border-orange-200 transition-colors';
              const inner = (
                <>
                  <div className={isPrimary ? 'bg-white/20 p-3 rounded-xl text-white' : 'bg-orange-50 p-3 rounded-xl text-orange-600'}>
                    <item.icon size={24} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm leading-tight ${isPrimary ? 'text-white' : 'text-gray-900'}`}>
                      {item.label}
                    </p>
                    <p className={`text-xs mt-0.5 leading-tight ${isPrimary ? 'text-orange-100' : 'text-gray-400'}`}>
                      {item.desc}
                    </p>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`absolute top-2 right-2 text-xs font-bold rounded-full min-w-[20px] px-1.5 py-0.5 text-center leading-none ${
                      isPrimary ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              );
              return item.href
                ? <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                : <Link key={item.label} to={item.to} className={cls}>{inner}</Link>;
            })}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {navItems.map((item) => {
              const isPrimary = !!item.primary;
              const cls = isPrimary
                ? 'relative bg-orange-500 rounded-2xl p-4 shadow-md shadow-orange-200 border border-orange-400 flex items-center gap-4 hover:bg-orange-600 transition-colors'
                : 'relative bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:border-orange-200 transition-colors';
              const inner = (
                <>
                  <div className={isPrimary ? 'bg-white/20 p-3 rounded-xl text-white' : 'bg-orange-50 p-3 rounded-xl text-orange-600'}>
                    <item.icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${isPrimary ? 'text-white' : 'text-gray-900'}`}>{item.label}</p>
                    <p className={`text-sm ${isPrimary ? 'text-orange-100' : 'text-gray-500'}`}>{item.desc}</p>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 shrink-0 ${
                      isPrimary ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              );
              return item.href
                ? <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                : <Link key={item.label} to={item.to} className={cls}>{inner}</Link>;
            })}
          </div>
        )}
      </main>
    </div>
  );
}
