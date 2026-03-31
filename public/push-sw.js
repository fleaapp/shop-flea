// Push notification handler — imported into VitePWA workbox SW via importScripts
// v2 — 2026-03-31

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Route based on notification type
  if (data.type === 'item_sold' || data.type === 'shipping_reminder_3d' || data.type === 'shipping_reminder_6d') {
    url = '/sales';
  } else if (data.type === 'order_message_seller' || data.type === 'order_message_buyer' ||
             data.type === 'refund_request' || data.type === 'refund_rejected' || data.type === 'refund_initiated') {
    url = data.related_order_id ? `/order-chat/${data.related_order_id}` : '/cart';
  } else if (data.type === 'support_message') {
    url = data.related_thread_id ? `/contact-support/${data.related_thread_id}` : '/contact-support';
  } else if (data.type === 'order_shipped' || data.type === 'order_delivered') {
    url = '/cart';
  } else if (data.related_listing_id) {
    url = `/listing/${data.related_listing_id}`;
  } else {
    url = '/notifications';
  }

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
