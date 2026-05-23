import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, UtensilsCrossed, ChefHat, LogOut, Settings,
  Receipt, BarChart2, LayoutList, LayoutGrid, PlusCircle, MonitorPlay,
  BedDouble, Tag, CreditCard, UserCheck, Trophy, ShoppingBag, MapPin,
  Medal, LayoutDashboard, Eye, Activity, Banknote, QrCode, ClipboardCheck, CalendarDays, AlarmClock, Package,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { reportService, type TodaySummary } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';
import { SoundAlertToggle } from '../../components/SoundAlertToggle';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { fmt } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [today, setToday]   = useState<TodaySummary | null>(null);
  const [gridView, setGridView] = useState(() => localStorage.getItem('dash-view') === 'grid');

  useOrderSoundAlert(orders);

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
  const activeOrders = orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));
  // Net revenue = gross sales − refunds (from report API); fall back to order sum before API responds
  const netRevenue = today?.revenue ?? todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  const stats = [
    {
      label: t('dashboard.todayOrders'),
      value: todayOrders.length,
      icon: ClipboardList,
      iconCls: 'bg-blue-50 text-blue-500',
      bar: 'bg-blue-400',
      valueCls: 'text-blue-600',
    },
    {
      label: t('dashboard.activeOrders'),
      value: activeOrders.length,
      icon: Activity,
      iconCls: 'bg-red-50 text-red-500',
      bar: 'bg-red-400',
      valueCls: 'text-red-600',
    },
    {
      label: t('dashboard.netRevenue'),
      value: fmt(netRevenue),
      icon: Banknote,
      iconCls: 'bg-green-50 text-green-600',
      bar: 'bg-green-400',
      valueCls: 'text-green-700',
    },
  ];

  const navItems = [
    { to: '/admin/new-order',          label: t('nav.newOrder'),          icon: PlusCircle,     desc: t('nav.newOrderDesc'),       primary: true,  badge: undefined, allowedRoles: ['admin','manager','cashier','waiter'] },
    { to: '/admin/orders',             label: t('nav.liveOrders'),        icon: ClipboardList,  desc: t('nav.liveOrdersDesc'),     primary: true,  badge: activeOrders.length, allowedRoles: ['admin','manager','cashier','waiter'] },
    { to: '/admin/bills',              label: t('nav.bills'),             icon: Receipt,        desc: t('nav.billsDesc'),          primary: false, badge: undefined, allowedRoles: ['admin','manager','cashier'] },
    { to: '/admin/shift-close',        label: t('nav.shiftClose'),        icon: ClipboardCheck, desc: t('nav.shiftCloseDesc'),     primary: false, badge: undefined, allowedRoles: ['admin','manager','cashier'] },
    { to: '/admin/reports',            label: t('nav.reports'),           icon: BarChart2,      desc: t('nav.reportsDesc'),        primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/menu',               label: t('nav.menuItems'),         icon: UtensilsCrossed, desc: t('nav.menuItemsDesc'),    primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/locations',          label: t('nav.tablesRooms'),       icon: QrCode,         desc: t('nav.tablesRoomsDesc'),    primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/table-status',       label: t('nav.tableStatus'),       icon: LayoutDashboard, desc: t('nav.tableStatusDesc'),  primary: false, badge: undefined, allowedRoles: ['admin','manager','cashier','waiter'] },
    { to: '/kitchen',                  label: t('nav.kitchenDisplay'),    icon: ChefHat,        desc: t('nav.kitchenDisplayDesc'), primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/ready-display',      label: t('nav.readyDisplay'),      icon: MonitorPlay,    desc: t('nav.readyDisplayDesc'),   primary: false, badge: undefined, allowedRoles: ['admin','manager','cashier','waiter'] },
    { to: '/admin/promo-codes',        label: t('nav.promoCodes'),        icon: Tag,            desc: t('nav.promoCodesDesc'),     primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/room-charges',       label: t('nav.roomCharges'),       icon: CreditCard,     desc: t('nav.roomChargesDesc'),    primary: false, badge: undefined, allowedRoles: ['admin','manager','cashier'] },
    { to: '/admin/waiters',            label: t('nav.waiters'),           icon: UserCheck,      desc: t('nav.waitersDesc'),        primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/staff-performance',  label: t('nav.staffPerformance'),  icon: Trophy,         desc: t('nav.staffPerformanceDesc'), primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/roster',             label: t('nav.staffRoster'),       icon: CalendarDays,   desc: t('nav.staffRosterDesc'),    primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/menu-schedules',     label: t('nav.menuSchedules'),     icon: AlarmClock,     desc: t('nav.menuSchedulesDesc'),  primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    { to: '/admin/combos',             label: t('nav.combos'),            icon: Package,        desc: t('nav.combosDesc'),         primary: false, badge: undefined, allowedRoles: ['admin','manager'] },
    ...(user?.restaurantId ? [{
      to: '#',
      href: `/takeaway/${user.restaurantId}`,
      label: t('nav.previewMenu'),
      icon: Eye,
      desc: t('nav.previewMenuDesc'),
      primary: false,
      badge: undefined,
      allowedRoles: ['admin','manager'],
    }] : []),
  ].filter((item) => !item.allowedRoles || item.allowedRoles.includes(user?.role ?? ''));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.welcome', { name: user?.name })}</p>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher variant="select" className="shrink-0" />
              <SoundAlertToggle />
              <button
                onClick={() => setGridView((v) => { const next = !v; localStorage.setItem('dash-view', next ? 'grid' : 'list'); return next; })}
                className="p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                title={gridView ? t('dashboard.switchToList') : t('dashboard.switchToGrid')}
              >
                {gridView ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
              </button>
              {user?.role === 'admin' && (
                <Link
                  to="/admin/settings"
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 transition-colors px-3 py-1.5 rounded-xl hover:bg-orange-50"
                >
                  <Settings size={16} />
                </Link>
              )}
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
        {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Medal size={16} className="text-orange-500" />
              <h2 className="font-bold text-gray-900 text-sm">{t('dashboard.todayBreakdown')}</h2>
            </div>
            <Link to="/admin/reports" className="text-xs text-orange-500 font-medium hover:underline">
              {t('dashboard.fullReport')} →
            </Link>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: t('dashboard.dineIn'),   value: today?.dineIn      ?? '—', icon: MapPin,    color: 'text-orange-500' },
              { label: t('dashboard.takeaway'),  value: today?.takeaway    ?? '—', icon: ShoppingBag, color: 'text-purple-500' },
              { label: t('dashboard.roomSvc'),   value: today?.roomService ?? '—', icon: BedDouble,  color: 'text-blue-500' },
            ].map((row) => (
              <div key={row.label} className="flex flex-col items-center py-3 gap-0.5">
                <row.icon size={13} className={row.color} />
                <span className="text-lg font-bold text-gray-900">{row.value}</span>
                <span className="text-xs text-gray-400">{row.label}</span>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 text-sm">
            <span className="text-gray-500">{t('dashboard.grossRevenue')}</span>
            <span className="font-semibold text-gray-900">
              {today ? fmt(today.grossRevenue) : '—'}
            </span>
          </div>

          {today && today.totalRefunds > 0 && (
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 text-sm">
              <span className="text-red-500 flex items-center gap-1.5">
                <span>↩</span> {t('dashboard.refunds', { n: today.refundCount })}
              </span>
              <span className="font-semibold text-red-500">− {fmt(today.totalRefunds)}</span>
            </div>
          )}

          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 text-sm">
            <span className="text-gray-500">{t('dashboard.avgOrderValue')}</span>
            <span className="font-semibold text-gray-900">
              {today ? fmt(today.avgOrderValue) : '—'}
            </span>
          </div>

          <div className="px-5 py-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.topItemsToday')}</p>
            {!today || today.topItems.length === 0 ? (
              <p className="text-xs text-gray-300 py-2 text-center">{t('dashboard.noOrdersToday')}</p>
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
        )}

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
