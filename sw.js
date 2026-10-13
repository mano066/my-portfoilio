// Network-first service worker: always serve fresh content when online,
// fall back to the last cached copy when offline.
const CACHE_NAME = 'manova-portfolio-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/profile.html',
  '/projects.html',
  '/publications.html',
  '/styles.css',
  '/app.js',
  '/scene.js',
  '/vendor/three.module.min.js',
  '/assets/profile.webp',
  '/assets/profile.jpg',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Cache what we can; one missing file must not abort the install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
