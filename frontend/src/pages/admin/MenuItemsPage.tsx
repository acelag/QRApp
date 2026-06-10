import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, ImagePlus, Loader2, Check, ChevronDown, ChevronUp, Package, AlertTriangle, Download, Upload, GripVertical, Copy, Eye, EyeOff, Search, ExternalLink, LayoutGrid, List } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { Topping } from '../../types/MenuItem';
import { menuService } from '../../services/menuService';
import { tagService, tagPillCls } from '../../services/tagService';
import type { Tag, TagCategory } from '../../services/tagService';
import { menuScheduleService } from '../../services/menuScheduleService';
import type { MenuSchedule } from '../../services/menuScheduleService';
import { uploadImage } from '../../services/uploadService';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
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
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';

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
  prepTimeMins: null,
  scheduleId: null,
};

export function MenuItemsPage() {
  const { fmt } = useCurrency();
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [expandedToppings, setExpandedToppings] = useState<string | null>(null);
  const [newTopping, setNewTopping] = useState<Record<string, { name: string; price: string }>>({});
  const [editingTopping, setEditingTopping] = useState<{ itemId: string; toppingId: string; name: string; price: string } | null>(null);
  const [savingTopping, setSavingTopping] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [editingStock, setEditingStock] = useState<{ id: string; value: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  // Schedules
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  // Tags
  const [tags, setTags] = useState<Tag[]>([]);
  // Search / filter state
  const [searchQ,     setSearchQ]     = useState('');
  const [catFilter,   setCatFilter]   = useState<string>('all');
  const [availFilter, setAvailFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('menu-view') as 'grid' | 'list') || 'grid');

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

  const loadTags = () =>
    tagService.getTagsAdmin().then(setTags).catch(() => {});

  const loadSchedules = () =>
    menuScheduleService.getSchedules().then(setSchedules).catch(() => {});

  useEffect(() => { load(); loadTags(); loadSchedules(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, category: categories[0]?.id ?? '' });
    setPreview('');
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({ name: item.name, description: item.description, price: item.price, discountPct: item.discountPct, largePrice: item.largePrice, largeDiscountPct: item.largeDiscountPct ?? 0, category: item.category, image: item.image ?? '', available: item.available, trackStock: item.trackStock ?? false, stock: item.stock ?? null, tags: item.tags ?? [], prepTimeMins: item.prepTimeMins ?? null, scheduleId: item.scheduleId ?? null });
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

  async function toggleAvailable(item: MenuItem) {
    // Optimistic flip, revert on failure
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, available: !item.available } : i)));
    try {
      const updated = await menuService.updateItem(item.id, { available: !item.available });
      setItems((p) => p.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      setItems((p) => p.map((i) => (i.id === item.id ? item : i)));
      toast.error('Failed to update availability');
    }
  }

  function changeView(mode: 'grid' | 'list') {
    setViewMode(mode);
    localStorage.setItem('menu-view', mode);
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

  // Derived filtered list (used in grid view only; reorder mode shows all)
  const q = searchQ.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const catName = (categories.find((c) => c.id === item.category)?.name ?? '').toLowerCase();
    const matchQ    = !q || item.name.toLowerCase().includes(q) || catName.includes(q);
    const matchCat  = catFilter === 'all' || item.category === catFilter;
    const matchAvail = availFilter === 'all'
      || (availFilter === 'available'   &&  item.available)
      || (availFilter === 'unavailable' && !item.available);
    return matchQ && matchCat && matchAvail;
  });

  const isFiltered = !!q || catFilter !== 'all' || availFilter !== 'all';

  // Shared field styles for the edit/create modal
  const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block';
  const inputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
      <AdminHeader title="Menu Items" backTo="/admin">
        {user?.restaurantId && (
          <a
            href={`/takeaway/${user.restaurantId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Preview menu as customer"
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
          >
            <ExternalLink size={17} />
          </a>
        )}
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
      </AdminHeader>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">

        {/* ── Search & filter bar ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap gap-2 items-center">
          {/* Text search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by name or category…"
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-300"
            />
            {searchQ && (
              <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300 text-gray-600 bg-white"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Availability filter */}
          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value as typeof availFilter)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300 text-gray-600 bg-white"
          >
            <option value="all">All availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>

          {/* Active filter summary */}
          {isFiltered && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{filteredItems.length} of {items.length} items</span>
              <button
                onClick={() => { setSearchQ(''); setCatFilter('all'); setAvailFilter('all'); }}
                className="text-xs text-orange-500 hover:text-orange-600 font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* View toggle: grid / list */}
          <div className="ml-auto flex items-center bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => changeView('grid')}
              title="Grid view"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => changeView('list')}
              title="List view"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={16} />
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
        {!reorderMode && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Search size={32} className="text-gray-200" />
            <p className="text-sm">{isFiltered ? 'No items match your filters' : 'No menu items yet'}</p>
            {isFiltered && (
              <button onClick={() => { setSearchQ(''); setCatFilter('all'); setAvailFilter('all'); }} className="text-sm text-orange-500 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
        {!reorderMode && filteredItems.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {filteredItems.map((item) => (
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

                {/* Schedule badge */}
                {item.scheduleId && (() => {
                  const sch = schedules.find((s) => s.id === item.scheduleId);
                  return sch ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium mb-1">
                      ⏰ {sch.name}
                    </span>
                  ) : null;
                })()}
                {/* Tags */}
                {(item.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {(item.tags!).map((slug) => {
                      const tag = tags.find((t) => t.slug === slug);
                      return tag ? (
                        <span key={slug} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${tagPillCls(tag.category)}`}>
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

        {/* ── List / table view ───────────────────────────────────────────── */}
        {!reorderMode && filteredItems.length > 0 && viewMode === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-14">Item</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Stock</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => {
                  const catName = categories.find((c) => c.id === item.category)?.name ?? item.category;
                  return (
                  <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Image */}
                    <td className="px-4 py-2.5">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                        : <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-lg">🍽️</div>}
                    </td>
                    {/* Name + tags */}
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                        {item.name}
                        {item.discountPct > 0 && (
                          <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{item.discountPct}% OFF</span>
                        )}
                        {item.scheduleId && (() => {
                          const sch = schedules.find((s) => s.id === item.scheduleId);
                          return sch ? <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">⏰ {sch.name}</span> : null;
                        })()}
                      </div>
                      {(item.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.tags!.map((slug) => {
                            const tag = tags.find((t) => t.slug === slug);
                            return tag ? (
                              <span key={slug} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tagPillCls(tag.category)}`}>
                                {tag.emoji} {tag.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      <span className="md:hidden text-xs text-gray-400">{catName}</span>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-2.5 hidden md:table-cell text-gray-500">{catName}</td>
                    {/* Price */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {item.discountPct > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 line-through text-xs">{fmt(item.price)}</span>
                          <span className="text-green-600 font-bold">{fmt(item.price * (1 - item.discountPct / 100))}</span>
                        </span>
                      ) : (
                        <span className="text-orange-600 font-bold">{fmt(item.price)}</span>
                      )}
                      {item.largePrice != null && item.largePrice > 0 && (
                        <span className="block text-[11px] text-gray-400">L {fmt(item.largePrice)}</span>
                      )}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      {!item.trackStock ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : editingStock?.id === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus type="number" min="0" value={editingStock.value}
                            onChange={(e) => setEditingStock({ id: item.id, value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveStock(item.id, editingStock.value); if (e.key === 'Escape') setEditingStock(null); }}
                            className="w-16 text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                          />
                          <button onClick={() => saveStock(item.id, editingStock.value)} className="text-green-500 hover:text-green-600"><Check size={13} /></button>
                          <button onClick={() => setEditingStock(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingStock({ id: item.id, value: String(item.stock ?? '') })}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                            item.stock == null ? 'text-gray-400 hover:bg-gray-100' :
                            item.stock <= 3 ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' :
                            'text-green-600 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {item.stock == null ? <><Package size={11} /> Set</> :
                           item.stock <= 3 ? <><AlertTriangle size={11} /> {item.stock}</> :
                           <><Package size={11} /> {item.stock}</>}
                        </button>
                      )}
                    </td>
                    {/* Status toggle */}
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleAvailable(item)}
                        title={item.available ? 'Available — click to disable' : 'Unavailable — click to enable'}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                          item.available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {item.available ? <Eye size={12} /> : <EyeOff size={12} />}
                        {item.available ? 'On' : 'Off'}
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-blue-500 transition-colors p-1.5" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => duplicate(item.id)} className="text-gray-400 hover:text-orange-500 transition-colors p-1.5" title="Duplicate"><Copy size={14} /></button>
                        <button onClick={() => del(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Sticky header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Item' : 'New Item'}</h2>
                <p className="text-xs text-gray-400">{editing ? 'Update the details below' : 'Fill in the details to add a menu item'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Section: Photo + basic details */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                {/* Image picker — spans both columns */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-200">
                      {uploading ? (
                        <Loader2 size={28} className="text-orange-400 animate-spin" />
                      ) : preview ? (
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">🍽️</span>
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

                {/* Name — full width */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. BBQ Pork Ribs"
                    className={inputCls}
                  />
                </div>

                {/* Description — full width */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short description shown to customers"
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Category */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className={`${inputCls} bg-white`}
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </section>

              {/* Section: Pricing */}
              <section>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  {/* Regular price */}
                  <div>
                    <label className={labelCls}>Regular Price *</label>
                    <input
                      type="number"
                      value={form.price || ''}
                      onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                      className={inputCls}
                    />
                  </div>

                  {/* Large price */}
                  <div>
                    <label className={labelCls}>Large Price <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.largePrice != null && form.largePrice > 0 ? form.largePrice : ''}
                      onChange={(e) => setForm((f) => ({ ...f, largePrice: e.target.value ? parseFloat(e.target.value) || undefined : undefined }))}
                      placeholder="e.g. 12.99"
                      className={inputCls}
                    />
                  </div>

                  {/* Discount */}
                  <div>
                    <label className={labelCls}>Discount % <span className="text-gray-400 normal-case font-normal">(0 = none)</span></label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={form.discountPct}
                          onChange={(e) => setForm((f) => ({ ...f, discountPct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                          className={`${inputCls} pr-8`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                      {form.discountPct > 0 && form.price > 0 && (
                        <div className="text-sm shrink-0">
                          <span className="text-gray-400 line-through">{fmt(form.price)}</span>
                          <span className="ml-1.5 text-green-600 font-semibold">{fmt(form.price * (1 - form.discountPct / 100))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Large discount — only when large price set */}
                  {form.largePrice != null && form.largePrice > 0 && (
                    <div>
                      <label className={labelCls}>Large Discount % <span className="text-gray-400 normal-case font-normal">(0 = none)</span></label>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={form.largeDiscountPct ?? 0}
                            onChange={(e) => setForm((f) => ({ ...f, largeDiscountPct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                            className={`${inputCls} pr-8`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                        {(form.largeDiscountPct ?? 0) > 0 && form.largePrice > 0 && (
                          <div className="text-sm shrink-0">
                            <span className="text-gray-400 line-through">{fmt(form.largePrice)}</span>
                            <span className="ml-1.5 text-green-600 font-semibold">{fmt(form.largePrice * (1 - (form.largeDiscountPct ?? 0) / 100))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Section: Inventory & kitchen */}
              <section>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Inventory &amp; Kitchen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  {/* Stock tracking */}
                  <div className="md:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.trackStock ?? false}
                        onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked, stock: e.target.checked ? (f.stock ?? null) : null }))}
                        className="accent-orange-500 w-4 h-4"
                      />
                      <Package size={15} className="text-gray-400" />
                      Track inventory / stock
                    </label>
                    {form.trackStock && (
                      <div className="mt-3">
                        <label className={labelCls}>Stock quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.stock ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value ? parseInt(e.target.value, 10) : null }))}
                          placeholder="e.g. 5"
                          className={`${inputCls} bg-white max-w-xs`}
                        />
                        <p className="text-xs text-gray-400 mt-1">Auto-marks unavailable when stock reaches 0. Leave blank to track without a limit.</p>
                      </div>
                    )}
                  </div>

                  {/* Prep time */}
                  <div>
                    <label className={labelCls}>Prep time (minutes)</label>
                    <div className="relative w-full">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        step="1"
                        value={form.prepTimeMins ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, prepTimeMins: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null }))}
                        placeholder="e.g. 15"
                        className={`${inputCls} pr-10`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">min</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Shown to kitchen as a countdown timer.</p>
                  </div>
                </div>
              </section>

              {/* Section: Visibility */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800">Visibility</h3>
                  <Link to="/admin/menu-schedules" className="text-xs text-orange-500 hover:underline">Manage schedules →</Link>
                </div>
                <select
                  value={form.scheduleId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, scheduleId: e.target.value || null }))}
                  className={`${inputCls} bg-white`}
                >
                  <option value="">Always visible (no schedule)</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.startTime}–{s.endTime}</option>
                  ))}
                </select>
                {form.scheduleId && (
                  <p className="text-xs text-amber-600 mt-1.5">⏰ This item will only appear on the customer menu during the assigned time window.</p>
                )}
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
                    className="accent-orange-500 w-4 h-4"
                  />
                  Available to customers
                </label>
              </section>

              {/* Section: Tags */}
              {tags.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Tags</h3>
                  <div className="space-y-3">
                    {(['label', 'dietary', 'allergen'] as TagCategory[]).map((cat) => {
                      const catTags = tags.filter((t) => t.category === cat);
                      if (catTags.length === 0) return null;
                      const catLabel = cat === 'dietary' ? '🥦 Dietary' : cat === 'allergen' ? '⚠️ Allergens' : '🏷️ Labels';
                      return (
                        <div key={cat}>
                          <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${cat === 'dietary' ? 'text-green-600' : cat === 'allergen' ? 'text-amber-600' : 'text-gray-400'}`}>
                            {catLabel}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {catTags.map((tag) => {
                              const active = (form.tags ?? []).includes(tag.slug);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      tags: active
                                        ? (f.tags ?? []).filter((t) => t !== tag.slug)
                                        : [...(f.tags ?? []), tag.slug],
                                    }))
                                  }
                                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                                    active
                                      ? `${tagPillCls(cat, true)} border-transparent`
                                      : `bg-white border-gray-200 hover:border-gray-300 ${cat === 'dietary' ? 'text-green-700' : cat === 'allergen' ? 'text-amber-700' : 'text-gray-600'}`
                                  }`}
                                >
                                  {tag.emoji} {tag.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* ── Sticky footer ── */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-white">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={uploading}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {uploading && <Loader2 size={16} className="animate-spin" />}
                {editing ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
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
