import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPushToAll, newOrderPayload, sendPushToOrder } from '../lib/pushNotifier';
import { sendOrderConfirmation } from '../lib/smsNotifier';

const router = Router();
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';

interface SelectedTopping { id: string; name: string; price: number; }
interface CartItem {
  menuItemId: string; name: string; price: number; quantity: number;
  notes?: string; size?: 'regular' | 'large';
  toppings?: SelectedTopping[];
}

const ITEMS_SQL = `
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

async function buildOrder(orderId: string) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const o = orderRes.rows[0] as Record<string, unknown> | undefined;
  if (!o) return null;
  const itemsRes = await pool.query(ITEMS_SQL, [orderId]);
  return {
    id: o.id, orderNumber: (o.order_number as string | null) ?? null,
    restaurantId: o.restaurant_id ?? null, sessionId: o.session_id ?? null,
    tableId: o.table_id ?? null,
    tableNumber: o.table_number !== null && o.table_number !== undefined ? Number(o.table_number) : null,
    roomId: (o.room_id as string | null) ?? null,
    roomNumber: o.room_number !== null && o.room_number !== undefined ? Number(o.room_number) : null,
    orderType: (o.order_type as string) ?? 'dine-in', customerName: (o.customer_name as string) ?? null,
    status: o.status as OrderStatus, totalAmount: Number(o.total_amount),
    discountAmount: Number(o.discount_amount ?? 0),
    promoCode: (o.promo_code as string | null) ?? null,
    paymentMethod: (o.payment_method as string | null) ?? null,
    customerPhone: (o.customer_phone as string | null) ?? null,
    createdAt: o.created_at, updatedAt: o.updated_at,
    items: (itemsRes.rows as Record<string, unknown>[]).map((i) => ({
      menuItemId: i.menu_item_id, name: i.name, price: Number(i.price), quantity: i.quantity,
      notes: i.notes ?? undefined, size: (i.size as string | null) ?? undefined,
      toppings: ((i.toppings as SelectedTopping[] | null) ?? []).filter((t) => t.id != null),
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
  const { tableId, tableNumber, roomId, roomNumber, items, sessionId, restaurantId, orderType = 'dine-in', customerName, customerPhone, paymentMethod: initialPaymentMethod } =
    req.body as { tableId?: string; tableNumber?: number; roomId?: string; roomNumber?: number; items: CartItem[]; sessionId?: string; restaurantId?: string; orderType?: 'dine-in' | 'takeaway' | 'room-service'; customerName?: string; customerPhone?: string; paymentMethod?: string; };
  if (!items?.length) { res.status(400).json({ error: 'items are required' }); return; }
  if (orderType === 'dine-in' && !tableId) { res.status(400).json({ error: 'tableId is required for dine-in orders' }); return; }
  if (orderType === 'room-service' && !roomId) { res.status(400).json({ error: 'roomId is required for room-service orders' }); return; }
  const resolvedRestaurantId = req.user?.restaurantId ?? restaurantId;
  if (!resolvedRestaurantId) { res.status(400).json({ error: 'restaurantId is required' }); return; }

  if (sessionId) {
    const sess = await pool.query('SELECT status FROM table_sessions WHERE id = $1', [sessionId]);
    if (sess.rows.length && (sess.rows[0] as Record<string, unknown>).status !== 'open') {
      res.status(400).json({ error: 'Table session is already closed.' }); return;
    }
  }

  const subtotal = items.reduce((s, i) => {
    const toppingsTotal = (i.toppings ?? []).reduce((t, tp) => t + tp.price, 0);
    return s + (i.price + toppingsTotal) * i.quantity;
  }, 0);

  // Validate and apply promo code if provided
  const { promoCode } = req.body as { promoCode?: string };
  let discountAmount = 0;
  let validatedPromoCode: string | null = null;

  if (promoCode?.trim()) {
    const upperCode = promoCode.trim().toUpperCase();
    const promoRes = await pool.query(
      'SELECT * FROM promo_codes WHERE code = $1 AND restaurant_id = $2',
      [upperCode, resolvedRestaurantId],
    );
    if (promoRes.rows.length) {
      const p = promoRes.rows[0] as Record<string, unknown>;
      const isValid =
        p.active &&
        !(p.expires_at && new Date(p.expires_at as string) < new Date()) &&
        !(p.max_uses != null && Number(p.uses) >= Number(p.max_uses)) &&
        subtotal >= Number(p.min_order);

      if (isValid) {
        discountAmount = p.type === 'percentage'
          ? Math.min(subtotal * (Number(p.value) / 100), subtotal)
          : Math.min(Number(p.value), subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
        validatedPromoCode = upperCode;
      }
    }
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);

  const now = new Date().toISOString();
  const orderId = uuid();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seqRes = await client.query(
      `UPDATE restaurants SET next_order_seq = next_order_seq + 1 WHERE id = $1 RETURNING next_order_seq, order_number_prefix`,
      [resolvedRestaurantId],
    );
    const seqRow = seqRes.rows[0] as Record<string, unknown>;
    const seq = Number(seqRow.next_order_seq);
    const prefix = (seqRow.order_number_prefix as string | null) ?? 'ORD';
    const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;
    await client.query(
      `INSERT INTO orders (id,restaurant_id,session_id,table_id,table_number,room_id,room_number,order_type,customer_name,customer_phone,status,total_amount,discount_amount,promo_code,order_number,payment_method,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$13,$14,$15,$16,$16)`,
      [orderId, resolvedRestaurantId, sessionId ?? null, tableId ?? null, tableNumber ?? null, roomId ?? null, roomNumber ?? null, orderType, customerName ?? null, customerPhone?.trim() || null, totalAmount, discountAmount, validatedPromoCode, orderNumber, initialPaymentMethod?.trim() || null, now],
    );
    // Increment promo code usage
    if (validatedPromoCode) {
      await client.query(
        'UPDATE promo_codes SET uses = uses + 1 WHERE code = $1 AND restaurant_id = $2',
        [validatedPromoCode, resolvedRestaurantId],
      );
    }
    for (const item of items) {
      const orderItemId = uuid();
      await client.query(
        `INSERT INTO order_items (id,order_id,menu_item_id,name,price,quantity,notes,size) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderItemId, orderId, item.menuItemId, item.name, item.price, item.quantity, item.notes ?? null, item.size ?? null],
      );
      for (const topping of (item.toppings ?? [])) {
        await client.query(
          `INSERT INTO order_item_toppings (id,order_item_id,topping_id,name,price) VALUES ($1,$2,$3,$4,$5)`,
          [uuid(), orderItemId, topping.id, topping.name, topping.price],
        );
      }
      // Decrement stock for tracked items; auto-disable when it reaches 0
      await client.query(
        `UPDATE menu_items
         SET stock     = GREATEST(0, stock - $1),
             available = CASE WHEN stock - $1 <= 0 THEN false ELSE available END
         WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
        [item.quantity, item.menuItemId],
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
  const label = orderType === 'takeaway' ? (customerName?.trim() ?? 'Takeaway') : orderType === 'room-service' ? (customerName?.trim() ?? `Room ${roomNumber}`) : tableNumber ?? 0;
  sendPushToAll(resolvedRestaurantId, newOrderPayload(label as number, itemCount, totalAmount, orderId)).catch(() => {});

  // WhatsApp / SMS confirmation
  if (customerPhone?.trim() && built) {
    const restRes = await pool.query('SELECT name, currency FROM restaurants WHERE id = $1', [resolvedRestaurantId]).catch(() => null);
    const restRow = restRes?.rows[0] as Record<string, unknown> | undefined;
    sendOrderConfirmation(customerPhone.trim(), {
      orderNumber: built.orderNumber ?? orderId.slice(0, 8).toUpperCase(),
      restaurantName: (restRow?.name as string | undefined) ?? 'Restaurant',
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        toppingsTotal: (i.toppings ?? []).reduce((s, t) => s + t.price, 0),
      })),
      totalAmount,
      orderId,
      currency: (restRow?.currency as string | undefined) ?? '',
    }).catch(() => {});
  }

  res.status(201).json(built);
});

router.patch('/:id/status', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const { status, paymentMethod } = req.body as { status: OrderStatus; paymentMethod?: string };
  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  const now = new Date().toISOString();
  const rid = req.user!.restaurantId;
  const result = rid
    ? await pool.query(
        'UPDATE orders SET status=$1, updated_at=$2, payment_method=COALESCE($3, payment_method) WHERE id=$4 AND restaurant_id=$5',
        [status, now, paymentMethod ?? null, req.params.id, rid])
    : await pool.query(
        'UPDATE orders SET status=$1, updated_at=$2, payment_method=COALESCE($3, payment_method) WHERE id=$4',
        [status, now, paymentMethod ?? null, req.params.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  sendPushToOrder(String(req.params.id), status).catch(() => {});
  res.json(await buildOrder(String(req.params.id)));
});

router.patch('/:id/payment-method', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { paymentMethod } = req.body as { paymentMethod: string };
  if (!paymentMethod?.trim()) { res.status(400).json({ error: 'paymentMethod is required' }); return; }
  const rid = req.user!.restaurantId;
  const now = new Date().toISOString();
  const result = rid
    ? await pool.query('UPDATE orders SET payment_method=$1, updated_at=$2 WHERE id=$3 AND restaurant_id=$4', [paymentMethod.trim(), now, req.params.id, rid])
    : await pool.query('UPDATE orders SET payment_method=$1, updated_at=$2 WHERE id=$3', [paymentMethod.trim(), now, req.params.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildOrder(String(req.params.id)));
});

export default router;
