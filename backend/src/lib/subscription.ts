import { pool } from '../db/database';
import { featuresForPlan, TRIAL_DAYS, type PlanCode } from './plans';
import type { BillingEvent, SubscriptionStatus } from './billing/types';

/** A subscription is "usable" (app accessible) while trialing or active. */
export function isUsable(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active';
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Set a restaurant's plan + status and sync its feature flags and `active`
 * flag accordingly. Optional fields are only updated when provided.
 */
export async function applyPlan(
  restaurantId: string,
  planCode: PlanCode,
  status: SubscriptionStatus,
  opts: { periodEnd?: string | null; customerId?: string | null; provider?: string | null; trialEndsAt?: string | null } = {},
): Promise<void> {
  const features = featuresForPlan(planCode);
  const active = isUsable(status);
  await pool.query(
    `UPDATE restaurants SET
       plan = $1,
       subscription_status = $2,
       features = $3,
       active = $4,
       current_period_end = COALESCE($5, current_period_end),
       trial_ends_at = COALESCE($6, trial_ends_at),
       billing_customer_id = COALESCE($7, billing_customer_id),
       billing_provider = COALESCE($8, billing_provider)
     WHERE id = $9`,
    [
      planCode, status, JSON.stringify(features), active,
      opts.periodEnd ?? null, opts.trialEndsAt ?? null,
      opts.customerId ?? null, opts.provider ?? null,
      restaurantId,
    ],
  );
}

/** Put a newly-created restaurant onto a plan's free trial. */
export async function startTrial(restaurantId: string, planCode: PlanCode): Promise<void> {
  await applyPlan(restaurantId, planCode, 'trialing', { trialEndsAt: isoInDays(TRIAL_DAYS) });
}

/**
 * Apply a normalised billing event idempotently. Returns true if it was
 * applied, false if it was a duplicate (already processed).
 */
export async function handleBillingEvent(ev: BillingEvent, provider: string): Promise<boolean> {
  // Idempotency: only the first insert of a given external id wins.
  const ins = await pool.query(
    `INSERT INTO subscription_events (external_id, restaurant_id, provider, event_type, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING id`,
    [ev.externalId, ev.restaurantId, provider, ev.type, JSON.stringify(ev), new Date().toISOString()],
  );
  if ((ins.rowCount ?? 0) === 0) return false; // duplicate

  switch (ev.type) {
    case 'activated':
    case 'renewed':
      if (ev.planCode) {
        await applyPlan(ev.restaurantId, ev.planCode, 'active', {
          periodEnd: ev.periodEnd ?? null, customerId: ev.customerId ?? null, provider,
        });
      } else {
        await pool.query(
          `UPDATE restaurants SET subscription_status = 'active', active = TRUE, current_period_end = COALESCE($1, current_period_end) WHERE id = $2`,
          [ev.periodEnd ?? null, ev.restaurantId],
        );
      }
      break;
    case 'payment_failed':
      // Enter grace: keep access but flag past_due so the UI can nudge.
      await pool.query(
        `UPDATE restaurants SET subscription_status = 'past_due' WHERE id = $1`,
        [ev.restaurantId],
      );
      break;
    case 'canceled':
      await pool.query(
        `UPDATE restaurants SET subscription_status = 'canceled', active = FALSE WHERE id = $1`,
        [ev.restaurantId],
      );
      break;
  }
  return true;
}
