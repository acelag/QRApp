import { useCurrency } from '../context/CurrencyContext';
import { getCurrencySymbol } from '../services/restaurantService';

export function CurrencySwitcher() {
  const { canSwitch, showDisplay, baseCurrencyCode, displayCurrencyCode, toggleCurrency } = useCurrency();

  if (!canSwitch || !displayCurrencyCode) return null;

  const baseSymbol    = getCurrencySymbol(baseCurrencyCode);
  const displaySymbol = getCurrencySymbol(displayCurrencyCode);

  return (
    <select
      value={showDisplay ? displayCurrencyCode : baseCurrencyCode}
      onChange={(e) => {
        const wantsDisplay = e.target.value === displayCurrencyCode;
        if (wantsDisplay !== showDisplay) toggleCurrency();
      }}
      className="text-xs font-semibold rounded-full border border-orange-200 bg-white text-orange-600
        px-2.5 py-1.5 pr-6 appearance-none cursor-pointer outline-none
        hover:bg-orange-50 focus:ring-2 focus:ring-orange-300 transition-all shrink-0"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
    >
      <option value={baseCurrencyCode}>{baseSymbol} {baseCurrencyCode}</option>
      <option value={displayCurrencyCode}>{displaySymbol} {displayCurrencyCode}</option>
    </select>
  );
}
