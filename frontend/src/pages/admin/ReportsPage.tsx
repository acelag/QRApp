import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, TrendingUp, ShoppingBag, UtensilsCrossed, Loader2, Calendar, LayoutGrid, Flame, Download, Printer, Tag } from 'lucide-react';
import { reportService, type Report } from '../../services/reportService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';

// ── CSV helpers ──────────────────────────────────────────────────────────────
function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const text = rows.map(csvRow).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildCsv(report: Report, tab: Tab, from: string, to: string, fmt: (n: number) => string) {
  const prefix = `report-${from}-${to}`;
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
    h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
  );
  switch (tab) {
    case 'sales':
      downloadCsv(`${prefix}-sales.csv`, [
        ['Date', 'Orders', 'Dine-in', 'Takeaway', 'Revenue'],
        ...report.daily.map((r) => [r.date, r.orderCount, r.dineInCount, r.takeawayCount, r.revenue]),
        ['TOTAL', report.summary.totalOrders, report.summary.dineInOrders, report.summary.takeawayOrders, report.summary.totalRevenue],
      ]);
      break;
    case 'categories': {
      const totalRev = report.categories.reduce((s, r) => s + r.revenue, 0);
      downloadCsv(`${prefix}-categories.csv`, [
        ['Category', 'Items Sold', 'Revenue', '% of Total'],
        ...report.categories.map((r) => [r.name, r.quantity, r.revenue, ((r.revenue / (totalRev || 1)) * 100).toFixed(1) + '%']),
        ['TOTAL', report.categories.reduce((s, r) => s + r.quantity, 0), totalRev, '100%'],
      ]);
      break;
    }
    case 'items':
      downloadCsv(`${prefix}-items.csv`, [
        ['Item', 'Size', 'Qty', 'Base Revenue', 'Extras Revenue', 'Total Revenue'],
        ...report.items.map((r) => [r.name, r.size ?? '', r.quantity, r.baseRevenue, r.toppingRevenue, r.totalRevenue]),
        ['TOTAL', '', report.items.reduce((s, r) => s + r.quantity, 0), report.items.reduce((s, r) => s + r.baseRevenue, 0), report.items.reduce((s, r) => s + r.toppingRevenue, 0), report.summary.totalRevenue],
      ]);
      break;
    case 'extras':
      downloadCsv(`${prefix}-extras.csv`, [
        ['Extra / Topping', 'Times Ordered', 'Revenue'],
        ...report.toppings.map((r) => [r.name, r.timesOrdered, r.revenue]),
      ]);
      break;
    case 'heatmap':
      downloadCsv(`${prefix}-heatmap.csv`, [
        ['Day', 'Hour', 'Orders', 'Revenue'],
        ...report.heatmap.map((r) => [DAY_LABELS[r.dayOfWeek], HOUR_LABELS[r.hour], r.orderCount, r.revenue]),
      ]);
      break;
    case 'promos':
      downloadCsv(`${prefix}-promo-codes.csv`, [
        ['Code', 'Type', 'Value', 'Status', 'Times Used', 'Total Discount', 'Avg Discount'],
        ...report.promos.map((r) => [
          r.code,
          r.type,
          r.type === 'percentage' ? `${r.value}%` : r.value,
          r.active ? 'Active' : 'Inactive',
          r.orderCount,
          r.totalDiscount,
          r.avgDiscount,
        ]),
        ['TOTAL', '', '', '', report.promos.reduce((s, r) => s + r.orderCount, 0), report.promos.reduce((s, r) => s + r.totalDiscount, 0), ''],
      ]);
      break;
  }
  void fmt; // used in switch above indirectly; keep lint happy
  toast.success('CSV downloaded');
}

// ── PDF / Print helper ───────────────────────────────────────────────────────
const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; color: #ea580c; border-bottom: 1px solid #fed7aa; padding-bottom: 3px; }
  p  { font-size: 11px; color: #666; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #fff7ed; color: #9a3412; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px; text-align: left; border-bottom: 1px solid #fed7aa; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  .right { text-align: right; }
  .total td { font-weight: bold; background: #fff7ed; border-top: 2px solid #fed7aa; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
  .card .val { font-size: 18px; font-weight: bold; color: #ea580c; }
  .card .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
  @page { size: A4; margin: 15mm; }
  @media print { body { padding: 0; } }
`;

function buildPdf(report: Report, from: string, to: string, fmt: (n: number) => string) {
  const s = report.summary;
  const totalCatRev = report.categories.reduce((sum, r) => sum + r.revenue, 0);

  const summaryHtml = `
    <div class="summary">
      <div class="card"><div class="val">${fmt(s.totalRevenue)}</div><div class="lbl">Total Revenue</div></div>
      <div class="card"><div class="val">${s.totalOrders}</div><div class="lbl">Total Orders</div></div>
      <div class="card"><div class="val">${s.dineInOrders}</div><div class="lbl">Dine-in</div></div>
      <div class="card"><div class="val">${s.takeawayOrders}</div><div class="lbl">Takeaway</div></div>
    </div>`;

  const dailyHtml = report.daily.length ? `
    <h2>Sales by Day</h2>
    <table>
      <thead><tr><th>Date</th><th class="right">Orders</th><th class="right">Dine-in</th><th class="right">Takeaway</th><th class="right">Revenue</th></tr></thead>
      <tbody>
        ${report.daily.map((r) => `<tr><td>${r.date}</td><td class="right">${r.orderCount}</td><td class="right">${r.dineInCount}</td><td class="right">${r.takeawayCount}</td><td class="right">${fmt(r.revenue)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr class="total"><td>Total</td><td class="right">${s.totalOrders}</td><td class="right">${s.dineInOrders}</td><td class="right">${s.takeawayOrders}</td><td class="right">${fmt(s.totalRevenue)}</td></tr></tfoot>
    </table>` : '';

  const catHtml = report.categories.length ? `
    <h2>Sales by Category</h2>
    <table>
      <thead><tr><th>Category</th><th class="right">Items Sold</th><th class="right">Revenue</th><th class="right">Share</th></tr></thead>
      <tbody>
        ${report.categories.map((r) => `<tr><td>${r.name}</td><td class="right">${r.quantity}</td><td class="right">${fmt(r.revenue)}</td><td class="right">${((r.revenue / (totalCatRev || 1)) * 100).toFixed(1)}%</td></tr>`).join('')}
      </tbody>
      <tfoot><tr class="total"><td>Total</td><td class="right">${report.categories.reduce((s, r) => s + r.quantity, 0)}</td><td class="right">${fmt(totalCatRev)}</td><td class="right">100%</td></tr></tfoot>
    </table>` : '';

  const itemsHtml = report.items.length ? `
    <h2>Item Performance</h2>
    <table>
      <thead><tr><th>Item</th><th>Size</th><th class="right">Qty</th><th class="right">Base</th><th class="right">Extras</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${report.items.map((r) => `<tr><td>${r.name}</td><td>${r.size ?? '—'}</td><td class="right">${r.quantity}</td><td class="right">${fmt(r.baseRevenue)}</td><td class="right">${r.toppingRevenue > 0 ? '+' + fmt(r.toppingRevenue) : '—'}</td><td class="right">${fmt(r.totalRevenue)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr class="total"><td>Total</td><td></td><td class="right">${report.items.reduce((s, r) => s + r.quantity, 0)}</td><td class="right">${fmt(report.items.reduce((s, r) => s + r.baseRevenue, 0))}</td><td class="right">${fmt(report.items.reduce((s, r) => s + r.toppingRevenue, 0))}</td><td class="right">${fmt(s.totalRevenue)}</td></tr></tfoot>
    </table>` : '';

  const extrasHtml = report.toppings.length ? `
    <h2>Extras / Toppings</h2>
    <table>
      <thead><tr><th>Extra</th><th class="right">Times Ordered</th><th class="right">Revenue</th></tr></thead>
      <tbody>${report.toppings.map((r) => `<tr><td>${r.name}</td><td class="right">${r.timesOrdered}</td><td class="right">${fmt(r.revenue)}</td></tr>`).join('')}</tbody>
    </table>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales Report ${from} – ${to}</title><style>${PDF_STYLES}</style></head>
    <body>
      <h1>Sales Report</h1>
      <p>${from === to ? from : `${from} – ${to}`} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}</p>
      ${summaryHtml}${dailyHtml}${catHtml}${itemsHtml}${extrasHtml}
    </body></html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) { toast.error('Pop-up blocked — allow pop-ups and try again'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already triggered */ } }, 500);
  toast.success('Print / Save as PDF dialog opened');
}

type Tab = 'sales' | 'items' | 'extras' | 'categories' | 'heatmap' | 'promos';

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
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <BarChart2 size={20} className="text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900 flex-1">Reports</h1>
        </div>
      </header>

      <main className="px-3 sm:px-4 lg:px-6 py-4 space-y-5">

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

            {/* Tabs + export buttons */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
              {([
                { key: 'sales',      label: 'Sales by Day' },
                { key: 'heatmap',    label: '🔥 Heatmap' },
                { key: 'categories', label: 'Categories' },
                { key: 'items',      label: 'Items' },
                ...(report.toppings.length > 0 ? [{ key: 'extras', label: 'Extras' }] : []),
                { key: 'promos',     label: '🏷️ Promo Codes' },
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
            {/* Export buttons */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => buildCsv(report, tab, from, to, fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={() => buildPdf(report, from, to, fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <Printer size={14} /> PDF
              </button>
            </div>
            </div>

            {/* Heatmap tab */}
            {tab === 'heatmap' && (() => {
              const cells = report.heatmap;
              // Build lookup: [dayOfWeek][hour] → orderCount
              const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
              const revGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
              cells.forEach((c) => { grid[c.dayOfWeek][c.hour] = c.orderCount; revGrid[c.dayOfWeek][c.hour] = c.revenue; });
              const maxCount = Math.max(1, ...cells.map((c) => c.orderCount));

              // Day labels — reorder so Monday first (DOW: Sun=0)
              const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun
              const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
                h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`
              );

              // Peak stats
              const peakCell  = cells.reduce((best, c) => c.orderCount > best.orderCount ? c : best, { dayOfWeek: 0, hour: 0, orderCount: 0, revenue: 0 });
              const hourTotals = Array(24).fill(0) as number[];
              cells.forEach((c) => { hourTotals[c.hour] += c.orderCount; });
              const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

              const totalOrders = cells.reduce((s, c) => s + c.orderCount, 0);

              function cellBg(count: number): string {
                if (count === 0) return '#f9fafb';
                const intensity = count / maxCount;
                // interpolate from light orange to deep orange
                const r = Math.round(255 - (255 - 234) * intensity);
                const g = Math.round(237 - (237 - 88) * intensity);
                const b = Math.round(213 - (213 - 36) * intensity);
                return `rgb(${r},${g},${b})`;
              }
              function cellText(count: number): string {
                return count / maxCount > 0.5 ? '#fff' : '#374151';
              }

              return (
                <div className="space-y-4">
                  {/* Peak stats */}
                  {totalOrders === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                      <Flame size={32} className="mx-auto mb-2 text-gray-200" />
                      <p>No orders in this period.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                          <p className="text-2xl font-bold text-orange-500">{HOUR_LABELS[peakHour]}</p>
                          <p className="text-xs text-gray-400 mt-1">Busiest hour</p>
                          <p className="text-xs text-gray-500 font-medium">{hourTotals[peakHour]} orders</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                          <p className="text-2xl font-bold text-orange-500">{DAY_LABELS[peakCell.dayOfWeek]}</p>
                          <p className="text-xs text-gray-400 mt-1">Peak slot</p>
                          <p className="text-xs text-gray-500 font-medium">{HOUR_LABELS[peakCell.hour]} · {peakCell.orderCount} orders</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                          <p className="text-2xl font-bold text-orange-500">{totalOrders}</p>
                          <p className="text-xs text-gray-400 mt-1">Total orders</p>
                          <p className="text-xs text-gray-500 font-medium">in period</p>
                        </div>
                      </div>

                      {/* Heatmap grid */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders by Day &amp; Hour</p>
                          <p className="text-xs text-gray-400">UTC times</p>
                        </div>
                        <div className="overflow-x-auto px-4 pb-4">
                          <div style={{ minWidth: 560 }}>
                            {/* Hour header */}
                            <div className="flex mb-1 ml-10">
                              {HOUR_LABELS.map((h, i) => (
                                <div key={i} className="flex-1 text-center text-gray-400 font-mono" style={{ fontSize: 9 }}>{i % 3 === 0 ? h : ''}</div>
                              ))}
                            </div>
                            {/* Rows */}
                            {DAY_ORDER.map((dow) => (
                              <div key={dow} className="flex items-center mb-0.5">
                                <div className="w-10 shrink-0 text-xs font-semibold text-gray-500 pr-1 text-right">{DAY_LABELS[dow]}</div>
                                {Array.from({ length: 24 }, (_, h) => {
                                  const count = grid[dow][h];
                                  const rev   = revGrid[dow][h];
                                  return (
                                    <div
                                      key={h}
                                      className="flex-1 mx-px rounded-sm flex items-center justify-center cursor-default"
                                      style={{ height: 28, backgroundColor: cellBg(count) }}
                                      title={count > 0 ? `${DAY_LABELS[dow]} ${HOUR_LABELS[h]}: ${count} orders · ${fmt(rev)}` : undefined}
                                    >
                                      {count > 0 && (
                                        <span style={{ fontSize: 9, fontWeight: 700, color: cellText(count), lineHeight: 1 }}>
                                          {count}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                            {/* Colour legend */}
                            <div className="mt-3 flex items-center gap-2 justify-end">
                              <span className="text-xs text-gray-400">Fewer</span>
                              {[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((v) => (
                                <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: cellBg(Math.round(v * maxCount)) }} />
                              ))}
                              <span className="text-xs text-gray-400">More</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hourly bar summary */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Orders by Hour (all days combined)</p>
                        <div className="flex items-end gap-0.5 h-20">
                          {hourTotals.map((count, h) => {
                            const maxH = Math.max(1, ...hourTotals);
                            const pct  = (count / maxH) * 100;
                            return (
                              <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${HOUR_LABELS[h]}: ${count} orders`}>
                                <div
                                  className="w-full rounded-t-sm transition-all"
                                  style={{ height: `${Math.max(2, pct)}%`, backgroundColor: h === peakHour ? '#f97316' : '#fed7aa' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex mt-1">
                          {HOUR_LABELS.map((h, i) => (
                            <div key={i} className="flex-1 text-center text-gray-400 font-mono" style={{ fontSize: 8 }}>{i % 6 === 0 ? h : ''}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Categories tab */}
            {tab === 'categories' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {report.categories.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <LayoutGrid size={32} className="mx-auto mb-2 text-gray-200" />
                    <p>No category data for this period.</p>
                  </div>
                ) : (() => {
                  const totalRev = report.categories.reduce((s, r) => s + r.revenue, 0);
                  const totalQty = report.categories.reduce((s, r) => s + r.quantity, 0);
                  const COLORS = [
                    'bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
                    'bg-pink-500', 'bg-amber-500', 'bg-teal-500', 'bg-red-500',
                  ];
                  return (
                    <>
                      {/* Mini pie / legend summary */}
                      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Revenue share</p>
                        {/* Stacked bar */}
                        <div className="flex h-4 rounded-full overflow-hidden gap-px mb-3">
                          {report.categories.map((cat, i) => (
                            <div
                              key={cat.name}
                              title={`${cat.name}: ${((cat.revenue / totalRev) * 100).toFixed(1)}%`}
                              className={`${COLORS[i % COLORS.length]} transition-all`}
                              style={{ width: `${(cat.revenue / totalRev) * 100}%` }}
                            />
                          ))}
                        </div>
                        {/* Legend chips */}
                        <div className="flex flex-wrap gap-2">
                          {report.categories.map((cat, i) => (
                            <div key={cat.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className={`w-2.5 h-2.5 rounded-full ${COLORS[i % COLORS.length]} shrink-0`} />
                              {cat.name}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Per-category rows */}
                      <div className="divide-y divide-gray-50">
                        {report.categories.map((cat, i) => {
                          const pct = totalRev > 0 ? (cat.revenue / totalRev) * 100 : 0;
                          return (
                            <div key={cat.name} className="px-5 py-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full ${COLORS[i % COLORS.length]} shrink-0`} />
                                  <span className="font-semibold text-gray-900 text-sm">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-gray-900 text-sm">{fmt(cat.revenue)}</span>
                                  <span className="text-xs text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
                                <div
                                  className={`${COLORS[i % COLORS.length]} h-2 rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-400">{cat.quantity} item{cat.quantity !== 1 ? 's' : ''} sold</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer totals */}
                      <div className="px-5 py-3 bg-orange-50 border-t border-orange-100 flex justify-between text-sm font-bold text-orange-800">
                        <span>Total ({report.categories.length} categories)</span>
                        <span>{totalQty} items · {fmt(totalRev)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

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

            {/* Promo codes usage tab */}
            {tab === 'promos' && (() => {
              const promos = report.promos;
              const totalUses     = promos.reduce((s, r) => s + r.orderCount, 0);
              const totalDiscount = promos.reduce((s, r) => s + r.totalDiscount, 0);
              const usedCodes     = promos.filter((r) => r.orderCount > 0);
              return (
                <div className="space-y-4">
                  {/* Summary chips */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-1"><Tag size={15} className="text-orange-500" /><span className="text-xs text-gray-500">Active codes</span></div>
                      <p className="text-2xl font-bold text-gray-900">{promos.filter((r) => r.active).length}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-1"><BarChart2 size={15} className="text-blue-500" /><span className="text-xs text-gray-500">Redemptions</span></div>
                      <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{usedCodes.length} of {promos.length} codes used</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-1"><TrendingUp size={15} className="text-red-400" /><span className="text-xs text-gray-500">Total Discount</span></div>
                      <p className="text-2xl font-bold text-gray-900">{fmt(totalDiscount)}</p>
                      {totalUses > 0 && <p className="text-xs text-gray-400 mt-0.5">avg {fmt(totalDiscount / totalUses)} / use</p>}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {promos.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <Tag size={32} className="mx-auto mb-2 text-gray-200" />
                        <p>No promo codes found for this restaurant.</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Discount</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Uses</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Saved</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Avg / Use</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promos.map((row) => (
                            <tr key={row.code} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 tracking-wide">{row.code}</span>
                                  {!row.active && (
                                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">inactive</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  row.type === 'percentage' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {row.type === 'percentage' ? `${row.value}% off` : `${fmt(row.value)} off`}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {row.orderCount > 0 ? (
                                  <span className="font-semibold text-gray-900">{row.orderCount}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-red-500">
                                {row.totalDiscount > 0 ? `-${fmt(row.totalDiscount)}` : <span className="text-gray-300 font-normal">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                                {row.avgDiscount > 0 ? fmt(row.avgDiscount) : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-orange-50 border-t border-orange-100">
                            <td className="px-4 py-3 font-bold text-orange-800" colSpan={2}>Total</td>
                            <td className="px-4 py-3 text-right font-bold text-orange-800">{totalUses}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">-{fmt(totalDiscount)}</td>
                            <td className="px-4 py-3 hidden sm:table-cell" />
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}

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
