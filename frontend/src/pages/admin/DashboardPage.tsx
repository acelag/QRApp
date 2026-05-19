import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, Table2, TrendingUp, ChefHat, LogOut, Settings, Receipt, BarChart2, LayoutList, LayoutGrid, PlusCircle, MonitorPlay, BedDouble, Tag } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { fmt } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [gridView, setGridView] = useState(() => localStorage.getItem('dash-view') === 'grid');

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  useEffect(() => {
    const fetch = () => orderService.getOrders().then(setOrders).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr
  );
  const activeOrders = orders.filter((o) => o.status !== 'served');
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  const stats = [
    { label: "Today's Orders", value: todayOrders.length, icon: ClipboardList, color: 'bg-orange-50 text-orange-600' },
    { label: 'Active Orders', value: activeOrders.length, icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
    { label: "Today's Revenue", value: fmt(todayRevenue), icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
  ];

  const navItems = [
    { to: '/admin/new-order', label: 'New Order',       icon: PlusCircle,     desc: 'Place takeaway or dine-in order' },
    { to: '/admin/orders',  label: 'Live Orders',      icon: ClipboardList,  desc: 'Manage incoming orders' },
    { to: '/admin/bills',   label: 'Bills',            icon: Receipt,        desc: 'Table bills & takeaway receipts' },
    { to: '/admin/reports', label: 'Reports',          icon: BarChart2,      desc: 'Sales & item performance' },
    { to: '/admin/menu',    label: 'Menu Items',       icon: UtensilsCrossed, desc: 'Add, edit, delete items' },
    { to: '/admin/tables',  label: 'Tables & QR',      icon: Table2,         desc: 'Manage tables and QR codes' },
    { to: '/admin/rooms',   label: 'Rooms & QR',       icon: BedDouble,      desc: 'Manage rooms and QR codes' },
    { to: '/kitchen',       label: 'Kitchen Display',  icon: ChefHat,        desc: 'Live kitchen order view' },
    { to: '/admin/ready-display', label: 'Ready Display', icon: MonitorPlay,  desc: 'Show orders ready for pickup' },
    { to: '/admin/promo-codes', label: 'Promo Codes',  icon: Tag,            desc: 'Discount & promo codes' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 min-w-0 ${
                i === 2 ? 'col-span-2 sm:col-span-1' : 'sm:col-span-1'
              }`}
            >
              <div className={`inline-flex p-2 rounded-xl mb-2 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <p className="text-xl font-bold text-gray-900 truncate">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {gridView ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center gap-3 hover:border-orange-200 transition-colors"
              >
                <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                  <item.icon size={24} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:border-orange-200 transition-colors"
              >
                <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                  <item.icon size={22} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
