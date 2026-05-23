import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

function rowToShift(row: Record<string, unknown>) {
  return {
    id:         row.id as string,
    userId:     (row.user_id as string | null) ?? null,
    staffName:  row.staff_name as string,
    staffRole:  row.staff_role as string,
    date:       row.date as string,
    startTime:  row.start_time as string,
    endTime:    row.end_time as string,
    notes:      (row.notes as string | null) ?? null,
    status:     row.status as string,
    createdAt:  row.created_at as string,
  };
}

// GET /api/roster?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    const from = (req.query.from as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const to   = (req.query.to   as string | undefined) ?? from;
    const r = await pool.query(
      `SELECT * FROM shifts WHERE restaurant_id=$1 AND date >= $2 AND date <= $3
       ORDER BY date ASC, start_time ASC`,
      [restaurantId, from, to],
    );
    res.json(r.rows.map((row) => rowToShift(row as Record<string, unknown>)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// POST /api/roster
router.post('/', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    const { userId, staffName, staffRole, date, startTime, endTime, notes } =
      req.body as {
        userId?: string | null;
        staffName: string;
        staffRole?: string;
        date: string;
        startTime: string;
        endTime: string;
        notes?: string | null;
      };
    if (!staffName?.trim() || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'staffName, date, startTime and endTime are required' });
    }
    const r = await pool.query(
      `INSERT INTO shifts
         (id, restaurant_id, user_id, staff_name, staff_role, date, start_time, end_time, notes, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled',$10)
       RETURNING *`,
      [
        uuidv4(), restaurantId,
        userId ?? null,
        staffName.trim(),
        staffRole ?? 'staff',
        date, startTime, endTime,
        notes?.trim() || null,
        new Date().toISOString(),
      ],
    );
    res.status(201).json(rowToShift(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// PUT /api/roster/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    const { userId, staffName, staffRole, date, startTime, endTime, notes, status } =
      req.body as {
        userId?: string | null;
        staffName: string;
        staffRole?: string;
        date: string;
        startTime: string;
        endTime: string;
        notes?: string | null;
        status?: string;
      };
    if (!staffName?.trim() || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'staffName, date, startTime and endTime are required' });
    }
    const VALID_STATUSES = ['scheduled', 'confirmed', 'absent', 'completed'];
    const safeStatus = VALID_STATUSES.includes(status ?? '') ? status! : 'scheduled';
    const r = await pool.query(
      `UPDATE shifts
       SET user_id=$1, staff_name=$2, staff_role=$3, date=$4,
           start_time=$5, end_time=$6, notes=$7, status=$8
       WHERE id=$9 AND restaurant_id=$10
       RETURNING *`,
      [
        userId ?? null,
        staffName.trim(),
        staffRole ?? 'staff',
        date, startTime, endTime,
        notes?.trim() || null,
        safeStatus,
        req.params.id, restaurantId,
      ],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rowToShift(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// PATCH /api/roster/:id/status
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    const { status } = req.body as { status: string };
    const VALID_STATUSES = ['scheduled', 'confirmed', 'absent', 'completed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const r = await pool.query(
      `UPDATE shifts SET status=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *`,
      [status, req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rowToShift(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/roster/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.user!.restaurantId as string;
    const r = await pool.query(
      `DELETE FROM shifts WHERE id=$1 AND restaurant_id=$2 RETURNING id`,
      [req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

export default router;
