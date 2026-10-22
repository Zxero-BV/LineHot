// ########## [nube.js] ##########
// =====================================================================
//  NUBE — guarda los datos del juego en Supabase en vez de solo en el teléfono
//
//  1. Pon tus claves aquí abajo (NUBE_CONFIG). Usa la clave "anon" o "publishable".
//     NUNCA pegues la clave "service_role" en un archivo del juego.
//  2. Ejecuta supabase.sql en el SQL Editor y activa "Allow anonymous sign-ins".
//
//  Cómo funciona:
//   - Cada navegador entra a Supabase como usuario anónimo (sin registrarse) y su sesión
//     se queda en el teléfono. Sus datos solo los puede ver/editar ese usuario (RLS).
//   - localStorage sigue existiendo como copia local: el juego funciona sin internet y
//     el progreso que ya tenían los jugadores se sube solo la primera vez.
//   - Al abrir el juego se esperan hasta ESPERA_MS segundos a la nube. Si no responde,
//     se juega con los datos locales y NO se sube nada en esa sesión (así no se pisa
//     lo guardado). La próxima vez se sincroniza.
//   - Si localStorage está bloqueado (modo privado, navegador de WhatsApp...), el juego
//     carga igual pero sin guardar nada, y no se crean usuarios anónimos de más.
//  Va ANTES que core.js. Depuración: Nube.estado() en la consola.
// =====================================================================
const NUBE_CONFIG = {
    URL: 'PEGA_AQUI_TU_PROJECT_URL',            // ej: https://abcdefgh.supabase.co
    KEY: 'PEGA_AQUI_TU_ANON_O_PUBLISHABLE_KEY', // Project Settings -> API
    TABLA: 'linehot_datos',
    ESPERA_MS: 6000,                            // máximo esperando a la nube al abrir el juego
    GUARDAR_MS: 2500                            // agrupa los guardados para no saturar la red
};

const Nube = (() => {
    const C = NUBE_CONFIG;
    const base = String(C.URL || '').replace(/\/+$/, '');
    const configurado = /^https?:\/\/[^\s/]+$/i.test(base) && String(C.KEY || '').length > 30 && !/PEGA_AQUI/.test(base + C.KEY);

    // ---- almacenamiento real del navegador (puede estar bloqueado) ----
    let real = null;
    try { real = window.localStorage; real.setItem('__lh', '1'); real.removeItem('__lh'); } catch (e) { real = null; }
    const rget = (k) => { try { return real ? real.getItem(k) : null; } catch (e) { return null; } };
    const rset = (k, v) => { try { if (real) real.setItem(k, v); } catch (e) {} };
    const rdel = (k) => { try { if (real) real.removeItem(k); } catch (e) {} };

    const activo = configurado && !!real;
    const SESION_K = 'linehotNubeSesion', TS_K = 'linehotNubeTs';
    const SYNC = /^(neonCarnage|linehot)[A-Za-z0-9_.-]*$/;
    const sincronizable = (k) => SYNC.test(k) && k.length <= 60 && k.indexOf('linehotNube') !== 0;
    const MAX_VALOR = 150000;

    // ---- datos en memoria (copia fiel de lo que hay en el teléfono) ----
    const datos = new Map();      // clave -> texto
    let ts = {};                  // clave -> momento del último cambio local (ms)
    try {
        if (real) for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && sincronizable(k)) datos.set(k, real.getItem(k)); }
        ts = JSON.parse(rget(TS_K) || '{}') || {};
    } catch (e) { ts = {}; }
    const guardarTs = () => rset(TS_K, JSON.stringify(ts));

    const sucias = new Set(), borradas = new Set();
    let sincronizado = false, enVuelo = false, timer = null, ultimoError = '';
    const oyentes = [];
    const notificar = () => { for (const f of oyentes) { try { f(); } catch (e) {} } };

    // ---- sustituto de window.localStorage (el juego sigue usándolo igual) ----
    const shim = {
        getItem(k) { k = String(k); if (!sincronizable(k)) return rget(k); return datos.has(k) ? datos.get(k) : null; },
        setItem(k, v) {
            k = String(k); v = String(v);
            if (!sincronizable(k)) { rset(k, v); return; }
            if (datos.get(k) === v) return;
            datos.set(k, v); ts[k] = Date.now(); rset(k, v); guardarTs();
            if (activo && v.length <= MAX_VALOR) { sucias.add(k); borradas.delete(k); programar(); }
        },
        removeItem(k) {
            k = String(k); if (!sincronizable(k)) { rdel(k); return; }
            if (!datos.has(k)) return;
            datos.delete(k); ts[k] = Date.now(); rdel(k); guardarTs();
            sucias.delete(k); if (activo) { borradas.add(k); programar(); }
        },
        clear() { [...datos.keys()].forEach(k => shim.removeItem(k)); },
        key(i) { return [...datos.keys()][i] || null; },
        get length() { return datos.size; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e) {}

    // ---- red ----
    function tiempo(ms, ext) {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
        if (ext) ext.addEventListener('abort', () => { clearTimeout(t); c.abort(); });
        return c.signal;
    }
    function pedir(metodo, ruta, o) {
        o = o || {};
        const h = Object.assign({ apikey: C.KEY, 'Content-Type': 'application/json' }, o.headers || {});
        if (o.token) h.Authorization = 'Bearer ' + o.token;
        return fetch(base + ruta, { method: metodo, headers: h, body: o.body === undefined ? undefined : JSON.stringify(o.body), signal: o.signal, keepalive: !!o.keepalive });
    }

    // ---- sesión anónima ----
    let sesion = null, sesionP = null;
    try { sesion = JSON.parse(rget(SESION_K) || 'null'); } catch (e) { sesion = null; }
    if (sesion && !(sesion.access_token && sesion.refresh_token && sesion.user_id)) sesion = null;
    const vigente = () => !!sesion && (sesion.expires_at * 1000 - Date.now() > 60000);
    function guardarSesion(j) {
        sesion = {
            access_token: j.access_token, refresh_token: j.refresh_token,
            expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)),
            user_id: (j.user && j.user.id) || (sesion && sesion.user_id)
        };
        rset(SESION_K, JSON.stringify(sesion));
    }
    async function nuevaSesion(signal) {
        if (sesion && sesion.refresh_token) {
            const r = await pedir('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: sesion.refresh_token }, signal });
            if (r.ok) { guardarSesion(await r.json()); return sesion; }
            if (r.status >= 500 || r.status === 429) throw new Error('auth ' + r.status);   // problema temporal: NO crear otro usuario
            sesion = null; rdel(SESION_K);                                                   // el token ya no sirve
        }
        const r = await pedir('POST', '/auth/v1/signup', { body: {}, signal });
        if (!r.ok) throw new Error(r.status === 422 || r.status === 400 ? 'Activa "Allow anonymous sign-ins" en Authentication de Supabase (' + r.status + ')' : 'signup ' + r.status);
        guardarSesion(await r.json());
        return sesion;
    }
    function asegurarSesion(forzar, signal) {
        if (!forzar && vigente()) return Promise.resolve(sesion);
        if (!sesionP) sesionP = nuevaSesion(signal).finally(() => { sesionP = null; });
        return sesionP;
    }
    async function api(metodo, ruta, o) {
        o = o || {};
        for (let i = 0; i < 2; i++) {
            const s = await asegurarSesion(i === 1, o.signal);
            const r = await pedir(metodo, ruta, Object.assign({}, o, { token: s.access_token }));
            if (r.status !== 401 || i === 1) return r;
        }
    }

    // ---- bajar datos de la nube y mezclarlos con los locales ----
    async function hidratar(signal) {
        const r = await api('GET', '/rest/v1/' + C.TABLA + '?select=clave,valor,updated_at&limit=1000', { signal });
        if (!r.ok) throw new Error(r.status === 404 ? 'No existe la tabla ' + C.TABLA + ': ejecuta supabase.sql' : 'leer ' + r.status);
        const filas = await r.json();
        if (signal && signal.aborted) throw new Error('tiempo agotado');
        const enNube = new Set();
        for (const f of filas) {
            const k = f.clave; if (!sincronizable(k)) continue;
            enNube.add(k);
            const tn = Date.parse(f.updated_at) || 0, tl = ts[k] || 0;
            if (datos.has(k) && tl > tn) { sucias.add(k); continue; }                    // lo local es más nuevo: se sube
            if (!datos.has(k) && tl > tn) { borradas.add(k); continue; }                 // se borró aquí después: se borra allá
            if (datos.get(k) !== f.valor) { datos.set(k, f.valor); rset(k, f.valor); }   // la nube manda
            ts[k] = tn;
        }
        for (const k of datos.keys()) if (!enNube.has(k) && datos.get(k).length <= MAX_VALOR) sucias.add(k);   // progreso que solo estaba en el teléfono
        guardarTs();
    }
    function listo() {
        if (!activo) return Promise.resolve(false);
        return new Promise((res) => {
            const ctl = new AbortController();
            const t = setTimeout(() => { ctl.abort(); ultimoError = 'la nube tardó demasiado: se juega con datos locales'; notificar(); res(false); }, C.ESPERA_MS);
            hidratar(ctl.signal).then(() => { sincronizado = true; clearTimeout(t); programar(); notificar(); res(true); })
                .catch((e) => { clearTimeout(t); ultimoError = String((e && e.message) || e); console.warn('[nube]', ultimoError); notificar(); res(false); });
        });
    }

    // ---- subir cambios ----
    // Un solo temporizador pendiente: sube como mucho cada GUARDAR_MS aunque el juego siga escribiendo
    // (si se reiniciara con cada cambio, durante una partida nunca llegaría a subir).
    function programar(ms) {
        if (!sincronizado || timer) return;
        timer = setTimeout(() => { timer = null; subir(); }, ms || C.GUARDAR_MS);
        notificar();
    }
    function ruta(m) { return m === 'up' ? '/rest/v1/' + C.TABLA + '?on_conflict=user_id,clave' : null; }
    function rutaBorrar(ks) { return '/rest/v1/' + C.TABLA + '?clave=in.(' + ks.join(',') + ')'; }
    async function subir() {
        if (!sincronizado) return;
        if (enVuelo) { programar(); return; }
        const ups = [...sucias].filter(k => datos.has(k)), dels = [...borradas];
        if (!ups.length && !dels.length) return;
        sucias.clear(); borradas.clear(); enVuelo = true;
        let fallo = false;
        try {
            const uid = (await asegurarSesion()).user_id;
            if (ups.length) {
                const filas = ups.map(k => ({ user_id: uid, clave: k, valor: datos.get(k) }));
                const r = await api('POST', ruta('up'), { headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: filas, signal: tiempo(15000) });
                if (!r.ok) throw new Error('subir ' + r.status);
            }
            if (dels.length) {
                const r = await api('DELETE', rutaBorrar(dels), { headers: { Prefer: 'return=minimal' }, signal: tiempo(15000) });
                if (!r.ok) throw new Error('borrar ' + r.status);
            }
            ultimoError = '';
        } catch (e) {
            fallo = true; ultimoError = String((e && e.message) || e);
            ups.forEach(k => sucias.add(k)); dels.forEach(k => borradas.add(k));
        } finally { enVuelo = false; }
        if (fallo) programar(15000); else if (sucias.size || borradas.size) programar();
        notificar();
    }
    // Al cerrar o esconder la página: envío rápido con keepalive. Es solo un extra: si el navegador lo corta, no se pierde nada,
    // porque la copia local queda marcada como más nueva y se sube sola la próxima vez que se abra el juego.
    function subirUrgente() {
        if (!sincronizado || !vigente()) return;
        const ups = [...sucias].filter(k => datos.has(k)), dels = [...borradas];
        if (!ups.length && !dels.length) return;
        const cuerpo = JSON.stringify(ups.map(k => ({ user_id: sesion.user_id, clave: k, valor: datos.get(k) })));
        if (cuerpo.length > 55000) { subir(); return; }
        sucias.clear(); borradas.clear();
        const h = { apikey: C.KEY, Authorization: 'Bearer ' + sesion.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
        try {
            if (ups.length) fetch(base + ruta('up'), { method: 'POST', headers: h, body: cuerpo, keepalive: true }).catch(() => {});
            if (dels.length) fetch(base + rutaBorrar(dels), { method: 'DELETE', headers: h, keepalive: true }).catch(() => {});
        } catch (e) {}
    }
    // Se llama cuando ya cargaron todos los scripts, para ir DESPUÉS de los guardados de extras.js
    function engancharSalida() {
        window.addEventListener('pagehide', subirUrgente);
        document.addEventListener('visibilitychange', () => { if (document.hidden) subirUrgente(); });
    }
    // Pinta el estado en un elemento de la página (p. ej. <p id="cloudStatus">): guardado / sincronizando / sin conexión
    function texto() {
        if (!activo) return null;
        if (!sincronizado) return ['\u2601 SIN CONEXI\u00d3N \u00b7 SE GUARDA EN ESTE DISPOSITIVO', 'warn'];
        if (ultimoError) return ['\u2601 NO SE PUDO SUBIR \u00b7 REINTENTANDO', 'warn'];
        if (sucias.size || borradas.size || enVuelo) return ['\u2601 SINCRONIZANDO\u2026', ''];
        return ['\u2601 GUARDADO EN LA NUBE', ''];
    }
    function vincular(id) {
        const el = document.getElementById(id); if (!el) return;
        const pintar = () => {
            const t = texto();
            if (!t) { el.classList.add('hidden'); return; }
            el.classList.remove('hidden'); el.classList.toggle('warn', t[1] === 'warn');
            if (el.textContent !== t[0]) el.textContent = t[0];
        };
        oyentes.push(pintar); pintar();
    }
    function estado() { return { configurado, localStorageDisponible: !!real, activo, sincronizado, pendientes: sucias.size + borradas.size, usuario: sesion && sesion.user_id, ultimoError }; }

    return { listo, subir, subirUrgente, engancharSalida, vincular, estado };
})();
