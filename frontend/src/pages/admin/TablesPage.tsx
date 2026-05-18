import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, QrCode, Printer, ShoppingBag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Table } from '../../types';
import { tableService } from '../../services/tableService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ── Print helpers ─────────────────────────────────────────────────────────────

function qrCardHtml(tableNumber: number, seats: number, url: string, svgHtml: string) {
  return `
    <div class="card">
      <div class="label">Scan to Order</div>
      <div class="table-num">Table ${tableNumber}</div>
      <div class="seats">${seats} seat${seats !== 1 ? 's' : ''}</div>
      <div class="qr">${svgHtml}</div>
      <div class="url">${url}</div>
    </div>`;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }
  .card {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center;
    padding: 32px 24px; page-break-after: always;
    min-height: 100vh;
  }
  .card:last-child { page-break-after: avoid; }
  .label { font-size: 13px; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
  .table-num { font-size: 48px; font-weight: 800; color: #111827; line-height: 1; }
  .seats { font-size: 14px; color: #9ca3af; margin-top: 6px; margin-bottom: 28px; }
  .qr svg { width: 220px !important; height: 220px !important; }
  .url { margin-top: 16px; font-size: 9px; color: #d1d5db; word-break: break-all; max-width: 260px; }
  @page { margin: 12mm; }
`;

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=520,height=700');
  if (!win) { toast.error('Allow pop-ups to print'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>QR Codes</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
  win.document.close();
  // Wait for SVGs to render before printing
  win.onload = () => { win.focus(); win.print(); };
  // Fallback if onload doesn't fire (some browsers)
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already printed */ } }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────

export function TablesPage() {
  const { user } = useAuth();
  const [tables, setTables]     = useState<Table[]>([]);
  const [number, setNumber]     = useState('');
  const [seats, setSeats]       = useState('4');
  const [qrPreview, setQrPreview] = useState<Table | null>(null);
  const [takeawayQrOpen, setTakeawayQrOpen] = useState(false);

  const takeawayUrl = user?.restaurantId ? `${window.location.origin}/takeaway/${user.restaurantId}` : '';

  // Hidden QR containers — one per table + one for takeaway — used to grab SVG HTML for printing
  const qrRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const takeawayQrRef = useRef<HTMLDivElement>(null);

  const load = () => tableService.getTables().then(setTables).catch(() => {});
  useEffect(() => { load(); }, []);

  const origin = window.location.origin;

  // ── Get SVG html for a table ───────────────────────────────────────────────
  function getSvg(tableId: string): string {
    return qrRefs.current.get(tableId)?.querySelector('svg')?.outerHTML ?? '';
  }

  // ── Print single QR ────────────────────────────────────────────────────────
  function printOne(table: Table) {
    const svg = getSvg(table.id);
    if (!svg) { toast.error('QR not ready, try again'); return; }
    const url = `${origin}/menu/${table.id}`;
    openPrintWindow(qrCardHtml(table.number, table.seats, url, svg));
  }

  // ── Print all QR codes ─────────────────────────────────────────────────────
  function printAll() {
    if (tables.length === 0) { toast.error('No tables to print'); return; }
    const cards = tables
      .map((t) => {
        const svg = getSvg(t.id);
        return svg ? qrCardHtml(t.number, t.seats, `${origin}/menu/${t.id}`, svg) : '';
      })
      .join('');
    openPrintWindow(cards);
  }

  // ── Print takeaway QR ──────────────────────────────────────────────────────
  function printTakeaway() {
    const svg = takeawayQrRef.current?.querySelector('svg')?.outerHTML ?? '';
    if (!svg || !takeawayUrl) { toast.error('QR not ready, try again'); return; }
    const html = `
      <div class="card">
        <div class="label">Takeaway Orders</div>
        <div class="table-num" style="font-size:32px">Scan to Order</div>
        <div class="seats">Takeaway &amp; Pickup</div>
        <div class="qr">${svg}</div>
        <div class="url">${takeawayUrl}</div>
      </div>`;
    openPrintWindow(html);
  }

  // ── Add / delete ───────────────────────────────────────────────────────────
  async function addTable() {
    const n = parseInt(number);
    const s = parseInt(seats);
    if (!n || !s) return toast.error('Enter valid number and seats');
    if (tables.some((t) => t.number === n)) return toast.error('Table number already exists');
    try {
      const t = await tableService.createTable(n, s);
      setTables((p) => [...p, t].sort((a, b) => a.number - b.number));
      setNumber('');
      toast.success(`Table ${n} added`);
    } catch {
      toast.error('Failed to add table');
    }
  }

  async function del(id: string, num: number) {
    if (!confirm(`Delete Table ${num}?`)) return;
    try {
      await tableService.deleteTable(id);
      setTables((p) => p.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden QR renders — used only to grab SVG HTML */}
      <div className="hidden" aria-hidden>
        {tables.map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              if (el) qrRefs.current.set(t.id, el);
              else qrRefs.current.delete(t.id);
            }}
          >
            <QRCodeSVG value={`${origin}/menu/${t.id}`} size={220} />
          </div>
        ))}
        {takeawayUrl && (
          <div ref={takeawayQrRef}>
            <QRCodeSVG value={takeawayUrl} size={220} />
          </div>
        )}
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Tables & QR Codes</h1>
          {tables.length > 0 && (
            <button
              onClick={printAll}
              className="flex items-center gap-1.5 text-sm bg-gray-800 text-white px-3 py-1.5 rounded-full font-medium hover:bg-gray-900 transition-colors"
            >
              <Printer size={14} /> Print All
            </button>
          )}
        </div>
      </header>

      <main className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {/* Takeaway QR card */}
        {takeawayUrl && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag size={16} className="text-purple-500" />
              <h2 className="font-semibold text-gray-700 text-sm">Takeaway QR Code</h2>
              <span className="ml-auto text-xs text-gray-400">One QR — many customers</span>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="cursor-pointer"
                onClick={() => setTakeawayQrOpen(true)}
              >
                <QRCodeSVG value={takeawayUrl} size={96} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 break-all mb-3">{takeawayUrl}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTakeawayQrOpen(true)}
                    className="flex items-center gap-1 text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors font-medium"
                  >
                    <QrCode size={12} /> Preview
                  </button>
                  <button
                    onClick={printTakeaway}
                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors font-medium"
                  >
                    <Printer size={12} /> Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">Add Table</h2>
          <div className="flex gap-2">
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTable()}
              placeholder="Table #"
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
            />
            <input
              type="number"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTable()}
              placeholder="Seats"
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
            />
            <button
              onClick={addTable}
              className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Table grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((table) => (
            <div key={table.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 mb-0.5">{table.number}</p>
              <p className="text-xs text-gray-500 mb-3">{table.seats} seats</p>
              <div className="flex justify-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setQrPreview(table)}
                  className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                >
                  <QrCode size={12} /> QR
                </button>
                <button
                  onClick={() => printOne(table)}
                  className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <Printer size={12} /> Print
                </button>
                <button
                  onClick={() => del(table.id, table.number)}
                  className="flex items-center text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Takeaway QR Preview modal */}
      {takeawayQrOpen && takeawayUrl && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setTakeawayQrOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-purple-500" />
              <h2 className="font-bold text-gray-900 text-lg">Takeaway QR</h2>
            </div>
            <p className="text-xs text-gray-400 -mt-2 text-center">Customers scan this to place takeaway orders</p>

            <QRCodeSVG value={takeawayUrl} size={200} />

            <p className="text-xs text-gray-300 text-center break-all">{takeawayUrl}</p>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => { printTakeaway(); setTakeawayQrOpen(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={() => setTakeawayQrOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview modal */}
      {qrPreview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setQrPreview(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-gray-900 text-lg">Table {qrPreview.number}</h2>
            <p className="text-xs text-gray-400 -mt-2">{qrPreview.seats} seats</p>

            <QRCodeSVG value={`${origin}/menu/${qrPreview.id}`} size={200} />

            <p className="text-xs text-gray-300 text-center break-all">
              {origin}/menu/{qrPreview.id}
            </p>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => { printOne(qrPreview); setQrPreview(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={() => setQrPreview(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
