import { useEffect, useState } from 'react';
import {
  Plus, Package, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2,
  AlertTriangle,X, History, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import {
  stockService, STOCK_UNITS, MOVEMENT_REASONS_IN, MOVEMENT_REASONS_OUT,
  type StockItem, type StockMovement, type StockUnit, type MovementType,
} from '../../services/stockService';
import { useCurrency } from '../../context/CurrencyContext';

// ── helpers ─────────────────────────────────────────────────────────────────
const input = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors';
const btn   = (cls: string) => `px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${cls}`;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

interface ItemFormProps {
  initial?: Partial<StockItem>;
  onSave: (data: { name: string; unit: StockUnit; quantity: number; minThreshold: number; costPerUnit: number; category: string }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  isEdit?: boolean;
}
function ItemForm({ initial, onSave, onCancel, saving, isEdit }: ItemFormProps) {
  const [name,         setName]         = useState(initial?.name ?? '');
  const [unit,         setUnit]         = useState<StockUnit>(initial?.unit ?? 'piece');
  const [quantity,     setQuantity]     = useState(String(initial?.quantity ?? 0));
  const [minThreshold, setMinThreshold] = useState(String(initial?.minThreshold ?? 0));
  const [costPerUnit,  setCostPerUnit]  = useState(String(initial?.costPerUnit ?? 0));
  const [category,     setCategory]     = useState(initial?.category ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    await onSave({
      name: name.trim(),
      unit,
      quantity:     Number(quantity) || 0,
      minThreshold: Number(minThreshold) || 0,
      costPerUnit:  Number(costPerUnit) || 0,
      category:     category.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Name *</label>
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Breast" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
          <input className={input} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Meat, Dairy, Dry goods" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</label>
          <select className={input} value={unit} onChange={e => setUnit(e.target.value as StockUnit)}>
            {STOCK_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {!isEdit && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opening Quantity</label>
            <input className={input} type="number" min="0" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Low-stock Alert (min qty)</label>
          <input className={input} type="number" min="0" step="0.001" value={minThreshold} onChange={e => setMinThreshold(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost per unit</label>
          <input className={input} type="number" min="0" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className={btn('border border-gray-200 text-gray-600 hover:bg-gray-50')}>Cancel</button>
        <button type="submit" disabled={saving} className={btn('bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50')}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

interface MovementModalProps {
  item: StockItem;
  defaultType?: MovementType;
  onClose: () => void;
  onDone: (updated: StockItem) => void;
}
function MovementModal({ item, defaultType = 'in', onClose, onDone }: MovementModalProps) {
  const [type,     setType]     = useState<MovementType>(defaultType);
  const [quantity, setQuantity] = useState('');
  const [reason,   setReason]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const reasons = type === 'in' ? MOVEMENT_REASONS_IN : MOVEMENT_REASONS_OUT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const { item: updated } = await stockService.logMovement(item.id, {
        type, quantity: qty, reason: reason || undefined, notes: notes.trim() || undefined,
      });
      toast.success(type === 'in' ? `+${qty} ${item.unit} added to stock` : `${qty} ${item.unit} removed from stock`);
      onDone(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to log movement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Log Stock Movement</h3>
            <p className="text-sm text-gray-500">{item.name} · current: {item.quantity} {item.unit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {(['in', 'out'] as MovementType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setReason(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                  type === t
                    ? t === 'in' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'in'
                  ? <><ArrowDownCircle size={15} /> Stock In</>
                  : <><ArrowUpCircle size={15} /> Stock Out</>}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Quantity ({item.unit})
            </label>
            <input
              className={input} type="number" min="0.001" step="0.001"
              value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="0.00" required autoFocus
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</label>
            <select className={input} value={reason} onChange={e => setReason(e.target.value)}>
              <option value="">Select reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes (optional)</label>
            <textarea
              className={`${input} resize-none`} rows={2}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Supplier name, invoice ref, etc."
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className={btn('border border-gray-200 text-gray-600 hover:bg-gray-50')}>Cancel</button>
            <button
              type="submit" disabled={saving}
              className={btn(type === 'in'
                ? 'bg-green-500 text-white hover:bg-green-600 disabled:opacity-50'
                : 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50')}
            >
              {saving ? 'Saving…' : type === 'in' ? 'Add to Stock' : 'Remove from Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface HistoryDrawerProps {
  item: StockItem;
  onClose: () => void;
}
function HistoryDrawer({ item, onClose }: HistoryDrawerProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    stockService.getMovements(item.id)
      .then(setMovements)
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-none">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><History size={16} /> Movement History</h3>
            <p className="text-sm text-gray-500">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center pt-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-center text-gray-400 pt-12 text-sm">No movements yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {movements.map(m => (
                <li key={m.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${m.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {m.type === 'in'
                      ? <ArrowDownCircle size={14} className="text-green-600" />
                      : <ArrowUpCircle size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold ${m.type === 'in' ? 'text-green-700' : 'text-red-600'}`}>
                        {m.type === 'in' ? '+' : '-'}{m.quantity} {item.unit}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{fmtDate(m.createdAt)}</span>
                    </div>
                    {m.reason && <p className="text-xs text-gray-600 mt-0.5">{m.reason}</p>}
                    {m.notes   && <p className="text-xs text-gray-400 italic mt-0.5">"{m.notes}"</p>}
                    {m.createdByName && (
                      <p className="text-xs text-gray-400 mt-0.5">by {m.createdByName}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function StockPage() {
  const { fmt } = useCurrency();
  const [items,   setItems]   = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | 'low'>('all');

  // Modals / drawers
  const [showAdd,       setShowAdd]       = useState(false);
  const [editItem,      setEditItem]      = useState<StockItem | null>(null);
  const [movementItem,  setMovementItem]  = useState<{ item: StockItem; type: 'in' | 'out' } | null>(null);
  const [historyItem,   setHistoryItem]   = useState<StockItem | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  async function load() {
    try {
      const data = await stockService.list();
      setItems(data);
    } catch {
      toast.error('Failed to load stock');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: Parameters<typeof stockService.create>[0]) {
    setSaving(true);
    try {
      const created = await stockService.create(data);
      setItems(prev => [created, ...prev]);
      setShowAdd(false);
      toast.success(`${created.name} added to stock`);
    } catch {
      toast.error('Failed to add item');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: Parameters<typeof stockService.update>[1]) {
    if (!editItem) return;
    setSaving(true);
    try {
      const updated = await stockService.update(editItem.id, data);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditItem(null);
      toast.success('Item updated');
    } catch {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: StockItem) {
    if (!confirm(`Delete "${item.name}"? This will also delete all movement history.`)) return;
    setDeletingId(item.id);
    try {
      await stockService.remove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`${item.name} deleted`);
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  }

  function handleMovementDone(updated: StockItem) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setMovementItem(null);
  }

  const lowStockCount = items.filter(i => i.minThreshold > 0 && i.quantity <= i.minThreshold).length;

  const displayed = items
    .filter(i => filter === 'low' ? (i.minThreshold > 0 && i.quantity <= i.minThreshold) : true)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase()));

  // Group by category
  const grouped: Record<string, StockItem[]> = {};
  for (const item of displayed) {
    const cat = item.category || 'Uncategorised';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const categories = Object.keys(grouped).sort();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package size={20} className="text-orange-500" /> Stock Management
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Track ingredients and supplies</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors active:scale-95"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        <div className="px-4 md:px-6 py-5 space-y-5">

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 font-medium">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{items.length}</p>
            </div>
            <div className={`bg-white rounded-2xl border px-4 py-3 ${lowStockCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
              <p className={`text-xs font-medium ${lowStockCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>Low Stock</p>
              <p className={`text-2xl font-bold mt-0.5 ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-400 font-medium">Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                {fmt(items.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0))}
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                placeholder="Search items or category…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden text-sm">
              {(['all', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 font-medium transition-colors ${filter === f ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {f === 'all' ? 'All' : `⚠ Low Stock${lowStockCount > 0 ? ` (${lowStockCount})` : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Items list */}
          {loading ? (
            <div className="flex justify-center pt-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-medium">{items.length === 0 ? 'No stock items yet' : 'No items match your search'}</p>
              {items.length === 0 && (
                <button onClick={() => setShowAdd(true)} className="mt-4 text-sm text-orange-500 font-semibold hover:underline">
                  Add your first item →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map(cat => (
                <div key={cat}>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{cat}</h2>
                  <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                    {grouped[cat].map(item => {
                      const isLow = item.minThreshold > 0 && item.quantity <= item.minThreshold;
                      const stockValue = item.quantity * item.costPerUnit;
                      return (
                        <div key={item.id} className={`flex items-center gap-4 px-4 py-3.5 ${isLow ? 'bg-red-50/50' : ''}`}>

                          {/* Icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLow ? 'bg-red-100' : 'bg-orange-50'}`}>
                            {isLow
                              ? <AlertTriangle size={16} className="text-red-500" />
                              : <Package size={16} className="text-orange-400" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
                              {isLow && <Badge label="Low stock" color="bg-red-100 text-red-600" />}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                                {item.quantity} {item.unit}
                              </span>
                              {item.minThreshold > 0 && (
                                <span className="text-xs text-gray-400">min: {item.minThreshold} {item.unit}</span>
                              )}
                              {item.costPerUnit > 0 && (
                                <span className="text-xs text-gray-400">value: {fmt(stockValue)}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setMovementItem({ item, type: 'in' })}
                              title="Add stock"
                              className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                              <ArrowDownCircle size={16} />
                            </button>
                            <button
                              onClick={() => setMovementItem({ item, type: 'out' })}
                              title="Remove stock"
                              className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            >
                              <ArrowUpCircle size={16} />
                            </button>
                            <button
                              onClick={() => setHistoryItem(item)}
                              title="View history"
                              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                            >
                              <History size={16} />
                            </button>
                            <button
                              onClick={() => setEditItem(item)}
                              title="Edit"
                              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              title="Delete"
                              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Add item modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Add Stock Item</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <ItemForm onSave={handleCreate} onCancel={() => setShowAdd(false)} saving={saving} />
            </div>
          </div>
        </div>
      )}

      {/* ── Edit item modal ────────────────────────────────────────────────── */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Edit Stock Item</h3>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <ItemForm initial={editItem} onSave={handleUpdate} onCancel={() => setEditItem(null)} saving={saving} isEdit />
            </div>
          </div>
        </div>
      )}

      {/* ── Movement modal ─────────────────────────────────────────────────── */}
      {movementItem && (
        <MovementModal
          item={movementItem.item}
          defaultType={movementItem.type}
          onClose={() => setMovementItem(null)}
          onDone={handleMovementDone}
        />
      )}

      {/* ── History drawer ─────────────────────────────────────────────────── */}
      {historyItem && (
        <HistoryDrawer item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  );
}
