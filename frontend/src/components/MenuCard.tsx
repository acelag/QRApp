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
  const [selectedSize, setSelectedSize] = useState<'regular' | 'large'>('regular');
  const [showModal, setShowModal] = useState(false);

  const size = hasLarge ? selectedSize : undefined;
  const finalPrice = effectivePrice(item, size);

  const isDiscounted = size === 'large'
    ? (item.largeDiscountPct ?? 0) > 0
    : item.discountPct > 0;
  const basePrice = size === 'large' ? item.largePrice! : item.price;
  const discountPct = size === 'large' ? (item.largeDiscountPct ?? 0) : item.discountPct;

  const inCart = items.filter((i) => i.menuItemId === item.id && i.size === size);
  const inCartCount = inCart.reduce((s, i) => s + i.quantity, 0);

  function handleAdd() {
    if (hasToppings) {
      setShowModal(true);
    } else {
      addItem(item, size);
    }
  }

  function handleToppingConfirm(toppings: SelectedTopping[]) {
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

          {hasLarge && (
            <div className="flex gap-1.5 mt-2">
              {(['regular', 'large'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`flex-1 text-xs py-1 rounded-lg font-medium border transition-colors ${
                    selectedSize === s
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {s === 'regular' ? 'R' : 'L'}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-2">
            <div>
              {isDiscounted ? (
                <>
                  <span className="text-xs text-gray-400 line-through">{fmt(basePrice)}</span>
                  <span className="block text-green-600 font-bold text-lg leading-tight">{fmt(finalPrice)}</span>
                </>
              ) : (
                <span className="text-orange-600 font-bold text-lg">{fmt(finalPrice)}</span>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={!item.available}
              className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !item.available
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : inCartCount > 0
                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              <Plus size={14} />
              {inCartCount > 0 ? `${inCartCount} in cart` : 'Add'}
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
          size={size}
          onConfirm={handleToppingConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
