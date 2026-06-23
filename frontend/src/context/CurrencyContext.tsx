import { createContext, useCallback, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { getCurrencySymbol, formatCurrency, restaurantService, type DisplayCurrencyConfig } from '../services/restaurantService';
import { useAuth } from './AuthContext';

export interface AvailableCurrency {
  code: string;
  symbol: string;
  rate: number;        // 1 base = this many of this currency
  isBase: boolean;
}

interface CurrencyContextValue {
  symbol: string;
  currencyCode: string;
  baseCurrencyCode: string;
  /** All currencies the customer can pick from (base + all display currencies). */
  availableCurrencies: AvailableCurrency[];
  /** True when exchange rate is applied (customer picked a non-base currency). */
  isConverting: boolean;
  exchangeRate: number;
  fmt: (amount: number) => string;
  /** Switch to a specific currency code. */
  setActiveCurrency: (code: string) => void;
  loadCurrency: (restaurantId: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  symbol: '$',
  currencyCode: 'USD',
  baseCurrencyCode: 'USD',
  availableCurrencies: [],
  isConverting: false,
  exchangeRate: 1,
  fmt: (n) => formatCurrency(n, 'USD'),
  setActiveCurrency: () => {},
  loadCurrency: () => {},
});

const _rateCache: Record<string, { rates: Record<string, number>; ts: number }> = {};
const RATE_TTL_MS = 30 * 60 * 1000;

async function fetchAllRates(base: string): Promise<Record<string, number> | null> {
  const cached = _rateCache[base];
  if (cached && Date.now() - cached.ts < RATE_TTL_MS) return cached.rates;
  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await resp.json() as { result: string; rates: Record<string, number> };
    if (data.result === 'success') {
      _rateCache[base] = { rates: data.rates, ts: Date.now() };
      return data.rates;
    }
    return null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [baseCurrency, setBaseCurrency]             = useState('USD');
  const [displayConfigs, setDisplayConfigs]          = useState<DisplayCurrencyConfig[]>([]);
  const [liveRates, setLiveRates]                    = useState<Record<string, number>>({});
  const [activeCurrencyCode, setActiveCurrencyCode]  = useState<string>('');  // '' = base
  const hasFetchedRates = useRef(false);

  const applyConfig = useCallback((base: string, configs: DisplayCurrencyConfig[]) => {
    setBaseCurrency(base);
    setDisplayConfigs(configs);
    hasFetchedRates.current = false;
    // Fetch live rates for any configs that need them
    const needsLive = configs.some((c) => c.rateManual == null);
    if (needsLive) {
      fetchAllRates(base).then((rates) => {
        if (rates) { setLiveRates(rates); hasFetchedRates.current = true; }
      });
    }
  }, []);

  useEffect(() => {
    if (user?.restaurantId) {
      restaurantService.getMyRestaurant().then((r) => {
        if (!r) return;
        applyConfig(r.currency ?? 'USD', r.displayCurrencies ?? []);
      }).catch(() => {});
    }
  }, [user?.restaurantId, applyConfig]);

  const loadCurrency = useCallback((restaurantId: string) => {
    restaurantService.getRestaurantInfo(restaurantId).then((info) => {
      applyConfig(info.currency ?? 'USD', info.displayCurrencies ?? []);
    }).catch(() => {
      restaurantService.getRestaurantCurrency(restaurantId).then((code) => {
        applyConfig(code, []);
      }).catch(() => {});
    });
  }, [applyConfig]);

  // Build the available currencies list
  const availableCurrencies: AvailableCurrency[] = [
    { code: baseCurrency, symbol: getCurrencySymbol(baseCurrency), rate: 1, isBase: true },
    ...displayConfigs.map((cfg) => ({
      code: cfg.code,
      symbol: getCurrencySymbol(cfg.code),
      rate: cfg.rateManual ?? liveRates[cfg.code] ?? 0,
      isBase: false,
    })).filter((c) => c.rate > 0),
  ];

  const resolvedActive = activeCurrencyCode && availableCurrencies.some((c) => c.code === activeCurrencyCode)
    ? activeCurrencyCode : baseCurrency;

  const activeEntry = availableCurrencies.find((c) => c.code === resolvedActive)
    ?? availableCurrencies[0]
    ?? { code: baseCurrency, symbol: getCurrencySymbol(baseCurrency), rate: 1, isBase: true };

  const exchangeRate = activeEntry.rate;
  const isConverting = !activeEntry.isBase;

  const setActiveCurrency = useCallback((code: string) => setActiveCurrencyCode(code), []);

  const fmt = useCallback(
    (n: number) => formatCurrency(n * exchangeRate, activeEntry.code),
    [exchangeRate, activeEntry.code],
  );

  return (
    <CurrencyContext.Provider value={{
      symbol: activeEntry.symbol,
      currencyCode: activeEntry.code,
      baseCurrencyCode: baseCurrency,
      availableCurrencies,
      isConverting,
      exchangeRate,
      fmt,
      setActiveCurrency,
      loadCurrency,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
