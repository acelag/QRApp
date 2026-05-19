import webpush from 'web-push';
import { pool } from '../db/database';
import '../lib/vapid';

interface PushPayload { title: string; body: string; tag: string; url: string; }

export async function sendPushToAll(restaurantId: string, payload: PushPayload): Promise<void> {
  let subs: { endpoint: string; p256dh: string; auth: string }[];
  try {
    const result = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE restaurant_id = $1', [restaurantId]);
    subs = result.rows as typeof subs;
  } catch { return; }
  if (!subs.length) return;
  const message = JSON.stringify(payload);
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message);
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]).catch(() => {});
      }
    }
  }));
}

export function newOrderPayload(tableNumber: number, itemCount: number, totalAmount: number, orderId: string): PushPayload {
  return {
    title: `🍽️ New Order — Table ${tableNumber}`,
    body:  `${itemCount} item${itemCount !== 1 ? 's' : ''} · $${totalAmount.toFixed(2)}`,
    tag:   `order-${orderId}`,
    url:   '/admin/orders',
  };
}

const STATUS_PAYLOADS: Record<string, { title: string; body: string }> = {
  preparing: { title: '👨‍🍳 Being Prepared',   body: 'Your order is being prepared now!' },
  ready:     { title: '✅ Order Ready!',        body: 'Your order is ready — please collect it.' },
  served:    { title: '😋 Enjoy your meal!',   body: 'Thank you for dining with us!' },
};

export async function sendPushToOrder(orderId: string, status: string): Promise<void> {
  const template = STATUS_PAYLOADS[status];
  if (!template) return;

  let subs: { endpoint: string; p256dh: string; auth: string }[];
  try {
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM customer_push_subscriptions WHERE order_id = $1',
      [orderId],
    );
    subs = result.rows as typeof subs;
  } catch { return; }
  if (!subs.length) return;

  const payload = JSON.stringify({
    title: template.title,
    body:  template.body,
    tag:   `order-${orderId}`,
    url:   `/order-success/${orderId}`,
  });

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 410) {
        await pool.query('DELETE FROM customer_push_subscriptions WHERE endpoint = $1', [sub.endpoint]).catch(() => {});
      }
    }
  }));
}
