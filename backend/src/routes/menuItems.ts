import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const ITEMS_WITH_TOPPINGS_SQL = `
  SELECT mi.*,
    COALESCE(
      json_agg(
        json_build_object('id', t.id, 'name', t.name, 'price', t.price::float, 'available', t.available)
        ORDER BY t.name
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'::json
    ) AS toppings
  FROM menu_items mi
  LEFT JOIN menu_item_toppings t ON t.menu_item_id = mi.id
`;

const toItem = (row: Record<string, unknown>) => ({
  id:               row.id,
  name:             row.name,
  description:      row.description,
  price:            Number(row.price),
  discountPct:      Number(row.discount_pct ?? 0),
  largePrice:       row.large_price != null ? Number(row.large_price) : undefined,
  largeDiscountPct: Number(row.large_discount_pct ?? 0),
  category:         row.category_id,
  image:            row.image ?? undefined,
  available:        row.available === true,
  toppings:         (row.toppings as { id: string; name: string; price: number; available: boolean }[] | null) ?? [],
});

router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId = (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }
  const { categoryId } = req.query as { categoryId?: string };
  const result = categoryId
    ? await pool.query(
        `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.restaurant_id = $1 AND mi.category_id = $2 GROUP BY mi.id ORDER BY mi.name`,
        [restaurantId, categoryId],
      )
    : await pool.query(
        `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.restaurant_id = $1 GROUP BY mi.id ORDER BY mi.name`,
        [restaurantId],
      );
  res.json((result.rows as Record<string, unknown>[]).map(toItem));
});

router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name, description = '', price, discountPct = 0, largePrice, largeDiscountPct = 0, category, image, available = true } =
    req.body as { name: string; description?: string; price: number; discountPct?: number; largePrice?: number; largeDiscountPct?: number; category: string; image?: string; available?: boolean };
  if (!name || !category) { res.status(400).json({ error: 'name and category are required' }); return; }
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const safeLargePrice = largePrice != null && Number(largePrice) > 0 ? Number(largePrice) : null;
  const safeLargeDiscount = Math.min(100, Math.max(0, Number(largeDiscountPct) || 0));
  const id = uuid();
  await pool.query(
    `INSERT INTO menu_items (id, restaurant_id, name, description, price, discount_pct, large_price, large_discount_pct, category_id, image, available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, req.user!.restaurantId, name, description, price, safeDiscount, safeLargePrice, safeLargeDiscount, category, image ?? null, available],
  );
  res.status(201).json(toItem({ id, name, description, price, discount_pct: safeDiscount, large_price: safeLargePrice, large_discount_pct: safeLargeDiscount, category_id: category, image, available, toppings: [] }));
});

router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  const { name, description, price, discountPct, largePrice, largeDiscountPct, category, image, available } =
    req.body as { name?: string; description?: string; price?: number; discountPct?: number; largePrice?: number | null; largeDiscountPct?: number; category?: string; image?: string; available?: boolean };
  const safeDiscount = discountPct !== undefined ? Math.min(100, Math.max(0, Number(discountPct) || 0)) : Number(row.discount_pct ?? 0);
  const safeLargePrice = largePrice !== undefined
    ? (largePrice != null && Number(largePrice) > 0 ? Number(largePrice) : null)
    : (row.large_price != null ? Number(row.large_price) : null);
  const safeLargeDiscount = largeDiscountPct !== undefined ? Math.min(100, Math.max(0, Number(largeDiscountPct) || 0)) : Number(row.large_discount_pct ?? 0);
  await pool.query(
    `UPDATE menu_items SET name=$1, description=$2, price=$3, discount_pct=$4, large_price=$5, large_discount_pct=$6, category_id=$7, image=$8, available=$9 WHERE id=$10`,
    [name ?? row.name, description ?? row.description, price ?? row.price, safeDiscount, safeLargePrice, safeLargeDiscount,
     category ?? row.category_id, image !== undefined ? (image || null) : row.image,
     available !== undefined ? available : row.available, req.params.id],
  );
  const updated = await pool.query(
    `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.id = $1 GROUP BY mi.id`,
    [req.params.id],
  );
  res.json(toItem(updated.rows[0] as Record<string, unknown>));
});

// ── Availability toggle (admin + kitchen) ─────────────────────────────────────
router.patch('/:id/availability', authenticate, requireRole('admin', 'kitchen'), async (req: AuthRequest, res) => {
  const { available } = req.body as { available: boolean };
  if (typeof available !== 'boolean') { res.status(400).json({ error: 'available (boolean) is required' }); return; }
  const result = await pool.query(
    'UPDATE menu_items SET available = $1 WHERE id = $2 AND restaurant_id = $3 RETURNING id, name, available',
    [available, req.params.id, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const row = result.rows[0] as { id: string; name: string; available: boolean };
  res.json({ id: row.id, name: row.name, available: row.available });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

// ── Topping CRUD ──────────────────────────────────────────────────────────────

router.get('/:itemId/toppings', optionalAuthenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM menu_item_toppings WHERE menu_item_id = $1 ORDER BY name',
    [req.params.itemId],
  );
  res.json(result.rows.map((r: Record<string, unknown>) => ({
    id: r.id, name: r.name, price: Number(r.price), available: r.available,
  })));
});

router.post('/:itemId/toppings', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name, price = 0, available = true } = req.body as { name: string; price?: number; available?: boolean };
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  // Verify item belongs to this restaurant
  const item = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.itemId, req.user!.restaurantId]);
  if (!item.rows.length) { res.status(404).json({ error: 'Menu item not found' }); return; }
  const id = uuid();
  await pool.query(
    'INSERT INTO menu_item_toppings (id, menu_item_id, name, price, available) VALUES ($1,$2,$3,$4,$5)',
    [id, req.params.itemId, name.trim(), Math.max(0, Number(price) || 0), available],
  );
  res.status(201).json({ id, name: name.trim(), price: Math.max(0, Number(price) || 0), available });
});

router.patch('/:itemId/toppings/:toppingId', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name, price, available } = req.body as { name?: string; price?: number; available?: boolean };
  const existing = await pool.query(
    `SELECT t.* FROM menu_item_toppings t
     JOIN menu_items mi ON mi.id = t.menu_item_id
     WHERE t.id = $1 AND mi.restaurant_id = $2`,
    [req.params.toppingId, req.user!.restaurantId],
  );
  if (!existing.rows.length) { res.status(404).json({ error: 'Topping not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  await pool.query(
    'UPDATE menu_item_toppings SET name=$1, price=$2, available=$3 WHERE id=$4',
    [
      name?.trim() ?? row.name,
      price !== undefined ? Math.max(0, Number(price) || 0) : Number(row.price),
      available !== undefined ? available : row.available,
      req.params.toppingId,
    ],
  );
  const updated = await pool.query('SELECT * FROM menu_item_toppings WHERE id = $1', [req.params.toppingId]);
  const r = updated.rows[0] as Record<string, unknown>;
  res.json({ id: r.id, name: r.name, price: Number(r.price), available: r.available });
});

router.delete('/:itemId/toppings/:toppingId', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query(
    `DELETE FROM menu_item_toppings t USING menu_items mi
     WHERE t.id = $1 AND t.menu_item_id = mi.id AND mi.restaurant_id = $2`,
    [req.params.toppingId, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
