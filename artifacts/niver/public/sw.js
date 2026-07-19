const CACHE = 'niver-barco-shell-v8';
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
  // Navegação nunca cai no HTML armazenado quando há rede: é o ponto mais
  // importante para não executar bundle antigo após um deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Só assets versionados entram no cache dinâmico. Não guardar HTML,
        // manifest ou service worker impede que a versão antiga se perpetue.
        const destination = event.request.destination;
        if (destination === 'script' || destination === 'style' || destination === 'image' || destination === 'font') {
          const cached = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, cached));
        }
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
