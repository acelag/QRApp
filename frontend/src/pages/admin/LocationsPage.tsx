import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, QrCode, Printer,
  BedDouble, Table2, ShoppingBag,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Table, Room } from '../../types';
import { tableService } from '../../services/tableService';
import { roomService } from '../../services/roomService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';

type Tab = 'tables' | 'rooms';

// ── Shared print helpers ──────────────────────────────────────────────────────

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }
  .card {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center;
    padding: 32px 24px; page-break-after: always; min-height: 100vh;
  }
  .card:last-child { page-break-after: avoid; }
  .label   { font-size: 13px; color: #6b7280; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 12px; }
  .title   { font-size: 48px; font-weight: 800; color: #111827; line-height: 1; }
  .subtitle{ font-size: 14px; color: #9ca3af; margin-top: 6px; margin-bottom: 28px; }
  .qr svg  { width: 220px !important; height: 220px !important; }
  .url     { margin-top: 16px; font-size: 9px; color: #d1d5db; word-break: break-all; max-width: 260px; }
  @page    { margin: 12mm; }
`;

function tableCardHtml(num: number, seats: number, url: string, svg: string) {
  return `<div class="card"><div class="label">Scan to Order</div><div class="title">Table ${num}</div><div class="subtitle">${seats} seat${seats !== 1 ? 's' : ''}</div><div class="qr">${svg}</div><div class="url">${url}</div></div>`;
}
function roomCardHtml(num: number, name: string | null | undefined, url: string, svg: string) {
  return `<div class="card"><div class="label">Scan to Order</div><div class="title">Room ${num}</div><div class="subtitle">${name ?? '&nbsp;'}</div><div class="qr">${svg}</div><div class="url">${url}</div></div>`;
}
function takeawayCardHtml(url: string, svg: string) {
  return `<div class="card"><div class="label">Takeaway Orders</div><div class="title" style="font-size:32px">Scan to Order</div><div class="subtitle">Takeaway &amp; Pickup</div><div class="qr">${svg}</div><div class="url">${url}</div></div>`;
}

function openPrintWindow(html: string, title = 'QR Codes') {
  const win = window.open('', '_blank', 'width=520,height=700');
  if (!win) { toast.error('Allow pop-ups to print'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already printed */ } }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────

export function LocationsPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>(
    () => (localStorage.getItem('locations-tab') as Tab) ?? 'tables',
  );

  // ── Tables state ──────────────────────────────────────────────────────────
  const [tables, setTables]         = useState<Table[]>([]);
  const [tableNum, setTableNum]     = useState('');
  const [tableSeats, setTableSeats] = useState('4');
  const [tableQrPreview, setTableQrPreview] = useState<Table | null>(null);
  const [takeawayQrOpen, setTakeawayQrOpen] = useState(false);

  // ── Rooms state ───────────────────────────────────────────────────────────
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [roomNum, setRoomNum]     = useState('');
  const [roomName, setRoomName]   = useState('');
  const [roomQrPreview, setRoomQrPreview] = useState<Room | null>(null);

  // ── Refs for hidden QR renders ────────────────────────────────────────────
  const tableQrRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
  const roomQrRefs    = useRef<Map<string, HTMLDivElement>>(new Map());
  const takeawayQrRef = useRef<HTMLDivElement>(null);

  const origin      = window.location.origin;
  const takeawayUrl = user?.restaurantId ? `${origin}/takeaway/${user.restaurantId}` : '';

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    localStorage.setItem('locations-tab', tab);
  }

  useEffect(() => { tableService.getTables().then(setTables).catch(() => {}); }, []);
  useEffect(() => { roomService.getRooms().then(setRooms).catch(() => {}); }, []);

  // ── SVG getters ───────────────────────────────────────────────────────────
  const getTableSvg    = (id: string) => tableQrRefs.current.get(id)?.querySelector('svg')?.outerHTML ?? '';
  const getRoomSvg     = (id: string) => roomQrRefs.current.get(id)?.querySelector('svg')?.outerHTML ?? '';
  const getTakeawaySvg = ()           => takeawayQrRef.current?.querySelector('svg')?.outerHTML ?? '';

  // ── Table actions ─────────────────────────────────────────────────────────
  async function addTable() {
    const n = parseInt(tableNum), s = parseInt(tableSeats);
    if (!n || !s) return toast.error('Enter valid number and seats');
    if (tables.some((t) => t.number === n)) return toast.error('Table number already exists');
    try {
      const t = await tableService.createTable(n, s);
      setTables((p) => [...p, t].sort((a, b) => a.number - b.number));
      setTableNum('');
      toast.success(`Table ${n} added`);
    } catch { toast.error('Failed to add table'); }
  }

  async function delTable(id: string, num: number) {
    if (!confirm(`Delete Table ${num}?`)) return;
    try {
      await tableService.deleteTable(id);
      setTables((p) => p.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }

  function printOneTable(table: Table) {
    const svg = getTableSvg(table.id);
    if (!svg) return toast.error('QR not ready, try again');
    openPrintWindow(tableCardHtml(table.number, table.seats, `${origin}/welcome/${table.id}`, svg), 'Table QR');
  }

  function printAllTables() {
    if (!tables.length) return toast.error('No tables to print');
    openPrintWindow(
      tables.map((t) => { const s = getTableSvg(t.id); return s ? tableCardHtml(t.number, t.seats, `${origin}/welcome/${t.id}`, s) : ''; }).join(''),
      'Table QR Codes',
    );
  }

  function printTakeaway() {
    const svg = getTakeawaySvg();
    if (!svg || !takeawayUrl) return toast.error('QR not ready, try again');
    openPrintWindow(takeawayCardHtml(takeawayUrl, svg), 'Takeaway QR');
  }

  // ── Room actions ──────────────────────────────────────────────────────────
  async function addRoom() {
    const n = parseInt(roomNum);
    if (!n) return toast.error('Enter a valid room number');
    if (rooms.some((r) => r.number === n)) return toast.error('Room number already exists');
    try {
      const r = await roomService.createRoom(n, roomName.trim() || undefined);
      setRooms((p) => [...p, r].sort((a, b) => a.number - b.number));
      setRoomNum(''); setRoomName('');
      toast.success(`Room ${n} added`);
    } catch { toast.error('Failed to add room'); }
  }

  async function delRoom(id: string, num: number) {
    if (!confirm(`Delete Room ${num}?`)) return;
    try {
      await roomService.deleteRoom(id);
      setRooms((p) => p.filter((r) => r.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }

  function printOneRoom(room: Room) {
    const svg = getRoomSvg(room.id);
    if (!svg) return toast.error('QR not ready, try again');
    openPrintWindow(roomCardHtml(room.number, room.name, `${origin}/room/${room.id}`, svg), 'Room QR');
  }

  function printAllRooms() {
    if (!rooms.length) return toast.error('No rooms to print');
    openPrintWindow(
      rooms.map((r) => { const s = getRoomSvg(r.id); return s ? roomCardHtml(r.number, r.name, `${origin}/room/${r.id}`, s) : ''; }).join(''),
      'Room QR Codes',
    );
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inp = (focus: string) =>
    `border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ${focus} bg-white`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">

      {/* Hidden QR renders — used only to grab SVG for printing */}
      <div className="hidden" aria-hidden>
        {tables.map((t) => (
          <div key={t.id} ref={(el) => { if (el) tableQrRefs.current.set(t.id, el); else tableQrRefs.current.delete(t.id); }}>
            <QRCodeSVG value={`${origin}/welcome/${t.id}`} size={220} />
          </div>
        ))}
        {takeawayUrl && <div ref={takeawayQrRef}><QRCodeSVG value={takeawayUrl} size={220} /></div>}
        {rooms.map((r) => (
          <div key={r.id} ref={(el) => { if (el) roomQrRefs.current.set(r.id, el); else roomQrRefs.current.delete(r.id); }}>
            <QRCodeSVG value={`${origin}/room/${r.id}`} size={220} />
          </div>
        ))}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Locations & QR Codes</h1>
          <button
            onClick={activeTab === 'tables' ? printAllTables : printAllRooms}
            disabled={activeTab === 'tables' ? tables.length === 0 : rooms.length === 0}
            className="flex items-center gap-1.5 text-sm bg-gray-800 text-white px-3 py-1.5 rounded-full font-medium hover:bg-gray-900 transition-colors disabled:opacity-40"
          >
            <Printer size={14} /> Print All
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2">
          <button
            onClick={() => switchTab('tables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'tables'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Table2 size={15} />
            Tables
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'tables' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{tables.length}</span>
          </button>

          <button
            onClick={() => switchTab('rooms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'rooms'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <BedDouble size={15} />
            Rooms
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'rooms' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{rooms.length}</span>
          </button>
        </div>
      </header>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">

        {/* ════════════════ TABLES TAB ════════════════ */}
        {activeTab === 'tables' && (
          <>
            {/* Takeaway QR card */}
            {takeawayUrl && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingBag size={16} className="text-purple-500" />
                  <h2 className="font-semibold text-gray-700 text-sm">Takeaway QR Code</h2>
                  <span className="ml-auto text-xs text-gray-400">One QR — many customers</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="cursor-pointer flex-shrink-0" onClick={() => setTakeawayQrOpen(true)}>
                    <QRCodeSVG value={takeawayUrl} size={96} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={takeawayUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-purple-500 hover:text-purple-700 hover:underline break-all mb-3">{takeawayUrl}</a>
                    <div className="flex gap-2">
                      <button onClick={() => setTakeawayQrOpen(true)} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors font-medium">
                        <QrCode size={12} /> Preview
                      </button>
                      <button onClick={printTakeaway} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors font-medium">
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
              <div className="flex gap-2 flex-wrap">
                <input type="number" value={tableNum} onChange={(e) => setTableNum(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTable()} placeholder="Table #"
                  className={`w-24 ${inp('focus:ring-orange-300')}`} />
                <input type="number" value={tableSeats} onChange={(e) => setTableSeats(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTable()} placeholder="Seats"
                  className={`w-24 ${inp('focus:ring-orange-300')}`} />
                <button onClick={addTable} className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Tables grid */}
            {tables.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Table2 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No tables yet. Add your first table above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {tables.map((table) => (
                  <div key={table.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 mb-0.5">{table.number}</p>
                    <p className="text-xs text-gray-400 mb-3">{table.seats} seats</p>
                    <div className="flex justify-center gap-1.5 flex-wrap">
                      <button onClick={() => setTableQrPreview(table)} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full hover:bg-orange-100 transition-colors">
                        <QrCode size={12} /> QR
                      </button>
                      <button onClick={() => printOneTable(table)} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors">
                        <Printer size={12} /> Print
                      </button>
                      <button onClick={() => delTable(table.id, table.number)} className="flex items-center text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full hover:bg-red-100 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════ ROOMS TAB ════════════════ */}
        {activeTab === 'rooms' && (
          <>
            {/* Add room */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm">Add Room</h2>
              <div className="flex gap-2 flex-wrap">
                <input type="number" value={roomNum} onChange={(e) => setRoomNum(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRoom()} placeholder="Room #"
                  className={`w-24 ${inp('focus:ring-blue-300')}`} />
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRoom()} placeholder="Room name (optional)"
                  className={`flex-1 min-w-32 ${inp('focus:ring-blue-300')}`} />
                <button onClick={addRoom} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Rooms grid */}
            {rooms.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No rooms yet. Add your first room above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {rooms.map((room) => (
                  <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-blue-50 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <BedDouble size={14} className="text-blue-400" />
                      <p className="text-2xl font-bold text-gray-900">{room.number}</p>
                    </div>
                    {room.name
                      ? <p className="text-xs text-gray-400 mb-3 truncate">{room.name}</p>
                      : <div className="mb-3" />}
                    <div className="flex justify-center gap-1.5 flex-wrap">
                      <button onClick={() => setRoomQrPreview(room)} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                        <QrCode size={12} /> QR
                      </button>
                      <button onClick={() => printOneRoom(room)} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors">
                        <Printer size={12} /> Print
                      </button>
                      <button onClick={() => delRoom(room.id, room.number)} className="flex items-center text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full hover:bg-red-100 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Takeaway QR modal ──────────────────────────────────────────── */}
      {takeawayQrOpen && takeawayUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTakeawayQrOpen(false)}>
          <div className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-purple-500" />
              <h2 className="font-bold text-gray-900 text-lg">Takeaway QR</h2>
            </div>
            <p className="text-xs text-gray-400 -mt-2 text-center">Customers scan this to place takeaway orders</p>
            <a href={takeawayUrl} target="_blank" rel="noopener noreferrer" title="Open link">
              <QRCodeSVG value={takeawayUrl} size={200} />
            </a>
            <a href={takeawayUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-500 hover:text-purple-700 hover:underline text-center break-all">{takeawayUrl}</a>
            <div className="flex gap-2 w-full">
              <button onClick={() => { printTakeaway(); setTakeawayQrOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => setTakeawayQrOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table QR modal ─────────────────────────────────────────────── */}
      {tableQrPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTableQrPreview(null)}>
          <div className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 text-lg">Table {tableQrPreview.number}</h2>
            <p className="text-xs text-gray-400 -mt-2">{tableQrPreview.seats} seats</p>
            <a href={`${origin}/welcome/${tableQrPreview.id}`} target="_blank" rel="noopener noreferrer" title="Open link">
              <QRCodeSVG value={`${origin}/welcome/${tableQrPreview.id}`} size={200} />
            </a>
            <a href={`${origin}/welcome/${tableQrPreview.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:text-orange-700 hover:underline text-center break-all">{origin}/welcome/{tableQrPreview.id}</a>
            <div className="flex gap-2 w-full">
              <button onClick={() => { printOneTable(tableQrPreview); setTableQrPreview(null); }} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => setTableQrPreview(null)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Room QR modal ──────────────────────────────────────────────── */}
      {roomQrPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRoomQrPreview(null)}>
          <div className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <BedDouble size={20} className="text-blue-500" />
              <h2 className="font-bold text-gray-900 text-lg">Room {roomQrPreview.number}</h2>
            </div>
            {roomQrPreview.name && <p className="text-xs text-gray-400 -mt-2">{roomQrPreview.name}</p>}
            <a href={`${origin}/room/${roomQrPreview.id}`} target="_blank" rel="noopener noreferrer" title="Open link">
              <QRCodeSVG value={`${origin}/room/${roomQrPreview.id}`} size={200} />
            </a>
            <a href={`${origin}/room/${roomQrPreview.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 hover:underline text-center break-all">{origin}/room/{roomQrPreview.id}</a>
            <div className="flex gap-2 w-full">
              <button onClick={() => { printOneRoom(roomQrPreview); setRoomQrPreview(null); }} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => setRoomQrPreview(null)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
