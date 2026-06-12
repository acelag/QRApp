import { useEffect, useState } from 'react';
import { Plus, Trash2, UserCheck, Loader2, X } from 'lucide-react';
import { waiterService, type Waiter } from '../../services/waiterService';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

export function WaitersPage() {
  const [waiters, setWaiters]   = useState<Waiter[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [saving, setSaving]     = useState(false);

  const load = () =>
    waiterService.getWaiters()
      .then(setWaiters)
      .catch(() => toast.error('Failed to load waiters'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const w = await waiterService.addWaiter(name.trim());
      setWaiters((p) => [...p, w].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setShowForm(false);
      toast.success(`${w.name} added`);
    } catch {
      toast.error('Failed to add waiter');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(w: Waiter) {
    if (!confirm(`Remove waiter "${w.name}"?`)) return;
    try {
      await waiterService.deleteWaiter(w.id);
      setWaiters((p) => p.filter((x) => x.id !== w.id));
      toast.success(`${w.name} removed`);
    } catch {
      toast.error('Failed to remove waiter');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
      <AdminHeader title="Waiters" backTo="/admin">
        <button
          onClick={() => { setShowForm(true); setName(''); }}
          className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </AdminHeader>

      <div className="px-3 sm:px-4 lg:px-6 py-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 size={28} className="animate-spin text-orange-500" />
          </div>
        ) : waiters.length === 0 ? (
          <div className="text-center pt-16 text-gray-400">
            <UserCheck size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-gray-600">No waiters yet</p>
            <p className="text-sm mt-1">Add staff who can be assigned to orders</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {waiters.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0 text-sm">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <p className="flex-1 font-medium text-gray-900 text-sm">{w.name}</p>
                <button
                  onClick={() => handleDelete(w)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Waiter</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Waiter name"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Add Waiter
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
