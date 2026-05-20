import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, TrendingUp, ShoppingBag, UtensilsCrossed, Loader2, Calendar, LayoutGrid, Flame, Download, Printer, Tag, CreditCard } from 'lucide-react';
import { reportService, type Report } from '../../services/reportService';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

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
    case 'payment': {
      const totalRev = report.paymentMethods.reduce((s, r) => s + r.revenue, 0);
      downloadCsv(`${prefix}-payment-methods.csv`, [
        ['Payment Method', 'Orders', 'Revenue', '% of Total'],
        ...report.paymentMethods.map((r) => [r.method, r.orderCount, r.revenue, ((r.revenue / (totalRev || 1)) * 100).toFixed(1) + '%']),
        ['TOTAL', report.paymentMethods.reduce((s, r) => s + r.orderCount, 0), totalRev, '100%'],
      ]);
      break;
    }
  }
  void fmt; // used in switch above indirectly; keep lint happy
  toast.success('CSV downloaded');
}

// ── PDF / Print helpers ───────────────────────────────────────────────────────
const PDF_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
  /* page header */
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #ea580c; margin-bottom: 16px; }
  .doc-header h1 { font-size: 20px; font-weight: 800; color: #ea580c; letter-spacing: -.3px; }
  .doc-header .meta { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .doc-header .range { text-align: right; }
  .doc-header .range .dates { font-size: 13px; font-weight: 700; color: #111; }
  /* section headings */
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #ea580c; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; margin: 18px 0 8px; }
  h2:first-of-type { margin-top: 0; }
  /* summary grid */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #fafafa; }
  .card .val { font-size: 17px; font-weight: 800; color: #ea580c; }
  .card .lbl { font-size: 9px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: .05em; }
  .card .sub { font-size: 9px; color: #9ca3af; margin-top: 1px; }
  /* tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  thead th { background: #fff7ed; color: #92400e; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; padding: 6px 8px; text-align: left; border-bottom: 2px solid #fed7aa; white-space: nowrap; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) td { background: #fffbf5; }
  tfoot td { padding: 6px 8px; font-weight: 700; background: #fff7ed; border-top: 2px solid #fed7aa; color: #92400e; }
  .right { text-align: right; }
  .center { text-align: center; }
  /* inline bar */
  .bar-wrap { display: flex; align-items: center; gap: 6px; }
  .bar-bg { flex: 1; height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 6px; border-radius: 3px; background: #ea580c; }
  .bar-fill.blue   { background: #3b82f6; }
  .bar-fill.green  { background: #22c55e; }
  .bar-fill.purple { background: #a855f7; }
  .bar-fill.gray   { background: #9ca3af; }
  /* revenue trend sparkline area */
  .trend-bars { display: flex; align-items: flex-end; gap: 2px; height: 40px; margin-bottom: 6px; }
  .trend-bar  { flex: 1; border-radius: 2px 2px 0 0; background: #fed7aa; min-width: 4px; }
  .trend-bar.peak { background: #ea580c; }
  .trend-labels { display: flex; gap: 2px; }
  .trend-label { flex: 1; text-align: center; font-size: 7px; color: #9ca3af; white-space: nowrap; overflow: hidden; min-width: 4px; }
  /* page footer */
  .doc-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
  @page { size: A4; margin: 14mm 12mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
  }
`;

function openPrintWindow(title: string, body: string) {
  const win = window.open('', '_blank', 'width=820,height=750');
  if (!win) { toast.error('Pop-up blocked — allow pop-ups and try again'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PDF_STYLES}</style></head><body>${body}</body></html>`);
  win.document.close();
  // Auto-trigger print then close the helper window
  win.addEventListener('afterprint', () => win.close());
  win.onload = () => { win.focus(); win.print(); };
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already triggered */ } }, 600);
  toast.success('Print / Save as PDF dialog opened');
}

function pdfHeader(title: string, from: string, to: string) {
  const dateRange = from === to ? from : `${from} – ${to}`;
  return `
    <div class="doc-header">
      <div>
        <h1>${title}</h1>
        <div class="meta">Generated ${new Date().toLocaleString()}</div>
      </div>
      <div class="range">
        <div class="dates">${dateRange}</div>
        <div class="meta">Sales Report</div>
      </div>
    </div>`;
}

function pdfFooter() {
  return `<div class="doc-footer"><span>QRA — Restaurant Management</span><span>Printed ${new Date().toLocaleDateString()}</span></div>`;
}

function pdfSummaryCards(s: Report['summary'], fmt: (n: number) => string) {
  return `
    <div class="summary">
      <div class="card"><div class="val">${fmt(s.totalRevenue)}</div><div class="lbl">Total Revenue</div><div class="sub">avg ${fmt(s.avgOrderValue)} / order</div></div>
      <div class="card"><div class="val">${s.totalOrders}</div><div class="lbl">Total Orders</div></div>
      <div class="card"><div class="val">${s.dineInOrders}</div><div class="lbl">Dine-in</div></div>
      <div class="card"><div class="val">${s.takeawayOrders}</div><div class="lbl">Takeaway</div></div>
    </div>`;
}

function pdfDailySection(report: Report, fmt: (n: number) => string) {
  if (!report.daily.length) return '<p style="color:#9ca3af;font-style:italic">No orders in this period.</p>';
  const s = report.summary;
  const maxRev = Math.max(...report.daily.map((r) => r.revenue), 1);

  // Revenue sparkline
  const sparkBars = report.daily.slice().reverse().map((r) => {
    const pct = Math.round((r.revenue / maxRev) * 100);
    const isPeak = r.revenue === maxRev;
    return `<div class="trend-bar${isPeak ? ' peak' : ''}" style="height:${Math.max(4, pct)}%"></div>`;
  }).join('');
  const sparkLabels = report.daily.slice().reverse().map((r) => {
    const d = new Date(r.date + 'T12:00:00');
    return `<div class="trend-label">${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>`;
  }).join('');

  const rows = report.daily.slice().reverse().map((r) => {
    const pct = maxRev > 0 ? (r.revenue / maxRev) * 100 : 0;
    const d = new Date(r.date + 'T12:00:00');
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `<tr>
      <td>${label}</td>
      <td class="right">${r.orderCount}</td>
      <td class="right">${r.dineInCount}</td>
      <td class="right">${r.takeawayCount}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
          <span style="min-width:52px;text-align:right;font-weight:600">${fmt(r.revenue)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <h2>Revenue Trend</h2>
    <div class="no-break">
      <div class="trend-bars">${sparkBars}</div>
      <div class="trend-labels">${sparkLabels}</div>
    </div>
    <h2>Sales by Day</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Date</th><th class="right">Orders</th><th class="right">Dine-in</th><th class="right">Takeaway</th><th>Revenue</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td class="right">${s.totalOrders}</td><td class="right">${s.dineInOrders}</td><td class="right">${s.takeawayOrders}</td><td class="right">${fmt(s.totalRevenue)}</td></tr></tfoot>
      </table>
    </div>`;
}

function pdfCategoriesSection(report: Report, fmt: (n: number) => string) {
  if (!report.categories.length) return '';
  const totalRev = report.categories.reduce((s, r) => s + r.revenue, 0);
  const totalQty = report.categories.reduce((s, r) => s + r.quantity, 0);
  const rows = report.categories.map((r) => {
    const pct = totalRev > 0 ? (r.revenue / totalRev) * 100 : 0;
    return `<tr>
      <td>${r.name}</td>
      <td class="right">${r.quantity}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill blue" style="width:${pct.toFixed(1)}%"></div></div>
          <span style="min-width:52px;text-align:right;font-weight:600">${fmt(r.revenue)}</span>
        </div>
      </td>
      <td class="right">${pct.toFixed(1)}%</td>
    </tr>`;
  }).join('');
  return `
    <h2>Sales by Category</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Category</th><th class="right">Items Sold</th><th>Revenue</th><th class="right">Share</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td class="right">${totalQty}</td><td class="right">${fmt(totalRev)}</td><td class="right">100%</td></tr></tfoot>
      </table>
    </div>`;
}

function pdfItemsSection(report: Report, fmt: (n: number) => string) {
  if (!report.items.length) return '';
  const s = report.summary;
  const maxRev = Math.max(...report.items.map((r) => r.totalRevenue), 1);
  const rows = report.items.map((r) => {
    const pct = (r.totalRevenue / maxRev) * 100;
    const sizeTag = r.size ? `<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${r.size === 'large' ? '#dbeafe' : '#f3f4f6'};color:${r.size === 'large' ? '#1d4ed8' : '#4b5563'};margin-left:4px">${r.size === 'large' ? 'L' : 'R'}</span>` : '';
    return `<tr>
      <td>${r.name}${sizeTag}</td>
      <td class="right">${r.quantity}</td>
      <td class="right">${fmt(r.baseRevenue)}</td>
      <td class="right">${r.toppingRevenue > 0 ? '+' + fmt(r.toppingRevenue) : '—'}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill green" style="width:${pct.toFixed(1)}%"></div></div>
          <span style="min-width:52px;text-align:right;font-weight:600">${fmt(r.totalRevenue)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `
    <h2>Item Performance</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Base</th><th class="right">Extras</th><th>Total Revenue</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td class="right">${report.items.reduce((s, r) => s + r.quantity, 0)}</td><td class="right">${fmt(report.items.reduce((s, r) => s + r.baseRevenue, 0))}</td><td class="right">${fmt(report.items.reduce((s, r) => s + r.toppingRevenue, 0))}</td><td class="right">${fmt(s.totalRevenue)}</td></tr></tfoot>
      </table>
    </div>`;
}

function pdfExtrasSection(report: Report, fmt: (n: number) => string) {
  if (!report.toppings.length) return '';
  const maxRev = Math.max(...report.toppings.map((r) => r.revenue), 1);
  const rows = report.toppings.map((r) => {
    const pct = (r.revenue / maxRev) * 100;
    return `<tr>
      <td>${r.name}</td>
      <td class="right">${r.timesOrdered}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill purple" style="width:${pct.toFixed(1)}%"></div></div>
          <span style="min-width:52px;text-align:right;font-weight:600">${fmt(r.revenue)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `
    <h2>Extras &amp; Toppings</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Extra / Topping</th><th class="right">Times Ordered</th><th>Revenue</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function pdfPaymentSection(report: Report, fmt: (n: number) => string) {
  if (!report.paymentMethods.length) return '';
  const totalRev = report.paymentMethods.reduce((s, r) => s + r.revenue, 0);
  const totalOrd = report.paymentMethods.reduce((s, r) => s + r.orderCount, 0);
  const colors: Record<string, string> = { cash: 'green', card: 'blue', qr: 'purple' };
  const rows = report.paymentMethods.map((r) => {
    const pct = totalRev > 0 ? (r.revenue / totalRev) * 100 : 0;
    const cls = colors[r.method] ?? '';
    const label = r.method.charAt(0).toUpperCase() + r.method.slice(1);
    return `<tr>
      <td>${label}</td>
      <td class="right">${r.orderCount}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>
          <span style="min-width:52px;text-align:right;font-weight:600">${fmt(r.revenue)}</span>
        </div>
      </td>
      <td class="right">${pct.toFixed(1)}%</td>
    </tr>`;
  }).join('');
  return `
    <h2>Revenue by Payment Method</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Method</th><th class="right">Orders</th><th>Revenue</th><th class="right">Share</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td class="right">${totalOrd}</td><td class="right">${fmt(totalRev)}</td><td class="right">100%</td></tr></tfoot>
      </table>
    </div>`;
}

function pdfPromosSection(report: Report, fmt: (n: number) => string) {
  if (!report.promos.length) return '';
  const totalDiscount = report.promos.reduce((s, r) => s + r.totalDiscount, 0);
  const totalUses = report.promos.reduce((s, r) => s + r.orderCount, 0);
  const rows = report.promos.map((r) => {
    const disc = r.type === 'percentage' ? `${r.value}% off` : `${fmt(r.value)} off`;
    return `<tr>
      <td><strong>${r.code}</strong>${!r.active ? ' <span style="font-size:9px;color:#9ca3af">(inactive)</span>' : ''}</td>
      <td>${disc}</td>
      <td class="right">${r.orderCount || '—'}</td>
      <td class="right">${r.totalDiscount > 0 ? fmt(r.totalDiscount) : '—'}</td>
      <td class="right">${r.avgDiscount > 0 ? fmt(r.avgDiscount) : '—'}</td>
    </tr>`;
  }).join('');
  return `
    <h2>Promo Code Usage</h2>
    <div class="no-break">
      <table>
        <thead><tr><th>Code</th><th>Discount</th><th class="right">Uses</th><th class="right">Total Saved</th><th class="right">Avg / Use</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td></td><td class="right">${totalUses}</td><td class="right">${fmt(totalDiscount)}</td><td></td></tr></tfoot>
      </table>
    </div>`;
}

/** Tab-specific focused PDF */
function buildPdf(report: Report, tab: Tab, from: string, to: string, fmt: (n: number) => string) {
  const TAB_TITLES: Record<Tab, string> = {
    sales:      'Sales by Day',
    heatmap:    'Order Heatmap',
    categories: 'Sales by Category',
    items:      'Item Performance',
    extras:     'Extras & Toppings',
    promos:     'Promo Code Usage',
    payment:    'Revenue by Payment Method',
  };
  const title = TAB_TITLES[tab];
  const header = pdfHeader(title, from, to);
  const summary = pdfSummaryCards(report.summary, fmt);
  const footer = pdfFooter();

  let body = '';
  switch (tab) {
    case 'sales':
      body = pdfDailySection(report, fmt);
      break;
    case 'categories':
      body = pdfCategoriesSection(report, fmt);
      break;
    case 'items':
      body = pdfItemsSection(report, fmt);
      break;
    case 'extras':
      body = pdfExtrasSection(report, fmt);
      break;
    case 'payment':
      body = pdfPaymentSection(report, fmt);
      break;
    case 'promos':
      body = pdfPromosSection(report, fmt);
      break;
    case 'heatmap': {
      const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const HOUR = Array.from({ length: 24 }, (_, h) => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`);
      const peak = report.heatmap.reduce((b, c) => c.orderCount > b.orderCount ? c : b, { dayOfWeek: 0, hour: 0, orderCount: 0, revenue: 0 });
      const hourTotals = Array(24).fill(0) as number[];
      report.heatmap.forEach((c) => { hourTotals[c.hour] += c.orderCount; });
      const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
      body = `
        <h2>Peak Hours Summary</h2>
        <div class="summary" style="grid-template-columns:repeat(3,1fr)">
          <div class="card"><div class="val">${HOUR[peakHour]}</div><div class="lbl">Busiest Hour</div><div class="sub">${hourTotals[peakHour]} orders</div></div>
          <div class="card"><div class="val">${DAY[peak.dayOfWeek]}</div><div class="lbl">Peak Day/Slot</div><div class="sub">${HOUR[peak.hour]} · ${peak.orderCount} orders</div></div>
          <div class="card"><div class="val">${report.heatmap.reduce((s,c)=>s+c.orderCount,0)}</div><div class="lbl">Total Orders</div></div>
        </div>
        <h2>Hourly Order Totals</h2>
        <table>
          <thead><tr><th>Hour</th><th class="right">Orders</th><th>Share</th></tr></thead>
          <tbody>${hourTotals.map((cnt,h)=>{
            const total = hourTotals.reduce((a,b)=>a+b,0)||1;
            const pct = (cnt/total*100).toFixed(1);
            return `<tr><td>${HOUR[h]}</td><td class="right">${cnt||'—'}</td><td><div class="bar-wrap"><div class="bar-bg"><div class="bar-fill${h===peakHour?' peak':''}" style="background:${h===peakHour?'#ea580c':'#fed7aa'};width:${cnt>0?(cnt/Math.max(...hourTotals)*100).toFixed(0):0}%"></div></div><span style="min-width:30px;text-align:right">${cnt>0?pct+'%':''}</span></div></td></tr>`;
          }).join('')}</tbody>
        </table>`;
      break;
    }
  }

  openPrintWindow(`${title} — ${from === to ? from : `${from} – ${to}`}`, header + summary + body + footer);
}

/** Full comprehensive report PDF (all sections) */
function buildFullPdf(report: Report, from: string, to: string, fmt: (n: number) => string) {
  const header  = pdfHeader('Full Sales Report', from, to);
  const summary = pdfSummaryCards(report.summary, fmt);
  const body    = pdfDailySection(report, fmt)
                + pdfCategoriesSection(report, fmt)
                + pdfItemsSection(report, fmt)
                + pdfExtrasSection(report, fmt)
                + pdfPaymentSection(report, fmt)
                + pdfPromosSection(report, fmt);
  openPrintWindow(`Full Report — ${from === to ? from : `${from} – ${to}`}`, header + summary + body + pdfFooter());
}

type Tab = 'sales' | 'items' | 'extras' | 'categories' | 'heatmap' | 'promos' | 'payment';

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
  const [report, setReport]       = useState<Report | null>(null);
  const [tab, setTab]             = useState<Tab>('sales');
  const [itemMetric, setItemMetric] = useState<'revenue' | 'quantity'>('revenue');

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
                { key: 'payment',    label: '💳 Payment' },
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
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => buildCsv(report, tab, from, to, fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={() => buildPdf(report, tab, from, to, fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                title="Print / save current tab as PDF"
              >
                <Printer size={14} /> PDF
              </button>
              <button
                onClick={() => buildFullPdf(report, from, to, fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-300 text-orange-600 text-sm font-medium hover:bg-orange-50 transition-colors"
                title="Print / save full report (all sections)"
              >
                <Printer size={14} /> Full Report
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

            {/* Items tab — chart + table */}
            {tab === 'items' && (
              <div className="space-y-4">
                {report.items.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                    <BarChart2 size={32} className="mx-auto mb-2 text-gray-200" />
                    <p>No items sold in this period.</p>
                  </div>
                ) : (() => {
                  // Merge same-name items across sizes for the chart, keep top 15
                  const merged = Object.values(
                    report.items.reduce<Record<string, { name: string; totalRevenue: number; quantity: number }>>((acc, r) => {
                      if (!acc[r.name]) acc[r.name] = { name: r.name, totalRevenue: 0, quantity: 0 };
                      acc[r.name].totalRevenue += r.totalRevenue;
                      acc[r.name].quantity     += r.quantity;
                      return acc;
                    }, {})
                  );
                  const sorted = [...merged].sort((a, b) =>
                    itemMetric === 'revenue' ? b.totalRevenue - a.totalRevenue : b.quantity - a.quantity
                  );
                  const chartData = sorted.slice(0, 15).reverse(); // reverse so #1 appears at top
                  const barHeight = 36;
                  const chartHeight = Math.max(180, chartData.length * barHeight + 40);

                  // Gradient colours: top item = deepest orange, fade down
                  const BARS = ['#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fed7aa','#ffedd5'];
                  const topIdx = chartData.length - 1; // index of the highest bar (last = top item due to reverse)

                  return (
                    <>
                      {/* Bar chart card */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Header + toggle */}
                        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              Top {chartData.length} Items
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              by {itemMetric === 'revenue' ? 'Revenue' : 'Quantity sold'}
                            </p>
                          </div>
                          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                            {(['revenue', 'quantity'] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => setItemMetric(m)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors capitalize ${
                                  itemMetric === m
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                {m === 'revenue' ? 'Revenue' : 'Qty'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Recharts horizontal bar chart */}
                        <div className="px-2 pt-3 pb-2">
                          <ResponsiveContainer width="100%" height={chartHeight}>
                            <BarChart
                              layout="vertical"
                              data={chartData}
                              margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                              <XAxis
                                type="number"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => itemMetric === 'revenue' ? fmt(v) : String(v)}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={130}
                                tick={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v}
                              />
                              <Tooltip
                                cursor={{ fill: '#fff7ed' }}
                                formatter={(value) => {
                                  const v = Number(value);
                                  return [
                                    itemMetric === 'revenue' ? fmt(v) : `${v} sold`,
                                    itemMetric === 'revenue' ? 'Revenue' : 'Quantity',
                                  ] as [string, string];
                                }}
                                contentStyle={{
                                  fontSize: 12,
                                  borderRadius: 10,
                                  border: '1px solid #e5e7eb',
                                  boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                                }}
                                labelStyle={{ fontWeight: 700, color: '#111' }}
                              />
                              <Bar
                                dataKey={itemMetric === 'revenue' ? 'totalRevenue' : 'quantity'}
                                radius={[0, 6, 6, 0]}
                                maxBarSize={28}
                                label={{
                                  position: 'right',
                                  fontSize: 10,
                                  fill: '#6b7280',
                                  formatter: (v: unknown) => itemMetric === 'revenue' ? fmt(Number(v)) : Number(v),
                                }}
                              >
                                {chartData.map((_, i) => {
                                  // intensity: highest bar = deepest colour
                                  const intensity = (i / Math.max(topIdx, 1));
                                  const colorIdx = Math.round(intensity * (BARS.length - 1));
                                  return <Cell key={i} fill={BARS[colorIdx]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Full detail table */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Full breakdown — all {report.items.length} item variants</p>
                        </div>
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
                                {report.items.reduce((acc, r) => acc + r.quantity, 0)}
                              </td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell font-semibold text-orange-700">
                                {fmt(report.items.reduce((acc, r) => acc + r.baseRevenue, 0))}
                              </td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell font-semibold text-orange-700">
                                {fmt(report.items.reduce((acc, r) => acc + r.toppingRevenue, 0))}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-orange-800">{fmt(s!.totalRevenue)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  );
                })()}
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

            {/* Payment method breakdown */}
            {tab === 'payment' && (() => {
              const rows = report.paymentMethods;
              const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
              const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);

              const METHOD_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
                cash:    { label: 'Cash',    color: 'bg-green-500',  bg: 'bg-green-50',  icon: '💵' },
                card:    { label: 'Card',    color: 'bg-blue-500',   bg: 'bg-blue-50',   icon: '💳' },
                qr:      { label: 'QR Pay',  color: 'bg-purple-500', bg: 'bg-purple-50', icon: '📱' },
                unknown: { label: 'Unknown', color: 'bg-gray-400',   bg: 'bg-gray-50',   icon: '❓' },
              };
              const FALLBACK_COLORS = ['bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-amber-500'];

              function getMeta(method: string, idx: number) {
                return METHOD_META[method] ?? {
                  label: method.charAt(0).toUpperCase() + method.slice(1),
                  color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
                  bg: 'bg-gray-50',
                  icon: '💰',
                };
              }

              return (
                <div className="space-y-4">
                  {rows.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
                      <CreditCard size={32} className="mx-auto mb-2 text-gray-200" />
                      <p>No payment data for this period.</p>
                    </div>
                  ) : (
                    <>
                      {/* Summary chips */}
                      <div className={`grid gap-3 ${rows.length <= 3 ? `grid-cols-${rows.length}` : 'grid-cols-2 sm:grid-cols-4'}`}>
                        {rows.map((r, i) => {
                          const meta = getMeta(r.method, i);
                          return (
                            <div key={r.method} className={`rounded-2xl border border-gray-100 shadow-sm p-4 ${meta.bg}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">{meta.icon}</span>
                                <span className="text-xs text-gray-500 font-medium">{meta.label}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900">{fmt(r.revenue)}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{r.orderCount} order{r.orderCount !== 1 ? 's' : ''} · {totalRev > 0 ? ((r.revenue / totalRev) * 100).toFixed(1) : '0'}%</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Stacked bar */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Revenue share</p>
                        <div className="flex h-5 rounded-full overflow-hidden gap-px mb-3">
                          {rows.map((r, i) => {
                            const meta = getMeta(r.method, i);
                            return (
                              <div
                                key={r.method}
                                title={`${meta.label}: ${fmt(r.revenue)} (${totalRev > 0 ? ((r.revenue / totalRev) * 100).toFixed(1) : '0'}%)`}
                                className={`${meta.color} transition-all`}
                                style={{ width: `${(r.revenue / (totalRev || 1)) * 100}%` }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {rows.map((r, i) => {
                            const meta = getMeta(r.method, i);
                            return (
                              <div key={r.method} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className={`w-2.5 h-2.5 rounded-full ${meta.color} shrink-0`} />
                                {meta.label} — {totalRev > 0 ? ((r.revenue / totalRev) * 100).toFixed(1) : '0'}%
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Table */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                              <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                              <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                              <th className="text-right px-4 py-3 font-semibold text-gray-600">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const meta = getMeta(r.method, i);
                              const pct = totalRev > 0 ? (r.revenue / totalRev) * 100 : 0;
                              return (
                                <tr key={r.method} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2.5 h-2.5 rounded-full ${meta.color} shrink-0`} />
                                      <span className="font-medium text-gray-900">{meta.icon} {meta.label}</span>
                                    </div>
                                    <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5">
                                      <div className={`${meta.color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700 font-semibold">{r.orderCount}</td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(r.revenue)}</td>
                                  <td className="px-4 py-3 text-right text-gray-500">{pct.toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-orange-50 border-t border-orange-100">
                              <td className="px-4 py-3 font-bold text-orange-800">Total</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-800">{totalOrders}</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-800">{fmt(totalRev)}</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-800">100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
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
