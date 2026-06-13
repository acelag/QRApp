import { useEffect, useState, useRef } from 'react';
import {
  Printer, RefreshCw, AlertTriangle,
  TrendingUp, ShoppingBag, UtensilsCrossed, BedDouble,
  RotateCcw, CheckCircle2, Loader2,
} from 'lucide-react';
import { reportService, type ShiftCloseReport } from '../../services/reportService';
import { refundMethodLabel } from '../../services/refundService';
import { useCurrency } from '../../context/CurrencyContext';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

const PAYMENT_ICONS: Record<string, string> = {
  cash: '💵', card: '💳', qr: '📱', bank_transfer: '🏦', other: '📋', unpaid: '',
};

function fmt_time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmt_datetime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Core component  -  no sidebar, no <main> wrapper
export function ShiftCloseReport() {
  const { fmt } = useCurrency();
  const today = new Date().toLocaleDateString('en-CA');   // YYYY-MM-DD
  const [date, setDate]       = useState(today);
  const [report, setReport]   = useState<ShiftCloseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  async function load(d: string) {
    setLoading(true);
    setError('');
    try {
      const data = await reportService.getShiftClose(d);
      setReport(data);
    } catch {
      setError('Failed to load shift report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(date); }, [date]);

  function handlePrint() {
    window.print();
  }

  const s = report?.summary;

  return (
    <>
      {/* Header  -  hidden on print */}
      <div className="print:hidden">
        <AdminHeader title="Shift Close Report" backTo="/admin">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 shrink-0"
          />
          <button onClick={() => load(date)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </AdminHeader>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center pt-24 gap-3">
          <Loader2 size={32} className="animate-spin text-orange-500" />
          <p className="text-gray-400 text-sm">Generating reportâ€¦</p>
        </div>
      ) : error ? (
        <div className="flex justify-center pt-24">
          <p className="text-red-500">{error}</p>
        </div>
      ) : report && s ? (
        <div ref={printRef} className="px-3 sm:px-4 lg:px-6 py-6 space-y-6">

          {/* â”€â”€ Print header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="hidden print:block mb-6 border-b border-gray-300 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">End-of-Day Report</h1>
            <p className="text-gray-600 mt-0.5">
              {new Date(report.date + 'T12:00:00').toLocaleDateString([], {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
              &nbsp; . &nbsp;Generated at {fmt_time(report.generatedAt)}
            </p>
          </div>

          {/* â”€â”€ Date badge (screen only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="print:hidden flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {new Date(report.date + 'T12:00:00').toLocaleDateString([], {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Generated at {fmt_datetime(report.generatedAt)}
              </p>
            </div>
            {report.openSessions.length > 0 && (
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 text-xs font-medium px-3 py-1.5 rounded-full">
                <AlertTriangle size={13} />
                {report.openSessions.length} open table{report.openSessions.length > 1 ? 's' : ''} remaining
              </span>
            )}
          </div>

          {/* â”€â”€ Revenue summary cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Gross Revenue</p>
                <p className="text-xl font-bold text-gray-800">{fmt(s.grossRevenue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.orderCount} orders</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Refunds</p>
                <p className={`text-xl font-bold ${s.totalRefunds > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {s.totalRefunds > 0 ? `- ${fmt(s.totalRefunds)}` : ' - '}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{report.refunds.length} issued</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-4 shadow-sm border border-green-100">
                <p className="text-xs text-green-600 mb-1">Net Revenue</p>
                <p className="text-xl font-bold text-green-700">{fmt(s.netRevenue)}</p>
                <p className="text-xs text-green-500 mt-0.5">Avg {fmt(s.avgOrderValue)}/order</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Discounts</p>
                <p className={`text-xl font-bold ${s.totalDiscounts > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                  {s.totalDiscounts > 0 ? `- ${fmt(s.totalDiscounts)}` : ' - '}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Promo savings</p>
              </div>
            </div>
          </section>

          {/* â”€â”€ Order type breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Orders by Type</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {[
                { label: 'Dine-In',      icon: UtensilsCrossed, color: 'text-blue-500',   data: s.dineIn },
                { label: 'Takeaway',     icon: ShoppingBag,     color: 'text-purple-500', data: s.takeaway },
                { label: 'Room Service', icon: BedDouble,       color: 'text-orange-500', data: s.roomService },
              ].map(({ label, icon: Icon, color, data }, i) => (
                <div key={label} className={`flex items-center px-5 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <Icon size={16} className={`${color} mr-3 shrink-0`} />
                  <span className="text-sm text-gray-700 font-medium flex-1">{label}</span>
                  <span className="text-sm text-gray-500 mr-6">{data.count} orders</span>
                  <span className="text-sm font-semibold text-gray-800 w-24 text-right">{fmt(data.revenue)}</span>
                </div>
              ))}
              <div className="flex items-center px-5 py-3.5 border-t border-gray-100 bg-gray-50">
                <TrendingUp size={16} className="text-gray-400 mr-3 shrink-0" />
                <span className="text-sm font-semibold text-gray-700 flex-1">Total</span>
                <span className="text-sm text-gray-500 mr-6">{s.orderCount} orders</span>
                <span className="text-sm font-bold text-gray-900 w-24 text-right">{fmt(s.grossRevenue)}</span>
              </div>
            </div>
          </section>

          {/* â”€â”€ Payment methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Methods</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {report.paymentMethods.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No payments recorded</p>
              ) : report.paymentMethods.map((pm, i) => (
                <div key={pm.method} className={`flex items-center px-5 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <span className="text-base mr-3">{PAYMENT_ICONS[pm.method] ?? '💰'}</span>
                  <span className="text-sm text-gray-700 font-medium capitalize flex-1">
                    {pm.method === 'unpaid' ? 'Unpaid / Pending' : pm.method.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-500 mr-6">{pm.count} orders</span>
                  <span className="text-sm font-semibold text-gray-800 w-24 text-right">{fmt(pm.revenue)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* â”€â”€ Open sessions warning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {report.openSessions.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Open Tables (Not Yet Settled)
              </h2>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                {report.openSessions.map((sess, i) => (
                  <div key={sess.id} className={`flex items-center px-5 py-3.5 ${i > 0 ? 'border-t border-amber-100' : ''}`}>
                    <span className="text-sm font-semibold text-amber-800 flex-1">Table {sess.tableNumber}</span>
                    <span className="text-xs text-amber-600 mr-6">Opened {fmt_time(sess.openedAt)}</span>
                    <span className="text-sm font-semibold text-amber-800 w-24 text-right">{fmt(sess.estimatedTotal)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* â”€â”€ Top items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {report.topItems.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Items</h2>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {report.topItems.map((item, i) => {
                  const maxQty = report.topItems[0].quantity;
                  const pct    = Math.round((item.quantity / maxQty) * 100);
                  return (
                    <div key={`${item.name}-${i}`} className={`px-5 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}</span>
                        <span className="text-sm text-gray-700 font-medium flex-1 ml-2">{item.name}</span>
                        <span className="text-xs text-gray-500 mr-4">x{item.quantity}</span>
                        <span className="text-sm font-semibold text-gray-800 w-20 text-right">{fmt(item.revenue)}</span>
                      </div>
                      <div className="mt-1.5 ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* â”€â”€ Refunds log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <RotateCcw size={13} /> Refunds Issued
            </h2>
            {report.refunds.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-2 text-green-600">
                <CheckCircle2 size={16} />
                <span className="text-sm font-medium">No refunds today</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {report.refunds.map((r, i) => (
                  <div key={r.id} className={`px-5 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="flex items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{r.reason}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmt_time(r.createdAt)}  .  {r.issuedBy}  .  via {refundMethodLabel(r.method)}
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-red-600 shrink-0">- {fmt(r.amount)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center px-5 py-3 border-t border-gray-100 bg-red-50">
                  <span className="text-sm font-semibold text-red-700 flex-1">Total Refunded</span>
                  <span className="text-sm font-bold text-red-700">- {fmt(s.totalRefunds)}</span>
                </div>
              </div>
            )}
          </section>

          {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="text-center text-xs text-gray-300 py-4 print:block">
            Report generated {fmt_datetime(report.generatedAt)}
          </div>

        </div>
      ) : null}

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block  { display: block  !important; }
        }
      `}</style>
    </>
  );
}

// Layout wrapper  -  keeps /admin/shift-close route working
export function ShiftCloseReportPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
        <ShiftCloseReport />
      </main>
    </div>
  );
}
