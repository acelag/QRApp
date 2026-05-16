import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const toItem = (row: Record<string, unknown>) => ({
  id:          row.id,
  name:        row.name,
  description: row.description,
  price:       Number(row.price),
  discountPct: Number(row.discount_pct ?? 0),
  category:    row.category_id,
  image:       row.image ?? undefined,
  available:   row.available === true,
});

router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId = (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }
  const { categoryId } = req.query as { categoryId?: string };
  const result = categoryId
    ? await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1 AND category_id = $2 ORDER BY name', [restaurantId, categoryId])
    : await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY name', [restaurantId]);
  res.json((result.rows as Record<string, unknown>[]).map(toItem));
});

router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name, description = '', price, discountPct = 0, category, image, available = true } =
    req.body as { name: string; description?: string; price: number; discountPct?: number; category: string; image?: string; available?: boolean };
  if (!name || !category) { res.status(400).json({ error: 'name and category are required' }); return; }
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const id = uuid();
  await pool.query(
    `INSERT INTO menu_items (id, restaurant_id, name, description, price, discount_pct, category_id, image, available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, req.user!.restaurantId, name, description, price, safeDiscount, category, image ?? null, available],
  );
  res.status(201).json(toItem({ id, name, description, price, discount_pct: safeDiscount, category_id: category, image, available }));
});

router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  const { name, description, price, discountPct, category, image, available } =
    req.body as { name?: string; description?: string; price?: number; discountPct?: number; category?: string; image?: string; available?: boolean };
  const safeDiscount = discountPct !== undefined ? Math.min(100, Math.max(0, Number(discountPct) || 0)) : Number(row.discount_pct ?? 0);
  await pool.query(
    `UPDATE menu_items SET name=$1, description=$2, price=$3, discount_pct=$4, category_id=$5, image=$6, available=$7 WHERE id=$8`,
    [name ?? row.name, description ?? row.description, price ?? row.price, safeDiscount,
     category ?? row.category_id, image !== undefined ? (image || null) : row.image,
     available !== undefined ? available : row.available, req.params.id],
  );
  const updated = await pool.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
  res.json(toItem(updated.rows[0] as Record<string, unknown>));
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
