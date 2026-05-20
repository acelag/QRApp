import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, ImagePlus, Loader2, Check, ChevronDown, ChevronUp, Package, AlertTriangle, Download, Upload, GripVertical, Copy, Eye, EyeOff } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { Topping } from '../../types/MenuItem';
import { ITEM_TAGS } from '../../types/MenuItem';
import { menuService } from '../../services/menuService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMPTY: Omit<MenuItem, 'id'> = {
  name: '',
  description: '',
  price: 0,
  discountPct: 0,
  largePrice: undefined,
  largeDiscountPct: 0,
  category: '',
  image: '',
  available: true,
  trackStock: false,
  stock: null,
  tags: [],
};

export function MenuItemsPage() {
  const { fmt } = useCurrency();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [expandedToppings, setExpandedToppings] = useState<string | null>(null);
  const [newTopping, setNewTopping] = useState<Record<string, { name: string; price: string }>>({});
  const [editingTopping, setEditingTopping] = useState<{ itemId: string; toppingId: string; name: string; price: string } | null>(null);
  const [savingTopping, setSavingTopping] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [editingStock, setEditingStock] = useState<{ id: string; value: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [bulkToggling, setBulkToggling] = useState<Set<string>>(new Set());
  const fileRef      = useRef<HTMLInputElement>(null);
  const importRef    = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent, catId: string) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const catItems = prev.filter((i) => i.category === catId);
      const others   = prev.filter((i) => i.category !== catId);
      const oldIdx   = catItems.findIndex((i) => i.id === active.id);
      const newIdx   = catItems.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(catItems, oldIdx, newIdx).map((item, idx) => ({ ...item, sortOrder: idx }));
      menuService
        .reorderItems(reordered.map((i) => ({ id: i.id, sortOrder: i.sortOrder ?? 0 })))
        .catch(() => toast.error('Failed to save order'));
      return [...others, ...reordered];
    });
  }

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
    setForm({ name: item.name, description: item.description, price: item.price, discountPct: item.discountPct, largePrice: item.largePrice, largeDiscountPct: item.largeDiscountPct ?? 0, category: item.category, image: item.image ?? '', available: item.available, trackStock: item.trackStock ?? false, stock: item.stock ?? null, tags: item.tags ?? [] });
    setPreview(item.image ?? '');
    setShowForm(true);
  }

  async function saveStock(id: string, value: string) {
    const num = value === '' ? null : Math.max(0, parseInt(value, 10));
    try {
      const updated = await menuService.setStock(id, num);
      setItems((p) => p.map((i) => (i.id === id ? updated : i)));
      toast.success(num == null ? 'Stock tracking cleared' : `Stock set to ${num}`);
    } catch {
      toast.error('Failed to update stock');
    }
    setEditingStock(null);
  }

  async function handleExport() {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL ?? ''}/api/menu-items/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'menu.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post<{ created: number; updated: number; errors: { row: number; message: string }[] }>(
        `${import.meta.env.VITE_API_URL ?? ''}/api/menu-items/import`, fd,
      );
      const { created, updated, errors } = res.data;
      if (errors.length) {
        toast.error(`${created} created, ${updated} updated — ${errors.length} row error(s)`);
      } else {
        toast.success(`Import done: ${created} created, ${updated} updated`);
      }
      load();
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
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
      const payload = { ...form };
      if (editing) {
        const updated = await menuService.updateItem(editing.id, payload);
        setItems((p) => p.map((i) => (i.id === editing.id ? updated : i)));
        toast.success('Item updated');
      } else {
        const created = await menuService.createItem(payload);
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

  async function duplicate(id: string) {
    try {
      const copy = await menuService.duplicateItem(id);
      setItems((p) => [...p, copy]);
      toast.success(`"${copy.name}" created`);
    } catch {
      toast.error('Failed to duplicate item');
    }
  }

  async function handleBulkToggle(cat: Category, available: boolean) {
    if (bulkToggling.has(cat.id)) return;
    const count = items.filter((i) => i.category === cat.id).length;
    if (count === 0) return;
    setBulkToggling((s) => new Set(s).add(cat.id));
    // Optimistic update
    setItems((prev) => prev.map((i) => i.category === cat.id ? { ...i, available } : i));
    try {
      await menuService.bulkSetAvailability(cat.id, available);
      toast.success(`${count} item${count !== 1 ? 's' : ''} in "${cat.name}" marked ${available ? 'available' : 'unavailable'}`);
    } catch {
      // Revert
      setItems((prev) => prev.map((i) => i.category === cat.id ? { ...i, available: !available } : i));
      toast.error('Failed to update availability');
    } finally {
      setBulkToggling((s) => { const n = new Set(s); n.delete(cat.id); return n; });
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

  async function addTopping(itemId: string) {
    const data = newTopping[itemId];
    if (!data?.name?.trim()) return;
    setSavingTopping(true);
    try {
      const t = await menuService.createTopping(itemId, { name: data.name.trim(), price: parseFloat(data.price) || 0 });
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, toppings: [...(i.toppings ?? []), t] } : i));
      setNewTopping((prev) => ({ ...prev, [itemId]: { name: '', price: '' } }));
    } catch {
      toast.error('Failed to add topping');
    } finally {
      setSavingTopping(false);
    }
  }

  async function saveEditTopping() {
    if (!editingTopping) return;
    setSavingTopping(true);
    try {
      const t = await menuService.updateTopping(editingTopping.itemId, editingTopping.toppingId, {
        name: editingTopping.name.trim(),
        price: parseFloat(editingTopping.price) || 0,
      });
      setItems((prev) => prev.map((i) => i.id === editingTopping.itemId
        ? { ...i, toppings: (i.toppings ?? []).map((tp) => tp.id === t.id ? t : tp) }
        : i));
      setEditingTopping(null);
    } catch {
      toast.error('Failed to update topping');
    } finally {
      setSavingTopping(false);
    }
  }

  async function toggleToppingAvailable(itemId: string, topping: Topping) {
    try {
      const t = await menuService.updateTopping(itemId, topping.id, { available: !topping.available });
      setItems((prev) => prev.map((i) => i.id === itemId
        ? { ...i, toppings: (i.toppings ?? []).map((tp) => tp.id === t.id ? t : tp) }
        : i));
    } catch {
      toast.error('Failed to update topping');
    }
  }

  async function deleteTopping(itemId: string, toppingId: string) {
    if (!confirm('Delete this topping?')) return;
    try {
      await menuService.deleteTopping(itemId, toppingId);
      setItems((prev) => prev.map((i) => i.id === itemId
        ? { ...i, toppings: (i.toppings ?? []).filter((tp) => tp.id !== toppingId) }
        : i));
    } catch {
      toast.error('Failed to delete topping');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Menu Items</h1>
          <button
            onClick={() => setReorderMode((m) => !m)}
            title={reorderMode ? 'Done reordering' : 'Drag to reorder items'}
            className={`p-2 rounded-xl transition-colors ${reorderMode ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'}`}
          >
            <GripVertical size={17} />
          </button>
          <button onClick={handleExport} title="Export CSV" className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors">
            <Download size={17} />
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing} title="Import CSV"
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50">
            {importing ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={openNew} className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus size={14} /> Add Item
          </button>
        </div>
      </header>

      <main className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {/* Categories */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">Categories</h2>
          <div className="flex gap-2 flex-wrap mb-3">
            {categories.map((cat) => {
              const catItems  = items.filter((i) => i.category === cat.id);
              const allOn     = catItems.length > 0 && catItems.every((i) => i.available);
              const allOff    = catItems.length > 0 && catItems.every((i) => !i.available);
              const isBusy    = bulkToggling.has(cat.id);
              return (
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
                      {/* Bulk availability buttons */}
                      {catItems.length > 0 && (
                        <>
                          <button
                            onClick={() => handleBulkToggle(cat, true)}
                            disabled={isBusy || allOn}
                            title="Mark all available"
                            className="text-green-400 hover:text-green-600 transition-colors shrink-0 disabled:opacity-30"
                          >
                            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                          </button>
                          <button
                            onClick={() => handleBulkToggle(cat, false)}
                            disabled={isBusy || allOff}
                            title="Mark all unavailable"
                            className="text-gray-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-30"
                          >
                            <EyeOff size={12} />
                          </button>
                        </>
                      )}
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
              );
            })}
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

        {/* ── Reorder mode: categorised sortable list ─────────────────────── */}
        {reorderMode && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 text-center">Drag <GripVertical size={12} className="inline" /> to reorder items within each category. Changes save automatically.</p>
            {categories.map((cat) => {
              const catItems = items
                .filter((i) => i.category === cat.id)
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100">
                    <p className="text-sm font-semibold text-orange-700">{cat.name} <span className="font-normal text-orange-400">({catItems.length})</span></p>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, cat.id)}>
                    <SortableContext items={catItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="divide-y divide-gray-50">
                        {catItems.map((item) => (
                          <SortableItemRow key={item.id} item={item} fmt={fmt} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })}
            {/* Uncategorised */}
            {(() => {
              const uncatItems = items
                .filter((i) => !categories.find((c) => c.id === i.category))
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              if (uncatItems.length === 0) return null;
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-500">Uncategorised</p>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, uncatItems[0]?.category ?? '')}>
                    <SortableContext items={uncatItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="divide-y divide-gray-50">
                        {uncatItems.map((item) => (
                          <SortableItemRow key={item.id} item={item} fmt={fmt} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Normal grid view ────────────────────────────────────────────── */}
        {!reorderMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              {/* Tile top — image */}
              <div className="relative">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-32 object-cover" />
                  : <div className="w-full h-32 bg-orange-50 flex items-center justify-center text-4xl">🍽️</div>}
                {item.discountPct > 0 && (
                  <span className="absolute top-2 left-2 text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                    {item.discountPct}% OFF
                  </span>
                )}
                {!item.available && (
                  <span className="absolute top-2 right-2 text-xs bg-gray-700 text-white font-medium px-1.5 py-0.5 rounded-full">
                    Off
                  </span>
                )}
                {item.trackStock && item.stock != null && item.available && (
                  <span className={`absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                    item.stock === 0 ? 'bg-red-500 text-white' :
                    item.stock <= 3 ? 'bg-amber-400 text-white' :
                    'bg-green-500 text-white'
                  }`}>
                    <Package size={10} />
                    {item.stock}
                  </span>
                )}
              </div>

              {/* Tile body */}
              <div className="p-3 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">{item.name}</p>
                  <div className="flex items-center gap-0 shrink-0">
                    <button onClick={() => openEdit(item)} className="text-gray-300 hover:text-blue-500 transition-colors p-1" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => duplicate(item.id)} className="text-gray-300 hover:text-orange-500 transition-colors p-1" title="Duplicate"><Copy size={13} /></button>
                    <button onClick={() => del(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>

                <span className="text-xs text-gray-400 mb-1">
                  {categories.find((c) => c.id === item.category)?.name ?? item.category}
                </span>

                {/* Tags */}
                {(item.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {(item.tags!).map((tagId) => {
                      const tag = ITEM_TAGS.find((t) => t.id === tagId);
                      return tag ? (
                        <span key={tagId} className="inline-flex items-center gap-0.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {tag.emoji} {tag.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Price */}
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
                  {item.discountPct > 0 ? (
                    <>
                      <span className="text-gray-400 line-through">{fmt(item.price)}</span>
                      <span className="text-green-600 font-bold">{fmt(item.price * (1 - item.discountPct / 100))}</span>
                    </>
                  ) : (
                    <span className="text-orange-600 font-bold">{fmt(item.price)}</span>
                  )}
                  {item.largePrice != null && item.largePrice > 0 && (
                    <span className="text-gray-400">
                      · L {(item.largeDiscountPct ?? 0) > 0
                        ? <><span className="line-through">{fmt(item.largePrice)}</span>{' '}<span className="text-green-600">{fmt(item.largePrice * (1 - (item.largeDiscountPct ?? 0) / 100))}</span></>
                        : fmt(item.largePrice)}
                    </span>
                  )}
                </div>

                {/* Inline stock control */}
                {item.trackStock && (
                  <div className="mt-2 flex items-center gap-1">
                    {editingStock?.id === item.id ? (
                      <>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editingStock.value}
                          onChange={(e) => setEditingStock({ id: item.id, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveStock(item.id, editingStock.value); if (e.key === 'Escape') setEditingStock(null); }}
                          className="w-16 text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                        />
                        <button onClick={() => saveStock(item.id, editingStock.value)} className="text-green-500 hover:text-green-600"><Check size={13} /></button>
                        <button onClick={() => setEditingStock(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingStock({ id: item.id, value: String(item.stock ?? '') })}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                          item.stock == null ? 'text-gray-400 hover:bg-gray-100' :
                          item.stock <= 3 ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' :
                          'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {item.stock == null ? <><Package size={11} /> Set stock</> :
                         item.stock <= 3 ? <><AlertTriangle size={11} /> {item.stock} left</> :
                         <><Package size={11} /> {item.stock} in stock</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Extras toggle */}
                <button
                  onClick={() => setExpandedToppings(expandedToppings === item.id ? null : item.id)}
                  className="mt-1 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors self-start"
                >
                  Extras ({(item.toppings ?? []).length})
                  {expandedToppings === item.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              </div>

              {/* Toppings panel */}
              {expandedToppings === item.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extras / Toppings</p>

                  {(item.toppings ?? []).length === 0 && (
                    <p className="text-xs text-gray-400">No extras yet. Add one below.</p>
                  )}

                  {(item.toppings ?? []).map((topping) => (
                    <div key={topping.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                      {editingTopping?.toppingId === topping.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingTopping.name}
                            onChange={(e) => setEditingTopping({ ...editingTopping, name: e.target.value })}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                            placeholder="Name"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingTopping.price}
                            onChange={(e) => setEditingTopping({ ...editingTopping, price: e.target.value })}
                            className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                            placeholder="Price"
                          />
                          <button
                            onClick={saveEditTopping}
                            disabled={savingTopping}
                            className="text-green-500 hover:text-green-600"
                          ><Check size={15} /></button>
                          <button onClick={() => setEditingTopping(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm ${topping.available ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                            {topping.name}
                          </span>
                          <span className="text-sm text-orange-600 font-medium">
                            {topping.price > 0 ? fmt(topping.price) : 'Free'}
                          </span>
                          <button
                            onClick={() => toggleToppingAvailable(item.id, topping)}
                            title={topping.available ? 'Disable' : 'Enable'}
                            className={`text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                              topping.available
                                ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                          >
                            {topping.available ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => setEditingTopping({ itemId: item.id, toppingId: topping.id, name: topping.name, price: String(topping.price) })}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                          ><Pencil size={13} /></button>
                          <button
                            onClick={() => deleteTopping(item.id, topping.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          ><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add new topping */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={newTopping[item.id]?.name ?? ''}
                      onChange={(e) => setNewTopping((prev) => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))}
                      onKeyDown={(e) => e.key === 'Enter' && addTopping(item.id)}
                      placeholder="Topping name (e.g. Extra Cheese)"
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTopping[item.id]?.price ?? ''}
                      onChange={(e) => setNewTopping((prev) => ({ ...prev, [item.id]: { ...prev[item.id], price: e.target.value } }))}
                      onKeyDown={(e) => e.key === 'Enter' && addTopping(item.id)}
                      placeholder="Price"
                      className="w-20 text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                    />
                    <button
                      onClick={() => addTopping(item.id)}
                      disabled={savingTopping || !newTopping[item.id]?.name?.trim()}
                      className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
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
              { label: 'Regular Price *', key: 'price', type: 'number' },
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

            {/* Large price + discount */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">
                Large Price <span className="text-gray-400 font-normal">(leave empty if no large size)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.largePrice != null && form.largePrice > 0 ? form.largePrice : ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, largePrice: e.target.value ? parseFloat(e.target.value) || undefined : undefined }))
                }
                placeholder="e.g. 12.99"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>

            {form.largePrice != null && form.largePrice > 0 && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Large Discount % <span className="text-gray-400 font-normal">(0 = no discount)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.largeDiscountPct ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, largeDiscountPct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  {(form.largeDiscountPct ?? 0) > 0 && form.largePrice > 0 && (
                    <div className="text-sm shrink-0">
                      <span className="text-gray-400 line-through">{fmt(form.largePrice)}</span>
                      <span className="ml-1.5 text-green-600 font-semibold">
                        {fmt(form.largePrice * (1 - (form.largeDiscountPct ?? 0) / 100))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <span className="text-gray-400 line-through">{fmt(form.price)}</span>
                    <span className="ml-1.5 text-green-600 font-semibold">
                      {fmt(form.price * (1 - form.discountPct / 100))}
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

            {/* Stock tracking */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.trackStock ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked, stock: e.target.checked ? (f.stock ?? null) : null }))}
                  className="accent-orange-500"
                />
                <Package size={14} className="text-gray-400" />
                Track inventory / stock
              </label>
              {form.trackStock && (
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Stock quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value ? parseInt(e.target.value, 10) : null }))}
                    placeholder="e.g. 5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-marks unavailable when stock reaches 0. Leave blank to track without a limit.</p>
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {ITEM_TAGS.map((tag) => {
                  const active = (form.tags ?? []).includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          tags: active
                            ? (f.tags ?? []).filter((t) => t !== tag.id)
                            : [...(f.tags ?? []), tag.id],
                        }))
                      }
                      className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        active
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      {tag.emoji} {tag.label}
                    </button>
                  );
                })}
              </div>
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

// ── Sortable row for reorder mode ─────────────────────────────────────────────

function SortableItemRow({ item, fmt }: { item: MenuItem; fmt: (n: number) => string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors ${isDragging ? 'shadow-lg rounded-xl' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical size={18} />
      </button>

      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center text-lg">
        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : '🍽️'}
      </div>

      {/* Name */}
      <p className="flex-1 text-sm font-medium text-gray-800 truncate">{item.name}</p>

      {/* Price */}
      <p className="text-sm font-semibold text-orange-600 shrink-0">{fmt(item.price)}</p>

      {/* Available badge */}
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {item.available ? 'On' : 'Off'}
      </span>
    </div>
  );
}
