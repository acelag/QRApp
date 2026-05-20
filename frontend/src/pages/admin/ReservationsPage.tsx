import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, ChevronLeft, ChevronRight, Users, Phone, MessageSquare,
  X, Loader2, CalendarDays, Table2,
} from 'lucide-react';
import { reservationService, type ReservationInput } from '../../services/reservationService';
import type { Reservation, ReservationStatus } from '../../types';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending:   'bg-yellow-50  text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50    text-blue-700   border-blue-200',
  seated:    'bg-green-50   text-green-700  border-green-200',
  cancelled: 'bg-gray-100   text-gray-400   border-gray-200',
  'no-show': 'bg-red-50     text-red-600    border-red-200',
};

const STATUS_ACTIONS: Record<ReservationStatus, { label: string; next: ReservationStatus }[]> = {
  pending:   [{ label: 'Confirm', next: 'confirmed' }, { label: 'Cancel', next: 'cancelled' }],
  confirmed: [{ label: 'Seat',    next: 'seated' },    { label: 'No-show', next: 'no-show' }, { label: 'Cancel', next: 'cancelled' }],
  seated:    [],
  cancelled: [],
  'no-show': [],
};

const ACTION_STYLES: Record<ReservationStatus, string> = {
  confirmed: 'bg-blue-600 text-white hover:bg-blue-700',
  seated:    'bg-green-600 text-white hover:bg-green-700',
  'no-show': 'bg-red-500 text-white hover:bg-red-600',
  cancelled: 'bg-gray-200 text-gray-600 hover:bg-gray-300',
  pending:   'bg-orange-500 text-white hover:bg-orange-600',
};

function fmt(date: Date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// 30-minute slots from 10:00 to 22:30
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 10; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 23) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

const EMPTY_FORM: ReservationInput = {
  customerName: '', customerPhone: '', partySize: 2,
  date: fmt(new Date()), time: '19:00', tableNumber: null, notes: '',
};

export function ReservationsPage() {
  const [date, setDate]             = useState(() => fmt(new Date()));
  const [reservations, setRes]      = useState<Reservation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Reservation | null>(null);
  const [form, setForm]             = useState<ReservationInput>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  const load = (d: string) => {
    setLoading(true);
    reservationService.getByDate(d)
      .then(setRes)
      .catch(() => toast.error('Failed to load reservations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(date); }, [date]);

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(fmt(d));
  }

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date });
    setShowForm(true);
  }

  function openEdit(r: Reservation) {
    setEditing(r);
    setForm({
      customerName: r.customerName, customerPhone: r.customerPhone ?? '',
      partySize: r.partySize, date: r.date, time: r.time,
      tableNumber: r.tableNumber ?? null, notes: r.notes ?? '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.customerName.trim() || !form.date || !form.time) {
      toast.error('Name, date and time are required'); return;
    }
    setSaving(true);
    try {
      const payload: ReservationInput = {
        ...form,
        customerPhone: form.customerPhone?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        tableNumber: form.tableNumber || null,
      };
      if (editing) {
        const updated = await reservationService.update(editing.id, payload);
        setRes((p) => p.map((r) => (r.id === editing.id ? updated : r)));
        toast.success('Reservation updated');
      } else {
        const created = await reservationService.create(payload);
        if (created.date === date) setRes((p) => [...p, created].sort((a, b) => a.time.localeCompare(b.time)));
        toast.success('Reservation created');
      }
      setShowForm(false);
    } catch {
      toast.error('Failed to save reservation');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(r: Reservation, status: ReservationStatus) {
    try {
      const updated = await reservationService.updateStatus(r.id, status);
      setRes((p) => p.map((x) => (x.id === r.id ? updated : x)).filter((x) => x.status !== 'cancelled'));
      toast.success(`Marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(r: Reservation) {
    if (!confirm(`Delete reservation for ${r.customerName}?`)) return;
    try {
      await reservationService.remove(r.id);
      setRes((p) => p.filter((x) => x.id !== r.id));
      toast.success('Reservation deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  const isToday = date === fmt(new Date());
  const dateLabel = (() => {
    const d = new Date(date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Reservations</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus size={14} /> New
          </button>
        </div>

        {/* Date navigation */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm">{dateLabel}</span>
            {!isToday && (
              <button onClick={() => setDate(fmt(new Date()))} className="text-xs text-orange-500 hover:underline">Today</button>
            )}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300 text-gray-600"
          />
          <button onClick={() => shiftDate(1)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center pt-16 text-gray-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-gray-600">No reservations for {dateLabel.toLowerCase()}</p>
            <p className="text-sm mt-1">Click New to add one</p>
          </div>
        ) : (
          reservations.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${r.status === 'cancelled' || r.status === 'no-show' ? 'opacity-60' : ''}`}
            >
              <div className="px-4 py-3 flex items-start gap-3">
                {/* Time */}
                <div className="shrink-0 text-center bg-orange-50 rounded-xl px-3 py-2">
                  <p className="text-base font-bold text-orange-700 leading-none">{r.time}</p>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{r.customerName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={11} /> {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}
                    </span>
                    {r.tableNumber && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Table2 size={11} /> Table {r.tableNumber}
                      </span>
                    )}
                    {r.customerPhone && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone size={11} /> {r.customerPhone}
                      </span>
                    )}
                  </div>
                  {r.notes && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <MessageSquare size={11} /> {r.notes}
                    </p>
                  )}
                </div>

                {/* Edit / delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition-colors text-xs">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Status actions */}
              {STATUS_ACTIONS[r.status].length > 0 && (
                <div className="px-4 pb-3 flex gap-2">
                  {STATUS_ACTIONS[r.status].map(({ label, next }) => (
                    <button
                      key={next}
                      onClick={() => handleStatus(r, next)}
                      className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors ${ACTION_STYLES[next]}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Reservation' : 'New Reservation'}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Guest Name *</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Time *</label>
                <select
                  value={TIME_SLOTS.includes(form.time) ? form.time : TIME_SLOTS[0]}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Party Size</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.partySize}
                  onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) || 1 }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Table #</label>
                <input
                  type="number"
                  min={1}
                  value={form.tableNumber ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, tableNumber: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Allergies, occasion, seating preference…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Reservation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
