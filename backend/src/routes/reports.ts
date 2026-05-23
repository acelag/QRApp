import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

// Lightweight today-only snapshot for the dashboard card
router.get('/today', async (req: AuthRequest, res) => {
  const rid   = req.user!.restaurantId;
  const today = new Date().toISOString().slice(0, 10);
  const from  = `${today}T00:00:00.000Z`;
  const to    = `${today}T23:59:59.999Z`;

  const [summaryRes, itemsRes, refundsRes] = await Promise.all([
    pool.query<{
      total_orders: number; total_revenue: number;
      dine_in: number; takeaway: number; room_service: number;
    }>(
      `SELECT
         COUNT(*)::int                                              AS total_orders,
         COALESCE(SUM(total_amount), 0)::float                     AS total_revenue,
         COUNT(*) FILTER (WHERE order_type = 'dine-in')::int       AS dine_in,
         COUNT(*) FILTER (WHERE order_type = 'takeaway')::int      AS takeaway,
         COUNT(*) FILTER (WHERE order_type = 'room-service')::int  AS room_service
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [rid, from, to],
    ),
    pool.query<{ name: string; quantity: number; revenue: number }>(
      `SELECT
         oi.name,
         SUM(oi.quantity)::int                                                         AS quantity,
         COALESCE(SUM((oi.price + COALESCE(t.tip, 0)) * oi.quantity), 0)::float       AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN (
         SELECT order_item_id, SUM(price)::float AS tip
         FROM order_item_toppings GROUP BY order_item_id
       ) t ON t.order_item_id = oi.id
       WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3
       GROUP BY oi.name
       ORDER BY quantity DESC
       LIMIT 5`,
      [rid, from, to],
    ),
    pool.query<{ total_refunds: number; refund_count: number }>(
      `SELECT
         COALESCE(SUM(amount), 0)::float AS total_refunds,
         COUNT(*)::int                   AS refund_count
       FROM refunds
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [rid, from, to],
    ),
  ]);

  const s = summaryRes.rows[0];
  const r = refundsRes.rows[0];
  const grossRevenue  = s.total_revenue;
  const totalRefunds  = r.total_refunds;
  const netRevenue    = grossRevenue - totalRefunds;

  res.json({
    revenue:       netRevenue,
    grossRevenue,
    totalRefunds,
    refundCount:   r.refund_count,
    orderCount:    s.total_orders,
    avgOrderValue: s.total_orders > 0 ? grossRevenue / s.total_orders : 0,
    dineIn:        s.dine_in,
    takeaway:      s.takeaway,
    roomService:   s.room_service,
    topItems:      itemsRes.rows.map((row) => ({ name: row.name, quantity: row.quantity, revenue: row.revenue })),
  });
});

router.get('/', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to date params required (YYYY-MM-DD)' }); return; }

  const rid = req.user!.restaurantId;
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso   = `${to}T23:59:59.999Z`;

  const [summaryRes, dailyRes, itemsRes, categoriesRes, toppingsRes, heatmapRes, promosRes, paymentRes] = await Promise.all([
    // Summary totals
    pool.query<{ total_orders: number; total_revenue: number; dine_in_orders: number; takeaway_orders: number }>(
      `SELECT
         COUNT(*)::int                                           AS total_orders,
         COALESCE(SUM(total_amount), 0)::float                  AS total_revenue,
         COUNT(*) FILTER (WHERE order_type = 'dine-in')::int    AS dine_in_orders,
         COUNT(*) FILTER (WHERE order_type = 'takeaway')::int   AS takeaway_orders
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [rid, fromIso, toIso],
    ),

    // Daily breakdown
    pool.query<{ date: string; order_count: number; revenue: number; dine_in_count: number; takeaway_count: number }>(
      `SELECT
         SUBSTRING(created_at, 1, 10)                           AS date,
         COUNT(*)::int                                           AS order_count,
         COALESCE(SUM(total_amount), 0)::float                  AS revenue,
         COUNT(*) FILTER (WHERE order_type = 'dine-in')::int    AS dine_in_count,
         COUNT(*) FILTER (WHERE order_type = 'takeaway')::int   AS takeaway_count
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY SUBSTRING(created_at, 1, 10)
       ORDER BY date DESC`,
      [rid, fromIso, toIso],
    ),

    // Item performance
    pool.query<{ name: string; size: string | null; quantity: number; base_revenue: number; topping_revenue: number }>(
      `SELECT
         oi.name,
         oi.size,
         SUM(oi.quantity)::int                                              AS quantity,
         COALESCE(SUM(oi.price * oi.quantity), 0)::float                   AS base_revenue,
         COALESCE(SUM(COALESCE(t.topping_sum, 0) * oi.quantity), 0)::float AS topping_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN (
         SELECT order_item_id, SUM(price)::float AS topping_sum
         FROM order_item_toppings
         GROUP BY order_item_id
       ) t ON t.order_item_id = oi.id
       WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3
       GROUP BY oi.name, oi.size
       ORDER BY (
         COALESCE(SUM(oi.price * oi.quantity), 0) +
         COALESCE(SUM(COALESCE(t.topping_sum, 0) * oi.quantity), 0)
       ) DESC`,
      [rid, fromIso, toIso],
    ),

    // Category-level sales
    pool.query<{ category_name: string; total_qty: number; revenue: number }>(
      `SELECT
         COALESCE(c.name, 'Uncategorised') AS category_name,
         SUM(oi.quantity)::int             AS total_qty,
         COALESCE(
           SUM((oi.price + COALESCE(t.topping_sum, 0)) * oi.quantity), 0
         )::float                          AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN categories c  ON c.id  = mi.category_id
       LEFT JOIN (
         SELECT order_item_id, SUM(price)::float AS topping_sum
         FROM order_item_toppings
         GROUP BY order_item_id
       ) t ON t.order_item_id = oi.id
       WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3
       GROUP BY c.name
       ORDER BY revenue DESC`,
      [rid, fromIso, toIso],
    ),

    // Top extras / toppings
    pool.query<{ name: string; times_ordered: number; revenue: number }>(
      `SELECT
         oit.name,
         SUM(oi.quantity)::int                               AS times_ordered,
         COALESCE(SUM(oit.price * oi.quantity), 0)::float   AS revenue
       FROM order_item_toppings oit
       JOIN order_items oi ON oi.id = oit.order_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3
       GROUP BY oit.name
       ORDER BY revenue DESC, times_ordered DESC
       LIMIT 20`,
      [rid, fromIso, toIso],
    ),

    // Hourly heatmap — orders per (day-of-week, hour)
    pool.query<{ day_of_week: number; hour: number; order_count: number; revenue: number }>(
      `SELECT
         EXTRACT(DOW  FROM created_at::timestamptz)::int  AS day_of_week,
         EXTRACT(HOUR FROM created_at::timestamptz)::int  AS hour,
         COUNT(*)::int                                    AS order_count,
         COALESCE(SUM(total_amount), 0)::float            AS revenue
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY day_of_week, hour
       ORDER BY day_of_week, hour`,
      [rid, fromIso, toIso],
    ),

    // Promo code usage within the date range
    pool.query<{ code: string; type: string; value: number; active: boolean; order_count: number; total_discount: number; avg_discount: number }>(
      `SELECT
         pc.code,
         pc.type,
         pc.value::float                                                                      AS value,
         pc.active,
         COUNT(o.id)::int                                                                     AS order_count,
         COALESCE(SUM(o.discount_amount), 0)::float                                           AS total_discount,
         COALESCE(AVG(o.discount_amount) FILTER (WHERE o.discount_amount > 0), 0)::float      AS avg_discount
       FROM promo_codes pc
       LEFT JOIN orders o
         ON  o.promo_code       = pc.code
         AND o.restaurant_id    = pc.restaurant_id
         AND o.created_at      >= $2
         AND o.created_at      <= $3
       WHERE pc.restaurant_id = $1
       GROUP BY pc.id, pc.code, pc.type, pc.value, pc.active
       ORDER BY order_count DESC, total_discount DESC`,
      [rid, fromIso, toIso],
    ),

    // Revenue by payment method
    pool.query<{ method: string; order_count: number; revenue: number }>(
      `SELECT
         COALESCE(payment_method, 'unknown') AS method,
         COUNT(*)::int                        AS order_count,
         COALESCE(SUM(total_amount), 0)::float AS revenue
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY payment_method
       ORDER BY revenue DESC`,
      [rid, fromIso, toIso],
    ),
  ]);

  const s = summaryRes.rows[0];
  res.json({
    summary: {
      totalOrders:    s.total_orders,
      totalRevenue:   s.total_revenue,
      dineInOrders:   s.dine_in_orders,
      takeawayOrders: s.takeaway_orders,
      avgOrderValue:  s.total_orders > 0 ? s.total_revenue / s.total_orders : 0,
    },
    daily: dailyRes.rows.map((r) => ({
      date:          r.date,
      orderCount:    r.order_count,
      revenue:       r.revenue,
      dineInCount:   r.dine_in_count,
      takeawayCount: r.takeaway_count,
    })),
    items: itemsRes.rows.map((r) => ({
      name:           r.name,
      size:           r.size ?? null,
      quantity:       r.quantity,
      baseRevenue:    r.base_revenue,
      toppingRevenue: r.topping_revenue,
      totalRevenue:   r.base_revenue + r.topping_revenue,
    })),
    toppings: toppingsRes.rows.map((r) => ({
      name:         r.name,
      timesOrdered: r.times_ordered,
      revenue:      r.revenue,
    })),
    categories: categoriesRes.rows.map((r) => ({
      name:     r.category_name,
      quantity: r.total_qty,
      revenue:  r.revenue,
    })),
    heatmap: heatmapRes.rows.map((r) => ({
      dayOfWeek:  r.day_of_week,
      hour:       r.hour,
      orderCount: r.order_count,
      revenue:    r.revenue,
    })),
    promos: promosRes.rows.map((r) => ({
      code:          r.code,
      type:          r.type as 'percentage' | 'fixed',
      value:         r.value,
      active:        r.active,
      orderCount:    r.order_count,
      totalDiscount: r.total_discount,
      avgDiscount:   r.avg_discount,
    })),
    paymentMethods: paymentRes.rows.map((r) => ({
      method:     r.method,
      orderCount: r.order_count,
      revenue:    r.revenue,
    })),
  });
});

// End-of-Day / Shift Close Report
router.get('/shift-close', async (req: AuthRequest, res) => {
  const rid  = req.user!.restaurantId;
  const date = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const from = `${date}T00:00:00.000Z`;
  const to   = `${date}T23:59:59.999Z`;

  const [summaryRes, paymentRes, itemsRes, refundsRes, openSessionsRes] = await Promise.all([
    pool.query<{
      total_orders: number; gross_revenue: number; total_discounts: number;
      dine_in_count: number; dine_in_revenue: number;
      takeaway_count: number; takeaway_revenue: number;
      room_service_count: number; room_service_revenue: number;
    }>(
      `SELECT
         COUNT(*)::int                                                   AS total_orders,
         COALESCE(SUM(total_amount), 0)::float                          AS gross_revenue,
         COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::float          AS total_discounts,
         COUNT(*) FILTER (WHERE order_type = 'dine-in')::int            AS dine_in_count,
         COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'dine-in'), 0)::float      AS dine_in_revenue,
         COUNT(*) FILTER (WHERE order_type = 'takeaway')::int           AS takeaway_count,
         COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'takeaway'), 0)::float     AS takeaway_revenue,
         COUNT(*) FILTER (WHERE order_type = 'room-service')::int       AS room_service_count,
         COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'room-service'), 0)::float AS room_service_revenue
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [rid, from, to],
    ),

    pool.query<{ method: string; order_count: number; revenue: number }>(
      `SELECT
         COALESCE(payment_method, 'unpaid') AS method,
         COUNT(*)::int                       AS order_count,
         COALESCE(SUM(total_amount), 0)::float AS revenue
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY payment_method
       ORDER BY revenue DESC`,
      [rid, from, to],
    ),

    pool.query<{ name: string; quantity: number; revenue: number }>(
      `SELECT
         oi.name,
         SUM(oi.quantity)::int                                                          AS quantity,
         COALESCE(SUM((oi.price + COALESCE(t.topping_sum, 0)) * oi.quantity), 0)::float AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN (
         SELECT order_item_id, SUM(price)::float AS topping_sum
         FROM order_item_toppings GROUP BY order_item_id
       ) t ON t.order_item_id = oi.id
       WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3
       GROUP BY oi.name
       ORDER BY quantity DESC
       LIMIT 10`,
      [rid, from, to],
    ),

    pool.query<{ id: string; amount: number; reason: string; refund_method: string; created_by_name: string; created_at: string; order_id: string | null; session_id: string | null }>(
      `SELECT id, amount::float, reason, refund_method, created_by_name, created_at, order_id, session_id
       FROM refunds
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       ORDER BY created_at ASC`,
      [rid, from, to],
    ),

    pool.query<{ id: string; table_number: number; created_at: string; total: number }>(
      `SELECT ts.id, ts.table_number, ts.created_at,
              COALESCE(SUM(o.total_amount), 0)::float AS total
       FROM table_sessions ts
       LEFT JOIN orders o ON o.session_id = ts.id
       WHERE ts.restaurant_id = $1 AND ts.status = 'open'
         AND ts.merged_into_session_id IS NULL
       GROUP BY ts.id, ts.table_number, ts.created_at
       ORDER BY ts.created_at ASC`,
      [rid],
    ),
  ]);

  const s            = summaryRes.rows[0];
  const totalRefunds = refundsRes.rows.reduce((acc, r) => acc + r.amount, 0);
  const netRevenue   = s.gross_revenue - totalRefunds;

  res.json({
    date,
    generatedAt: new Date().toISOString(),
    summary: {
      grossRevenue:   s.gross_revenue,
      totalRefunds,
      netRevenue,
      totalDiscounts: s.total_discounts,
      orderCount:     s.total_orders,
      avgOrderValue:  s.total_orders > 0 ? s.gross_revenue / s.total_orders : 0,
      dineIn:    { count: s.dine_in_count,      revenue: s.dine_in_revenue },
      takeaway:  { count: s.takeaway_count,     revenue: s.takeaway_revenue },
      roomService: { count: s.room_service_count, revenue: s.room_service_revenue },
    },
    paymentMethods: paymentRes.rows.map((r) => ({
      method: r.method, count: r.order_count, revenue: r.revenue,
    })),
    topItems: itemsRes.rows.map((r) => ({
      name: r.name, quantity: r.quantity, revenue: r.revenue,
    })),
    refunds: refundsRes.rows.map((r) => ({
      id: r.id, amount: r.amount, reason: r.reason,
      method: r.refund_method, issuedBy: r.created_by_name,
      createdAt: r.created_at, orderId: r.order_id, sessionId: r.session_id,
    })),
    openSessions: openSessionsRes.rows.map((r) => ({
      id: r.id, tableNumber: r.table_number,
      openedAt: r.created_at, estimatedTotal: r.total,
    })),
  });
});

router.get('/staff', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to date params required (YYYY-MM-DD)' }); return; }

  const rid     = req.user!.restaurantId;
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso   = `${to}T23:59:59.999Z`;

  const [waiterRes, dailyRes] = await Promise.all([
    pool.query<{
      waiter_name: string; waiter_id: string | null;
      order_count: number; served_count: number;
      total_revenue: number; avg_order_value: number;
      avg_serve_mins: number;
    }>(
      `SELECT
         COALESCE(assigned_waiter_name, 'Unassigned') AS waiter_name,
         assigned_waiter_id                           AS waiter_id,
         COUNT(*)::int                                AS order_count,
         COUNT(*) FILTER (WHERE status = 'served')::int AS served_count,
         COALESCE(SUM(total_amount), 0)::float        AS total_revenue,
         COALESCE(AVG(total_amount), 0)::float        AS avg_order_value,
         COALESCE(
           AVG(
             EXTRACT(EPOCH FROM (served_at::timestamptz - created_at::timestamptz)) / 60.0
           ) FILTER (WHERE served_at IS NOT NULL),
           0
         )::float                                    AS avg_serve_mins
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY assigned_waiter_name, assigned_waiter_id
       ORDER BY total_revenue DESC`,
      [rid, fromIso, toIso],
    ),

    pool.query<{ date: string; waiter_name: string; order_count: number; revenue: number }>(
      `SELECT
         SUBSTRING(created_at, 1, 10)                           AS date,
         COALESCE(assigned_waiter_name, 'Unassigned')           AS waiter_name,
         COUNT(*)::int                                           AS order_count,
         COALESCE(SUM(total_amount), 0)::float                  AS revenue
       FROM orders
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
         AND assigned_waiter_name IS NOT NULL
       GROUP BY SUBSTRING(created_at, 1, 10), assigned_waiter_name
       ORDER BY date DESC, revenue DESC`,
      [rid, fromIso, toIso],
    ),
  ]);

  res.json({
    waiters: waiterRes.rows.map((r) => ({
      waiterId:      r.waiter_id,
      waiterName:    r.waiter_name,
      orderCount:    r.order_count,
      servedCount:   r.served_count,
      totalRevenue:  r.total_revenue,
      avgOrderValue: r.avg_order_value,
      avgServeMins:  r.avg_serve_mins,
    })),
    daily: dailyRes.rows.map((r) => ({
      date:       r.date,
      waiterName: r.waiter_name,
      orderCount: r.order_count,
      revenue:    r.revenue,
    })),
  });
});

export default router;
