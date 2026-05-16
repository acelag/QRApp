import webpush from 'web-push';
import { pool, sql } from '../db/database';
import '../lib/vapid';

interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Send a push notification to all subscribers of a specific restaurant. */
export async function sendPushToAll(restaurantId: string, payload: PushPayload): Promise<void> {
  let subs: { endpoint: string; p256dh: string; auth: string }[];

  try {
    const result = await pool.request()
      .input('rid', sql.NVarChar, restaurantId)
      .query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE restaurant_id = @rid');
    subs = result.recordset as typeof subs;
  } catch {
    return;
  }

  if (!subs.length) return;

  const message = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        );
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await pool.request()
            .input('ep', sql.NVarChar, sub.endpoint)
            .query('DELETE FROM push_subscriptions WHERE endpoint = @ep')
            .catch(() => {});
        }
      }
    }),
  );
}

export function newOrderPayload(
  tableNumber: number,
  itemCount: number,
  totalAmount: number,
  orderId: string,
): PushPayload {
  return {
    title: `🍽️ New Order — Table ${tableNumber}`,
    body:  `${itemCount} item${itemCount !== 1 ? 's' : ''} · $${totalAmount.toFixed(2)}`,
    tag:   `order-${orderId}`,
    url:   '/admin/orders',
  };
}
