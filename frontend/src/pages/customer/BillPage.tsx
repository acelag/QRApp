import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, CheckCircle2, RefreshCw, Loader2, UtensilsCrossed } from 'lucide-react';
import { sessionService, type Session } from '../../services/sessionService';
import { restaurantService, computeCharges, type RestaurantInfo } from '../../services/restaurantService';
import { useCurrency } from '../../context/CurrencyContext';

const POLL_MS = 12000;

export function BillPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { fmt, loadCurrency } = useCurrency();

  const [session, setSession] = useState<Session | null>(null);
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (id: string) => {
    try {
      let s = await sessionService.getSession(id);
      // If this session was merged into another, show the combined (primary) bill.
      if (s.mergedIntoSessionId) {
        s = await sessionService.getSession(s.mergedIntoSessionId);
      }
      setSession(s);
      if (s.restaurantId) {
        loadCurrency(s.restaurantId);
        restaurantService.getRestaurantInfo(s.restaurantId).then(setInfo).catch(() => {});
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadCurrency]);

  // Initial load
  useEffect(() => { if (sessionId) load(sessionId); }, [sessionId, load]);

  // Live updates — poll while the bill is still open
  useEffect(() => {
    if (!sessionId || session?.status === 'paid') return;
    const timer = setInterval(() => load(sessionId), POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId, session?.status, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <Receipt size={40} className="text-gray-300" />
        <p className="text-gray-600 font-medium">{t('bill.notFound')}</p>
        <p className="text-sm text-gray-400">{t('bill.notFoundHint')}</p>
      </div>
    );
  }

  const items = session.billItems ?? [];
  const subtotal = session.totalAmount ?? 0;
  const paid = session.status === 'paid';
  const { serviceCharge, tax, grandTotal } = computeCharges(subtotal, {
    serviceChargePct: info?.serviceChargePct ?? 0,
    taxPct: info?.taxPct ?? 0,
  });

  const opened = new Date(session.createdAt);
  const closed = session.closedAt ? new Date(session.closedAt) : null;
  const timeFmt = (d: Date) => d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          {info?.logo
            ? <img src={info.logo} alt={info.name} className="w-9 h-9 object-contain rounded-lg" />
            : <UtensilsCrossed size={22} className="text-orange-500" />}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{info?.name ?? 'Bill'}</h1>
            <p className="text-xs text-gray-500">{t('bill.tableNumber', { number: session.tableNumber })}</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Status banner */}
        {paid ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-2xl px-4 py-3 mb-4">
            <CheckCircle2 size={22} className="shrink-0 text-green-600" />
            <div>
              <p className="font-semibold leading-tight">{t('bill.paidTitle')}</p>
              <p className="text-xs text-green-700">
                {closed ? timeFmt(closed) : ''}{session.paymentMethod ? ` · ${session.paymentMethod}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-100 text-orange-700 rounded-2xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
              </span>
              <span className="font-semibold text-sm">{t('bill.runningTitle')}</span>
            </div>
            <button
              onClick={() => sessionId && load(sessionId)}
              className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              <RefreshCw size={13} /> {t('bill.refresh')}
            </button>
          </div>
        )}

        {/* Bill card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">{t('bill.empty')}</div>
          ) : (
            <>
              <div className="px-5 py-4 space-y-3">
                {items.map((item, idx) => {
                  const toppingsTotal = (item.toppings ?? []).reduce((s, tp) => s + tp.price, 0);
                  return (
                    <div key={idx}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-gray-800">
                          <span className="font-semibold text-gray-900">{item.quantity}×</span> {item.name}
                          {item.size === 'large' ? ' (Large)' : ''}
                        </span>
                        <span className="text-gray-900 font-medium whitespace-nowrap">{fmt(item.total)}</span>
                      </div>
                      {(item.toppings ?? []).map((tp, ti) => (
                        <div key={ti} className="flex justify-between text-xs text-gray-400 pl-4">
                          <span>+ {tp.name}</span>
                          {tp.price > 0 && <span>{fmt(tp.price)}</span>}
                        </div>
                      ))}
                      <p className="text-xs text-gray-400 pl-4">{fmt(item.price + toppingsTotal)} {t('bill.each')}</p>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="px-5 py-4 border-t border-dashed border-gray-200 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t('bill.subtotal')}</span><span>{fmt(subtotal)}</span>
                </div>
                {serviceCharge > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>{info?.serviceChargeName ?? 'Service Charge'} ({info?.serviceChargePct}%)</span>
                    <span>{fmt(serviceCharge)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>{info?.taxName ?? 'Tax'} ({info?.taxPct}%)</span>
                    <span>{fmt(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                  <span className="font-bold text-gray-900">{t('bill.total')}</span>
                  <span className="text-xl font-bold text-orange-600">{fmt(grandTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {t('bill.openedAt', { time: timeFmt(opened) })}
        </p>
        <p className="text-center text-xs text-gray-400 mt-1">
          {paid ? t('bill.thankYou') : t('bill.liveHint')}
        </p>
      </main>
    </div>
  );
}
