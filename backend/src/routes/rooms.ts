import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const toRoom = (row: Record<string, unknown>) => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  number: row.number,
  name: (row.name as string | null) ?? null,
  createdAt: row.created_at,
});

router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM rooms WHERE restaurant_id = $1 ORDER BY number', [req.user!.restaurantId]);
  res.json((result.rows as Record<string, unknown>[]).map(toRoom));
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRoom(result.rows[0] as Record<string, unknown>));
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { number, name } = req.body as { number: number; name?: string };
  if (!number) { res.status(400).json({ error: 'number is required' }); return; }
  const dup = await pool.query('SELECT id FROM rooms WHERE restaurant_id = $1 AND number = $2', [req.user!.restaurantId, number]);
  if (dup.rows.length) { res.status(409).json({ error: 'Room number already exists' }); return; }
  const id = uuid();
  const now = new Date().toISOString();
  await pool.query(
    'INSERT INTO rooms (id,restaurant_id,number,name,created_at) VALUES ($1,$2,$3,$4,$5)',
    [id, req.user!.restaurantId, number, name ?? null, now],
  );
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
  res.status(201).json(toRoom(result.rows[0] as Record<string, unknown>));
});

router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM rooms WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
