// Push notification handler — imported into VitePWA workbox SW via importScripts
// v3 — 2026-07-23

self.addEventListener('push', (event) => {
  console.log('[push-sw] Push event received!', event?.data ? 'has data' : 'no data');
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Flea', body: event.data.text() };
  }

  console.log('[push-sw] Payload:', JSON.stringify(payload).slice(0, 200));

  const title = payload.title || 'Flea';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-icon-192.png',
    badge: payload.badge || '/pwa-icon-192.png',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    tag: (payload.data?.type || 'flea-notification') + '-' + Date.now(),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Route every tap through /notifications with query params. The Alerts page
// picks up the params and replays its own click handler for that notification,
// which opens the right drawer (SalesDetails/OrderDetails), chat, or listing —
// exactly like tapping the row in-app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const params = new URLSearchParams();
  if (data.type) params.set('open', String(data.type));
  if (data.related_order_id) params.set('order', String(data.related_order_id));
  if (data.related_listing_id) params.set('listing', String(data.related_listing_id));
  if (data.related_thread_id) params.set('thread', String(data.related_thread_id));

  const url = params.toString() ? `/notifications?${params.toString()}` : '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

console.log('[push-sw] Push handler loaded and registered');
