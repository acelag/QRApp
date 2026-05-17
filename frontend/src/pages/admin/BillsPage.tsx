import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Receipt, RefreshCw, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Session } from '../../services/sessionService';
import { sessionService } from '../../services/sessionService';
import { restaurantService, computeCharges, type RestaurantSettings } from '../../services/restaurantService';
import { useCurrency } from '../../context/CurrencyContext';

function elapsed(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function todayStr() {
  return new Date().toDateString();
}

export function BillsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [billingSettings, setBillingSettings] = useState<RestaurantSettings | null>(null);
  const { fmt } = useCurrency();

  useEffect(() => {
    restaurantService.getMyRestaurant().then(setBillingSettings).catch(() => {});
  }, []);

  const load = () =>
    sessionService.getSessions()
      .then(setSessions)
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  async function handleMarkPaid(sessionId: string, tableNumber: number) {
    if (!confirm(`Mark Table ${tableNumber} bill as PAID and close this session?`)) return;
    setPaying(sessionId);
    try {
      const updated = await sessionService.markAsPaid(sessionId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      toast.success(`Table ${tableNumber} bill marked as paid!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to close session');
    } finally {
      setPaying(null);
    }
  }

  const open   = sessions.filter((s) => s.status === 'open');
  const paidToday = sessions.filter(
    (s) => s.status === 'paid' && s.closedAt && new Date(s.closedAt).toDateString() === todayStr()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Table Bills</h1>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* ── Open sessions ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h2 className="font-semibold text-gray-700 text-sm">
                  Open Bills ({open.length})
                </h2>
              </div>

              {open.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                  <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                  No open table sessions right now
                </div>
              ) : (
                open.map((session) => (
                  <div key={session.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Session header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-orange-50 border-b border-orange-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
                          {session.tableNumber}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Table {session.tableNumber}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={11} /> Opened {elapsed(session.createdAt)} ago
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-600">
                          {fmt(session.totalAmount ?? 0)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(session.orders ?? []).length} order{(session.orders ?? []).length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Aggregated bill items */}
                    {(session.billItems ?? []).length > 0 && (
                      <div className="px-5 py-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bill Summary</p>
                        <ul className="space-y-1.5">
                          {session.billItems!.map((item, i) => (
                            <li key={i} className="text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-700 flex items-center gap-1.5">
                                  <span className="font-medium text-gray-900">{item.quantity}×</span> {item.name}
                                  {item.size && (
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                      item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {item.size === 'large' ? 'L' : 'R'}
                                    </span>
                                  )}
                                </span>
                                <span className="text-gray-700 tabular-nums">{fmt(item.total)}</span>
                              </div>
                              {(item.toppings ?? []).length > 0 && (
                                <ul className="ml-6 mt-0.5 space-y-0.5">
                                  {item.toppings!.map((t: { id: string; name: string; price: number }, ti: number) => (
                                    <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>

                        {/* Charges breakdown */}
                        {billingSettings && (() => {
                          const subtotal = session.totalAmount ?? 0;
                          const charges = computeCharges(subtotal, {
                            serviceChargePct: billingSettings.serviceChargePct,
                            taxPct:           billingSettings.taxPct,
                          });
                          return (
                            <div className="mt-3 pt-2 border-t border-gray-100 space-y-1 text-sm text-gray-600">
                              <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{fmt(subtotal)}</span>
                              </div>
                              {charges.serviceCharge > 0 && (
                                <div className="flex justify-between">
                                  <span>Service Charge ({billingSettings.serviceChargePct}%)</span>
                                  <span>+{fmt(charges.serviceCharge)}</span>
                                </div>
                              )}
                              {charges.tax > 0 && (
                                <div className="flex justify-between">
                                  <span>Tax ({billingSettings.taxPct}%)</span>
                                  <span>+{fmt(charges.tax)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1">
                                <span>Grand Total</span>
                                <span>{fmt(charges.grandTotal)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-5 py-4 space-y-2">
                      <div className="flex gap-3">
                        <button
                          onClick={() => window.open(`/session-receipt/${session.id}`, '_blank', 'width=400,height=600')}
                          disabled={(session.billItems ?? []).length === 0}
                          className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          <Printer size={16} />
                          Print Bill
                        </button>
                        <button
                          onClick={() => handleMarkPaid(session.id, session.tableNumber)}
                          disabled={paying === session.id || (session.billItems ?? []).length === 0}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition-colors"
                        >
                          {paying === session.id
                            ? <Loader2 size={16} className="animate-spin" />
                            : <CheckCircle2 size={16} />}
                          {paying === session.id ? 'Processing…' : 'Mark as Paid'}
                        </button>
                      </div>
                    </div>
                    {(session.billItems ?? []).length === 0 && (
                      <p className="text-center text-xs text-gray-400 pb-3">No orders placed yet</p>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* ── Paid today ────────────────────────────────────────────── */}
            {paidToday.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  Paid Today ({paidToday.length})
                </h2>
                {paidToday.map((session) => (
                  <div key={session.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center font-bold">
                        {session.tableNumber}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">Table {session.tableNumber}</p>
                        <p className="text-xs text-gray-400">
                          {session.closedAt
                            ? `Paid at ${new Date(session.closedAt).toLocaleTimeString()}`
                            : 'Paid'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-700">{fmt(session.totalAmount ?? 0)}</p>
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                        Paid
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
