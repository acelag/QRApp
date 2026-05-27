import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

interface ComboRow {
  id: string; restaurant_id: string; name: string; description: string | null;
  price: string; image: string | null; active: boolean;
  sort_order: number; created_at: string;
}
interface ComboItemRow {
  id: string; combo_id: string; menu_item_id: string;
  menu_item_name: string; quantity: number; sort_order: number;
}

function toCombo(row: ComboRow, items: ComboItemRow[]) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description ?? null,
    price: Number(row.price),
    image: row.image ?? null,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    items: items
      .filter((i) => i.combo_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        id: i.id,
        menuItemId: i.menu_item_id,
        menuItemName: i.menu_item_name,
        quantity: i.quantity,
        sortOrder: i.sort_order,
      })),
  };
}

async function fetchComboWithItems(comboId: string) {
  const [comboRes, itemsRes] = await Promise.all([
    pool.query('SELECT * FROM combos WHERE id = $1', [comboId]),
    pool.query(
      `SELECT ci.*, COALESCE(mi.name, '') AS menu_item_name
       FROM combo_items ci
       LEFT JOIN menu_items mi ON mi.id = ci.menu_item_id
       WHERE ci.combo_id = $1
       ORDER BY ci.sort_order`,
      [comboId],
    ),
  ]);
  if (!comboRes.rows.length) return null;
  return toCombo(comboRes.rows[0] as ComboRow, itemsRes.rows as ComboItemRow[]);
}

// GET /api/combos?restaurantId=...  — public
router.get('/', optionalAuthenticate, async (req: AuthRequest, res) => {
  const rid = req.user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!rid) { res.status(400).json({ error: 'restaurantId required' }); return; }

  const combosRes = await pool.query(
    'SELECT * FROM combos WHERE restaurant_id = $1 ORDER BY sort_order, name',
    [rid],
  );
  const combos = combosRes.rows as ComboRow[];
  if (combos.length === 0) { res.json([]); return; }

  const comboIds = combos.map((c) => c.id);
  const itemsRes = await pool.query(
    `SELECT ci.*, COALESCE(mi.name, '') AS menu_item_name
     FROM combo_items ci
     LEFT JOIN menu_items mi ON mi.id = ci.menu_item_id
     WHERE ci.combo_id = ANY($1)
     ORDER BY ci.combo_id, ci.sort_order`,
    [comboIds],
  );
  const allItems = itemsRes.rows as ComboItemRow[];

  res.json(combos.map((c) => toCombo(c, allItems)));
});

// POST /api/combos
router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  if (!rid) { res.status(403).json({ error: 'No restaurant context' }); return; }

  const { name, description, price, image, active = true, sortOrder = 0, items = [] } = req.body as {
    name: string; description?: string; price: number; image?: string;
    active?: boolean; sortOrder?: number;
    items?: { menuItemId: string; quantity: number }[];
  };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  if (!price || Number(price) <= 0) { res.status(400).json({ error: 'price must be positive' }); return; }

  const id = uuid();
  const now = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO combos (id,restaurant_id,name,description,price,image,active,sort_order,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, rid, name.trim(), description?.trim() || null, price, image?.trim() || null, active, sortOrder, now],
    );
    for (let i = 0; i < items.length; i++) {
      await client.query(
        'INSERT INTO combo_items (id,combo_id,menu_item_id,quantity,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [uuid(), id, items[i].menuItemId, items[i].quantity ?? 1, i],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const built = await fetchComboWithItems(id);
  res.status(201).json(built);
});

// PUT /api/combos/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  if (!rid) { res.status(403).json({ error: 'No restaurant context' }); return; }

  const { name, description, price, image, active = true, sortOrder = 0, items = [] } = req.body as {
    name: string; description?: string; price: number; image?: string;
    active?: boolean; sortOrder?: number;
    items?: { menuItemId: string; quantity: number }[];
  };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE combos SET name=$1,description=$2,price=$3,image=$4,active=$5,sort_order=$6
       WHERE id=$7 AND restaurant_id=$8`,
      [name.trim(), description?.trim() || null, price, image?.trim() || null, active, sortOrder, req.params.id, rid],
    );
    if ((result.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Not found' }); return;
    }
    await client.query('DELETE FROM combo_items WHERE combo_id = $1', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        'INSERT INTO combo_items (id,combo_id,menu_item_id,quantity,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [uuid(), req.params.id, items[i].menuItemId, items[i].quantity ?? 1, i],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const built = await fetchComboWithItems(req.params.id as string);
  res.json(built);
});

// PATCH /api/combos/:id/active
router.patch('/:id/active', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  if (!rid) { res.status(403).json({ error: 'No restaurant context' }); return; }
  const { active } = req.body as { active: boolean };
  const result = await pool.query(
    'UPDATE combos SET active=$1 WHERE id=$2 AND restaurant_id=$3',
    [active, req.params.id, rid],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const built = await fetchComboWithItems(req.params.id as string);
  res.json(built);
});

// DELETE /api/combos/:id
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const rid = req.user!.restaurantId;
  if (!rid) { res.status(403).json({ error: 'No restaurant context' }); return; }
  const result = await pool.query(
    'DELETE FROM combos WHERE id=$1 AND restaurant_id=$2',
    [req.params.id, rid],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

export default router;
