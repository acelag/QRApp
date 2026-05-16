import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET — public: customer passes ?restaurantId=; admin JWT carries it
router.get('/', optionalAuthenticate, async (req, res) => {
  const restaurantId =
    (req as AuthRequest).user?.restaurantId ?? (req.query.restaurantId as string | undefined);
  if (!restaurantId) { res.status(400).json({ error: 'restaurantId required' }); return; }

  const result = await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('SELECT id, name FROM categories WHERE restaurant_id = @rid ORDER BY name');
  res.json(result.recordset);
});

// POST — admin only
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const id = uuid();
  await pool.request()
    .input('id',  sql.NVarChar, id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .input('name',sql.NVarChar, name.trim())
    .query('INSERT INTO categories (id, restaurant_id, name) VALUES (@id, @rid, @name)');
  res.status(201).json({ id, name: name.trim() });
});

// PATCH — rename category, admin only
router.patch('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const result = await pool.request()
    .input('id',   sql.NVarChar, req.params.id)
    .input('rid',  sql.NVarChar, req.user!.restaurantId)
    .input('name', sql.NVarChar, name.trim())
    .query('UPDATE categories SET name = @name WHERE id = @id AND restaurant_id = @rid');
  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ id: req.params.id, name: name.trim() });
});

// DELETE — admin only, own restaurant
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('DELETE FROM categories WHERE id = @id AND restaurant_id = @rid');
  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
