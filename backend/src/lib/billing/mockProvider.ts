import type { Request } from 'express';
import { isPlanCode } from '../plans';
import type { BillingProvider, BillingEvent, CheckoutParams, CheckoutResult } from './types';

/**
 * Development / testing provider. No real money moves.
 *
 * `createCheckout` returns a URL to our own mock checkout page (served by the
 * frontend) carrying the params; that page lets you simulate success, which
 * POSTs to the webhook endpoint with a fake-but-well-formed event.
 *
 * `parseWebhook` accepts a simple JSON body shaped like a BillingEvent so the
 * whole subscription flow can be exercised end-to-end before a real gateway
 * is wired in.
 */
export class MockProvider implements BillingProvider {
  readonly name = 'mock';

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const q = new URLSearchParams({
      restaurantId: params.restaurantId,
      plan: params.planCode,
      email: params.customerEmail,
      interval: params.interval,
      return: params.returnUrl,
    });
    return { url: `/billing/mock-checkout?${q.toString()}`, externalId: `mock_${params.restaurantId}_${params.planCode}` };
  }

  async cancel(): Promise<void> {
    // No-op for the mock provider.
  }

  async parseWebhook(req: Request): Promise<BillingEvent | null> {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const type = b.type;
    const restaurantId = b.restaurantId;
    if (typeof restaurantId !== 'string') return null;
    if (type !== 'activated' && type !== 'renewed' && type !== 'payment_failed' && type !== 'canceled') return null;
    return {
      externalId: typeof b.externalId === 'string' ? b.externalId : `mock_${restaurantId}_${String(type)}_${String(b.periodEnd ?? '')}`,
      type,
      restaurantId,
      planCode: isPlanCode(b.planCode) ? b.planCode : undefined,
      periodEnd: typeof b.periodEnd === 'string' ? b.periodEnd : undefined,
      customerId: typeof b.customerId === 'string' ? b.customerId : undefined,
    };
  }
}
