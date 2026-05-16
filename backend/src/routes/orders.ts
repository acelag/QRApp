import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPushToAll, newOrderPayload } from '../lib/pushNotifier';

const router = Router();

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';
interface CartItem { menuItemId: string; name: string; price: number; quantity: number; notes?: string; }

async function buildOrder(orderId: string) {
  const orderRes = await pool.request()
    .input('id', sql.NVarChar, orderId)
    .query('SELECT * FROM orders WHERE id = @id');
  const o = orderRes.recordset[0] as Record<string, unknown> | undefined;
  if (!o) return null;

  const itemsRes = await pool.request()
    .input('orderId', sql.NVarChar, orderId)
    .query('SELECT * FROM order_items WHERE order_id = @orderId');

  return {
    id:              o.id,
    restaurantId:    o.restaurant_id  ?? null,
    sessionId:       o.session_id     ?? null,
    tableId:         o.table_id       ?? null,
    tableNumber:     o.table_number   !== null && o.table_number !== undefined ? Number(o.table_number) : null,
    orderType:       (o.order_type as string) ?? 'dine-in',
    customerName:    (o.customer_name as string) ?? null,
    status:          o.status as OrderStatus,
    totalAmount:     Number(o.total_amount),
    createdAt:    o.created_at,
    updatedAt:       o.updated_at,
    items: itemsRes.recordset.map((i: Record<string, unknown>) => ({
      menuItemId: i.menu_item_id,
      name:       i.name,
      price:      Number(i.price),
      quantity:   i.quantity,
      notes:      i.notes ?? undefined,
    })),
  };
}

// GET / — admin & kitchen, own restaurant
router.get('/', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const ordersRes = rid
    ? await pool.request()
        .input('rid', sql.NVarChar, rid)
        .query('SELECT * FROM orders WHERE restaurant_id = @rid ORDER BY created_at DESC')
    : await pool.request()
        .query('SELECT * FROM orders ORDER BY created_at DESC');

  const orders = await Promise.all(
    (ordersRes.recordset as Record<string, unknown>[]).map((o) => buildOrder(o.id as string))
  );
  res.json(orders.filter(Boolean));
});

// GET /:id — public (customer order tracking)
router.get('/:id', async (req, res) => {
  const order = await buildOrder(req.params.id);
  if (!order) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(order);
});

// POST / — place order; optionalAuthenticate parses JWT if present (admin takeaway)
router.post('/', optionalAuthenticate, async (req: AuthRequest, res) => {
  const { tableId, tableNumber, items, sessionId, restaurantId, orderType = 'dine-in', customerName } =
    req.body as {
      tableId?: string; tableNumber?: number; items: CartItem[];
      sessionId?: string; restaurantId?: string;
      orderType?: 'dine-in' | 'takeaway'; customerName?: string;
    };

  if (!items?.length) {
    res.status(400).json({ error: 'items are required' }); return;
  }

  if (orderType === 'dine-in' && !tableId) {
    res.status(400).json({ error: 'tableId is required for dine-in orders' }); return;
  }

  // restaurantId: JWT (admin) takes priority, otherwise use body value (customer)
  const resolvedRestaurantId = req.user?.restaurantId ?? restaurantId;
  if (!resolvedRestaurantId) {
    res.status(400).json({ error: 'restaurantId is required' }); return;
  }

  if (sessionId) {
    const sess = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .query('SELECT status FROM table_sessions WHERE id = @sessionId');
    if (sess.recordset.length && (sess.recordset[0] as Record<string, unknown>).status !== 'open') {
      res.status(400).json({ error: 'Table session is already closed.' }); return;
    }
  }

  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const now = new Date().toISOString();
  const orderId = uuid();

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('id',           sql.NVarChar,      orderId)
      .input('restaurantId', sql.NVarChar,      resolvedRestaurantId)
      .input('sessionId',    sql.NVarChar,      sessionId    ?? null)
      .input('tableId',      sql.NVarChar,      tableId      ?? null)
      .input('tableNumber',  sql.Int,           tableNumber  ?? null)
      .input('orderType',    sql.NVarChar,      orderType)
      .input('customerName', sql.NVarChar,      customerName ?? null)
      .input('total',        sql.Decimal(10,2), totalAmount)
      .input('now',          sql.NVarChar,      now)
      .query(`
        INSERT INTO orders
          (id, restaurant_id, session_id, table_id, table_number, order_type, customer_name, status, total_amount, created_at, updated_at)
        VALUES
          (@id, @restaurantId, @sessionId, @tableId, @tableNumber, @orderType, @customerName, 'pending', @total, @now, @now)
      `);

    for (const item of items) {
      await new sql.Request(transaction)
        .input('id',         sql.NVarChar,      uuid())
        .input('orderId',    sql.NVarChar,      orderId)
        .input('menuItemId', sql.NVarChar,      item.menuItemId)
        .input('name',       sql.NVarChar,      item.name)
        .input('price',      sql.Decimal(10,2), item.price)
        .input('quantity',   sql.Int,           item.quantity)
        .input('notes',      sql.NVarChar,      item.notes ?? null)
        .query(`
          INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, notes)
          VALUES (@id, @orderId, @menuItemId, @name, @price, @quantity, @notes)
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const built = await buildOrder(orderId);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const label = orderType === 'takeaway'
    ? (customerName?.trim() ?? 'Takeaway')
    : tableNumber ?? 0;
  sendPushToAll(resolvedRestaurantId, newOrderPayload(label as number, itemCount, totalAmount, orderId)).catch(() => {});

  res.status(201).json(built);
});

// PATCH /:id/status — admin & kitchen
router.patch('/:id/status', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const { status } = req.body as { status: OrderStatus };
  const valid: OrderStatus[] = ['pending', 'preparing', 'ready', 'served'];
  if (!valid.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

  const now = new Date().toISOString();
  const rid = req.user!.restaurantId;
  const result = rid
    ? await pool.request()
        .input('id', sql.NVarChar, req.params.id).input('rid', sql.NVarChar, rid)
        .input('status', sql.NVarChar, status).input('now', sql.NVarChar, now)
        .query('UPDATE orders SET status=@status, updated_at=@now WHERE id=@id AND restaurant_id=@rid')
    : await pool.request()
        .input('id', sql.NVarChar, req.params.id)
        .input('status', sql.NVarChar, status).input('now', sql.NVarChar, now)
        .query('UPDATE orders SET status=@status, updated_at=@now WHERE id=@id');

  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildOrder(String(req.params.id)));
});

export default router;
