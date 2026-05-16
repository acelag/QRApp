import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const toTable = (row: Record<string, unknown>) => ({
  id:           row.id,
  restaurantId: row.restaurant_id,
  number:       row.number,
  seats:        row.seats,
  active:       row.active === true || row.active === 1,
});

// GET / — admin only, own restaurant
router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.request()
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('SELECT * FROM tables WHERE restaurant_id = @rid ORDER BY number');
  res.json((result.recordset as Record<string, unknown>[]).map(toTable));
});

// GET /:id — public (customer scanning QR). Returns restaurantId so frontend can scope calls.
router.get('/:id', async (req, res) => {
  const result = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT * FROM tables WHERE id = @id');
  if (!result.recordset.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toTable(result.recordset[0] as Record<string, unknown>));
});

// POST — admin only
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { number, seats } = req.body as { number: number; seats: number };
  if (!number || !seats) { res.status(400).json({ error: 'number and seats are required' }); return; }

  // Uniqueness within the restaurant
  const dup = await pool.request()
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .input('num', sql.Int,      number)
    .query('SELECT id FROM tables WHERE restaurant_id = @rid AND number = @num');
  if (dup.recordset.length) { res.status(409).json({ error: 'Table number already exists' }); return; }

  const id = uuid();
  await pool.request()
    .input('id',     sql.NVarChar, id)
    .input('rid',    sql.NVarChar, req.user!.restaurantId)
    .input('number', sql.Int,      number)
    .input('seats',  sql.Int,      seats)
    .query('INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES (@id, @rid, @number, @seats, 1)');

  const result = await pool.request()
    .input('id', sql.NVarChar, id)
    .query('SELECT * FROM tables WHERE id = @id');
  res.status(201).json(toTable(result.recordset[0] as Record<string, unknown>));
});

// PUT — admin only, own restaurant
router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const existing = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('SELECT * FROM tables WHERE id = @id AND restaurant_id = @rid');
  if (!existing.recordset.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = existing.recordset[0] as Record<string, unknown>;
  const { number, seats, active } = req.body as { number?: number; seats?: number; active?: boolean };

  await pool.request()
    .input('id',     sql.NVarChar, req.params.id)
    .input('number', sql.Int,      number ?? row.number)
    .input('seats',  sql.Int,      seats  ?? row.seats)
    .input('active', sql.Bit,      active !== undefined ? (active ? 1 : 0) : row.active)
    .query('UPDATE tables SET number=@number, seats=@seats, active=@active WHERE id=@id');

  const updated = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT * FROM tables WHERE id = @id');
  res.json(toTable(updated.recordset[0] as Record<string, unknown>));
});

// DELETE — admin only, own restaurant
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const result = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('DELETE FROM tables WHERE id = @id AND restaurant_id = @rid');
  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
