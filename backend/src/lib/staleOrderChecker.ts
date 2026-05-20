/**
 * Stale-order checker — runs every 5 minutes and push-notifies staff
 * for any restaurant that has pending orders older than STALE_MINUTES.
 *
 * An in-memory Set tracks which order IDs have already been alerted so
 * staff only receive one notification per stalled order.  The Set is
 * pruned whenever an order is no longer pending (served / cancelled).
 */

import { pool } from '../db/database';
import { sendPushToAll } from './pushNotifier';

const STALE_MINUTES  = 30;
const CHECK_INTERVAL = 5 * 60 * 1_000; // 5 min
const INITIAL_DELAY  = 15 * 1_000;     // wait 15 s after boot for DB to settle

/** Order IDs that have already triggered a stale notification */
const notifiedIds = new Set<string>();

interface StaleRow {
  id: string;
  restaurant_id: string;
  order_number: string | null;
  table_number: number | null;
  room_number: number | null;
  order_type: string;
  created_at: string;
}

async function checkStaleOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1_000).toISOString();

  let rows: StaleRow[];
  try {
    const result = await pool.query<StaleRow>(
      `SELECT id, restaurant_id, order_number, table_number, room_number,
              order_type, created_at
       FROM   orders
       WHERE  status     = 'pending'
         AND  created_at <= $1`,
      [cutoff],
    );
    rows = result.rows;
  } catch {
    return; // non-fatal
  }

  // Only alert orders we haven't notified yet
  const fresh = rows.filter((r) => !notifiedIds.has(r.id));
  if (!fresh.length) return;

  // Group by restaurant
  const byRestaurant = new Map<string, StaleRow[]>();
  for (const row of fresh) {
    const list = byRestaurant.get(row.restaurant_id) ?? [];
    list.push(row);
    byRestaurant.set(row.restaurant_id, list);
  }

  for (const [restaurantId, orders] of byRestaurant) {
    const count = orders.length;

    // Build a human-readable location for single-order case
    function location(o: StaleRow): string {
      if (o.order_type === 'takeaway')    return 'Takeaway';
      if (o.order_type === 'room-service') return `Room ${o.room_number ?? '?'}`;
      return `Table ${o.table_number ?? '?'}`;
    }

    const title = count === 1
      ? '⚠️ Stalled Order'
      : `⚠️ ${count} Stalled Orders`;

    const ref = orders[0].order_number
      ? `#${orders[0].order_number}`
      : orders[0].id.slice(0, 6).toUpperCase();

    const body = count === 1
      ? `${location(orders[0])} (${ref}) has been pending for ${STALE_MINUTES}+ min`
      : `${count} orders pending for ${STALE_MINUTES}+ min — check the kitchen`;

    try {
      await sendPushToAll(restaurantId, {
        title,
        body,
        tag: `stale-${restaurantId}`,   // replaces previous stale notification on device
        url: '/admin/orders',
      });
    } catch { /* ignore push failures */ }

    // Mark these orders as notified so we don't spam staff
    orders.forEach((o) => notifiedIds.add(o.id));
  }
}

/** Remove IDs that are no longer pending (resolved or served) */
async function pruneNotified(): Promise<void> {
  if (notifiedIds.size === 0) return;
  const ids = [...notifiedIds];
  try {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM orders WHERE id = ANY($1::text[]) AND status = 'pending'`,
      [ids],
    );
    const stillPending = new Set(result.rows.map((r) => r.id));
    for (const id of ids) {
      if (!stillPending.has(id)) notifiedIds.delete(id);
    }
  } catch { /* ignore */ }
}

export function startStaleOrderChecker(): void {
  const tick = () => {
    void checkStaleOrders();
    void pruneNotified();
  };

  // First check after server has fully warmed up
  setTimeout(tick, INITIAL_DELAY);
  // Then every CHECK_INTERVAL
  setInterval(tick, CHECK_INTERVAL);

  console.log(`[staleOrderChecker] Started — alerts after ${STALE_MINUTES} min, checked every ${CHECK_INTERVAL / 60_000} min`);
}
