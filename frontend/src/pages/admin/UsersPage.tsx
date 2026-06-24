import { useEffect, useState } from 'react';
import { useConfirm } from '../../components/ConfirmModal';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Loader2, ShieldCheck, ChefHat, CreditCard, UserCheck, Briefcase, Check, Copy, Users, BarChart2, CalendarDays } from 'lucide-react';
import { PageSpinner } from '../../components/Spinner';
import { FormLabel } from '../../components/FormLabel';
import { FormInput } from '../../components/FormInput';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { PERMISSION_GROUPS, assignablePermissions } from '../../lib/permissions';
import { StaffPerformancePanel } from './StaffPerformancePage';
import { RosterPanel } from './RosterPage';

type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
type StaffTab = 'users' | 'performance' | 'roster';

const STAFF_TABS: { id: StaffTab; label: string; Icon: React.ElementType }[] = [
  { id: 'users',       label: 'Users',       Icon: Users },
  { id: 'performance', label: 'Performance', Icon: BarChart2 },
  { id: 'roster',      label: 'Roster',      Icon: CalendarDays },
];

interface User { id: string; username: string; name: string; role: UserRole; permissions?: string[]; }

const EMPTY: { username: string; name: string; password: string; role: UserRole; permissions: string[] } = {
  username: '', name: '', password: '', role: 'waiter', permissions: [],
};

const ROLE_CONFIG: {
  role: UserRole;
  label: string;
  Icon: React.ElementType;
  iconCls: string;
  sectionLabel: string;
  emptyLabel: string;
}[] = [
  { role: 'admin',   label: 'Admin',         Icon: ShieldCheck, iconCls: 'text-orange-500', sectionLabel: 'Admins',        emptyLabel: 'No admins yet' },
  { role: 'manager', label: 'Manager',        Icon: Briefcase,   iconCls: 'text-purple-500', sectionLabel: 'Managers',      emptyLabel: 'No managers yet' },
  { role: 'cashier', label: 'Cashier',        Icon: CreditCard,  iconCls: 'text-green-500',  sectionLabel: 'Cashiers',      emptyLabel: 'No cashiers yet' },
  { role: 'waiter',  label: 'Waiter',         Icon: UserCheck,   iconCls: 'text-blue-500',   sectionLabel: 'Waiters',       emptyLabel: 'No waiters yet' },
  { role: 'kitchen', label: 'Kitchen Staff',  Icon: ChefHat,     iconCls: 'text-rose-500',   sectionLabel: 'Kitchen Staff', emptyLabel: 'No kitchen staff yet' },
];

const BADGE_CLS: Record<UserRole, string> = {
  admin:   'bg-orange-100 text-orange-700',
  manager: 'bg-purple-100 text-purple-700',
  cashier: 'bg-green-100 text-green-700',
  waiter:  'bg-blue-100 text-blue-700',
  kitchen: 'bg-rose-100 text-rose-700',
};

export function UsersPage() {
  const { confirm, modal } = useConfirm();
  const { user: me, features } = useAuth();
  const assignable = assignablePermissions(features);
  const assignableKeys = new Set<string>(assignable.map((p) => p.key));
  const [tab, setTab] = useState<StaffTab>('users');
  const [filterRole, setFilterRole] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () =>
    axios.get<User[]>('/api/users')
      .then((r) => setUsers(r.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  function openNew(role?: UserRole) {
    setEditing(null);
    setForm(role ? { ...EMPTY, role } : EMPTY);
    setFormError('');
    setShowPwd(false);
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ username: u.username, name: u.name, password: '', role: u.role, permissions: u.permissions ?? [] });
    setFormError('');
    setShowPwd(false);
    setShowForm(true);
  }

  function togglePerm(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  }

  async function save() {
    setFormError('');
    if (!form.username.trim() || !form.name.trim()) {
      setFormError('Username and name are required'); return;
    }
    if (!editing && !form.password) {
      setFormError('Password is required for new users'); return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('Password must be at least 6 characters'); return;
    }

    // Admins implicitly have full access; only staff carry an explicit permission set.
    const perms = form.role === 'admin' ? [] : form.permissions.filter((p) => assignableKeys.has(p));

    setSaving(true);
    try {
      if (editing) {
        const res = await axios.put<User>(`/api/users/${editing.id}`, {
          username: form.username.trim(),
          name:     form.name.trim(),
          role:     form.role,
          permissions: perms,
          ...(form.password ? { password: form.password } : {}),
        });
        setUsers((p) => p.map((u) => (u.id === editing.id ? res.data : u)));
        toast.success('User updated');
      } else {
        const res = await axios.post<User>('/api/users', {
          username: form.username.trim(),
          name:     form.name.trim(),
          password: form.password,
          role:     form.role,
          permissions: perms,
        });
        setUsers((p) => [...p, res.data]);
        toast.success('User created');
      }
      setShowForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function del(u: User) {
    const ok = await confirm({ title: `Delete user "${u.name}"? This cannot be undone.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await axios.delete(`/api/users/${u.id}`);
      setUsers((p) => p.filter((x) => x.id !== u.id));
      toast.success('User deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to delete user');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {modal}
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      <AdminHeader title="Manage Staff" backTo="/admin/settings" />

      {/* Tab bar (pill style) — with the Add User button on the same row */}
      <div className="bg-white shadow-sm px-3 sm:px-4 lg:px-6 pt-3 pb-3 flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {STAFF_TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'users' && (
          <button
            onClick={() => openNew(filterRole ?? undefined)}
            className="ml-auto shrink-0 flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors whitespace-nowrap"
          >
            <Plus size={14} /> Add {filterRole ? ROLE_CONFIG.find(r => r.role === filterRole)?.label : 'User'}
          </button>
        )}
      </div>

      {tab === 'performance' && <StaffPerformancePanel />}
      {tab === 'roster' && <RosterPanel />}

      {tab === 'users' && (
      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {loading ? (
          <PageSpinner />
        ) : (
          <>
            {/* Role filter cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ROLE_CONFIG.map(({ role, sectionLabel, Icon, iconCls }) => {
                const count = users.filter((u) => u.role === role).length;
                const active = filterRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setFilterRole(active ? null : role)}
                    className={`rounded-2xl border shadow-sm px-4 py-3 flex flex-col gap-1.5 hover:shadow-md transition-all text-left group relative ${
                      active
                        ? 'bg-orange-50 border-orange-400 shadow-orange-100'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={18} className={active ? 'text-orange-500' : iconCls} />
                      <span className={`text-xs font-bold ${active ? 'text-orange-600' : 'text-gray-500'}`}>{count}</span>
                    </div>
                    <p className={`text-sm font-semibold ${active ? 'text-orange-700' : 'text-gray-700'}`}>{sectionLabel}</p>
                    <p className={`text-xs transition-opacity ${active ? 'text-orange-400 opacity-100' : 'text-orange-500 opacity-0 group-hover:opacity-100'}`}>
                      {active ? '✕ Clear filter' : 'Click to filter'}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Full user list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span className="w-9" />
                <span>
                  Name / Username
                  {filterRole && (
                    <span className="ml-2 normal-case font-normal text-orange-500">
                      — showing {ROLE_CONFIG.find(r => r.role === filterRole)?.sectionLabel} only
                    </span>
                  )}
                </span>
                <span className="text-center w-20">Role</span>
                <span className="w-16 text-center">Actions</span>
              </div>

              {users.length === 0 ? (
                <p className="text-sm text-gray-400 py-10 text-center">No users yet. Click a role card above to add one.</p>
              ) : (() => {
                const visible = ROLE_CONFIG.flatMap(({ role }) =>
                  users.filter((u) => (!filterRole || u.role === filterRole) && u.role === role)
                );
                return visible.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No {ROLE_CONFIG.find(r => r.role === filterRole)?.sectionLabel} found.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {visible.map((u) => (
                      <UserRow key={u.id} user={u} isMe={u.id === me?.id} onEdit={openEdit} onDelete={del} />
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-3xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing
                  ? `Edit: ${editing.name}`
                  : `New ${ROLE_CONFIG.find((r) => r.role === form.role)?.label ?? 'User'}`}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                {formError}
              </div>
            )}

            {/* Two-column layout */}
            <div className="grid md:grid-cols-2 gap-6 items-start">

            {/* â”€â”€ Left column: account fields + role â”€â”€ */}
            <div className="space-y-4">
            {/* Name */}
            <div>
              <FormLabel>Display Name</FormLabel>
              <FormInput
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kitchen Staff"
              />
            </div>

            {/* Username */}
            <div>
              <FormLabel>Username</FormLabel>
              <FormInput
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. manager1"
                autoComplete="off"
              />
            </div>

            {/* Password */}
            <div>
              <FormLabel>
                Password
                {editing && <span className="text-gray-400 font-normal ml-1 normal-case">(leave blank to keep current)</span>}
              </FormLabel>
              <div className="relative">
                <FormInput
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? 'Leave blank to keep current' : 'Min. 6 characters'}
                  autoComplete="new-password"
                  className="pr-11"
                />
                <button type="button" onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_CONFIG.map(({ role, label, Icon, iconCls }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role }))}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      form.role === role
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} className={form.role === role ? 'text-orange-600' : iconCls} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            </div>{/* â”€â”€ end left column â”€â”€ */}

            {/* â”€â”€ Right column: Access & Permissions â”€â”€ */}
            <div className="md:border-l md:border-gray-100 md:pl-6">
            {form.role === 'admin' ? (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700">
                Admins have full access to every enabled function.
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Access &amp; Permissions</label>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: assignable.map((p) => p.key) }))} className="text-orange-600 font-semibold hover:underline">All</button>
                    <span className="text-gray-300"> . </span>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: [] }))} className="text-gray-500 font-semibold hover:underline">None</button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3">Choose which functions this staff member can access.</p>
                <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                  {PERMISSION_GROUPS.map((grp) => {
                    const items = grp.items.filter((it) => assignableKeys.has(it.key));
                    if (items.length === 0) return null;
                    return (
                      <div key={grp.group}>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{grp.group}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {items.map((it) => {
                            const on = form.permissions.includes(it.key);
                            return (
                              <button
                                key={it.key}
                                type="button"
                                onClick={() => togglePerm(it.key)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                                  on ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${on ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300'}`}>
                                  {on && <Check size={10} />}
                                </span>
                                <span className="truncate">{it.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>{/* â”€â”€ end right column â”€â”€ */}
            </div>{/* â”€â”€ end two-column grid â”€â”€ */}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-60 bg-orange-500 hover:bg-orange-600"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}


function UserRow({ user, isMe, onEdit, onDelete }: {
  user: User; isMe: boolean;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  function copyUsername() {
    navigator.clipboard.writeText(user.username).then(() => toast.success(`Copied @${user.username}`));
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${BADGE_CLS[user.role]}`}>
        {user.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + username */}
      <div className="min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {user.name} {isMe && <span className="text-xs text-orange-500 font-normal">(you)</span>}
        </p>
        <button
          onClick={copyUsername}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors group"
          title="Copy username"
        >
          <span className="font-mono">@{user.username}</span>
          <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Role badge */}
      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full w-20 text-center ${BADGE_CLS[user.role]}`}>
        {user.role}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 w-16 justify-end">
        <button onClick={() => onEdit(user)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50">
          <Pencil size={15} />
        </button>
        {!isMe && (
          <button onClick={() => onDelete(user)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
