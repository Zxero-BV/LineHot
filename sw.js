// Service worker de LineHot: red primero (siempre la versión nueva si hay conexión) y copia local para jugar sin conexión.
// Si cambias archivos del juego y quieres forzar limpieza de la copia antigua, sube el número de CACHE.
const CACHE = 'linehot-v20', FONTS = 'linehot-fuentes';   // la tipografía (Google Fonts) se guarda aparte para jugar sin conexión
const FILES = ['./', 'index.html', 'estilos.css', 'nube.js', 'motor.js', 'extras.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const u = new URL(e.request.url);
    if (u.origin !== self.location.origin) {
        // Solo la tipografía se guarda (primero la copia local y se actualiza en segundo plano). Supabase y demás: directo a la red.
        if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
            e.respondWith(caches.open(FONTS).then(c => c.match(e.request).then(m => {
                const red = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()); return r; }).catch(() => m);
                return m || red;
            })));
        }
        return;
    }
    e.respondWith(fetch(e.request).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
