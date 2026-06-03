import type { Request } from 'express';
import type { PlanCode } from '../plans';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export type BillingInterval = 'month' | 'year';

export interface CheckoutParams {
  restaurantId: string;
  planCode: PlanCode;
  customerEmail: string;
  /** Monthly or annual billing. */
  interval: BillingInterval;
  /** Where to send the customer after a successful/cancelled checkout. */
  returnUrl: string;
}

export interface CheckoutResult {
  /** URL to redirect the customer to in order to pay. */
  url: string;
  /** Provider-side reference, if any. */
  externalId?: string;
}

/** Normalised billing event parsed from a provider webhook. */
export interface BillingEvent {
  /** Unique id from the provider — used for idempotency. */
  externalId: string;
  type: 'activated' | 'renewed' | 'payment_failed' | 'canceled';
  restaurantId: string;
  planCode?: PlanCode;
  /** ISO timestamp the current paid period ends. */
  periodEnd?: string;
  /** Provider's customer reference, stored for later management. */
  customerId?: string;
}

/**
 * A pluggable billing backend. Implementations: MockProvider (dev/testing),
 * and later PayHereProvider / PaddleProvider. Selected via lib/billing/index.ts.
 */
export interface BillingProvider {
  readonly name: string;
  /** Begin a subscription checkout; returns a redirect URL. */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** Cancel an active subscription. */
  cancel(restaurantId: string, customerId: string | null): Promise<void>;
  /** Verify a webhook request's signature and parse it into a BillingEvent (or null to ignore). */
  parseWebhook(req: Request): Promise<BillingEvent | null>;
}
