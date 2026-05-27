import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const toTable = (row: Record<string, unknown>) => ({
  id: row.id, restaurantId: row.restaurant_id, number: row.number, seats: row.seats, active: row.active === true,
});

router.get('/', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY number', [req.user!.restaurantId]);
  res.json((result.rows as Record<string, unknown>[]).map(toTable));
});

// Live table status board — each table enriched with its open session & order summary
router.get('/status', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const STALE_MINUTES = 30;

  const result = await pool.query<{
    id: string; number: number; seats: number; active: boolean;
    session_id: string | null; session_started: string | null;
    order_count: number; active_orders: number; ready_orders: number;
    session_total: number; last_order_at: string | null;
  }>(
    `SELECT
       t.id, t.number::int AS number, t.seats::int AS seats, t.active,
       ts.id                                                    AS session_id,
       ts.created_at                                            AS session_started,
       COUNT(o.id)::int                                         AS order_count,
       COUNT(o.id) FILTER (WHERE o.status IN ('pending','preparing'))::int AS active_orders,
       COUNT(o.id) FILTER (WHERE o.status = 'ready')::int       AS ready_orders,
       COALESCE(SUM(o.total_amount), 0)::float                  AS session_total,
       MAX(o.created_at)                                        AS last_order_at
     FROM tables t
     LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.status = 'open'
     LEFT JOIN orders o ON o.session_id = ts.id
     WHERE t.restaurant_id = $1 AND t.active = true
     GROUP BY t.id, t.number, t.seats, t.active, ts.id, ts.created_at
     ORDER BY t.number`,
    [rid],
  );

  const now = Date.now();
  const rows = result.rows.map((r) => {
    let status: 'free' | 'waiting' | 'active' | 'stale';
    if (!r.session_id) {
      status = 'free';
    } else if (r.order_count === 0) {
      status = 'waiting';
    } else {
      const lastMs = r.last_order_at ? now - new Date(r.last_order_at).getTime() : Infinity;
      status = lastMs >= STALE_MINUTES * 60_000 ? 'stale' : 'active';
    }
    return {
      id: r.id, number: r.number, seats: r.seats,
      sessionId:      r.session_id,
      sessionStarted: r.session_started,
      orderCount:     r.order_count,
      activeOrders:   r.active_orders,
      readyOrders:    r.ready_orders,
      sessionTotal:   r.session_total,
      lastOrderAt:    r.last_order_at,
      status,
    };
  });

  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toTable(result.rows[0] as Record<string, unknown>));
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { number, seats } = req.body as { number: number; seats: number };
  if (!number || !seats) { res.status(400).json({ error: 'number and seats are required' }); return; }
  const dup = await pool.query('SELECT id FROM tables WHERE restaurant_id = $1 AND number = $2', [req.user!.restaurantId, number]);
  if (dup.rows.length) { res.status(409).json({ error: 'Table number already exists' }); return; }
  const id = uuid();
  await pool.query('INSERT INTO tables (id,restaurant_id,number,seats,active) VALUES ($1,$2,$3,$4,TRUE)', [id, req.user!.restaurantId, number, seats]);
  const result = await pool.query('SELECT * FROM tables WHERE id = $1', [id]);
  res.status(201).json(toTable(result.rows[0] as Record<string, unknown>));
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM tables WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  const { number, seats, active } = req.body as { number?: number; seats?: number; active?: boolean };
  await pool.query('UPDATE tables SET number=$1, seats=$2, active=$3 WHERE id=$4',
    [number ?? row.number, seats ?? row.seats, active !== undefined ? active : row.active, req.params.id]);
  const updated = await pool.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
  res.json(toTable(updated.rows[0] as Record<string, unknown>));
});

router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM tables WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
