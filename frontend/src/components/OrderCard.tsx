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
  priority?: number;
  hidePrices?: boolean;
}

export function OrderCard({ order, onStatusChange, showActions = false, showPrint = false, isNext = false, priority, hidePrices = false }: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1] as OrderStatus | undefined;
  const { fmt } = useCurrency();

  function handlePrint() {
    const url = order.sessionId
      ? `/session-receipt/${order.sessionId}`
      : `/receipt/${order.id}`;
    window.open(url, '_blank', 'width=400,height=600');
  }

  const priorityColor = priority === 1
    ? 'bg-red-500 text-white'
    : priority === 2
    ? 'bg-orange-400 text-white'
    : 'bg-gray-500 text-white';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-gray-100 ${
        order.orderType === 'takeaway' ? 'bg-purple-50' : 'bg-orange-50'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {priority != null && (
            <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${priorityColor}`}>
              {priority}
            </span>
          )}
          {order.orderType === 'takeaway' ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <ShoppingBag size={14} className="text-purple-500 shrink-0" />
              <span className="font-bold text-purple-700 text-sm">Takeaway</span>
              {order.customerName && (
                <span className="text-gray-500 text-sm truncate">· {order.customerName}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-orange-500 shrink-0" />
              <span className="font-bold text-orange-700 text-sm">Table {order.tableNumber}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {order.orderNumber && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full tracking-wide">
              {order.orderNumber}
            </span>
          )}
          <StatusBadge status={order.status} />
          {showPrint && (
            <button onClick={handlePrint} title="Print Bill" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Printer size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Time + next up */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-2">
        <Clock size={12} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-400">
          {(() => {
            const d = new Date(order.createdAt);
            const isToday = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return isToday ? time : `${date}, ${time}`;
          })()}
        </span>
        {isNext && (
          <span className="text-xs font-bold text-red-500 uppercase tracking-wide ml-1">▶ Next up</span>
        )}
      </div>

      {/* Items */}
      <ul className="px-4 pb-3 space-y-2">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineTotal = (item.price + toppingsTotal) * item.quantity;
          return (
            <li key={idx} className="text-sm">
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-800 flex items-center gap-1.5 flex-wrap flex-1">
                  <span className="font-bold text-base text-gray-900">{item.quantity}×</span>
                  <span className="font-medium">{item.name}</span>
                  {item.size && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      item.size === 'large' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.size === 'large' ? 'L' : 'R'}
                    </span>
                  )}
                  {item.notes && <span className="text-gray-400 italic text-xs">({item.notes})</span>}
                </span>
                {!hidePrices && (
                  <span className="text-gray-500 shrink-0 text-xs tabular-nums">{fmt(lineTotal)}</span>
                )}
              </div>
              {(item.toppings ?? []).length > 0 && (
                <ul className="ml-6 mt-1 space-y-0.5">
                  {item.toppings!.map((t, ti) => (
                    <li key={ti} className="flex justify-between text-xs text-gray-400">
                      <span>+ {t.name}</span>
                      {!hidePrices && t.price > 0 && <span>+{fmt(t.price)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className={`px-4 py-3 border-t border-gray-100 flex items-center gap-2 ${hidePrices ? 'justify-end' : 'justify-between'}`}>
        {!hidePrices && (
          <span className="font-semibold text-gray-900 text-sm">Total: {fmt(order.totalAmount)}</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {showPrint && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Printer size={13} /> Print Bill
            </button>
          )}
          {showActions && onStatusChange && nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl font-bold hover:bg-orange-600 active:scale-95 transition-all capitalize whitespace-nowrap"
            >
              Mark as {nextStatus}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
