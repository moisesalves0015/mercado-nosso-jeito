const CACHE_NAME = 'mercado-v3';
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
  // Ignorar métodos diferentes de GET (ex: POST do Firebase Auth/Firestore)
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Nunca interceptar requisições cross-origin (googleapis, firebaseapp, gstatic, accounts.google)
  // nem rotas internas de handler de autenticação OAuth
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/auth')) {
    return;
  }

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
          if (cachedResponse) return cachedResponse;
          // Apenas para navegação de página (SPA), retornar o index.html em modo offline
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
          return Response.error();
        });
      })
  );
});
