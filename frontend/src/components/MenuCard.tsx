import { useState } from 'react';
import { Plus, Flame, Heart } from 'lucide-react';
import type { MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { ProductDetailModal } from './ProductDetailModal';

const LOW_STOCK_THRESHOLD = 5;

// Photo-less items get a deterministic colored tile + initial so the menu
// looks intentional rather than a wall of identical placeholders. The same
// category always maps to the same colour, giving subtle visual grouping.
const PLACEHOLDER_PALETTE = [
  { bg: 'from-rose-100 to-rose-50',       text: 'text-rose-400'    },
  { bg: 'from-amber-100 to-amber-50',     text: 'text-amber-500'   },
  { bg: 'from-emerald-100 to-emerald-50', text: 'text-emerald-500' },
  { bg: 'from-sky-100 to-sky-50',         text: 'text-sky-400'     },
  { bg: 'from-violet-100 to-violet-50',   text: 'text-violet-400'  },
  { bg: 'from-teal-100 to-teal-50',       text: 'text-teal-500'    },
  { bg: 'from-fuchsia-100 to-fuchsia-50', text: 'text-fuchsia-400' },
  { bg: 'from-lime-100 to-lime-50',       text: 'text-lime-600'    },
];

function placeholderStyle(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_PALETTE[h % PLACEHOLDER_PALETTE.length];
}

interface Props {
  item: MenuItem;
  view?: 'grid' | 'list';
  categoryName?: string;
  isFavourite?: boolean;
  onToggleFavourite?: (id: string) => void;
}

export function MenuCard({ item, view = 'grid', categoryName, isFavourite = false, onToggleFavourite }: Props) {
  const { addItem, items } = useCart();
  const { fmt } = useCurrency();
  const hasLarge      = item.largePrice != null && item.largePrice > 0;
  const hasToppings   = (item.toppings ?? []).some((t) => t.available);
  const hasModifiers  = (item.modifierGroups ?? []).some((g) => g.options.some((o) => o.available));
  const isLowStock    = item.trackStock && item.available && item.stock != null && item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD;
  const [showDetail, setShowDetail] = useState(false);

  const regPrice = effectivePrice(item, 'regular');
  const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
  const regBase  = item.price;
  const regDisc  = item.discountPct > 0;
  const lrgDisc  = (item.largeDiscountPct ?? 0) > 0;

  const inCart = items.filter((i) => i.menuItemId === item.id).reduce((s, i) => s + i.quantity, 0);

  const initial = (item.name.trim()[0] ?? '?').toUpperCase();
  const ph = placeholderStyle(item.category ?? item.name);

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.available) return;
    if (hasToppings || hasLarge || hasModifiers) { setShowDetail(true); }
    else { addItem(item, undefined); }
  }

  /* ── LIST VIEW ─────────────────────────────────────────────────────── */
  if (view === 'list') {
    return (
      <>
        <div
          onClick={() => setShowDetail(true)}
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all ${
            !item.available ? 'opacity-60' : ''
          }`}
        >
          <div className="relative shrink-0">
            {item.image ? (
              <img src={item.image} alt={item.name} loading="lazy" className="w-16 h-16 object-cover rounded-2xl" />
            ) : (
              <div className={`w-16 h-16 bg-gradient-to-br ${ph.bg} rounded-2xl flex items-center justify-center`}>
                <span className={`text-xl font-black ${ph.text} select-none`}>{initial}</span>
              </div>
            )}
            {(regDisc || lrgDisc) && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                {regDisc ? item.discountPct : item.largeDiscountPct}%
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</span>
              {isLowStock && (
                <span className={`shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.stock! <= 2 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Flame size={9} /> {item.stock} left
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              {regDisc && <span className="text-[11px] text-gray-400 line-through">{fmt(regBase)}</span>}
              <span className={`text-sm font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>{fmt(regPrice)}</span>
              {hasLarge && <span className="text-[11px] text-gray-400">/ L {fmt(lrgPrice)}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFavourite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavourite(item.id); }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-red-50"
              >
                <Heart size={15} className={isFavourite ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
              </button>
            )}
            <button
              onClick={handleQuickAdd}
              disabled={!item.available}
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold transition-colors ${
                !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : inCart > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {inCart > 0
                ? <span className="text-xs font-bold">{inCart}</span>
                : <Plus size={16} />}
            </button>
          </div>
        </div>

        {showDetail && <ProductDetailModal item={item} onClose={() => setShowDetail(false)} />}
      </>
    );
  }

  /* ── GRID VIEW ──────────────────────────────────────────────────────── */
  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className={`bg-white rounded-3xl shadow-md overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-all duration-200 ${
          !item.available ? 'opacity-60' : ''
        } ${inCart > 0 ? 'ring-2 ring-orange-400' : ''}`}
      >
        {/* Image */}
        <div className="relative flex-none">
          {item.image ? (
            <img src={item.image} alt={item.name} loading="lazy" className="w-full h-48 object-cover" />
          ) : (
            <div className={`w-full h-48 bg-gradient-to-br ${ph.bg} flex items-center justify-center`}>
              <span className={`text-6xl font-black ${ph.text} select-none`}>{initial}</span>
            </div>
          )}

          {/* Discount badge — top left */}
          {(regDisc || lrgDisc) && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              {regDisc ? item.discountPct : item.largeDiscountPct}% OFF
            </span>
          )}

          {/* Low stock — top left (below discount) */}
          {isLowStock && (
            <span className={`absolute top-3 ${regDisc || lrgDisc ? 'top-10 mt-1' : 'top-3'} left-3 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${
              item.stock! <= 2 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
            }`}>
              <Flame size={10} /> {item.stock} left
            </span>
          )}

          {/* Category pill — bottom right of image */}
          {categoryName && (
            <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
              {categoryName}
            </span>
          )}

          {/* Favourite + Extras — top right */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {onToggleFavourite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavourite(item.id); }}
                className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow transition-colors hover:bg-white"
              >
                <Heart size={13} className={isFavourite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
              </button>
            )}
            {(hasToppings || hasLarge || hasModifiers) && (
              <span className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {hasModifiers ? 'Customise' : hasToppings ? '+ Extras' : 'R / L'}
              </span>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="p-3.5 flex flex-col flex-1">
          {/* Name */}
          <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>

          {/* Nutrition pills */}
          {(item.calories || item.proteinG != null || item.spiceLevel != null) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.calories ? (
                <span className="flex items-center gap-0.5 text-[11px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
                  🔥 {item.calories} kcal
                </span>
              ) : null}
              {item.proteinG != null ? (
                <span className="flex items-center gap-0.5 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                  💪 {item.proteinG}g
                </span>
              ) : null}
              {item.spiceLevel != null ? (
                <span className="flex items-center gap-0.5 text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
                  🌶 {item.spiceLevel}/5
                </span>
              ) : null}
            </div>
          )}

          {/* Price + Add button */}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <div>
              {regDisc && (
                <span className="block text-xs text-gray-400 line-through leading-none">{fmt(regBase)}</span>
              )}
              <span className={`text-xl font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>
                {fmt(regPrice)}
              </span>
              {hasLarge && (
                <span className="text-xs text-gray-400 ml-1">/ L {fmt(lrgPrice)}</span>
              )}
            </div>

            <button
              onClick={handleQuickAdd}
              disabled={!item.available}
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 ${
                !item.available ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : inCart > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 shadow-orange-100'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200'
              }`}
            >
              {inCart > 0
                ? <span className="text-sm font-bold">{inCart}</span>
                : <Plus size={20} />}
            </button>
          </div>

          {!item.available && (
            <p className="text-xs text-red-400 mt-1">Unavailable</p>
          )}
        </div>
      </div>

      {showDetail && <ProductDetailModal item={item} onClose={() => setShowDetail(false)} />}
    </>
  );
}
