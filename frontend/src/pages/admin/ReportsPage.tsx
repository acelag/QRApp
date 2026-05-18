import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, TrendingUp, ShoppingBag, UtensilsCrossed, Loader2, Calendar } from 'lucide-react';
import { reportService, type Report } from '../../services/reportService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';

type Tab = 'sales' | 'items' | 'extras';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildRange(preset: string): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: toDateStr(today), to: toDateStr(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: toDateStr(y), to: toDateStr(y) };
    }
    case 'week': {
      const mon = new Date(today);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      return { from: toDateStr(mon), to: toDateStr(today) };
    }
    case 'month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateStr(first), to: toDateStr(today) };
    }
    case '30days': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: toDateStr(d), to: toDateStr(today) };
    }
    default:
      return { from: toDateStr(today), to: toDateStr(today) };
  }
}

const PRESETS = [
  { key: 'today',   label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: '30days',  label: 'Last 30 Days' },
];

export function ReportsPage() {
  const { fmt } = useCurrency();

  const initial = buildRange('today');
  const [from, setFrom] = useState(initial.from);
  const [to,   setTo]   = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string>('today');
  const [loading, setLoading] = useState(false);
  const [report, setReport]   = useState<Report | null>(null);
  const [tab, setTab]         = useState<Tab>('sales');

  useEffect(() => { fetchReport(initial.from, initial.to); }, []);

  async function fetchReport(f: string, t: string) {
    if (f > t) { toast.error('From date must be before To date'); return; }
    setLoading(true);
    try {
      const data = await reportService.get(f, t);
      setReport(data);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(key: string) {
    const range = buildRange(key);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(key);
    fetchReport(range.from, range.to);
  }

  function handleManualFetch() {
    setActivePreset('');
    fetchReport(from, to);
  }

  const s = report?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <BarChart2 size={20} className="text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900 flex-1">Reports</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-5">

        {/* Date range picker */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activePreset === p.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={to}
                min={from}
                max={toDateStr(new Date())}
                onChange={(e) => { setTo(e.target.value); setActivePreset(''); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <button
                onClick={handleManualFetch}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        )}

        {/* No data yet */}
        {!loading && !report && (
          <div className="text-center py-16 text-gray-400">
            <BarChart2 size={40} className="mx-auto mb-3 text-gray-300" />
            <p>Select a date range and click Generate to view your report.</p>
          </div>
        )}

        {/* Report content */}
        {!loading && report && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-500" />
                  <span className="text-xs text-gray-500 font-medium">Revenue</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmt(s!.totalRevenue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">avg {fmt(s!.avgOrderValue)} / order</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart2 size={16} className="text-blue-500" />
                  <span className="text-xs text-gray-500 font-medium">Orders</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s!.totalOrders}</p>
                <p className="text-xs text-gray-400 mt-0.5">total orders</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed size={16} className="text-orange-500" />
                  <span className="text-xs text-gray-500 font-medium">Dine-in</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s!.dineInOrders}</p>
                <p className="text-xs text-gray-400 mt-0.5">dine-in orders</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag size={16} className="text-purple-500" />
                  <span className="text-xs text-gray-500 font-medium">Takeaway</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s!.takeawayOrders}</p>
                <p className="text-xs text-gray-400 mt-0.5">takeaway orders</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
              {([
                { key: 'sales',  label: 'Sales by Day' },
                { key: 'items',  label: 'Items' },
                ...(report.toppings.length > 0 ? [{ key: 'extras', label: 'Extras' }] : []),
              ] as { key: Tab; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sales by day table */}
            {tab === 'sales' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {report.daily.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No orders in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Dine-in</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Takeaway</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((row) => (
                        <tr key={row.date} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-700 font-medium">
                            {new Date(row.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.orderCount}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.dineInCount}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.takeawayCount}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 border-t border-orange-100">
                        <td className="px-4 py-3 font-bold text-orange-800">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-800">{s!.totalOrders}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">{s!.dineInOrders}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">{s!.takeawayOrders}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-800">{fmt(s!.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* Items table */}
            {tab === 'items' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {report.items.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No items sold in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Base</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Extras</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{row.name}</span>
                            {row.size && (
                              <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                row.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {row.size === 'large' ? 'Large' : 'Regular'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-700">{row.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{fmt(row.baseRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                            {row.toppingRevenue > 0 ? (
                              <span className="text-orange-500">+{fmt(row.toppingRevenue)}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(row.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 border-t border-orange-100">
                        <td className="px-4 py-3 font-bold text-orange-800">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-800">
                          {report.items.reduce((s, r) => s + r.quantity, 0)}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell font-semibold text-orange-700">
                          {fmt(report.items.reduce((s, r) => s + r.baseRevenue, 0))}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell font-semibold text-orange-700">
                          {fmt(report.items.reduce((s, r) => s + r.toppingRevenue, 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-orange-800">{fmt(s!.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* Extras / toppings table */}
            {tab === 'extras' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {report.toppings.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No extras ordered in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Extra / Topping</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Times Ordered</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.toppings.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.timesOrdered}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
