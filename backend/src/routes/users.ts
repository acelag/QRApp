import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { parsePermissions } from '../lib/permissions';

const router = Router();
router.use(authenticate, requireRole('admin'));
const toUser = (row: Record<string, unknown>) => ({
  id: row.id, username: row.username, name: row.name, role: row.role,
  permissions: parsePermissions(row.permissions),
});

router.get('/', async (req: AuthRequest, res) => {
  const result = await pool.query(
    "SELECT id, username, name, role, permissions FROM users WHERE restaurant_id = $1 AND role != 'super_admin' ORDER BY role, name", [req.user!.restaurantId]);
  res.json(result.rows.map(toUser));
});

router.post('/', async (req: AuthRequest, res) => {
  const { username, name, password, role, permissions } = req.body as { username: string; name: string; password: string; role: string; permissions?: unknown; };
  if (!username?.trim() || !name?.trim() || !password || !role) { res.status(400).json({ error: 'username, name, password and role are required' }); return; }
  if (!['admin', 'manager', 'cashier', 'waiter', 'kitchen'].includes(role)) { res.status(400).json({ error: 'role must be admin, manager, cashier, waiter or kitchen' }); return; }
  const taken = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
  if (taken.rows.length) { res.status(409).json({ error: 'Username already taken' }); return; }
  const perms = parsePermissions(permissions);
  const id = uuid(); const hash = await bcrypt.hash(password, 10);
  await pool.query(`INSERT INTO users (id,restaurant_id,username,name,password_hash,role,permissions) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, req.user!.restaurantId, username.trim(), name.trim(), hash, role, JSON.stringify(perms)]);
  res.status(201).json({ id, username: username.trim(), name: name.trim(), role, permissions: perms });
});

router.put('/:id', async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM users WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = existing.rows[0] as Record<string, unknown>;
  const { username, name, password, role, permissions } = req.body as { username?: string; name?: string; password?: string; role?: string; permissions?: unknown; };
  if (role && !['admin', 'manager', 'cashier', 'waiter', 'kitchen'].includes(role)) { res.status(400).json({ error: 'role must be admin, manager, cashier, waiter or kitchen' }); return; }
  const newUsername = username?.trim() || (user.username as string);
  if (newUsername !== user.username) {
    const taken = await pool.query('SELECT id FROM users WHERE username = $1', [newUsername]);
    if (taken.rows.length) { res.status(409).json({ error: 'Username already taken' }); return; }
  }
  const newHash = password ? await bcrypt.hash(password, 10) : (user.password_hash as string);
  const newPerms = permissions !== undefined ? parsePermissions(permissions) : parsePermissions(user.permissions);
  await pool.query('UPDATE users SET username=$1, name=$2, password_hash=$3, role=$4, permissions=$5 WHERE id=$6 AND restaurant_id=$7',
    [newUsername, name?.trim() || user.name, newHash, role || user.role, JSON.stringify(newPerms), req.params.id, req.user!.restaurantId]);
  const updated = await pool.query('SELECT id, username, name, role, permissions FROM users WHERE id = $1', [req.params.id]);
  res.json(toUser(updated.rows[0] as Record<string, unknown>));
});

router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) { res.status(400).json({ error: 'You cannot delete your own account' }); return; }
  const result = await pool.query('DELETE FROM users WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.status(204).send();
});

export default router;
