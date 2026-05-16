import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool, sql } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

const toUser = (row: Record<string, unknown>) => ({
  id:       row.id,
  username: row.username,
  name:     row.name,
  role:     row.role,
});

// GET — list users in own restaurant
router.get('/', async (req: AuthRequest, res) => {
  const result = await pool.request()
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query("SELECT id, username, name, role FROM users WHERE restaurant_id = @rid AND role != 'super_admin' ORDER BY role, name");
  res.json(result.recordset);
});

// POST — create user in own restaurant
router.post('/', async (req: AuthRequest, res) => {
  const { username, name, password, role } = req.body as {
    username: string; name: string; password: string; role: string;
  };
  if (!username?.trim() || !name?.trim() || !password || !role) {
    res.status(400).json({ error: 'username, name, password and role are required' }); return;
  }
  if (!['admin', 'kitchen'].includes(role)) {
    res.status(400).json({ error: 'role must be admin or kitchen' }); return;
  }

  const taken = await pool.request()
    .input('username', sql.NVarChar, username.trim())
    .query('SELECT id FROM users WHERE username = @username');
  if (taken.recordset.length) { res.status(409).json({ error: 'Username already taken' }); return; }

  const id   = uuid();
  const hash = await bcrypt.hash(password, 10);
  await pool.request()
    .input('id',   sql.NVarChar, id)
    .input('rid',  sql.NVarChar, req.user!.restaurantId)
    .input('user', sql.NVarChar, username.trim())
    .input('name', sql.NVarChar, name.trim())
    .input('hash', sql.NVarChar, hash)
    .input('role', sql.NVarChar, role)
    .query(`
      INSERT INTO users (id, restaurant_id, username, name, password_hash, role)
      VALUES (@id, @rid, @user, @name, @hash, @role)
    `);

  res.status(201).json({ id, username: username.trim(), name: name.trim(), role });
});

// PUT /:id — update user (must be in own restaurant)
router.put('/:id', async (req: AuthRequest, res) => {
  const existing = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('SELECT * FROM users WHERE id = @id AND restaurant_id = @rid');
  if (!existing.recordset.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = existing.recordset[0] as Record<string, unknown>;

  const { username, name, password, role } = req.body as {
    username?: string; name?: string; password?: string; role?: string;
  };

  if (role && !['admin', 'kitchen'].includes(role)) {
    res.status(400).json({ error: 'role must be admin or kitchen' }); return;
  }

  const newUsername = username?.trim() || (user.username as string);
  if (newUsername !== user.username) {
    const taken = await pool.request()
      .input('username', sql.NVarChar, newUsername)
      .query('SELECT id FROM users WHERE username = @username');
    if (taken.recordset.length) { res.status(409).json({ error: 'Username already taken' }); return; }
  }

  const newHash = password ? await bcrypt.hash(password, 10) : (user.password_hash as string);

  await pool.request()
    .input('id',   sql.NVarChar, req.params.id)
    .input('user', sql.NVarChar, newUsername)
    .input('name', sql.NVarChar, name?.trim() || user.name)
    .input('hash', sql.NVarChar, newHash)
    .input('role', sql.NVarChar, role || user.role)
    .query('UPDATE users SET username=@user, name=@name, password_hash=@hash, role=@role WHERE id=@id');

  const updated = await pool.request()
    .input('id', sql.NVarChar, req.params.id)
    .query('SELECT id, username, name, role FROM users WHERE id = @id');
  res.json(toUser(updated.recordset[0] as Record<string, unknown>));
});

// DELETE /:id — cannot delete yourself, must be in own restaurant
router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' }); return;
  }
  const result = await pool.request()
    .input('id',  sql.NVarChar, req.params.id)
    .input('rid', sql.NVarChar, req.user!.restaurantId)
    .query('DELETE FROM users WHERE id = @id AND restaurant_id = @rid');
  if (result.rowsAffected[0] === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.status(204).send();
});

export default router;
