import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Shared mappers ────────────────────────────────────────────────────────────
const toConfig = (r: Record<string, unknown>) => ({
  enabled:         Boolean(r.enabled),
  pointsPerUnit:   Number(r.points_per_unit),
  redeemRate:      Number(r.redeem_rate),
  minRedeemPoints: Number(r.min_redeem_points),
  maxRedeemPct:    Number(r.max_redeem_pct),
});

const toAccount = (r: Record<string, unknown>) => ({
  id:             r.id,
  restaurantId:   r.restaurant_id,
  phone:          r.phone,
  name:           r.name ?? null,
  pointsBalance:  Number(r.points_balance),
  lifetimePoints: Number(r.lifetime_points),
  createdAt:      r.created_at,
  updatedAt:      r.updated_at,
});

const toTxn = (r: Record<string, unknown>) => ({
  id:          r.id,
  accountId:   r.account_id,
  orderId:     r.order_id ?? null,
  type:        r.type,
  points:      Number(r.points),
  description: r.description ?? null,
  createdAt:   r.created_at,
});

async function getOrCreateConfig(restaurantId: string): Promise<Record<string, unknown>> {
  const res = await pool.query('SELECT * FROM loyalty_configs WHERE restaurant_id = $1', [restaurantId]);
  if (res.rows.length) return res.rows[0] as Record<string, unknown>;
  const now = new Date().toISOString();
  const ins = await pool.query(
    `INSERT INTO loyalty_configs (id, restaurant_id, enabled, points_per_unit, redeem_rate, min_redeem_points, max_redeem_pct, created_at, updated_at)
     VALUES ($1,$2,false,1,100,100,50,$3,$3) RETURNING *`,
    [uuid(), restaurantId, now],
  );
  return ins.rows[0] as Record<string, unknown>;
}

// ── Admin: get / update config ─────────────────────────────────────────────────
router.get('/config', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  res.json(toConfig(await getOrCreateConfig(req.user!.restaurantId as string)));
});

router.put('/config', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const body = req.body as { enabled?: boolean; pointsPerUnit?: number; redeemRate?: number; minRedeemPoints?: number; maxRedeemPct?: number };
  const existing = await getOrCreateConfig(req.user!.restaurantId as string);
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE loyalty_configs SET enabled=$1, points_per_unit=$2, redeem_rate=$3,
       min_redeem_points=$4, max_redeem_pct=$5, updated_at=$6
     WHERE restaurant_id=$7 RETURNING *`,
    [
      body.enabled         !== undefined ? body.enabled         : existing.enabled,
      body.pointsPerUnit   !== undefined ? body.pointsPerUnit   : existing.points_per_unit,
      body.redeemRate      !== undefined ? body.redeemRate      : existing.redeem_rate,
      body.minRedeemPoints !== undefined ? body.minRedeemPoints : existing.min_redeem_points,
      body.maxRedeemPct    !== undefined ? body.maxRedeemPct    : existing.max_redeem_pct,
      now,
      req.user!.restaurantId,
    ],
  );
  res.json(toConfig(rows[0] as Record<string, unknown>));
});

// ── Public: lookup used from cart / success page ──────────────────────────────
// Returns { account, config } so the cart only needs one request.
router.get('/lookup', async (req, res) => {
  const { restaurantId, phone: rawPhone } = req.query as { restaurantId?: string; phone?: string };
  const phone = (rawPhone ?? '').replace(/\D/g, '');
  if (!restaurantId || !phone) { res.status(400).json({ error: 'restaurantId and phone required' }); return; }

  const [cfgRes, accRes] = await Promise.all([
    pool.query('SELECT * FROM loyalty_configs WHERE restaurant_id = $1', [restaurantId]),
    pool.query('SELECT * FROM loyalty_accounts WHERE restaurant_id = $1 AND phone = $2', [restaurantId, phone]),
  ]);

  if (!cfgRes.rows.length || !Boolean((cfgRes.rows[0] as Record<string, unknown>).enabled)) {
    res.json({ config: null, account: null });
    return;
  }

  res.json({
    config:  toConfig(cfgRes.rows[0] as Record<string, unknown>),
    account: accRes.rows.length ? toAccount(accRes.rows[0] as Record<string, unknown>) : null,
  });
});

// ── Admin: list all members ────────────────────────────────────────────────────
router.get('/accounts', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { search } = req.query as { search?: string };
  const rid = req.user!.restaurantId;
  const { rows } = search
    ? await pool.query(
        `SELECT * FROM loyalty_accounts WHERE restaurant_id = $1 AND (phone ILIKE $2 OR name ILIKE $2)
         ORDER BY points_balance DESC LIMIT 100`,
        [rid, `%${search}%`],
      )
    : await pool.query(
        'SELECT * FROM loyalty_accounts WHERE restaurant_id = $1 ORDER BY points_balance DESC LIMIT 100',
        [rid],
      );
  res.json(rows.map(r => toAccount(r as Record<string, unknown>)));
});

// ── Admin: transaction history for a member ────────────────────────────────────
router.get('/account/:phone/transactions', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const phone = (req.params.phone as string).replace(/\D/g, '');
  const { rows } = await pool.query(
    `SELECT lt.* FROM loyalty_transactions lt
     JOIN loyalty_accounts la ON la.id = lt.account_id
     WHERE la.restaurant_id = $1 AND la.phone = $2
     ORDER BY lt.created_at DESC LIMIT 100`,
    [req.user!.restaurantId, phone],
  );
  res.json(rows.map(r => toTxn(r as Record<string, unknown>)));
});

// ── Admin: manual point adjustment ────────────────────────────────────────────
router.post('/account/adjust', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { phone: rawPhone, points, description } = req.body as { phone?: string; points?: number; description?: string };
  const phone = (rawPhone ?? '').replace(/\D/g, '');
  if (!phone || !Number.isInteger(points) || points === 0) {
    res.status(400).json({ error: 'phone and a non-zero integer points value are required' }); return;
  }
  const rid = req.user!.restaurantId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO loyalty_accounts (id,restaurant_id,phone,points_balance,lifetime_points,created_at,updated_at)
       VALUES ($1,$2,$3,0,0,$4,$4) ON CONFLICT (restaurant_id,phone) DO NOTHING`,
      [uuid(), rid, phone, now],
    );
    const accRes = await client.query(
      'SELECT * FROM loyalty_accounts WHERE restaurant_id=$1 AND phone=$2 FOR UPDATE',
      [rid, phone],
    );
    const acc = accRes.rows[0] as Record<string, unknown>;
    const newBalance = Math.max(0, Number(acc.points_balance) + (points as number));
    const lifetimeDelta = (points as number) > 0 ? (points as number) : 0;
    await client.query(
      'UPDATE loyalty_accounts SET points_balance=$1, lifetime_points=lifetime_points+$2, updated_at=$3 WHERE id=$4',
      [newBalance, lifetimeDelta, now, acc.id],
    );
    await client.query(
      `INSERT INTO loyalty_transactions (id,account_id,order_id,type,points,description,created_at)
       VALUES ($1,$2,NULL,'adjust',$3,$4,$5)`,
      [uuid(), acc.id, points, description?.trim() || 'Manual adjustment', now],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const upd = await pool.query('SELECT * FROM loyalty_accounts WHERE restaurant_id=$1 AND phone=$2', [rid, phone]);
  res.json(toAccount(upd.rows[0] as Record<string, unknown>));
});

export default router;
