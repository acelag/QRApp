// Subscription plan TYPES + seed defaults. The editable plan data
// (name, prices, tagline, highlights, included features, visibility) lives in
// the `plans` DB table and is served through lib/planStore.ts. Super-admins
// edit it at runtime. The plan CODES themselves are fixed.

import type { FeatureKey } from './features';

export type PlanCode = 'free' | 'starter' | 'pro';

export interface Plan {
  code: PlanCode;
  name: string;
  /** Monthly price in Sri Lankan Rupees (0 = free). */
  priceLkr: number;
  /** Monthly price in US Dollars (0 = free). */
  priceUsd: number;
  /** Annual price in Sri Lankan Rupees (0 = no annual option). */
  priceLkrYear: number;
  /** Annual price in US Dollars (0 = no annual option). */
  priceUsdYear: number;
  tagline: string;
  /** Feature keys unlocked on this plan. */
  features: FeatureKey[];
  /** Marketing bullet points for the pricing page. */
  highlights: string[];
  /** Display order on the pricing page. */
  sortOrder: number;
  /** Whether the plan is shown publicly / selectable. */
  visible: boolean;
}

/** Fixed plan codes, in display order. */
export const PLAN_CODES: PlanCode[] = ['free', 'starter', 'pro'];

/** Free trial length, in days, for new self-serve signups. */
export const TRIAL_DAYS = 14;

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as string[]).includes(v);
}

/** Seed data — inserted into the `plans` table on first run. Editable thereafter. */
export const DEFAULT_PLANS: Plan[] = [
  {
    code: 'free',
    name: 'Free',
    priceLkr: 0,
    priceUsd: 0,
    priceLkrYear: 0,
    priceUsdYear: 0,
    tagline: 'QR menu & ordering to get started',
    features: [],
    highlights: [
      'QR-code menu & table ordering',
      'Unlimited menu items & categories',
      'Basic order management',
      '1 location',
    ],
    sortOrder: 0,
    visible: true,
  },
  {
    code: 'starter',
    name: 'Starter',
    priceLkr: 2500,
    priceUsd: 19,
    priceLkrYear: 25000,
    priceUsdYear: 190,
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
    sortOrder: 1,
    visible: true,
  },
  {
    code: 'pro',
    name: 'Pro',
    priceLkr: 6000,
    priceUsd: 49,
    priceLkrYear: 60000,
    priceUsdYear: 490,
    tagline: 'The full suite for multi-area operations',
    features: ['combos', 'menuSchedules', 'roomCharges', 'promoCodes', 'reports', 'roster', 'shiftReport', 'staffPerformance', 'tableStatus', 'readyDisplay', 'kitchenDisplay', 'bills'],
    highlights: [
      'Everything in Starter',
      'Combo deals',
      'Menu schedules',
      'Room service & room charges',
      'Staff roster & performance',
      'Shift reports',
      'Priority support',
    ],
    sortOrder: 2,
    visible: true,
  },
];
