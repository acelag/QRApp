import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

function toPromoCode(r: Record<string, unknown>) {
  return {
    id:           r.id as string,
    restaurantId: r.restaurant_id as string,
    code:         r.code as string,
    type:         r.type as 'percentage' | 'fixed',
    value:        Number(r.value),
    minOrder:     Number(r.min_order),
    maxUses:      r.max_uses != null ? Number(r.max_uses) : null,
    uses:         Number(r.uses),
    active:       r.active as boolean,
    expiresAt:    (r.expires_at as string | null) ?? null,
    createdAt:    r.created_at as string,
  };
}

/** Admin — list all promo codes for the restaurant */
router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const result = await pool.query(
    'SELECT * FROM promo_codes WHERE restaurant_id = $1 ORDER BY created_at DESC',
    [rid],
  );
  res.json((result.rows as Record<string, unknown>[]).map(toPromoCode));
});

/** Admin — create promo code */
router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const { code, type, value, minOrder = 0, maxUses = null, expiresAt = null } =
    req.body as {
      code: string; type: 'percentage' | 'fixed'; value: number;
      minOrder?: number; maxUses?: number | null; expiresAt?: string | null;
    };

  if (!code?.trim()) { res.status(400).json({ error: 'code is required' }); return; }
  if (!['percentage', 'fixed'].includes(type)) { res.status(400).json({ error: 'type must be percentage or fixed' }); return; }
  if (!value || value <= 0) { res.status(400).json({ error: 'value must be positive' }); return; }
  if (type === 'percentage' && value > 100) { res.status(400).json({ error: 'percentage cannot exceed 100' }); return; }

  const upperCode = code.trim().toUpperCase();
  const id = uuid();
  const now = new Date().toISOString();

  try {
    await pool.query(
      `INSERT INTO promo_codes (id, restaurant_id, code, type, value, min_order, max_uses, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, rid, upperCode, type, value, minOrder ?? 0, maxUses ?? null, expiresAt ?? null, now],
    );
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'A promo code with that name already exists' }); return;
    }
    throw err;
  }

  const row = await pool.query('SELECT * FROM promo_codes WHERE id = $1', [id]);
  res.status(201).json(toPromoCode(row.rows[0] as Record<string, unknown>));
});

/** Admin — update promo code */
router.patch('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const { active, value, minOrder, maxUses, expiresAt } =
    req.body as {
      active?: boolean; value?: number; minOrder?: number;
      maxUses?: number | null; expiresAt?: string | null;
    };

  const existing = await pool.query(
    'SELECT * FROM promo_codes WHERE id = $1 AND restaurant_id = $2',
    [req.params.id, rid],
  );
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }

  const cur = existing.rows[0] as Record<string, unknown>;
  await pool.query(
    `UPDATE promo_codes SET active=$1, value=$2, min_order=$3, max_uses=$4, expires_at=$5 WHERE id=$6`,
    [
      active   !== undefined ? active   : cur.active,
      value    !== undefined ? value    : Number(cur.value),
      minOrder !== undefined ? minOrder : Number(cur.min_order),
      maxUses  !== undefined ? maxUses  : cur.max_uses,
      expiresAt !== undefined ? expiresAt : cur.expires_at,
      req.params.id,
    ],
  );
  const updated = await pool.query('SELECT * FROM promo_codes WHERE id = $1', [req.params.id]);
  res.json(toPromoCode(updated.rows[0] as Record<string, unknown>));
});

/** Admin — delete promo code */
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const result = await pool.query(
    'DELETE FROM promo_codes WHERE id = $1 AND restaurant_id = $2',
    [req.params.id, rid],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

/** Public — validate a promo code */
router.post('/validate', async (req, res) => {
  const { code, restaurantId, orderAmount } =
    req.body as { code: string; restaurantId: string; orderAmount: number };

  if (!code || !restaurantId) {
    res.status(400).json({ valid: false, message: 'code and restaurantId are required' }); return;
  }

  const upperCode = code.trim().toUpperCase();
  const result = await pool.query(
    'SELECT * FROM promo_codes WHERE code = $1 AND restaurant_id = $2',
    [upperCode, restaurantId],
  );

  if (!result.rows.length) {
    res.json({ valid: false, message: 'Invalid promo code' }); return;
  }

  const promo = result.rows[0] as Record<string, unknown>;

  if (!promo.active) {
    res.json({ valid: false, message: 'This promo code is no longer active' }); return;
  }
  if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
    res.json({ valid: false, message: 'This promo code has expired' }); return;
  }
  if (promo.max_uses != null && Number(promo.uses) >= Number(promo.max_uses)) {
    res.json({ valid: false, message: 'This promo code has reached its usage limit' }); return;
  }
  if (orderAmount < Number(promo.min_order)) {
    res.json({
      valid: false,
      message: `Minimum order of ${Number(promo.min_order).toFixed(2)} required for this code`,
    }); return;
  }

  const discountAmount = promo.type === 'percentage'
    ? Math.min(orderAmount * (Number(promo.value) / 100), orderAmount)
    : Math.min(Number(promo.value), orderAmount);

  res.json({
    valid: true,
    code:           upperCode,
    type:           promo.type,
    value:          Number(promo.value),
    discountAmount: Math.round(discountAmount * 100) / 100,
  });
});

export default router;
