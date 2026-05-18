import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShoppingBag } from 'lucide-react';
import { NotificationBell } from '../../components/NotificationBell';
import type { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/OrderCard';
import toast from 'react-hot-toast';

const STATUS_TABS: { label: string; value: OrderStatus | 'all' | 'takeaway' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Takeaway',  value: 'takeaway' },
  { label: 'Pending',   value: 'pending' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready',     value: 'ready' },
  { label: 'Served',    value: 'served' },
];

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<OrderStatus | 'all' | 'takeaway'>('all');
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const data = await orderService.getOrders();
      setOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleStatusChange(id: string, status: OrderStatus) {
    try {
      const updated = await orderService.updateStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      toast.success(`Order marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  }


  const filtered = tab === 'all'
    ? orders
    : tab === 'takeaway'
    ? orders.filter((o) => o.orderType === 'takeaway')
    : orders.filter((o) => o.status === tab);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Live Orders</h1>
          <Link
            to="/admin/takeaway"
            className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full font-medium hover:bg-purple-700 transition-colors"
          >
            <ShoppingBag size={13} /> Takeaway
          </Link>
          <NotificationBell />
          <button onClick={fetch} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((t) => {
            const count = t.value === 'all' ? null
              : t.value === 'takeaway' ? orders.filter((o) => o.orderType === 'takeaway').length
              : orders.filter((o) => o.status === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === t.value
                    ? t.value === 'takeaway' ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {count !== null && <span className="ml-1 text-xs opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-3 sm:px-4 lg:px-6 py-4">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 pt-12">No orders</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
            {filtered.map((order) => (
              <div key={order.id} className="break-inside-avoid mb-3 lg:mb-4">
                <OrderCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  showActions
                  showPrint
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
