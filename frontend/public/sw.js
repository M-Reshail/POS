/**
 * AbdulHaq POS — Web Push Service Worker
 *
 * Registered at /sw.js (served from public/ by Vite).
 *
 * Listens for 'push' events from the backend web-push delivery and shows
 * a native OS-level notification using the Notifications API.
 *
 * Payload format (JSON string):
 *   { title: string, body: string }
 *
 * Clicking the notification focuses the app window (or opens it if closed).
 */

/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  let title = 'AbdulHaq POS';
  let body  = 'You have a new payment reminder.';
  let icon  = '/images/logo.png'; // falls back gracefully if missing

  try {
    const data = event.data ? event.data.json() : {};
    if (data.title) title = data.title;
    if (data.body)  body  = data.body;
  } catch (_) {
    // Malformed payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:  icon,
      tag:    'payment-reminder', // collapse multiple into one notification
      renotify: true,             // still vibrate/sound even if same tag
      data: { url: self.location.origin + '/admin/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open, focus it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
