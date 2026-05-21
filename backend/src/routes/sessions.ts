import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

interface SessionTopping { id: string | null; name: string; price: number; }

const rowToSession = (row: Record<string, unknown>) => ({
  id: row.id, restaurantId: row.restaurant_id, tableId: row.table_id,
  tableNumber: row.table_number, status: row.status as 'open' | 'paid',
  createdAt: row.created_at, closedAt: row.closed_at ?? null,
  paymentMethod: (row.payment_method as string | null) ?? null,
  mergedIntoSessionId: (row.merged_into_session_id as string | null) ?? null,
});

const ORDER_ITEMS_SQL = `
  SELECT oi.*,
    COALESCE(
      json_agg(
        json_build_object('id', oit.topping_id, 'name', oit.name, 'price', oit.price::float)
        ORDER BY oit.name
      ) FILTER (WHERE oit.id IS NOT NULL),
      '[]'::json
    ) AS toppings
  FROM order_items oi
  LEFT JOIN order_item_toppings oit ON oit.order_item_id = oi.id
  WHERE oi.order_id = $1
  GROUP BY oi.id
`;

async function buildSessionDetail(row: Record<string, unknown>) {
  const sessionId = row.id as string;

  // Include orders from any sessions merged into this one
  const mergedRes = await pool.query(
    "SELECT id, table_number FROM table_sessions WHERE merged_into_session_id = $1",
    [sessionId],
  );
  const mergedRows = mergedRes.rows as { id: string; table_number: number }[];
  const allSessionIds = [sessionId, ...mergedRows.map((r) => r.id)];

  const ordersRes = await pool.query(
    `SELECT * FROM orders WHERE session_id = ANY($1::varchar[]) ORDER BY created_at ASC`,
    [allSessionIds],
  );
  const orders = await Promise.all(ordersRes.rows.map(async (o: Record<string, unknown>) => {
    const itemsRes = await pool.query(ORDER_ITEMS_SQL, [o.id as string]);
    return {
      id: o.id, status: o.status, totalAmount: Number(o.total_amount), createdAt: o.created_at,
      rating: o.rating != null ? Number(o.rating) : null,
      feedbackNote: (o.feedback_note as string | null) ?? null,
      items: (itemsRes.rows as Record<string, unknown>[]).map((i) => ({
        menuItemId: i.menu_item_id as string, name: i.name as string,
        price: Number(i.price), quantity: i.quantity as number,
        notes: i.notes != null ? (i.notes as string) : undefined,
        size: i.size != null ? (i.size as 'regular' | 'large') : undefined,
        toppings: ((i.toppings as SessionTopping[] | null) ?? []).filter((t) => t.id != null) as { id: string; name: string; price: number }[],
      })),
    };
  }));

  type BillItem = {
    menuItemId: string; name: string; price: number; quantity: number;
    size?: 'regular' | 'large';
    toppings: { id: string; name: string; price: number }[];
  };
  const billMap = new Map<string, BillItem>();

  for (const order of orders) {
    for (const item of order.items) {
      const toppingKey = item.toppings.map((t) => t.id).sort().join(',');
      const key = `${item.menuItemId}|${item.size ?? 'regular'}|${toppingKey}`;
      const existing = billMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        billMap.set(key, { ...item, toppings: item.toppings });
      }
    }
  }

  const billItems = Array.from(billMap.values()).map((i) => {
    const toppingsTotal = i.toppings.reduce((s, t) => s + t.price, 0);
    return {
      ...i,
      total: Number(((i.price + toppingsTotal) * i.quantity).toFixed(2)),
    };
  });
  const totalAmount = Number(billItems.reduce((s, i) => s + i.total, 0).toFixed(2));
  return {
    ...rowToSession(row),
    orders, billItems, totalAmount,
    mergedSessions: mergedRows.map((r) => ({ id: r.id, tableNumber: r.table_number })),
  };
}

router.post('/', async (req, res) => {
  const { tableId, tableNumber, restaurantId } = req.body as { tableId: string; tableNumber: number; restaurantId: string; };
  if (!tableId || tableNumber == null || !restaurantId) { res.status(400).json({ error: 'tableId, tableNumber and restaurantId are required' }); return; }

  const existing = await pool.query("SELECT * FROM table_sessions WHERE table_id = $1 AND restaurant_id = $2 AND status = 'open'", [tableId, restaurantId]);
  if (existing.rows.length > 0) { res.json(rowToSession(existing.rows[0] as Record<string, unknown>)); return; }

  const id = uuid(); const now = new Date().toISOString();
  await pool.query(`INSERT INTO table_sessions (id,restaurant_id,table_id,table_number,status,created_at) VALUES ($1,$2,$3,$4,'open',$5)`,
    [id, restaurantId, tableId, tableNumber, now]);
  res.status(201).json({ id, restaurantId, tableId, tableNumber, status: 'open', createdAt: now, closedAt: null });
});

router.get('/', authenticate, requireRole('admin', 'manager', 'cashier'), async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  const rid = req.user!.restaurantId;
  const result = status
    ? await pool.query('SELECT * FROM table_sessions WHERE restaurant_id = $1 AND status = $2 ORDER BY created_at DESC', [rid, status])
    : await pool.query('SELECT * FROM table_sessions WHERE restaurant_id = $1 ORDER BY created_at DESC', [rid]);
  const sessions = await Promise.all((result.rows as Record<string, unknown>[]).map(buildSessionDetail));
  res.json(sessions);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(await buildSessionDetail(result.rows[0] as Record<string, unknown>));
});

router.patch('/:id/pay', authenticate, requireRole('admin', 'manager', 'cashier'), async (req: AuthRequest, res) => {
  const now = new Date().toISOString();
  const { paymentMethod } = req.body as { paymentMethod?: string };
  const result = await pool.query(
    `UPDATE table_sessions SET status='paid', closed_at=$1, payment_method=$2 WHERE id=$3 AND restaurant_id=$4 AND status='open'`,
    [now, paymentMethod ?? null, req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(400).json({ error: 'Session not found or already closed' }); return; }
  // Close any sessions that were merged into this one
  await pool.query(
    `UPDATE table_sessions SET status='paid', closed_at=$1, payment_method=$2, merged_into_session_id=NULL WHERE merged_into_session_id=$3 AND status='open'`,
    [now, paymentMethod ?? null, req.params.id],
  );
  const updated = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [req.params.id]);
  res.json(await buildSessionDetail(updated.rows[0] as Record<string, unknown>));
});

// ── Merge: link session into another (secondary → primary) ────────────────────
router.patch('/:id/merge', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { intoSessionId } = req.body as { intoSessionId: string };
  if (!intoSessionId) { res.status(400).json({ error: 'intoSessionId is required' }); return; }
  const rid = req.user!.restaurantId;

  // Validate both sessions are open and belong to this restaurant
  const [srcRes, dstRes] = await Promise.all([
    pool.query("SELECT * FROM table_sessions WHERE id=$1 AND restaurant_id=$2 AND status='open'", [req.params.id, rid]),
    pool.query("SELECT * FROM table_sessions WHERE id=$1 AND restaurant_id=$2 AND status='open'", [intoSessionId, rid]),
  ]);
  if (!srcRes.rows.length) { res.status(404).json({ error: 'Source session not found or already closed' }); return; }
  if (!dstRes.rows.length) { res.status(404).json({ error: 'Target session not found or already closed' }); return; }
  if (req.params.id === intoSessionId) { res.status(400).json({ error: 'Cannot merge a session into itself' }); return; }

  await pool.query(
    'UPDATE table_sessions SET merged_into_session_id=$1 WHERE id=$2',
    [intoSessionId, req.params.id],
  );

  // Return the updated primary session with combined bill
  const updated = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [intoSessionId]);
  res.json(await buildSessionDetail(updated.rows[0] as Record<string, unknown>));
});

// ── Unmerge: detach a secondary session from its primary ──────────────────────
router.patch('/:id/unmerge', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const sessRes = await pool.query('SELECT * FROM table_sessions WHERE id=$1 AND restaurant_id=$2', [req.params.id, rid]);
  if (!sessRes.rows.length) { res.status(404).json({ error: 'Session not found' }); return; }

  await pool.query('UPDATE table_sessions SET merged_into_session_id=NULL WHERE id=$1', [req.params.id]);
  const updated = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [req.params.id]);
  res.json(await buildSessionDetail(updated.rows[0] as Record<string, unknown>));
});

export default router;
