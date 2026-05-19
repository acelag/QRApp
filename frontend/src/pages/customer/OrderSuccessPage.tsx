import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, RotateCcw, Clock } from 'lucide-react';
import type { Order } from '../../types';
import type { CartItem } from '../../types/Order';
import { orderService } from '../../services/orderService';
import { restaurantService } from '../../services/restaurantService';
import { StatusBadge } from '../../components/StatusBadge';
import { useCurrency } from '../../context/CurrencyContext';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const { fmt } = useCurrency();
  const { bulkAdd } = useCart();

  useEffect(() => {
    if (!orderId) return;
    const poll = () => {
      orderService.getOrder(orderId).then((o) => {
        setOrder(o);
        // Fetch wait time once we have the restaurantId
        if (o.restaurantId) {
          restaurantService.getRestaurantInfo(o.restaurantId)
            .then((info) => setWaitTimeMin(info.waitTimeMin))
            .catch(() => {});
        }
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [orderId]);

  function handleReorder() {
    if (!order) return;
    const items: CartItem[] = order.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      notes: i.notes,
      size: i.size,
      toppings: i.toppings,
    }));

    if (order.orderType === 'dine-in' && order.tableId) {
      bulkAdd(items);
      toast.success('Items added to your cart!');
      navigate(`/menu/${order.tableId}`);
    } else if (order.orderType === 'takeaway' && order.restaurantId) {
      navigate(`/takeaway/${order.restaurantId}`, { state: { reorderItems: items } });
    } else if (order.orderType === 'room-service' && order.roomId) {
      navigate(`/room/${order.roomId}`, { state: { reorderItems: items } });
    } else {
      toast.error('Cannot reorder — original order details unavailable');
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-16 px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <CheckCircle className="text-green-500 mb-3" size={56} />
          <h1 className="text-2xl font-bold text-gray-900">Order Placed!</h1>
          <p className="text-gray-500 text-sm mt-1">
            {order.orderType === 'room-service'
              ? `Room ${order.roomNumber}`
              : order.orderType === 'takeaway'
              ? order.customerName ?? 'Takeaway'
              : `Table ${order.tableNumber}`}
          </p>
        </div>

        {/* Wait time banner */}
        {waitTimeMin && order.status === 'pending' && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4">
            <Clock size={16} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Est. wait: ~{waitTimeMin} min</p>
              <p className="text-xs text-amber-500">We'll get started on your order shortly</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">Status</span>
          <StatusBadge status={order.status} />
        </div>

        <ul className="space-y-2 mb-4">
          {order.items.map((item, idx) => {
            const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
            return (
              <li key={idx} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                    {item.quantity}× {item.name}
                    {item.size && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {item.size === 'large' ? 'Large' : 'Regular'}
                      </span>
                    )}
                    {item.notes && <span className="text-gray-400 italic">({item.notes})</span>}
                  </span>
                  <span className="text-gray-600 shrink-0 ml-2">{fmt((item.price + toppingsTotal) * item.quantity)}</span>
                </div>
                {(item.toppings ?? []).length > 0 && (
                  <ul className="ml-6 mt-0.5 space-y-0.5">
                    {item.toppings!.map((t, ti) => (
                      <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-t border-gray-100 pt-3 space-y-1 mb-5">
          {(order.discountAmount ?? 0) > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(order.totalAmount + (order.discountAmount ?? 0))}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Discount {order.promoCode ? `(${order.promoCode})` : ''}</span>
                <span>−{fmt(order.discountAmount ?? 0)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{fmt(order.totalAmount)}</span>
          </div>
        </div>

        {/* Order Again */}
        <button
          onClick={handleReorder}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors mb-3"
        >
          <RotateCcw size={16} /> Order Again
        </button>

        <p className="text-center text-xs text-gray-400">
          This page refreshes automatically every 5 seconds
        </p>

        {order.tableId && (
          <Link
            to={`/order-history/${order.tableId}`}
            className="mt-2 block text-center text-sm text-orange-500 font-medium hover:underline"
          >
            View all my orders →
          </Link>
        )}
      </div>
    </div>
  );
}
