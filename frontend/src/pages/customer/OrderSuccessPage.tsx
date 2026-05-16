import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { StatusBadge } from '../../components/StatusBadge';

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const poll = () => {
      orderService.getOrder(orderId).then(setOrder).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [orderId]);

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
          <p className="text-gray-500 text-sm mt-1">Table {order.tableNumber}</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">Status</span>
          <StatusBadge status={order.status} />
        </div>

        <ul className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.quantity}× {item.name}
                {item.notes && <span className="text-gray-400 italic ml-1">({item.notes})</span>}
              </span>
              <span className="text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span>${order.totalAmount.toFixed(2)}</span>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
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
