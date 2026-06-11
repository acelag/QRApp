import { useState } from 'react';
import type { Order, OrderStatus } from '../types';
import type { Waiter } from '../services/waiterService';
import { Clock, MapPin, ShoppingBag, Printer, BedDouble, UserCheck, CheckCircle2, Circle, MessageCircle, AlertTriangle, Star, PlusCircle, XCircle, Minus, Plus, Trash2, User, ClipboardCheck, Hourglass, Zap, PackageCheck } from 'lucide-react';
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
  onRemoveItem?: (orderId: string, itemId: string) => void;
  onUpdateItemQty?: (orderId: string, itemId: string, quantity: number) => void;
  waiters?: Waiter[];
  showActions?: boolean;
  showPrint?: boolean;
  showKitchenPrint?: boolean;
  isNext?: boolean;
  priority?: number;
  hidePrices?: boolean;
  prepTimeMap?: Record<string, number>;
  clockMs?: number;
}

export function OrderCard({ order, onStatusChange, onAssignWaiter, onAddItems, onCancel, onRemoveItem, onUpdateItemQty, waiters, showActions = false, showPrint = false, showKitchenPrint = false, isNext = false, priority, hidePrices = false, prepTimeMap, clockMs }: Props) {
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

  const [cooked, setCooked] = useState<Set<number>>(new Set());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  const isEditable = showActions && ['pending', 'preparing'].includes(order.status) && (onRemoveItem || onUpdateItemQty);

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

  async function handlePrint() {
    const result = await printService.receipt(order.id);
    if (result.success) {
      toast.success('Receipt sent to printer');
    } else {
      const url = order.sessionId ? `/session-receipt/${order.sessionId}` : `/receipt/${order.id}`;
      window.open(url, '_blank', 'width=400,height=600');
    }
  }

  async function handleKitchenPrint() {
    const result = await printService.kitchen(order.id);
    if (result.success) {
      toast.success('Sent to kitchen printer');
    } else {
      window.open(`/kitchen-ticket/${order.id}`, '_blank', 'width=400,height=600');
    }
  }

  const formatAge = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ${mins % 60}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  };

  const d = new Date(order.createdAt);
  const isToday = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = isToday ? timeStr : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;

  // Per-type theming
  const theme = order.orderType === 'takeaway'
    ? { bg: 'bg-purple-50',  iconBg: 'bg-purple-100', text: 'text-purple-700', Icon: ShoppingBag, label: 'Takeaway' }
    : order.orderType === 'room-service'
    ? { bg: 'bg-blue-50',    iconBg: 'bg-blue-100',   text: 'text-blue-700',   Icon: BedDouble,   label: `Room ${order.roomNumber}` }
    : { bg: 'bg-orange-50',  iconBg: 'bg-orange-100', text: 'text-orange-700', Icon: MapPin,       label: `Table ${order.tableNumber}` };
  const TypeIcon = theme.Icon;

  // Status badge config
  const statusConfig: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',   Icon: Hourglass   },
    preparing: { label: 'Preparing', cls: 'bg-orange-100 text-orange-700', Icon: Zap         },
    ready:     { label: 'Ready',     cls: 'bg-green-100 text-green-700',   Icon: PackageCheck },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600',       Icon: XCircle     },
  };
  const sc = statusConfig[order.status] ?? statusConfig['pending'];
  const StatusIcon = sc.Icon;

  // Next status button label/color
  const nextBtnConfig: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    preparing: { label: 'Mark As Preparing', cls: 'bg-emerald-700 hover:bg-emerald-800', Icon: ClipboardCheck },
    ready:     { label: 'Mark As Ready',     cls: 'bg-green-600 hover:bg-green-700',     Icon: PackageCheck   },
  };
  const nbc = nextStatus ? nextBtnConfig[nextStatus] : null;
  const NextIcon = nbc?.Icon ?? ClipboardCheck;

  return (
    <div className={`${theme.bg} rounded-3xl p-4 space-y-3`}>

      {/* ── Top row: type + status ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {priority != null && (
            <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              priority === 1 ? 'bg-red-500 text-white' : priority === 2 ? 'bg-orange-400 text-white' : 'bg-gray-400 text-white'
            }`}>{priority}</span>
          )}
          <div className={`w-10 h-10 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
            <TypeIcon size={20} className={theme.text} />
          </div>
          <div className="min-w-0">
            <p className={`font-bold text-xl leading-tight ${theme.text}`}>{theme.label}</p>
            {order.customerName && order.orderType !== 'dine-in' && (
              <p className="text-xs text-gray-500 truncate">{order.customerName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${sc.cls}`}>
            <StatusIcon size={14} /> {sc.label}
          </span>
          {showPrint && (
            <button onClick={handlePrint} title="Print Bill" className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors">
              <Printer size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Order # + date + stalled ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {order.orderNumber && (
            <span className="font-mono font-bold text-sm text-gray-800 bg-white/80 px-3 py-1 rounded-full shadow-sm">
              #{order.orderNumber}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {dateStr}
          </span>
        </div>
        {order.assignedWaiterName && (
          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <UserCheck size={11} /> {order.assignedWaiterName}
          </span>
        )}
        {isNext && (
          <span className="text-xs font-bold text-red-500 uppercase tracking-wide">▶ Next up</span>
        )}
      </div>
      {isStale && (
        <div className="flex justify-end">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-100 px-3 py-1.5 rounded-full animate-pulse">
            <AlertTriangle size={14} /> {formatAge(ageMins)} stalled
          </span>
        </div>
      )}

      {/* ── Items ── */}
      <div className="bg-white rounded-2xl overflow-hidden">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineTotal = (item.price + toppingsTotal) * item.quantity;
          const isDone = cooked.has(idx);
          return (
            <div
              key={idx}
              className={`px-4 py-3 ${idx < order.items.length - 1 ? 'border-b border-dashed border-gray-200' : ''} ${hidePrices ? 'cursor-pointer select-none' : ''}`}
              onClick={hidePrices ? () => toggleItem(idx) : undefined}
            >
              <div className="flex items-center gap-2">
                {hidePrices && (
                  <div className="shrink-0">
                    {isDone ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
                  </div>
                )}
                {/* Qty controls */}
                {isEditable && item.id ? (
                  confirmRemoveIdx === idx ? (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-red-600 font-medium">Remove?</span>
                      <button onClick={() => { onRemoveItem!(order.id, item.id!); setConfirmRemoveIdx(null); }} className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">Yes</button>
                      <button onClick={() => setConfirmRemoveIdx(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { if (item.quantity <= 1) setConfirmRemoveIdx(idx); else onUpdateItemQty!(order.id, item.id!, item.quantity - 1); }}
                        className="w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                      ><Minus size={12} /></button>
                      <span className="w-8 text-center font-bold text-sm text-gray-700 bg-green-50 rounded-lg py-0.5">{item.quantity}×</span>
                      <button
                        onClick={() => onUpdateItemQty!(order.id, item.id!, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                      ><Plus size={12} /></button>
                      <button
                        onClick={() => setConfirmRemoveIdx(idx)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      ><Trash2 size={12} /></button>
                    </div>
                  )
                ) : (
                  <span className="font-bold text-sm text-gray-700 bg-gray-100 rounded-lg px-2 py-0.5 tabular-nums shrink-0">{item.quantity}×</span>
                )}

                <span className={`flex-1 font-semibold text-gray-900 text-sm ${isDone ? 'line-through opacity-40' : ''}`}>
                  {item.name}
                  {item.size && (
                    <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${item.size === 'large' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.size === 'large' ? 'L' : 'R'}
                    </span>
                  )}
                  {item.notes && <span className="ml-1 text-gray-400 italic text-xs font-normal">({item.notes})</span>}
                  {hidePrices && (() => {
                    const cd = itemCountdown(item.name);
                    if (!cd) return null;
                    return (
                      <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${cd.over ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                        ⏱ {cd.label}
                      </span>
                    );
                  })()}
                </span>
                {!hidePrices && (
                  <span className="font-semibold text-gray-800 text-sm tabular-nums shrink-0">{fmt(lineTotal)}</span>
                )}
              </div>

              {(item.toppings ?? []).length > 0 && (
                <div className={`mt-1.5 ml-10 space-y-0.5 ${isDone ? 'opacity-40' : ''}`}>
                  {item.toppings!.map((t, ti) => (
                    <div key={ti} className="flex justify-between text-xs text-gray-400">
                      <span>+ {t.name}</span>
                      {!hidePrices && t.price > 0 && <span className="font-medium">+{fmt(t.price)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Waiter assignment ── */}
      {onAssignWaiter && waiters && waiters.length > 0 && (
        <div className="relative">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={order.assignedWaiterId ?? ''}
            onChange={(e) => onAssignWaiter(order.id, e.target.value || null)}
            className="w-full text-sm border border-gray-200 bg-white rounded-2xl pl-9 pr-4 py-2.5 text-gray-600 outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer appearance-none"
          >
            <option value="">Assign waiter…</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      )}

      {/* ── Rating ── */}
      {order.rating != null && (
        <div className="bg-white rounded-2xl px-4 py-2.5 flex items-center gap-2">
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

      {/* ── Total ── */}
      {!hidePrices && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(order.totalAmount)}</span>
        </div>
      )}
      {hidePrices && cooked.size > 0 && (
        <div className="flex justify-center">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${cooked.size === order.items.length ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
            {cooked.size}/{order.items.length} done
          </span>
        </div>
      )}

      {/* ── Actions ── */}
      {showActions && (
        <div className="space-y-2">
          {/* Print / WhatsApp row */}
          {(showKitchenPrint || showPrint || (order.status === 'ready' && order.customerPhone)) && (
            <div className="flex gap-2">
              {showKitchenPrint && (
                <button onClick={handleKitchenPrint} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-2xl font-medium bg-white hover:bg-gray-50 transition-colors">
                  <Printer size={14} /> Kitchen
                </button>
              )}
              {showPrint && (
                <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-2xl font-medium bg-white hover:bg-gray-50 transition-colors">
                  <Printer size={14} /> Print Bill
                </button>
              )}
              {order.status === 'ready' && order.customerPhone && (
                <a href={buildBillWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 text-white text-sm rounded-2xl font-medium hover:bg-green-600 transition-colors">
                  <MessageCircle size={14} /> Send Bill
                </a>
              )}
            </div>
          )}

          {/* Add Items + Cancel row */}
          {(onAddItems && ['pending', 'preparing'].includes(order.status)) || (onCancel && order.status === 'pending') ? (
            <div className="flex gap-2">
              {onAddItems && ['pending', 'preparing'].includes(order.status) && (
                <button onClick={() => onAddItems(order)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-green-400 text-green-700 text-sm rounded-2xl font-semibold bg-white hover:bg-green-50 transition-colors">
                  <PlusCircle size={15} /> Add Items
                </button>
              )}
              {onCancel && order.status === 'pending' && (
                confirmCancel ? (
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <span className="text-xs text-red-600 font-medium">Cancel order?</span>
                    <button onClick={() => { onCancel(order.id); setConfirmCancel(false); }} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-full font-bold">Yes</button>
                    <button onClick={() => setConfirmCancel(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmCancel(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-300 text-red-500 text-sm rounded-2xl font-semibold bg-white hover:bg-red-50 transition-colors">
                    <XCircle size={15} /> Cancel
                  </button>
                )
              )}
            </div>
          ) : null}

          {/* Primary status button */}
          {onStatusChange && nextStatus && nbc && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className={`w-full flex items-center justify-center gap-2 py-3 text-white text-sm rounded-2xl font-bold active:scale-[0.98] transition-all ${nbc.cls}`}
            >
              <NextIcon size={16} /> {nbc.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
