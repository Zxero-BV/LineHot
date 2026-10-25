// Service worker de LineHot: red primero (siempre la versión nueva si hay conexión) y copia local para jugar sin conexión.
// Si cambias archivos del juego y quieres forzar limpieza de la copia antigua, sube el número de CACHE.
const CACHE = 'linehot-v46', FONTS = 'linehot-fuentes';   // la tipografía (Google Fonts) se guarda aparte para jugar sin conexión
const FILES = ['./', 'index.html', 'estilos.css', 'nube.js', 'motor.js', 'js/01-base.js', 'js/02-enemigos.js', 'js/03-jefe-null-signal.js', 'js/04-ritmo-y-rangos.js', 'js/05-armas.js', 'js/06-pixel-art.js', 'js/07-animaciones.js', 'js/08-sistema.js', 'js/09-jefes-y-minijefes.js', 'js/10-armas-inventario.js', 'js/11-partida.js', 'js/12-dificultad.js', 'js/12b-jefes-unicos.js', 'js/13-ranking.js', 'js/13b-admin.js', 'js/14-carga.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'musica/happy.mp3', 'musica/shock.mp3', 'musica/addict.mp3', 'musica/epic.mp3', 'musica/boss.mp3', 'musica/abyss.mp3', 'musica/mini.mp3', 'musica/techno.mp3', 'musica/incoming.mp3'];
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
    // La música (MP3) no cambia entre versiones (si la cambias, sube el número de CACHE): primero la copia local, así carga al instante y sin gastar datos.
    if (u.pathname.indexOf('/musica/') !== -1) {
        e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })));
        return;
    }
    e.respondWith(fetch(e.request).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
