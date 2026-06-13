import { useState } from 'react';
import { Printer, MessageCircle, Receipt } from 'lucide-react';
import type { Order } from '../types';
import { computeCharges, formatCurrency, type RestaurantSettings } from '../services/restaurantService';
import { printService } from '../services/printService';
import toast from 'react-hot-toast';

interface Props {
  order: Order;
  settings: RestaurantSettings | null;
}

/**
 * On-screen bill for an order. Mirrors the printed thermal receipt's charge
 * computation so the preview matches what gets printed. Lets staff print the
 * bill (network printer, with a browser-print fallback) or send it to the
 * customer's mobile via WhatsApp.
 */
export function BillPanel({ order, settings }: Props) {
  const [phone, setPhone] = useState(order.customerPhone ?? '');

  const fmtAmt = (n: number) => formatCurrency(n, settings?.currency ?? 'USD');

  // Prefer stored SC/tax amounts (new orders); fall back to re-computation for old ones
  const hasStoredCharges = (order.taxAmount ?? 0) > 0 || (order.serviceChargeAmount ?? 0) > 0;
  const subtotal = hasStoredCharges
    ? order.totalAmount - (order.taxAmount ?? 0) - (order.serviceChargeAmount ?? 0) + (order.discountAmount ?? 0)
    : order.totalAmount + (order.discountAmount ?? 0);
  const charges = hasStoredCharges
    ? { serviceCharge: order.serviceChargeAmount ?? 0, tax: order.taxAmount ?? 0, grandTotal: order.totalAmount }
    : computeCharges(subtotal - (order.discountAmount ?? 0), {
        serviceChargePct: order.orderType === 'dine-in' ? (settings?.serviceChargePct ?? 0) : 0,
        taxPct:           settings?.taxPct ?? 0,
      });
  const scName  = settings?.serviceChargeName ?? 'Service Charge';
  const taxName = settings?.taxName           ?? 'Tax';
  const netSubtotal = subtotal - (order.discountAmount ?? 0);

  async function handlePrint() {
    const result = await printService.receipt(order.id);
    if (result.success) {
      toast.success('Receipt sent to printer');
    } else {
      // No network printer configured — open the browser-printable receipt
      const url = order.sessionId ? `/session-receipt/${order.sessionId}` : `/receipt/${order.id}`;
      window.open(url, '_blank', 'width=400,height=600');
    }
  }

  function buildWhatsAppUrl(target: string): string {
    const lines: string[] = [];
    lines.push(`🧾 Bill — ${order.orderNumber ?? '#' + order.id.slice(0, 8).toUpperCase()}`);
    if (settings?.name) lines.push(settings.name);
    lines.push('');
    for (const i of order.items) {
      const toppingsTotal = (i.toppings ?? []).reduce((s, t) => s + t.price, 0);
      lines.push(`• ${i.quantity}× ${i.name} — ${fmtAmt((i.price + toppingsTotal) * i.quantity)}`);
    }
    lines.push('');
    lines.push(`Subtotal: ${fmtAmt(netSubtotal)}`);
    if ((order.discountAmount ?? 0) > 0) lines.push(`Discount: -${fmtAmt(order.discountAmount ?? 0)}`);
    if (charges.serviceCharge > 0)       lines.push(`${scName}: ${fmtAmt(charges.serviceCharge)}`);
    if (charges.tax > 0)                 lines.push(`${taxName}: ${fmtAmt(charges.tax)}`);
    lines.push(`*Total: ${fmtAmt(charges.grandTotal)}*`, '', 'Thank you! 🙏');

    const text = encodeURIComponent(lines.join('\n'));
    const digits = target.replace(/\D/g, '');
    // Normalise to E.164 — assume Sri Lanka (+94) for local 0-prefixed numbers
    const e164 = target.trim().startsWith('+') ? digits : digits.startsWith('0') ? `94${digits.slice(1)}` : digits;
    return `https://wa.me/${e164}?text=${text}`;
  }

  function handleSend() {
    const target = phone.trim();
    if (!target) { toast.error('Enter a mobile number first'); return; }
    window.open(buildWhatsAppUrl(target), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Receipt size={16} className="text-gray-400" />
        <h3 className="font-bold text-gray-900 text-sm">Bill</h3>
        <span className="ml-auto text-xs font-semibold text-gray-400">
          {order.orderNumber ?? `#${order.id.slice(0, 6)}`}
        </span>
      </div>

      {/* Itemised lines */}
      <div className="px-5 py-4 space-y-2">
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          return (
            <div key={idx}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-700">
                  <span className="text-gray-400 tabular-nums">{item.quantity}×</span> {item.name}
                  {item.size ? <span className="text-gray-400"> ({item.size === 'large' ? 'L' : 'R'})</span> : ''}
                </span>
                <span className="text-gray-900 tabular-nums whitespace-nowrap">
                  {fmtAmt((item.price + toppingsTotal) * item.quantity)}
                </span>
              </div>
              {(item.toppings ?? []).map((t, ti) => (
                <div key={ti} className="flex justify-between gap-3 text-xs text-gray-400 pl-4">
                  <span>+ {t.name}</span>
                  {t.price > 0 && <span className="tabular-nums">+{fmtAmt(t.price)}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="px-5 py-3 border-t border-gray-100 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <span className="tabular-nums">{fmtAmt(netSubtotal)}</span>
        </div>
        {(order.discountAmount ?? 0) > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
            <span className="tabular-nums">-{fmtAmt(order.discountAmount ?? 0)}</span>
          </div>
        )}
        {charges.serviceCharge > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>{scName}</span>
            <span className="tabular-nums">{fmtAmt(charges.serviceCharge)}</span>
          </div>
        )}
        {charges.tax > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>{taxName}</span>
            <span className="tabular-nums">{fmtAmt(charges.tax)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 mt-1.5">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Total</span>
          <span className="font-bold text-gray-900 text-lg tabular-nums">{fmtAmt(charges.grandTotal)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-3 bg-gray-50/50">
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.99] transition-all"
        >
          <Printer size={15} /> Print Bill
        </button>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Send to mobile
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07X XXX XXXX"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300"
            />
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 active:scale-[0.99] transition-all whitespace-nowrap"
              title="Send bill via WhatsApp"
            >
              <MessageCircle size={15} /> Send
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Opens WhatsApp with the bill ready to send.</p>
        </div>
      </div>
    </div>
  );
}
