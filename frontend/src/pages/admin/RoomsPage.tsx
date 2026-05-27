import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, QrCode, Printer, BedDouble } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Room } from '../../types';
import { roomService } from '../../services/roomService';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';

// ── Print helpers ─────────────────────────────────────────────────────────────

function qrCardHtml(roomNumber: number, roomName: string | null | undefined, url: string, svgHtml: string) {
  return `
    <div class="card">
      <div class="label">Scan to Order</div>
      <div class="room-num">Room ${roomNumber}</div>
      ${roomName ? `<div class="room-name">${roomName}</div>` : ''}
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
  .room-num { font-size: 48px; font-weight: 800; color: #111827; line-height: 1; }
  .room-name { font-size: 16px; color: #6b7280; margin-top: 6px; margin-bottom: 20px; }
  .qr { margin-top: 6px; margin-bottom: 0; }
  .qr svg { width: 220px !important; height: 220px !important; }
  .url { margin-top: 16px; font-size: 9px; color: #d1d5db; word-break: break-all; max-width: 260px; }
  @page { margin: 12mm; }
`;

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=520,height=700');
  if (!win) { toast.error('Allow pop-ups to print'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>Room QR Codes</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* already printed */ } }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────

export function RoomsPage() {
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [number, setNumber]       = useState('');
  const [name, setName]           = useState('');
  const [qrPreview, setQrPreview] = useState<Room | null>(null);

  const qrRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = () => roomService.getRooms().then(setRooms).catch(() => {});
  useEffect(() => { load(); }, []);

  const origin = window.location.origin;

  function getSvg(roomId: string): string {
    return qrRefs.current.get(roomId)?.querySelector('svg')?.outerHTML ?? '';
  }

  function printOne(room: Room) {
    const svg = getSvg(room.id);
    if (!svg) { toast.error('QR not ready, try again'); return; }
    const url = `${origin}/room/${room.id}`;
    openPrintWindow(qrCardHtml(room.number, room.name, url, svg));
  }

  function printAll() {
    if (rooms.length === 0) { toast.error('No rooms to print'); return; }
    const cards = rooms
      .map((r) => {
        const svg = getSvg(r.id);
        return svg ? qrCardHtml(r.number, r.name, `${origin}/room/${r.id}`, svg) : '';
      })
      .join('');
    openPrintWindow(cards);
  }

  async function addRoom() {
    const n = parseInt(number);
    if (!n) return toast.error('Enter a valid room number');
    if (rooms.some((r) => r.number === n)) return toast.error('Room number already exists');
    try {
      const r = await roomService.createRoom(n, name.trim() || undefined);
      setRooms((p) => [...p, r].sort((a, b) => a.number - b.number));
      setNumber('');
      setName('');
      toast.success(`Room ${n} added`);
    } catch {
      toast.error('Failed to add room');
    }
  }

  async function del(id: string, num: number) {
    if (!confirm(`Delete Room ${num}?`)) return;
    try {
      await roomService.deleteRoom(id);
      setRooms((p) => p.filter((r) => r.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
      {/* Hidden QR renders */}
      <div className="hidden" aria-hidden>
        {rooms.map((r) => (
          <div
            key={r.id}
            ref={(el) => {
              if (el) qrRefs.current.set(r.id, el);
              else qrRefs.current.delete(r.id);
            }}
          >
            <QRCodeSVG value={`${origin}/room/${r.id}`} size={220} />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Rooms & QR Codes</h1>
          {rooms.length > 0 && (
            <button
              onClick={printAll}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer size={14} /> Print All
            </button>
          )}
        </div>
      </header>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {/* Add room */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">Add Room</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRoom()}
              placeholder="Room #"
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRoom()}
              placeholder="Room name (optional)"
              className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={addRoom}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Room grid */}
        {rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No rooms yet. Add your first room above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rooms.map((room) => (
              <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-blue-50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <BedDouble size={14} className="text-blue-400" />
                  <p className="text-2xl font-bold text-gray-900">{room.number}</p>
                </div>
                {room.name && <p className="text-xs text-gray-400 mb-3 truncate">{room.name}</p>}
                {!room.name && <div className="mb-3" />}
                <div className="flex justify-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setQrPreview(room)}
                    className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    <QrCode size={12} /> QR
                  </button>
                  <button
                    onClick={() => printOne(room)}
                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <Printer size={12} /> Print
                  </button>
                  <button
                    onClick={() => del(room.id, room.number)}
                    className="flex items-center text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <div className="flex items-center gap-2">
              <BedDouble size={20} className="text-blue-500" />
              <h2 className="font-bold text-gray-900 text-lg">Room {qrPreview.number}</h2>
            </div>
            {qrPreview.name && <p className="text-xs text-gray-400 -mt-2">{qrPreview.name}</p>}

            <QRCodeSVG value={`${origin}/room/${qrPreview.id}`} size={200} />

            <p className="text-xs text-gray-300 text-center break-all">
              {origin}/room/{qrPreview.id}
            </p>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => { printOne(qrPreview); setQrPreview(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
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
      </main>
    </div>
  );
}
