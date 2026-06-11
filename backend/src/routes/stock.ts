import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const toItem = (row: Record<string, unknown>) => ({
  id:           row.id,
  restaurantId: row.restaurant_id,
  name:         row.name,
  unit:         row.unit,
  quantity:     Number(row.quantity),
  minThreshold: Number(row.min_threshold),
  costPerUnit:  Number(row.cost_per_unit),
  category:     row.category ?? null,
  createdAt:    row.created_at,
  updatedAt:    row.updated_at,
});

const toMovement = (row: Record<string, unknown>) => ({
  id:            row.id,
  stockItemId:   row.stock_item_id,
  restaurantId:  row.restaurant_id,
  type:          row.type,
  quantity:      Number(row.quantity),
  reason:        row.reason ?? null,
  notes:         row.notes ?? null,
  createdBy:     row.created_by ?? null,
  createdByName: row.created_by_name ?? null,
  createdAt:     row.created_at,
});

// ── List all stock items ────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_items WHERE restaurant_id = $1 ORDER BY name ASC',
      [req.user!.restaurantId],
    );
    res.json(rows.map(toItem));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stock items' });
  }
});

// ── Low-stock alert endpoint ────────────────────────────────────────────────
// Returns items where quantity ≤ min_threshold (and threshold is set > 0)
router.get('/low', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM stock_items
       WHERE restaurant_id = $1
         AND min_threshold > 0
         AND quantity <= min_threshold
       ORDER BY (quantity::float / min_threshold::float) ASC, name ASC`,
      [req.user!.restaurantId],
    );
    res.json(rows.map(toItem));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load low-stock items' });
  }
});

// ── Create stock item ───────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, unit = 'piece', quantity = 0, minThreshold = 0, costPerUnit = 0, category } = req.body as {
    name: string; unit?: string; quantity?: number; minThreshold?: number; costPerUnit?: number; category?: string;
  };
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const now = new Date().toISOString();
    const id  = uuid();
    const { rows } = await pool.query(
      `INSERT INTO stock_items (id, restaurant_id, name, unit, quantity, min_threshold, cost_per_unit, category, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,
      [id, req.user!.restaurantId, name.trim(), unit, quantity, minThreshold, costPerUnit, category ?? null, now],
    );
    res.status(201).json(toItem(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create stock item' });
  }
});

// ── Update stock item (name/unit/threshold/cost/category) ──────────────────
router.patch('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, unit, minThreshold, costPerUnit, category } = req.body as {
    name?: string; unit?: string; minThreshold?: number; costPerUnit?: number; category?: string;
  };
  try {
    const { rows } = await pool.query(
      `UPDATE stock_items SET
         name          = COALESCE($1, name),
         unit          = COALESCE($2, unit),
         min_threshold = COALESCE($3, min_threshold),
         cost_per_unit = COALESCE($4, cost_per_unit),
         category      = COALESCE($5, category),
         updated_at    = $6
       WHERE id = $7 AND restaurant_id = $8 RETURNING *`,
      [name?.trim() ?? null, unit ?? null, minThreshold ?? null, costPerUnit ?? null, category ?? null,
       new Date().toISOString(), req.params.id, req.user!.restaurantId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toItem(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update stock item' });
  }
});

// ── Delete stock item ───────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM stock_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stock item' });
  }
});

// ── Log a movement (IN or OUT) ─────────────────────────────────────────────
router.post('/:id/movements', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { type, quantity, reason, notes } = req.body as {
    type: 'in' | 'out'; quantity: number; reason?: string; notes?: string;
  };
  if (!['in', 'out'].includes(type)) return res.status(400).json({ error: 'type must be in or out' });
  if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check item belongs to this restaurant
    const itemRes = await client.query(
      'SELECT * FROM stock_items WHERE id = $1 AND restaurant_id = $2 FOR UPDATE',
      [req.params.id, req.user!.restaurantId],
    );
    if (!itemRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    const current = Number(itemRes.rows[0].quantity);
    const delta   = type === 'in' ? quantity : -quantity;
    const newQty  = current + delta;
    if (newQty < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient stock' }); }

    const now = new Date().toISOString();
    // Update item quantity
    await client.query(
      'UPDATE stock_items SET quantity = $1, updated_at = $2 WHERE id = $3',
      [newQty, now, req.params.id],
    );
    // Record movement
    const movId = uuid();
    const { rows: movRows } = await client.query(
      `INSERT INTO stock_movements (id, stock_item_id, restaurant_id, type, quantity, reason, notes, created_by, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [movId, req.params.id, req.user!.restaurantId, type, quantity, reason ?? null, notes ?? null,
       req.user!.id, req.user!.name ?? req.user!.username, now],
    );

    await client.query('COMMIT');

    // Return updated item + the new movement
    const updatedItem = await pool.query('SELECT * FROM stock_items WHERE id = $1', [req.params.id]);
    res.json({ item: toItem(updatedItem.rows[0]), movement: toMovement(movRows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to log movement' });
  } finally {
    client.release();
  }
});

// ── Stock report (date range, all items) ───────────────────────────────────
router.get('/report', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDay(from) || !isDay(to)) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
  }
  // Movement timestamps are ISO strings; bound the range inclusively.
  const fromTs = `${from}T00:00:00.000Z`;
  const toTs   = `${to}T23:59:59.999Z`;

  try {
    const rid = req.user!.restaurantId;

    // Current snapshot
    const itemsRes = await pool.query(
      'SELECT * FROM stock_items WHERE restaurant_id = $1 ORDER BY name ASC',
      [rid],
    );
    const items = itemsRes.rows.map(toItem);

    // Per-item movement totals within range
    const aggRes = await pool.query(
      `SELECT stock_item_id,
              SUM(CASE WHEN type = 'in'  THEN quantity ELSE 0 END) AS total_in,
              SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) AS total_out,
              COUNT(*) AS movement_count
       FROM stock_movements
       WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY stock_item_id`,
      [rid, fromTs, toTs],
    );
    const aggByItem: Record<string, { totalIn: number; totalOut: number; movementCount: number }> = {};
    for (const r of aggRes.rows) {
      aggByItem[r.stock_item_id as string] = {
        totalIn:  Number(r.total_in),
        totalOut: Number(r.total_out),
        movementCount: Number(r.movement_count),
      };
    }

    // Build per-item rows joined with current item data
    const itemRows = items.map((it) => {
      const agg = aggByItem[it.id as string] ?? { totalIn: 0, totalOut: 0, movementCount: 0 };
      const isLow = it.minThreshold > 0 && it.quantity <= it.minThreshold;
      return {
        id: it.id,
        name: it.name,
        unit: it.unit,
        category: it.category,
        quantity: it.quantity,
        minThreshold: it.minThreshold,
        costPerUnit: it.costPerUnit,
        stockValue: it.quantity * it.costPerUnit,
        totalIn: agg.totalIn,
        totalOut: agg.totalOut,
        movementCount: agg.movementCount,
        isLow,
        isOut: it.quantity === 0,
      };
    });

    // Recent movements within range (capped)
    const movRes = await pool.query(
      `SELECT m.*, s.name AS item_name, s.unit AS item_unit
       FROM stock_movements m
       JOIN stock_items s ON s.id = m.stock_item_id
       WHERE m.restaurant_id = $1 AND m.created_at >= $2 AND m.created_at <= $3
       ORDER BY m.created_at DESC
       LIMIT 200`,
      [rid, fromTs, toTs],
    );
    const movements = movRes.rows.map((row) => ({
      ...toMovement(row),
      itemName: row.item_name,
      itemUnit: row.item_unit,
    }));

    // Summary
    const summary = {
      totalItems:      items.length,
      lowStockItems:   itemRows.filter((r) => r.isLow).length,
      outOfStockItems: itemRows.filter((r) => r.isOut).length,
      totalStockValue: itemRows.reduce((s, r) => s + r.stockValue, 0),
      totalIn:         itemRows.reduce((s, r) => s + r.totalIn, 0),
      totalOut:        itemRows.reduce((s, r) => s + r.totalOut, 0),
      totalMovements:  movements.length,
    };

    res.json({ from, to, summary, items: itemRows, movements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build stock report' });
  }
});

// ── Movement history for an item ───────────────────────────────────────────
router.get('/:id/movements', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM stock_movements WHERE stock_item_id = $1 AND restaurant_id = $2 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id, req.user!.restaurantId],
    );
    res.json(rows.map(toMovement));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load movements' });
  }
});

export default router;
