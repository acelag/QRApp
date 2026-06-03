import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, Receipt, RefreshCw,
  Printer, ShoppingBag, Table2, Users, GitMerge, Unlink, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Session } from '../../services/sessionService';
import { sessionService } from '../../services/sessionService';
import { restaurantService, computeCharges, type RestaurantSettings } from '../../services/restaurantService';
import { orderService } from '../../services/orderService';
import { refundService, refundMethodLabel, type Refund } from '../../services/refundService';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import type { Order } from '../../types';
import { SplitBillModal } from '../../components/SplitBillModal';
import { PaymentMethodModal, paymentMethodIcon, paymentMethodLabel, type PaymentMethod } from '../../components/PaymentMethodModal';
import { AdminSidebar } from '../../components/AdminSidebar';
import { RefundModal } from '../../components/RefundModal';
import { getApiError } from '../../lib/apiError';

function elapsed(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  const h = Math.floor(diff / 3600);
  if (h < 24) return `${h}h ${Math.floor((diff % 3600) / 60)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

type Tab = 'table' | 'takeaway' | 'refunds';

export function BillsPage() {
  const { user } = useAuth();
  const canRefund = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<Tab>('table');
  const [sessions, setSessions]             = useState<Session[]>([]);
  const [takeawayOrders, setTakeawayOrders] = useState<Order[]>([]);
  const [refunds, setRefunds]               = useState<Refund[]>([]);
  const [loading, setLoading]               = useState(true);
  const [paying, setPaying]                 = useState<string | null>(null);
  const [payingOrder, setPayingOrder]       = useState<string | null>(null);
  const [billingSettings, setBillingSettings] = useState<RestaurantSettings | null>(null);
  const [splitSession, setSplitSession]     = useState<Session | null>(null);
  const [mergeSource, setMergeSource]       = useState<Session | null>(null);
  const [merging, setMerging]               = useState(false);
  const [unmerging, setUnmerging]           = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget]   = useState<
    { type: 'session'; session: Session } | { type: 'order'; order: Order } | null
  >(null);
  const [refundTarget, setRefundTarget]     = useState<{
    label: string; maxAmount: number; orderId?: string; sessionId?: string;
  } | null>(null);

  const { fmt } = useCurrency();

  useEffect(() => {
    restaurantService.getMyRestaurant().then(setBillingSettings).catch(() => {});
  }, []);

  const loadRefunds = useCallback(() =>
    refundService.getRefunds().then(setRefunds).catch(() => {}), []);

  const load = useCallback(async () => {
    try {
      const [sess, orders] = await Promise.all([
        sessionService.getSessions(),
        orderService.getOrders(),
      ]);
      setSessions(sess);
      setTakeawayOrders(
        orders
          .filter((o) => o.orderType === 'takeaway')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (canRefund) loadRefunds();
    const id = setInterval(() => { load(); if (canRefund) loadRefunds(); }, 10000);
    return () => clearInterval(id);
  }, []);

  async function confirmPayment(method: PaymentMethod) {
    if (!paymentTarget) return;
    if (paymentTarget.type === 'session') {
      const { session } = paymentTarget;
      setPaying(session.id);
      setPaymentTarget(null);
      try {
        const updated = await sessionService.markAsPaid(session.id, method);
        setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
        toast.success(`Table ${session.tableNumber} — paid by ${method}`);
      } catch (err) {
        toast.error(getApiError(err));
      } finally {
        setPaying(null);
      }
    } else {
      const { order } = paymentTarget;
      setPayingOrder(order.id);
      setPaymentTarget(null);
      try {
        const updated = await orderService.settleRoomCharge(order.id, method);
        setTakeawayOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        toast.success(`Order marked as paid by ${method}`);
      } catch {
        toast.error('Failed to update order');
      } finally {
        setPayingOrder(null);
      }
    }
  }

  async function handleMerge(target: Session) {
    if (!mergeSource || merging) return;
    setMerging(true);
    try {
      const updatedPrimary = await sessionService.merge(mergeSource.id, target.id);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === updatedPrimary.id) return updatedPrimary;
          if (s.id === mergeSource.id) return { ...s, mergedIntoSessionId: target.id };
          return s;
        }),
      );
      toast.success(`Table ${mergeSource.tableNumber} merged into Table ${target.tableNumber}`);
      setMergeSource(null);
    } catch {
      toast.error('Failed to merge tables');
    } finally {
      setMerging(false);
    }
  }

  async function handleUnmerge(secondary: { id: string; tableNumber: number }, primaryId: string) {
    setUnmerging(secondary.id);
    try {
      const standalone = await sessionService.unmerge(secondary.id);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === standalone.id) return standalone;
          if (s.id === primaryId) {
            return { ...s, mergedSessions: (s.mergedSessions ?? []).filter((m) => m.id !== secondary.id) };
          }
          return s;
        }),
      );
      toast.success(`Table ${secondary.tableNumber} unmerged`);
    } catch {
      toast.error('Failed to unmerge');
    } finally {
      setUnmerging(null);
    }
  }

  const todayDateStr = new Date().toDateString();

  const openSessions = sessions.filter((s) => s.status === 'open' && !s.mergedIntoSessionId);
  const paidToday    = sessions.filter(
    (s) => s.status === 'paid' && s.closedAt && new Date(s.closedAt).toDateString() === todayDateStr,
  );
  const activeTakeaway    = takeawayOrders.filter((o) => !o.paymentMethod);
  const paidTodayTakeaway = takeawayOrders.filter(
    (o) => !!o.paymentMethod && new Date(o.createdAt).toDateString() === todayDateStr,
  );

  // Single pass: build per-session/per-order refund totals and today's list
  const { refundedBySession, refundedByOrder, todayRefunds } = useMemo(() => {
    const bySession: Record<string, number> = {};
    const byOrder:   Record<string, number> = {};
    const todayList: Refund[] = [];
    for (const r of refunds) {
      if (r.sessionId) bySession[r.sessionId] = (bySession[r.sessionId] ?? 0) + r.amount;
      if (r.orderId)   byOrder[r.orderId]     = (byOrder[r.orderId]   ?? 0) + r.amount;
      if (new Date(r.createdAt).toDateString() === todayDateStr) todayList.push(r);
    }
    return { refundedBySession: bySession, refundedByOrder: byOrder, todayRefunds: todayList };
  }, [refunds]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Bills</h1>
          <button
            onClick={() => { load(); if (canRefund) loadRefunds(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2 flex-wrap">
          <button
            onClick={() => setTab('table')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'table' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Table2 size={13} /> Table Bills
            {openSessions.length > 0 && <span className="ml-1 text-xs opacity-75">({openSessions.length})</span>}
          </button>
          <button
            onClick={() => setTab('takeaway')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'takeaway' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingBag size={13} /> Takeaway
            {activeTakeaway.length > 0 && <span className="ml-1 text-xs opacity-75">({activeTakeaway.length})</span>}
          </button>
          {canRefund && (
            <button
              onClick={() => { setTab('refunds'); loadRefunds(); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === 'refunds' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <RotateCcw size={13} /> Refunds
              {todayRefunds.length > 0 && <span className="ml-1 text-xs opacity-75">({todayRefunds.length})</span>}
            </button>
          )}
        </div>
      </header>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-6">
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : tab === 'table' ? (
          <>
            {/* ── Open table sessions ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h2 className="font-semibold text-gray-700 text-sm">Open Bills ({openSessions.length})</h2>
              </div>

              {mergeSource && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <GitMerge size={18} className="text-blue-500 shrink-0" />
                  <p className="text-sm text-blue-700 flex-1">
                    <span className="font-semibold">Table {mergeSource.tableNumber} selected.</span> Click any other open table to merge into it.
                  </p>
                  <button onClick={() => setMergeSource(null)} className="text-blue-400 hover:text-blue-600 text-xs font-medium">Cancel</button>
                </div>
              )}

              {openSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                  <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                  No open table sessions right now
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
                  {openSessions.map((session) => (
                    <div key={session.id} className="break-inside-avoid mb-3 lg:mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div
                        className={`flex items-center justify-between px-5 py-3 border-b ${mergeSource && mergeSource.id !== session.id ? 'bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100' : 'bg-orange-50 border-orange-100'}`}
                        onClick={() => mergeSource && mergeSource.id !== session.id && handleMerge(session)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg shrink-0 ${mergeSource && mergeSource.id !== session.id ? 'bg-blue-500' : 'bg-orange-500'}`}>
                            {session.tableNumber}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-gray-900 truncate">Table {session.tableNumber}</p>
                              {(session.mergedSessions ?? []).map((m) => (
                                <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                                  +{m.tableNumber}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnmerge(m, session.id); }}
                                    disabled={unmerging === m.id}
                                    className="ml-0.5 text-orange-400 hover:text-red-500 transition-colors"
                                    title={`Unmerge Table ${m.tableNumber}`}
                                  >
                                    {unmerging === m.id ? <Loader2 size={10} className="animate-spin" /> : <Unlink size={10} />}
                                  </button>
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={11} /> Opened {elapsed(session.createdAt)} ago
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <p className="text-xl font-bold text-orange-600 whitespace-nowrap">{fmt(session.totalAmount ?? 0)}</p>
                          <p className="text-xs text-gray-400">
                            {(session.orders ?? []).length} order{(session.orders ?? []).length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {mergeSource && mergeSource.id !== session.id && (
                        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-center">
                          <p className="text-xs text-blue-600 font-medium">Click to merge Table {mergeSource.tableNumber} into this table</p>
                        </div>
                      )}

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
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
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
                          {billingSettings && (() => {
                            const subtotal = session.totalAmount ?? 0;
                            const charges = computeCharges(subtotal, {
                              serviceChargePct: billingSettings.serviceChargePct,
                              taxPct: billingSettings.taxPct,
                            });
                            return (
                              <div className="mt-3 pt-2 border-t border-gray-100 space-y-1 text-sm text-gray-600">
                                <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
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
                                  <span>Grand Total</span><span>{fmt(charges.grandTotal)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="px-5 py-4 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => window.open(`/session-receipt/${session.id}`, '_blank', 'width=400,height=600')}
                            disabled={(session.billItems ?? []).length === 0}
                            className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 font-semibold py-2.5 px-2 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40 text-sm"
                          >
                            <Printer size={15} /> Print
                          </button>
                          <button
                            onClick={() => setSplitSession(session)}
                            disabled={(session.billItems ?? []).length === 0}
                            className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-600 bg-orange-50 font-semibold py-2.5 px-2 rounded-2xl hover:bg-orange-100 transition-colors disabled:opacity-40 text-sm"
                          >
                            <Users size={15} /> Split
                          </button>
                          <button
                            onClick={() => setMergeSource(mergeSource?.id === session.id ? null : session)}
                            className={`flex items-center justify-center gap-1.5 border font-semibold py-2.5 px-2 rounded-2xl transition-colors text-sm ${
                              mergeSource?.id === session.id
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                            }`}
                            title={mergeSource?.id === session.id ? 'Cancel merge' : 'Merge with another table'}
                          >
                            <GitMerge size={15} /> {mergeSource?.id === session.id ? 'Cancel' : 'Merge'}
                          </button>
                        </div>
                        <button
                          onClick={() => setPaymentTarget({ type: 'session', session })}
                          disabled={paying === session.id || (session.billItems ?? []).length === 0}
                          className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-2xl transition-colors text-sm"
                        >
                          {paying === session.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          {paying === session.id ? 'Processing…' : 'Mark as Paid'}
                        </button>
                        {(session.billItems ?? []).length === 0 && (
                          <p className="text-center text-xs text-gray-400">No orders placed yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Paid today ── */}
            {paidToday.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" /> Paid Today ({paidToday.length})
                </h2>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
                  {paidToday.map((session) => {
                    const refundedAmt = refundedBySession[session.id] ?? 0;
                    return (
                      <div key={session.id} className="break-inside-avoid mb-3 lg:mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center font-bold shrink-0">
                              {session.tableNumber}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-700 text-sm truncate">Table {session.tableNumber}</p>
                              <p className="text-xs text-gray-400 whitespace-nowrap">
                                {session.closedAt ? `Paid at ${new Date(session.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Paid'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-gray-700 whitespace-nowrap">{fmt(session.totalAmount ?? 0)}</p>
                              <div className="flex items-center gap-1 justify-end mt-0.5 flex-wrap">
                                {session.paymentMethod && (
                                  <span className="text-xs text-gray-500">
                                    {paymentMethodIcon(session.paymentMethod)} {paymentMethodLabel(session.paymentMethod)}
                                  </span>
                                )}
                                {refundedAmt > 0
                                  ? <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">↩ {fmt(refundedAmt)}</span>
                                  : <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Paid</span>
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(`/session-receipt/${session.id}`, '_blank', 'width=400,height=600')}
                              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Print Receipt"
                            >
                              <Printer size={16} />
                            </button>
                            {canRefund && (
                              <button
                                onClick={() => setRefundTarget({
                                  label: `Table ${session.tableNumber}`,
                                  maxAmount: session.totalAmount ?? 0,
                                  sessionId: session.id,
                                })}
                                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Issue Refund"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : tab === 'takeaway' ? (
          <>
            {/* ── Active takeaway orders ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <h2 className="font-semibold text-gray-700 text-sm">Active Orders ({activeTakeaway.length})</h2>
              </div>

              {activeTakeaway.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                  <ShoppingBag size={32} className="mx-auto mb-2 text-gray-300" />
                  No active takeaway orders
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
                  {activeTakeaway.map((order) => (
                    <div key={order.id} className="break-inside-avoid mb-3 lg:mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                              <ShoppingBag size={18} />
                            </div>
                            <div className="min-w-0">
                              <span className="inline-block font-mono font-bold text-sm text-purple-700 bg-white/70 px-2 py-0.5 rounded-md tracking-wide">
                                #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
                              </span>
                              {order.customerName && <p className="text-xs text-gray-600 truncate mt-1">{order.customerName}</p>}
                            </div>
                          </div>
                          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                            : order.status === 'preparing' ? 'bg-blue-100 text-blue-700'
                            : order.status === 'cancelled' ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-700'
                          }`}>{order.status}</span>
                        </div>
                        <div className="flex items-end justify-between gap-2 mt-2.5">
                          <span className="text-xs text-gray-400 flex items-center gap-1 min-w-0">
                            <Clock size={11} className="shrink-0" /> <span className="truncate">{elapsed(order.createdAt)} ago</span>
                          </span>
                          <span className="text-2xl font-extrabold text-purple-600 leading-none tabular-nums whitespace-nowrap shrink-0">{fmt(order.totalAmount)}</span>
                        </div>
                      </div>

                      <div className="px-5 py-3 border-b border-gray-100">
                        <ul className="space-y-1.5">
                          {order.items.map((item, i) => (
                            <li key={i} className="text-sm flex justify-between">
                              <span className="text-gray-700 flex items-center gap-1.5">
                                <span className="font-bold text-xs text-gray-700 bg-gray-100 rounded-md px-1.5 py-0.5 tabular-nums shrink-0">{item.quantity}×</span> {item.name}
                                {item.size && (
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {item.size === 'large' ? 'L' : 'R'}
                                  </span>
                                )}
                              </span>
                              <span className="text-gray-700 tabular-nums shrink-0">{fmt(item.price * item.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        {billingSettings && (() => {
                          const charges = computeCharges(order.totalAmount, { serviceChargePct: 0, taxPct: billingSettings.taxPct });
                          return (
                            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-sm text-gray-600">
                              {charges.tax > 0 && (
                                <div className="flex justify-between">
                                  <span>Tax ({billingSettings.taxPct}%)</span>
                                  <span>+{fmt(charges.tax)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1">
                                <span>Total</span><span>{fmt(charges.grandTotal)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-5 py-3 flex gap-2.5">
                        <button
                          onClick={() => window.open(`/receipt/${order.id}`, '_blank', 'width=400,height=600')}
                          title="Print receipt"
                          className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition-colors shrink-0"
                        >
                          <Printer size={16} /> Print
                        </button>
                        <button
                          onClick={() => setPaymentTarget({ type: 'order', order })}
                          disabled={payingOrder === order.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-all whitespace-nowrap"
                        >
                          {payingOrder === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          {payingOrder === order.id ? 'Processing…' : 'Mark Paid'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Paid today takeaway ── */}
            {paidTodayTakeaway.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" /> Paid Today ({paidTodayTakeaway.length})
                </h2>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 lg:gap-4">
                  {paidTodayTakeaway.map((order) => {
                    const refundedAmt = refundedByOrder[order.id] ?? 0;
                    return (
                      <div key={order.id} className="break-inside-avoid mb-3 lg:mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                              <ShoppingBag size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-700 text-sm truncate">
                                {order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
                              </p>
                              {order.customerName && <p className="text-xs text-gray-400 truncate">{order.customerName}</p>}
                              <p className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-gray-700 whitespace-nowrap">{fmt(order.totalAmount)}</p>
                              <div className="flex items-center gap-1 justify-end mt-0.5 flex-wrap">
                                {order.paymentMethod && (
                                  <span className="text-xs text-gray-500">
                                    {paymentMethodIcon(order.paymentMethod)} {paymentMethodLabel(order.paymentMethod)}
                                  </span>
                                )}
                                {refundedAmt > 0
                                  ? <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">↩ {fmt(refundedAmt)}</span>
                                  : <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Paid</span>
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(`/receipt/${order.id}`, '_blank', 'width=400,height=600')}
                              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Print Receipt"
                            >
                              <Printer size={16} />
                            </button>
                            {canRefund && (
                              <button
                                onClick={() => setRefundTarget({
                                  label: order.orderNumber ?? order.id.slice(0, 8).toUpperCase(),
                                  maxAmount: order.totalAmount,
                                  orderId: order.id,
                                })}
                                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Issue Refund"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ── Refunds tab ── */
          <section className="space-y-4">
            {todayRefunds.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">Today's Total Refunds</p>
                  <p className="text-xs text-red-400 mt-0.5">{todayRefunds.length} transaction{todayRefunds.length !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {fmt(todayRefunds.reduce((s, r) => s + r.amount, 0))}
                </p>
              </div>
            )}

            {refunds.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center text-gray-400">
                <RotateCcw size={32} className="mx-auto mb-2 text-gray-300" />
                No refunds issued yet
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <RotateCcw size={15} className="text-red-500" />
                  <h2 className="font-semibold text-gray-700 text-sm">All Refunds ({refunds.length})</h2>
                </div>
                <ul className="divide-y divide-gray-50">
                  {refunds.map((r) => (
                    <li key={r.id} className="px-5 py-3.5 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                        <RotateCcw size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{fmt(r.amount)}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {refundMethodLabel(r.refundMethod)}
                          </span>
                          {r.sessionId && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Table Session</span>
                          )}
                          {r.orderId && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Takeaway</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{r.reason}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.createdByName} · {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>

      {splitSession && (
        <SplitBillModal
          session={splitSession}
          settings={billingSettings}
          onClose={() => setSplitSession(null)}
        />
      )}

      {paymentTarget && (
        <PaymentMethodModal
          title="How was this paid?"
          subtitle={
            paymentTarget.type === 'session'
              ? `Table ${paymentTarget.session.tableNumber} — ${fmt(paymentTarget.session.totalAmount ?? 0)}`
              : `${paymentTarget.order.orderNumber ?? 'Takeaway'} — ${fmt(paymentTarget.order.totalAmount)}`
          }
          onConfirm={confirmPayment}
          onClose={() => setPaymentTarget(null)}
          loading={paying !== null || payingOrder !== null}
        />
      )}

      {refundTarget && (
        <RefundModal
          label={refundTarget.label}
          maxAmount={refundTarget.maxAmount}
          orderId={refundTarget.orderId}
          sessionId={refundTarget.sessionId}
          onSuccess={loadRefunds}
          onClose={() => setRefundTarget(null)}
        />
      )}
      </main>
    </div>
  );
}
