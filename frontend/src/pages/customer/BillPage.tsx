import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RefreshCw, Loader2, Receipt, Download } from 'lucide-react';
import { sessionService, type Session } from '../../services/sessionService';
import { restaurantService, computeCharges, type RestaurantInfo } from '../../services/restaurantService';
import { useCurrency } from '../../context/CurrencyContext';

const POLL_MS = 12000;

function Divider({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className={`border-t my-3 ${dashed ? 'border-dashed border-gray-300' : 'border-gray-200'}`} />
  );
}

export function BillPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { fmt, loadCurrency } = useCurrency();

  const [session, setSession] = useState<Session | null>(null);
  const [info, setInfo]       = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async (id: string) => {
    try {
      let s = await sessionService.getSession(id);
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

  useEffect(() => { if (sessionId) load(sessionId); }, [sessionId, load]);

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

  const items    = session.billItems ?? [];
  const orders   = (session.orders ?? []).filter((o) => o.status !== 'cancelled');
  const subtotal = session.totalAmount ?? 0;
  const paid     = session.status === 'paid';
  const { serviceCharge, tax, grandTotal } = computeCharges(subtotal, {
    serviceChargePct: info?.serviceChargePct ?? 0,
    taxPct:           info?.taxPct           ?? 0,
  });

  const showOrderNo   = info?.receiptShowOrderNo   !== false;
  const showUnitPrice = info?.receiptShowUnitPrice !== false;
  const footerLine1   = info?.receiptFooterLine1 ?? 'Thank you for dining with us!';
  const footerLine2   = info?.receiptFooterLine2 ?? 'Please come again 🙏';
  const headerLine1   = info?.receiptHeaderLine1 ?? '';
  const headerLine2   = info?.receiptHeaderLine2 ?? '';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">

      {/* Status bar */}
      <div className="no-print w-full max-w-sm mb-4">
        {paid ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-2xl px-4 py-3">
            <CheckCircle2 size={18} className="shrink-0 text-green-600" />
            <p className="font-semibold text-sm">{t('bill.paidTitle')}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-100 text-orange-700 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <span className="font-semibold text-sm">{t('bill.runningTitle')}</span>
            </div>
            <button
              onClick={() => sessionId && load(sessionId)}
              className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              <RefreshCw size={12} /> {t('bill.refresh')}
            </button>
          </div>
        )}
      </div>

      {/* Receipt card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md overflow-hidden">
        {/* Restaurant header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-dashed border-gray-200">
          {info?.logo && (
            <img src={info.logo} alt={info.name} className="w-14 h-14 object-contain mx-auto mb-3 rounded-xl" />
          )}
          <h1 className="text-lg font-bold text-gray-900">{info?.name ?? 'Restaurant'}</h1>
          {headerLine1 && <p className="text-xs text-gray-500 mt-0.5">{headerLine1}</p>}
          {headerLine2 && <p className="text-xs text-gray-500">{headerLine2}</p>}

          <div className="mt-3">
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase">Dining Bill</p>
            <p className="text-xs text-gray-400 mt-0.5">Table {session.tableNumber}</p>
          </div>
        </div>

        {/* Order numbers */}
        {showOrderNo && orders.length > 0 && (
          <div className="px-6 pt-3">
            {orders.map((o) => o.orderNumber && (
              <div key={o.id} className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Order No:</span>
                <span className="font-mono font-semibold text-gray-700">{o.orderNumber}</span>
              </div>
            ))}
            <Divider dashed />
          </div>
        )}

        {/* Items */}
        <div className="px-6 pb-2">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">{t('bill.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, idx) => {
                const toppingsCost = (item.toppings ?? []).reduce((s, tp) => s + tp.price, 0);
                const unitPrice    = item.price + toppingsCost;
                return (
                  <li key={idx}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-800 flex-1 pr-2">
                        <span className="font-semibold">{item.quantity}x</span> {item.name}
                        {item.size === 'large' ? ' (L)' : ''}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {fmt(item.total)}
                      </span>
                    </div>
                    {(item.toppings ?? []).map((tp, ti) => (
                      <div key={ti} className="flex justify-between text-xs text-gray-400 pl-5 mt-0.5">
                        <span>+ {tp.name}</span>
                        {tp.price > 0 && <span className="tabular-nums">{fmt(tp.price)}</span>}
                      </div>
                    ))}
                    {showUnitPrice && (
                      <p className="text-xs text-gray-400 pl-5 mt-0.5">{fmt(unitPrice)} each</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="px-6 pb-5">
            <Divider dashed />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              {serviceCharge > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{info?.serviceChargeName ?? 'Service Charge'} ({info?.serviceChargePct}%)</span>
                  <span className="tabular-nums">{fmt(serviceCharge)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{info?.taxName ?? 'Tax'} ({info?.taxPct}%)</span>
                  <span className="tabular-nums">{fmt(tax)}</span>
                </div>
              )}
            </div>
            <Divider />
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-900 text-base">TOTAL</span>
              <span className="font-bold text-gray-900 text-base tabular-nums">{fmt(grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 text-center border-t border-dashed border-gray-200 pt-4">
          <p className="text-sm text-gray-600 font-medium">{footerLine1}</p>
          {footerLine2 && <p className="text-xs text-gray-400 mt-1">{footerLine2}</p>}
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={() => window.print()}
        className="no-print mt-4 flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl hover:bg-gray-700 active:scale-[0.98] transition-all"
      >
        <Download size={15} /> Download / Save PDF
      </button>

      <p className="no-print text-xs text-gray-400 mt-3">
        {t('bill.openedAt', { time: new Date(session.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
      </p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
