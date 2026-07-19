const CACHE = 'niver-barco-shell-v5';
const SHELL = [
  '/',
  '/evento',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/renker-niver-app-icon-192.png',
  '/renker-niver-app-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('niver-barco-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || event.request.url.includes('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cached = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, cached));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'Renker Niver Barco', {
    body: data.body || '',
    icon: '/renker-niver-app-icon-192.png',
    badge: '/favicon.svg',
    tag: data.tag || 'niver-barco',
    data: { url: data.url || '/evento' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      if (windows[0]) return windows[0].focus().then(() => windows[0].navigate(event.notification.data.url));
      return clients.openWindow(event.notification.data.url);
    }),
  );
});
