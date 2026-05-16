import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

function rowToSession(row: Record<string, unknown>) {
  return {
    id:              row.id,
    restaurantId:    row.restaurant_id,
    tableId:         row.table_id,
    tableNumber:     row.table_number,
    status:          row.status as 'open' | 'paid',
    createdAt:    row.created_at,
    closedAt:        row.closed_at ?? null,
  };
}

async function buildSessionDetail(row: Record<string, unknown>) {
  const sessionId = row.id as string;

  const ordersRes = await pool.request()
    .input('sessionId', sql.NVarChar, sessionId)
    .query('SELECT * FROM orders WHERE session_id = @sessionId ORDER BY created_at ASC');

  const orders = await Promise.all(
    ordersRes.recordset.map(async (o: Record<string, unknown>) => {
      const itemsRes = await pool.request()
        .input('orderId', sql.NVarChar, o.id as string)
        .query('SELECT * FROM order_items WHERE order_id = @orderId');
      return {
        id:          o.id,
        status:      o.status,
        totalAmount: Number(o.total_amount),
        createdAt:   o.created_at,
        items: itemsRes.recordset.map((i: Record<string, unknown>) => ({
          menuItemId: i.menu_item_id as string,
          name:       i.name        as string,
          price:      Number(i.price),
          quantity:   i.quantity    as number,
          notes:      i.notes != null ? (i.notes as string) : undefined,
        })),
      };
    })
  );

  // Aggregate bill items across all orders
  const billMap = new Map<string, { menuItemId: string; name: string; price: number; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = billMap.get(item.menuItemId);
      if (existing) { existing.quantity += item.quantity; }
      else          { billMap.set(item.menuItemId, { ...item }); }
    }
  }
  const billItems = Array.from(billMap.values()).map((i) => ({
    ...i, total: Number((i.price * i.quantity).toFixed(2)),
  }));
  const totalAmount = Number(billItems.reduce((s, i) => s + i.total, 0).toFixed(2));

  return { ...rowToSession(row), orders, billItems, totalAmount };
}

// POST — public: create or return open session for a table
router.post('/', async (req, res) => {
  const { tableId, tableNumber, restaurantId } = req.body as {
    tableId: string; tableNumber: number; restaurantId: string;
  };
  if (!tableId || tableNumber == null || !restaurantId) {
    res.status(400).json({ error: 'tableId, tableNumber and restaurantId are required' }); return;
  }

  const existing = await pool.request()
    .input('tableId', sql.NVarChar, tableId)
    .input('rid',     sql.NVarChar, restaurantId)
    .query("SELECT * FROM table_sessions WHERE table_id = @tableId AND restaurant_id = @rid AND status = 'open'");

  if (existing.recordset.length > 0) {
    res.json(rowToSession(existing.recordset[0] as Record<string, unknown>));
    return;
  }

  const id  = uuid();
  const now = new Date().toISOString();
  await pool.request()
    .input('id',          sql.NVarChar, id)
    .input('restaurantId',sql.NVarChar, restaurantId)
    .input('tableId',     sql.NVarChar, tableId)
    .input('tableNumber', sql.Int,      tableNumber)
    .input('now',         sql.NVarChar, now)
    .query(`
      INSERT INTO table_sessions (id, restaurant_id, table_id, table_number, status, created_at)
      VALUES (@id, @restaurantId, @tableId, @tableNumber, 'open', @now)
    `);

  res.status(201).json({ id, restaurantId, tableId, tableNumber, status: 'open', createdAt: now, closedAt: null });
});

// GET / — admin only: own restaurant's sessions; filter by ?status=open|paid
router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  const rid    = req.user!.restaurantId;

  const query = status
    ? `SELECT * FROM table_sessions WHERE restaurant_id = @rid AND status = '${status}' ORDER BY created_at DESC`
    : `SELECT * FROM table_sessions WHERE restaurant_id = @rid ORDER BY created_at DESC`;

  const result = await pool.request()
    .input('rid', sql.NVarChar, rid)
    .query(query);

  const sessions = await Promise.all(
    (result.recordset as Record<string, unknown>[]).map(buildSessionDetail)
  );
  res.json(sessions);
});

// GET /:id — public: full session detail with orders + bill
router.get('/:id', async (req, res) => {
  const result = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT * FROM table_sessions WHERE id = @id');
  if (!result.recordset.length) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(await buildSessionDetail(result.recordset[0] as Record<string, unknown>));
});

// PATCH /:id/pay — admin: mark session as paid
router.patch('/:id/pay', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const now = new Date().toISOString();
  const result = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .input('now', sql.NVarChar, now)
    .query(`
      UPDATE table_sessions
      SET status = 'paid', closed_at = @now
      WHERE id = @id AND restaurant_id = @rid AND status = 'open'
    `);

  if (result.rowsAffected[0] === 0) {
    res.status(400).json({ error: 'Session not found or already closed' }); return;
  }

  const updated = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT * FROM table_sessions WHERE id = @id');
  res.json(await buildSessionDetail(updated.recordset[0] as Record<string, unknown>));
});

export default router;
