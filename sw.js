// Guarda la app para que funcione sin conexión. Nunca ve tus movimientos: solo cachea estos archivos.
const CACHE_VERSION = 'midinero-v39';
const FILES = ['./', 'index.html', 'iconos-data.js', 'iconos.js', 'engine.js', 'sync.js', 'ui.js', 'core.js', 'base.css', 'cuaderno.js', 'hub.js', 'trabajo.js', 'festivos.js', 'tiempo.js', 'rapido.js', 'calendario.js', 'apps.js', 'ics.js', 'avisos.js', 'efemerides.js', 'planes.js', 'barcelona.js', 'extras.js', 'tareas.js', 'copias.js', 'mas.js', 'futbol.js', 'noticias.js', 'mejoras.js', 'viajes.js', 'mas2.js', 'nuevo.js', 'asistente.js', 'rutinas.js', 'mapa.js', 'apple.js', 'hub.css', 'fonts/bricolage.woff2', 'fonts/figtree.woff2', 'fonts/figtree-italic.woff2', 'fonts/flags.woff2', 'vendor/xlsx.full.min.js', 'vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('midinero-') && k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const fresh = () => fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE_VERSION).then(ca => ca.put(e.request, c)); } return r; });
  // Los archivos de la app salen al momento de lo guardado y se actualizan por detrás para la próxima vez
  // (y cuando hay versión nueva de verdad, este archivo cambia, se instala entera y la app se recarga sola).
  if (url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => { const net = fresh().catch(() => hit); if (hit) { e.waitUntil(net.catch(() => {})); return hit; } return net; }));
    return;
  }
  // Lo de tus otras apps (menú, artistas…): siempre lo más nuevo; lo guardado solo sin conexión.
  e.respondWith(fresh().catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// Al tocar un aviso, se abre (o se trae al frente) la app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow('./#cal'); }));
});
