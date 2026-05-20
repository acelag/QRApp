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

const STATUS_TEMPLATES: Record<string, { title: string; suffix: string }> = {
  preparing: { title: '👨‍🍳 Being Prepared',  suffix: 'Being prepared now' },
  ready:     { title: '✅ Order Ready!',       suffix: 'Ready — please collect it' },
  served:    { title: '😋 Enjoy your meal!',  suffix: 'Thank you for dining with us!' },
};

/** Build a concise item list: "Burger, Fries ×2" — truncated at 3 items */
function summariseItems(items: { name: string; quantity: number }[]): string {
  if (!items.length) return '';
  const MAX = 3;
  const shown = items.slice(0, MAX);
  const rest  = items.length - MAX;
  let s = shown.map((i) => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name).join(', ');
  if (rest > 0) s += ` +${rest} more`;
  return s;
}

export async function sendPushToOrder(orderId: string, status: string): Promise<void> {
  const template = STATUS_TEMPLATES[status];
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

  // Enrich notification body with item names and (for 'preparing') estimated wait time
  let body = template.suffix;
  try {
    const orderRes = await pool.query(
      'SELECT items, restaurant_id FROM orders WHERE id = $1',
      [orderId],
    );
    if (orderRes.rows.length) {
      const { items, restaurant_id } = orderRes.rows[0] as { items: { name: string; quantity: number }[]; restaurant_id: string | null };
      const itemStr = summariseItems(Array.isArray(items) ? items : []);

      let waitNote = '';
      if (status === 'preparing' && restaurant_id) {
        const restRes = await pool.query(
          'SELECT wait_time_min FROM restaurants WHERE id = $1',
          [restaurant_id],
        );
        const wt = restRes.rows[0]?.wait_time_min as number | null;
        if (wt) waitNote = ` · ~${wt} min`;
      }

      if (itemStr) body = `${itemStr}${waitNote} — ${template.suffix}`;
      else if (waitNote) body = `${template.suffix}${waitNote}`;
    }
  } catch { /* non-fatal — fall back to generic body */ }

  const payload = JSON.stringify({
    title: template.title,
    body,
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
