import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrencySymbol, formatCurrency, restaurantService } from '../services/restaurantService';
import { useAuth } from './AuthContext';

interface CurrencyContextValue {
  symbol: string;
  currencyCode: string;
  fmt: (amount: number) => string;
  /** Call this from customer pages that know their restaurantId. */
  loadCurrency: (restaurantId: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  symbol: '$',
  currencyCode: 'USD',
  fmt: (n) => formatCurrency(n, 'USD'),
  loadCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currencyCode, setCurrencyCode] = useState('USD');
  const symbol = getCurrencySymbol(currencyCode);
  const fmt = useCallback((n: number) => formatCurrency(n, currencyCode), [currencyCode]);

  // Auto-load for authenticated admin/kitchen users
  useEffect(() => {
    if (user?.restaurantId) {
      restaurantService
        .getRestaurantCurrency(user.restaurantId)
        .then(setCurrencyCode)
        .catch(() => {});
    }
  }, [user?.restaurantId]);

  const loadCurrency = useCallback((restaurantId: string) => {
    restaurantService
      .getRestaurantCurrency(restaurantId)
      .then(setCurrencyCode)
      .catch(() => {});
  }, []);

  return (
    <CurrencyContext.Provider value={{ symbol, currencyCode, fmt, loadCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
