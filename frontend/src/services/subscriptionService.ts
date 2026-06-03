import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export type PlanCode = 'free' | 'starter' | 'pro';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export type BillingInterval = 'month' | 'year';

export interface Plan {
  code: PlanCode;
  name: string;
  priceLkr: number;
  priceUsd: number;
  priceLkrYear: number;
  priceUsdYear: number;
  tagline: string;
  features: string[];
  highlights: string[];
  sortOrder?: number;
  visible?: boolean;
}

export interface PlanPatch {
  name?: string;
  tagline?: string;
  priceLkr?: number;
  priceUsd?: number;
  priceLkrYear?: number;
  priceUsdYear?: number;
  features?: string[];
  highlights?: string[];
  visible?: boolean;
}

export interface MySubscription {
  plan: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  provider: string | null;
}

export interface SignupPayload {
  restaurantName: string;
  adminName: string;
  adminUsername: string; // email
  adminPassword: string;
  plan: PlanCode;
}

export const subscriptionService = {
  /** Public — pricing data for the marketing site. */
  getPlans: (): Promise<{ trialDays: number; plans: Plan[] }> =>
    axios.get<{ trialDays: number; plans: Plan[] }>(`${BASE}/subscription/plans`).then((r) => r.data),

  /** Authenticated — current restaurant's subscription. */
  getMine: (): Promise<MySubscription | null> =>
    axios.get<MySubscription | null>(`${BASE}/subscription`).then((r) => r.data),

  /** Start a checkout for a paid plan; returns a redirect URL. */
  checkout: (plan: PlanCode, returnUrl: string, interval: BillingInterval = 'month'): Promise<{ url: string; externalId?: string }> =>
    axios.post<{ url: string; externalId?: string }>(`${BASE}/subscription/checkout`, { plan, returnUrl, interval }).then((r) => r.data),

  /** Super-admin override of a restaurant's plan/status. */
  adminSet: (restaurantId: string, plan: PlanCode, status: SubscriptionStatus, trialDays?: number) =>
    axios.patch(`${BASE}/subscription/${restaurantId}/admin`, { plan, status, trialDays }).then((r) => r.data),

  /** Super-admin: read all plans (including hidden) for editing. */
  adminGetPlans: (): Promise<{ plans: Plan[] }> =>
    axios.get<{ plans: Plan[] }>(`${BASE}/subscription/admin/plans`).then((r) => r.data),

  /** Super-admin: edit a plan's pricing / contents / visibility. */
  adminUpdatePlan: (code: PlanCode, patch: PlanPatch): Promise<Plan> =>
    axios.patch<Plan>(`${BASE}/subscription/admin/plans/${code}`, patch).then((r) => r.data),
};

/** Feature keys + labels for the plan editor (mirrors backend ALL_FEATURES). */
export const FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'bills', label: 'Bills & payments' },
  { key: 'reports', label: 'Sales reports' },
  { key: 'promoCodes', label: 'Promo codes' },
  { key: 'tableStatus', label: 'Table status' },
  { key: 'readyDisplay', label: 'Ready display' },
  { key: 'kitchenDisplay', label: 'Kitchen display' },
  { key: 'combos', label: 'Combo deals' },
  { key: 'menuSchedules', label: 'Menu schedules' },
  { key: 'roomCharges', label: 'Room charges' },
  { key: 'roster', label: 'Staff roster' },
  { key: 'shiftReport', label: 'Shift reports' },
  { key: 'staffPerformance', label: 'Staff performance' },
];

/** Days remaining until an ISO date (clamped at 0). */
export function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
