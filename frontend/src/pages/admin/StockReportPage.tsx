import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Package, Warehouse, AlertTriangle, Banknote,
  ArrowDownCircle, ArrowUpCircle, Loader2, Calendar, Download, Search,
} from 'lucide-react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { stockService, type StockReport } from '../../services/stockService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';

// ── CSV helpers ──────────────────────────────────────────────────────────────
function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function buildRange(preset: string): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'today':     return { from: toDateStr(today), to: toDateStr(today) };
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
    default: return { from: toDateStr(today), to: toDateStr(today) };
  }
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StockReportPage() {
  const { fmt } = useCurrency();

  const PRESETS = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'This Week' },
    { key: 'month',  label: 'This Month' },
    { key: '30days', label: 'Last 30 Days' },
  ];

  const initial = buildRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to,   setTo]   = useState(initial.to);
  const [activePreset, setActivePreset] = useState('month');
  const [loading, setLoading] = useState(false);
  const [report,  setReport]  = useState<StockReport | null>(null);
  const [search,  setSearch]  = useState('');

  async function fetchReport(f: string, t: string) {
    if (f > t) { toast.error('Start date must be before end date'); return; }
    setLoading(true);
    try {
      setReport(await stockService.getReport(f, t));
    } catch {
      toast.error('Failed to load stock report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReport(initial.from, initial.to); }, []);

  function applyPreset(key: string) {
    const r = buildRange(key);
    setFrom(r.from); setTo(r.to); setActivePreset(key);
    fetchReport(r.from, r.to);
  }

  function exportCsv() {
    if (!report) return;
    downloadCsv(`stock-report-${from}-${to}.csv`, [
      ['Item', 'Category', 'Unit', 'Current Qty', 'Min', 'Stock Value', 'Stock In', 'Stock Out', 'Movements'],
      ...report.items.map((i) => [
        i.name, i.category ?? '', i.unit, i.quantity, i.minThreshold,
        i.stockValue.toFixed(2), i.totalIn, i.totalOut, i.movementCount,
      ]),
    ]);
    toast.success('CSV downloaded');
  }

  const s = report?.summary;
  const displayedItems = (report?.items ?? []).filter(
    (i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">

        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
            <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
            <Warehouse size={20} className="text-orange-500" />
            <h1 className="text-xl font-bold text-gray-900 flex-1">Stock Report</h1>
          </div>
        </header>

        <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-5">

          {/* Date range picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activePreset === p.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar size={16} className="text-gray-400 shrink-0" />
              <input
                type="date" value={from} max={to}
                onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date" value={to} min={from} max={toDateStr(new Date())}
                onChange={(e) => { setTo(e.target.value); setActivePreset(''); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <button
                onClick={() => { setActivePreset(''); fetchReport(from, to); }}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Warehouse size={14} />}
                Generate
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
          )}

          {!loading && report && s && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2"><Warehouse size={16} className="text-orange-500" /><span className="text-xs text-gray-500 font-medium">Stock Items</span></div>
                  <p className="text-2xl font-bold text-gray-900">{s.totalItems}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2"><Banknote size={16} className="text-blue-500" /><span className="text-xs text-gray-500 font-medium">Stock Value</span></div>
                  <p className="text-2xl font-bold text-gray-900">{fmt(s.totalStockValue)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2"><ArrowDownCircle size={16} className="text-green-500" /><span className="text-xs text-gray-500 font-medium">Stock In</span></div>
                  <p className="text-2xl font-bold text-green-600">{s.totalIn}</p>
                  <p className="text-xs text-gray-400 mt-0.5">units received</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2"><ArrowUpCircle size={16} className="text-red-500" /><span className="text-xs text-gray-500 font-medium">Stock Out</span></div>
                  <p className="text-2xl font-bold text-red-500">{s.totalOut}</p>
                  <p className="text-xs text-gray-400 mt-0.5">units consumed</p>
                </div>
              </div>

              {/* Low stock banner */}
              {(s.lowStockItems > 0 || s.outOfStockItems > 0) && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    {s.lowStockItems} item{s.lowStockItems !== 1 ? 's' : ''} low on stock
                    {s.outOfStockItems > 0 && <> · <span className="text-red-600 font-bold">{s.outOfStockItems} out of stock</span></>}
                  </p>
                  <Link to="/admin/stock" className="ml-auto text-xs text-orange-500 font-semibold hover:underline shrink-0">Manage →</Link>
                </div>
              )}

              {/* Search + export */}
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                    placeholder="Search items or category…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Download size={14} /> CSV
                </button>
              </div>

              {/* Items table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Stock Levels &amp; Movement ({from} → {to})
                  </p>
                </div>
                {displayedItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Package size={36} className="mx-auto mb-2 text-gray-200" />
                    <p>{report.items.length === 0 ? 'No stock items yet' : 'No items match your search'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Current</th>
                          <th className="text-right px-4 py-3 font-semibold text-green-600">In</th>
                          <th className="text-right px-4 py-3 font-semibold text-red-500">Out</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Stock Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedItems.map((i) => (
                          <tr key={i.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i.isLow ? 'bg-amber-50/40' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{i.name}</span>
                                {i.isOut
                                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Out</span>
                                  : i.isLow
                                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low</span>
                                  : null}
                              </div>
                              {i.category && <p className="text-xs text-gray-400 mt-0.5">{i.category}</p>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold ${i.isLow ? 'text-amber-600' : 'text-gray-900'}`}>{i.quantity}</span>
                              <span className="text-gray-400 text-xs ml-1">{i.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">{i.totalIn > 0 ? `+${i.totalIn}` : '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-500">{i.totalOut > 0 ? `-${i.totalOut}` : '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-700 hidden sm:table-cell">{fmt(i.stockValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-orange-50 border-t border-orange-100">
                          <td className="px-4 py-3 font-bold text-orange-800">Total</td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 text-right font-bold text-green-700">+{s.totalIn}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">-{s.totalOut}</td>
                          <td className="px-4 py-3 text-right font-bold text-orange-800 hidden sm:table-cell">{fmt(s.totalStockValue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Movement log */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Movement Log</p>
                  <span className="text-xs text-gray-400">{report.movements.length} movement{report.movements.length !== 1 ? 's' : ''}</span>
                </div>
                {report.movements.length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-sm">No movements in this period</p>
                ) : (
                  <ul className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                    {report.movements.map((m) => (
                      <li key={m.id} className="flex items-start gap-3 px-5 py-3">
                        <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${m.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {m.type === 'in'
                            ? <ArrowDownCircle size={14} className="text-green-600" />
                            : <ArrowUpCircle size={14} className="text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-800 truncate">{m.itemName}</span>
                            <span className={`text-sm font-bold shrink-0 ${m.type === 'in' ? 'text-green-700' : 'text-red-600'}`}>
                              {m.type === 'in' ? '+' : '-'}{m.quantity} {m.itemUnit}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {m.reason && <span className="text-xs text-gray-500">{m.reason}</span>}
                            {m.createdByName && <span className="text-xs text-gray-400">· {m.createdByName}</span>}
                            <span className="text-xs text-gray-400">· {fmtDateTime(m.createdAt)}</span>
                          </div>
                          {m.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{m.notes}"</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
