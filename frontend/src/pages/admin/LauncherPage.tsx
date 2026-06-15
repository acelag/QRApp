import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import {
  Rocket, LayoutDashboard, ShoppingCart, UtensilsCrossed, Tag,
  QrCode, MapPin, CalendarDays, LayoutGrid, MonitorPlay, ChefHat,
  Receipt, CreditCard, Users, Warehouse, BarChart2,
  Settings, Star, ArrowLeft, Clock, Box,
} from 'lucide-react';

// ── Deploy info helpers ──────────────────────────────────────────────────────
const isProd = import.meta.env.PROD;

function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60)  return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type NavLeaf = { label: string; icon: React.ElementType; to: string; color: string };
type NavGroup = { label: string; icon: React.ElementType; color: string; children: NavLeaf[] };
type NavEntry = ({ type: 'item' } & NavLeaf) | ({ type: 'group' } & NavGroup);

const TOP_NAV: NavEntry[] = [
  { type: 'item',  label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard', color: 'bg-blue-50   text-blue-600'   },
  { type: 'item',  label: 'Orders',    icon: ShoppingCart,    to: '/admin/orders',    color: 'bg-orange-50 text-orange-600' },
  { type: 'item',  label: 'Menu',      icon: UtensilsCrossed, to: '/admin/menu',      color: 'bg-green-50  text-green-600'  },
  { type: 'item',  label: 'QR',        icon: QrCode,          to: '/admin/locations', color: 'bg-purple-50 text-purple-600' },
  {
    type: 'group', label: 'Floor', icon: MapPin, color: 'bg-purple-50 text-purple-600',
    children: [
      { label: 'Floor Plan',   icon: MapPin,       to: '/admin/floor-plan',   color: 'bg-purple-50 text-purple-600' },
      { label: 'Reservations', icon: CalendarDays, to: '/admin/reservations', color: 'bg-purple-50 text-purple-600' },
      { label: 'Table Status', icon: LayoutGrid,   to: '/admin/table-status', color: 'bg-purple-50 text-purple-600' },
    ],
  },
  {
    type: 'group', label: 'Displays', icon: MonitorPlay, color: 'bg-red-50 text-red-600',
    children: [
      { label: 'Kitchen Display', icon: ChefHat,     to: '/kitchen',             color: 'bg-red-50 text-red-600' },
      { label: 'Ready Display',   icon: MonitorPlay, to: '/admin/ready-display', color: 'bg-red-50 text-red-600' },
    ],
  },
  {
    type: 'group', label: 'Finance', icon: Receipt, color: 'bg-teal-50 text-teal-600',
    children: [
      { label: 'Bills',        icon: Receipt,    to: '/admin/bills',        color: 'bg-teal-50 text-teal-600' },
      { label: 'Room Charges', icon: CreditCard, to: '/admin/room-charges', color: 'bg-teal-50 text-teal-600' },
      { label: 'Promo Codes',  icon: Tag,        to: '/admin/promo-codes',  color: 'bg-teal-50 text-teal-600' },
    ],
  },
  { type: 'item', label: 'Staff', icon: Users, to: '/admin/users', color: 'bg-indigo-50 text-indigo-600' },
  {
    type: 'group', label: 'Inventory', icon: Warehouse, color: 'bg-amber-50 text-amber-600',
    children: [
      { label: 'Stock',   icon: Warehouse, to: '/admin/stock',   color: 'bg-amber-50 text-amber-600' },
      { label: 'Loyalty', icon: Star,      to: '/admin/loyalty', color: 'bg-amber-50 text-amber-600' },
    ],
  },
  { type: 'item', label: 'Reports', icon: BarChart2, to: '/admin/reports', color: 'bg-gray-100 text-gray-600' },
  { type: 'item', label: 'Settings', icon: Settings, to: '/admin/settings', color: 'bg-gray-100 text-gray-600' },
];

function Tile({ label, icon: Icon, color, onClick, to }: {
  label: string; icon: React.ElementType; color: string;
  onClick?: () => void; to?: string;
}) {
  const inner = (
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${color}`}>
      <Icon size={26} />
    </div>
  );
  const cls = 'flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer';

  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
        <span className="text-xs font-medium text-gray-600 text-center leading-tight group-hover:text-gray-900">{label}</span>
      </Link>
    );
  }
  return (
    <div onClick={onClick} className={cls}>
      {inner}
      <span className="text-xs font-medium text-gray-600 text-center leading-tight group-hover:text-gray-900">{label}</span>
    </div>
  );
}

export function LauncherPage() {
  const [activeGroup, setActiveGroup] = useState<NavGroup | null>(null);

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader title="Launcher" icon={Rocket} />
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">

          {activeGroup ? (
            <>
              {/* Sub-group view */}
              <button
                onClick={() => setActiveGroup(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <h2 className="text-lg font-bold text-gray-800 mb-4">{activeGroup.label}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {activeGroup.children.map((child) => (
                  <Tile key={child.to} {...child} />
                ))}
              </div>
            </>
          ) : (
            /* Top-level grid */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {TOP_NAV.map((entry) =>
                entry.type === 'item' ? (
                  <Tile key={entry.to} label={entry.label} icon={entry.icon} color={entry.color} to={entry.to} />
                ) : (
                  <Tile key={entry.label} label={entry.label} icon={entry.icon} color={entry.color} onClick={() => setActiveGroup(entry)} />
                )
              )}
            </div>
          )}

          {/* Deploy info footer */}
          <div className="mt-auto pt-10">
            <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-green-400' : 'bg-amber-400'}`} />
                {isProd ? 'Production' : 'Development'}
              </span>
              <span className="flex items-center gap-1"><Box size={11} /> v{__APP_VERSION__}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> Deployed {relativeTime(__BUILD_TIME__)} · {formatBuildTime(__BUILD_TIME__)}</span>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
