import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { NotificationBell } from '../../components/NotificationBell';
import type { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/OrderCard';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export function KitchenPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  const fetch = () =>
    orderService
      .getOrders()
      .then((data) =>
        setOrders(
          data
            .filter((o) => o.status === 'pending' || o.status === 'preparing')
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        )
      )
      .catch(() => {});

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 4000);
    return () => clearInterval(id);
  }, []);

  async function handleStatusChange(id: string, status: OrderStatus) {
    try {
      const updated = await orderService.updateStatus(id, status);
      setOrders((prev) =>
        prev
          .map((o) => (o.id === id ? updated : o))
          .filter((o) => o.status === 'pending' || o.status === 'preparing')
      );
      toast.success(`Order marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0 z-40">
        <Link to="/admin" className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold flex-1">Kitchen Display</h1>
        <span className="text-sm text-gray-400 mr-2">{user?.name}</span>
        <NotificationBell theme="dark" />
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-gray-500">
            <p className="text-2xl">👨‍🍳</p>
            <p className="mt-2">No active orders</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-2xl overflow-hidden">
                <OrderCard order={order} onStatusChange={handleStatusChange} showActions />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
