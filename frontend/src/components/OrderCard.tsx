import type { Order, OrderStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Clock, MapPin, ShoppingBag, Printer } from 'lucide-react';

const STATUS_FLOW: OrderStatus[] = ['pending', 'preparing', 'ready', 'served'];

interface Props {
  order: Order;
  onStatusChange?: (id: string, status: OrderStatus) => void;
  showActions?: boolean;
  showPrint?: boolean;
}

export function OrderCard({ order, onStatusChange, showActions = false, showPrint = false }: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1] as OrderStatus | undefined;

  function handlePrint() {
    const url = order.sessionId
      ? `/session-receipt/${order.sessionId}`
      : `/receipt/${order.id}`;
    window.open(url, '_blank', 'width=400,height=600');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {order.orderType === 'takeaway' ? (
              <>
                <ShoppingBag size={14} className="text-purple-500" />
                <span className="font-semibold text-purple-600">Takeaway</span>
                {order.customerName && (
                  <span className="text-gray-500">· {order.customerName}</span>
                )}
              </>
            ) : (
              <>
                <MapPin size={14} />
                <span>Table {order.tableNumber}</span>
              </>
            )}
            <Clock size={14} className="ml-1" />
            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">#{order.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          {showPrint && (
            <button
              onClick={handlePrint}
              title="Print Bill"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Printer size={15} />
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-1.5 mb-3">
        {order.items.map((item, idx) => (
          <li key={idx} className="flex justify-between text-sm">
            <span className="text-gray-700">
              <span className="font-medium">{item.quantity}×</span> {item.name}
              {item.notes && <span className="text-gray-400 italic ml-1">({item.notes})</span>}
            </span>
            <span className="text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="font-semibold text-gray-900">Total: ${order.totalAmount.toFixed(2)}</span>
        <div className="flex items-center gap-2">
          {showPrint && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-full font-medium hover:bg-gray-50 transition-colors"
            >
              <Printer size={13} />
              Print Bill
            </button>
          )}
          {showActions && onStatusChange && nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-full font-medium hover:bg-orange-600 transition-colors capitalize"
            >
              Mark as {nextStatus}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
