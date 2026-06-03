import { pool } from '../db/database';

// Global, system-wide settings (not per-restaurant). Cached in memory and
// refreshed on write. Currently: the subscriptions master switch.

let cache = new Map<string, string>();

export const SUBSCRIPTIONS_ENABLED_KEY = 'subscriptions_enabled';

export async function loadAppSettings(): Promise<void> {
  try {
    const res = await pool.query('SELECT key, value FROM app_settings');
    cache = new Map((res.rows as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  } catch {
    cache = new Map();
  }
}

function getBool(key: string, def: boolean): boolean {
  const v = cache.get(key);
  return v == null ? def : v === 'true';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
  cache.set(key, value);
}

/** Whether the subscription/billing system is active. Defaults ON. */
export function subscriptionsEnabled(): boolean {
  return getBool(SUBSCRIPTIONS_ENABLED_KEY, true);
}

export async function setSubscriptionsEnabled(on: boolean): Promise<void> {
  await setSetting(SUBSCRIPTIONS_ENABLED_KEY, on ? 'true' : 'false');
}
