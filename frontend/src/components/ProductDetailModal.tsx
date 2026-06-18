import { useState } from 'react';
import { X, Plus, Minus, Flame, ShoppingCart, UtensilsCrossed, ZoomIn } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import type { MenuItem } from '../types/MenuItem';
import type { SelectedTopping, SelectedModifier } from '../types/Order';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTags } from '../context/TagsContext';
import { tagPillCls } from '../services/tagService';

interface Props {
  item: MenuItem;
  onClose: () => void;
  onAdd?: (toppings: SelectedTopping[], size: 'regular' | 'large' | undefined, notes: string, qty: number, modifiers?: SelectedModifier[]) => void;
}

export function ProductDetailModal({ item, onClose, onAdd: onAddOverride }: Props) {
  const { addItem } = useCart();
  const { fmt } = useCurrency();
  const { tags: allTags } = useTags();

  const hasLarge      = (item.largePrice ?? 0) > 0;
  const hasToppings   = (item.toppings ?? []).some((t) => t.available);
  const availableTops = (item.toppings ?? []).filter((t) => t.available);
  const activeGroups  = (item.modifierGroups ?? []).filter((g) => g.options.some((o) => o.available));
  const isLowStock    = item.trackStock && item.available && item.stock != null && item.stock > 0 && item.stock <= 5;
  const regDisc       = item.discountPct > 0;
  const lrgDisc       = (item.largeDiscountPct ?? 0) > 0;

  const [size, setSize]       = useState<'regular' | 'large'>(hasLarge ? 'regular' : 'regular');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // modifierSelections: groupId -> Set of optionIds
  const [modifierSelections, setModifierSelections] = useState<Record<string, Set<string>>>({});
  const [notes, setNotes]     = useState('');
  const [qty, setQty]         = useState(1);
  const [lightbox, setLightbox] = useState(false);

  const activeSize   = hasLarge ? size : undefined;
  const basePrice    = effectivePrice(item, activeSize);
  const selToppings  = availableTops.filter((t) => selected.has(t.id));
  const topsTotal    = selToppings.reduce((s, t) => s + t.price, 0);

  const selModifiers: SelectedModifier[] = activeGroups.flatMap((g) => {
    const sel = modifierSelections[g.id] ?? new Set<string>();
    return g.options.filter((o) => o.available && sel.has(o.id)).map((o) => ({
      groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, price: o.price,
    }));
  });
  const modTotal     = selModifiers.reduce((s, m) => s + m.price, 0);
  const itemTotal    = (basePrice + topsTotal + modTotal) * qty;

  const requiredUnmet = activeGroups.filter((g) => g.required && !(modifierSelections[g.id]?.size));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleModifier(groupId: string, optionId: string, isSingle: boolean) {
    setModifierSelections((prev) => {
      const cur = new Set(prev[groupId] ?? []);
      if (isSingle) {
        return { ...prev, [groupId]: new Set(cur.has(optionId) ? [] : [optionId]) };
      }
      const next = new Set(cur);
      next.has(optionId) ? next.delete(optionId) : next.add(optionId);
      return { ...prev, [groupId]: next };
    });
  }

  function handleAdd() {
    if (!item.available) return;
    if (requiredUnmet.length > 0) return;
    const toppings = selToppings.map((t) => ({ id: t.id, name: t.name, price: t.price }));
    if (onAddOverride) {
      onAddOverride(toppings, activeSize, notes.trim(), qty, selModifiers.length ? selModifiers : undefined);
    } else {
      for (let i = 0; i < qty; i++) {
        addItem(item, activeSize, i === 0 ? (notes.trim() || undefined) : undefined, toppings, selModifiers.length ? selModifiers : undefined);
      }
    }
    onClose();
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* ── Hero image ─────────────────────────────────────────────────── */}
        <div className="relative flex-none">
          {item.image ? (
            <div
              onClick={() => setLightbox(true)}
              className="cursor-zoom-in active:brightness-90 transition-[filter]"
            >
              <img src={item.image} alt={item.name} className="w-full h-56 sm:h-64 object-cover" />
              {/* Zoom hint badge */}
              <div className="absolute bottom-3 right-3 w-7 h-7 bg-black/30 rounded-full flex items-center justify-center pointer-events-none">
                <ZoomIn size={13} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="w-full h-56 sm:h-64 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
              <UtensilsCrossed size={56} className="text-orange-200" />
            </div>
          )}
          {/* Discount badge */}
          {(regDisc || lrgDisc) && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
              {regDisc ? item.discountPct : item.largeDiscountPct}% OFF
            </span>
          )}
          {/* Low stock */}
          {isLowStock && (
            <span className={`absolute bottom-3 left-3 flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shadow ${
              item.stock! <= 2 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
            }`}>
              <Flame size={11} /> Only {item.stock} left
            </span>
          )}
          {/* Close button — sibling of image div so its click never triggers the zoom */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Name + tags */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{item.name}</h2>
            {(item.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.tags!.map((slug) => {
                  const tag = allTags.find((t) => t.slug === slug);
                  return tag ? (
                    <span key={slug} className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${tagPillCls(tag.category)}`}>
                      {tag.emoji} {tag.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Nutrition pills */}
          {(item.calories || item.proteinG != null || item.spiceLevel != null) && (
            <div className="flex flex-wrap gap-2">
              {item.calories ? (
                <span className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-100 font-medium">
                  🔥 {item.calories} kcal
                </span>
              ) : null}
              {item.proteinG != null ? (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100 font-medium">
                  💪 {item.proteinG}g protein
                </span>
              ) : null}
              {item.spiceLevel != null ? (
                <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-100 font-medium">
                  🌶 Spice {item.spiceLevel}/5
                </span>
              ) : null}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
          )}

          {/* Price (no size picker yet) */}
          {!hasLarge && (
            <div className="flex items-baseline gap-2">
              {regDisc && (
                <span className="text-sm text-gray-400 line-through">{fmt(item.price)}</span>
              )}
              <span className={`text-2xl font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>
                {fmt(basePrice)}
              </span>
            </div>
          )}

          {/* ── Size picker ──────────────────────────────────────────────── */}
          {hasLarge && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Choose Size</p>
              <div className="flex gap-3">
                {(['regular', 'large'] as const).map((s) => {
                  const p    = effectivePrice(item, s);
                  const disc = s === 'large' ? lrgDisc : regDisc;
                  const orig = s === 'large' ? item.largePrice! : item.price;
                  return (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`flex-1 py-3 px-4 rounded-2xl border-2 text-left transition-colors ${
                        size === s ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-200'
                      }`}
                    >
                      <span className={`text-sm font-bold block ${size === s ? 'text-orange-600' : 'text-gray-700'}`}>
                        {s === 'regular' ? 'Regular' : 'Large'}
                      </span>
                      {disc && <span className="text-xs text-gray-400 line-through block">{fmt(orig)}</span>}
                      <span className={`text-sm font-semibold ${disc ? 'text-green-600' : 'text-gray-500'}`}>{fmt(p)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Toppings ─────────────────────────────────────────────────── */}
          {hasToppings && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Extras (optional)</p>
              <div className="space-y-2">
                {availableTops.map((top) => {
                  const isSel = selected.has(top.id);
                  return (
                    <button
                      key={top.id}
                      onClick={() => toggle(top.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors text-left ${
                        isSel ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSel ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                        }`}>
                          {isSel && (
                            <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{top.name}</span>
                      </div>
                      <span className={`text-sm font-semibold ${top.price > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {top.price > 0 ? `+${fmt(top.price)}` : 'Free'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Modifier Groups ──────────────────────────────────────────── */}
          {activeGroups.map((group) => {
            const isSingle = group.type === 'single';
            const sel = modifierSelections[group.id] ?? new Set<string>();
            const availOpts = group.options.filter((o) => o.available);
            return (
              <div key={group.id}>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {group.name}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${group.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                    {group.required ? 'Required' : isSingle ? 'Pick one' : 'Optional'}
                  </span>
                </div>
                <div className="space-y-2">
                  {availOpts.map((opt) => {
                    const isSel = sel.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleModifier(group.id, opt.id, isSingle)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors text-left ${
                          isSel ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 flex items-center justify-center transition-colors ${
                            isSingle
                              ? `rounded-full border-2 ${isSel ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`
                              : `rounded border-2 ${isSel ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`
                          }`}>
                            {isSel && (
                              <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">{opt.name}</span>
                        </div>
                        <span className={`text-sm font-semibold ${opt.price > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          {opt.price > 0 ? `+${fmt(opt.price)}` : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Special instructions ─────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Special Instructions</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. no onions, less spicy, extra sauce…"
              className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-300 resize-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* ── Sticky footer ──────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3 flex-none">
          {/* Qty selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-bold text-gray-900">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-11 h-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Required unmet warning */}
          {requiredUnmet.length > 0 && (
            <p className="text-xs text-red-500 text-center -mb-1">
              Please select: {requiredUnmet.map((g) => g.name).join(', ')}
            </p>
          )}

          {/* Total + add */}
          <button
            onClick={handleAdd}
            disabled={!item.available || requiredUnmet.length > 0}
            className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl font-semibold text-sm transition-colors ${
              item.available && requiredUnmet.length === 0
                ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={16} />
              {item.available ? 'Add to Cart' : 'Unavailable'}
            </span>
            <span className="font-bold text-base">{fmt(itemTotal)}</span>
          </button>
        </div>
      </div>
    </div>

    {lightbox && item.image && (
      <ImageLightbox src={item.image} alt={item.name} onClose={() => setLightbox(false)} />
    )}
    </>
  );
}
