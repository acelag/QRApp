import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

const toRestaurant = (row: Record<string, unknown>) => ({
  id: row.id, name: row.name, slug: row.slug, active: row.active === true, createdAt: row.created_at,
  serviceChargePct: Number(row.service_charge_pct ?? 0), taxPct: Number(row.tax_pct ?? 0),
  currency: (row.currency as string | null) ?? 'USD',
  logo: (row.logo as string | null) ?? null,
  themeColor: (row.theme_color as string | null) ?? '#f97316',
  orderNumberPrefix: (row.order_number_prefix as string | null) ?? 'ORD',
  waitTimeMin: row.wait_time_min != null ? Number(row.wait_time_min) : null,
});

// ── Public endpoints — no auth required ──────────────────────────────────────
router.get('/:id/currency', async (req, res) => {
  const result = await pool.query('SELECT currency FROM restaurants WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ currency: (result.rows[0] as Record<string, unknown>).currency ?? 'USD' });
});

router.get('/:id/info', async (req, res) => {
  const result = await pool.query('SELECT name, logo, theme_color, wait_time_min FROM restaurants WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = result.rows[0] as Record<string, unknown>;
  res.json({
    name: row.name,
    logo: row.logo ?? null,
    themeColor: (row.theme_color as string | null) ?? '#f97316',
    waitTimeMin: row.wait_time_min != null ? Number(row.wait_time_min) : null,
  });
});

// ── Authenticated routes ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res) => {
  if (req.user!.role === 'super_admin') {
    const result = await pool.query('SELECT * FROM restaurants ORDER BY name');
    res.json((result.rows as Record<string, unknown>[]).map(toRestaurant));
  } else {
    if (!req.user!.restaurantId) { res.json([]); return; }
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.user!.restaurantId]);
    res.json((result.rows as Record<string, unknown>[]).map(toRestaurant));
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(result.rows[0] as Record<string, unknown>));
});

router.get('/:id/users', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT id, username, name, role FROM users WHERE restaurant_id = $1 ORDER BY role, username', [req.params.id]);
  res.json(result.rows.map((u: Record<string, unknown>) => ({ id: u.id, username: u.username, name: u.name, role: u.role })));
});

router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const { name, adminUsername, adminPassword, adminName } = req.body as { name: string; adminUsername: string; adminPassword: string; adminName?: string; };
  if (!name?.trim() || !adminUsername?.trim() || !adminPassword) { res.status(400).json({ error: 'name, adminUsername and adminPassword are required' }); return; }
  const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug; let suffix = 2;
  while (true) {
    const taken = await pool.query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
    if (!taken.rows.length) break;
    slug = `${baseSlug}-${suffix++}`;
  }
  const restaurantId = uuid(); const now = new Date().toISOString();
  await pool.query('INSERT INTO restaurants (id,name,slug,active,created_at) VALUES ($1,$2,$3,TRUE,$4)', [restaurantId, name.trim(), slug, now]);
  const hash = await bcrypt.hash(adminPassword, 10);
  await pool.query(`INSERT INTO users (id,restaurant_id,username,password_hash,name,role) VALUES ($1,$2,$3,$4,$5,'admin')`,
    [uuid(), restaurantId, adminUsername.trim(), hash, adminName?.trim() || adminUsername.trim()]);
  res.status(201).json({ id: restaurantId, name: name.trim(), slug, active: true, createdAt: now });
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const result = await pool.query('UPDATE restaurants SET name = $1 WHERE id = $2', [name.trim(), id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/charges', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { serviceChargePct, taxPct, currency } = req.body as { serviceChargePct?: number; taxPct?: number; currency?: string };
  const toNum = (v: unknown) => { const n = Number(v); return (isNaN(n) || n < 0 || n > 100) ? null : Math.round(n * 100) / 100; };
  const sc = toNum(serviceChargePct); const tax = toNum(taxPct);
  if (sc === null || tax === null) { res.status(400).json({ error: 'Values must be numbers between 0 and 100' }); return; }
  const safeCurrency = typeof currency === 'string' && currency.trim().length > 0 ? currency.trim().toUpperCase() : null;
  const result = safeCurrency
    ? await pool.query('UPDATE restaurants SET service_charge_pct=$1, tax_pct=$2, currency=$3 WHERE id=$4', [sc, tax, safeCurrency, id])
    : await pool.query('UPDATE restaurants SET service_charge_pct=$1, tax_pct=$2 WHERE id=$3', [sc, tax, id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/theme', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { themeColor } = req.body as { themeColor: string };
  if (!themeColor || !/^#[0-9a-fA-F]{6}$/.test(themeColor)) { res.status(400).json({ error: 'Invalid color' }); return; }
  await pool.query('UPDATE restaurants SET theme_color = $1 WHERE id = $2', [themeColor, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/logo', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { logo } = req.body as { logo: string | null };
  await pool.query('UPDATE restaurants SET logo = $1 WHERE id = $2', [logo ?? null, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!updated.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/order-prefix', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { orderNumberPrefix } = req.body as { orderNumberPrefix: string };
  const prefix = (orderNumberPrefix ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!prefix) { res.status(400).json({ error: 'Prefix must be 1–10 alphanumeric characters' }); return; }
  await pool.query('UPDATE restaurants SET order_number_prefix = $1 WHERE id = $2', [prefix, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/wait-time', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { waitTimeMin } = req.body as { waitTimeMin: number | null };
  const safe = waitTimeMin == null ? null : Math.max(1, Math.min(180, Math.round(Number(waitTimeMin))));
  await pool.query('UPDATE restaurants SET wait_time_min = $1 WHERE id = $2', [safe, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/active', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params; const { active } = req.body as { active: boolean };
  if (typeof active !== 'boolean') { res.status(400).json({ error: 'active (boolean) is required' }); return; }
  const result = await pool.query('UPDATE restaurants SET active = $1 WHERE id = $2', [active, id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ id, active });
});

router.post('/impersonate/:userId', authenticate, requireRole('super_admin'), async (_req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [_req.params.userId]);
  if (!result.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = result.rows[0] as Record<string, unknown>;
  const payload = { id: user.id, username: user.username, name: user.name, role: user.role, restaurantId: user.restaurant_id ?? null };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

export default router;
