import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, sql } from '../db/database';
import { authenticate, requireRole, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const toRestaurant = (row: Record<string, unknown>) => ({
  id:               row.id,
  name:             row.name,
  slug:             row.slug,
  active:           row.active === true || row.active === 1,
  createdAt:        row.created_at,
  serviceChargePct: Number(row.service_charge_pct ?? 0),
  taxPct:           Number(row.tax_pct ?? 0),
});

// GET /api/restaurants
router.get('/', async (req: AuthRequest, res) => {
  if (req.user!.role === 'super_admin') {
    const result = await pool.request().query('SELECT * FROM restaurants ORDER BY name');
    res.json((result.recordset as Record<string, unknown>[]).map(toRestaurant));
  } else {
    if (!req.user!.restaurantId) { res.json([]); return; }
    const result = await pool.request()
      .input('id', sql.NVarChar, req.user!.restaurantId)
      .query('SELECT * FROM restaurants WHERE id = @id');
    res.json((result.recordset as Record<string, unknown>[]).map(toRestaurant));
  }
});

// GET /api/restaurants/:id
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const result = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('SELECT * FROM restaurants WHERE id = @id');
  if (!result.recordset.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(result.recordset[0] as Record<string, unknown>));
});

// GET /api/restaurants/:id/users — super_admin only: list all users for a restaurant
router.get('/:id/users', requireRole('super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const result = await pool.request()
    .input('rid', sql.NVarChar, id)
    .query(`
      SELECT id, username, name, role, restaurant_id
      FROM users
      WHERE restaurant_id = @rid
      ORDER BY role, username
    `);
  res.json(result.recordset.map((u: Record<string, unknown>) => ({
    id:       u.id,
    username: u.username,
    name:     u.name,
    role:     u.role,
  })));
});

// POST /api/restaurants — super_admin only: create new restaurant + initial admin user
router.post('/', requireRole('super_admin'), async (req, res) => {
  const { name, adminUsername, adminPassword, adminName } = req.body as {
    name: string;
    adminUsername: string; adminPassword: string; adminName?: string;
  };
  if (!name?.trim() || !adminUsername?.trim() || !adminPassword) {
    res.status(400).json({ error: 'name, adminUsername and adminPassword are required' }); return;
  }

  // Auto-generate unique slug
  const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const taken = await pool.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT id FROM restaurants WHERE slug = @slug');
    if (!taken.recordset.length) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const restaurantId = uuid();
  const now = new Date().toISOString();
  await pool.request()
    .input('id',   sql.NVarChar, restaurantId)
    .input('name', sql.NVarChar, name.trim())
    .input('slug', sql.NVarChar, slug)
    .input('now',  sql.NVarChar, now)
    .query('INSERT INTO restaurants (id, name, slug, active, created_at) VALUES (@id, @name, @slug, 1, @now)');

  const hash = await bcrypt.hash(adminPassword, 10);
  const displayName = adminName?.trim() || adminUsername.trim();
  await pool.request()
    .input('id',   sql.NVarChar, uuid())
    .input('rid',  sql.NVarChar, restaurantId)
    .input('user', sql.NVarChar, adminUsername.trim())
    .input('hash', sql.NVarChar, hash)
    .input('name', sql.NVarChar, displayName)
    .query(`
      INSERT INTO users (id, restaurant_id, username, password_hash, name, role)
      VALUES (@id, @rid, @user, @hash, @name, 'admin')
    `);

  res.status(201).json({ id: restaurantId, name: name.trim(), slug, active: true, createdAt: now });
});

// PUT /api/restaurants/:id — rename
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }

  const result = await pool.request()
    .input('id',   sql.NVarChar, id)
    .input('name', sql.NVarChar, name.trim())
    .query('UPDATE restaurants SET name = @name WHERE id = @id');

  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('SELECT * FROM restaurants WHERE id = @id');
  res.json(toRestaurant(updated.recordset[0] as Record<string, unknown>));
});

// PATCH /api/restaurants/:id/charges — admin of that restaurant or super_admin
router.patch('/:id/charges', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { serviceChargePct, taxPct } = req.body as {
    serviceChargePct?: number; taxPct?: number;
  };

  const toNum = (v: unknown) => {
    const n = Number(v);
    if (isNaN(n) || n < 0 || n > 100) return null;
    return Math.round(n * 100) / 100;
  };

  const sc  = toNum(serviceChargePct);
  const tax = toNum(taxPct);

  if (sc === null || tax === null) {
    res.status(400).json({ error: 'Values must be numbers between 0 and 100' }); return;
  }

  const result = await pool.request()
    .input('id',  sql.NVarChar,     id)
    .input('sc',  sql.Decimal(5,2), sc)
    .input('tax', sql.Decimal(5,2), tax)
    .query('UPDATE restaurants SET service_charge_pct = @sc, tax_pct = @tax WHERE id = @id');

  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('SELECT * FROM restaurants WHERE id = @id');
  res.json(toRestaurant(updated.recordset[0] as Record<string, unknown>));
});

// PATCH /api/restaurants/:id/active — super_admin only: toggle active/inactive
router.patch('/:id/active', requireRole('super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { active } = req.body as { active: boolean };
  if (typeof active !== 'boolean') {
    res.status(400).json({ error: 'active (boolean) is required' }); return;
  }

  const result = await pool.request()
    .input('id',     sql.NVarChar, id)
    .input('active', sql.Bit,      active ? 1 : 0)
    .query('UPDATE restaurants SET active = @active WHERE id = @id');

  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }

  res.json({ id, active });
});

// POST /api/restaurants/impersonate/:userId — super_admin only: get a token for any user
router.post('/impersonate/:userId', requireRole('super_admin'), async (_req, res) => {
  const { userId } = _req.params;
  const result = await pool.request()
    .input('id', sql.NVarChar, userId)
    .query('SELECT * FROM users WHERE id = @id');

  if (!result.recordset.length) { res.status(404).json({ error: 'User not found' }); return; }

  const user = result.recordset[0] as Record<string, unknown>;
  const payload = {
    id:           user.id,
    username:     user.username,
    name:         user.name,
    role:         user.role,
    restaurantId: user.restaurant_id ?? null,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

export default router;
