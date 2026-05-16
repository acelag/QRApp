import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const rowToSession = (row: Record<string, unknown>) => ({
  id: row.id, restaurantId: row.restaurant_id, tableId: row.table_id,
  tableNumber: row.table_number, status: row.status as 'open' | 'paid',
  createdAt: row.created_at, closedAt: row.closed_at ?? null,
});

async function buildSessionDetail(row: Record<string, unknown>) {
  const sessionId = row.id as string;
  const ordersRes = await pool.query('SELECT * FROM orders WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]);
  const orders = await Promise.all(ordersRes.rows.map(async (o: Record<string, unknown>) => {
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [o.id as string]);
    return {
      id: o.id, status: o.status, totalAmount: Number(o.total_amount), createdAt: o.created_at,
      items: itemsRes.rows.map((i: Record<string, unknown>) => ({
        menuItemId: i.menu_item_id as string, name: i.name as string,
        price: Number(i.price), quantity: i.quantity as number, notes: i.notes != null ? (i.notes as string) : undefined,
      })),
    };
  }));

  const billMap = new Map<string, { menuItemId: string; name: string; price: number; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = billMap.get(item.menuItemId);
      if (existing) existing.quantity += item.quantity;
      else billMap.set(item.menuItemId, { ...item });
    }
  }
  const billItems = Array.from(billMap.values()).map((i) => ({ ...i, total: Number((i.price * i.quantity).toFixed(2)) }));
  const totalAmount = Number(billItems.reduce((s, i) => s + i.total, 0).toFixed(2));
  return { ...rowToSession(row), orders, billItems, totalAmount };
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

router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
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

router.patch('/:id/pay', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const now = new Date().toISOString();
  const result = await pool.query(
    `UPDATE table_sessions SET status='paid', closed_at=$1 WHERE id=$2 AND restaurant_id=$3 AND status='open'`,
    [now, req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(400).json({ error: 'Session not found or already closed' }); return; }
  const updated = await pool.query('SELECT * FROM table_sessions WHERE id = $1', [req.params.id]);
  res.json(await buildSessionDetail(updated.rows[0] as Record<string, unknown>));
});

export default router;
