import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Order } from '../types';
import { playNewOrderSound } from '../lib/audioAlert';

const STORAGE_KEY = 'adminSoundEnabled';
const ORIGINAL_TITLE = document.title;

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

/** Flash the browser tab title when the tab is in the background. */
function flashTabTitle(count: number): void {
  if (!document.hidden) return;
  const alert = `🔔 ${count} New Order${count > 1 ? 's' : ''}!`;
  let tick = 0;
  const id = setInterval(() => {
    document.title = tick % 2 === 0 ? alert : ORIGINAL_TITLE;
    tick++;
    if (tick > 12) { clearInterval(id); document.title = ORIGINAL_TITLE; }
  }, 700);
  document.addEventListener('visibilitychange', () => {
    clearInterval(id);
    document.title = ORIGINAL_TITLE;
  }, { once: true });
}

/**
 * useOrderSoundAlert — plays a ding, shows a toast, and flashes the tab
 * title whenever a genuinely new order appears.
 *
 * Pass the live `orders` array from your polling hook.
 * The very first batch of orders (on page load) is silently seeded so we
 * don't alert for orders that already existed before the page opened.
 */
export function useOrderSoundAlert(orders: Order[]): void {
  const seenIds     = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
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

    if (newCount > 0) {
      if (getSoundEnabled()) playNewOrderSound();

      toast(`${newCount} new order${newCount > 1 ? 's' : ''} arrived!`, {
        icon: '🛎',
        duration: 4000,
        style: { fontWeight: 600 },
      });

      flashTabTitle(newCount);
    }
  }, [orders]);
}
