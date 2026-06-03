import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export type PlanCode = 'free' | 'starter' | 'pro';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Plan {
  code: PlanCode;
  name: string;
  priceLkr: number;
  priceUsd: number;
  tagline: string;
  features: string[];
  highlights: string[];
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
  checkout: (plan: PlanCode, returnUrl: string): Promise<{ url: string; externalId?: string }> =>
    axios.post<{ url: string; externalId?: string }>(`${BASE}/subscription/checkout`, { plan, returnUrl }).then((r) => r.data),

  /** Super-admin override of a restaurant's plan/status. */
  adminSet: (restaurantId: string, plan: PlanCode, status: SubscriptionStatus, trialDays?: number) =>
    axios.patch(`${BASE}/subscription/${restaurantId}/admin`, { plan, status, trialDays }).then((r) => r.data),
};

/** Days remaining until an ISO date (clamped at 0). */
export function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
