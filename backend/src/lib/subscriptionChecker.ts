/**
 * Subscription lifecycle checker — runs periodically to:
 *   • expire trials whose trial_ends_at has passed (→ canceled, access off)
 *   • expire past_due subscriptions past a grace period (→ canceled, access off)
 *
 * Real activations/renewals come from the billing provider's webhooks; this
 * job only handles the time-based transitions a webhook can't.
 */

import { pool } from '../db/database';
import { subscriptionsEnabled } from './appSettings';

const CHECK_INTERVAL = 60 * 60 * 1000; // hourly
const INITIAL_DELAY  = 20 * 1000;
const GRACE_DAYS     = 7; // past_due window before access is cut

async function sweep(): Promise<void> {
  if (!subscriptionsEnabled()) return; // master switch off — never auto-expire
  const nowIso = new Date().toISOString();
  const graceCutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Trials whose window has elapsed → canceled + access off.
    await pool.query(
      `UPDATE restaurants
         SET subscription_status = 'canceled', active = FALSE
       WHERE subscription_status = 'trialing'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at <= $1`,
      [nowIso],
    );

    // Past-due beyond the grace period → canceled + access off.
    await pool.query(
      `UPDATE restaurants
         SET subscription_status = 'canceled', active = FALSE
       WHERE subscription_status = 'past_due'
         AND current_period_end IS NOT NULL
         AND current_period_end <= $1`,
      [graceCutoff],
    );
  } catch {
    // non-fatal — will retry next tick
  }
}

export function startSubscriptionChecker(): void {
  setTimeout(() => { void sweep(); }, INITIAL_DELAY);
  setInterval(() => { void sweep(); }, CHECK_INTERVAL);
  console.log(`[subscriptionChecker] Started — trial/past-due sweep every ${CHECK_INTERVAL / 60000} min (grace ${GRACE_DAYS}d)`);
}
