import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPushToAll, newOrderPayload, sendPushToOrder } from '../lib/pushNotifier';
import { sendOrderConfirmation } from '../lib/smsNotifier';
import { autoPrintKitchen } from '../services/printerService';
import { recordAudit, auditFromReq } from '../lib/audit';

const router = Router();
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

interface SelectedTopping { id: string; name: string; price: number; }
interface CartItem {
  menuItemId: string; name: string; price: number; quantity: number;
  notes?: string; size?: 'regular' | 'large';
  toppings?: SelectedTopping[];
  comboId?: string;
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

// Batched variant of ITEMS_SQL — fetches items for many orders in one round trip.
const ITEMS_BULK_SQL = `
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
  WHERE oi.order_id = ANY($1)
  GROUP BY oi.id
`;

/** Shape a raw order row + its (already-fetched) item rows into the API object. No DB calls. */
function mapOrderRow(o: Record<string, unknown>, itemRows: Record<string, unknown>[]) {
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
    taxAmount: Number(o.tax_amount ?? 0),
    serviceChargeAmount: Number(o.service_charge_amount ?? 0),
    promoCode: (o.promo_code as string | null) ?? null,
    paymentMethod: (o.payment_method as string | null) ?? null,
    customerPhone: (o.customer_phone as string | null) ?? null,
    assignedWaiterId: (o.assigned_waiter_id as string | null) ?? null,
    assignedWaiterName: (o.assigned_waiter_name as string | null) ?? null,
    rating: o.rating != null ? Number(o.rating) : null,
    feedbackNote: (o.feedback_note as string | null) ?? null,
    createdAt: o.created_at, updatedAt: o.updated_at,
    items: itemRows.map((i) => ({
      id: i.id,
      menuItemId: i.menu_item_id, name: i.name, price: Number(i.price), quantity: i.quantity,
      notes: i.notes ?? undefined, size: (i.size as string | null) ?? undefined,
      comboId: (i.combo_id as string | null) ?? undefined,
      toppings: ((i.toppings as SelectedTopping[] | null) ?? []).filter((t) => t.id != null),
    })),
  };
}

async function buildOrder(orderId: string) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const o = orderRes.rows[0] as Record<string, unknown> | undefined;
  if (!o) return null;
  const itemsRes = await pool.query(ITEMS_SQL, [orderId]);
  return mapOrderRow(o, itemsRes.rows as Record<string, unknown>[]);
}

router.get('/', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const ordersRes = rid
    ? await pool.query('SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC', [rid])
    : await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  const orderRows = ordersRes.rows as Record<string, unknown>[];
  if (orderRows.length === 0) { res.json([]); return; }

  // Fetch all items for these orders in ONE query, then group by order_id (avoids N+1).
  const ids = orderRows.map((o) => o.id as string);
  const itemsRes = await pool.query(ITEMS_BULK_SQL, [ids]);
  const itemsByOrder = new Map<string, Record<string, unknown>[]>();
  for (const row of itemsRes.rows as Record<string, unknown>[]) {
    const oid = row.order_id as string;
    const list = itemsByOrder.get(oid);
    if (list) list.push(row); else itemsByOrder.set(oid, [row]);
  }

  res.json(orderRows.map((o) => mapOrderRow(o, itemsByOrder.get(o.id as string) ?? [])));
});

// Public: look up a customer's recent orders by phone number (last 30 days, max 20)
router.get('/by-phone', async (req, res) => {
  const rawPhone = String(req.query.phone ?? '').trim();
  const digits   = rawPhone.replace(/\D/g, '');
  if (digits.length < 7) { res.status(400).json({ error: 'Enter a valid phone number' }); return; }

  // Match on last 9 digits so local (07xxxxxxxx) and international (+947xxxxxxxx) both resolve
  const suffix = digits.slice(-9);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let ids: { id: string }[];
  try {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM orders
       WHERE customer_phone IS NOT NULL
         AND RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 9) = $1
         AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [suffix, cutoff],
    );
    ids = result.rows;
  } catch { res.status(500).json({ error: 'Lookup failed' }); return; }

  const orders = await Promise.all(ids.map((r) => buildOrder(r.id)));
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

  // Promo code validation will happen inside the transaction (with FOR UPDATE lock)
  const { promoCode } = req.body as { promoCode?: string };
  let discountAmount = 0;
  let validatedPromoCode: string | null = null;
  let totalAmount = 0;
  let taxableAmount = 0; // subtotal minus discounts, pre-tax — used for loyalty earn after transaction

  // Loyalty redemption vars — set inside transaction, used for awarding after commit
  const { redeemPoints: rawRedeemPts } = req.body as { redeemPoints?: number };
  const redeemPointsReq = (rawRedeemPts && Number.isInteger(rawRedeemPts) && rawRedeemPts > 0) ? rawRedeemPts : 0;
  let loyaltyDiscount = 0;
  let loyaltyAccountId: string | null = null;
  let actualRedeemedPoints = 0;

  const now = new Date().toISOString();
  const orderId = uuid();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate and apply promo code inside transaction to prevent race condition
    if (promoCode?.trim()) {
      const upperCode = promoCode.trim().toUpperCase();
      const promoRes = await client.query(
        'SELECT * FROM promo_codes WHERE code = $1 AND restaurant_id = $2 FOR UPDATE',
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

    // ── Loyalty: validate & lock points redemption ───────────────────────────
    if (redeemPointsReq > 0 && customerPhone?.trim()) {
      const cfgRow = (await client.query(
        'SELECT * FROM loyalty_configs WHERE restaurant_id=$1 AND enabled=true',
        [resolvedRestaurantId],
      )).rows[0] as Record<string, unknown> | undefined;
      if (cfgRow) {
        const accRow = (await client.query(
          'SELECT * FROM loyalty_accounts WHERE restaurant_id=$1 AND phone=$2 FOR UPDATE',
          [resolvedRestaurantId, customerPhone.trim()],
        )).rows[0] as Record<string, unknown> | undefined;
        if (accRow) {
          const balance   = Number(accRow.points_balance);
          const rate      = Number(cfgRow.redeem_rate);
          const minPts    = Number(cfgRow.min_redeem_points);
          const maxByPct  = Math.floor(subtotal * (Number(cfgRow.max_redeem_pct) / 100) * rate);
          actualRedeemedPoints = Math.min(redeemPointsReq, balance, maxByPct);
          if (actualRedeemedPoints >= minPts && actualRedeemedPoints > 0) {
            loyaltyDiscount  = Math.round((actualRedeemedPoints / rate) * 100) / 100;
            loyaltyAccountId = accRow.id as string;
          } else {
            actualRedeemedPoints = 0;
          }
        }
      }
    }

    taxableAmount = Math.max(0, subtotal - discountAmount - loyaltyDiscount);

    // ── Service charge + tax ────────────────────────────────────────────────
    const restRates = (await client.query(
      'SELECT service_charge_pct, tax_pct FROM restaurants WHERE id = $1',
      [resolvedRestaurantId],
    )).rows[0] as Record<string, unknown> | undefined;
    const scPct  = Number(restRates?.service_charge_pct ?? 0);
    const taxPct = Number(restRates?.tax_pct ?? 0);
    const serviceChargeAmount = orderType === 'dine-in'
      ? Math.round(taxableAmount * scPct  / 100 * 100) / 100
      : 0;
    const taxAmount = Math.round((taxableAmount + serviceChargeAmount) * taxPct / 100 * 100) / 100;
    totalAmount = taxableAmount + serviceChargeAmount + taxAmount;

    const seqRes = await client.query(
      `UPDATE restaurants SET next_order_seq = next_order_seq + 1 WHERE id = $1 RETURNING next_order_seq, order_number_prefix`,
      [resolvedRestaurantId],
    );
    const seqRow = seqRes.rows[0] as Record<string, unknown>;
    const seq = Number(seqRow.next_order_seq);
    const prefix = (seqRow.order_number_prefix as string | null) ?? 'ORD';
    const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;
    await client.query(
      `INSERT INTO orders (id,restaurant_id,session_id,table_id,table_number,room_id,room_number,order_type,customer_name,customer_phone,status,total_amount,discount_amount,promo_code,order_number,payment_method,tax_amount,service_charge_amount,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
      [orderId, resolvedRestaurantId, sessionId ?? null, tableId ?? null, tableNumber ?? null, roomId ?? null, roomNumber ?? null, orderType, customerName ?? null, customerPhone?.trim() || null, totalAmount, discountAmount, validatedPromoCode, orderNumber, initialPaymentMethod?.trim() || null, taxAmount, serviceChargeAmount, now],
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
        `INSERT INTO order_items (id,order_id,menu_item_id,name,price,quantity,notes,size,combo_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orderItemId, orderId, item.menuItemId, item.name, item.price, item.quantity, item.notes ?? null, item.size ?? null, item.comboId ?? null],
      );
      for (const topping of (item.toppings ?? [])) {
        await client.query(
          `INSERT INTO order_item_toppings (id,order_item_id,topping_id,name,price) VALUES ($1,$2,$3,$4,$5)`,
          [uuid(), orderItemId, topping.id, topping.name, topping.price],
        );
      }
      // Check stock before decrementing to prevent overselling
      const stockCheck = await client.query(
        'SELECT stock, name FROM menu_items WHERE id = $1 AND track_stock = true AND stock IS NOT NULL',
        [item.menuItemId],
      );
      if (stockCheck.rows.length) {
        const stockRow = stockCheck.rows[0] as { stock: number; name: string };
        if (stockRow.stock < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for: ${stockRow.name}`), { statusCode: 400 });
        }
      }
      // Decrement stock for tracked items; auto-disable when it reaches 0
      await client.query(
        `UPDATE menu_items
         SET stock     = GREATEST(0, stock - $1),
             available = CASE WHEN stock - $1 <= 0 THEN false ELSE available END
         WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
        [item.quantity, item.menuItemId],
      );
      // Deduct raw ingredients defined in the item's recipe
      const recipeRows = await client.query(
        `SELECT mii.quantity, mii.stock_item_id, si.quantity AS sq, si.name
         FROM menu_item_ingredients mii
         JOIN stock_items si ON si.id = mii.stock_item_id
         WHERE mii.menu_item_id = $1`,
        [item.menuItemId],
      );
      for (const ing of recipeRows.rows as { quantity: string; stock_item_id: string; sq: string; name: string }[]) {
        const needed = Number(ing.quantity) * item.quantity;
        if (Number(ing.sq) < needed) {
          throw Object.assign(new Error(`Insufficient ingredient: ${ing.name}`), { statusCode: 400 });
        }
        await client.query(
          'UPDATE stock_items SET quantity = quantity - $1, updated_at = $2 WHERE id = $3',
          [needed, now, ing.stock_item_id],
        );
        await client.query(
          `INSERT INTO stock_movements (id,stock_item_id,restaurant_id,type,quantity,reason,created_at)
           VALUES ($1,$2,$3,'out',$4,'Order',$5)`,
          [uuid(), ing.stock_item_id, resolvedRestaurantId, needed, now],
        );
      }
    }
    // Deduct redeemed loyalty points (inside transaction for atomicity)
    if (loyaltyAccountId && actualRedeemedPoints > 0) {
      await client.query(
        'UPDATE loyalty_accounts SET points_balance=points_balance-$1, updated_at=$2 WHERE id=$3',
        [actualRedeemedPoints, now, loyaltyAccountId],
      );
      await client.query(
        `INSERT INTO loyalty_transactions (id,account_id,order_id,type,points,description,created_at)
         VALUES ($1,$2,$3,'redeem',$4,'Points redeemed for order discount',$5)`,
        [uuid(), loyaltyAccountId, orderId, -actualRedeemedPoints, now],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 400) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw err;
  } finally {
    client.release();
  }

  // Award loyalty points — best-effort, non-fatal
  if (customerPhone?.trim()) {
    try {
      const cfgRow = (await pool.query(
        'SELECT * FROM loyalty_configs WHERE restaurant_id=$1 AND enabled=true',
        [resolvedRestaurantId],
      )).rows[0] as Record<string, unknown> | undefined;
      if (cfgRow) {
        const earned = Math.floor(taxableAmount * Number(cfgRow.points_per_unit));
        if (earned > 0) {
          const earnNow = new Date().toISOString();
          await pool.query(
            `INSERT INTO loyalty_accounts (id,restaurant_id,phone,points_balance,lifetime_points,created_at,updated_at)
             VALUES ($1,$2,$3,0,0,$4,$4) ON CONFLICT (restaurant_id,phone) DO NOTHING`,
            [uuid(), resolvedRestaurantId, customerPhone.trim(), earnNow],
          );
          const accId = ((await pool.query(
            'SELECT id FROM loyalty_accounts WHERE restaurant_id=$1 AND phone=$2',
            [resolvedRestaurantId, customerPhone.trim()],
          )).rows[0] as Record<string, unknown>).id as string;
          await pool.query(
            'UPDATE loyalty_accounts SET points_balance=points_balance+$1, lifetime_points=lifetime_points+$1, updated_at=$2 WHERE id=$3',
            [earned, earnNow, accId],
          );
          await pool.query(
            `INSERT INTO loyalty_transactions (id,account_id,order_id,type,points,description,created_at)
             VALUES ($1,$2,$3,'earn',$4,'Points earned for order',$5)`,
            [uuid(), accId, orderId, earned, earnNow],
          );
        }
      }
    } catch (e) {
      console.error('Loyalty award failed (non-fatal):', e);
    }
  }

  const built = await buildOrder(orderId);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const label = orderType === 'takeaway' ? (customerName?.trim() ?? 'Takeaway') : orderType === 'room-service' ? (customerName?.trim() ?? `Room ${roomNumber}`) : tableNumber ?? 0;
  sendPushToAll(resolvedRestaurantId, newOrderPayload(label as number, itemCount, totalAmount, orderId)).catch(() => {});
  autoPrintKitchen(resolvedRestaurantId, orderId);

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

router.patch('/:id/status', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter', 'kitchen'), async (req: AuthRequest, res) => {
  const { status, paymentMethod } = req.body as { status: OrderStatus; paymentMethod?: string };
  if (!['pending', 'preparing', 'ready'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  const now = new Date().toISOString();
  const rid = req.user!.restaurantId;
  // Stamp served_at the first time an order reaches 'ready'
  const servedAt = status === 'ready' ? now : null;
  const result = rid
    ? await pool.query(
        `UPDATE orders
         SET status=$1, updated_at=$2, payment_method=COALESCE($3, payment_method),
             served_at=COALESCE(served_at, $6)
         WHERE id=$4 AND restaurant_id=$5`,
        [status, now, paymentMethod ?? null, req.params.id, rid, servedAt])
    : await pool.query(
        `UPDATE orders
         SET status=$1, updated_at=$2, payment_method=COALESCE($3, payment_method),
             served_at=COALESCE(served_at, $5)
         WHERE id=$4`,
        [status, now, paymentMethod ?? null, req.params.id, servedAt]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  sendPushToOrder(String(req.params.id), status).catch(() => {});
  res.json(await buildOrder(String(req.params.id)));
});

router.patch('/:id/waiter', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { waiterId } = req.body as { waiterId: string | null };
  const rid = req.user!.restaurantId;
  const now = new Date().toISOString();

  let waiterName: string | null = null;
  if (waiterId) {
    const waiterRes = await pool.query(
      'SELECT name FROM waiters WHERE id = $1 AND restaurant_id = $2',
      [waiterId, rid],
    );
    if (!waiterRes.rows.length) { res.status(404).json({ error: 'Waiter not found' }); return; }
    waiterName = (waiterRes.rows[0] as Record<string, unknown>).name as string;
  }

  const result = rid
    ? await pool.query(
        'UPDATE orders SET assigned_waiter_id=$1, assigned_waiter_name=$2, updated_at=$3 WHERE id=$4 AND restaurant_id=$5',
        [waiterId ?? null, waiterName, now, req.params.id, rid])
    : await pool.query(
        'UPDATE orders SET assigned_waiter_id=$1, assigned_waiter_name=$2, updated_at=$3 WHERE id=$4',
        [waiterId ?? null, waiterName, now, req.params.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildOrder(String(req.params.id)));
});

router.patch('/:id/payment-method', authenticate, requireRole('admin', 'manager', 'cashier'), async (req: AuthRequest, res) => {
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

// PATCH /:id/cancel  — admin/manager only: void/cancel an order (pending or preparing only)
router.patch('/:id/cancel', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const now = new Date().toISOString();

  // Fetch current order to validate it can be cancelled
  const orderRes = await pool.query(
    'SELECT id, status, restaurant_id FROM orders WHERE id = $1',
    [req.params.id],
  );
  if (!orderRes.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
  const order = orderRes.rows[0] as { id: string; status: string; restaurant_id: string };
  if (rid && order.restaurant_id !== rid) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (order.status !== 'pending') {
    res.status(400).json({ error: 'Only pending orders can be cancelled' }); return;
  }

  const result = rid
    ? await pool.query(
        'UPDATE orders SET status=$1, updated_at=$2 WHERE id=$3 AND restaurant_id=$4',
        ['cancelled', now, req.params.id, rid])
    : await pool.query(
        'UPDATE orders SET status=$1, updated_at=$2 WHERE id=$3',
        ['cancelled', now, req.params.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  void recordAudit(auditFromReq(req, 'order.cancel', { entityType: 'order', entityId: String(req.params.id), summary: `Cancelled order ${String(req.params.id).slice(0, 8)}` }));
  res.json(await buildOrder(String(req.params.id)));
});

// PATCH /:id/items  — admin/manager/cashier/waiter: add items to a pending/preparing order
router.patch('/:id/items', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const { items } = req.body as { items: CartItem[] };
  if (!items?.length) { res.status(400).json({ error: 'items are required' }); return; }

  const rid = req.user!.restaurantId;
  const orderRes = await pool.query(
    'SELECT id, status, total_amount, restaurant_id FROM orders WHERE id = $1',
    [req.params.id],
  );
  if (!orderRes.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
  const order = orderRes.rows[0] as { id: string; status: string; total_amount: string; restaurant_id: string };
  if (rid && order.restaurant_id !== rid) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (!['pending', 'preparing'].includes(order.status)) {
    res.status(400).json({ error: 'Can only add items to pending or preparing orders' }); return;
  }

  const addedAmount = items.reduce((s, i) => {
    const toppingsTotal = (i.toppings ?? []).reduce((t, tp) => t + tp.price, 0);
    return s + (i.price + toppingsTotal) * i.quantity;
  }, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const orderItemId = uuid();
      await client.query(
        `INSERT INTO order_items (id,order_id,menu_item_id,name,price,quantity,notes,size) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderItemId, req.params.id, item.menuItemId, item.name, item.price, item.quantity, item.notes ?? null, item.size ?? null],
      );
      for (const topping of (item.toppings ?? [])) {
        await client.query(
          `INSERT INTO order_item_toppings (id,order_item_id,topping_id,name,price) VALUES ($1,$2,$3,$4,$5)`,
          [uuid(), orderItemId, topping.id, topping.name, topping.price],
        );
      }
      await client.query(
        `UPDATE menu_items
         SET stock     = GREATEST(0, stock - $1),
             available = CASE WHEN stock - $1 <= 0 THEN false ELSE available END
         WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
        [item.quantity, item.menuItemId],
      );
      // Deduct raw ingredients defined in the item's recipe
      const addRecipeRows = await client.query(
        `SELECT mii.quantity, mii.stock_item_id, si.quantity AS sq, si.name
         FROM menu_item_ingredients mii
         JOIN stock_items si ON si.id = mii.stock_item_id
         WHERE mii.menu_item_id = $1`,
        [item.menuItemId],
      );
      for (const ing of addRecipeRows.rows as { quantity: string; stock_item_id: string; sq: string; name: string }[]) {
        const needed = Number(ing.quantity) * item.quantity;
        if (Number(ing.sq) < needed) {
          throw Object.assign(new Error(`Insufficient ingredient: ${ing.name}`), { statusCode: 400 });
        }
        const ts = new Date().toISOString();
        await client.query(
          'UPDATE stock_items SET quantity = quantity - $1, updated_at = $2 WHERE id = $3',
          [needed, ts, ing.stock_item_id],
        );
        await client.query(
          `INSERT INTO stock_movements (id,stock_item_id,restaurant_id,type,quantity,reason,created_at)
           VALUES ($1,$2,$3,'out',$4,'Order',$5)`,
          [uuid(), ing.stock_item_id, rid, needed, ts],
        );
      }
    }
    const newTotal = Number(order.total_amount) + addedAmount;
    const now = new Date().toISOString();
    await client.query('UPDATE orders SET total_amount=$1, updated_at=$2 WHERE id=$3', [newTotal, now, req.params.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await buildOrder(String(req.params.id)));
});

// DELETE /:id/items/:itemId  — remove a single line item from a pending/preparing order
router.delete('/:id/items/:itemId', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const orderId = String(req.params.id);
  const itemId = String(req.params.itemId);
  const rid = req.user!.restaurantId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      'SELECT id, status, total_amount, restaurant_id FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    if (!orderRes.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Order not found' }); return; }
    const order = orderRes.rows[0] as { id: string; status: string; total_amount: string; restaurant_id: string };
    if (rid && order.restaurant_id !== rid) { await client.query('ROLLBACK'); res.status(403).json({ error: 'Forbidden' }); return; }
    if (!['pending', 'preparing'].includes(order.status)) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Can only modify pending or preparing orders' }); return;
    }

    const itemRes = await client.query(
      'SELECT id, menu_item_id, price, quantity FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId],
    );
    if (!itemRes.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Item not found' }); return; }
    const item = itemRes.rows[0] as { id: string; menu_item_id: string; price: string; quantity: number };

    const countRes = await client.query('SELECT COUNT(*) FROM order_items WHERE order_id = $1', [orderId]);
    if (Number((countRes.rows[0] as { count: string }).count) <= 1) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Cannot remove the last item — cancel the order instead.' }); return;
    }

    const toppingsRes = await client.query(
      'SELECT price FROM order_item_toppings WHERE order_item_id = $1',
      [itemId],
    );
    const toppingsTotal = (toppingsRes.rows as { price: string }[]).reduce((s, t) => s + Number(t.price), 0);
    const lineTotal = (Number(item.price) + toppingsTotal) * item.quantity;

    // order_item_toppings has ON DELETE CASCADE so deleting the item is enough
    await client.query('DELETE FROM order_items WHERE id = $1', [itemId]);

    // Restore stock
    await client.query(
      `UPDATE menu_items SET stock = stock + $1 WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
      [item.quantity, item.menu_item_id],
    );
    // Restore raw ingredients
    const delRecipeRows = await client.query(
      `SELECT mii.quantity, mii.stock_item_id
       FROM menu_item_ingredients mii
       WHERE mii.menu_item_id = $1`,
      [item.menu_item_id],
    );
    for (const ing of delRecipeRows.rows as { quantity: string; stock_item_id: string }[]) {
      const restore = Number(ing.quantity) * item.quantity;
      const ts = new Date().toISOString();
      await client.query(
        'UPDATE stock_items SET quantity = quantity + $1, updated_at = $2 WHERE id = $3',
        [restore, ts, ing.stock_item_id],
      );
      await client.query(
        `INSERT INTO stock_movements (id,stock_item_id,restaurant_id,type,quantity,reason,created_at)
         VALUES ($1,$2,$3,'in',$4,'Order item removed',$5)`,
        [uuid(), ing.stock_item_id, rid, restore, ts],
      );
    }

    const newTotal = Math.max(0, Number(order.total_amount) - lineTotal);
    const now = new Date().toISOString();
    await client.query('UPDATE orders SET total_amount=$1, updated_at=$2 WHERE id=$3', [newTotal, now, orderId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await buildOrder(orderId));
});

// PATCH /:id/items/:itemId  — change quantity (and/or notes) on a single line item
router.patch('/:id/items/:itemId', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const orderId = String(req.params.id);
  const itemId = String(req.params.itemId);
  const { quantity, notes } = req.body as { quantity?: number; notes?: string };

  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
    res.status(400).json({ error: 'quantity must be a positive integer' }); return;
  }

  const rid = req.user!.restaurantId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      'SELECT id, status, total_amount, restaurant_id FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    if (!orderRes.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Order not found' }); return; }
    const order = orderRes.rows[0] as { id: string; status: string; total_amount: string; restaurant_id: string };
    if (rid && order.restaurant_id !== rid) { await client.query('ROLLBACK'); res.status(403).json({ error: 'Forbidden' }); return; }
    if (!['pending', 'preparing'].includes(order.status)) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Can only modify pending or preparing orders' }); return;
    }

    const itemRes = await client.query(
      'SELECT id, menu_item_id, price, quantity FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId],
    );
    if (!itemRes.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Item not found' }); return; }
    const item = itemRes.rows[0] as { id: string; menu_item_id: string; price: string; quantity: number };

    const now = new Date().toISOString();

    if (quantity !== undefined && quantity !== item.quantity) {
      const diff = quantity - item.quantity;
      if (diff > 0) {
        const stockCheck = await client.query(
          'SELECT stock FROM menu_items WHERE id = $1 AND track_stock = true AND stock IS NOT NULL',
          [item.menu_item_id],
        );
        if (stockCheck.rows.length) {
          const currentStock = Number((stockCheck.rows[0] as { stock: number }).stock);
          if (currentStock < diff) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: 'Insufficient stock for this quantity' }); return;
          }
        }
        await client.query(
          `UPDATE menu_items SET stock = GREATEST(0, stock - $1), available = CASE WHEN stock - $1 <= 0 THEN false ELSE available END WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
          [diff, item.menu_item_id],
        );
      } else {
        await client.query(
          `UPDATE menu_items SET stock = stock + $1 WHERE id = $2 AND track_stock = true AND stock IS NOT NULL`,
          [-diff, item.menu_item_id],
        );
      }

      const toppingsRes = await client.query(
        'SELECT price FROM order_item_toppings WHERE order_item_id = $1',
        [itemId],
      );
      const toppingsTotal = (toppingsRes.rows as { price: string }[]).reduce((s, t) => s + Number(t.price), 0);
      const totalDiff = (Number(item.price) + toppingsTotal) * diff;
      const newTotal = Math.max(0, Number(order.total_amount) + totalDiff);
      await client.query('UPDATE orders SET total_amount=$1, updated_at=$2 WHERE id=$3', [newTotal, now, orderId]);
      await client.query('UPDATE order_items SET quantity=$1 WHERE id=$2', [quantity, itemId]);
      // Adjust raw ingredient stock by the quantity diff
      const qtyRecipeRows = await client.query(
        `SELECT mii.quantity, mii.stock_item_id, si.quantity AS sq, si.name
         FROM menu_item_ingredients mii
         JOIN stock_items si ON si.id = mii.stock_item_id
         WHERE mii.menu_item_id = $1`,
        [item.menu_item_id],
      );
      for (const ing of qtyRecipeRows.rows as { quantity: string; stock_item_id: string; sq: string; name: string }[]) {
        const ingDiff = Number(ing.quantity) * diff;
        if (ingDiff > 0 && Number(ing.sq) < ingDiff) {
          throw Object.assign(new Error(`Insufficient ingredient: ${ing.name}`), { statusCode: 400 });
        }
        await client.query(
          'UPDATE stock_items SET quantity = quantity - $1, updated_at = $2 WHERE id = $3',
          [ingDiff, now, ing.stock_item_id],
        );
        await client.query(
          `INSERT INTO stock_movements (id,stock_item_id,restaurant_id,type,quantity,reason,created_at)
           VALUES ($1,$2,$3,$4,$5,'Order qty change',$6)`,
          [uuid(), ing.stock_item_id, rid, ingDiff > 0 ? 'out' : 'in', Math.abs(ingDiff), now],
        );
      }
    }

    if (notes !== undefined) {
      await client.query('UPDATE order_items SET notes=$1 WHERE id=$2', [notes || null, itemId]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await buildOrder(orderId));
});

// POST /:id/feedback  — public, no auth (customer rates their own order)
router.post('/:id/feedback', async (req, res) => {
  const { rating, note } = req.body as { rating?: number; note?: string };
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    res.status(400).json({ error: 'rating must be an integer 1–5' });
    return;
  }
  const orderRes = await pool.query('SELECT status, rating FROM orders WHERE id = $1', [req.params.id]);
  if (!orderRes.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
  const row = orderRes.rows[0] as { status: string; rating: number | null };
  if (row.status === 'pending' || row.status === 'cancelled') {
    res.status(400).json({ error: 'Feedback can only be submitted for received orders' });
    return;
  }
  if (row.rating != null) {
    res.status(409).json({ error: 'Feedback already submitted for this order' });
    return;
  }
  const now = new Date().toISOString();
  await pool.query(
    'UPDATE orders SET rating=$1, feedback_note=$2, updated_at=$3 WHERE id=$4',
    [rating, note?.trim() || null, now, req.params.id],
  );
  res.json({ ok: true, rating, note: note?.trim() || null });
});

export default router;
