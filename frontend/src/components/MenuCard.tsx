import { useState } from 'react';
import { Plus, Flame, UtensilsCrossed } from 'lucide-react';
import type { MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTags } from '../context/TagsContext';
import { tagPillCls } from '../services/tagService';
import { ProductDetailModal } from './ProductDetailModal';

const LOW_STOCK_THRESHOLD = 5;

interface Props {
  item: MenuItem;
  view?: 'grid' | 'list';
  categoryName?: string;
}

export function MenuCard({ item, view = 'grid', categoryName }: Props) {
  const { addItem, items } = useCart();
  const { fmt } = useCurrency();
  const { tags: allTags } = useTags();
  const hasLarge    = item.largePrice != null && item.largePrice > 0;
  const hasToppings = (item.toppings ?? []).some((t) => t.available);
  const isLowStock  = item.trackStock && item.available && item.stock != null && item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD;
  const [showDetail, setShowDetail] = useState(false);

  const regPrice = effectivePrice(item, 'regular');
  const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
  const regBase  = item.price;
  const regDisc  = item.discountPct > 0;
  const lrgDisc  = (item.largeDiscountPct ?? 0) > 0;

  const inCart = items.filter((i) => i.menuItemId === item.id).reduce((s, i) => s + i.quantity, 0);

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.available) return;
    if (hasToppings || hasLarge) { setShowDetail(true); }
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
              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-2xl" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl flex items-center justify-center">
                <UtensilsCrossed size={22} className="text-orange-300" />
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
            {(item.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags!.map((slug) => {
                  const tag = allTags.find((t) => t.slug === slug);
                  return tag ? (
                    <span key={slug} className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tagPillCls(tag.category)}`}>
                      {tag.emoji} {tag.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex items-baseline gap-1 mt-1">
              {regDisc && <span className="text-[11px] text-gray-400 line-through">{fmt(regBase)}</span>}
              <span className={`text-sm font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>{fmt(regPrice)}</span>
              {hasLarge && <span className="text-[11px] text-gray-400">/ L {fmt(lrgPrice)}</span>}
            </div>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={!item.available}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold transition-colors ${
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
            <img src={item.image} alt={item.name} className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
              <UtensilsCrossed size={48} className="text-orange-200" />
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

          {/* Extras badge — top right */}
          {(hasToppings || hasLarge) && (
            <span className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {hasToppings ? '+ Extras' : 'R / L'}
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="p-3.5 flex flex-col flex-1">
          {/* Name */}
          <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>

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
