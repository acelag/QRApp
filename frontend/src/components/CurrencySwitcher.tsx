import { ArrowLeftRight } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { getCurrencySymbol } from '../services/restaurantService';

export function CurrencySwitcher() {
  const { canSwitch, showDisplay, baseCurrencyCode, displayCurrencyCode, toggleCurrency } = useCurrency();

  if (!canSwitch || !displayCurrencyCode) return null;

  const baseSymbol    = getCurrencySymbol(baseCurrencyCode);
  const displaySymbol = getCurrencySymbol(displayCurrencyCode);

  return (
    <button
      onClick={toggleCurrency}
      title={showDisplay ? `Switch to ${baseCurrencyCode}` : `Switch to ${displayCurrencyCode}`}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all select-none
        bg-white border-orange-200 text-orange-600 hover:bg-orange-50 active:scale-95 shrink-0"
    >
      <span className={showDisplay ? 'opacity-40' : 'opacity-100'}>{baseSymbol} {baseCurrencyCode}</span>
      <ArrowLeftRight size={10} className="opacity-50" />
      <span className={showDisplay ? 'opacity-100' : 'opacity-40'}>{displaySymbol} {displayCurrencyCode}</span>
    </button>
  );
}
