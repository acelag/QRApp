import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { MenuItem } from '../types';
import type { SelectedTopping } from '../types/Order';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { ToppingSelectionModal } from './ToppingSelectionModal';

interface Props {
  item: MenuItem;
}

export function MenuCard({ item }: Props) {
  const { addItem, items } = useCart();
  const { fmt } = useCurrency();
  const hasLarge = item.largePrice != null && item.largePrice > 0;
  const hasToppings = (item.toppings ?? []).some((t) => t.available);
  const [showModal, setShowModal] = useState(false);
  const [pendingSize, setPendingSize] = useState<'regular' | 'large' | undefined>(undefined);

  const regPrice  = effectivePrice(item, 'regular');
  const lrgPrice  = hasLarge ? effectivePrice(item, 'large') : 0;
  const regBase   = item.price;
  const lrgBase   = item.largePrice ?? 0;
  const regDisc   = item.discountPct > 0;
  const lrgDisc   = (item.largeDiscountPct ?? 0) > 0;

  const inCartReg = items.filter((i) => i.menuItemId === item.id && (!hasLarge || i.size === 'regular')).reduce((s, i) => s + i.quantity, 0);
  const inCartLrg = items.filter((i) => i.menuItemId === item.id && i.size === 'large').reduce((s, i) => s + i.quantity, 0);

  function handleAdd(sz: 'regular' | 'large' | undefined) {
    if (hasToppings) { setPendingSize(sz); setShowModal(true); }
    else { addItem(item, sz); }
  }

  function handleToppingConfirm(toppings: SelectedTopping[]) {
    addItem(item, pendingSize, undefined, toppings);
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
          {isDiscounted && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPct}% OFF
            </span>
          )}
          {hasToppings && (
            <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              + Extras
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
          {item.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{item.description}</p>
          )}

          <div className="mt-3 space-y-2">
            {hasLarge ? (
              <>
                <div className="flex gap-1.5">
                  {/* Regular */}
                  <div className="flex-1 flex flex-col gap-1">
                    {regDisc
                      ? <><span className="text-xs text-gray-400 line-through">{fmt(regBase)}</span><span className="text-green-600 font-bold text-sm leading-tight">{fmt(regPrice)}</span></>
                      : <span className="text-orange-600 font-bold text-sm">{fmt(regPrice)}</span>}
                    <button
                      onClick={() => handleAdd('regular')}
                      disabled={!item.available}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : inCartReg > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                    >
                      <Plus size={12} /> Add R{inCartReg > 0 ? ` (${inCartReg})` : ''}
                    </button>
                  </div>
                  {/* Large */}
                  <div className="flex-1 flex flex-col gap-1">
                    {lrgDisc
                      ? <><span className="text-xs text-gray-400 line-through">{fmt(lrgBase)}</span><span className="text-green-600 font-bold text-sm leading-tight">{fmt(lrgPrice)}</span></>
                      : <span className="text-orange-600 font-bold text-sm">{fmt(lrgPrice)}</span>}
                    <button
                      onClick={() => handleAdd('large')}
                      disabled={!item.available}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : inCartLrg > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                    >
                      <Plus size={12} /> Add L{inCartLrg > 0 ? ` (${inCartLrg})` : ''}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  {regDisc
                    ? <><span className="text-xs text-gray-400 line-through">{fmt(regBase)}</span><span className="block text-green-600 font-bold text-lg leading-tight">{fmt(regPrice)}</span></>
                    : <span className="text-orange-600 font-bold text-lg">{fmt(regPrice)}</span>}
                </div>
                <button
                  onClick={() => handleAdd(undefined)}
                  disabled={!item.available}
                  className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : inCartReg > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                    : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                >
                  <Plus size={14} />
                  {inCartReg > 0 ? `${inCartReg} in cart` : 'Add'}
                </button>
              </>
            )}
          </div>
          {!item.available && (
            <p className="text-xs text-red-400 mt-1">Unavailable</p>
          )}
        </div>
      </div>

      {showModal && (
        <ToppingSelectionModal
          item={item}
          size={pendingSize}
          onConfirm={handleToppingConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
