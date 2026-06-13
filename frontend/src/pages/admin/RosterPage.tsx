import { useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Users, Calendar, CheckCircle2, Loader2,
} from 'lucide-react';
import {
  rosterService, roleColor, STATUS_CFG, SHIFT_ROLES,
} from '../../services/rosterService';
import type { Shift, ShiftInput, ShiftStatus } from '../../services/rosterService';
import toast from 'react-hot-toast';
import axios from 'axios';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

// â”€â”€ Date helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();               // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;   // back to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface StaffUser { id: string; name: string; role: string }

const EMPTY: ShiftInput = {
  userId:    null,
  staffName: '',
  staffRole: 'waiter',
  date:      '',
  startTime: '09:00',
  endTime:   '17:00',
  notes:     null,
  status:    'scheduled',
};

const STATUS_CYCLE: ShiftStatus[] = ['scheduled', 'confirmed', 'absent'];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function RosterPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [shifts,    setShifts]    = useState<Shift[]>([]);
  const [users,     setUsers]     = useState<StaffUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<Shift | null>(null);
  const [form,      setForm]      = useState<ShiftInput>(EMPTY);
  const [saving,    setSaving]    = useState(false);

  const weekDates  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayStr   = toDateStr(new Date());
  const fromStr    = toDateStr(weekStart);
  const toStr      = toDateStr(addDays(weekStart, 6));

  // Week label: "12 – 18 May 2025"
  const weekLabel = `${weekStart.getDate()} – ${addDays(weekStart, 6).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })}`;

  // â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setLoading(true);
    rosterService.getShifts(fromStr, toStr)
      .then(setShifts)
      .catch(() => toast.error('Failed to load shifts'))
      .finally(() => setLoading(false));
  }, [fromStr, toStr]);

  useEffect(() => {
    axios.get<StaffUser[]>(`${import.meta.env.VITE_API_URL ?? ''}/api/users`)
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalShifts  = shifts.length;
  const uniqueStaff  = new Set(shifts.map((s) => s.staffName)).size;
  const todayCount   = shifts.filter((s) => s.date === todayStr).length;

  // â”€â”€ Modal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function openAdd(date: string) {
    setEditing(null);
    setForm({ ...EMPTY, date });
    setShowModal(true);
  }

  function openEdit(shift: Shift) {
    setEditing(shift);
    setForm({
      userId:    shift.userId,
      staffName: shift.staffName,
      staffRole: shift.staffRole,
      date:      shift.date,
      startTime: shift.startTime,
      endTime:   shift.endTime,
      notes:     shift.notes,
      status:    shift.status,
    });
    setShowModal(true);
  }

  function handleUserSelect(uid: string) {
    if (!uid) { setForm((f) => ({ ...f, userId: null })); return; }
    const u = users.find((x) => x.id === uid);
    if (u) setForm((f) => ({ ...f, userId: u.id, staffName: u.name, staffRole: u.role }));
  }

  // â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function save() {
    if (!form.staffName.trim())        return toast.error('Staff name is required');
    if (!form.date)                    return toast.error('Date is required');
    if (!form.startTime || !form.endTime) return toast.error('Start and end times are required');
    setSaving(true);
    try {
      if (editing) {
        const updated = await rosterService.updateShift(editing.id, form);
        setShifts((p) => p.map((s) => s.id === updated.id ? updated : s));
        toast.success('Shift updated');
      } else {
        const created = await rosterService.createShift(form);
        setShifts((p) => [...p, created]);
        toast.success('Shift added');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save shift');
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift(id: string) {
    if (!confirm('Delete this shift?')) return;
    try {
      await rosterService.deleteShift(id);
      setShifts((p) => p.filter((s) => s.id !== id));
      setShowModal(false);
      toast.success('Shift deleted');
    } catch {
      toast.error('Failed to delete shift');
    }
  }

  async function cycleStatus(e: React.MouseEvent, shift: Shift) {
    e.stopPropagation();
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(shift.status) + 1) % STATUS_CYCLE.length];
    try {
      const updated = await rosterService.updateStatus(shift.id, next);
      setShifts((p) => p.map((s) => s.id === updated.id ? updated : s));
    } catch {
      toast.error('Failed to update status');
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AdminHeader title="Staff Roster" backTo="/admin">
        {/* Week navigation */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            title="Previous week"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="text-xs font-semibold text-gray-600 hover:text-orange-500 px-2 transition-colors min-w-[130px] text-center"
            title="Jump to this week"
          >
            {weekLabel}
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            title="Next week"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <button
          onClick={() => openAdd(todayStr)}
          className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors shrink-0"
        >
          <Plus size={14} /> Add Shift
        </button>
      </AdminHeader>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">

        {/* â”€â”€ Stats bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Shifts this week', value: totalShifts, icon: Calendar,      color: 'bg-blue-50   text-blue-600'   },
            { label: 'Unique staff',      value: uniqueStaff, icon: Users,         color: 'bg-purple-50 text-purple-600' },
            { label: 'Today\'s shifts',   value: todayCount,  icon: CheckCircle2,  color: 'bg-green-50  text-green-600'  },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2.5">
              <div className={`p-2 rounded-xl shrink-0 ${s.color}`}>
                <s.icon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* â”€â”€ Weekly grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={28} className="animate-spin text-orange-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex divide-x divide-gray-100" style={{ minWidth: '700px' }}>
                {weekDates.map((day) => {
                  const dateStr   = toDateStr(day);
                  const isToday   = dateStr === todayStr;
                  const isPast    = dateStr < todayStr;
                  const dayShifts = shifts
                    .filter((s) => s.date === dateStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div key={dateStr} className={`flex-1 flex flex-col ${isPast && !isToday ? 'opacity-70' : ''}`}>

                      {/* Day column header */}
                      <div className={`px-2 py-2.5 border-b border-gray-100 flex flex-col items-center gap-0.5 ${
                        isToday ? 'bg-orange-500' : 'bg-gray-50'
                      }`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-orange-200' : 'text-gray-400'}`}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className={`text-lg font-bold leading-none ${isToday ? 'text-white' : 'text-gray-700'}`}>
                          {day.getDate()}
                        </span>
                        <span className={`text-[10px] font-medium ${isToday ? 'text-orange-100' : 'text-gray-400'}`}>
                          {dayShifts.length > 0 ? `${dayShifts.length} shift${dayShifts.length !== 1 ? 's' : ''}` : ' - '}
                        </span>
                      </div>

                      {/* Shift cards */}
                      <div className="p-1.5 space-y-1 flex-1 min-h-[140px]">
                        {dayShifts.map((shift) => {
                          const rc  = roleColor(shift.staffRole);
                          const sc  = STATUS_CFG[shift.status] ?? STATUS_CFG.scheduled;
                          const dur = shiftDuration(shift.startTime, shift.endTime);

                          return (
                            <div
                              key={shift.id}
                              onClick={() => openEdit(shift)}
                              className={`${rc.bg} ${rc.border} border rounded-xl p-2 cursor-pointer hover:shadow-sm transition-shadow`}
                            >
                              {/* Name row */}
                              <div className="flex items-center gap-1 mb-0.5">
                                <button
                                  onClick={(e) => cycleStatus(e, shift)}
                                  title={`${sc.label}  -  click to cycle`}
                                  className={`w-2 h-2 rounded-full shrink-0 ${sc.dot} hover:scale-150 transition-transform`}
                                />
                                <span className={`text-[11px] font-bold truncate ${rc.text}`}>
                                  {shift.staffName}
                                </span>
                              </div>
                              {/* Time */}
                              <p className="text-[10px] text-gray-500 leading-snug">
                                {shift.startTime}–{shift.endTime}
                                {dur && <span className="text-gray-400 ml-1">({dur})</span>}
                              </p>
                              {/* Role chip */}
                              <span className={`inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${rc.bg} ${rc.text}`}>
                                {shift.staffRole}
                              </span>
                            </div>
                          );
                        })}

                        {/* Add shift button */}
                        <button
                          onClick={() => openAdd(dateStr)}
                          className="w-full flex items-center justify-center py-2 rounded-xl text-gray-300 hover:text-orange-400 hover:bg-orange-50 transition-colors border border-dashed border-gray-200 hover:border-orange-200"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Legend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Roles</span>
          {SHIFT_ROLES.map((role) => {
            const rc = roleColor(role);
            return (
              <span key={role} className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${rc.bg} ${rc.text}`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            );
          })}
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-2">Status</span>
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5 text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          ))}
        </div>

        {/* â”€â”€ Scheduled staff list (current week) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {shifts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Users size={15} className="text-orange-500" /> Staff scheduled this week
              </h2>
            </div>
            <div className="px-4 py-3">
              {Array.from(
                shifts.reduce((map, s) => {
                  if (!map.has(s.staffName)) map.set(s.staffName, { role: s.staffRole, count: 0, hours: 0 });
                  const entry = map.get(s.staffName)!;
                  entry.count++;
                  const [sh, sm] = s.startTime.split(':').map(Number);
                  const [eh, em] = s.endTime.split(':').map(Number);
                  entry.hours += Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                  return map;
                }, new Map<string, { role: string; count: number; hours: number }>()),
              )
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([name, info]) => {
                  const rc = roleColor(info.role);
                  return (
                    <div key={name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className={`w-8 h-8 rounded-full ${rc.bg} ${rc.text} flex items-center justify-center text-sm font-bold shrink-0`}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                        <p className="text-xs text-gray-400">{info.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-700">{info.count} shift{info.count !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-400">{info.hours.toFixed(1)}h</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Add / Edit Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 space-y-4 max-h-[92vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Shift' : 'Add Shift'}</h2>
              <div className="flex items-center gap-1">
                {editing && (
                  <button
                    onClick={() => deleteShift(editing.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete shift"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Staff picker (from users list) */}
            {users.length > 0 && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Select staff member</label>
                <select
                  value={form.userId ?? ''}
                  onChange={(e) => handleUserSelect(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                >
                  <option value=""> -  enter name manually  - </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Name *</label>
              <input
                type="text"
                value={form.staffName}
                onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))}
                placeholder="e.g. John Smith"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Role</label>
              <select
                value={form.staffRole}
                onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300 bg-white"
              >
                {SHIFT_ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Start *</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">End *</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>
            </div>

            {/* Duration preview */}
            {form.startTime && form.endTime && shiftDuration(form.startTime, form.endTime) && (
              <p className="text-xs text-gray-400 -mt-2 text-center">
                Duration: <span className="font-semibold text-gray-600">{shiftDuration(form.startTime, form.endTime)}</span>
              </p>
            )}

            {/* Status (edit only) */}
            {editing && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(STATUS_CFG) as [ShiftStatus, typeof STATUS_CFG[ShiftStatus]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: key }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        form.status === key
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Notes</label>
              <input
                type="text"
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                placeholder="Optional notes…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-orange-500 text-white py-3 rounded-2xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Add Shift'}
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
