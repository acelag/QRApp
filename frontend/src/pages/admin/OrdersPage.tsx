import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';
import type { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/orderService';
import { waiterService, type Waiter } from '../../services/waiterService';
import { OrderCard } from '../../components/OrderCard';
import { AddItemsModal } from '../../components/AddItemsModal';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { PullToRefresh } from '../../components/PullToRefresh';


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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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

  async function handleRemoveItem(orderId: string, itemId: string) {
    try {
      const updated = await orderService.removeItem(orderId, itemId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  }

  async function handleUpdateItemQty(orderId: string, itemId: string, quantity: number) {
    try {
      const updated = await orderService.updateItem(orderId, itemId, quantity);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch {
      toast.error('Failed to update quantity');
    }
  }

  const filtered = tab === 'all'
    ? orders.filter((o) => o.status !== 'cancelled')
    : tab === 'takeaway'
    ? orders.filter((o) => o.orderType === 'takeaway' && o.status !== 'cancelled')
    : orders.filter((o) => o.status === tab);

  // Keep selected order valid when filter changes
  useEffect(() => {
    if (selectedOrderId && !filtered.find((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(filtered[0]?.id ?? null);
    } else if (!selectedOrderId && filtered.length > 0) {
      setSelectedOrderId(filtered[0].id);
    }
  }, [tab, filtered.length]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto md:overflow-hidden mt-14 md:mt-0 flex flex-col">
      <AdminHeader title={t('orders.title')} backTo="/admin">
        <button onClick={fetch} className="text-gray-400 hover:text-gray-600 shrink-0" title="Refresh">
          <RefreshCw size={18} />
        </button>
      </AdminHeader>
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-3 sm:px-4 lg:px-6 py-3 flex gap-2 overflow-x-auto">
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
      </div>

      {/* Mobile layout: full card grid */}
      <PullToRefresh onRefresh={fetch}>
      <div className="md:hidden px-3 sm:px-4 py-4">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 pt-12">{t('orders.noOrders')}</p>
        ) : (
          <div className="columns-1 sm:columns-2 gap-3">
            {filtered.map((order) => (
              <div key={order.id} className="break-inside-avoid mb-3">
                <OrderCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  onAssignWaiter={handleAssignWaiter}
                  onAddItems={setAddItemsOrder}
                  onCancel={handleCancel}
                  onRemoveItem={handleRemoveItem}
                  onUpdateItemQty={handleUpdateItemQty}
                  waiters={waiters}
                  showActions
                />
              </div>
            ))}
          </div>
        )}
      </div>
      </PullToRefresh>

      {/* Tablet+ split layout: compact list on left, detail on right */}
      <div className="hidden md:flex flex-1 min-h-0">
        {/* Compact order list */}
        <div className="w-72 lg:w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          <div className="px-3 py-3">
            {loading ? (
              <div className="flex justify-center pt-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-400 pt-12">{t('orders.noOrders')}</p>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                      selectedOrderId === order.id
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-transparent hover:bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {order.orderNumber ?? `#${order.id.slice(0, 6)}`}
                      </span>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                        order.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'ready'     ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-600'
                      }`}>{order.status}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      <span>
                        {order.orderType === 'takeaway' ? 'Takeaway' :
                         order.tableNumber ? `Table ${order.tableNumber}` :
                         order.roomNumber  ? `Room ${order.roomNumber}` : '—'}
                      </span>
                      {order.customerName && (
                        <span className="truncate">{order.customerName}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
          {selectedOrderId ? (
            (() => {
              const order = filtered.find((o) => o.id === selectedOrderId);
              if (!order) return <p className="text-gray-300 text-sm">Order not found</p>;
              return (
                <div className="max-w-lg">
                  <OrderCard
                    order={order}
                    onStatusChange={handleStatusChange}
                    onAssignWaiter={handleAssignWaiter}
                    onAddItems={setAddItemsOrder}
                    onCancel={handleCancel}
                    onRemoveItem={handleRemoveItem}
                    onUpdateItemQty={handleUpdateItemQty}
                    waiters={waiters}
                    showActions
                  />
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm">
              {filtered.length > 0 ? 'Select an order to view details' : ''}
            </div>
          )}
        </div>
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
