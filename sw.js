// Guarda la app para que funcione sin conexión. Nunca ve tus movimientos: solo cachea estos archivos.
const CACHE_VERSION = 'midinero-v1';
const FILES = ['./', 'index.html', 'engine.js', 'vendor/xlsx.full.min.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
