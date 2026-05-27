import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, Eye, EyeOff, Loader2, ShieldCheck, ChefHat } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { AdminSidebar } from '../../components/AdminSidebar';

interface User { id: string; username: string; name: string; role: 'admin' | 'kitchen'; }

const EMPTY = { username: '', name: '', password: '', role: 'kitchen' as 'admin' | 'kitchen' };

export function UsersPage() {
  const { user: me } = useAuth();
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

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setShowPwd(false);
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ username: u.username, name: u.name, password: '', role: u.role });
    setFormError('');
    setShowPwd(false);
    setShowForm(true);
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

    setSaving(true);
    try {
      if (editing) {
        const res = await axios.put<User>(`/api/users/${editing.id}`, {
          username: form.username.trim(),
          name:     form.name.trim(),
          role:     form.role,
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
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/users/${u.id}`);
      setUsers((p) => p.filter((x) => x.id !== u.id));
      toast.success('User deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to delete user');
    }
  }

  const admins  = users.filter((u) => u.role === 'admin');
  const kitchen = users.filter((u) => u.role === 'kitchen');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin/settings" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Manage Users</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus size={14} /> Add User
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* Admins */}
            <Section title="Admins" icon={<ShieldCheck size={16} className="text-orange-500" />}>
              {admins.map((u) => (
                <UserRow key={u.id} user={u} isMe={u.id === me?.id} onEdit={openEdit} onDelete={del} />
              ))}
            </Section>

            {/* Kitchen */}
            <Section title="Kitchen Staff" icon={<ChefHat size={16} className="text-blue-500" />}>
              {kitchen.length === 0
                ? <p className="text-sm text-gray-400 py-2 text-center">No kitchen staff yet</p>
                : kitchen.map((u) => (
                    <UserRow key={u.id} user={u} isMe={false} onEdit={openEdit} onDelete={del} />
                  ))}
            </Section>
          </>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? `Edit — ${editing.name}` : 'New User'}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                {formError}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kitchen Staff"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
            </div>

            {/* Username */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. kitchen2"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Password
                {editing && <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? '••••••••' : 'Min. 6 characters'}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
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
                {(['admin', 'kitchen'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      form.role === r
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {r === 'admin' ? <ShieldCheck size={16} /> : <ChefHat size={16} />}
                    {r === 'admin' ? 'Admin' : 'Kitchen'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function UserRow({ user, isMe, onEdit, onDelete }: {
  user: User; isMe: boolean;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {user.name} {isMe && <span className="text-xs text-orange-500 font-normal">(you)</span>}
        </p>
        <p className="text-xs text-gray-400">@{user.username}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
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
