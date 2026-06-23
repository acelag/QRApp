import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrencySymbol, formatCurrency, restaurantService } from '../services/restaurantService';
import { useAuth } from './AuthContext';

interface CurrencyContextValue {
  symbol: string;
  currencyCode: string;
  /** The restaurant's stored/base currency (prices are recorded in this). */
  baseCurrencyCode: string;
  /** The configured display currency (null if not set or same as base). */
  displayCurrencyCode: string | null;
  /** True when a display currency different from base is configured. */
  canSwitch: boolean;
  /** True when the customer is currently viewing prices in the display currency. */
  showDisplay: boolean;
  /** Flip between base and display currencies. */
  toggleCurrency: () => void;
  /** True when prices are actively being converted (showDisplay && canSwitch). */
  isConverting: boolean;
  /** Exchange rate applied: displayAmount = storedAmount * exchangeRate */
  exchangeRate: number;
  fmt: (amount: number) => string;
  /** Call this from customer pages that know their restaurantId. */
  loadCurrency: (restaurantId: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  symbol: '$',
  currencyCode: 'USD',
  baseCurrencyCode: 'USD',
  displayCurrencyCode: null,
  canSwitch: false,
  showDisplay: false,
  toggleCurrency: () => {},
  isConverting: false,
  exchangeRate: 1,
  fmt: (n) => formatCurrency(n, 'USD'),
  loadCurrency: () => {},
});

// Module-level rate cache so we don't refetch on every re-render
const _rateCache: Record<string, { rate: number; ts: number }> = {};
const RATE_TTL_MS = 30 * 60 * 1000; // 30 min

async function fetchLiveRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const key = `${from}-${to}`;
  const cached = _rateCache[key];
  if (cached && Date.now() - cached.ts < RATE_TTL_MS) return cached.rate;
  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await resp.json() as { result: string; rates: Record<string, number> };
    if (data.result === 'success' && data.rates[to] != null) {
      _rateCache[key] = { rate: data.rates[to], ts: Date.now() };
      return data.rates[to];
    }
    return null;
  } catch {
    return null;
  }
}

interface CurrencyConfig {
  baseCurrency: string;
  displayCurrency: string | null;
  exchangeRateManual: number | null;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<CurrencyConfig>({
    baseCurrency: 'USD',
    displayCurrency: null,
    exchangeRateManual: null,
  });
  const [liveRate, setLiveRate]     = useState<number | null>(null);
  const [showDisplay, setShowDisplay] = useState(false);

  const applyConfig = useCallback((cfg: CurrencyConfig) => {
    setConfig(cfg);
    const { baseCurrency, displayCurrency, exchangeRateManual } = cfg;
    const target = displayCurrency && displayCurrency !== baseCurrency ? displayCurrency : null;
    if (!target) { setLiveRate(null); setShowDisplay(false); return; }
    if (exchangeRateManual != null) { setLiveRate(exchangeRateManual); return; }
    fetchLiveRate(baseCurrency, target).then((r) => setLiveRate(r));
  }, []);

  // Auto-load for authenticated admin/kitchen users
  useEffect(() => {
    if (user?.restaurantId) {
      restaurantService.getMyRestaurant().then((r) => {
        if (!r) return;
        applyConfig({
          baseCurrency: r.currency ?? 'USD',
          displayCurrency: r.displayCurrency ?? null,
          exchangeRateManual: r.exchangeRateManual ?? null,
        });
      }).catch(() => {});
    }
  }, [user?.restaurantId, applyConfig]);

  const loadCurrency = useCallback((restaurantId: string) => {
    restaurantService.getRestaurantInfo(restaurantId).then((info) => {
      applyConfig({
        baseCurrency: info.currency ?? 'USD',
        displayCurrency: info.displayCurrency ?? null,
        exchangeRateManual: info.exchangeRateManual ?? null,
      });
    }).catch(() => {
      restaurantService.getRestaurantCurrency(restaurantId).then((code) => {
        applyConfig({ baseCurrency: code, displayCurrency: null, exchangeRateManual: null });
      }).catch(() => {});
    });
  }, [applyConfig]);

  const hasDisplay = !!(config.displayCurrency && config.displayCurrency !== config.baseCurrency);

  const activeCurrency = (hasDisplay && showDisplay)
    ? config.displayCurrency!
    : config.baseCurrency;

  const resolvedRate = config.exchangeRateManual ?? liveRate ?? 1;
  const exchangeRate = (hasDisplay && showDisplay) ? resolvedRate : 1;
  const isConverting = exchangeRate !== 1;

  const toggleCurrency = useCallback(() => {
    if (hasDisplay) setShowDisplay((v) => !v);
  }, [hasDisplay]);

  const fmt = useCallback(
    (n: number) => formatCurrency(n * exchangeRate, activeCurrency),
    [exchangeRate, activeCurrency],
  );

  const symbol = getCurrencySymbol(activeCurrency);

  return (
    <CurrencyContext.Provider value={{
      symbol,
      currencyCode: activeCurrency,
      baseCurrencyCode: config.baseCurrency,
      displayCurrencyCode: hasDisplay ? config.displayCurrency : null,
      canSwitch: hasDisplay,
      showDisplay,
      toggleCurrency,
      isConverting,
      exchangeRate,
      fmt,
      loadCurrency,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
