import { useState } from 'react';
import { X, Minus, Plus, Printer, Users, List, AlertTriangle } from 'lucide-react';
import type { Session, BillItem } from '../services/sessionService';
import { computeCharges, formatCurrency, type RestaurantSettings } from '../services/restaurantService';

interface Props {
  session: Session;
  settings: RestaurantSettings | null;
  onClose: () => void;
}

type SplitMode = 'even' | 'byItem';

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

// ── Even split receipts ───────────────────────────────────────────────────────

function buildEvenReceiptHtml(
  session: Session,
  settings: RestaurantSettings | null,
  guestIdx: number,
  totalGuests: number,
  perPerson: number,
  grandTotal: number,
): string {
  const code = settings?.currency ?? 'USD';
  const fmt = (n: number) => formatCurrency(n, code);
  const date = new Date(session.createdAt).toLocaleDateString();
  const time = new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const name = settings?.name ?? 'RESTAURANT';

  return `
    <div class="receipt">
      <p class="center bold large">${name}</p>
      <div class="line"></div>
      <p class="center bold">SPLIT BILL — EVEN</p>
      <p class="center small">Guest ${guestIdx + 1} of ${totalGuests}</p>
      <div class="line"></div>
      <div class="row"><span>Table:</span><span>${session.tableNumber}</span></div>
      <div class="row"><span>Date:</span><span>${date}</span></div>
      <div class="row"><span>Time:</span><span>${time}</span></div>
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

// ── By-item split receipts ────────────────────────────────────────────────────

interface GuestLine { name: string; qty: number; unitShare: number; lineTotal: number; }

function buildByItemReceiptHtml(
  session: Session,
  settings: RestaurantSettings | null,
  guestNum: number,
  totalGuests: number,
  lines: GuestLine[],
  subtotal: number,
  grandTotal: number,
): string {
  const code = settings?.currency ?? 'USD';
  const fmt = (n: number) => formatCurrency(n, code);
  const date = new Date(session.createdAt).toLocaleDateString();
  const time = new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const name = settings?.name ?? 'RESTAURANT';
  const charges = computeCharges(subtotal, {
    serviceChargePct: settings?.serviceChargePct ?? 0,
    taxPct: settings?.taxPct ?? 0,
  });

  const itemRows = lines.map((l) => {
    const label = l.qty > 1 ? `${l.qty}× ${l.name}` : l.name;
    return `<div class="row"><span>${label}</span><span>${fmt(l.lineTotal)}</span></div>`;
  }).join('');

  const chargeRows = [
    charges.serviceCharge > 0
      ? `<div class="row"><span>Service (${settings?.serviceChargePct}%)</span><span>+${fmt(charges.serviceCharge)}</span></div>`
      : '',
    charges.tax > 0
      ? `<div class="row"><span>Tax (${settings?.taxPct}%)</span><span>+${fmt(charges.tax)}</span></div>`
      : '',
  ].join('');

  return `
    <div class="receipt">
      <p class="center bold large">${name}</p>
      <div class="line"></div>
      <p class="center bold">SPLIT BILL — BY ITEM</p>
      <p class="center small">Guest ${guestNum} of ${totalGuests}</p>
      <div class="line"></div>
      <div class="row"><span>Table:</span><span>${session.tableNumber}</span></div>
      <div class="row"><span>Date:</span><span>${date}</span></div>
      <div class="row"><span>Time:</span><span>${time}</span></div>
      <div class="line"></div>
      ${itemRows}
      <div class="line"></div>
      <div class="row small"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${chargeRows}
      <div class="total-row"><span>YOUR TOTAL</span><span>${fmt(grandTotal)}</span></div>
      <div class="line"></div>
      <p class="center small" style="margin-top:8px">Thank you for dining with us!</p>
      <p class="center small">Please come again 🙏</p>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function openPrint(html: string) {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Split Bill</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already printed */ } }, 400);
}

// ── Main component ────────────────────────────────────────────────────────────

export function SplitBillModal({ session, settings, onClose }: Props) {
  const [mode, setMode] = useState<SplitMode>('even');
  const [splits, setSplits] = useState(2);
  // by-item: assignments[itemIdx] = Set of guest numbers (1-based)
  const [assignments, setAssignments] = useState<Record<number, Set<number>>>({});

  const currCode = settings?.currency ?? 'USD';
  const fmt = (n: number) => formatCurrency(n, currCode);

  const subtotal = session.totalAmount ?? 0;
  const charges = computeCharges(subtotal, {
    serviceChargePct: settings?.serviceChargePct ?? 0,
    taxPct: settings?.taxPct ?? 0,
  });
  const grandTotal = charges.grandTotal;
  const perPerson  = grandTotal / splits;

  const billItems: BillItem[] = session.billItems ?? [];

  // ── Even print ──────────────────────────────────────────────────────────────
  function printEvenAll() {
    const html = Array.from({ length: splits }, (_, i) =>
      buildEvenReceiptHtml(session, settings, i, splits, perPerson, grandTotal),
    ).join('');
    openPrint(html);
  }

  function printEvenOne(idx: number) {
    openPrint(buildEvenReceiptHtml(session, settings, idx, splits, perPerson, grandTotal));
  }

  // ── By-item helpers ─────────────────────────────────────────────────────────
  function toggleAssign(itemIdx: number, guest: number) {
    setAssignments((prev) => {
      const cur = new Set(prev[itemIdx] ?? []);
      if (cur.has(guest)) cur.delete(guest); else cur.add(guest);
      return { ...prev, [itemIdx]: cur };
    });
  }


  // Cost share: each guest pays item.total / (number of guests assigned to it)
  function guestSubtotal(guest: number): number {
    return billItems.reduce((sum, item, idx) => {
      const gs = assignments[idx] ?? new Set();
      if (!gs.has(guest)) return sum;
      return sum + item.total / gs.size;
    }, 0);
  }

  function guestLines(guest: number): GuestLine[] {
    return billItems
      .map((item, idx) => {
        const gs = assignments[idx] ?? new Set();
        if (!gs.has(guest)) return null;
        const unitShare = item.total / gs.size;
        return { name: item.name, qty: item.quantity, unitShare, lineTotal: unitShare };
      })
      .filter((l): l is GuestLine => l !== null);
  }

  const unassignedCount = billItems.filter((_, idx) => (assignments[idx] ?? new Set()).size === 0).length;

  function printByItemOne(guest: number) {
    const lines = guestLines(guest);
    if (lines.length === 0) { return; }
    const st = guestSubtotal(guest);
    const ch = computeCharges(st, { serviceChargePct: settings?.serviceChargePct ?? 0, taxPct: settings?.taxPct ?? 0 });
    openPrint(buildByItemReceiptHtml(session, settings, guest, splits, lines, st, ch.grandTotal));
  }

  function printByItemAll() {
    const html = Array.from({ length: splits }, (_, i) => {
      const guest = i + 1;
      const lines = guestLines(guest);
      if (lines.length === 0) return '';
      const st = guestSubtotal(guest);
      const ch = computeCharges(st, { serviceChargePct: settings?.serviceChargePct ?? 0, taxPct: settings?.taxPct ?? 0 });
      return buildByItemReceiptHtml(session, settings, guest, splits, lines, st, ch.grandTotal);
    }).join('');
    if (!html.trim()) return;
    openPrint(html);
  }

  // Reset assignments when guest count changes
  function changeSplits(n: number) {
    setSplits(n);
    // Remove assignments for guests that no longer exist
    setAssignments((prev) => {
      const next: Record<number, Set<number>> = {};
      for (const [k, v] of Object.entries(prev)) {
        const filtered = new Set([...v].filter((g) => g <= n));
        if (filtered.size > 0) next[Number(k)] = filtered;
      }
      return next;
    });
  }

  const GUEST_COLORS = [
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500',
    'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500',
  ];
  const guestColor = (g: number) => GUEST_COLORS[(g - 1) % GUEST_COLORS.length];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-900 text-lg">Split Bill</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X size={15} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode('even')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'even' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={14} /> Even Split
            </button>
            <button
              onClick={() => setMode('byItem')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'byItem' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={14} /> By Item
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Table info */}
            <div className="bg-orange-50 rounded-2xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Table {session.tableNumber} — Grand Total</span>
              <span className="font-bold text-orange-600 text-lg">{fmt(grandTotal)}</span>
            </div>

            {/* Guest count (shared between modes) */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Number of Guests</p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => changeSplits(Math.max(2, splits - 1))}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Minus size={18} />
                </button>
                <div className="text-center">
                  <p className="text-5xl font-bold text-gray-900 leading-none">{splits}</p>
                  <p className="text-xs text-gray-400 mt-1">guests</p>
                </div>
                <button
                  onClick={() => changeSplits(Math.min(20, splits + 1))}
                  className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* ── EVEN mode ─────────────────────────────────────────────── */}
            {mode === 'even' && (
              <>
                <div className="bg-gray-50 rounded-2xl px-4 py-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Each guest pays</p>
                  <p className="text-4xl font-bold text-gray-900">{fmt(perPerson)}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmt(grandTotal)} ÷ {splits}</p>
                </div>

                {(charges.serviceCharge > 0 || charges.tax > 0) && (
                  <div className="text-xs text-gray-400 space-y-1 border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                    {charges.serviceCharge > 0 && (
                      <div className="flex justify-between"><span>Service ({settings?.serviceChargePct}%)</span><span>+{fmt(charges.serviceCharge)}</span></div>
                    )}
                    {charges.tax > 0 && (
                      <div className="flex justify-between"><span>Tax ({settings?.taxPct}%)</span><span>+{fmt(charges.tax)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold text-gray-600 border-t border-gray-100 pt-1">
                      <span>Grand Total</span><span>{fmt(grandTotal)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Individual Receipts</p>
                  <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                    {Array.from({ length: splits }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => printEvenOne(i)}
                        className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-gray-50 hover:bg-orange-50 hover:text-orange-600 border border-gray-100 hover:border-orange-200 transition-colors text-gray-600"
                      >
                        <Printer size={12} />
                        <span className="text-xs font-medium">G{i + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── BY ITEM mode ───────────────────────────────────────────── */}
            {mode === 'byItem' && (
              <>
                {/* Tip */}
                <p className="text-xs text-gray-400 text-center -mt-2">
                  Tap the guest buttons on each item to assign who pays for it. Items can be shared.
                </p>

                {/* Guest legend */}
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: splits }, (_, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-full ${guestColor(i + 1)}`}>
                      G{i + 1}
                    </span>
                  ))}
                </div>

                {/* Item list */}
                <div className="space-y-2">
                  {billItems.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">No items on this bill yet</p>
                  )}
                  {billItems.map((item, idx) => {
                    const assignedGuests = assignments[idx] ?? new Set<number>();
                    const isShared = assignedGuests.size > 1;
                    const sharePrice = assignedGuests.size > 0 ? item.total / assignedGuests.size : item.total;
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl border p-3 transition-colors ${
                          assignedGuests.size === 0
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-tight">
                              {item.quantity > 1 && <span className="text-gray-400">{item.quantity}× </span>}
                              {item.name}
                              {item.size && <span className="ml-1 text-xs text-gray-400">({item.size})</span>}
                            </p>
                            {(item.toppings ?? []).length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                + {item.toppings!.map((t) => t.name).join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900">{fmt(item.total)}</p>
                            {isShared && (
                              <p className="text-xs text-blue-500">{fmt(sharePrice)} each</p>
                            )}
                          </div>
                        </div>
                        {/* Guest assignment chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: splits }, (_, i) => {
                            const g = i + 1;
                            const active = assignedGuests.has(g);
                            return (
                              <button
                                key={g}
                                onClick={() => toggleAssign(idx, g)}
                                className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                                  active
                                    ? `${guestColor(g)} text-white shadow-sm`
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                G{g}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Unassigned warning */}
                {unassignedCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      {unassignedCount} item{unassignedCount !== 1 ? 's' : ''} not yet assigned
                    </p>
                  </div>
                )}

                {/* Per-guest totals */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Guest Totals</p>
                  <div className="space-y-1.5">
                    {Array.from({ length: splits }, (_, i) => {
                      const g = i + 1;
                      const st = guestSubtotal(g);
                      const ch = computeCharges(st, { serviceChargePct: settings?.serviceChargePct ?? 0, taxPct: settings?.taxPct ?? 0 });
                      return (
                        <div key={g} className="flex items-center gap-2">
                          <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full shrink-0 ${guestColor(g)}`}>G{g}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${guestColor(g)}`}
                              style={{ width: grandTotal > 0 ? `${Math.min(100, (ch.grandTotal / grandTotal) * 100)}%` : '0%' }}
                            />
                          </div>
                          <span className="text-sm font-bold text-gray-900 w-20 text-right tabular-nums">{fmt(ch.grandTotal)}</span>
                          <button
                            onClick={() => printByItemOne(g)}
                            disabled={guestLines(g).length === 0}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-30"
                            title={`Print Guest ${g} receipt`}
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={mode === 'even' ? printEvenAll : printByItemAll}
            disabled={mode === 'byItem' && billItems.every((_, idx) => (assignments[idx] ?? new Set()).size === 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Printer size={15} /> Print All ({splits})
          </button>
        </div>
      </div>
    </div>
  );
}
