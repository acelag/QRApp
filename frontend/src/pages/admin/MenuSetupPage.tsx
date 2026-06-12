import { useEffect, useState } from 'react';
import { Pencil, Trash2, X, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import { menuService } from '../../services/menuService';
import { tagService, tagPillCls } from '../../services/tagService';
import type { Tag, TagCategory } from '../../services/tagService';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import toast from 'react-hot-toast';

export function MenuSetupPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [bulkToggling, setBulkToggling] = useState<Set<string>>(new Set());

  // Tag management
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('ðŸ·ï¸');
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('label');
  const [editingTag, setEditingTag] = useState<{ id: string; label: string; emoji: string; category: TagCategory } | null>(null);
  const [savingTag, setSavingTag] = useState(false);

  useEffect(() => {
    Promise.all([menuService.getItems(), menuService.getCategories()]).then(([i, c]) => {
      setItems(i);
      setCategories(c);
    });
    tagService.getTagsAdmin().then(setTags).catch(() => {});
  }, []);

  // â”€â”€ Category handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleBulkToggle(cat: Category, available: boolean) {
    if (bulkToggling.has(cat.id)) return;
    const count = items.filter((i) => i.category === cat.id).length;
    if (count === 0) return;
    setBulkToggling((s) => new Set(s).add(cat.id));
    setItems((prev) => prev.map((i) => i.category === cat.id ? { ...i, available } : i));
    try {
      await menuService.bulkSetAvailability(cat.id, available);
      toast.success(`${count} item${count !== 1 ? 's' : ''} in "${cat.name}" marked ${available ? 'available' : 'unavailable'}`);
    } catch {
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
      toast.error(`"${cat.name}" is used by menu items â€” remove those items first`);
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

  // â”€â”€ Tag handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function addTag() {
    if (!newTagLabel.trim()) return;
    setSavingTag(true);
    try {
      const t = await tagService.createTag(newTagLabel.trim(), newTagEmoji.trim() || 'ðŸ·ï¸', newTagCategory);
      setTags((prev) => [...prev, t]);
      setNewTagLabel('');
      setNewTagEmoji('ðŸ·ï¸');
      setNewTagCategory('label');
      toast.success('Tag added');
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setSavingTag(false);
    }
  }

  async function saveEditTag() {
    if (!editingTag || !editingTag.label.trim()) return;
    setSavingTag(true);
    try {
      const t = await tagService.updateTag(editingTag.id, editingTag.label.trim(), editingTag.emoji.trim() || 'ðŸ·ï¸', editingTag.category);
      setTags((prev) => prev.map((tg) => tg.id === t.id ? t : tg));
      setEditingTag(null);
      toast.success('Tag updated');
    } catch {
      toast.error('Failed to update tag');
    } finally {
      setSavingTag(false);
    }
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`Delete tag "${tag.label}"? It will be removed from all menu items.`)) return;
    try {
      await tagService.deleteTag(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      setItems((prev) => prev.map((i) => ({ ...i, tags: (i.tags ?? []).filter((s) => s !== tag.slug) })));
      toast.success(`"${tag.label}" deleted`);
    } catch {
      toast.error('Failed to delete tag');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
        <AdminHeader title="Categories & Tags" backTo="/admin/menu" />

        <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-5xl">
          {/* â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-1 text-sm">Categories</h2>
            <p className="text-xs text-gray-400 mb-3">Group your menu items. Use the eye icons to bulk-toggle availability for a whole category.</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {categories.map((cat) => {
                const catItems = items.filter((i) => i.category === cat.id);
                const allOn    = catItems.length > 0 && catItems.every((i) => i.available);
                const allOff   = catItems.length > 0 && catItems.every((i) => !i.available);
                const isBusy   = bulkToggling.has(cat.id);
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
                        <button onClick={saveEditCat} className="text-green-500 hover:text-green-600 shrink-0"><Check size={13} /></button>
                        <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-orange-700 text-sm px-1">{cat.name}</span>
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
                        <button onClick={() => startEditCat(cat)} className="text-orange-400 hover:text-orange-600 transition-colors shrink-0" title="Rename"><Pencil size={12} /></button>
                        <button onClick={() => deleteCategory(cat)} className="text-orange-300 hover:text-red-500 transition-colors shrink-0" title="Delete"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                );
              })}
              {categories.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                placeholder="New category name"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <button onClick={addCategory} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600 transition-colors">Add</button>
            </div>
          </div>

          {/* â”€â”€ Tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-1 text-sm">Tags</h2>
            <p className="text-xs text-gray-400 mb-3">Labels, dietary markers and allergens you can attach to menu items.</p>
            {(['label', 'dietary', 'allergen'] as TagCategory[]).map((cat) => {
              const catTags = tags.filter((t) => t.category === cat);
              if (catTags.length === 0) return null;
              const catLabel = cat === 'dietary' ? 'Dietary' : cat === 'allergen' ? 'Allergens' : 'Labels';
              return (
                <div key={cat} className="mb-3">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${cat === 'dietary' ? 'text-green-600' : cat === 'allergen' ? 'text-amber-600' : 'text-gray-400'}`}>
                    {catLabel}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {catTags.map((tag) => (
                      <div key={tag.id} className={`flex items-center gap-1 border rounded-full px-2 py-0.5 ${tagPillCls(tag.category)} border-current/20`}>
                        {editingTag?.id === tag.id ? (
                          <>
                            <input
                              value={editingTag.emoji}
                              onChange={(e) => setEditingTag({ ...editingTag, emoji: e.target.value })}
                              className="w-8 text-center text-sm bg-transparent outline-none"
                              maxLength={4}
                              title="Emoji"
                            />
                            <input
                              autoFocus
                              value={editingTag.label}
                              onChange={(e) => setEditingTag({ ...editingTag, label: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditTag(); if (e.key === 'Escape') setEditingTag(null); }}
                              className="text-sm bg-transparent outline-none w-24"
                            />
                            <select
                              value={editingTag.category}
                              onChange={(e) => setEditingTag({ ...editingTag, category: e.target.value as TagCategory })}
                              className="text-xs bg-transparent outline-none border border-current/20 rounded px-1"
                            >
                              <option value="label">Label</option>
                              <option value="dietary">Dietary</option>
                              <option value="allergen">Allergen</option>
                            </select>
                            <button onClick={saveEditTag} disabled={savingTag} className="text-green-500 hover:text-green-600 shrink-0"><Check size={13} /></button>
                            <button onClick={() => setEditingTag(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm px-1">{tag.emoji} {tag.label}</span>
                            <button
                              onClick={() => setEditingTag({ id: tag.id, label: tag.label, emoji: tag.emoji, category: tag.category })}
                              className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteTag(tag)}
                              className="opacity-40 hover:text-red-500 hover:opacity-100 transition-opacity shrink-0"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
              <input
                value={newTagEmoji}
                onChange={(e) => setNewTagEmoji(e.target.value)}
                placeholder="ðŸ·ï¸"
                maxLength={4}
                className="w-12 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                title="Emoji"
              />
              <input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="New tag name"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300"
              />
              <select
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value as TagCategory)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-orange-300 text-gray-600 bg-white"
              >
                <option value="label">Label</option>
                <option value="dietary">Dietary</option>
                <option value="allergen">Allergen</option>
              </select>
              <button
                onClick={addTag}
                disabled={savingTag || !newTagLabel.trim()}
                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
