import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function rowToSchedule(row: Record<string, unknown>) {
  return {
    id:        row.id as string,
    name:      row.name as string,
    days:      row.days as string,
    startTime: row.start_time as string,
    endTime:   row.end_time as string,
    active:    row.active === true,
    createdAt: row.created_at as string,
    itemCount: row.item_count != null ? Number(row.item_count) : 0,
  };
}

// GET /api/menu-schedules?restaurantId=xxx  (public — used by customer menus)
// GET /api/menu-schedules                   (authenticated admin)
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    const restaurantId =
      (req.query.restaurantId as string | undefined) ||
      ((req as AuthRequest).user?.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId required' });

    const r = await pool.query(
      `SELECT ms.*, COUNT(mi.id) AS item_count
       FROM menu_schedules ms
       LEFT JOIN menu_items mi ON mi.schedule_id = ms.id AND mi.restaurant_id = ms.restaurant_id
       WHERE ms.restaurant_id = $1
       GROUP BY ms.id
       ORDER BY ms.start_time ASC, ms.name ASC`,
      [restaurantId],
    );
    res.json(r.rows.map((row) => rowToSchedule(row as Record<string, unknown>)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// POST /api/menu-schedules
router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, days, startTime, endTime, active } = req.body as {
      name: string; days: string; startTime: string; endTime: string; active?: boolean;
    };
    if (!name?.trim() || !days || !startTime || !endTime) {
      return res.status(400).json({ error: 'name, days, startTime and endTime are required' });
    }
    const restaurantId = req.user!.restaurantId as string;
    const r = await pool.query(
      `INSERT INTO menu_schedules (id, restaurant_id, name, days, start_time, end_time, active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *, 0 AS item_count`,
      [uuidv4(), restaurantId, name.trim(), days, startTime, endTime, active !== false, new Date().toISOString()],
    );
    res.status(201).json(rowToSchedule(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// PUT /api/menu-schedules/:id
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, days, startTime, endTime, active } = req.body as {
      name: string; days: string; startTime: string; endTime: string; active?: boolean;
    };
    if (!name?.trim() || !days || !startTime || !endTime) {
      return res.status(400).json({ error: 'name, days, startTime and endTime are required' });
    }
    const restaurantId = req.user!.restaurantId as string;
    const r = await pool.query(
      `UPDATE menu_schedules
       SET name=$1, days=$2, start_time=$3, end_time=$4, active=$5
       WHERE id=$6 AND restaurant_id=$7
       RETURNING *, 0 AS item_count`,
      [name.trim(), days, startTime, endTime, active !== false, req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    // Re-fetch to get real item_count
    const full = await pool.query(
      `SELECT ms.*, COUNT(mi.id) AS item_count
       FROM menu_schedules ms
       LEFT JOIN menu_items mi ON mi.schedule_id = ms.id AND mi.restaurant_id = ms.restaurant_id
       WHERE ms.id = $1
       GROUP BY ms.id`,
      [req.params.id],
    );
    res.json(rowToSchedule(full.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// PATCH /api/menu-schedules/:id/active  — toggle active flag
router.patch('/:id/active', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { active } = req.body as { active: boolean };
    if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) required' });
    const restaurantId = req.user!.restaurantId as string;
    const r = await pool.query(
      `UPDATE menu_schedules SET active=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING id, active`,
      [active, req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// DELETE /api/menu-schedules/:id  — also clears schedule_id from assigned items
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    // Clear from items first
    await pool.query(
      `UPDATE menu_items SET schedule_id = NULL WHERE schedule_id = $1 AND restaurant_id = $2`,
      [req.params.id, restaurantId],
    );
    // Clear from categories
    await pool.query(
      `UPDATE categories SET schedule_id = NULL WHERE schedule_id = $1 AND restaurant_id = $2`,
      [req.params.id, restaurantId],
    );
    const r = await pool.query(
      `DELETE FROM menu_schedules WHERE id=$1 AND restaurant_id=$2 RETURNING id`,
      [req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
