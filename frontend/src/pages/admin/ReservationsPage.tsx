import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Loader2, X, Phone, Users, Pencil, Trash2,
  CalendarDays, MapPin, BedDouble, List, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useConfirm } from '../../components/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { tableService } from '../../services/tableService';
import { roomService } from '../../services/roomService';
import { restaurantService } from '../../services/restaurantService';
import type { Table, Room } from '../../types';
import {
  reservationService,
  type Reservation, type ReservationStatus, type ReservationType,
} from '../../services/reservationService';

const STATUS_META: Record<ReservationStatus, { label: string; cls: string; dot: string }> = {
  booked:    { label: 'Booked',    cls: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  seated:    { label: 'Seated',    cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600',      dot: 'bg-red-400' },
  no_show:   { label: 'No-show',   cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
};
const STATUS_FILTERS: (ReservationStatus | 'all')[] = ['all', 'booked', 'seated', 'completed', 'cancelled', 'no_show'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const todayStr = () => new Date().toLocaleDateString('en-CA');
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

interface FormState {
  id: string | null; type: ReservationType; tableId: string; roomId: string;
  customerName: string; customerPhone: string; partySize: string; reservedAt: string; notes: string;
}
const emptyForm = (date: string): FormState => ({
  id: null, type: 'table', tableId: '', roomId: '', customerName: '', customerPhone: '', partySize: '2', reservedAt: `${date}T19:00`, notes: '',
});

export function ReservationsPage({ embedded = false }: { embedded?: boolean }) {
  const { confirm, modal } = useConfirm();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [date, setDate] = useState(todayStr());
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ReservationType>('all');
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tz, setTz] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [tables, setTables] = useState<Table[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(todayStr()));
  const [saving, setSaving] = useState(false);

  // Calendar grid (6 weeks) for the current month cursor
  const cells = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [monthCursor]);

  const load = useCallback(() => {
    setLoading(true);
    const params = statusFilter === 'all' ? {} : { status: statusFilter };
    const req = view === 'calendar'
      ? reservationService.list({ from: ymd(cells[0]), to: ymd(cells[41]), ...params })
      : reservationService.list({ date, ...params });
    req.then(setItems).catch(() => toast.error('Failed to load reservations')).finally(() => setLoading(false));
  }, [view, date, statusFilter, cells]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    tableService.getTables().then(setTables).catch(() => {});
    roomService.getRooms().then(setRooms).catch(() => {});
    restaurantService.getMyRestaurant().then((r) => { if (r?.timezone) setTz(r.timezone); }).catch(() => {});
  }, []);

  // Group reservations by their restaurant-local day
  const dayKey = useCallback((iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)),
  [tz]);
  const visibleItems = useMemo(
    () => typeFilter === 'all' ? items : items.filter((r) => r.type === typeFilter),
    [items, typeFilter],
  );
  const groupByDay = useCallback((list: Reservation[]) => {
    const m = new Map<string, Reservation[]>();
    for (const r of list) { const k = dayKey(r.reservedAt); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    for (const arr of m.values()) arr.sort((a, b) => a.reservedAt.localeCompare(b.reservedAt));
    return m;
  }, [dayKey]);

  function openNew(prefillDate?: string) { setForm(emptyForm(prefillDate ?? date)); setShowForm(true); }
  function openEdit(r: Reservation) {
    setForm({ id: r.id, type: r.type, tableId: r.tableId ?? '', roomId: r.roomId ?? '', customerName: r.customerName, customerPhone: r.customerPhone ?? '', partySize: String(r.partySize), reservedAt: toLocalInput(r.reservedAt), notes: r.notes ?? '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.customerName.trim()) { toast.error('Customer name is required'); return; }
    if (form.type === 'table' && !form.tableId) { toast.error('Select a table'); return; }
    if (form.type === 'room' && !form.roomId) { toast.error('Select a room'); return; }
    setSaving(true);
    const payload = {
      type: form.type,
      tableId: form.type === 'table' ? form.tableId : null,
      roomId: form.type === 'room' ? form.roomId : null,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim() || null,
      partySize: parseInt(form.partySize, 10) || 1,
      reservedAt: new Date(form.reservedAt).toISOString(),
      notes: form.notes.trim() || null,
    };
    try {
      if (form.id) await reservationService.update(form.id, payload); else await reservationService.create(payload);
      toast.success(form.id ? 'Reservation updated' : 'Reservation added');
      setShowForm(false); load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save');
    } finally { setSaving(false); }
  }
  async function setStatus(r: Reservation, status: ReservationStatus) {
    setItems((p) => p.map((x) => x.id === r.id ? { ...x, status } : x));
    try { await reservationService.update(r.id, { status }); } catch { toast.error('Failed to update'); load(); }
  }
  async function remove(r: Reservation) {
    const ok = await confirm({ title: `Delete reservation for ${r.customerName}?`, confirmLabel: 'Delete' });
    if (!ok) return;
    try { await reservationService.remove(r.id); setItems((p) => p.filter((x) => x.id !== r.id)); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  }

  const locationLabel = (r: Reservation) => r.type === 'room'
    ? `Room ${r.roomNumber ?? '?'}${r.roomName ? `  .  ${r.roomName}` : ''}` : `Table ${r.tableNumber ?? '?'}`;
  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const input = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors';
  const todayKey = ymd(new Date());

  const renderCalendar = (list: Reservation[], label?: string) => {
    const map = groupByDay(list);
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {label && (
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-1.5 text-sm font-bold text-gray-700">
            {label === 'Rooms' ? <BedDouble size={15} className="text-blue-500" /> : <MapPin size={15} className="text-orange-500" />}
            {label}
            <span className="ml-auto text-xs font-medium text-gray-400">{list.length}</span>
          </div>
        )}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((w) => <div key={w} className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === monthCursor.getMonth();
            const dayItems = map.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div key={i} className={`min-h-[96px] border-b border-r border-gray-50 p-1.5 ${inMonth ? '' : 'bg-gray-50/60'} ${i % 7 === 6 ? 'border-r-0' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => { setDate(key); setView('list'); }}
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${isToday ? 'bg-orange-500 text-white' : inMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}`}
                    title="Open this day"
                  >
                    {d.getDate()}
                  </button>
                  <button onClick={() => openNew(key)} className="opacity-0 hover:opacity-100 focus:opacity-100 text-gray-300 hover:text-orange-500 transition-opacity" title="Add reservation"><Plus size={13} /></button>
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => openEdit(r)}
                      className={`w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-md truncate flex items-center gap-1 ${STATUS_META[r.status].cls} ${r.status === 'cancelled' ? 'line-through opacity-70' : ''}`}
                      title={`${timeStr(r.reservedAt)}  .  ${r.customerName}  .  ${locationLabel(r)}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[r.status].dot}`} />
                      <span className="font-semibold tabular-nums">{timeStr(r.reservedAt)}</span>
                      <span className="truncate">{r.customerName}</span>
                    </button>
                  ))}
                  {dayItems.length > 3 && (
                    <button onClick={() => { setDate(key); setView('list'); }} className="w-full text-left text-[11px] text-gray-400 px-1.5 hover:text-orange-500">+{dayItems.length - 3} more</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const headerActions = (
    <>
      <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
        <button onClick={() => setView('calendar')} title="Calendar" className={`p-1.5 rounded-lg transition-colors ${view === 'calendar' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><CalendarDays size={16} /></button>
        <button onClick={() => setView('list')} title="List" className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><List size={16} /></button>
      </div>
      {view === 'list' && (
        <div className="relative">
          <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-300" />
        </div>
      )}
      <button onClick={() => openNew()} className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors">
        <Plus size={14} /> New
      </button>
    </>
  );

  const innerContent = (
    <>
      {modal}
      {embedded && (
        <div className="px-3 sm:px-4 lg:px-6 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {headerActions}
        </div>
      )}

      <div className="bg-white shadow-sm">
          {/* Type filter (tables / rooms) */}
          <div className="px-3 sm:px-4 lg:px-6 pb-2 flex items-center gap-2">
            <div className="inline-flex bg-gray-100 rounded-full p-0.5 text-xs font-medium">
              {([
                { v: 'all',   label: 'All' },
                { v: 'table', label: 'Tables' },
                { v: 'room',  label: 'Rooms' },
              ] as { v: 'all' | ReservationType; label: string }[]).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setTypeFilter(v)}
                  className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 ${typeFilter === v ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v === 'table' && <MapPin size={12} />}{v === 'room' && <BedDouble size={12} />}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter + (calendar) month nav */}
          <div className="px-3 sm:px-4 lg:px-6 pb-3 flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? 'All' : STATUS_META[s].label}
              </button>
            ))}
            {view === 'calendar' && (
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft size={18} /></button>
                <span className="text-sm font-semibold text-gray-800 w-36 text-center">{monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronRight size={18} /></button>
                <button onClick={() => setMonthCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })} className="ml-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Today</button>
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ Calendar view â”€â”€ */}
        {view === 'calendar' && (
          <div className="p-3 sm:p-4 lg:p-6">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
            ) : typeFilter === 'all' ? (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                {renderCalendar(items.filter((r) => r.type === 'table'), 'Tables')}
                {renderCalendar(items.filter((r) => r.type === 'room'), 'Rooms')}
              </div>
            ) : (
              renderCalendar(visibleItems)
            )}
            <p className="text-xs text-gray-400 mt-2">Times shown in <span className="font-medium">{tz}</span>. Click a day number to see its full list, or a reservation to edit.</p>
          </div>
        )}

        {/* â”€â”€ List view â”€â”€ */}
        {view === 'list' && (
          <div className="px-3 sm:px-4 lg:px-6 py-4 max-w-3xl">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
            ) : visibleItems.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No reservations" description="No reservations for this day" />
            ) : (
              <div className="space-y-2.5">
                {visibleItems.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-center shrink-0 w-16">
                        <p className="text-lg font-bold text-gray-900 leading-tight tabular-nums">{timeStr(r.reservedAt)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(r.reservedAt).toLocaleDateString([], { timeZone: tz, month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{r.customerName}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span>
                        </div>
                        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">{r.type === 'room' ? <BedDouble size={12} className="text-blue-500" /> : <MapPin size={12} className="text-orange-500" />}{locationLabel(r)}</span>
                          <span className="flex items-center gap-1"><Users size={12} /> {r.partySize}</span>
                          {r.customerPhone && <a href={`tel:${r.customerPhone}`} className="flex items-center gap-1 text-gray-500 hover:text-orange-600"><Phone size={12} /> {r.customerPhone}</a>}
                        </div>
                        {r.notes && <p className="text-xs text-gray-400 italic mt-1">“{r.notes}”</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Edit"><Pencil size={15} /></button>
                        <button onClick={() => remove(r)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    {(r.status === 'booked' || r.status === 'seated') && (
                      <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-50">
                        {r.status === 'booked' && <button onClick={() => setStatus(r, 'seated')} className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors">Mark seated</button>}
                        <button onClick={() => setStatus(r, 'completed')} className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Complete</button>
                        <button onClick={() => setStatus(r, 'no_show')} className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">No-show</button>
                        <button onClick={() => setStatus(r, 'cancelled')} className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{form.id ? 'Edit Reservation' : 'New Reservation'}</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['table', 'room'] as ReservationType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))} className={`py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-1.5 transition-colors ${form.type === t ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {t === 'room' ? <BedDouble size={15} /> : <MapPin size={15} />} {t === 'room' ? 'Room' : 'Table'}
                  </button>
                ))}
              </div>
              {form.type === 'table' ? (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Table *</label>
                  <select className={`${input} bg-white`} value={form.tableId} onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}>
                    <option value="">Select a table…</option>
                    {tables.map((t) => <option key={t.id} value={t.id}>Table {t.number} ({t.seats} seats)</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Room *</label>
                  <select className={`${input} bg-white`} value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
                    <option value="">Select a room…</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number}{r.name ? `  .  ${r.name}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Customer name *</label>
                <input className={input} value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Mr. Perera" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Phone</label>
                  <input className={input} value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="+94…" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Party size</label>
                  <input type="number" min="1" className={input} value={form.partySize} onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Date &amp; time *</label>
                <input type="datetime-local" className={input} value={form.reservedAt} onChange={(e) => setForm((f) => ({ ...f, reservedAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea rows={2} className={`${input} resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. window seat, birthday" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={15} className="animate-spin" />} {form.id ? 'Save changes' : 'Add reservation'}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );

  if (embedded) {
    return <div className="h-full overflow-y-auto bg-gray-50">{innerContent}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
        <AdminHeader title="Reservations" backTo="/admin">
          {headerActions}
        </AdminHeader>
        {innerContent}
      </main>
    </div>
  );
}
