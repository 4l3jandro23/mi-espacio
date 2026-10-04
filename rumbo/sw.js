// Guarda Rumbo para que funcione sin conexión. Nunca ve tus movimientos: solo cachea estos archivos.
const CACHE_VERSION = 'rumbo-v1';
const FILES = ['./', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png', '../base.css', '../hub.css', '../rumbo.css', '../iconos-data.js', '../iconos.js', '../engine.js', '../sync.js', '../ui.js', '../core.js', '../deudas.js', '../rumbo.js', '../fonts/bricolage.woff2', '../fonts/figtree.woff2', '../vendor/xlsx.full.min.js', '../vendor/qrcode.min.js', '../vendor/jsQR.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('rumbo-') && k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const fresh = () => fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); } return r; });
  // Al momento desde lo guardado y se actualiza por detrás (cuando hay versión nueva, este archivo cambia y se instala entera).
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => { const net = fresh().catch(() => hit); if (hit) { e.waitUntil(net.catch(() => {})); return hit; } return net; }));
});
