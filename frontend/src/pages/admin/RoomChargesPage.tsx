import { useEffect, useState } from 'react';
import { BedDouble, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { PaymentMethodModal, paymentMethodLabel, type PaymentMethod } from '../../components/PaymentMethodModal';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

export function RoomChargesPage() {
  const { fmt } = useCurrency();
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [settling, setSettling]     = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const all = await orderService.getOrders();
      setOrders(all.filter((o) => o.paymentMethod === 'room-charge'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 8000);
    return () => clearInterval(id);
  }, []);

  async function handleSettle(order: Order, method: string) {
    try {
      const updated = await orderService.settleRoomCharge(order.id, method);
      setOrders((prev) => prev.filter((o) => o.id !== updated.id));
      toast.success(`Room ${order.roomNumber} charge settled (${paymentMethodLabel(method)})`);
    } catch {
      toast.error('Failed to settle charge');
    }
    setSettling(null);
  }

  // Group by room number
  const byRoom = orders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = String(o.roomNumber ?? 'Unknown');
    (acc[key] ??= []).push(o);
    return acc;
  }, {});

  const rooms = Object.entries(byRoom).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      <AdminHeader title="Room Charges" backTo="/admin">
        <button onClick={fetchOrders} className="text-gray-400 hover:text-gray-600">
          <RefreshCw size={18} />
        </button>
      </AdminHeader>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center pt-16">
            <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">All clear!</p>
            <p className="text-sm text-gray-400 mt-1">No pending room charges</p>
          </div>
        ) : (
          rooms.map(([roomNum, roomOrders]) => {
            const total = roomOrders.reduce((s, o) => s + o.totalAmount, 0);
            return (
              <div key={roomNum} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Room header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 border-b border-blue-100">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <BedDouble size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-blue-900">Room {roomNum}</p>
                    <p className="text-xs text-blue-600">{roomOrders.length} order{roomOrders.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-900">{fmt(total)}</p>
                    <p className="text-xs text-blue-500">total pending</p>
                  </div>
                </div>

                {/* Orders */}
                <div className="divide-y divide-gray-50">
                  {roomOrders.map((order) => (
                    <div key={order.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {order.orderNumber ?? order.id.slice(0, 8)}
                            <span className="ml-2 text-xs font-normal text-gray-400 capitalize">{order.status}</span>
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {order.items.map((item, i) => (
                              <li key={i} className="text-xs text-gray-500">
                                {item.quantity}Ã— {item.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-800">{fmt(order.totalAmount)}</p>
                          <button
                            onClick={() => setSettling(order)}
                            className="mt-1.5 text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium hover:bg-blue-700 transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Settle all button */}
                {roomOrders.length > 1 && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Settle all {roomOrders.length} orders for Room {roomNum}:</p>
                    <div className="flex gap-2 flex-wrap">
                      {['cash', 'card', 'online'].map((method) => (
                          <button
                            key={method}
                            onClick={async () => {
                              for (const o of roomOrders) await handleSettle(o, method);
                            }}
                            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl font-medium hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            {paymentMethodLabel(method)}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Settle modal for a single order */}
      {settling && (
        <PaymentMethodModal
          title={`Settle â€” ${settling.orderNumber ?? settling.id.slice(0, 8)}`}
          subtitle={`Room ${settling.roomNumber} Â· ${fmt(settling.totalAmount)}`}
          onConfirm={(method: PaymentMethod) => handleSettle(settling, method)}
          onClose={() => setSettling(null)}
        />
      )}
      </main>
    </div>
  );
}
