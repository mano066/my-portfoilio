const CACHE_NAME = 'manova-portfolio-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/profile.html',
  '/projects.html',
  '/publications.html',
  '/styles.css',
  '/app.js',
  '/profile.jpg',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
