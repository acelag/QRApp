import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';

const router = Router();

// POST /api/customer-push/subscribe — public, no auth required
// Body: { orderId, endpoint, keys: { p256dh, auth } }
router.post('/subscribe', async (req, res) => {
  const { orderId, endpoint, keys } = req.body as {
    orderId?: string;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!orderId || !endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'orderId, endpoint, keys.p256dh and keys.auth are required' });
    return;
  }

  // Verify the order exists
  const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [orderId]);
  if (!orderCheck.rows.length) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Upsert — if this endpoint is already subscribed for this order, do nothing
  const existing = await pool.query(
    'SELECT id FROM customer_push_subscriptions WHERE order_id = $1 AND endpoint = $2',
    [orderId, endpoint],
  );
  if (existing.rows.length) {
    res.status(200).json({ ok: true });
    return;
  }

  await pool.query(
    `INSERT INTO customer_push_subscriptions (id, order_id, endpoint, p256dh, auth, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuid(), orderId, endpoint, keys.p256dh, keys.auth, new Date().toISOString()],
  );

  res.status(201).json({ ok: true });
});

// DELETE /api/customer-push/subscribe — public
// Body: { endpoint }
router.delete('/subscribe', async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: 'endpoint is required' });
    return;
  }
  await pool.query(
    'DELETE FROM customer_push_subscriptions WHERE endpoint = $1',
    [endpoint],
  ).catch(() => {});
  res.json({ ok: true });
});

export default router;
