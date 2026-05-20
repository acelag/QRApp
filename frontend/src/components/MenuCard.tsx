import { useState } from 'react';
import { Plus, Flame } from 'lucide-react';
import type { MenuItem } from '../types';
import type { SelectedTopping } from '../types/Order';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTags } from '../context/TagsContext';
import { ToppingSelectionModal } from './ToppingSelectionModal';

const LOW_STOCK_THRESHOLD = 5;

interface Props {
  item: MenuItem;
}

export function MenuCard({ item }: Props) {
  const { addItem, items } = useCart();
  const { fmt } = useCurrency();
  const { tags: allTags } = useTags();
  const hasLarge = item.largePrice != null && item.largePrice > 0;
  const hasToppings = (item.toppings ?? []).some((t) => t.available);
  const isLowStock = item.trackStock && item.available && item.stock != null && item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD;
  const [showModal, setShowModal] = useState(false);

  const regPrice  = effectivePrice(item, 'regular');
  const lrgPrice  = hasLarge ? effectivePrice(item, 'large') : 0;
  const regBase   = item.price;
  const regDisc   = item.discountPct > 0;
  const lrgDisc   = (item.largeDiscountPct ?? 0) > 0;

  const inCartReg = items.filter((i) => i.menuItemId === item.id && (!hasLarge || i.size === 'regular')).reduce((s, i) => s + i.quantity, 0);
  const inCartLrg = items.filter((i) => i.menuItemId === item.id && i.size === 'large').reduce((s, i) => s + i.quantity, 0);

  function handleAdd(sz: 'regular' | 'large' | undefined) {
    if (hasToppings || hasLarge) { setShowModal(true); }
    else { addItem(item, sz); }
  }

  function handleToppingConfirm(toppings: SelectedTopping[], size?: 'regular' | 'large', notes?: string) {
    addItem(item, size, notes, toppings);
    setShowModal(false);
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="relative">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-4xl">
              🍽️
            </div>
          )}
          {(regDisc || lrgDisc) && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {regDisc ? item.discountPct : item.largeDiscountPct}% OFF
            </span>
          )}
          {hasToppings && (
            <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              + Extras
            </span>
          )}
          {isLowStock && (
            <span className={`absolute bottom-2 left-2 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              item.stock! <= 2 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
            }`}>
              <Flame size={11} />
              Only {item.stock} left
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
          {(item.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(item.tags!).map((slug) => {
                const tag = allTags.find((t) => t.slug === slug);
                return tag ? (
                  <span key={slug} className="inline-flex items-center gap-0.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {tag.emoji} {tag.label}
                  </span>
                ) : null;
              })}
            </div>
          )}
          {item.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{item.description}</p>
          )}

          <div className="mt-3 space-y-2">
            <div>
              {regDisc
                ? <><span className="text-xs text-gray-400 line-through">{fmt(regBase)}</span><span className="block text-green-600 font-bold text-lg leading-tight">{fmt(regPrice)}</span></>
                : <span className="text-orange-600 font-bold text-lg">{fmt(regPrice)}</span>}
              {hasLarge && <span className="text-xs text-gray-400 ml-1">/ L {fmt(lrgPrice)}</span>}
            </div>
            <button
              onClick={() => handleAdd(undefined)}
              disabled={!item.available}
              className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : (inCartReg + inCartLrg) > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                : 'bg-orange-500 text-white hover:bg-orange-600'}`}
            >
              <Plus size={14} />
              {(inCartReg + inCartLrg) > 0 ? `${inCartReg + inCartLrg} in cart` : 'Add'}
            </button>
          </div>
          {!item.available && (
            <p className="text-xs text-red-400 mt-1">Unavailable</p>
          )}
        </div>
      </div>

      {showModal && (
        <ToppingSelectionModal
          item={item}
          onConfirm={handleToppingConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
