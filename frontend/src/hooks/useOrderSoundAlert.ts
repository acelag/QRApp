import { useEffect, useRef } from 'react';
import type { Order } from '../types';
import { playNewOrderSound } from '../lib/audioAlert';

const STORAGE_KEY = 'adminSoundEnabled';

/** Returns the persisted sound-enabled preference (default: true). */
export function getSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

/** Persists the sound-enabled preference. */
export function setSoundEnabled(value: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
}

/**
 * useOrderSoundAlert — plays a ding whenever a genuinely new order appears.
 *
 * Pass the live `orders` array from your polling hook.
 * The very first batch of orders (on page load) is silently seeded so we
 * don't beep for orders that already existed before the page opened.
 */
export function useOrderSoundAlert(orders: Order[]): void {
  const seenIds     = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      // Seed with existing orders — don't alert for these
      orders.forEach((o) => seenIds.current.add(o.id));
      initialized.current = true;
      return;
    }

    let newCount = 0;
    orders.forEach((o) => {
      if (!seenIds.current.has(o.id)) {
        seenIds.current.add(o.id);
        newCount++;
      }
    });

    if (newCount > 0 && getSoundEnabled()) {
      playNewOrderSound();
    }
  }, [orders]);
}
