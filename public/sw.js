const CACHE_NAME = 'mercado-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network-first strategy to prevent SPAs from caching old index.html and 404ing on chunks
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If successful, return the fresh network response
        return networkResponse;
      })
      .catch(() => {
        // If offline, fallback to cache
        return caches.match(e.request).then((cachedResponse) => {
          // If the request isn't in cache, fallback to the root index.html (useful for SPA offline routing)
          return cachedResponse || caches.match('/');
        });
      })
  );
});
