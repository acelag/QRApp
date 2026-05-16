import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const toTable = (row: Record<string, unknown>) => ({
  id: row.id, restaurantId: row.restaurant_id, number: row.number, seats: row.seats, active: row.active === true,
});

router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY number', [req.user!.restaurantId]);
  res.json((result.rows as Record<string, unknown>[]).map(toTable));
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toTable(result.rows[0] as Record<string, unknown>));
});

router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { number, seats } = req.body as { number: number; seats: number };
  if (!number || !seats) { res.status(400).json({ error: 'number and seats are required' }); return; }
  const dup = await pool.query('SELECT id FROM tables WHERE restaurant_id = $1 AND number = $2', [req.user!.restaurantId, number]);
  if (dup.rows.length) { res.status(409).json({ error: 'Table number already exists' }); return; }
  const id = uuid();
  await pool.query('INSERT INTO tables (id,restaurant_id,number,seats,active) VALUES ($1,$2,$3,$4,TRUE)', [id, req.user!.restaurantId, number, seats]);
  const result = await pool.query('SELECT * FROM tables WHERE id = $1', [id]);
  res.status(201).json(toTable(result.rows[0] as Record<string, unknown>));
});

router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM tables WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.rows[0] as Record<string, unknown>;
  const { number, seats, active } = req.body as { number?: number; seats?: number; active?: boolean };
  await pool.query('UPDATE tables SET number=$1, seats=$2, active=$3 WHERE id=$4',
    [number ?? row.number, seats ?? row.seats, active !== undefined ? active : row.active, req.params.id]);
  const updated = await pool.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
  res.json(toTable(updated.rows[0] as Record<string, unknown>));
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM tables WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
