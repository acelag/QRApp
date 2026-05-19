import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import type { MenuItem, Topping } from '../types/MenuItem';
import type { SelectedTopping } from '../types/Order';
import { effectivePrice } from '../types/MenuItem';
import { useCurrency } from '../context/CurrencyContext';

interface Props {
  item: MenuItem;
  size?: 'regular' | 'large';
  onConfirm: (toppings: SelectedTopping[], size?: 'regular' | 'large', notes?: string) => void;
  onClose: () => void;
}

export function ToppingSelectionModal({ item, size: sizeProp, onConfirm, onClose }: Props) {
  const { fmt } = useCurrency();
  const hasLarge = (item.largePrice ?? 0) > 0;
  const showSizePicker = hasLarge && sizeProp === undefined;
  const [selectedSize, setSelectedSize] = useState<'regular' | 'large'>(sizeProp ?? 'regular');
  const availableToppings = (item.toppings ?? []).filter((t) => t.available);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const activeSize = sizeProp ?? (hasLarge ? selectedSize : undefined);
  const basePrice = effectivePrice(item, activeSize);
  const selectedToppings = availableToppings.filter((t) => selected.has(t.id));
  const toppingsTotal = selectedToppings.reduce((s, t) => s + t.price, 0);

  function toggle(topping: Topping) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topping.id)) next.delete(topping.id);
      else next.add(topping.id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(
      selectedToppings.map((t) => ({ id: t.id, name: t.name, price: t.price })),
      hasLarge ? activeSize : undefined,
      notes.trim() || undefined,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
            <p className="text-sm text-gray-500">
              {sizeProp && <span className="capitalize mr-1">{sizeProp}</span>}
              base: {fmt(basePrice)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Size picker */}
        {showSizePicker && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Choose Size</p>
            <div className="flex gap-3">
              {(['regular', 'large'] as const).map((s) => {
                const price = effectivePrice(item, s);
                const isDisc = s === 'large' ? (item.largeDiscountPct ?? 0) > 0 : item.discountPct > 0;
                const origPrice = s === 'large' ? item.largePrice! : item.price;
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`flex-1 py-3 px-4 rounded-2xl border-2 text-left transition-colors ${
                      selectedSize === s
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <span className={`text-sm font-bold block ${selectedSize === s ? 'text-orange-600' : 'text-gray-700'}`}>
                      {s === 'regular' ? 'Regular (R)' : 'Large (L)'}
                    </span>
                    {isDisc ? (
                      <span className="text-xs text-gray-400 line-through block">{fmt(origPrice)}</span>
                    ) : null}
                    <span className={`text-sm font-semibold ${isDisc ? 'text-green-600' : 'text-gray-500'}`}>{fmt(price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toppings list */}
        {availableToppings.length > 0 && (
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Choose Extras (optional)
          </p>
          {availableToppings.map((topping) => {
            const isSelected = selected.has(topping.id);
            return (
              <button
                key={topping.id}
                onClick={() => toggle(topping)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors text-left ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-800 text-sm">{topping.name}</span>
                </div>
                <span className={`text-sm font-semibold ${topping.price > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {topping.price > 0 ? `+${fmt(topping.price)}` : 'Free'}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {/* Special instructions */}
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Special Instructions</p>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. no onions, less spicy, extra sauce…"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-orange-300 placeholder:text-gray-300"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          {selectedToppings.length > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Selected extras</span>
              <span className="font-semibold text-orange-600">+{fmt(toppingsTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-bold text-gray-900">
            <span>Total per item</span>
            <span className="text-lg">{fmt(basePrice + toppingsTotal)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
            >
              <Minus size={14} /> Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
