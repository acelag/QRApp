// QRA Service Worker — handles Web Push notifications

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore */ }

  const title   = data.title   ?? 'New Order';
  const options = {
    body:    data.body    ?? 'A new order has been placed.',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag     ?? 'order',
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: data.url ?? '/admin/orders' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/admin/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window with the target URL is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    }),
  );
});
