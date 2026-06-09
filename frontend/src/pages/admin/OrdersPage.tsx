import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { NotificationBell } from '../../components/NotificationBell';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { SoundAlertToggle } from '../../components/SoundAlertToggle';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';
import type { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/orderService';
import { waiterService, type Waiter } from '../../services/waiterService';
import { OrderCard } from '../../components/OrderCard';
import { AddItemsModal } from '../../components/AddItemsModal';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';


export function OrdersPage() {
  const { t } = useTranslation();

  const STATUS_TABS: { label: string; value: OrderStatus | 'all' | 'takeaway' }[] = [
    { label: t('orders.tabAll'),       value: 'all' },
    { label: t('orders.tabTakeaway'),  value: 'takeaway' },
    { label: t('orders.tabPending'),   value: 'pending' },
    { label: t('orders.tabPreparing'), value: 'preparing' },
    { label: t('orders.tabReady'),     value: 'ready' },
    { label: t('orders.tabCancelled'), value: 'cancelled' },
  ];

  const [orders, setOrders] = useState<Order[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [tab, setTab] = useState<OrderStatus | 'all' | 'takeaway'>('all');
  const [loading, setLoading] = useState(true);
  const [addItemsOrder, setAddItemsOrder] = useState<Order | null>(null);

  useOrderSoundAlert(orders);

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
    waiterService.getWaiters().then(setWaiters).catch(() => {});
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleStatusChange(id: string, status: OrderStatus) {
    try {
      const updated = await orderService.updateStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      toast.success(t('orders.statusUpdated', { status }));
    } catch {
      toast.error(t('orders.statusFailed'));
    }
  }

  async function handleAssignWaiter(id: string, waiterId: string | null) {
    try {
      const updated = await orderService.assignWaiter(id, waiterId);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      const w = waiters.find((x) => x.id === waiterId);
      toast.success(w ? t('orders.assignedTo', { name: w.name }) : t('orders.waiterUnassigned'));
    } catch {
      toast.error(t('orders.assignFailed'));
    }
  }

  async function handleCancel(id: string) {
    try {
      const updated = await orderService.cancelOrder(id);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      toast.success(t('orders.orderVoided'));
    } catch {
      toast.error(t('orders.cancelFailed'));
    }
  }

  function handleAddItemsDone(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setAddItemsOrder(null);
  }

  const filtered = tab === 'all'
    ? orders.filter((o) => o.status !== 'cancelled')
    : tab === 'takeaway'
    ? orders.filter((o) => o.orderType === 'takeaway' && o.status !== 'cancelled')
    : orders.filter((o) => o.status === tab);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">{t('orders.title')}</h1>
          <LanguageSwitcher variant="select" className="shrink-0" />
          <SoundAlertToggle />
          <NotificationBell />
          <button onClick={fetch} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((t) => {
            const count = t.value === 'all' ? null
              : t.value === 'takeaway' ? orders.filter((o) => o.orderType === 'takeaway' && o.status !== 'cancelled').length
              : orders.filter((o) => o.status === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === t.value
                    ? t.value === 'takeaway' ? 'bg-purple-600 text-white'
                      : t.value === 'cancelled' ? 'bg-red-500 text-white'
                      : 'bg-orange-500 text-white'
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

      <div className="px-3 sm:px-4 lg:px-6 py-4">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 pt-12">{t('orders.noOrders')}</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
            {filtered.map((order) => (
              <div key={order.id} className="break-inside-avoid mb-3 lg:mb-4">
                <OrderCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  onAssignWaiter={handleAssignWaiter}
                  onAddItems={setAddItemsOrder}
                  onCancel={handleCancel}
                  waiters={waiters}
                  showActions
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {addItemsOrder && (
        <AddItemsModal
          order={addItemsOrder}
          onClose={() => setAddItemsOrder(null)}
          onDone={handleAddItemsDone}
        />
      )}
      </main>
    </div>
  );
}
