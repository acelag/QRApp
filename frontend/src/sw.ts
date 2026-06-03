/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST ?? []);

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data: Record<string, string> = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore */ }

  const title = data.title ?? 'New Order';
  const options = {
    body:     data.body  ?? 'A new order has been placed.',
    icon:     '/favicon.svg',
    badge:    '/favicon.svg',
    tag:      data.tag   ?? 'order',
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: data.url ?? '/admin/orders' },
  };

  event.waitUntil((async () => {
    // If the admin already has the app open and visible, don't pop an OS
    // notification — the Orders screen updates live. Forward the payload so
    // the app can show an in-app cue instead.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }) as readonly WindowClient[];
    const hasVisibleClient = clients.some((c) => c.visibilityState === 'visible');
    if (hasVisibleClient) {
      clients.forEach((c) => c.postMessage({ type: 'push', payload: { title, ...options } }));
      return;
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string })?.url ?? '/admin/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
