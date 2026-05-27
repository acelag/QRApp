import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, BarChart2,
  Users, Settings, LogOut, ChefHat, MonitorPlay,
  Receipt, QrCode, Tag, CreditCard, UserCheck, Trophy,
  Package, Calendar, CalendarDays, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';

const NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/admin',                exact: true },
  { label: 'Orders',           icon: ShoppingCart,    to: '/admin/orders',         badge: true },
  { label: 'Menu',             icon: UtensilsCrossed, to: '/admin/menu' },
  { label: 'Bills',            icon: Receipt,         to: '/admin/bills' },
  { label: 'Reports',          icon: BarChart2,       to: '/admin/reports',        matchPrefix: '/admin/reports' },
  { label: 'Tables & Rooms',   icon: QrCode,          to: '/admin/locations' },
  { label: 'Table Status',     icon: LayoutDashboard, to: '/admin/table-status' },
  { label: 'Kitchen Display',  icon: ChefHat,         to: '/kitchen' },
  { label: 'Ready Display',    icon: MonitorPlay,     to: '/admin/ready-display' },
  { label: 'Promo Codes',      icon: Tag,             to: '/admin/promo-codes' },
  { label: 'Room Charges',     icon: CreditCard,      to: '/admin/room-charges' },
  { label: 'Combo Deals',      icon: Package,         to: '/admin/combos' },
  { label: 'Menu Schedules',   icon: Calendar,        to: '/admin/menu-schedules' },
  { label: 'Roster',           icon: CalendarDays,    to: '/admin/roster' },
  { label: 'Shift Report',     icon: FileText,        to: '/admin/shift-close' },
  { label: 'Waiters',          icon: UserCheck,       to: '/admin/waiters' },
  { label: 'Staff Performance',icon: Trophy,          to: '/admin/staff-performance' },
  { label: 'Staff',            icon: Users,           to: '/admin/users' },
  { label: 'Settings',         icon: Settings,        to: '/admin/settings' },
];

export function AdminSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const fetch = () =>
      orderService.getOrders()
        .then((orders) => setActiveCount(orders.filter((o) => o.status !== 'cancelled').length))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  }, []);

  function handleLogout() { logout(); window.location.href = '/login'; }

  return (
    <aside className="w-56 flex-none bg-white border-r border-gray-100 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100 flex-none">
        <p className="text-base font-bold text-gray-900 leading-tight">Restaurant POS</p>
        <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.matchPrefix ?? item.to);

          return (
            <Link
              key={item.label + item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <item.icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
              <span className="flex-1">{item.label}</span>
              {item.badge && activeCount > 0 && (
                <span className="text-xs font-bold bg-orange-500 text-white rounded-full min-w-[20px] px-1.5 py-0.5 text-center leading-none">
                  {activeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3 flex-none">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-none">
          {user?.name?.slice(0, 2).toUpperCase() ?? 'RA'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 truncate">{user?.name ?? 'Restaurant Admin'}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email ?? ''}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-500 transition-colors flex-none"
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
