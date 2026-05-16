import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPushToAll, newOrderPayload } from '../lib/pushNotifier';

const router = Router();
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string; }

async function buildOrder(orderId: string) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const o = orderRes.rows[0] as Record<string, unknown> | undefined;
  if (!o) return null;
  const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return {
    id: o.id, restaurantId: o.restaurant_id ?? null, sessionId: o.session_id ?? null,
    tableId: o.table_id ?? null,
    tableNumber: o.table_number !== null && o.table_number !== undefined ? Number(o.table_number) : null,
    orderType: (o.order_type as string) ?? 'dine-in', customerName: (o.customer_name as string) ?? null,
    status: o.status as OrderStatus, totalAmount: Number(o.total_amount),
    createdAt: o.created_at, updatedAt: o.updated_at,
    items: itemsRes.rows.map((i: Record<string, unknown>) => ({
      menuItemId: i.menu_item_id, name: i.name, price: Number(i.price), quantity: i.quantity, notes: i.notes ?? undefined,
    })),
  };
}

router.get('/', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const ordersRes = rid
    ? await pool.query('SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC', [rid])
    : await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  const orders = await Promise.all((ordersRes.rows as Record<string, unknown>[]).map((o) => buildOrder(o.id as string)));
  res.json(orders.filter(Boolean));
});

router.get('/:id', async (req, res) => {
  const order = await buildOrder(req.params.id);
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(order);
});

router.post('/', optionalAuthenticate, async (req: AuthRequest, res) => {
  const { tableId, tableNumber, items, sessionId, restaurantId, orderType = 'dine-in', customerName } =
    req.body as { tableId?: string; tableNumber?: number; items: CartItem[]; sessionId?: string; restaurantId?: string; orderType?: 'dine-in' | 'takeaway'; customerName?: string; };
  if (!items?.length) { res.status(400).json({ error: 'items are required' }); return; }
  if (orderType === 'dine-in' && !tableId) { res.status(400).json({ error: 'tableId is required for dine-in orders' }); return; }
  const resolvedRestaurantId = req.user?.restaurantId ?? restaurantId;
  if (!resolvedRestaurantId) { res.status(400).json({ error: 'restaurantId is required' }); return; }

  if (sessionId) {
    const sess = await pool.query('SELECT status FROM table_sessions WHERE id = $1', [sessionId]);
    if (sess.rows.length && (sess.rows[0] as Record<string, unknown>).status !== 'open') {
      res.status(400).json({ error: 'Table session is already closed.' }); return;
    }
  }

  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const now = new Date().toISOString();
  const orderId = uuid();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO orders (id,restaurant_id,session_id,table_id,table_number,order_type,customer_name,status,total_amount,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$9)`,
      [orderId, resolvedRestaurantId, sessionId ?? null, tableId ?? null, tableNumber ?? null, orderType, customerName ?? null, totalAmount, now],
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (id,order_id,menu_item_id,name,price,quantity,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), orderId, item.menuItemId, item.name, item.price, item.quantity, item.notes ?? null],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const built = await buildOrder(orderId);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const label = orderType === 'takeaway' ? (customerName?.trim() ?? 'Takeaway') : tableNumber ?? 0;
  sendPushToAll(resolvedRestaurantId, newOrderPayload(label as number, itemCount, totalAmount, orderId)).catch(() => {});
  res.status(201).json(built);
});

router.patch('/:id/status', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: OrderStatus };
  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  const now = new Date().toISOString();
  const rid = req.user!.restaurantId;
  const result = rid
    ? await pool.query('UPDATE orders SET status=$1, updated_at=$2 WHERE id=$3 AND restaurant_id=$4', [status, now, req.params.id, rid])
    : await pool.query('UPDATE orders SET status=$1, updated_at=$2 WHERE id=$3', [status, now, req.params.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildOrder(String(req.params.id)));
});

export default router;
