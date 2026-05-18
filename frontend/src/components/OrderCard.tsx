import type { Order, OrderStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Clock, MapPin, ShoppingBag, Printer } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const STATUS_FLOW: OrderStatus[] = ['pending', 'preparing', 'ready', 'served'];

interface Props {
  order: Order;
  onStatusChange?: (id: string, status: OrderStatus) => void;
  showActions?: boolean;
  showPrint?: boolean;
  isNext?: boolean;
}

export function OrderCard({ order, onStatusChange, showActions = false, showPrint = false, isNext = false }: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1] as OrderStatus | undefined;
  const { fmt } = useCurrency();

  function handlePrint() {
    const url = order.sessionId
      ? `/session-receipt/${order.sessionId}`
      : `/receipt/${order.id}`;
    window.open(url, '_blank', 'width=400,height=600');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      {order.orderNumber && (
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide">
            {order.orderNumber}
          </span>
          {isNext && (
            <span className="text-xs font-semibold text-orange-500">Next up</span>
          )}
        </div>
      )}
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
            <span>
              {(() => {
                const d = new Date(order.createdAt);
                const isToday = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
                const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                return isToday ? time : `${date}, ${time}`;
              })()}
            </span>
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

      <ul className="space-y-2 mb-3">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineTotal = (item.price + toppingsTotal) * item.quantity;
          return (
            <li key={idx} className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{item.quantity}×</span>
                  {item.name}
                  {item.size && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.size === 'large' ? 'L' : 'R'}
                    </span>
                  )}
                  {item.notes && <span className="text-gray-400 italic">({item.notes})</span>}
                </span>
                <span className="text-gray-600 shrink-0 ml-2">{fmt(lineTotal)}</span>
              </div>
              {(item.toppings ?? []).length > 0 && (
                <ul className="ml-6 mt-0.5 space-y-0.5">
                  {item.toppings!.map((t, ti) => (
                    <li key={ti} className="flex justify-between text-xs text-gray-400">
                      <span>+ {t.name}</span>
                      {t.price > 0 && <span>+{fmt(t.price)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-gray-100">
        <span className="font-semibold text-gray-900">Total: {fmt(order.totalAmount)}</span>
        <div className="flex items-center gap-2 justify-end shrink-0">
          {showPrint && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Printer size={13} />
              Print Bill
            </button>
          )}
          {showActions && onStatusChange && nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-full font-medium hover:bg-orange-600 transition-colors capitalize whitespace-nowrap"
            >
              Mark as {nextStatus}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
