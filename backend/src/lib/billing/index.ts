import { MockProvider } from './mockProvider';
import type { BillingProvider } from './types';

export type { BillingProvider, BillingEvent, CheckoutParams, CheckoutResult, SubscriptionStatus } from './types';

let provider: BillingProvider | null = null;

/**
 * Returns the active billing provider, selected by the BILLING_PROVIDER env var.
 * Defaults to the mock provider so the whole flow works in dev without keys.
 * Future: 'payhere', 'paddle', 'lemonsqueezy'.
 */
export function getBillingProvider(): BillingProvider {
  if (provider) return provider;
  const choice = (process.env.BILLING_PROVIDER ?? 'mock').toLowerCase();
  switch (choice) {
    // case 'payhere': provider = new PayHereProvider(); break;
    case 'mock':
    default:
      provider = new MockProvider();
  }
  return provider;
}
