import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, Table2, TrendingUp, ChefHat, LogOut, Settings, Receipt, BarChart2 } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { useAuth } from '../../context/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  useEffect(() => {
    const fetch = () => orderService.getOrders().then(setOrders).catch(() => {});
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).toDateString() === new Date().toDateString()
  );
  const activeOrders = orders.filter((o) => o.status !== 'served');
  const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

  const stats = [
    { label: "Today's Orders", value: todayOrders.length, icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Orders', value: activeOrders.length, icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
    { label: "Today's Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
  ];

  const navItems = [
    { to: '/admin/orders',  label: 'Live Orders',      icon: ClipboardList,  desc: 'Manage incoming orders' },
    { to: '/admin/bills',   label: 'Table Bills',      icon: Receipt,        desc: 'View bills & mark as paid' },
    { to: '/admin/reports', label: 'Reports',          icon: BarChart2,      desc: 'Sales & item performance' },
    { to: '/admin/menu',    label: 'Menu Items',       icon: UtensilsCrossed, desc: 'Add, edit, delete items' },
    { to: '/admin/tables',  label: 'Tables & QR',      icon: Table2,         desc: 'Manage tables and QR codes' },
    { to: '/kitchen',       label: 'Kitchen Display',  icon: ChefHat,        desc: 'Live kitchen order view' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-1">
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

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className={`inline-flex p-2 rounded-xl mb-2 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3">
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
      </main>
    </div>
  );
}
