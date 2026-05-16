import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, sql } from '../db/database';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function makePayload(user: Record<string, unknown>) {
  return {
    id:           user.id,
    username:     user.username,
    name:         user.name,
    role:         user.role,
    restaurantId: user.restaurant_id ?? null,
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' }); return;
  }

  const result = await pool.request()
    .input('username', sql.NVarChar, username.trim())
    .query('SELECT * FROM users WHERE username = @username');

  const user = result.recordset[0] as Record<string, unknown> | undefined;
  if (!user) { res.status(401).json({ error: 'Invalid username or password' }); return; }

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) { res.status(401).json({ error: 'Invalid username or password' }); return; }

  // Block login if the restaurant is deactivated (super_admin is never blocked)
  if (user.role !== 'super_admin' && user.restaurant_id) {
    const rCheck = await pool.request()
      .input('rid', sql.NVarChar, user.restaurant_id as string)
      .query('SELECT active FROM restaurants WHERE id = @rid');
    const active = rCheck.recordset[0]?.active;
    if (active === false || active === 0) {
      res.status(403).json({ error: 'This restaurant account has been deactivated.' }); return;
    }
  }

  const payload = makePayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res) => {
  res.json(req.user);
});

// PATCH /api/auth/profile
router.patch('/profile', authenticate, async (req: AuthRequest, res) => {
  const { currentPassword, newUsername, newName, newPassword } =
    req.body as {
      currentPassword: string;
      newUsername?: string;
      newName?: string;
      newPassword?: string;
    };

  if (!currentPassword) {
    res.status(400).json({ error: 'Current password is required' }); return;
  }

  const result = await pool.request()
    .input('id', sql.NVarChar, req.user!.id)
    .query('SELECT * FROM users WHERE id = @id');

  const user = result.recordset[0] as Record<string, unknown>;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, user.password_hash as string);
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

  if (newUsername && newUsername.trim() !== user.username) {
    const taken = await pool.request()
      .input('username', sql.NVarChar, newUsername.trim())
      .query('SELECT id FROM users WHERE username = @username');
    if (taken.recordset.length) {
      res.status(409).json({ error: 'Username already taken' }); return;
    }
  }

  const updatedUsername = newUsername?.trim()  || (user.username as string);
  const updatedName     = newName?.trim()       || (user.name as string);
  const updatedHash     = newPassword
    ? await bcrypt.hash(newPassword, 10)
    : user.password_hash as string;

  await pool.request()
    .input('id',       sql.NVarChar, user.id)
    .input('username', sql.NVarChar, updatedUsername)
    .input('name',     sql.NVarChar, updatedName)
    .input('hash',     sql.NVarChar, updatedHash)
    .query('UPDATE users SET username=@username, name=@name, password_hash=@hash WHERE id=@id');

  const updated = await pool.request()
    .input('id', sql.NVarChar, user.id)
    .query('SELECT * FROM users WHERE id = @id');

  const payload = makePayload(updated.recordset[0] as Record<string, unknown>);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

export default router;
