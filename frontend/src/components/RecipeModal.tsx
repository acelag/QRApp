import { useEffect, useState } from 'react';
import { X, Plus, Trash2, FlaskConical, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { menuService } from '../services/menuService';
import { stockService } from '../services/stockService';
import type { StockItem } from '../services/stockService';
import type { MenuItem } from '../types';

interface DraftRow {
  stockItemId: string;
  quantity: string;
}

interface Props {
  menuItem: MenuItem;
  onClose: () => void;
}

export function RecipeModal({ menuItem, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [draft, setDraft] = useState<DraftRow[]>([]);

  useEffect(() => {
    Promise.all([
      menuService.getRecipe(menuItem.id),
      stockService.list(),
    ])
      .then(([recipe, stock]) => {
        setDraft(recipe.map((r) => ({ stockItemId: r.stockItemId, quantity: String(r.quantity) })));
        setStockItems(stock);
      })
      .catch(() => toast.error('Failed to load recipe'))
      .finally(() => setLoading(false));
  }, [menuItem.id]);

  function addRow() {
    setDraft((prev) => [...prev, { stockItemId: '', quantity: '' }]);
  }

  function removeRow(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function setField<K extends keyof DraftRow>(idx: number, key: K, value: DraftRow[K]) {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  async function handleSave() {
    const ingredients = draft
      .filter((r) => r.stockItemId && r.quantity && Number(r.quantity) > 0)
      .map((r) => ({ stockItemId: r.stockItemId, quantity: Number(r.quantity) }));
    setSaving(true);
    try {
      await menuService.saveRecipe(menuItem.id, ingredients);
      toast.success('Recipe saved');
      onClose();
    } catch {
      toast.error('Failed to save recipe');
    } finally {
      setSaving(false);
    }
  }

  const costPerServing = draft.reduce((sum, row) => {
    const stock = stockItems.find((s) => s.id === row.stockItemId);
    if (!stock || !row.quantity) return sum;
    return sum + stock.costPerUnit * Number(row.quantity);
  }, 0);

  const usedIds = new Set(draft.map((r) => r.stockItemId).filter(Boolean));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-orange-500" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Recipe</h2>
              <p className="text-xs text-gray-400">{menuItem.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-orange-400" />
            </div>
          ) : (
            <>
              {draft.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No ingredients mapped yet. Add stock items below to track deductions when this item is ordered.
                </p>
              )}

              {draft.map((row, idx) => {
                const selected = stockItems.find((s) => s.id === row.stockItemId);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.stockItemId}
                      onChange={(e) => setField(idx, 'stockItemId', e.target.value)}
                      className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                    >
                      <option value="">— Select ingredient —</option>
                      {stockItems
                        .filter((s) => s.id === row.stockItemId || !usedIds.has(s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.unit})
                          </option>
                        ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => setField(idx, 'quantity', e.target.value)}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                    />

                    {selected && (
                      <span className="text-xs text-gray-400 w-8 shrink-0">{selected.unit}</span>
                    )}

                    <button
                      onClick={() => removeRow(idx)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <Plus size={15} /> Add ingredient
              </button>

              {draft.length > 0 && (
                <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Estimated cost per serving</span>
                  <span className="font-semibold text-gray-800">
                    {costPerServing > 0 ? `${costPerServing.toFixed(2)}` : '—'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 text-sm font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
}
