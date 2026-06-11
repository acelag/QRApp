import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = ''; i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        cols.push(val);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { cols.push(line.slice(i).trim()); break; }
        cols.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    return cols;
  };
  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const vals = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    return row;
  });
}

const csvEscape = (v: unknown): string => {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const router = Router();

const ITEMS_WITH_TOPPINGS_SQL = `
  SELECT mi.*,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'price', t.price::float, 'available', t.available)
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
  trackStock:       row.track_stock === true,
  stock:            row.stock != null ? Number(row.stock) : null,
  sortOrder:        Number(row.sort_order ?? 0),
  tags:             (() => { try { return JSON.parse((row.tags as string | null) ?? '[]') as string[]; } catch { return []; } })(),
  toppings:         (row.toppings as { id: string; name: string; price: number; available: boolean }[] | null) ?? [],
  prepTimeMins:     row.prep_time_mins != null ? Number(row.prep_time_mins) : null,
  scheduleId:       (row.schedule_id as string | null) ?? null,
});


// ── Export ────────────────────────────────────────────────────────────────────
router.get('/export', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const result = await pool.query(
    `SELECT mi.name, mi.description, mi.price, c.name AS category_name,
            mi.available, mi.discount_pct, mi.large_price, mi.large_discount_pct,
            mi.track_stock, mi.stock
     FROM menu_items mi
     JOIN categories c ON c.id = mi.category_id
     WHERE mi.restaurant_id = $1
     ORDER BY c.name, mi.name`,
    [rid],
  );
  const headers = ['name', 'description', 'price', 'category', 'available', 'discount_pct', 'large_price', 'large_discount_pct', 'track_stock', 'stock'];
  const rows = (result.rows as Record<string, unknown>[]).map((r) =>
    [r.name, r.description, r.price, r.category_name, r.available,
     r.discount_pct ?? 0, r.large_price ?? '', r.large_discount_pct ?? 0,
     r.track_stock, r.stock ?? ''].map(csvEscape).join(','),
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="menu.csv"');
  res.send([headers.join(','), ...rows].join('\n'));
});

// ── Import ────────────────────────────────────────────────────────────────────
router.post('/import', authenticate, requireRole('admin', 'manager'), memUpload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ error: 'CSV file required' }); return; }
  const rows = parseCSV(req.file.buffer.toString('utf-8'));
  if (!rows.length) { res.status(400).json({ error: 'No data rows found in CSV' }); return; }

  const rid = req.user!.restaurantId;
  let created = 0, updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const name = row.name?.trim();
      const categoryName = row.category?.trim();
      const price = parseFloat(row.price ?? '');
      if (!name)                        { errors.push({ row: rowNum, message: 'name is required' }); continue; }
      if (!categoryName)                { errors.push({ row: rowNum, message: 'category is required' }); continue; }
      if (isNaN(price) || price < 0)   { errors.push({ row: rowNum, message: `invalid price "${row.price}"` }); continue; }

      // Look up or create category
      const catRes = await pool.query(
        'SELECT id FROM categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)', [rid, categoryName]);
      let categoryId: string;
      if (catRes.rows.length) {
        categoryId = (catRes.rows[0] as Record<string, unknown>).id as string;
      } else {
        categoryId = uuid();
        await pool.query('INSERT INTO categories (id,restaurant_id,name) VALUES ($1,$2,$3)', [categoryId, rid, categoryName]);
      }

      const available     = row.available?.toLowerCase() !== 'false';
      const discountPct   = Math.min(100, Math.max(0, parseFloat(row.discount_pct ?? '0') || 0));
      const largePriceRaw = parseFloat(row.large_price ?? '');
      const largePrice    = !isNaN(largePriceRaw) && largePriceRaw > 0 ? largePriceRaw : null;
      const largeDiscPct  = Math.min(100, Math.max(0, parseFloat(row.large_discount_pct ?? '0') || 0));
      const trackStock    = row.track_stock?.toLowerCase() === 'true';
      const stockRaw      = parseInt(row.stock ?? '', 10);
      const stock         = trackStock && !isNaN(stockRaw) ? Math.max(0, stockRaw) : null;
      const description   = row.description?.trim() ?? '';

      const existing = await pool.query(
        'SELECT id FROM menu_items WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)', [rid, name]);
      if (existing.rows.length) {
        await pool.query(
          `UPDATE menu_items SET description=$1,price=$2,discount_pct=$3,large_price=$4,large_discount_pct=$5,
           category_id=$6,available=$7,track_stock=$8,stock=$9 WHERE id=$10`,
          [description, price, discountPct, largePrice, largeDiscPct, categoryId, available, trackStock, stock,
           (existing.rows[0] as Record<string, unknown>).id],
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO menu_items (id,restaurant_id,name,description,price,discount_pct,large_price,large_discount_pct,category_id,image,available,track_stock,stock)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,$11,$12)`,
          [uuid(), rid, name, description, price, discountPct, largePrice, largeDiscPct, categoryId, available, trackStock, stock],
        );
        created++;
      }
    } catch (err) {
      errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  res.json({ created, updated, errors });
});

router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId = (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }
  const { categoryId } = req.query as { categoryId?: string };
  const result = categoryId
    ? await pool.query(
        `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.restaurant_id = $1 AND mi.category_id = $2 GROUP BY mi.id ORDER BY mi.sort_order ASC, mi.name ASC`,
        [restaurantId, categoryId],
      )
    : await pool.query(
        `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.restaurant_id = $1 GROUP BY mi.id ORDER BY mi.sort_order ASC, mi.name ASC`,
        [restaurantId],
      );
  res.json((result.rows as Record<string, unknown>[]).map(toItem));
});

// ── Bulk reorder ──────────────────────────────────────────────────────────────
router.patch('/reorder', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { items } = req.body as { items: { id: string; sortOrder: number }[] };
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: 'items array required' }); return; }
  const rid = req.user!.restaurantId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, sortOrder } of items) {
      await client.query(
        'UPDATE menu_items SET sort_order = $1 WHERE id = $2 AND restaurant_id = $3',
        [sortOrder, id, rid],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

// ── Bulk availability toggle ──────────────────────────────────────────────────
router.patch('/bulk-availability', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { categoryId, available } = req.body as { categoryId: string; available: boolean };
  if (!categoryId || typeof available !== 'boolean') {
    res.status(400).json({ error: 'categoryId and available (boolean) are required' }); return;
  }
  const rid = req.user!.restaurantId;
  const result = await pool.query(
    'UPDATE menu_items SET available = $1 WHERE restaurant_id = $2 AND category_id = $3 RETURNING id, available',
    [available, rid, categoryId],
  );
  res.json({ updated: result.rowCount ?? 0, available });
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, description = '', price, discountPct = 0, largePrice, largeDiscountPct = 0, category, image, available = true, trackStock = false, stock, tags, prepTimeMins, scheduleId } =
    req.body as { name: string; description?: string; price: number; discountPct?: number; largePrice?: number; largeDiscountPct?: number; category: string; image?: string; available?: boolean; trackStock?: boolean; stock?: number | null; tags?: string[]; prepTimeMins?: number | null; scheduleId?: string | null };
  if (!name || !category) { res.status(400).json({ error: 'name and category are required' }); return; }
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const safeLargePrice = largePrice != null && Number(largePrice) > 0 ? Number(largePrice) : null;
  const safeLargeDiscount = Math.min(100, Math.max(0, Number(largeDiscountPct) || 0));
  const safeStock = trackStock && stock != null ? Math.max(0, Math.round(Number(stock))) : null;
  const safeTags = JSON.stringify(Array.isArray(tags) ? tags : []);
  const safePrepTime = prepTimeMins != null && Number(prepTimeMins) > 0 ? Math.round(Number(prepTimeMins)) : null;
  // Place new item at the end of its category
  const seqRes = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM menu_items WHERE restaurant_id = $1 AND category_id = $2',
    [req.user!.restaurantId, category],
  );
  const nextOrder = Number((seqRes.rows[0] as Record<string, unknown>).next_order ?? 0);
  const id = uuid();
  await pool.query(
    `INSERT INTO menu_items (id, restaurant_id, name, description, price, discount_pct, large_price, large_discount_pct, category_id, image, available, track_stock, stock, sort_order, tags, prep_time_mins, schedule_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, req.user!.restaurantId, name, description, price, safeDiscount, safeLargePrice, safeLargeDiscount, category, image ?? null, available, trackStock, safeStock, nextOrder, safeTags, safePrepTime, scheduleId ?? null],
  );
  const created = await pool.query(`${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.id = $1 GROUP BY mi.id`, [id]);
  res.status(201).json(toItem(created.rows[0] as Record<string, unknown>));
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  const { name, description, price, discountPct, largePrice, largeDiscountPct, category, image, available, trackStock, stock, tags, prepTimeMins, scheduleId } =
    req.body as { name?: string; description?: string; price?: number; discountPct?: number; largePrice?: number | null; largeDiscountPct?: number; category?: string; image?: string; available?: boolean; trackStock?: boolean; stock?: number | null; tags?: string[]; prepTimeMins?: number | null; scheduleId?: string | null };
  const safeDiscount = discountPct !== undefined ? Math.min(100, Math.max(0, Number(discountPct) || 0)) : Number(row.discount_pct ?? 0);
  const safeLargePrice = largePrice !== undefined
    ? (largePrice != null && Number(largePrice) > 0 ? Number(largePrice) : null)
    : (row.large_price != null ? Number(row.large_price) : null);
  const safeLargeDiscount = largeDiscountPct !== undefined ? Math.min(100, Math.max(0, Number(largeDiscountPct) || 0)) : Number(row.large_discount_pct ?? 0);
  const safeTrackStock = trackStock !== undefined ? trackStock : row.track_stock === true;
  const safeStock = safeTrackStock && stock !== undefined
    ? (stock != null ? Math.max(0, Math.round(Number(stock))) : null)
    : (row.stock != null ? Number(row.stock) : null);
  const safeTags = tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : (row.tags as string | null) ?? '[]';
  const safePrepTime = prepTimeMins !== undefined
    ? (prepTimeMins != null && Number(prepTimeMins) > 0 ? Math.round(Number(prepTimeMins)) : null)
    : (row.prep_time_mins != null ? Number(row.prep_time_mins) : null);
  const safeScheduleId = scheduleId !== undefined ? (scheduleId || null) : (row.schedule_id as string | null) ?? null;
  await pool.query(
    `UPDATE menu_items SET name=$1, description=$2, price=$3, discount_pct=$4, large_price=$5, large_discount_pct=$6, category_id=$7, image=$8, available=$9, track_stock=$10, stock=$11, tags=$12, prep_time_mins=$13, schedule_id=$14 WHERE id=$15`,
    [name ?? row.name, description ?? row.description, price ?? row.price, safeDiscount, safeLargePrice, safeLargeDiscount,
     category ?? row.category_id, image !== undefined ? (image || null) : row.image,
     available !== undefined ? available : row.available, safeTrackStock, safeStock, safeTags, safePrepTime, safeScheduleId, req.params.id],
  );
  const updated = await pool.query(
    `${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.id = $1 GROUP BY mi.id`,
    [req.params.id],
  );
  res.json(toItem(updated.rows[0] as Record<string, unknown>));
});

// ── Availability toggle (admin + kitchen) ─────────────────────────────────────
router.patch('/:id/availability', authenticate, requireRole('admin', 'manager', 'kitchen'), async (req: AuthRequest, res) => {
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

// ── Quick stock update ────────────────────────────────────────────────────────
router.patch('/:id/stock', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { stock } = req.body as { stock: number | null };
  const safeStock = stock != null ? Math.max(0, Math.round(Number(stock))) : null;
  // Re-enable availability if restocking
  const availableUpdate = safeStock != null && safeStock > 0
    ? ', available = true'
    : '';
  const result = await pool.query(
    `UPDATE menu_items SET stock = $1${availableUpdate} WHERE id = $2 AND restaurant_id = $3`,
    [safeStock, req.params.id, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await pool.query(`${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.id = $1 GROUP BY mi.id`, [req.params.id]);
  res.json(toItem(updated.rows[0] as Record<string, unknown>));
});

router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

// ── Duplicate item ────────────────────────────────────────────────────────────
router.post('/:id/duplicate', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const src = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, rid]);
  if (!src.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const s = src.rows[0] as Record<string, unknown>;

  // Place copy at end of same category
  const seqRes = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM menu_items WHERE restaurant_id = $1 AND category_id = $2',
    [rid, s.category_id],
  );
  const nextOrder = Number((seqRes.rows[0] as Record<string, unknown>).next_order ?? 0);

  const newId = uuid();
  await pool.query(
    `INSERT INTO menu_items
       (id, restaurant_id, name, description, price, discount_pct, large_price, large_discount_pct,
        category_id, image, available, track_stock, stock, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      newId, rid,
      `${s.name} (Copy)`,
      s.description, s.price, s.discount_pct, s.large_price, s.large_discount_pct,
      s.category_id, s.image, s.available, s.track_stock,
      s.track_stock ? s.stock : null,
      nextOrder,
    ],
  );

  // Copy toppings
  const toppings = await pool.query('SELECT * FROM menu_item_toppings WHERE menu_item_id = $1', [req.params.id]);
  for (const t of toppings.rows as Record<string, unknown>[]) {
    await pool.query(
      'INSERT INTO menu_item_toppings (id, menu_item_id, name, price, available) VALUES ($1,$2,$3,$4,$5)',
      [uuid(), newId, t.name, t.price, t.available],
    );
  }

  const created = await pool.query(`${ITEMS_WITH_TOPPINGS_SQL} WHERE mi.id = $1 GROUP BY mi.id`, [newId]);
  res.status(201).json(toItem(created.rows[0] as Record<string, unknown>));
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

router.post('/:itemId/toppings', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
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

router.patch('/:itemId/toppings/:toppingId', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
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

router.delete('/:itemId/toppings/:toppingId', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query(
    `DELETE FROM menu_item_toppings t USING menu_items mi
     WHERE t.id = $1 AND t.menu_item_id = mi.id AND mi.restaurant_id = $2`,
    [req.params.toppingId, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

// ── Recipe (ingredient mapping) ───────────────────────────────────────────────
const RECIPE_SQL = `
  SELECT mii.id, mii.stock_item_id, mii.quantity, si.name, si.unit, si.cost_per_unit
  FROM menu_item_ingredients mii
  JOIN stock_items si ON si.id = mii.stock_item_id
  WHERE mii.menu_item_id = $1
  ORDER BY si.name`;

const toRecipeRow = (r: Record<string, unknown>) => ({
  id: r.id,
  stockItemId: r.stock_item_id,
  stockItemName: r.name,
  unit: r.unit,
  quantity: Number(r.quantity),
  costPerUnit: Number(r.cost_per_unit),
});

router.get('/:id/recipe', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const item = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, rid]);
  if (!item.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const result = await pool.query(RECIPE_SQL, [req.params.id]);
  res.json(result.rows.map(toRecipeRow));
});

router.put('/:id/recipe', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  const item = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, rid]);
  if (!item.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const { ingredients } = req.body as { ingredients: { stockItemId: string; quantity: number }[] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [req.params.id]);
    for (const ing of (ingredients ?? [])) {
      if (!ing.stockItemId || !ing.quantity || ing.quantity <= 0) continue;
      await client.query(
        'INSERT INTO menu_item_ingredients (id, menu_item_id, stock_item_id, quantity) VALUES ($1, $2, $3, $4)',
        [uuid(), req.params.id, ing.stockItemId, ing.quantity],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const result = await pool.query(RECIPE_SQL, [req.params.id]);
  res.json(result.rows.map(toRecipeRow));
});

export default router;
