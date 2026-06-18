import { useState, useRef } from 'react';
import type { Order, OrderStatus } from '../types';
import type { Waiter } from '../services/waiterService';
import { StatusBadge } from './StatusBadge';
import { Clock, MapPin, ShoppingBag, Printer, BedDouble, UserCheck, CheckCircle2, Circle, MessageCircle, AlertTriangle, Star, PlusCircle, XCircle, Minus, Plus, Trash2, Download } from 'lucide-react';
import { printService } from '../services/printService';
import { computeCharges, type RestaurantSettings } from '../services/restaurantService';
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
  /** Show the integrated bill: charge breakdown + Print / WhatsApp / PDF actions */
  showBill?: boolean;
  /** Restaurant billing settings — needed for service charge / tax breakdown */
  settings?: RestaurantSettings | null;
  isNext?: boolean;
  priority?: number;
  hidePrices?: boolean;
  /** Map of menuItem name → prepTimeMins (used in kitchen mode) */
  prepTimeMap?: Record<string, number>;
  /** Current epoch ms — passed from parent so all cards tick in sync */
  clockMs?: number;
}

export function OrderCard({ order, onStatusChange, onAssignWaiter, onAddItems, onCancel, onRemoveItem, onUpdateItemQty, waiters, showActions = false, showPrint = false, showKitchenPrint = false, showBill = false, settings, isNext = false, priority, hidePrices = false, prepTimeMap, clockMs }: Props) {
  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
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
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);
  const [billPhone, setBillPhone] = useState(order.customerPhone ?? '');

  // â”€â”€ Bill charge breakdown (admin detail view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Prefer stored SC/tax amounts; fall back to re-computation for older orders.
  const hasStoredCharges = (order.taxAmount ?? 0) > 0 || (order.serviceChargeAmount ?? 0) > 0;
  const billGrossSubtotal = hasStoredCharges
    ? order.totalAmount - (order.taxAmount ?? 0) - (order.serviceChargeAmount ?? 0) + (order.discountAmount ?? 0)
    : order.totalAmount + (order.discountAmount ?? 0);
  const billNet = billGrossSubtotal - (order.discountAmount ?? 0);
  const billCharges = hasStoredCharges
    ? { serviceCharge: order.serviceChargeAmount ?? 0, tax: order.taxAmount ?? 0, grandTotal: order.totalAmount }
    : computeCharges(billNet, {
        serviceChargePct: order.orderType === 'dine-in' ? (settings?.serviceChargePct ?? 0) : 0,
        taxPct:           settings?.taxPct ?? 0,
      });
  const hasBreakdown = (order.discountAmount ?? 0) > 0 || billCharges.serviceCharge > 0 || billCharges.tax > 0;
  const scName  = settings?.serviceChargeName ?? 'Service Charge';
  const taxName = settings?.taxName           ?? 'Tax';

  const cardRef = useRef<HTMLDivElement>(null);

  const isEditable = showActions && ['pending', 'preparing'].includes(order.status) && (onRemoveItem || onUpdateItemQty);

  function toggleItem(idx: number) {
    setCooked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function buildBillWhatsAppUrl(phone: string): string {
    const lines: string[] = [];
    lines.push(`🧾 Bill — #${order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}`);
    if (settings?.name) lines.push(settings.name);
    lines.push('');
    for (const i of order.items) {
      const toppingsTotal = (i.toppings ?? []).reduce((s, t) => s + t.price, 0);
      const modifiersTotal = (i.modifiers ?? []).reduce((s, m) => s + m.price, 0);
      lines.push(`• ${i.quantity}× ${i.name} — ${fmt((i.price + toppingsTotal + modifiersTotal) * i.quantity)}`);
    }
    lines.push('');
    lines.push(`Subtotal: ${fmt(billNet)}`);
    if ((order.discountAmount ?? 0) > 0) lines.push(`Discount: -${fmt(order.discountAmount ?? 0)}`);
    if (billCharges.serviceCharge > 0)   lines.push(`${scName}: ${fmt(billCharges.serviceCharge)}`);
    if (billCharges.tax > 0)             lines.push(`${taxName}: ${fmt(billCharges.tax)}`);
    lines.push(`*Total: ${fmt(billCharges.grandTotal)}*`, '', 'Thank you! 🙏');
    const text = encodeURIComponent(lines.join('\n'));
    const digits = phone.replace(/\D/g, '');
    // Normalise to E.164 — assume Sri Lanka (+94) for local 0-prefixed numbers
    const e164 = phone.trim().startsWith('+') ? digits : digits.startsWith('0') ? `94${digits.slice(1)}` : digits;
    return `https://wa.me/${e164}?text=${text}`;
  }

  function handleSendWhatsApp() {
    const target = billPhone.trim();
    if (!target) { toast.error('Enter a mobile number first'); return; }
    window.open(buildBillWhatsAppUrl(target), '_blank', 'noopener,noreferrer');
  }

  /** Open the printable receipt — the browser dialog allows "Save as PDF". */
  function handleDownloadPdf() {
    const url = order.sessionId ? `/session-receipt/${order.sessionId}` : `/receipt/${order.id}`;
    window.open(url, '_blank', 'width=400,height=600');
  }

  async function handlePrint() {
    const result = await printService.receipt(order.id);
    if (result.success) {
      toast.success('Receipt sent to printer');
    } else {
      // Fallback to browser print if no printer configured
      handleDownloadPdf();
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

  const priorityColor = priority === 1
    ? 'bg-red-500 text-white'
    : priority === 2
    ? 'bg-orange-400 text-white'
    : 'bg-gray-500 text-white';

  // Per-order-type theming for the header band, icon and accents
  const theme = order.orderType === 'takeaway'
    ? { band: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500', Icon: ShoppingBag, label: 'Takeaway' }
    : order.orderType === 'room-service'
    ? { band: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500',   Icon: BedDouble,   label: `Room ${order.roomNumber}` }
    : { band: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500', Icon: MapPin,      label: `Table ${order.tableNumber}` };
  const TypeIcon = theme.Icon;

  // Human-readable age: 45m · 5h 12m · 2d 3h (raw minutes get unwieldy fast)
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

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
      isStale ? 'ring-2 ring-red-400' : 'border border-gray-100'
    }`}>
      <div ref={cardRef} className="bg-white">
      {/* ── Header band ── */}
      <div className={`px-4 py-3 border-b border-gray-100 ${theme.band}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {priority != null && (
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${priorityColor}`}>
                {priority}
              </span>
            )}
            <span className={`w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center shrink-0 ${theme.icon}`}>
              <TypeIcon size={15} />
            </span>
            <span className={`font-bold text-sm truncate ${theme.text}`}>{theme.label}</span>
            {order.customerName && order.orderType !== 'dine-in' && (
              <span className="text-gray-500 text-sm truncate">· {order.customerName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={order.status} />
            {showPrint && (
              <button onClick={handlePrint} title="Print Bill" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors">
                <Printer size={15} />
              </button>
            )}
          </div>
        </div>
        {/* Secondary line: order #, time, waiter, stale */}
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
          {order.orderNumber && (
            <span className="font-mono font-bold text-gray-700 bg-white/70 px-2 py-0.5 rounded-md tracking-wide">
              #{order.orderNumber}
            </span>
          )}
          <span className="flex items-center gap-1 text-gray-400">
            <Clock size={11} className="shrink-0" /> {dateStr}
          </span>
          {order.assignedWaiterName && (
            <span className="flex items-center gap-1 text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              <UserCheck size={11} /> {order.assignedWaiterName}
            </span>
          )}
          {isNext && (
            <span className="font-bold text-red-500 uppercase tracking-wide">▶ Next up</span>
          )}
          {isStale && (
            <span className="flex items-center gap-1 font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full ml-auto animate-pulse">
              <AlertTriangle size={11} /> {formatAge(ageMins)} stalled
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="px-4 pt-3 pb-3 space-y-2">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const modifiersTotal = (item.modifiers ?? []).reduce((s, m) => s + m.price, 0);
          const lineTotal = (item.price + toppingsTotal + modifiersTotal) * item.quantity;
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
                  {/* Quantity controls when editable */}
                  {isEditable && item.id ? (
                    confirmRemoveIdx === idx ? (
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-red-600 font-medium">Remove?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveItem!(order.id, item.id!); setConfirmRemoveIdx(null); }}
                          className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold hover:bg-red-600"
                        >Yes</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmRemoveIdx(null); }}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200"
                        >No</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) { setConfirmRemoveIdx(idx); }
                            else onUpdateItemQty!(order.id, item.id!, item.quantity - 1);
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        ><Minus size={11} /></button>
                        <span className="font-bold text-xs text-gray-700 bg-gray-100 rounded-md px-1.5 py-0.5 tabular-nums min-w-[1.5rem] text-center">{item.quantity}×</span>
                        <button
                          onClick={() => onUpdateItemQty!(order.id, item.id!, item.quantity + 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        ><Plus size={11} /></button>
                        <button
                          onClick={() => setConfirmRemoveIdx(idx)}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5"
                          title="Remove item"
                        ><Trash2 size={11} /></button>
                      </span>
                    )
                  ) : (
                    <span className="font-bold text-xs text-gray-700 bg-gray-100 rounded-md px-1.5 py-0.5 tabular-nums shrink-0">{item.quantity}×</span>
                  )}
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
                <ul className={`mt-1 space-y-0.5 transition-opacity ml-6 ${isDone ? 'opacity-35' : ''}`}>
                  {item.toppings!.map((t, ti) => (
                    <li key={ti} className="flex justify-between text-xs text-gray-400">
                      <span>+ {t.name}</span>
                      {!hidePrices && t.price > 0 && <span>+{fmt(t.price)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {(item.modifiers ?? []).length > 0 && (
                <ul className={`mt-1 space-y-0.5 ml-6 ${isDone ? 'opacity-35' : ''}`}>
                  {item.modifiers!.map((m, mi) => (
                    <li key={mi} className="flex justify-between text-xs text-blue-400">
                      <span>◆ {m.groupName}: {m.optionName}</span>
                      {!hidePrices && m.price > 0 && <span>+{fmt(m.price)}</span>}
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
      <div className="px-4 py-3 border-t border-gray-100">
        {/* Bill charge breakdown */}
        {showBill && !hidePrices && hasBreakdown && (
          <div className="space-y-1 mb-2.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(billNet)}</span>
            </div>
            {(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                <span className="tabular-nums">-{fmt(order.discountAmount ?? 0)}</span>
              </div>
            )}
            {billCharges.serviceCharge > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{scName}</span>
                <span className="tabular-nums">{fmt(billCharges.serviceCharge)}</span>
              </div>
            )}
            {billCharges.tax > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{taxName}</span>
                <span className="tabular-nums">{fmt(billCharges.tax)}</span>
              </div>
            )}
          </div>
        )}
        {/* Total / progress row */}
        {(!hidePrices || cooked.size > 0) && (
          <div className="flex items-center justify-between mb-2.5">
            {!hidePrices ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Total</span>
                <span className="font-bold text-gray-900 text-lg tabular-nums">{fmt(order.totalAmount)}</span>
              </>
            ) : (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                cooked.size === order.items.length
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-600'
              }`}>
                {cooked.size}/{order.items.length} done
              </span>
            )}
          </div>
        )}
        {/* Actions — wrap freely so nothing clips */}
        <div className="flex items-center gap-2 flex-wrap">
          {showKitchenPrint && (
            <button
              onClick={handleKitchenPrint}
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
          {!showBill && showActions && order.status === 'ready' && order.customerPhone && (
            <a
              href={buildBillWhatsAppUrl(order.customerPhone)}
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
                <span className="text-xs text-red-600 font-medium">Cancel order?</span>
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
                title="Cancel this order"
              >
                <XCircle size={13} /> Cancel
              </button>
            )
          )}
          {showActions && onStatusChange && nextStatus && (
            <button
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="flex-1 min-w-[8rem] px-4 py-2 bg-orange-500 text-white text-sm rounded-xl font-bold hover:bg-orange-600 active:scale-95 transition-all capitalize whitespace-nowrap"
            >
              Mark as {nextStatus}
            </button>
          )}
        </div>

        {/* Bill actions — print, download PDF, send via WhatsApp (single full-width row) */}
        {showBill && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap items-stretch gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.99] transition-all whitespace-nowrap"
              >
                <Printer size={15} /> Print Bill
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.99] transition-all whitespace-nowrap"
                title="Open the bill to print or save as PDF"
              >
                <Download size={15} /> PDF
              </button>
              {/* Send-to-mobile group fills remaining width */}
              <div className="flex flex-1 min-w-[240px] gap-2">
                <input
                  type="tel"
                  value={billPhone}
                  onChange={(e) => setBillPhone(e.target.value)}
                  placeholder="Send to mobile — 07X XXX XXXX"
                  className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300"
                />
                <button
                  onClick={handleSendWhatsApp}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 active:scale-[0.99] transition-all whitespace-nowrap"
                  title="Send the bill via WhatsApp"
                >
                  <MessageCircle size={15} /> Send
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Print, save as PDF, or send the bill to the customer's phone via WhatsApp.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
