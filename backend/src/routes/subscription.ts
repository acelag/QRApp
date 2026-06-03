import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth';
import { PLANS, PLAN_CODES, isPlanCode, TRIAL_DAYS } from '../lib/plans';
import { getBillingProvider } from '../lib/billing';
import { handleBillingEvent } from '../lib/subscription';

const router = Router();

// ── Public: pricing data for the marketing site ──────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({ trialDays: TRIAL_DAYS, plans: PLAN_CODES.map((c) => PLANS[c]) });
});

// ── Public: billing webhook (provider → us) ───────────────────────────────────
// Mounted before auth; the provider verifies via signature inside parseWebhook.
router.post('/webhook', async (req, res) => {
  try {
    const provider = getBillingProvider();
    const event = await provider.parseWebhook(req);
    if (!event) { res.status(400).json({ error: 'Invalid webhook' }); return; }
    const applied = await handleBillingEvent(event, provider.name);
    res.json({ ok: true, applied });
  } catch (err) {
    console.error('Billing webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── Authenticated: current restaurant's subscription ──────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const restaurantId = req.user!.restaurantId;
  if (!restaurantId) { res.json(null); return; }
  const result = await pool.query(
    'SELECT plan, subscription_status, trial_ends_at, current_period_end, billing_provider FROM restaurants WHERE id = $1',
    [restaurantId],
  );
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = result.rows[0] as Record<string, unknown>;
  const planCode = (row.plan as string) ?? 'free';
  res.json({
    plan: planCode,
    planName: isPlanCode(planCode) ? PLANS[planCode].name : planCode,
    status: row.subscription_status ?? 'active',
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    provider: row.billing_provider ?? null,
  });
});

// ── Authenticated: start a checkout to subscribe / change plan ────────────────
router.post('/checkout', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const restaurantId = req.user!.restaurantId;
  if (!restaurantId) { res.status(400).json({ error: 'No restaurant' }); return; }
  const { plan, returnUrl } = req.body as { plan?: string; returnUrl?: string };
  if (!isPlanCode(plan)) { res.status(400).json({ error: 'Invalid plan' }); return; }
  if (plan === 'free') { res.status(400).json({ error: 'Free plan needs no checkout' }); return; }

  // Use the signed-in admin's username as the billing contact (usernames are
  // emails in this app); the provider can collect a proper email at checkout.
  const customerEmail = req.user!.username || 'owner@example.com';

  try {
    const provider = getBillingProvider();
    const result = await provider.createCheckout({
      restaurantId,
      planCode: plan,
      customerEmail,
      returnUrl: returnUrl ?? '/admin/settings',
    });
    res.json(result);
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

export default router;
