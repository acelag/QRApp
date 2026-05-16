import { Plus } from 'lucide-react';
import type { MenuItem } from '../types';
import { effectivePrice } from '../types/MenuItem';
import { useCart } from '../context/CartContext';

interface Props {
  item: MenuItem;
}

export function MenuCard({ item }: Props) {
  const { addItem, items } = useCart();
  const inCart = items.find((i) => i.menuItemId === item.id);
  const discounted = item.discountPct > 0;
  const finalPrice = effectivePrice(item);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-4xl">
            🍽️
          </div>
        )}
        {discounted && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {item.discountPct}% OFF
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
        {item.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <div>
            {discounted ? (
              <>
                <span className="text-xs text-gray-400 line-through">${item.price.toFixed(2)}</span>
                <span className="block text-green-600 font-bold text-lg leading-tight">${finalPrice.toFixed(2)}</span>
              </>
            ) : (
              <span className="text-orange-600 font-bold text-lg">${item.price.toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => addItem(item)}
            disabled={!item.available}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !item.available
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : inCart
                ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            <Plus size={14} />
            {inCart ? `${inCart.quantity} in cart` : 'Add'}
          </button>
        </div>
        {!item.available && (
          <p className="text-xs text-red-400 mt-1">Unavailable</p>
        )}
      </div>
    </div>
  );
}
