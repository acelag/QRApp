import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, ImagePlus, Loader2, Check } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import { menuService } from '../../services/menuService';
import { uploadImage } from '../../services/uploadService';
import toast from 'react-hot-toast';

const EMPTY: Omit<MenuItem, 'id'> = {
  name: '',
  description: '',
  price: 0,
  discountPct: 0,
  category: '',
  image: '',
  available: true,
};

export function MenuItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    Promise.all([menuService.getItems(), menuService.getCategories()]).then(([i, c]) => {
      setItems(i);
      setCategories(c);
    });

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, category: categories[0]?.id ?? '' });
    setPreview('');
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({ name: item.name, description: item.description, price: item.price, discountPct: item.discountPct, category: item.category, image: item.image ?? '', available: item.available });
    setPreview(item.image ?? '');
    setShowForm(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image: url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
      setPreview(form.image ?? '');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name || !form.category) return toast.error('Name and category are required');
    if (uploading) return toast.error('Please wait for the image to finish uploading');
    try {
      if (editing) {
        const updated = await menuService.updateItem(editing.id, form);
        setItems((p) => p.map((i) => (i.id === editing.id ? updated : i)));
        toast.success('Item updated');
      } else {
        const created = await menuService.createItem(form);
        setItems((p) => [...p, created]);
        toast.success('Item created');
      }
      setShowForm(false);
    } catch {
      toast.error('Failed to save item');
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await menuService.deleteItem(id);
      setItems((p) => p.filter((i) => i.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    try {
      const cat = await menuService.createCategory(newCatName.trim());
      setCategories((p) => [...p, cat]);
      setNewCatName('');
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    }
  }

  function startEditCat(cat: Category) {
    setEditingCat(cat);
    setEditingCatName(cat.name);
  }

  async function saveEditCat() {
    if (!editingCat || !editingCatName.trim()) return;
    try {
      const updated = await menuService.updateCategory(editingCat.id, editingCatName.trim());
      setCategories((p) => p.map((c) => (c.id === editingCat.id ? updated : c)));
      setEditingCat(null);
      toast.success('Category renamed');
    } catch {
      toast.error('Failed to rename category');
    }
  }

  async function deleteCategory(cat: Category) {
    const inUse = items.some((i) => i.category === cat.id);
    if (inUse) {
      toast.error(`"${cat.name}" is used by menu items — remove those items first`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await menuService.deleteCategory(cat.id);
      setCategories((p) => p.filter((c) => c.id !== cat.id));
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Menu Items</h1>
          <button onClick={openNew} className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus size={14} /> Add Item
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Categories */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">Categories</h2>
          <div className="flex gap-2 flex-wrap mb-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                {editingCat?.id === cat.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditCat(); if (e.key === 'Escape') setEditingCat(null); }}
                      className="text-sm text-orange-700 bg-transparent outline-none w-24"
                    />
                    <button onClick={saveEditCat} className="text-green-500 hover:text-green-600 shrink-0">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-orange-700 text-sm px-1">{cat.name}</span>
                    <button
                      onClick={() => startEditCat(cat)}
                      className="text-orange-400 hover:text-orange-600 transition-colors shrink-0"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="text-orange-300 hover:text-red-500 transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="New category name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
            />
            <button onClick={addCategory} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600 transition-colors">
              Add
            </button>
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center text-xl overflow-hidden shrink-0">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : '🍽️'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-gray-500">
                    {categories.find((c) => c.id === item.category)?.name ?? item.category}
                  </p>
                  {item.discountPct > 0 ? (
                    <>
                      <span className="text-sm text-gray-400 line-through">${item.price.toFixed(2)}</span>
                      <span className="text-sm text-green-600 font-semibold">
                        ${(item.price * (1 - item.discountPct / 100)).toFixed(2)}
                      </span>
                      <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                        {item.discountPct}% OFF
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">${item.price.toFixed(2)}</span>
                  )}
                </div>
                {!item.available && <span className="text-xs text-red-400">Unavailable</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-blue-500 transition-colors"><Pencil size={16} /></button>
                <button onClick={() => del(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Item' : 'New Item'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Image picker */}
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Photo</label>
              <div className="flex items-center gap-4">
                {/* Preview box */}
                <div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-200">
                  {uploading ? (
                    <Loader2 size={28} className="text-orange-400 animate-spin" />
                  ) : preview ? (
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🍽️</span>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

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
                      onClick={() => { setPreview(''); setForm((f) => ({ ...f, image: '' })); }}
                      className="text-xs text-red-400 hover:text-red-500 text-left"
                    >
                      Remove photo
                    </button>
                  )}
                  <p className="text-xs text-gray-400">JPG, PNG, WebP · max 5 MB</p>
                </div>
              </div>
            </div>

            {/* Text fields */}
            {[
              { label: 'Name *', key: 'name', type: 'text' },
              { label: 'Description', key: 'description', type: 'text' },
              { label: 'Price *', key: 'price', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-sm text-gray-600 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={String((form as Record<string, unknown>)[key] ?? '')}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                />
              </div>
            ))}

            {/* Discount */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">
                Discount % <span className="text-gray-400 font-normal">(0 = no discount)</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.discountPct}
                    onChange={(e) => setForm((f) => ({ ...f, discountPct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                {form.discountPct > 0 && form.price > 0 && (
                  <div className="text-sm shrink-0">
                    <span className="text-gray-400 line-through">${form.price.toFixed(2)}</span>
                    <span className="ml-1.5 text-green-600 font-semibold">
                      ${(form.price * (1 - form.discountPct / 100)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Available toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
                className="accent-orange-500"
              />
              Available to customers
            </label>

            <button
              onClick={save}
              disabled={uploading}
              className="w-full bg-orange-500 text-white py-3 rounded-2xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
