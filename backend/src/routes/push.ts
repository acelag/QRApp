import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool, sql } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { vapidPublicKey } from '../lib/vapid';

const router = Router();

// GET /api/push/vapid-public-key — public
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe — authenticated (any role); store restaurant-scoped subscription
router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid push subscription object' }); return;
  }

  const restaurantId = req.user!.restaurantId ?? 'platform';

  // Upsert
  await pool.request()
    .input('ep', sql.NVarChar, endpoint)
    .query('DELETE FROM push_subscriptions WHERE endpoint = @ep');

  await pool.request()
    .input('id',  sql.NVarChar, uuid())
    .input('rid', sql.NVarChar, restaurantId)
    .input('ep',  sql.NVarChar, endpoint)
    .input('p256dh', sql.NVarChar, keys.p256dh)
    .input('auth',   sql.NVarChar, keys.auth)
    .input('now',    sql.NVarChar, new Date().toISOString())
    .query(`
      INSERT INTO push_subscriptions (id, restaurant_id, endpoint, p256dh, auth, created_at)
      VALUES (@id, @rid, @ep, @p256dh, @auth, @now)
    `);

  res.status(201).json({ ok: true });
});

// DELETE /api/push/subscribe — authenticated
router.delete('/subscribe', authenticate, async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }

  await pool.request()
    .input('ep', sql.NVarChar, endpoint)
    .query('DELETE FROM push_subscriptions WHERE endpoint = @ep');

  res.status(204).send();
});

export default router;
