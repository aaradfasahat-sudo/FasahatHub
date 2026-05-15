// Always install immediately and take control
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Delete ALL caches so the browser never serves stale JS bundles
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-only: never serve from cache, always go to network
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
