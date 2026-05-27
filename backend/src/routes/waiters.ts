import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

router.get('/', async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT id, name FROM waiters WHERE restaurant_id = $1 AND active = true ORDER BY name',
    [req.user!.restaurantId],
  );
  res.json(result.rows);
});

router.post('/', async (req: AuthRequest, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const id = uuid();
  const now = new Date().toISOString();
  await pool.query(
    'INSERT INTO waiters (id, restaurant_id, name, active, created_at) VALUES ($1, $2, $3, true, $4)',
    [id, req.user!.restaurantId, name.trim(), now],
  );
  res.status(201).json({ id, name: name.trim() });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const result = await pool.query(
    'DELETE FROM waiters WHERE id = $1 AND restaurant_id = $2',
    [req.params.id, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Waiter not found' }); return; }
  res.status(204).send();
});

export default router;
