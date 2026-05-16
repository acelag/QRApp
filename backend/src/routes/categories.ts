import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId = (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }
  const result = await pool.query('SELECT id, name FROM categories WHERE restaurant_id = $1 ORDER BY name', [restaurantId]);
  res.json(result.rows);
});

router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const id = uuid();
  await pool.query('INSERT INTO categories (id, restaurant_id, name) VALUES ($1, $2, $3)', [id, req.user!.restaurantId, name.trim()]);
  res.status(201).json({ id, name: name.trim() });
});

router.patch('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 AND restaurant_id = $3', [name.trim(), req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ id: req.params.id, name: name.trim() });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
