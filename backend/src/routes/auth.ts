import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function makePayload(user: Record<string, unknown>) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, restaurantId: user.restaurant_id ?? null };
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: 'Username and password are required' }); return; }

  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  const user = result.rows[0] as Record<string, unknown> | undefined;
  if (!user) { res.status(401).json({ error: 'Invalid username or password' }); return; }

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) { res.status(401).json({ error: 'Invalid username or password' }); return; }

  if (user.role !== 'super_admin' && user.restaurant_id) {
    const rCheck = await pool.query('SELECT active FROM restaurants WHERE id = $1', [user.restaurant_id]);
    if (rCheck.rows[0]?.active === false) {
      res.status(403).json({ error: 'This restaurant account has been deactivated.' }); return;
    }
  }

  const payload = makePayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

router.get('/me', authenticate, (req: AuthRequest, res) => { res.json(req.user); });

router.patch('/profile', authenticate, async (req: AuthRequest, res) => {
  const { currentPassword, newUsername, newName, newPassword } = req.body as {
    currentPassword: string; newUsername?: string; newName?: string; newPassword?: string;
  };
  if (!currentPassword) { res.status(400).json({ error: 'Current password is required' }); return; }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.id]);
  const user = result.rows[0] as Record<string, unknown>;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  if (!await bcrypt.compare(currentPassword, user.password_hash as string)) {
    res.status(401).json({ error: 'Current password is incorrect' }); return;
  }

  if (newUsername && newUsername.trim() !== user.username) {
    const taken = await pool.query('SELECT id FROM users WHERE username = $1', [newUsername.trim()]);
    if (taken.rows.length) { res.status(409).json({ error: 'Username already taken' }); return; }
  }

  const updatedUsername = newUsername?.trim() || (user.username as string);
  const updatedName     = newName?.trim()      || (user.name as string);
  const updatedHash     = newPassword ? await bcrypt.hash(newPassword, 10) : user.password_hash as string;

  await pool.query('UPDATE users SET username=$1, name=$2, password_hash=$3 WHERE id=$4',
    [updatedUsername, updatedName, updatedHash, user.id]);

  const updated = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
  const payload = makePayload(updated.rows[0] as Record<string, unknown>);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

export default router;
