import { useState } from 'react';
import type { Order, OrderStatus } from '../types';
import type { Waiter } from '../services/waiterService';
import { StatusBadge } from './StatusBadge';
import {
  Clock, ShoppingBag, Printer, BedDouble, UserCheck,
  CheckCircle2, Circle, MessageCircle, AlertTriangle,
  Star, Plus, X, MapPin,
} from 'lucide-react';
import { printService } from '../services/printService';
import toast from 'react-hot-toast';
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

export function OrderCard({
  order, onStatusChange, onAssignWaiter, onAddItems, onCancel,
  waiters, showActions = false, showPrint = false, showKitchenPrint = false,
  isNext = false, priority, hidePrices = false, prepTimeMap, clockMs,
}: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
  const nextStatus = currentIdx >= 0 ? STATUS_FLOW[currentIdx + 1] as OrderStatus | undefined : undefined;
  const { fmt } = useCurrency();

  const now = clockMs ?? Date.now();
  const ageMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60_000);
  const isStale = order.status === 'pending' && ageMins >= STALE_MINUTES;

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
    return { label: `${Math.ceil(remainMs / 60_000)}m`, over: false };
  }

  const [cooked, setCooked]               = useState<Set<number>>(new Set());
  const [confirmCancel, setConfirmCancel] = useState(false);

  function toggleItem(idx: number) {
    setCooked((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
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
    lines.push(`Total: ${fmt(order.totalAmount)}`, '', 'Thank you! 🙏');
    const text    = encodeURIComponent(lines.join('\n'));
    const raw     = order.customerPhone!.trim();
    const digits  = raw.replace(/\D/g, '');
    const e164    = raw.startsWith('+') ? digits : digits.startsWith('0') ? `94${digits.slice(1)}` : digits;
    return `https://wa.me/${e164}?text=${text}`;
  }

  async function handlePrint() {
    const result = await printService.receipt(order.id);
    if (!result.success) {
      const url = order.sessionId ? `/session-receipt/${order.sessionId}` : `/receipt/${order.id}`;
      window.open(url, '_blank', 'width=400,height=600');
    } else {
      toast.success('Receipt sent to printer');
    }
  }

  async function handleKitchenPrint() {
    const result = await printService.kitchen(order.id);
    if (!result.success) {
      window.open(`/kitchen-ticket/${order.id}`, '_blank', 'width=400,height=600');
    } else {
      toast.success('Sent to kitchen printer');
    }
  }

  // ── Derived label / colours ───────────────────────────────────────────────
  const priorityColor =
    priority === 1 ? 'bg-red-500 text-white'
    : priority === 2 ? 'bg-orange-400 text-white'
    : 'bg-gray-500 text-white';

  const locationLabel =
    order.orderType === 'takeaway'     ? (order.customerName || 'Takeaway')
    : order.orderType === 'room-service' ? `Room ${order.roomNumber}`
    : `Table ${order.tableNumber}`;

  const nextLabel =
    nextStatus === 'preparing' ? 'Mark As Preparing'
    : nextStatus === 'ready'   ? 'Mark As Ready'
    : nextStatus === 'complete' ? 'Mark As Complete'
    : nextStatus               ? `Mark As ${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)}`
    : order.status === 'ready' ? 'Mark As Complete'
    : null;

  const formattedTime = (() => {
    const d = new Date(order.createdAt);
    const isToday = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
    const time    = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date    = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return isToday ? time : `${date}, ${time}`;
  })();

  return (
    <div className={`bg-white rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${
      isStale ? 'border-2 border-red-400 shadow-sm' : 'border border-gray-200 shadow-sm'
    }`}>

      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">

        {/* Left: type chip + location name */}
        <div className="min-w-0 flex-1">
          {/* Type chip (takeaway / room-service only) */}
          {order.orderType === 'takeaway' && (
            <div className="flex items-center gap-1 mb-1">
              <ShoppingBag size={11} className="text-purple-500 shrink-0" />
              <span className="text-xs font-semibold text-purple-600 tracking-wide">Takeaway</span>
            </div>
          )}
          {order.orderType === 'room-service' && (
            <div className="flex items-center gap-1 mb-1">
              <BedDouble size={11} className="text-blue-500 shrink-0" />
              <span className="text-xs font-semibold text-blue-600 tracking-wide">Room Service</span>
            </div>
          )}
          {order.orderType === 'dine-in' && (
            <div className="flex items-center gap-1 mb-1">
              <MapPin size={11} className="text-orange-400 shrink-0" />
              <span className="text-xs font-semibold text-orange-500 tracking-wide">Dine-in</span>
            </div>
          )}

          {/* Location / name */}
          <div className="flex items-center gap-2">
            {priority != null && (
              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${priorityColor}`}>
                {priority}
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">{locationLabel}</h3>
          </div>

          {/* Assigned waiter inline badge */}
          {order.assignedWaiterName && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              <UserCheck size={10} />
              {order.assignedWaiterName}
            </span>
          )}
        </div>

        {/* Right: order# + status */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {order.orderNumber && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full tracking-wide">
              {order.orderNumber}
            </span>
          )}
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* ── Timestamp ────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
        <Clock size={12} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-400">{formattedTime}</span>
        {isNext && (
          <span className="text-xs font-bold text-red-500 uppercase tracking-wide ml-1">▶ Next up</span>
        )}
        {isStale && (
          <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full ml-auto animate-pulse">
            <AlertTriangle size={11} /> {ageMins}m — stalled
          </span>
        )}
      </div>

      {/* ── Items ────────────────────────────────────────────────────────── */}
      <ul className="px-4 pb-3 space-y-2">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineTotal     = (item.price + toppingsTotal) * item.quantity;
          const isDone        = cooked.has(idx);
          return (
            <li
              key={idx}
              className={`text-sm ${hidePrices ? 'cursor-pointer select-none active:opacity-60 transition-opacity' : ''}`}
              onClick={hidePrices ? () => toggleItem(idx) : undefined}
            >
              <div className="flex justify-between items-start gap-2">
                {/* Kitchen checkbox */}
                {hidePrices && (
                  <div className="shrink-0 mt-0.5">
                    {isDone
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <Circle size={16} className="text-gray-300" />}
                  </div>
                )}

                {/* Item name + modifiers */}
                <div className={`flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 transition-opacity ${isDone ? 'opacity-30 line-through' : ''}`}>
                  <span className="font-semibold text-gray-900">{item.quantity}×</span>
                  <span className="text-gray-800">{item.name}</span>
                  {item.size && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      item.size === 'large' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.size === 'large' ? 'L' : 'R'}
                    </span>
                  )}
                  {item.notes && (
                    <span className="text-gray-400 italic text-xs">({item.notes})</span>
                  )}
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
                </div>

                {/* Price */}
                {!hidePrices && (
                  <span className="text-gray-500 shrink-0 text-xs tabular-nums">{fmt(lineTotal)}</span>
                )}
              </div>

              {/* Toppings */}
              {(item.toppings ?? []).length > 0 && (
                <ul className={`mt-1 ml-6 space-y-0.5 transition-opacity ${isDone ? 'opacity-30' : ''}`}>
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

      {/* ── Waiter assignment ─────────────────────────────────────────────── */}
      {onAssignWaiter && waiters && waiters.length > 0 && (
        <div className="px-4 pb-3">
          <select
            value={order.assignedWaiterId ?? ''}
            onChange={(e) => onAssignWaiter(order.id, e.target.value || null)}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-gray-50 outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
          >
            <option value="">Assign waiter…</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Rating ────────────────────────────────────────────────────────── */}
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

      {/* ── Total row ────────────────────────────────────────────────────── */}
      {!hidePrices && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Total:</span>
          <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(order.totalAmount)}</span>
        </div>
      )}

      {/* Kitchen done counter */}
      {hidePrices && cooked.size > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            cooked.size === order.items.length ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
          }`}>
            {cooked.size}/{order.items.length} done
          </span>
        </div>
      )}

      {/* ── Actions footer ───────────────────────────────────────────────── */}
      {(showActions || showPrint || showKitchenPrint) && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">

          {/* Left: secondary text actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Add items */}
            {showActions && onAddItems && ['pending', 'preparing'].includes(order.status) && (
              <button
                onClick={() => onAddItems(order)}
                className="flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus size={14} /> Add Items
              </button>
            )}

            {/* Void / cancel */}
            {showActions && onCancel && order.status === 'pending' && (
              confirmCancel ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Void order?</span>
                  <button
                    onClick={() => { onCancel(order.id); setConfirmCancel(false); }}
                    className="px-2.5 py-1 bg-red-500 text-white text-xs rounded-lg font-bold hover:bg-red-600 active:scale-95 transition-all"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-200 transition-all"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="flex items-center gap-1 text-sm font-medium text-red-400 hover:text-red-600 transition-colors whitespace-nowrap"
                >
                  <X size={14} /> Void
                </button>
              )
            )}

            {/* WhatsApp bill */}
            {showActions && order.status === 'ready' && order.customerPhone && (
              <a
                href={buildBillWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-800 transition-colors"
              >
                <MessageCircle size={14} /> Send Bill
              </a>
            )}

            {/* Kitchen print */}
            {showKitchenPrint && (
              <button
                onClick={handleKitchenPrint}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Printer size={14} /> Kitchen
              </button>
            )}

            {/* Receipt print */}
            {showPrint && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Printer size={14} /> Print Bill
              </button>
            )}
          </div>

          {/* Right: primary CTA */}
          {showActions && onStatusChange && nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl font-semibold hover:bg-gray-700 active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <CheckCircle2 size={14} />
              {nextLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
