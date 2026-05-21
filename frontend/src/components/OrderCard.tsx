import { useState } from 'react';
import type { Order, OrderStatus } from '../types';
import type { Waiter } from '../services/waiterService';
import { StatusBadge } from './StatusBadge';
import { Clock, MapPin, ShoppingBag, Printer, BedDouble, UserCheck, CheckCircle2, Circle, MessageCircle, AlertTriangle, Star, PlusCircle, XCircle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const STATUS_FLOW: OrderStatus[] = ['pending', 'preparing', 'ready'];
const STALE_MINUTES = 30;

interface Props {
  order: Order;
  onStatusChange?: (id: string, status: OrderStatus) => void;
  onAssignWaiter?: (id: string, waiterId: string | null) => void;
  onAddItems?: (order: Order) => void;
  onCancel?: (id: string) => void;
  waiters?: Waiter[];
  showActions?: boolean;
  showPrint?: boolean;
  showKitchenPrint?: boolean;
  isNext?: boolean;
  priority?: number;
  hidePrices?: boolean;
  /** Map of menuItem name → prepTimeMins (used in kitchen mode) */
  prepTimeMap?: Record<string, number>;
  /** Current epoch ms — passed from parent so all cards tick in sync */
  clockMs?: number;
}

export function OrderCard({ order, onStatusChange, onAssignWaiter, onAddItems, onCancel, waiters, showActions = false, showPrint = false, showKitchenPrint = false, isNext = false, priority, hidePrices = false, prepTimeMap, clockMs }: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
  // currentIdx === -1 for legacy 'served' orders — treat them as terminal (no next step)
  const nextStatus = currentIdx >= 0 ? STATUS_FLOW[currentIdx + 1] as OrderStatus | undefined : undefined;
  const { fmt } = useCurrency();

  const now = clockMs ?? Date.now();
  const ageMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60_000);
  const isStale = order.status === 'pending' && ageMins >= STALE_MINUTES;

  /** Returns a countdown string for a given item name, or null if no prep time set */
  function itemCountdown(itemName: string): { label: string; over: boolean } | null {
    if (!prepTimeMap || !clockMs) return null;
    const prepMins = prepTimeMap[itemName];
    if (!prepMins) return null;
    const elapsedMs = now - new Date(order.createdAt).getTime();
    const remainMs  = prepMins * 60_000 - elapsedMs;
    if (remainMs <= 0) {
      const overMins = Math.floor(-remainMs / 60_000);
      return { label: overMins > 0 ? `+${overMins}m` : 'due!', over: true };
    }
    const remMins = Math.ceil(remainMs / 60_000);
    return { label: `${remMins}m`, over: false };
  }

  const [cooked, setCooked] = useState<Set<number>>(new Set());
  const [confirmCancel, setConfirmCancel] = useState(false);

  function toggleItem(idx: number) {
    setCooked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function buildBillWhatsAppUrl(): string {
    const lines: string[] = [
      `🧾 Bill — #${order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}`,
      '',
      ...order.items.map((i) => {
        const toppingsTotal = (i.toppings ?? []).reduce((s, t) => s + t.price, 0);
        return `• ${i.quantity}× ${i.name} — ${fmt((i.price + toppingsTotal) * i.quantity)}`;
      }),
      '',
    ];
    if ((order.discountAmount ?? 0) > 0) {
      lines.push(`Subtotal: ${fmt(order.totalAmount + (order.discountAmount ?? 0))}`);
      lines.push(`Discount: -${fmt(order.discountAmount ?? 0)}`);
    }
    lines.push(`Total: ${fmt(order.totalAmount)}`);
    lines.push('', 'Thank you! 🙏');
    const text = encodeURIComponent(lines.join('\n'));
    const raw = order.customerPhone!.trim();
    const digits = raw.replace(/\D/g, '');
    const e164 = raw.startsWith('+') ? digits : digits.startsWith('0') ? `94${digits.slice(1)}` : digits;
    return `https://wa.me/${e164}?text=${text}`;
  }

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
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-colors ${
      isStale ? 'border-2 border-red-400' : 'border border-gray-100'
    }`}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-gray-100 ${
        order.orderType === 'takeaway' ? 'bg-purple-50'
        : order.orderType === 'room-service' ? 'bg-blue-50'
        : 'bg-orange-50'
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
          ) : order.orderType === 'room-service' ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <BedDouble size={14} className="text-blue-500 shrink-0" />
              <span className="font-bold text-blue-700 text-sm">Room {order.roomNumber}</span>
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {order.assignedWaiterName && (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              <UserCheck size={11} />
              {order.assignedWaiterName}
            </span>
          )}
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
        {isStale && (
          <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full ml-auto animate-pulse">
            <AlertTriangle size={11} /> {ageMins}m — stalled
          </span>
        )}
      </div>

      {/* Items */}
      <ul className="px-4 pb-3 space-y-2">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineTotal = (item.price + toppingsTotal) * item.quantity;
          const isDone = cooked.has(idx);
          return (
            <li
              key={idx}
              className={`text-sm ${hidePrices ? 'cursor-pointer select-none active:opacity-60 transition-opacity' : ''}`}
              onClick={hidePrices ? () => toggleItem(idx) : undefined}
            >
              <div className="flex justify-between items-start gap-2">
                {hidePrices && (
                  <div className="shrink-0 mt-0.5">
                    {isDone
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <Circle size={16} className="text-gray-300" />}
                  </div>
                )}
                <span className={`text-gray-800 flex items-center gap-1.5 flex-wrap flex-1 transition-opacity ${isDone ? 'opacity-35 line-through' : ''}`}>
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
                  {hidePrices && (() => {
                    const cd = itemCountdown(item.name);
                    if (!cd) return null;
                    return (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        cd.over ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'
                      }`}>
                        ⏱ {cd.label}
                      </span>
                    );
                  })()}
                </span>
                {!hidePrices && (
                  <span className="text-gray-500 shrink-0 text-xs tabular-nums">{fmt(lineTotal)}</span>
                )}
              </div>
              {(item.toppings ?? []).length > 0 && (
                <ul className={`mt-1 space-y-0.5 transition-opacity ${hidePrices ? 'ml-6' : 'ml-6'} ${isDone ? 'opacity-35' : ''}`}>
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

      {/* Waiter assignment */}
      {onAssignWaiter && waiters && waiters.length > 0 && (
        <div className="px-4 pb-3">
          <select
            value={order.assignedWaiterId ?? ''}
            onChange={(e) => onAssignWaiter(order.id, e.target.value || null)}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-600 bg-white outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
          >
            <option value="">Assign waiter…</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Customer rating */}
      {order.rating != null && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((s) => (
              <Star key={s} size={13} className={order.rating! >= s ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
            ))}
          </div>
          {order.feedbackNote && (
            <span className="text-xs text-gray-500 italic truncate">"{order.feedbackNote}"</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className={`px-4 py-3 border-t border-gray-100 flex items-center gap-2 ${hidePrices ? 'justify-between' : 'justify-between'}`}>
        {!hidePrices && (
          <span className="font-semibold text-gray-900 text-sm">Total: {fmt(order.totalAmount)}</span>
        )}
        {hidePrices && cooked.size > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            cooked.size === order.items.length
              ? 'bg-green-100 text-green-700'
              : 'bg-orange-100 text-orange-600'
          }`}>
            {cooked.size}/{order.items.length} done
          </span>
        )}
        {hidePrices && cooked.size === 0 && <span />}
        <div className="flex items-center gap-2 shrink-0">
          {showKitchenPrint && (
            <button
              onClick={() => window.open(`/kitchen-ticket/${order.id}`, '_blank', 'width=400,height=600')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
              title="Print kitchen ticket"
            >
              <Printer size={13} /> Kitchen
            </button>
          )}
          {showPrint && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Printer size={13} /> Print Bill
            </button>
          )}
          {showActions && order.status === 'ready' && order.customerPhone && (
            <a
              href={buildBillWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm rounded-full font-medium hover:bg-green-600 transition-colors whitespace-nowrap"
            >
              <MessageCircle size={13} /> Send Bill
            </a>
          )}
          {showActions && onAddItems && ['pending', 'preparing'].includes(order.status) && (
            <button
              onClick={() => onAddItems(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 text-sm rounded-full font-medium hover:bg-orange-50 transition-colors whitespace-nowrap"
              title="Add items to this order"
            >
              <PlusCircle size={13} /> Add Items
            </button>
          )}
          {showActions && onCancel && order.status === 'pending' && (
            confirmCancel ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-600 font-medium">Void order?</span>
                <button
                  onClick={() => { onCancel(order.id); setConfirmCancel(false); }}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-full font-bold hover:bg-red-600 active:scale-95 transition-all"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium hover:bg-gray-200 transition-all"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-sm rounded-full font-medium hover:bg-red-50 transition-colors whitespace-nowrap"
                title="Void / cancel this order"
              >
                <XCircle size={13} /> Void
              </button>
            )
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
