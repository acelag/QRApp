import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Package, Minus, ImagePlus, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { comboService, type Combo, type ComboPayload } from '../../services/comboService';
import { menuService } from '../../services/menuService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import type { MenuItem } from '../../types';

interface ItemEntry { menuItemId: string; quantity: number }

const EMPTY_FORM = (): ComboPayload => ({
  name: '', description: '', price: 0, image: '', active: true, sortOrder: 0, items: [],
});

export function CombosPage() {
  const { user } = useAuth();
  const { fmt } = useCurrency();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [form, setForm] = useState<ComboPayload>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rid = user?.restaurantId ?? '';

  useEffect(() => {
    if (!rid) return;
    Promise.all([
      comboService.getCombos(rid),
      menuService.getItems(rid),
    ]).then(([c, m]) => {
      setCombos(c);
      setMenuItems(m.filter((i) => i.available));
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [rid]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM());
    setPreview('');
    setItemSearch('');
    setShowModal(true);
  }

  function openEdit(combo: Combo) {
    setEditing(combo);
    setForm({
      name: combo.name,
      description: combo.description ?? '',
      price: combo.price,
      image: combo.image ?? '',
      active: combo.active,
      sortOrder: combo.sortOrder,
      items: combo.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    });
    setPreview(combo.image ?? '');
    setItemSearch('');
    setShowModal(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((p) => ({ ...p, image: url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
      setPreview(form.image ?? '');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.price || form.price <= 0) { toast.error('Price must be positive'); return; }
    if (uploading) { toast.error('Please wait for the image to finish uploading'); return; }
    setSaving(true);
    try {
      const payload: ComboPayload = {
        ...form,
        description: form.description?.trim() || undefined,
        image: form.image?.trim() || undefined,
        items: form.items.filter((i) => i.quantity > 0),
      };
      const saved = editing
        ? await comboService.updateCombo(editing.id, payload)
        : await comboService.createCombo(payload);
      setCombos((prev) =>
        editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]
      );
      setShowModal(false);
      toast.success(editing ? 'Combo updated' : 'Combo created');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(combo: Combo) {
    try {
      const updated = await comboService.toggleActive(combo.id, !combo.active);
      setCombos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleDelete(id: string) {
    try {
      await comboService.deleteCombo(id);
      setCombos((prev) => prev.filter((c) => c.id !== id));
      setDeleteId(null);
      toast.success('Combo deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  // Item quantity helpers
  function getQty(menuItemId: string) {
    return form.items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0;
  }
  function setQty(menuItemId: string, qty: number) {
    setForm((prev) => {
      const filtered = prev.items.filter((i) => i.menuItemId !== menuItemId);
      if (qty <= 0) return { ...prev, items: filtered };
      return { ...prev, items: [...filtered, { menuItemId, quantity: qty }] };
    });
  }

  const filteredMenuItems = itemSearch.trim()
    ? menuItems.filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : menuItems;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Combo Deals</h1>
              <p className="text-xs text-gray-400">{combos.length} combo{combos.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            <Plus size={16} /> Add Combo
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {combos.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Package size={48} className="mx-auto text-gray-200" />
            <p className="text-gray-400 font-medium">No combos yet</p>
            <p className="text-sm text-gray-400">Create bundle deals to boost sales</p>
            <button onClick={openCreate} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
              Create First Combo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {combos.map((combo) => (
              <div key={combo.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${combo.active ? 'border-orange-100' : 'border-gray-100 opacity-60'}`}>
                {combo.image ? (
                  <img src={combo.image} alt={combo.name} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
                    <Package size={40} className="text-orange-300" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 leading-tight">{combo.name}</h3>
                    <span className="text-orange-600 font-bold text-lg shrink-0">{fmt(combo.price)}</span>
                  </div>
                  {combo.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{combo.description}</p>
                  )}
                  {combo.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {combo.items.map((item) => (
                        <span key={item.id} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                          {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.menuItemName}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button onClick={() => handleToggle(combo)} className={`flex items-center gap-1.5 text-xs font-medium ${combo.active ? 'text-green-600' : 'text-gray-400'}`}>
                      {combo.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      {combo.active ? 'Active' : 'Inactive'}
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(combo)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(combo.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Combo' : 'New Combo'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Family Feast, Happy Hour Bundle"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="What makes this deal special?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                />
              </div>
              {/* Price + Sort order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bundle Price *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price || ''}
                    onChange={(e) => setForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>
              {/* Photo upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-200">
                    {uploading ? (
                      <Loader2 size={28} className="text-orange-400 animate-spin" />
                    ) : preview ? (
                      <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={28} className="text-gray-300" />
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-orange-200 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-50 transition-colors disabled:opacity-50"
                    >
                      <ImagePlus size={16} />
                      {preview ? 'Change photo' : 'Browse photo'}
                    </button>
                    {preview && !uploading && (
                      <button
                        type="button"
                        onClick={() => { setPreview(''); setForm((p) => ({ ...p, image: '' })); }}
                        className="text-xs text-red-400 hover:text-red-500 text-left"
                      >
                        Remove photo
                      </button>
                    )}
                    <p className="text-xs text-gray-400">JPG, PNG, WebP · max 5 MB</p>
                  </div>
                </div>
              </div>
              {/* Active */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <button
                  onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${form.active ? 'text-green-600' : 'text-gray-400'}`}
                >
                  {form.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  {form.active ? 'Yes' : 'No'}
                </button>
              </div>

              {/* Items in combo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Included Items</label>
                {form.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {form.items.map((entry) => {
                      const mi = menuItems.find((m) => m.id === entry.menuItemId);
                      return (
                        <span key={entry.menuItemId} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-full">
                          {entry.quantity > 1 && <span className="font-bold">{entry.quantity}×</span>}
                          {mi?.name ?? entry.menuItemId}
                          <button onClick={() => setQty(entry.menuItemId, 0)} className="ml-0.5 text-orange-400 hover:text-red-500">✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search menu items…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {filteredMenuItems.length === 0 ? (
                    <p className="text-center text-gray-400 text-xs py-4">No items found</p>
                  ) : (
                    filteredMenuItems.map((item) => {
                      const qty = getQty(item.id);
                      return (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-400">{fmt(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {qty > 0 ? (
                              <>
                                <button onClick={() => setQty(item.id, qty - 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors">
                                  <Minus size={12} />
                                </button>
                                <span className="w-5 text-center text-sm font-semibold text-gray-800">{qty}</span>
                                <button onClick={() => setQty(item.id, qty + 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors">
                                  <Plus size={12} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setQty(item.id, 1)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full hover:bg-orange-600 transition-colors">
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : editing ? 'Update Combo' : 'Create Combo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Combo?</h3>
            <p className="text-sm text-gray-500">This cannot be undone. Existing orders are not affected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 font-medium hover:text-gray-800">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
