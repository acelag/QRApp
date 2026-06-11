import { useState, useCallback } from 'react';

function storageKey(restaurantId: string) {
  return `qra-favourites-${restaurantId}`;
}

function load(restaurantId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function save(restaurantId: string, ids: Set<string>) {
  localStorage.setItem(storageKey(restaurantId), JSON.stringify([...ids]));
}

export function useFavourites(restaurantId: string) {
  const [favourites, setFavourites] = useState<Set<string>>(() => load(restaurantId));

  const toggle = useCallback((itemId: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      save(restaurantId, next);
      return next;
    });
  }, [restaurantId]);

  const isFavourite = useCallback((itemId: string) => favourites.has(itemId), [favourites]);

  return { favourites, toggle, isFavourite };
}
