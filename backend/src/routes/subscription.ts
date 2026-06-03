import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { authenticate, requireRole, JWT_SECRET, type AuthRequest } from '../middleware/auth';
import { isPlanCode, TRIAL_DAYS, type PlanCode } from '../lib/plans';
import { getVisiblePlans, getAllPlans, getPlan, updatePlan } from '../lib/planStore';
import { getBillingProvider } from '../lib/billing';
import { handleBillingEvent, startTrial, applyPlan } from '../lib/subscription';
import type { SubscriptionStatus } from '../lib/billing/types';

const router = Router();

// ── Public: pricing data for the marketing site ──────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({ trialDays: TRIAL_DAYS, plans: getVisiblePlans() });
});

// ── Super-admin: read & edit plan definitions / pricing ───────────────────────
router.get('/admin/plans', authenticate, requireRole('super_admin'), (_req, res) => {
  res.json({ plans: getAllPlans() });
});

router.patch('/admin/plans/:code', authenticate, requireRole('super_admin'), async (req, res) => {
  const code = req.params.code as PlanCode;
  if (!isPlanCode(code)) { res.status(400).json({ error: 'Invalid plan code' }); return; }
  const { name, tagline, priceLkr, priceUsd, features, highlights, visible } = req.body as Record<string, unknown>;
  const updated = await updatePlan(code, {
    name: typeof name === 'string' ? name : undefined,
    tagline: typeof tagline === 'string' ? tagline : undefined,
    priceLkr: typeof priceLkr === 'number' ? priceLkr : undefined,
    priceUsd: typeof priceUsd === 'number' ? priceUsd : undefined,
    features: Array.isArray(features) ? (features as never) : undefined,
    highlights: Array.isArray(highlights) ? (highlights as string[]) : undefined,
    visible: typeof visible === 'boolean' ? visible : undefined,
  });
  if (!updated) { res.status(404).json({ error: 'Plan not found' }); return; }
  res.json(updated);
});

// ── Public: self-serve signup → provision restaurant + admin + start trial ────
router.post('/signup', async (req, res) => {
  const { restaurantName, adminName, adminUsername, adminPassword, plan } = req.body as {
    restaurantName?: string; adminName?: string; adminUsername?: string; adminPassword?: string; plan?: string;
  };
  if (!restaurantName?.trim() || !adminUsername?.trim() || !adminPassword) {
    res.status(400).json({ error: 'Restaurant name, email and password are required' }); return;
  }
  if (adminPassword.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  const planCode = isPlanCode(plan) ? plan : 'starter';

  // Username (email) must be unique across all tenants.
  const exists = await pool.query('SELECT id FROM users WHERE username = $1', [adminUsername.trim()]);
  if (exists.rows.length) { res.status(409).json({ error: 'That email is already registered' }); return; }

  // Unique slug from the restaurant name.
  const baseSlug = restaurantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'restaurant';
  let slug = baseSlug; let suffix = 2;
  while (true) {
    const taken = await pool.query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
    if (!taken.rows.length) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const restaurantId = uuid();
  const now = new Date().toISOString();
  await pool.query('INSERT INTO restaurants (id,name,slug,active,created_at) VALUES ($1,$2,$3,TRUE,$4)', [restaurantId, restaurantName.trim(), slug, now]);
  await startTrial(restaurantId, planCode);

  const userId = uuid();
  const hash = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `INSERT INTO users (id,restaurant_id,username,password_hash,name,role) VALUES ($1,$2,$3,$4,$5,'admin')`,
    [userId, restaurantId, adminUsername.trim(), hash, adminName?.trim() || adminUsername.trim()],
  );

  // Auto-login: return a token like /auth/login does.
  const payload = { id: userId, username: adminUsername.trim(), name: adminName?.trim() || adminUsername.trim(), role: 'admin', restaurantId };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.status(201).json({ token, user: payload, plan: planCode, trialDays: TRIAL_DAYS });
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
    planName: (isPlanCode(planCode) ? getPlan(planCode)?.name : null) ?? planCode,
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

// ── Super-admin: manually set a restaurant's plan/status (override) ───────────
router.patch('/:restaurantId/admin', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const restaurantId = String(req.params.restaurantId);
  const { plan, status, trialDays } = req.body as { plan?: string; status?: string; trialDays?: number };
  if (!isPlanCode(plan)) { res.status(400).json({ error: 'Invalid plan' }); return; }
  const valid: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'canceled'];
  const st = (valid as string[]).includes(status ?? '') ? (status as SubscriptionStatus) : 'active';

  const exists = await pool.query('SELECT id FROM restaurants WHERE id = $1', [restaurantId]);
  if (!exists.rows.length) { res.status(404).json({ error: 'Not found' }); return; }

  const trialEndsAt = st === 'trialing' && trialDays && trialDays > 0
    ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  await applyPlan(restaurantId, plan, st, { trialEndsAt });
  res.json({ ok: true, plan, status: st });
});

export default router;
