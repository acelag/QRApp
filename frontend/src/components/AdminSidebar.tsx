import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, BarChart2,
  Users, Settings, LogOut, ChefHat, MonitorPlay,
  Receipt, QrCode, Tag, CreditCard, UserCheck, Trophy,
  Package, Calendar, CalendarDays, FileText, Wallet,
  LayoutGrid, ChevronDown, ChevronRight, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { RestaurantFeatures } from '../context/AuthContext';
import { orderService } from '../services/orderService';

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  exact?: boolean;
  badge?: boolean;
  matchPrefix?: string;
  featureKey?: keyof RestaurantFeatures;
}

interface NavGroup {
  type: 'group';
  label: string;
  icon: React.ElementType;
  children: NavItem[];
}

interface NavSingle extends NavItem {
  type: 'item';
}

type NavEntry = NavSingle | NavGroup;

const NAV: NavEntry[] = [
  { type: 'item', label: 'Dashboard', icon: LayoutDashboard, to: '/admin', exact: true },
  { type: 'item', label: 'Orders',    icon: ShoppingCart,    to: '/admin/orders', badge: true },

  {
    type: 'group',
    label: 'Menu',
    icon: UtensilsCrossed,
    children: [
      { label: 'Menu Items',     icon: UtensilsCrossed, to: '/admin/menu' },
      { label: 'Categories & Tags', icon: Tag,          to: '/admin/menu-setup' },
      { label: 'Combo Deals',    icon: Package,         to: '/admin/combos',         featureKey: 'combos' },
      { label: 'Menu Schedules', icon: Calendar,        to: '/admin/menu-schedules', featureKey: 'menuSchedules' },
    ],
  },
  {
    type: 'group',
    label: 'Floor',
    icon: QrCode,
    children: [
      { label: 'Tables & Rooms', icon: QrCode,        to: '/admin/locations' },
      { label: 'Table Status',   icon: LayoutGrid,    to: '/admin/table-status', featureKey: 'tableStatus' },
    ],
  },
  {
    type: 'group',
    label: 'Displays',
    icon: MonitorPlay,
    children: [
      { label: 'Kitchen Display', icon: ChefHat,      to: '/kitchen',             featureKey: 'kitchenDisplay' },
      { label: 'Ready Display',   icon: MonitorPlay,  to: '/admin/ready-display', featureKey: 'readyDisplay' },
    ],
  },
  {
    type: 'group',
    label: 'Finance',
    icon: Wallet,
    children: [
      { label: 'Bills',         icon: Receipt,    to: '/admin/bills',       featureKey: 'bills' },
      { label: 'Room Charges',  icon: CreditCard, to: '/admin/room-charges',featureKey: 'roomCharges' },
      { label: 'Promo Codes',   icon: Tag,        to: '/admin/promo-codes', featureKey: 'promoCodes' },
      { label: 'Reports',       icon: BarChart2,  to: '/admin/reports', matchPrefix: '/admin/reports', featureKey: 'reports' },
      { label: 'Shift Report',  icon: FileText,   to: '/admin/shift-close', featureKey: 'shiftReport' },
    ],
  },
  {
    type: 'group',
    label: 'Staff',
    icon: Users,
    children: [
      { label: 'Staff',             icon: Users,      to: '/admin/users' },
      { label: 'Waiters',           icon: UserCheck,  to: '/admin/waiters' },
      { label: 'Staff Performance', icon: Trophy,     to: '/admin/staff-performance', featureKey: 'staffPerformance' },
      { label: 'Roster',            icon: CalendarDays, to: '/admin/roster',          featureKey: 'roster' },
    ],
  },

  { type: 'item', label: 'Settings', icon: Settings, to: '/admin/settings' },
];

function isItemActive(item: NavItem, pathname: string) {
  return item.exact
    ? pathname === item.to
    : pathname.startsWith(item.matchPrefix ?? item.to);
}

function groupHasActiveChild(group: NavGroup, pathname: string) {
  return group.children.some((c) => isItemActive(c, pathname));
}

export function AdminSidebar() {
  const { user, logout, features } = useAuth();
  const location = useLocation();
  const [activeCount, setActiveCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isVisible(item: NavItem): boolean {
    if (!item.featureKey) return true;
    return features[item.featureKey] !== false;
  }

  // Track which groups are open; auto-open groups whose child is active
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV.forEach((entry) => {
      if (entry.type === 'group' && groupHasActiveChild(entry, location.pathname)) {
        initial.add(entry.label);
      }
    });
    return initial;
  });

  // Re-open group on navigation + close mobile drawer
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroups((prev) => {
      const next = new Set(prev);
      NAV.forEach((entry) => {
        if (entry.type === 'group' && groupHasActiveChild(entry, location.pathname)) {
          next.add(entry.label);
        }
      });
      return next;
    });
  }, [location.pathname]);

  useEffect(() => {
    const fetch = () =>
      orderService.getOrders()
        .then((orders) => setActiveCount(orders.filter((o) => o.status !== 'cancelled').length))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function handleLogout() { logout(); window.location.href = '/login'; }

  // Shared nav content used in both desktop sidebar and mobile drawer
  function NavContent() {
    return (
      <>
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((entry) => {
            if (entry.type === 'item') {
              const active = isItemActive(entry, location.pathname);
              return (
                <Link
                  key={entry.label}
                  to={entry.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <entry.icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="flex-1">{entry.label}</span>
                  {entry.badge && activeCount > 0 && (
                    <span className="text-xs font-bold bg-orange-500 text-white rounded-full min-w-[20px] px-1.5 py-0.5 text-center leading-none">
                      {activeCount}
                    </span>
                  )}
                </Link>
              );
            }

            // Group — filter children by feature flags
            const visibleChildren = entry.children.filter(isVisible);
            if (visibleChildren.length === 0) return null;

            const isOpen = openGroups.has(entry.label);
            const hasActive = visibleChildren.some((c) => isItemActive(c, location.pathname));

            return (
              <div key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    hasActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <entry.icon size={16} className={hasActive ? 'text-blue-600' : 'text-gray-400'} />
                  <span className="flex-1 text-left">{entry.label}</span>
                  {isOpen
                    ? <ChevronDown size={14} className="text-gray-400" />
                    : <ChevronRight size={14} className="text-gray-400" />
                  }
                </button>

                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                    {visibleChildren.map((child) => {
                      const active = isItemActive(child, location.pathname);
                      return (
                        <Link
                          key={child.label}
                          to={child.to}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            active ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <child.icon size={14} className={active ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="flex-1">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Version */}
        <div className="px-5 py-1.5 text-center flex-none">
          <span className="text-[10px] text-gray-300 font-mono">v{__APP_VERSION__}</span>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3 flex-none">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-none">
            {user?.name?.slice(0, 2).toUpperCase() ?? 'RA'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name ?? 'Restaurant Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.username ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 transition-colors flex-none"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 leading-tight">Restaurant POS</p>
          <p className="text-[10px] text-gray-400">Admin Portal</p>
        </div>
        {activeCount > 0 && (
          <Link to="/admin/orders">
            <span className="text-xs font-bold bg-orange-500 text-white rounded-full min-w-[22px] px-1.5 py-0.5 text-center leading-none block">
              {activeCount}
            </span>
          </Link>
        )}
      </div>

      {/* ── Mobile drawer backdrop ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between flex-none">
          <div>
            <p className="text-base font-bold text-gray-900 leading-tight">Restaurant POS</p>
            <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <NavContent />
      </div>

      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-none bg-white border-r border-gray-100 flex-col h-full">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-100 flex-none">
          <p className="text-base font-bold text-gray-900 leading-tight">Restaurant POS</p>
          <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
        </div>
        <NavContent />
      </aside>
    </>
  );
}
