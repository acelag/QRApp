import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { vapidPublicKey } from '../lib/vapid';

const router = Router();

router.get('/vapid-public-key', (_req, res) => { res.json({ publicKey: vapidPublicKey }); });

router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body as { endpoint: string; keys?: { p256dh?: string; auth?: string }; };
  if (!endpoint || !keys?.p256dh || !keys?.auth) { res.status(400).json({ error: 'Invalid push subscription object' }); return; }
  const restaurantId = req.user!.restaurantId ?? 'platform';
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  await pool.query(`INSERT INTO push_subscriptions (id,restaurant_id,endpoint,p256dh,auth,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [uuid(), restaurantId, endpoint, keys.p256dh, keys.auth, new Date().toISOString()]);
  res.status(201).json({ ok: true });
});

router.delete('/subscribe', authenticate, async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  res.status(204).send();
});

export default router;
