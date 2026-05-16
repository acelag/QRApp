import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

function toItem(row: Record<string, unknown>) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    price:       Number(row.price),
    discountPct: Number(row.discount_pct ?? 0),
    category:    row.category_id,
    image:       row.image ?? undefined,
    available:   row.available === true || row.available === 1,
  };
}

// GET — public (customer) or admin; always scoped to restaurant
router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId =
    (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }

  const { categoryId } = req.query as { categoryId?: string };
  const request = pool.request().input('rid', sql.NVarChar, restaurantId);
  const query = categoryId
    ? (request.input('cid', sql.NVarChar, categoryId),
       'SELECT * FROM menu_items WHERE restaurant_id = @rid AND category_id = @cid ORDER BY name')
    : 'SELECT * FROM menu_items WHERE restaurant_id = @rid ORDER BY name';

  const result = await request.query(query);
  res.json((result.recordset as Record<string, unknown>[]).map(toItem));
});

// POST — admin only
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name, description = '', price, discountPct = 0, category, image, available = true } =
    req.body as { name: string; description?: string; price: number; discountPct?: number; category: string; image?: string; available?: boolean };
  if (!name || !category) { res.status(400).json({ error: 'name and category are required' }); return; }
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const id = uuid();
  await pool.request()
    .input('id',          sql.NVarChar,      id)
    .input('rid',         sql.NVarChar,      req.user!.restaurantId)
    .input('name',        sql.NVarChar,      name)
    .input('desc',        sql.NVarChar,      description)
    .input('price',       sql.Decimal(10,2), price)
    .input('discountPct', sql.Decimal(5,2),  safeDiscount)
    .input('categoryId',  sql.NVarChar,      category)
    .input('image',       sql.NVarChar,      image ?? null)
    .input('available',   sql.Bit,           available ? 1 : 0)
    .query(`
      INSERT INTO menu_items (id, restaurant_id, name, description, price, discount_pct, category_id, image, available)
      VALUES (@id, @rid, @name, @desc, @price, @discountPct, @categoryId, @image, @available)
    `);
  res.status(201).json(toItem({ id, name, description, price, discount_pct: safeDiscount, category_id: category, image, available: available ? 1 : 0 }));
});

// PUT — admin only, own restaurant
router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const existing = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('SELECT * FROM menu_items WHERE id = @id AND restaurant_id = @rid');
  if (!existing.recordset.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.recordset[0] as Record<string, unknown>;

  const { name, description, price, discountPct, category, image, available } =
    req.body as { name?: string; description?: string; price?: number; discountPct?: number; category?: string; image?: string; available?: boolean };

  const safeDiscount = discountPct !== undefined
    ? Math.min(100, Math.max(0, Number(discountPct) || 0))
    : Number(row.discount_pct ?? 0);

  await pool.request()
    .input('id',          sql.NVarChar,      req.params.id)
    .input('name',        sql.NVarChar,      name        ?? row.name)
    .input('desc',        sql.NVarChar,      description ?? row.description)
    .input('price',       sql.Decimal(10,2), price       ?? row.price)
    .input('discountPct', sql.Decimal(5,2),  safeDiscount)
    .input('categoryId',  sql.NVarChar,      category    ?? row.category_id)
    .input('image',       sql.NVarChar,      image !== undefined ? (image || null) : row.image)
    .input('available',   sql.Bit,           available !== undefined ? (available ? 1 : 0) : row.available)
    .query(`
      UPDATE menu_items
      SET name=@name, description=@desc, price=@price, discount_pct=@discountPct,
          category_id=@categoryId, image=@image, available=@available
      WHERE id=@id
    `);

  const updated = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT * FROM menu_items WHERE id = @id');
  res.json(toItem(updated.recordset[0] as Record<string, unknown>));
});

// DELETE — admin only, own restaurant
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('DELETE FROM menu_items WHERE id = @id AND restaurant_id = @rid');
  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
