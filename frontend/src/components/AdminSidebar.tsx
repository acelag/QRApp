import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, BarChart2,
  Users, Settings, LogOut, ChefHat, MonitorPlay,
  Receipt, QrCode, Tag, CreditCard, UserCheck, Trophy,
  Package, Calendar, CalendarDays, FileText, Wallet, Warehouse,
  LayoutGrid, ChevronDown, ChevronRight, Menu, X, Sun, Moon, MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { RestaurantFeatures } from '../context/AuthContext';
import type { PermissionKey } from '../lib/permissions';
import { useSubscriptionConfig } from '../context/SubscriptionConfigContext';
import { useTheme } from '../context/ThemeContext';
import { orderService } from '../services/orderService';

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  exact?: boolean;
  badge?: boolean;
  matchPrefix?: string;
  featureKey?: keyof RestaurantFeatures;
  perm?: PermissionKey;
  adminOnly?: boolean;
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
  { type: 'item', label: 'Orders',    icon: ShoppingCart,    to: '/admin/orders', badge: true, perm: 'orders' },

  {
    type: 'group',
    label: 'Menu',
    icon: UtensilsCrossed,
    children: [
      { label: 'Menu Items',     icon: UtensilsCrossed, to: '/admin/menu', perm: 'menu' },
      { label: 'Categories & Tags', icon: Tag,          to: '/admin/menu-setup', perm: 'menu' },
      { label: 'Combo Deals',    icon: Package,         to: '/admin/combos',         featureKey: 'combos',        perm: 'combos' },
      { label: 'Menu Schedules', icon: Calendar,        to: '/admin/menu-schedules', featureKey: 'menuSchedules', perm: 'menuSchedules' },
    ],
  },
  {
    type: 'group',
    label: 'Floor',
    icon: QrCode,
    children: [
      { label: 'Tables & Rooms', icon: QrCode,        to: '/admin/locations',    perm: 'locations' },
      { label: 'Floor Plan',     icon: MapPin,        to: '/admin/floor-plan',   perm: 'locations' },
      { label: 'Reservations',   icon: CalendarDays,  to: '/admin/reservations', perm: 'locations' },
      { label: 'Table Status',   icon: LayoutGrid,    to: '/admin/table-status', featureKey: 'tableStatus', perm: 'tableStatus' },
    ],
  },
  {
    type: 'group',
    label: 'Displays',
    icon: MonitorPlay,
    children: [
      { label: 'Kitchen Display', icon: ChefHat,      to: '/kitchen',             featureKey: 'kitchenDisplay', perm: 'kitchenDisplay' },
      { label: 'Ready Display',   icon: MonitorPlay,  to: '/admin/ready-display', featureKey: 'readyDisplay',   perm: 'readyDisplay' },
    ],
  },
  {
    type: 'group',
    label: 'Finance',
    icon: Wallet,
    children: [
      { label: 'Bills',         icon: Receipt,    to: '/admin/bills',       featureKey: 'bills',       perm: 'bills' },
      { label: 'Room Charges',  icon: CreditCard, to: '/admin/room-charges',featureKey: 'roomCharges', perm: 'roomCharges' },
      { label: 'Promo Codes',   icon: Tag,        to: '/admin/promo-codes', featureKey: 'promoCodes',  perm: 'promoCodes' },
    ],
  },
  {
    type: 'group',
    label: 'Staff',
    icon: Users,
    children: [
      { label: 'Staff',             icon: Users,      to: '/admin/users', adminOnly: true },
      { label: 'Waiters',           icon: UserCheck,  to: '/admin/waiters', perm: 'waiters' },
      { label: 'Staff Performance', icon: Trophy,     to: '/admin/staff-performance', featureKey: 'staffPerformance', perm: 'staffPerformance' },
      { label: 'Roster',            icon: CalendarDays, to: '/admin/roster',          featureKey: 'roster',           perm: 'roster' },
    ],
  },
  {
    type: 'group',
    label: 'Inventory',
    icon: Warehouse,
    children: [
      { label: 'Stock', icon: Package, to: '/admin/stock', perm: 'stock' },
    ],
  },
  {
    type: 'group',
    label: 'Reports',
    icon: BarChart2,
    children: [
      { label: 'Order Reports', icon: BarChart2, to: '/admin/reports', exact: true, featureKey: 'reports',     perm: 'reports' },
      { label: 'Shift Report',  icon: FileText,  to: '/admin/shift-close',          featureKey: 'shiftReport', perm: 'shiftReport' },
      { label: 'Stock Report',  icon: Warehouse, to: '/admin/stock-report', perm: 'stockReport' },
    ],
  },
  { type: 'item', label: 'Subscription', icon: CreditCard, to: '/admin/billing', adminOnly: true },
  { type: 'item', label: 'Settings', icon: Settings, to: '/admin/settings', adminOnly: true },
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
  const { user, logout, features, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { enabled: subsEnabled } = useSubscriptionConfig();
  const { dark, toggleDark } = useTheme();
  const [activeCount, setActiveCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('qra-sidebar-collapsed') === '1'
  );

  const isStaff = !!user && user.role !== 'admin' && user.role !== 'super_admin';

  function isVisible(item: NavItem): boolean {
    if (item.featureKey && features[item.featureKey] === false) return false;
    if (item.to === '/admin/billing' && !subsEnabled) return false;
    if (item.adminOnly) return !isStaff;
    if (isStaff && item.perm) return hasPermission(item.perm);
    return true;
  }

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV.forEach((entry) => {
      if (entry.type === 'group' && groupHasActiveChild(entry, location.pathname)) {
        initial.add(entry.label);
      }
    });
    return initial;
  });

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

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('qra-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }

  function handleLogout() { logout(); window.location.href = '/'; }

  // Shared nav content for mobile drawer (always expanded)
  function NavContent() {
    return (
      <>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((entry) => {
            if (entry.type === 'item') {
              if (!isVisible(entry)) return null;
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

        <div className="px-5 py-1.5 text-center flex-none leading-tight">
          <span className="text-[10px] text-gray-300 font-mono">v{__APP_VERSION__}</span>
          <span className="block text-[9px] text-gray-300" title={__BUILD_TIME__}>
            Deployed {new Date(__BUILD_TIME__).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3 flex-none">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-none">
            {user?.name?.slice(0, 2).toUpperCase() ?? 'RA'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name ?? 'Restaurant Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.username ?? ''}</p>
          </div>
          <button
            onClick={toggleDark}
            className="text-gray-400 hover:text-gray-700 transition-colors flex-none"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
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

  // Desktop nav content — changes based on collapsed state
  function DesktopNav() {
    if (collapsed) {
      return (
        <>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {NAV.map((entry) => {
              if (entry.type === 'item') {
                if (!isVisible(entry)) return null;
                const active = isItemActive(entry, location.pathname);
                return (
                  <Link
                    key={entry.label}
                    to={entry.to}
                    title={entry.label}
                    className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors relative ${
                      active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <entry.icon size={18} />
                    {entry.badge && activeCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-orange-500 text-white rounded-full min-w-[16px] px-1 py-0 text-center leading-4">
                        {activeCount}
                      </span>
                    )}
                  </Link>
                );
              }

              const visibleChildren = entry.children.filter(isVisible);
              if (visibleChildren.length === 0) return null;

              const hasActive = visibleChildren.some((c) => isItemActive(c, location.pathname));
              const firstChild = visibleChildren[0];

              return (
                <button
                  key={entry.label}
                  title={entry.label}
                  onClick={() => navigate(firstChild.to)}
                  className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors ${
                    hasActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <entry.icon size={18} />
                </button>
              );
            })}
          </nav>

          <div className="py-2 text-center flex-none">
            <span className="text-[9px] text-gray-300 font-mono">v{__APP_VERSION__}</span>
          </div>

          <div className="py-4 border-t border-gray-100 flex flex-col items-center gap-3 flex-none">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.slice(0, 2).toUpperCase() ?? 'RA'}
            </div>
            <button
              onClick={toggleDark}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </>
      );
    }

    // Expanded desktop nav (same as mobile NavContent structure)
    return <NavContent />;
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

      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-none bg-white border-r border-gray-100 flex-col h-full transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Brand / hamburger toggle */}
        <div className={`border-b border-gray-100 flex-none flex items-center ${collapsed ? 'justify-center px-2 py-5' : 'px-4 py-5 justify-between'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 leading-tight truncate">Restaurant POS</p>
              <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-none"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={18} />
          </button>
        </div>

        <DesktopNav />
      </aside>
    </>
  );
}
