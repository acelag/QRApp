import { useState } from 'react';
import { X, Minus, Plus, Printer, Users } from 'lucide-react';
import type { Session } from '../services/sessionService';
import { computeCharges, getCurrencySymbol, type RestaurantSettings } from '../services/restaurantService';

interface Props {
  session: Session;
  settings: RestaurantSettings | null;
  onClose: () => void;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; background: #fff; }
  .receipt {
    width: 72mm;
    padding: 8px 4px;
    page-break-after: always;
  }
  .receipt:last-child { page-break-after: avoid; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .large  { font-size: 14px; }
  .small  { font-size: 10px; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 4px; }
  @page { size: 80mm auto; margin: 4mm; }
`;

function buildSplitReceiptHtml(
  session: Session,
  settings: RestaurantSettings | null,
  guestIdx: number,
  totalGuests: number,
  perPerson: number,
  grandTotal: number,
): string {
  const sym = getCurrencySymbol(settings?.currency ?? 'USD');
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  const date = new Date(session.createdAt).toLocaleDateString();
  const time = new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const name = settings?.name ?? 'RESTAURANT';

  return `
    <div class="receipt">
      <p class="center bold large">${name}</p>
      <div class="line"></div>
      <p class="center bold">SPLIT BILL</p>
      <p class="center small">Guest ${guestIdx + 1} of ${totalGuests}</p>
      <div class="line"></div>
      <div class="row"><span>Table:</span><span>${session.tableNumber}</span></div>
      <div class="row"><span>Date:</span><span>${date}</span></div>
      <div class="row"><span>Time:</span><span>${time}</span></div>
      <div class="row"><span>Split:</span><span>${guestIdx + 1} / ${totalGuests}</span></div>
      <div class="line"></div>
      <div class="row small"><span>Table Total</span><span>${fmt(grandTotal)}</span></div>
      <div class="row small"><span>÷ ${totalGuests} guests</span><span></span></div>
      <div class="line"></div>
      <div class="total-row"><span>YOUR SHARE</span><span>${fmt(perPerson)}</span></div>
      <div class="line"></div>
      <p class="center small" style="margin-top:8px">Thank you for dining with us!</p>
      <p class="center small">Please come again 🙏</p>
    </div>
  `;
}

export function SplitBillModal({ session, settings, onClose }: Props) {
  const [splits, setSplits] = useState(2);

  const sym = getCurrencySymbol(settings?.currency ?? 'USD');
  const fmt = (n: number) => `${sym} ${n.toFixed(2)}`;

  const subtotal = session.totalAmount ?? 0;
  const charges = computeCharges(subtotal, {
    serviceChargePct: settings?.serviceChargePct ?? 0,
    taxPct: settings?.taxPct ?? 0,
  });
  const grandTotal = charges.grandTotal;
  const perPerson = grandTotal / splits;

  function openPrint(html: string) {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Split Bill</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    setTimeout(() => { try { win.focus(); win.print(); } catch { /* already printed */ } }, 400);
  }

  function printAll() {
    const html = Array.from({ length: splits }, (_, i) =>
      buildSplitReceiptHtml(session, settings, i, splits, perPerson, grandTotal)
    ).join('');
    openPrint(html);
  }

  function printOne(idx: number) {
    openPrint(buildSplitReceiptHtml(session, settings, idx, splits, perPerson, grandTotal));
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-900 text-lg">Split Bill</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Table info */}
          <div className="bg-orange-50 rounded-2xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">Table {session.tableNumber} — Grand Total</span>
            <span className="font-bold text-orange-600 text-lg">{fmt(grandTotal)}</span>
          </div>

          {/* Guest count picker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Number of Guests</p>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setSplits((n) => Math.max(2, n - 1))}
                className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <Minus size={18} />
              </button>
              <div className="text-center">
                <p className="text-5xl font-bold text-gray-900 leading-none">{splits}</p>
                <p className="text-xs text-gray-400 mt-1">guests</p>
              </div>
              <button
                onClick={() => setSplits((n) => Math.min(20, n + 1))}
                className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Per person amount */}
          <div className="bg-gray-50 rounded-2xl px-4 py-4 text-center border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Each guest pays</p>
            <p className="text-4xl font-bold text-gray-900">{fmt(perPerson)}</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(grandTotal)} ÷ {splits}</p>
          </div>

          {/* Breakdown if charges apply */}
          {(charges.serviceCharge > 0 || charges.tax > 0) && (
            <div className="text-xs text-gray-400 space-y-1 border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {charges.serviceCharge > 0 && (
                <div className="flex justify-between"><span>Service Charge ({settings?.serviceChargePct}%)</span><span>+{fmt(charges.serviceCharge)}</span></div>
              )}
              {charges.tax > 0 && (
                <div className="flex justify-between"><span>Tax ({settings?.taxPct}%)</span><span>+{fmt(charges.tax)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-gray-600 border-t border-gray-100 pt-1">
                <span>Grand Total</span><span>{fmt(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* Individual guest print buttons */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Individual Receipts</p>
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {Array.from({ length: splits }, (_, i) => (
                <button
                  key={i}
                  onClick={() => printOne(i)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-orange-50 hover:text-orange-600 border border-gray-100 hover:border-orange-200 transition-colors text-gray-600"
                >
                  <Printer size={12} />
                  <span className="text-xs font-medium">G{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={printAll}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-orange-600 transition-colors"
          >
            <Printer size={15} /> Print All ({splits})
          </button>
        </div>
      </div>
    </div>
  );
}
