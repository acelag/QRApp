/**
 * Thin module-level cache for menu prefetch data.
 *
 * WelcomePage kicks off all the heavy fetches as soon as the table ID is
 * known, and writes the result here.  MenuPage reads it on mount and skips
 * its own network calls when the data is already present.
 *
 * The cache is intentionally never persisted — a hard reload or a direct
 * /menu/:id navigation simply misses the cache and MenuPage falls back to its
 * own fetching path.
 */

import type { Category, MenuItem } from '../types';

export interface PrefetchedMenu {
  tableId: string;
  restaurantId: string;
  tableNumber: number;
  categories: Category[];
  items: MenuItem[];
  sessionId: string;
  restaurantInfo: {
    name: string;
    logo: string | null;
    themeColor: string | null;
    waitTimeMin: number | null;
    roomServiceOpen: string | null;
    roomServiceClose: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    welcomeImageUrl: string | null;
  };
}

// One entry per tableId — normally only one is active at a time.
const cache = new Map<string, PrefetchedMenu>();

export const menuPrefetchCache = {
  set(data: PrefetchedMenu) {
    cache.set(data.tableId, data);
  },

  get(tableId: string): PrefetchedMenu | null {
    return cache.get(tableId) ?? null;
  },

  /** Call after MenuPage has consumed the cache so we don't serve stale data. */
  clear(tableId: string) {
    cache.delete(tableId);
  },
};
