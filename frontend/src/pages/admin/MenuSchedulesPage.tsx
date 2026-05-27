import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Clock, Pencil, Trash2, X, Check,
  Info, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  menuScheduleService, formatDays, isScheduleNowActive, DAY_LABELS,
} from '../../services/menuScheduleService';
import type { MenuSchedule, ScheduleInput } from '../../services/menuScheduleService';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_PRESETS = [
  { label: 'Every day', value: 'daily' },
  { label: 'Mon – Fri', value: 'weekdays' },
  { label: 'Sat & Sun', value: 'weekends' },
] as const;

/** Convert a days string to the 7-element boolean array (index = JS getDay). */
function daysToFlags(days: string): boolean[] {
  const flags = new Array(7).fill(false);
  if (days === 'daily')    return new Array(7).fill(true);
  if (days === 'weekdays') { [1,2,3,4,5].forEach((d) => { flags[d] = true; }); return flags; }
  if (days === 'weekends') { [0,6].forEach((d) => { flags[d] = true; }); return flags; }
  days.split(',').map(Number).filter((n) => n >= 0 && n <= 6).forEach((d) => { flags[d] = true; });
  return flags;
}

/** Convert a 7-element boolean flags array to a days string. */
function flagsToDays(flags: boolean[]): string {
  const selected = flags.map((f, i) => f ? i : -1).filter((i) => i >= 0);
  if (selected.length === 7) return 'daily';
  if (selected.length === 5 && [1,2,3,4,5].every((d) => flags[d])) return 'weekdays';
  if (selected.length === 2 && flags[0] && flags[6]) return 'weekends';
  return selected.join(',') || 'daily';
}

const EMPTY: ScheduleInput = {
  name:      '',
  days:      'daily',
  startTime: '08:00',
  endTime:   '17:00',
  active:    true,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MenuSchedulesPage() {
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<MenuSchedule | null>(null);
  const [form,      setForm]      = useState<ScheduleInput>(EMPTY);
  const [dayFlags,  setDayFlags]  = useState<boolean[]>(new Array(7).fill(true));
  const [saving,    setSaving]    = useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [now,       setNow]       = useState(new Date());

  // Refresh "now" every minute for the active indicator
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    menuScheduleService.getSchedules()
      .then(setSchedules)
      .catch(() => toast.error('Failed to load schedules'))
      .finally(() => setLoading(false));
  }, []);

  // Keep dayFlags in sync with form.days
  function openAdd() {
    setEditing(null);
    const initial = { ...EMPTY };
    setForm(initial);
    setDayFlags(daysToFlags(initial.days));
    setShowModal(true);
  }

  function openEdit(s: MenuSchedule) {
    setEditing(s);
    const f: ScheduleInput = { name: s.name, days: s.days, startTime: s.startTime, endTime: s.endTime, active: s.active };
    setForm(f);
    setDayFlags(daysToFlags(s.days));
    setShowModal(true);
  }

  function applyPreset(preset: string) {
    setForm((f) => ({ ...f, days: preset }));
    setDayFlags(daysToFlags(preset));
  }

  function toggleDay(idx: number) {
    const next = dayFlags.map((v, i) => i === idx ? !v : v);
    setDayFlags(next);
    setForm((f) => ({ ...f, days: flagsToDays(next) }));
  }

  async function save() {
    if (!form.name.trim())          return toast.error('Schedule name is required');
    if (!form.startTime || !form.endTime) return toast.error('Start and end times are required');
    if (!dayFlags.some(Boolean))    return toast.error('Select at least one day');
    setSaving(true);
    try {
      if (editing) {
        const updated = await menuScheduleService.updateSchedule(editing.id, form);
        setSchedules((p) => p.map((s) => s.id === updated.id ? updated : s));
        toast.success('Schedule updated');
      } else {
        const created = await menuScheduleService.createSchedule(form);
        setSchedules((p) => [...p, created]);
        toast.success('Schedule created');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(s: MenuSchedule) {
    if (!confirm(`Delete "${s.name}"? It will be removed from ${s.itemCount} item${s.itemCount !== 1 ? 's' : ''}.`)) return;
    try {
      await menuScheduleService.deleteSchedule(s.id);
      setSchedules((p) => p.filter((x) => x.id !== s.id));
      setShowModal(false);
      toast.success('Schedule deleted');
    } catch {
      toast.error('Failed to delete schedule');
    }
  }

  async function toggleActive(s: MenuSchedule) {
    setToggling(s.id);
    try {
      await menuScheduleService.setActive(s.id, !s.active);
      setSchedules((p) => p.map((x) => x.id === s.id ? { ...x, active: !x.active } : x));
    } catch {
      toast.error('Failed to update');
    } finally {
      setToggling(null);
    }
  }

  // Duration helper
  function duration(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  // Is a schedule currently active right now?
  const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  void nowStr; // used indirectly via isScheduleNowActive

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/menu" className="text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Menu Schedules</h1>
            <p className="text-xs text-gray-400 mt-0.5">Control when items appear on the customer menu</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus size={14} /> New Schedule
          </button>
        </div>
      </header>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-3xl mx-auto">

        {/* ── Info banner ───────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700">
          <Info size={15} className="shrink-0 mt-0.5" />
          <p>
            Items <strong>without a schedule</strong> are always visible. Assign a schedule to an item
            from the <Link to="/admin/menu" className="underline hover:text-blue-900">Menu Items</Link> page
            to limit when it appears to customers.
            Categories can also have a schedule — all items in that category inherit it.
          </p>
        </div>

        {/* ── Schedule list ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Clock size={36} className="text-gray-200" />
            <p className="text-sm font-medium">No schedules yet</p>
            <p className="text-xs text-center max-w-xs">
              Create a schedule like "Breakfast" or "Happy Hour", then assign it to menu items.
            </p>
            <button
              onClick={openAdd}
              className="mt-2 flex items-center gap-1 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus size={14} /> Create first schedule
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => {
              const liveNow = isScheduleNowActive(s);
              const dur     = duration(s.startTime, s.endTime);
              return (
                <div key={s.id} className={`bg-white rounded-2xl shadow-sm border flex items-center gap-4 px-4 py-4 transition-colors ${
                  !s.active ? 'border-gray-100 opacity-60' : liveNow ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
                }`}>

                  {/* Left: colour strip */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${liveNow ? 'bg-green-400' : s.active ? 'bg-orange-400' : 'bg-gray-200'}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{s.name}</span>
                      {liveNow && (
                        <span className="text-[11px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active now
                        </span>
                      )}
                      {!s.active && (
                        <span className="text-[11px] font-semibold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {s.startTime} – {s.endTime}
                        <span className="text-gray-400 text-xs">({dur})</span>
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>{formatDays(s.days)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{s.itemCount} item{s.itemCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(s)}
                      disabled={toggling === s.id}
                      title={s.active ? 'Disable schedule' : 'Enable schedule'}
                      className="p-2 text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-50"
                    >
                      {toggling === s.id
                        ? <Loader2 size={18} className="animate-spin" />
                        : s.active
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} />}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-xl hover:bg-blue-50"
                      title="Edit schedule"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteSchedule(s)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
                      title="Delete schedule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 space-y-5 max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Schedule' : 'New Schedule'}
              </h2>
              <div className="flex items-center gap-1">
                {editing && (
                  <button
                    onClick={() => deleteSchedule(editing)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Schedule name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Breakfast, Lunch, Happy Hour"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                autoFocus
              />
            </div>

            {/* Day presets */}
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Days</label>
              <div className="flex gap-2 mb-3">
                {DAY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors ${
                      form.days === p.value
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Individual day toggles */}
              <div className="flex gap-1.5 justify-between">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`flex-1 aspect-square text-[11px] font-bold rounded-lg border transition-colors ${
                      dayFlags[idx]
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {label[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Start time *</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">End time *</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>
            </div>

            {/* Duration preview */}
            {form.startTime && form.endTime && (
              <p className="text-xs text-gray-400 -mt-3 text-center">
                Window: <span className="font-semibold text-gray-600">
                  {form.startTime} – {form.endTime} ({duration(form.startTime, form.endTime)})
                </span>
                {form.startTime > form.endTime && (
                  <span className="ml-1.5 text-amber-600">(spans midnight)</span>
                )}
              </p>
            )}

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={`relative w-10 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">
                {form.active ? 'Active — items follow this schedule' : 'Inactive — items show at all times'}
              </span>
            </label>

            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-orange-500 text-white py-3 rounded-2xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editing ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
