import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to date params required (YYYY-MM-DD)' }); return; }

  const rid = req.user!.restaurantId;
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso   = `${to}T23:59:59.999Z`;

  const [summaryRes, dailyRes, itemsRes, categoriesRes, toppingsRes, heatmapRes] = await Promise.all([
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
    }>(
      `SELECT
         COALESCE(assigned_waiter_name, 'Unassigned') AS waiter_name,
         assigned_waiter_id                           AS waiter_id,
         COUNT(*)::int                                AS order_count,
         COUNT(*) FILTER (WHERE status = 'served')::int AS served_count,
         COALESCE(SUM(total_amount), 0)::float        AS total_revenue,
         COALESCE(AVG(total_amount), 0)::float        AS avg_order_value
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
