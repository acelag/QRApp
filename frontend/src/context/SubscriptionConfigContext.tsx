import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscriptionService } from '../services/subscriptionService';

interface ConfigValue {
  /** Whether the subscription/billing system is active. */
  enabled: boolean;
  trialDays: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionConfigContext = createContext<ConfigValue | null>(null);

export function SubscriptionConfigProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true); // optimistic default until loaded
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const c = await subscriptionService.getConfig();
      setEnabled(c.enabled);
      setTrialDays(c.trialDays);
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <SubscriptionConfigContext.Provider value={{ enabled, trialDays, loading, refresh }}>
      {children}
    </SubscriptionConfigContext.Provider>
  );
}

export function useSubscriptionConfig(): ConfigValue {
  const ctx = useContext(SubscriptionConfigContext);
  if (!ctx) return { enabled: true, trialDays: 14, loading: false, refresh: async () => {} };
  return ctx;
}
