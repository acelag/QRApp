import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId = (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }
  const result = await pool.query(
    'SELECT id, name, schedule_id AS "scheduleId" FROM categories WHERE restaurant_id = $1 ORDER BY name',
    [restaurantId],
  );
  res.json(result.rows);
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const id = uuid();
  await pool.query('INSERT INTO categories (id, restaurant_id, name) VALUES ($1, $2, $3)', [id, req.user!.restaurantId, name.trim()]);
  res.status(201).json({ id, name: name.trim() });
});

router.patch('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { name, scheduleId } = req.body as { name?: string; scheduleId?: string | null };
  if (name !== undefined && !name?.trim()) { res.status(400).json({ error: 'name cannot be empty' }); return; }
  const rid = req.user!.restaurantId;
  if (scheduleId !== undefined && name === undefined) {
    // Schedule-only update
    const r = await pool.query(
      'UPDATE categories SET schedule_id = $1 WHERE id = $2 AND restaurant_id = $3 RETURNING id, name, schedule_id AS "scheduleId"',
      [scheduleId || null, req.params.id, rid],
    );
    if ((r.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(r.rows[0]);
    return;
  }
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const r = await pool.query(
    'UPDATE categories SET name = $1, schedule_id = COALESCE($2, schedule_id) WHERE id = $3 AND restaurant_id = $4 RETURNING id, name, schedule_id AS "scheduleId"',
    [name.trim(), scheduleId !== undefined ? (scheduleId || null) : null, req.params.id, rid],
  );
  if ((r.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(r.rows[0]);
});

router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
