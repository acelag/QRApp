// Subscription plans. Each plan maps to a set of feature flags (lib/features.ts).
// Prices are monthly. Edit freely — this is the single source of truth for tiers.

import { ALL_FEATURES, type FeatureKey, type RestaurantFeatures } from './features';

export type PlanCode = 'free' | 'starter' | 'pro';

export interface Plan {
  code: PlanCode;
  name: string;
  /** Monthly price in Sri Lankan Rupees (0 = free). */
  priceLkr: number;
  /** Monthly price in US Dollars (0 = free). */
  priceUsd: number;
  tagline: string;
  /** Feature keys unlocked on this plan. */
  features: FeatureKey[];
  /** Marketing bullet points for the pricing page. */
  highlights: string[];
}

/** Free trial length, in days, for new self-serve signups. */
export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    name: 'Free',
    priceLkr: 0,
    priceUsd: 0,
    tagline: 'QR menu & ordering to get started',
    features: [],
    highlights: [
      'QR-code menu & table ordering',
      'Unlimited menu items & categories',
      'Basic order management',
      '1 location',
    ],
  },
  starter: {
    code: 'starter',
    name: 'Starter',
    priceLkr: 2500,
    priceUsd: 19,
    tagline: 'Everything a busy restaurant needs day-to-day',
    features: ['bills', 'reports', 'promoCodes', 'tableStatus', 'readyDisplay', 'kitchenDisplay'],
    highlights: [
      'Everything in Free',
      'Bills & payments',
      'Sales reports',
      'Promo codes',
      'Table status board',
      'Kitchen & ready displays',
    ],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    priceLkr: 6000,
    priceUsd: 49,
    tagline: 'The full suite for multi-area operations',
    features: [...ALL_FEATURES],
    highlights: [
      'Everything in Starter',
      'Combo deals',
      'Menu schedules',
      'Room service & room charges',
      'Staff roster & performance',
      'Shift reports',
      'Priority support',
    ],
  },
};

export const PLAN_CODES = Object.keys(PLANS) as PlanCode[];

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as string[]).includes(v);
}

/** Build the full RestaurantFeatures record for a plan (every key present, true/false). */
export function featuresForPlan(code: PlanCode): RestaurantFeatures {
  const enabled = new Set(PLANS[code].features);
  const out = {} as RestaurantFeatures;
  for (const k of ALL_FEATURES) out[k] = enabled.has(k);
  return out;
}
