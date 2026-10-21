// Service worker de LineHot: red primero (siempre la versión nueva si hay conexión) y copia local para jugar sin conexión.
// Si cambias archivos del juego y quieres forzar limpieza de la copia antigua, sube el número de CACHE.
const CACHE = 'linehot-v2';
const FILES = ['./', 'index.html', 'estilos.css', 'core.js', 'audio.js', 'entities.js', 'engine.js', 'controles.js', 'menus.js', 'walls.js', 'jefes.js', 'sfx.js', 'arranque.js', 'extras.js', 'carga.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
