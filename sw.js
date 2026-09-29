// Guarda la app para que funcione sin conexión. Nunca ve tus movimientos: solo cachea estos archivos.
const CACHE_VERSION = 'midinero-v5';
const FILES = ['./', 'index.html', 'engine.js', 'sync.js', 'vendor/xlsx.full.min.js', 'vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Siempre la versión más nueva si hay conexión (sin caché del navegador); la guardada si no la hay.
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
