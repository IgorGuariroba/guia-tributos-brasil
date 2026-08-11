const CACHE = 'guia-tributos-sha256-52cfbe70e7c4fba05cc2d55d607addef5df7a3aaaeb1a34838ad7288f20e4393';
const PRECACHE = ["./","index.html","manifest.webmanifest","favicon.svg","og-image.png","api/tributos.json","api/tributos.csv"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('guia-tributos-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./').then(cached => cached || caches.match('index.html')) : Response.error())));
});
