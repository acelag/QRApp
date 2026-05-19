import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { MenuItem } from '../types';
import type { SelectedTopping } from '../types/Order';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { ToppingSelectionModal } from './ToppingSelectionModal';

interface Props {
  item: MenuItem;
}

export function MenuCard({ item }: Props) {
  const { addItem, items } = useCart();
  const { fmt } = useCurrency();
  const { lang } = useLanguage();
  const tr = item.translations?.[lang];
  const displayName = tr?.name || item.name;
  const displayDesc = tr?.description || item.description;
  const hasLarge = item.largePrice != null && item.largePrice > 0;
  const hasToppings = (item.toppings ?? []).some((t) => t.available);
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

  function handleToppingConfirm(toppings: SelectedTopping[], size?: 'regular' | 'large') {
    addItem(item, size, undefined, toppings);
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
        </div>
        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 leading-tight">{displayName}</h3>
          {displayDesc && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{displayDesc}</p>
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
