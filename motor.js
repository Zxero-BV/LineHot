// =====================================================================
//  LINEHOT · MOTOR DEL JUEGO
//  Base del juego: núcleo, audio, entidades, bucle, controles, menús, paredes, jefes, efectos de sonido y arranque.
//  Cada sección empieza con una marca  // ########## [archivo.js] ##########  (búscala con Ctrl+F).
//  Secciones, en orden de ejecución (NO cambiar el orden: unas envuelven funciones de otras):
//    · [core.js]  constantes, colores, zoom/resize, armas, colisiones
//    · [audio.js]  motor de audio y música (MP3 en bucle, carpeta musica/)
//    · [entities.js]  jugador, enemigos, balas, pickups, partículas
//    · [engine.js]  bucle principal, daño, oleadas, puntuación, HUD del jefe
//    · [controles.js]  teclado, ratón, joysticks y HUD móvil
//    · [menus.js]  menús, pausa, ajustes, fin de partida
//    · [walls.js]  paredes (laberintos), cámara, horizontal
//    · [jefes.js]  jefe y minijefes (IA y patrones)
//    · [sfx.js]  efectos de sonido
//    · [arranque.js]  arranque y modos de calidad
// =====================================================================

// ########## [core.js] ##########
// ===== ALMACENAMIENTO SEGURO =====
// En navegadores integrados (WhatsApp, Instagram, Facebook...), modo privado o con cookies bloqueadas,
// tocar localStorage/sessionStorage LANZA un error y el juego entero dejaba de cargar. Aquí se sustituye por memoria.
(function () {
    function mem() { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; }, clear: () => { for (const k in d) delete d[k]; }, key: i => Object.keys(d)[i] || null, get length() { return Object.keys(d).length; } }; }
    ['localStorage', 'sessionStorage'].forEach(n => {
        let ok = false;
        try { const st = window[n]; const t = '__lh_t'; st.setItem(t, '1'); st.removeItem(t); ok = true; } catch (e) {}
        if (!ok) { try { Object.defineProperty(window, n, { value: mem(), configurable: true }); } catch (e) {} }
    });
})();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
 
const DOM = {
    score: document.getElementById('scoreEl'),
    highScore: document.getElementById('highScoreEl'),
    combo: document.getElementById('comboEl'),
    screens: document.getElementById('screens'),
    startBtn: document.getElementById('startBtn'),
    mainTitle: document.getElementById('mainTitle'),
    subTitle: document.getElementById('subTitle'),
    healthFill: document.getElementById('healthFill'),
    hpNum: document.getElementById('hpNum'),
    dashFill: document.getElementById('dashFill'),
    weaponName: document.getElementById('weaponName'),
    weaponAmmo: document.getElementById('weaponAmmo'),
    uiLayer: document.getElementById('uiLayer'),
    canvas: document.getElementById('gameCanvas'),
    pulseBtn: document.getElementById('pulseBtn')
};
 
let width, height;                    // tamaño LÓGICO del mundo (unidades de el juego)
let viewW = 0, viewH = 0;             // tamaño de pantalla en px CSS
let zoom = 1, dpr = 1, renderK = 1;   // zoom del mundo, densidad de píxeles, zoom*dpr
let dprBase = 1, sprK = 1, dynScale = 1;   // v1.7: dprBase = densidad del modo de calidad · sprK = escala FIJA de los sprites · dynScale = resolución dinámica (1 = completa)
let lastTime = 0;
let PULSE_COOLDOWN = 5;                 // las mejoras lo acortan (extras.js)
const Settings = Object.assign(
    { perf: false, volume: 0.6, music: 0.6, vibrate: true, shake: true, showFps: false, aimAssist: true, pulseSide: 'right', scale: 1, autoQ: true, tutorial: true, sway: !matchMedia('(prefers-reduced-motion: reduce)').matches },
    (() => { try { return JSON.parse(localStorage.getItem('neonCarnageSettings')) || {}; } catch (e) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem('neonCarnageSettings', JSON.stringify(Settings)); } catch (e) {} }
// RESPLANDOR: shadowBlur cuesta muchísimo si se repite cada fotograma. Solo se permite mientras se pinta un
// sprite/caché (BLUR_OK); en el bucle de dibujo vale siempre 0. El modo rendimiento lo anula también ahí.
let BLUR_OK = false;
(() => {
    const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, (BLUR_OK && !Settings.perf) ? v * sprK * Q.glow : 0); }
    });
})();
const Q = { level: 0, glow: 1 };   // calidad automática: 0 = máxima ... 3 = mínima

// SPRITES CON RESPLANDOR: cada figura se pinta UNA vez (con su shadowBlur) en un lienzo pequeño y después solo se
// copia con drawImage: mismo aspecto, una fracción del coste. Se rehacen solos al cambiar resolución o calidad.
const Spr = {
    map: new Map(), ver: '', stamp: 0,
    sync() {
        const v = sprK.toFixed(3) + '|' + Settings.perf + '|' + Q.level;   // sprK no cambia con la resolución dinámica: los sprites no se rehacen
        if (v !== this.ver) { this.ver = v; this.map.clear(); this.stamp++; if (typeof warmSprites === 'function') warmSprites(); }
    },
    make(id, w, h, draw) {                       // w, h en unidades del mundo; el origen queda en el centro
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil(w * sprK)); cv.height = Math.max(1, Math.ceil(h * sprK));
        const c = cv.getContext('2d');
        c.setTransform(sprK, 0, 0, sprK, cv.width / 2, cv.height / 2);
        BLUR_OK = true; try { draw(c); } finally { BLUR_OK = false; }
        const s = { cv, w: cv.width / sprK, h: cv.height / sprK };
        this.map.set(id, s); return s;
    },
    halo(color) {                                // mancha de luz suave del color dado (balas)
        const id = 'h' + color;
        return this.map.get(id) || this.make(id, 48, 48, c => {
            const g = c.createRadialGradient(0, 0, 0, 0, 0, 24);
            g.addColorStop(0, color + 'cc'); g.addColorStop(0.35, color + '55'); g.addColorStop(1, color + '00');
            c.fillStyle = g; c.fillRect(-24, -24, 48, 48);
        });
    }
};
let bestScore = (() => { try { return localStorage.getItem('neonCarnageBest') || 0; } catch (e) { return 0; } })();
DOM.highScore.innerText = `HI: ${bestScore.toString().padStart(6, '0')}`;
 
const C = {
    pink: '#ff007f', cyan: '#00f3ff', yellow: '#ffe600',
    purple: '#b537f2', green: '#00ff66', red: '#ff3333',
    bg: '#05010a', white: '#ffffff', darkGray: '#111'
};
 
const WEAPONS = {
    PISTOL: { name: "PISTOL", fireRate: 0.15, spread: 0.05, speed: 1200, color: C.yellow, damage: 1, type: 'single', recoil: 5 },
    SHOTGUN: { name: "SHOTGUN", fireRate: 0.7, spread: 0.4, speed: 1000, color: C.pink, damage: 1.5, type: 'spread', count: 6, recoil: 90, pierce: 2 },
    MINIGUN: { name: "MINIGUN", fireRate: 0.06, spread: 0.2, speed: 1600, color: C.cyan, damage: 0.7, type: 'single', recoil: 4 },
    KATANA: { name: "KATANA", fireRate: 0.4, range: 90, color: C.white, damage: 8, type: 'melee', recoil: -15, arc: Math.PI },
    RAILGUN: { name: "RAILGUN", fireRate: 1.6, color: C.cyan, damage: 12, type: 'rail', recoil: 30 },
    LASER: { name: "LASER", fireRate: 0.06, color: '#39ff14', damage: 0.5, type: 'laser', recoil: 2, g: 'Z' },
    ROCKET: { name: "ROCKET", fireRate: 0.85, color: '#ff7a00', damage: 5, type: 'rocket', recoil: 40, g: 'X' }
};
// Objetos especiales (no son armas): se aplican en extras.js
const EXTRA_PK = {
    SHIELD: { color: '#4da6ff', g: 'E' }, SLOW: { color: '#b388ff', g: 'T' },
    MAGNET: { color: '#ff9f1c', g: 'M' }, NUKE: { color: '#ff3355', g: 'B' }
};
const DROP_POOL = ['SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'HEALTH', 'ROCKET', 'LASER'];
const pkGlyph = (t) => (EXTRA_PK[t] && EXTRA_PK[t].g) || (WEAPONS[t] && WEAPONS[t].g) || t[0];
 
function haptic(ms) {
    if (Settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
}
 
let _viewKey = '';
// Zoom automático: en pantallas pequeñas el mundo se "aleja" para que quepa más campo de juego y los
// objetos no se vean enormes. El deslizador de Ajustes (Settings.scale) lo multiplica a gusto del jugador.
function computeZoom() {
    const base = clamp(Math.sqrt(window.innerWidth * window.innerHeight) / 900, 0.45, 1);
    return clamp(base * clamp(+Settings.scale || 1, 0.5, 1.8), 0.3, 1.6);
}
function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const ow = width, oh = height;
    viewW = vw; viewH = vh;
    zoom = computeZoom();
    dprBase = Settings.perf ? 1 : Math.min(window.devicePixelRatio || 1, [isTouchUI() ? 1.5 : 2, 1.25, 1, 1][Q.level]);
    // resolución dinámica: baja solo los píxeles del lienzo (nunca por debajo de ~0.75 px/px CSS) y deja intactos efectos y sprites
    dpr = Settings.perf ? 1 : Math.max(Math.min(dprBase, 0.75), dprBase * dynScale);
    renderK = zoom * dpr; sprK = zoom * dprBase;
    width = vw / zoom; height = vh / zoom;
    const pw = Math.round(vw * dpr), ph = Math.round(vh * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (typeof engine !== 'undefined' && engine) engine.needsDraw = true;   // el lienzo se borra al cambiar de tamaño
    const key = pw + 'x' + ph + '@' + zoom.toFixed(3);
    if (key === _viewKey) return;
    _viewKey = key;
    if (typeof engine !== 'undefined' && engine) {
        if (ow && oh && (Math.abs(ow - width) > 0.5 || Math.abs(oh - height) > 0.5)) engine.rescaleWorld(ow, oh);
        engine.redrawBackground();
    }
}
window.addEventListener('resize', resize);
matchMedia('(orientation: portrait)').addEventListener('change', () => { resize(); setTimeout(resize, 250); setTimeout(resize, 600); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
 
// Utilidades Matemáticas
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }   // Math.hypot es mucho más lento
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
// Al alejar el mundo (móvil) los objetos pequeños se compensan un poco para seguir viéndose bien.
const pickupBoost = () => clamp(Math.pow(1 / zoom, 0.7), 1, 1.6);
const textBoost = () => clamp(Math.pow(1 / zoom, 0.5), 1, 1.35);
const isTouchUI = () => document.body.classList.contains('touch');
 
// Devuelve SIEMPRE el mismo objeto (sin crear basura en cada llamada): hay que leerlo al momento, no guardarlo.
const _NOHIT = { hit: false }, _HIT = { hit: true, nx: 0, ny: 0, pen: 0 };
function rectCircleCollide(cx, cy, radius, rx, ry, rw, rh) {
    const tx = cx < rx ? rx : (cx > rx + rw ? rx + rw : cx), ty = cy < ry ? ry : (cy > ry + rh ? ry + rh : cy);
    const dx = cx - tx, dy = cy - ty, d2 = dx * dx + dy * dy;
    if (d2 > radius * radius) return _NOHIT;
    if (d2 === 0) {
        const dL = cx - rx, dR = rx + rw - cx, dT = cy - ry, dB = ry + rh - cy, m = Math.min(dL, dR, dT, dB);
        _HIT.pen = radius + m;
        if (m === dL) { _HIT.nx = -1; _HIT.ny = 0; } else if (m === dR) { _HIT.nx = 1; _HIT.ny = 0; }
        else if (m === dT) { _HIT.nx = 0; _HIT.ny = -1; } else { _HIT.nx = 0; _HIT.ny = 1; }
        return _HIT;
    }
    const d = Math.sqrt(d2);
    _HIT.nx = dx / d; _HIT.ny = dy / d; _HIT.pen = radius - d;
    return _HIT;
}

// ########## [audio.js] ##########
// ########## [music_mp3.js] ##########
// =====================================================================
//  MÚSICA — LineHot (v2.10): archivos MP3 en bucle
//
//  Antes la música se calculaba en tiempo real (bytebeat en un Worker + AudioWorklet): gastaba CPU sin parar y en
//  móviles flojos se entrecortaba. Ahora cada tema es un MP3 de la carpeta `musica/` que se decodifica UNA vez y se
//  reproduce en bucle con WebAudio (CPU casi nula, sin cortes). Los MP3 se generaron con las mismas fórmulas de
//  siempre (herramientas/render_musica.js) y sus finales están mezclados con su principio: el bucle no se oye.
//
//  El director adaptativo: diez temas que se cruzan según oleada, combo y vida.
//    happy  → menú y hasta que mates al primer enemigo.   shock  → tras el primer enemigo (tensión).
//    addict → oleadas 2-3 (techno).   epic → oleada ~3 a 6.   techno → oleada 7 y, más tarde, 2 oleadas de cada 10.
//    incoming → la oleada anterior a un jefe (sección 'pre': oleadas 9, 14, 19…; las capas entran poco a poco).
//    boss → oleadas de jefe (en las 10, 20, 30… suena incoming a plena capa, continuando el de la oleada anterior, y sigue en la oleada siguiente: 11, 21, 31…).   abyss → oleadas 11+ (el más oscuro).   mini → oleadas con minijefes.
//    Pantalla de mejoras: no cambia de tema; el que suena baja de volumen y se amortigua (audio.music.setMenu(true/false)).
//  Los cambios se programan para el siguiente compás del tema que suena (o pulso si es urgente), el tema nuevo
//  entra desde su primer tiempo, con fundido de potencia constante, y los cambios de escena grandes (epic, boss,
//  abyss, mini) llevan un riser de ruido y un golpe grave.
//
//  Para cambiar cuándo suena cada tema mira computeDesired() (los números son oleadas).
//  Para cambiar un tema: sustituye su MP3 en `musica/` y ajusta `n` (muestras del bucle a 44,1 kHz) y `bars`
//  (compases que dura el bucle) en MUSIC_TRACKS. Los .mp3 también están en `sw.js` (para jugar sin conexión).
// =====================================================================

// n = muestras del bucle (a 44,1 kHz, sin el relleno del codificador) · bars = compases del bucle
// fadeIn/fadeOut = segundos de cruce · major = al entrar suena un riser + impacto (cambio de «escena»)
// introBars = compases del principio que suenan UNA sola vez (después el bucle vuelve al compás introBars + 1)
const MUSIC_TRACKS = {
    happy:  { file: 'musica/happy.mp3',  n: 2540160, bars: 24, fadeIn: 2.5, fadeOut: 3.5 },
    shock:  { file: 'musica/shock.mp3',  n: 1312744, bars: 16, fadeIn: 2.5, fadeOut: 5.0 },
    addict: { file: 'musica/addict.mp3', n: 1026327, bars: 16, fadeIn: 6.0, fadeOut: 7.0 },
    epic:   { file: 'musica/epic.mp3',   n: 873813,  bars: 8,  fadeIn: 6.0, fadeOut: 7.0, major: true },
    boss:   { file: 'musica/boss.mp3',   n: 1128960, bars: 16, fadeIn: 2.5, fadeOut: 5.0, major: true },
    abyss:  { file: 'musica/abyss.mp3',  n: 1323000, bars: 16, fadeIn: 8.0, fadeOut: 8.0, major: true },
    mini:   { file: 'musica/mini.mp3',   n: 963379,  bars: 32, fadeIn: 3.5, fadeOut: 4.0, major: true },
    techno:   { file: 'musica/techno.mp3',   n: 1103764, bars: 16, fadeIn: 5.0, fadeOut: 6.0, major: true },
    incoming: { file: 'musica/incoming.mp3', n: 1966080, bars: 28, introBars: 16, fadeIn: 2.5, fadeOut: 3.0, major: true }
};
const MUSIC_ORDER = ['happy', 'shock', 'addict', 'epic', 'boss', 'abyss', 'mini', 'techno', 'incoming'];
const MUSIC_FILE_SR = 44100;       // frecuencia a la que se generaron los MP3
const MUSIC_ENC_DELAY = 1105;      // relleno inicial de un MP3 de LAME, por si un navegador no lo recorta solo

const musClamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const musStep = (a, b, x) => { x = musClamp01((x - a) / (b - a)); return x * x * (3 - 2 * x); };

class MusicEngine {
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.level = 0.6;
        this.out = ctx.createGain();                       // salida de la música (la lee el analizador del «fondo al ritmo»)
        this.out.gain.value = this.level;
        this.out.connect(dest);
        this.lp = ctx.createBiquadFilter();                // filtro que «oscurece» el sonido con el progreso y el peligro
        this.lp.type = 'lowpass'; this.lp.frequency.value = 7000; this.lp.Q.value = 0.6;
        this.lp.connect(this.out);
        this.bus = ctx.createGain();                       // compensa la potencia durante los cruces
        this.bus.connect(this.lp);

        this.touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        this.running = false; this.fading = false; this.fadeEnd = 0;
        this.baseFrame = 0;                                // fotograma del reloj de audio en que empezó la música (rejilla de los efectos)
        this.cpu = 0; this.look = 1.0; this.look0 = 1.0;   // (compatibilidad: ya no hay cálculo en tiempo real)
        this.resyncs = 0; this.rsT = []; this.lastBad = -1e9; this.lastResync = -1e9; this.liteWait = 30000; this.liteOff = -1e9;
        this.ready = false; this._readyCbs = [];
        this.timer = 0; this._tw = 0;
        this.tone = 0; this.toneT = 0; this.nrm = 1; this._cut = 7000;
        this.hp = 1; this.hbNext = 0;

        this.G = {};
        for (const id of MUSIC_ORDER) {
            const d = MUSIC_TRACKS[id], dur = d.n / MUSIC_FILE_SR;
            const g = Object.assign({ id, bar: dur / d.bars, buf: null, loading: false, failed: false, failT: 0, ls: 0, le: 0,
                                      on: false, src: null, gn: null, t0: null, w: 0, target: 0, offAt: 0 }, d);
            g.beat = g.bar / 4;
            this.G[id] = g;
        }
        this.list = MUSIC_ORDER.map(k => this.G[k]);
        this.hardReset();
        this._queue = this.touch ? ['happy', 'shock', 'addict'] : ['happy', 'shock', 'addict', 'epic', 'boss', 'mini', 'abyss', 'techno', 'incoming'];
        this._pump();
    }

    // ================= carga de los MP3 =================
    // Se cargan de uno en uno (primero el del menú) para no saturar la red ni la memoria al decodificar.
    _pump() {
        if (this.list.some(g => g.loading)) return;                       // de uno en uno; al terminar, cada carga vuelve a llamar aquí
        const id = this._queue.find(k => !this.G[k].buf && !this.G[k].failed);
        if (!id) { this._finishReady(); return; }
        this._load(id, () => this._pump());
    }
    _load(id, done) {
        const g = this.G[id];
        if (!g || g.buf || g.loading) { if (done) done(); return; }
        if (g.failed && performance.now() - g.failT < 10000) { if (done) done(); return; }
        g.loading = true; g.failed = false;
        const fin = (ok) => {
            g.loading = false;
            if (!ok) { g.failed = true; g.failT = performance.now(); }
            if (id === 'happy') this._finishReady();
            if (done) done();
        };
        try {
            fetch(g.file).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
                .then(ab => new Promise((ok, ko) => { const p = this.ctx.decodeAudioData(ab, ok, ko); if (p && p.catch) p.catch(ko); }))
                .then(buf => {
                    // Si el navegador no recortó el relleno del MP3, el bucle se desplaza para que caiga justo en la música.
                    const sr = buf.sampleRate, len = Math.round(g.n * sr / MUSIC_FILE_SR);
                    const pad = (buf.length - len >= 600) ? Math.round(MUSIC_ENC_DELAY * sr / MUSIC_FILE_SR) : 0;
                    g.ls = pad / sr; g.le = (pad + Math.min(len, buf.length - pad)) / sr;
                    g.buf = buf; fin(true);
                })
                .catch(() => fin(false));
        } catch (e) { fin(false); }
    }
    _finishReady() {
        if (this.ready || !this.G.happy || (!this.G.happy.buf && !this.G.happy.failed)) return;
        this.ready = true; const l = this._readyCbs; this._readyCbs = []; l.forEach(f => f(true));
        if (this.running) this._ensureSources();             // el menú ya sonaba pero el MP3 aún no estaba: entra ahora
    }
    // Pantalla de carga: avisa cuando el tema del menú ya está decodificado (o tras 'ms' como máximo).
    whenReady(cb, ms = 15000) {
        if (this.ready) { cb(true); return; }
        let done = false;
        const fin = (ok) => { if (done) return; done = true; clearTimeout(t); cb(ok); };
        const t = setTimeout(() => fin(false), ms);
        this._readyCbs.push(fin);
    }
    // En móvil se cargan los temas por delante de donde vas (y se sueltan los que llevan rato sin sonar) para gastar poca memoria.
    _wantLoaded(w) {
        const need = ['happy'];
        if (w >= 0) need.push('shock', 'addict');
        if (w >= 2 || !this.touch) need.push('epic');
        if (w >= 3 || !this.touch) need.push('boss', 'mini');
        if (w >= 6 || !this.touch) need.push('abyss');
        if (w >= 5 || !this.touch) need.push('techno');
        if (w >= 7 || !this.touch) need.push('incoming');
        for (const k of need) { const g = this.G[k]; if (!g.buf && !g.loading) { if (!this._queue.includes(k)) this._queue.push(k); } }
        this._pump();
    }

    // ================= motor =================
    call(f, ...a) { if (typeof f === 'string' && f[0] !== '_' && typeof this[f] === 'function') { try { this[f](...a); } catch (e) {} } }

    start() {
        const now = this.ctx.currentTime;
        if (this.running) {
            if (this.fading) {                              // se estaba apagando: vuelve suavemente
                this.fading = false;
                this.out.gain.cancelScheduledValues(now);
                this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
                this.out.gain.linearRampToValueAtTime(this.level, now + 0.4);
            }
            return;
        }
        this.running = true; this.fading = false;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(0.0001, now);
        this.out.gain.linearRampToValueAtTime(this.level, now + 0.5);
        this.baseFrame = Math.ceil((now + 0.1) * this.ctx.sampleRate);
        this._clk = null; this._tw = performance.now();
        this._ensureSources();
        clearInterval(this.timer);
        this.timer = setInterval(() => this._tick(), 50);
    }

    // Sin fundido: corta ya. Con fade (s): la música se «apaga» bajando volumen y cerrando el filtro.
    stop(fade = 0) {
        if (!this.running) return;
        if (fade <= 0) { this.finishStop(); return; }
        if (this.fading) return;
        const now = this.ctx.currentTime;
        this.fading = true;
        this.fadeEnd = now + fade + 0.1;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
        this.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    }

    finishStop() {
        this.running = false; this.fading = false;
        clearInterval(this.timer); this.timer = 0;
        for (const g of this.list) this._killSource(g);
        const now = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(0.0001, now);
        this.pending = null; this.fx = null;
        this.hardReset();
    }

    // Reparte los tiempos de arranque de los temas que deben sonar y aún no tienen fuente (menú / nueva partida)
    _ensureSources() {
        const at = this.ctx.currentTime + 0.08;
        for (const g of this.list) if (g.on && !g.src && g.buf) { this._startSource(g, at); g.w = Math.max(g.w, g.target); }
    }
    _startSource(g, at) {
        this._killSource(g);
        const c = this.ctx, s = c.createBufferSource(), n = c.createGain();
        s.buffer = g.buf; s.loop = true; s.loopStart = g.ls + (g.introBars ? g.introBars * g.bar : 0); s.loopEnd = g.le;   // introBars: el principio suena una vez
        n.gain.value = 0.0001;
        s.connect(n); n.connect(this.bus);
        const skip = g.introBars && this.eff() === 'boss' ? g.introBars * g.bar : 0;   // si entra ya en plena pelea de jefe, salta la intro (arpegio solo)
        s.start(at, g.ls + skip);
        g.src = s; g.gn = n; g.t0 = at - skip;                                         // t0 «virtual»: los compases siguen cuadrando
    }
    _killSource(g) {
        if (g.src) { try { g.src.stop(); } catch (e) {} try { g.src.disconnect(); } catch (e) {} }
        if (g.gn) { try { g.gn.disconnect(); } catch (e) {} }
        g.src = null; g.gn = null; g.t0 = null;
    }

    hardReset() {
        this.kills = 0; this.waveKills = 0; this.wave = 0; this.combo = 0; this.waveSize = 0;
        this.section = 'idle'; this.last = 'idle'; this.menu = false; this.menuF = 0;
        this.hp = 1; this.energy = 0; this.calm = 0; this.bossF = 0; this.lowhp = 0; this.dark = 0;
        this.pending = null; this.fx = null; this.urgent = false;
        for (const g of this.list) {
            this._killSource(g);
            g.on = false; g.w = 0; g.target = 0; g.offAt = performance.now();
        }
        const h = this.G.happy;
        h.on = true; h.w = 1; h.target = 1;
    }
    // Nueva partida o vuelta al menú. Si la música sigue sonando, vuelve al tema alegre con una transición normal.
    newRun() {
        if (this.fading) this.finishStop();
        if (!this.running) { this.hardReset(); return; }
        this.softNewRun();
    }
    softNewRun() {
        this.kills = 0; this.waveKills = 0; this.wave = 0; this.combo = 0;
        this.section = 'idle'; this.last = 'idle'; this.menu = false;
        this.urgent = true;
    }

    // ================= control desde el juego =================
    onKill() { this.kills++; this.waveKills++; if (this.kills === 1) this.urgent = true; }   // primer enemigo: cambio de tema sin esperar al compás
    // Sección «efectiva»: el descanso entre oleadas ('calm') conserva la música de la oleada anterior.
    eff() { return this.section === 'calm' ? (this.last || 'fight') : this.section; }
    setSection(name) {
        if (name === this.section) return;
        const prev = this.eff();
        if (name !== 'calm') this.last = name;
        const next = name === 'calm' ? prev : name;
        if (next !== prev && (next === 'boss' || prev === 'boss')) this.urgent = true;
        this.section = name;
    }
    // Pantalla de mejoras: la música de la oleada sigue, pero más baja y amortiguada (suave). Si el juego sale de ese estado por otro camino, se apaga sola.
    setMenu(on) { this.menu = !!on; }
    setWave(w) { this.wave = w; this.waveKills = 0; this.waveSize = 0; this._wantLoaded(w); }
    setWaveSize(n) { this.waveSize = n; }              // enemigos que tiene la oleada (para medir su avance)
    setCombo(c) { this.combo = c; }
    setHealth(f) { this.hp = musClamp01(f); }
    setLevel(v) {
        this.level = v;
        if (this.running && !this.fading) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
    setQuality() {}                                    // (ya no hay nada que aligerar: los MP3 no cuestan CPU)
    setSampleRate() {}
    noteResync() {
        this.resyncs++;
        const t = performance.now(); this.rsT.push(t); this.lastResync = t; this.lastBad = t;
        while (this.rsT.length && t - this.rsT[0] > 10000) this.rsT.shift();
    }
    getState() {
        const t = {};
        for (const g of this.list) if (g.on) t[g.id] = { w: +g.w.toFixed(2), target: +g.target.toFixed(2) };
        return { kills: this.kills, wave: this.wave, prog: +this.prog().toFixed(2), section: this.section, pending: !!this.pending, tracks: t };
    }
    // Depuración: en la consola escribe  audio.music.diag()
    diag() {
        const c = this.ctx, cargados = {};
        for (const g of this.list) cargados[g.id] = g.buf ? 'ok' : (g.loading ? 'cargando' : (g.failed ? 'ERROR' : '-'));
        return { motor: 'mp3', cortes: this.resyncs, atascos_audio: (this.stalls || []).length, temas: cargados,
                 latencia_base_ms: Math.round((c.baseLatency || 0) * 1000), latencia_salida_ms: Math.round((c.outputLatency || 0) * 1000),
                 hz: c.sampleRate, ctx: c.state, estado: this.getState() };
    }

    // ================= director =================
    // Progreso global: oleada actual + avance dentro de ella (0, 1, 2…). Sin oleadas, por kills.
    prog() {
        if (this.wave > 0) return (this.wave - 1) + Math.min(0.95, this.waveKills / (this.waveSize || (22 + 8 * this.wave)));
        return this.kills / 30;
    }
    // Qué debe sonar ahora (presencia de cada tema entre 0 y 1).
    computeDesired() {
        const d = {};
        for (const k of MUSIC_ORDER) d[k] = 0;
        if (this.eff() === 'mini') { d.mini = 1; return d; }      // minijefes: suena solo ese tema
        if (this.eff() === 'pre') { d.incoming = 1; return d; }   // la oleada anterior a un jefe (también su descanso)
        if (this.eff() === 'boss') {                              // jefes de las oleadas 10, 20, 30…: el tema épico de «jefe en camino» (sigue sonando sin cortes desde la oleada previa); los demás: boss
            if (this.wave % 10 === 0) d.incoming = 1; else d.boss = 1;
            return d;
        }
        if (this.kills === 0) { d.happy = 1; return d; }          // alegre hasta el primer enemigo
        if (this.wave > 10 && this.wave % 10 === 1) { d.incoming = 1; return d; }   // la oleada tras los jefes 10, 20, 30…: sigue el tema épico (11, 21, 31…)
        // p = oleada actual - 1 + avance dentro de ella. Cada oleada empuja la música un paso:
        //   O1 tensión · O2 techno hipnótico · O3 techno -> épico · O6 épico · O7 techno · O11+ abismo
        //   (con el techno de vuelta en 2 oleadas de cada 10: 16-17, 26-27…). Las oleadas de jefe, minijefes y «pre» tienen su propio tema.
        const p = this.prog();
        const late = musStep(8.2, 9.2, p);
        const q = p >= 9.2 ? (p - 9.2) % 10 : 0;                    // posición dentro del ciclo de 10 oleadas del tramo final
        const rt = musStep(4.8, 5.6, q) * (1 - musStep(7.6, 8.4, q));   // presencia del techno en ese tramo
        d.shock  = 1 - musStep(0.9, 1.7, p);
        d.addict = musStep(0.9, 1.9, p) * (1 - musStep(2.3, 3.2, p));
        d.epic   = musStep(2.3, 3.2, p) * (1 - musStep(5.6, 6.1, p));
        d.techno = musStep(5.6, 6.1, p) * (1 - late) + late * rt;
        d.abyss  = late * (1 - rt);
        return d;
    }
    // Igual que computeDesired, pero sin los temas que aún no se han podido cargar (se piden y, mientras, sigue el actual).
    _desiredAvail() {
        const d = this.computeDesired();
        let sum = 0;
        for (const g of this.list) {
            if (d[g.id] > 0.001 && !g.buf) { this._load(g.id, () => this._pump()); d[g.id] = 0; }
            sum += d[g.id];
        }
        return sum > 0.001 ? d : null;
    }
    refTrack(now) {
        let best = null;
        for (const g of this.list) {
            if (g.on && g.src && g.t0 !== null && now >= g.t0 && g.w > 0.05 && (!best || g.w > best.w)) best = g;
        }
        return best;
    }
    // Si lo que debe sonar cambió, programa el cambio para el próximo compás (o pulso, si es urgente)
    // del tema dominante. Así el tema nuevo entra siempre en un tiempo fuerte.
    checkSchedule(now) {
        if (this.pending) return;
        const des = this._desiredAvail();
        if (!des) return;
        let diff = false, major = false, soft = true;
        for (const g of this.list) {
            if (Math.abs(des[g.id] - g.target) > 0.03) diff = true;
            if (des[g.id] > 0.001 && !g.on && g.major) { major = true; if (g.id !== 'mini' && g.id !== 'techno' && g.id !== 'abyss') soft = false; }
        }
        if (!diff) return;
        const ref = this.refTrack(now);
        if (major && soft && ref && ref.major) major = false;     // de un tema épico a otro épico (p. ej. incoming → minijefes): cruce limpio, sin riser ni golpe
        let at = now + 0.06;
        if (ref) {
            const unit = this.urgent ? ref.beat : ref.bar;
            const lead = major ? 0.9 : 0;                    // los cambios de escena avisan con un riser
            const k = Math.ceil((now + lead - ref.t0) / unit);
            at = ref.t0 + k * unit;
            if (at < now + 0.06) at += unit;
        }
        this.urgent = false;
        const starts = [];
        for (const g of this.list) if (des[g.id] > 0.001 && !g.on) { this._startSource(g, at); starts.push(g.id); }
        this.pending = { at, starts, quiet: !major };
        if (major) { this.fx = { from: now, hit: at }; this._riser(now, at); }
    }
    commit(now) {
        const des = this._desiredAvail() || {};
        let major = false;
        const p = this.pending; this.pending = null;
        for (const g of this.list) {
            const want = des[g.id] || 0;
            if (p.starts.includes(g.id)) {
                if (want > 0.001) { g.on = true; g.w = 0; if (g.major) major = true; }
                else this._killSource(g);                    // dejó de hacer falta antes de entrar
            }
            if (g.on) g.target = want < 0.001 ? 0 : want;
        }
        if (major && !p.quiet) this._impact(p.at);
        this.fx = null;
    }

    // Se llama cada 50 ms: suaviza los macros, mueve los pesos hacia sus objetivos y aplica las ganancias.
    _tick() {
        const ctx = this.ctx, now = ctx.currentTime, w = performance.now();
        const dt = Math.min(0.25, Math.max(0.005, (w - (this._tw || w)) / 1000)); this._tw = w;
        this.watchClock(now);
        if (!this.running) return;
        if (this.fading && now >= this.fadeEnd) { this.finishStop(); return; }
        const k = (tau) => 1 - Math.exp(-dt / tau);
        if (this.menu) { let up = false; try { up = !!engine && engine.state === 'UPGRADE'; } catch (e) {} if (!up) this.menu = false; }
        this.menuF += ((this.menu ? 1 : 0) - this.menuF) * k(this.menu ? 0.7 : 1.0);   // 0 = normal, 1 = pantalla de mejoras (más baja y apagada)

        const energyT = musClamp01(this.combo / 18);
        this.energy += (energyT - this.energy) * k(energyT > this.energy ? 0.5 : 4);
        this.calm += ((this.section === 'calm' ? 1 : 0) - this.calm) * k(1);
        this.bossF += ((this.eff() === 'boss' ? 1 : 0) - this.bossF) * k(1.5);
        this.lowhp += (musClamp01((0.38 - this.hp) / 0.26) - this.lowhp) * k(0.6);
        this.dark += (musClamp01(this.prog() / 12) - this.dark) * k(3);
        // El sonido se oscurece con el progreso y en peligro; se abre con el combo.
        this.toneT = musClamp01(this.dark * 0.55 + this.calm * 0.22 + this.lowhp * 0.55 + this.bossF * 0.08 - this.energy * 0.3 + (this.fading ? 0.9 : 0));
        this.tone += (this.toneT - this.tone) * k(1.2);

        // temas cargados tarde (el menú ya estaba «sonando» sin MP3): arrancan en cuanto llegan
        for (const g of this.list) if (g.on && !g.src && g.buf && !this.pending) { this._startSource(g, now + 0.08); g.w = g.target; }

        if (this.pending && now >= this.pending.at - 0.03) this.commit(now); else this.checkSchedule(now);

        let pw = 0, only = null, nOn = 0;
        for (const g of this.list) {
            if (!g.on) continue;
            if (g.t0 === null || now < g.t0 - 0.03) continue;          // aún no ha entrado
            if (g.w < g.target) g.w = Math.min(g.target, g.w + dt / g.fadeIn);
            else g.w = Math.max(g.target, g.w - dt / ((this.eff() === 'boss' || this.eff() === 'pre')
                ? Math.min(g.fadeOut, 1.4)            // al entrar a un jefe o al aviso de jefe los temas viejos se apagan rápido
                : this.eff() === 'mini' ? Math.min(g.fadeOut, 4.0)   // minijefes: cruce largo y suave
                : g.fadeOut));
            if (g.target === 0 && g.w <= 0.002) { g.on = false; g.offAt = w; this._killSource(g); continue; }
            const v = Math.sin(g.w * Math.PI / 2);                     // potencia constante
            if (g.gn) g.gn.gain.setTargetAtTime(Math.max(v, 0.0001), now, 0.08);
            pw += v * v; nOn++; only = g;
        }
        // Potencia total constante durante los cruces
        const nT = this.fading ? 1 : Math.min(1.5, Math.max(0.75, 1 / Math.sqrt(Math.max(pw, 0.25))));
        this.nrm += (nT - this.nrm) * k(0.8);
        this.bus.gain.setTargetAtTime(this.nrm * (1 - 0.6 * this.menuF), now, 0.3);
        // Filtro que oscurece (nunca baja de ~3,4 kHz). Con solo el tema de minijefes suena «tal cual».
        let cut = 3000 + 4000 * Math.pow(0.1, this.tone);
        if (this.eff() === 'mini' && nOn === 1 && only && only.id === 'mini') cut = 20000;
        cut = cut + (1300 - cut) * this.menuF;                                      // pantalla de mejoras: amortiguada
        if (Math.abs(cut - this._cut) > 40) { this._cut = cut; this.lp.frequency.setTargetAtTime(cut, now, 0.35); }

        // Latido cuando queda poca vida (no pasa por el filtro, siempre se oye)
        if (this.lowhp > 0.02 && !this.fading && now >= this.hbNext && ctx.state === 'running') {
            this._thump(now + 0.02, 1); this._thump(now + 0.22, 0.7);
            this.hbNext = now + 0.95 - 0.35 * this.lowhp;
        }

        // En móvil se sueltan los temas que llevan rato sin sonar (cada uno ocupa unos 15-20 MB decodificado)
        if (this.touch && (this._idleT = (this._idleT || 0) + dt) > 5) {
            this._idleT = 0;
            for (const g of this.list) if (g.buf && !g.on && !(this.pending && this.pending.starts.includes(g.id)) && w - g.offAt > 45000 && g.id !== 'happy') { g.buf = null; }
        }
    }

    // ================= efectos de transición =================
    _noise() {
        if (this._nb) return this._nb;
        const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return (this._nb = b);
    }
    // Riser de ruido que sube hasta el tiempo fuerte en que entra el tema nuevo
    _riser(from, hit) {
        const c = this.ctx, dur = Math.max(0.2, hit - from);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this._noise(); s.loop = true;
        f.type = 'bandpass'; f.Q.value = 0.8;
        f.frequency.setValueAtTime(180, from); f.frequency.exponentialRampToValueAtTime(1440, hit);
        g.gain.setValueAtTime(0.0001, from); g.gain.exponentialRampToValueAtTime(0.2, hit);
        g.gain.setValueAtTime(0.0001, hit + 0.01);
        s.connect(f); f.connect(g); g.connect(this.lp);
        s.start(from); s.stop(hit + 0.05);
        s.onended = () => { try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
    }
    // Golpe grave justo en el tiempo fuerte
    _impact(t) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), s = c.createBufferSource(), ng = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(86, t); o.frequency.setTargetAtTime(46, t, 1 / 11);
        g.gain.setValueAtTime(0.6, t); g.gain.setTargetAtTime(0.0001, t, 1 / 3);
        s.buffer = this._noise();
        ng.gain.setValueAtTime(0.18, t); ng.gain.setTargetAtTime(0.0001, t, 0.1);
        o.connect(g); g.connect(this.lp); s.connect(ng); ng.connect(this.lp);
        o.start(t); o.stop(t + 1.8); s.start(t); s.stop(t + 0.6);
        o.onended = () => { try { o.disconnect(); g.disconnect(); s.disconnect(); ng.disconnect(); } catch (e) {} };
    }
    // Un latido (dos tonos graves que decaen)
    _thump(t, amp) {
        const c = this.ctx, a = 0.4 * this.lowhp * amp;
        for (const [f, tau, v] of [[58, 1 / 20, 1], [95, 1 / 26, 0.5]]) {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(a * v, t); g.gain.setTargetAtTime(0.0001, t, tau);
            o.connect(g); g.connect(this.out);
            o.start(t); o.stop(t + 0.35);
            o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
        }
    }

    // Vigila el reloj de audio: si avanza más despacio que el reloj real, el hilo de audio del navegador se está
    // quedando sin tiempo (demasiados efectos a la vez). Si pasa 2 veces en 10 s: efectos en modo ligero.
    watchClock(now) {
        const w = performance.now();
        if (this.ctx.state !== 'running' || document.hidden) {
            this._clk = null;
            // si el navegador suspende el audio en plena partida (notificación, otra app, ahorro de batería), se reanuda solo
            if (!document.hidden && this.running && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') && w - (this._resumeT || 0) > 1500) { this._resumeT = w; try { this.ctx.resume(); } catch (e) {} }
            return;
        }
        // modo ligero RECUPERABLE: tras 30 s sin cortes vuelve el sonido completo (si recae justo después, espera el doble)
        if (typeof SFX_LITE !== 'undefined' && SFX_LITE && w - this.lastBad > this.liteWait) { SFX_LITE = false; this.rsT.length = 0; if (this.stalls) this.stalls.length = 0; this.liteOff = w; }
        const c = this._clk;
        if (!c) { this._clk = { a: now, w, A: 0, W: 0 }; return; }
        const da = (now - c.a) * 1000, dw = w - c.w;
        c.a = now; c.w = w;
        if (dw > 400) { c.A = c.W = 0; return; }       // el propio hilo principal se atascó: no es culpa del audio
        c.A += da; c.W += dw;
        if (c.W < 1000) return;
        const lost = c.W - c.A; c.A = c.W = 0;
        if (lost > 140) {                              // el audio perdió >140 ms en ese segundo
            this.stalls = (this.stalls || []); this.stalls.push(w);
            while (this.stalls.length && w - this.stalls[0] > 10000) this.stalls.shift();
            this.lastResync = w; this.lastBad = w; this.resyncs++;      // sube el nivel de carga de efectos (sfxLevel)
            if (this.stalls.length >= 2) {
                if (w - this.liteOff < 60000) this.liteWait = Math.min(this.liteWait * 2, 240000);
                if (typeof SFX_LITE !== 'undefined') SFX_LITE = true;
            }
        }
    }
}

// ########## [audio.js] ##########
// Motor de Audio
class AudioEngine {
    constructor() {
        // AUDIO ESTABLE (por defecto): buffer de salida más grande ('playback'). Con 'interactive' (~10 ms) el hilo de audio
        // del navegador se queda sin tiempo con cualquier tirón de CPU y la música suena a trompicones.
        const AC = window.AudioContext || window.webkitAudioContext;
        try { this.ctx = new AC({ latencyHint: Settings.audioSafe === false ? 'interactive' : 'playback' }); } catch (e) { this.ctx = new AC(); }
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        
        this.compressor = this.ctx.createDynamicsCompressor();
        // v1.8: antes umbral -12 dB y razón 15:1 (casi un limitador): con explosiones y la música a la vez, todo se aplastaba y «bombeaba».
        this.compressor.threshold.setValueAtTime(-9, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.006, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);
 
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        
        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.rhythmIndex = 0;
        this.music = new MusicEngine(this.ctx, this.master);
    }
 
    resume() { if(this.ctx.state === 'suspended') this.ctx.resume(); }
 
    playShoot(weaponType, isEnemy = false) {
        if(!this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
 
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
 
        if (weaponType === 'KATANA') {
            const bufferSize = this.ctx.sampleRate * 0.2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i/bufferSize)*Math.PI);
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer; noise.connect(filter);
            filter.type = 'highpass'; filter.frequency.setValueAtTime(1000, t); filter.frequency.linearRampToValueAtTime(5000, t+0.1);
            gain.gain.setValueAtTime(0.8, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            noise.start(t); return;
        }
        
        if (isEnemy) {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t); osc.stop(t + 0.2);
            return;
        }
 
        if (weaponType === 'SHOTGUN') {
            const bufferSize = this.ctx.sampleRate * 0.2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer; noise.connect(filter);
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(2000, t); filter.frequency.exponentialRampToValueAtTime(100, t + 0.25);
            gain.gain.setValueAtTime(0.7, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
            noise.start(t);
        } else if (weaponType === 'MINIGUN') {
            osc.type = 'square'; osc.frequency.setValueAtTime(700, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
            gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            osc.start(t); osc.stop(t + 0.08);
        } else {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(900, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
            gain.gain.setValueAtTime(0.25, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.start(t); osc.stop(t + 0.12);
        }
    }
 
    playHit(isPlayer = false) {
        if(!this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isPlayer ? 'sawtooth' : 'triangle';
        
        const baseFreq = isPlayer ? 150 : 800 + (Math.min(engine.combo, 50) * 10);
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(isPlayer ? 50 : 200, t + 0.1);
        gain.gain.setValueAtTime(isPlayer ? 0.8 : 0.4, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + 0.1);
    }
 
    playExplosion() {
        if(!this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t); osc.frequency.exponentialRampToValueAtTime(10, t + 0.6);
        gain.gain.setValueAtTime(1.0, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + 0.6);
    }
 
    playDash() {
        if(!this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(300, t); osc.frequency.linearRampToValueAtTime(900, t + 0.1);
        gain.gain.setValueAtTime(0.5, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + 0.15);
    }
 
    playPickup() {
        if(!this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(1400, t + 0.15);
        gain.gain.setValueAtTime(0.4, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + 0.15);
    }
 
    startMusic() { this.isPlaying = true; this.music.start(); }
    stopMusic() { this.isPlaying = false; this.music.stop(1.8); }
 
    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleBeat(this.nextNoteTime);
            this.nextNoteTime += 0.22;
            this.rhythmIndex++;
        }
        setTimeout(() => this.scheduler(), 25);
    }
 
    scheduleBeat(time) {
        if (this.rhythmIndex % 4 === 0) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain); gain.connect(this.master);
            osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(20, time + 0.15);
            gain.gain.setValueAtTime(0.8, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
            osc.start(time); osc.stop(time + 0.15);
        }
 
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();
        
        bassOsc.type = 'sawtooth';
        const notes = [41.2, 49, 36.7, 41.2, 55, 36.7]; 
        const note = notes[Math.floor(this.rhythmIndex / 2) % notes.length];
        bassOsc.frequency.setValueAtTime(note * (this.rhythmIndex % 2 === 0 ? 1 : 2), time);
 
        bassFilter.type = 'lowpass';
        const filterBase = 200 + (Math.min(engine?.combo || 0, 40) * 50);
        bassFilter.frequency.setValueAtTime(filterBase, time);
        bassFilter.frequency.exponentialRampToValueAtTime(100, time + 0.1);
 
        bassGain.gain.setValueAtTime(0.35, time);
        bassGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
 
        bassOsc.connect(bassFilter); bassFilter.connect(bassGain); bassGain.connect(this.master);
        bassOsc.start(time); bassOsc.stop(time + 0.15);
    }
}
const audio = new AudioEngine();
 

// ########## [entities.js] ##########
// Entidades del Juego
class Obstacle {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = C.green;
    }
}
 
class Entity {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius;
        this.color = color; this.vx = 0; this.vy = 0;
    }
}
 
class Player extends Entity {
    constructor(x, y) {
        super(x, y, 16, C.cyan);
        this.baseSpeed = 380;
        this.hp = 100; this.maxHp = 100;
        this.angle = 0;
        this.fireCooldown = 0;
        this.weapon = WEAPONS.PISTOL;
        this.ammo = Infinity;
        
        this.pulseCooldown = 0;

        
        this.katanaSwingTime = 0; this.kx = 0; this.ky = 0; this.iframes = 0; this.trail = [];
    }
 
    equip(weaponKey, ammoAmount) {
        this.weapon = WEAPONS[weaponKey];
        this.ammo = ammoAmount;
        engine.spawnText(this.x, this.y - 30, this.weapon.name, this.weapon.color);
    }
 
    pulse() {
        if (this.pulseCooldown > 0) return;
        this.pulseCooldown = PULSE_COOLDOWN;
        this.iframes = Math.max(this.iframes, 0.3);
        engine.shockwave(this.x, this.y, 260);
        audio.playPulse(); haptic(60);
        engine.spawnText(this.x, this.y - 40, 'PULSO', C.cyan);
    }
 
 
    shoot() {
        if (this.ammo <= 0) this.equip('PISTOL', Infinity);
 
        haptic(30);
 
        if (this.weapon.type === 'melee') {
            this.katanaSwingTime = 0.2;
            this.fireCooldown = this.weapon.fireRate;
            audio.playShoot('KATANA'); engine.slashes.push({x: this.x, y: this.y, a: this.angle, life: 0.5, r: this.weapon.range + 20}); engine.doHitStop(0.04);
            engine.addShake(8);
            
            this.x += Math.cos(this.angle) * Math.abs(this.weapon.recoil);
            this.y += Math.sin(this.angle) * Math.abs(this.weapon.recoil);
 
            engine.enemies.forEach(e => {
                let d = dist(this.x, this.y, e.x, e.y);
                if (d < this.weapon.range + e.radius) {
                    let angleToEnemy = Math.atan2(e.y - this.y, e.x - this.x);
                    let diff = Math.atan2(Math.sin(angleToEnemy - this.angle), Math.cos(angleToEnemy - this.angle));
                    if (Math.abs(diff) <= this.weapon.arc / 2) {
                        engine.hitEnemy(e, this.weapon.damage, Math.cos(this.angle)*800, Math.sin(this.angle)*800, true);
                    }
                }
            });
            return;
        }
 
        if (this.weapon.type === 'rail') {
            const c = Math.cos(this.angle), s = Math.sin(this.angle), x2 = this.x + c * 4000, y2 = this.y + s * 4000;
            engine.beams.push({x1: this.x, y1: this.y, x2, y2, life: 0.35});
            engine.enemies.forEach(e => { if (segDist(e.x, e.y, this.x, this.y, x2, y2) < e.radius + 6) engine.hitEnemy(e, this.weapon.damage, c * 900, s * 900, true); });
            for (let i = 0; i < 25; i++) engine.spawnParticle(this.x + c * i * 60, this.y + s * i * 60, C.cyan, 2, 0, 0, 150);
            this.kx -= c * 900; this.ky -= s * 900; this.ammo--; this.fireCooldown = this.weapon.fireRate;
            engine.addShake(45); engine.doHitStop(0.1); audio.playShoot('RAILGUN'); haptic(80);
            return;
        }
        let shots = this.weapon.type === 'spread' ? this.weapon.count : 1;
        for(let i=0; i<shots; i++) {
            const spread = (Math.random() - 0.5) * this.weapon.spread;
            engine.bullets.push(new Bullet(
                this.x + Math.cos(this.angle)*this.radius, 
                this.y + Math.sin(this.angle)*this.radius, 
                this.angle + spread, this.weapon, false
            ));
        }
        
        this.kx -= Math.cos(this.angle) * this.weapon.recoil * 8;
        this.ky -= Math.sin(this.angle) * this.weapon.recoil * 8;
        
        if (this.weapon.name !== 'PISTOL') this.ammo--;
        this.fireCooldown = this.weapon.fireRate;
        
        engine.addShake(this.weapon.recoil * 0.4);
        audio.playShoot(this.weapon.name); if (this.weapon.name === 'SHOTGUN') engine.doHitStop(0.04);
    }
 
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        if (this.iframes > 0 && Math.floor(this.iframes * 20) % 2) ctx.globalAlpha = 0.5;
        if (this.katanaSwingTime > 0) {
            const k = this.katanaSwingTime / 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, this.weapon.range, -this.weapon.arc / 2, this.weapon.arc / 2);
            ctx.lineWidth = k * 22; ctx.strokeStyle = `rgba(0,243,255,${k * 0.25})`; ctx.stroke();   // halo barato
            ctx.lineWidth = k * 10; ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.stroke();
        }
        const r = this.radius;
        if (typeof LH !== 'undefined' && LH.drawHero) { LH.drawHero(ctx, this); ctx.restore(); return; }   // protagonista en pixel art (extras.js › pixel3.js)
        // NAVE EN PIXEL ART: la misma flecha de siempre, rasterizada a 2 u. por píxel (como las armas), borde cian y casco oscuro
        const s = Player.pix || (Player.pix = (() => {
            const W = 24, H = 20, ox = 10, oy = 10, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const c = cv.getContext('2d'), poly = [[12, 0], [-8, 8], [-4, 0], [-8, -8]];
            const inside = (px, py) => { let ins = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
            const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && inside(x + 0.5 - ox, y + 0.5 - oy);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                if (!at(x, y)) {                                                                             // contorno oscuro por fuera
                    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { c.fillStyle = '#02080f'; c.fillRect(x, y, 1, 1); }
                    continue;
                }
                const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
                const top = y < oy;
                c.fillStyle = edge ? (top ? '#5ffbff' : '#00d9ee') : (top ? '#1d6a9c' : '#124a78');
                c.fillRect(x, y, 1, 1);
            }
            c.fillStyle = '#d6ffff'; c.fillRect(ox + 3, oy - 1, 1, 2); c.fillRect(ox + 9, oy - 1, 2, 2);                 // morro brillante
            c.fillStyle = '#00f3ff'; c.fillRect(ox - 2, oy - 1, 4, 2); c.fillStyle = '#ffffff'; c.fillRect(ox, oy - 1, 2, 1);   // cabina
            c.fillStyle = '#ffffff'; c.fillRect(ox - 8, oy - 8, 1, 1); c.fillRect(ox - 8, oy + 7, 1, 1);                 // puntas de ala
            return cv;
        })());
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(s, -20, -20, s.width * 2, s.height * 2);
        ctx.restore();
    }
}
 
class Enemy extends Entity {
    constructor(type, x, y, hpMult) {
        super(x, y, 16, C.pink);
        this.type = type;
        this.maxHp = 2 * hpMult; this.hp = this.maxHp;
        this.speed = 220;
        this.knockback = {x:0, y:0}; this.dmg = type === 1 ? 30 : 15; this.t = 0; this.burst = 0;
        if (type === 3) { this.radius = 7; this.color = C.green; this.speed = 300 + Math.random() * 90; this.maxHp = 1; this.hp = 1; this.dmg = 8; }
        else if (type === 4) { this.radius = 44; this.color = C.red; this.speed = 70; this.maxHp = 30 * hpMult; this.hp = this.maxHp; this.dmg = 30; }
        else if (type === 5) { this.radius = 70; this.color = C.pink; this.speed = 70; this.maxHp = 60 + 40 * hpMult; this.hp = this.maxHp; this.dmg = 35; this.boss = true; }
        this.fireCooldown = 0;
 
        if (type === 1) { 
            this.radius = 28; this.color = C.purple;
            this.speed = 100; this.maxHp = 15 * hpMult; this.hp = this.maxHp;
        } else if (type === 2) { 
            this.radius = 18; this.color = C.yellow;
            this.speed = 150; this.maxHp = 3 * hpMult; this.hp = this.maxHp;
        }
    }
 
    update(dt, px, py) {
        this.knockback.x *= 0.85; this.knockback.y *= 0.85;
        if (this.boss) { this.bossAI(dt, px, py); return; }
 
        let d = dist(this.x, this.y, px, py);
        let angleToPlayer = Math.atan2(py - this.y, px - this.x);
        let moveAngle = engine.steer(this, angleToPlayer);       // rodea las paredes en vez de chocar contra ellas
        if (this.type === 3) moveAngle += Math.sin(engine.time * 9 + this.x * 0.05) * 0.6;
 
        if (this.type === 2) { 
            if (d < 250 && engine.hasLOS(this)) {              // el tirador solo rodea y dispara si te ve
                moveAngle += Math.PI / 2; 
                this.fireCooldown -= dt;
                if (this.fireCooldown <= 0) {
                    engine.bullets.push(new Bullet(
                        this.x + Math.cos(angleToPlayer)*this.radius, 
                        this.y + Math.sin(angleToPlayer)*this.radius, 
                        angleToPlayer, {speed: 500, color: C.red, damage: 12, name:'ENEMY_GUN'}, true
                    ));
                    audio.playShoot('ENEMY_GUN', true);
                    this.fireCooldown = 1.7;
                    this.knockback.x = -Math.cos(angleToPlayer) * 150;
                    this.knockback.y = -Math.sin(angleToPlayer) * 150;
                }
            }
        }
 
        this.x += (Math.cos(moveAngle) * this.speed + this.knockback.x) * dt;
        this.y += (Math.sin(moveAngle) * this.speed + this.knockback.y) * dt;
 
        const ob = engine.obstacles;
        for (let i = 0; i < ob.length; i++) {
            const o = ob[i], res = rectCircleCollide(this.x, this.y, this.radius, o.x, o.y, o.w, o.h);
            if (res.hit) { this.x += res.nx * res.pen; this.y += res.ny * res.pen; }
        }
    }
 
    draw(ctx) {
        const t = this.type, r = this.radius;
        if (t >= 4) { ctx.save(); ctx.translate(this.x, this.y); this.drawBig(ctx); ctx.restore(); return; }
        const flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50;
        if (t === 3 && !(typeof LH !== 'undefined' && LH.PX)) {   // enjambre (antiguo; el pixel art lo dibuja como sprite): sin resplandor, se pinta directo
            const x = this.x, y = this.y;
            ctx.fillStyle = flash ? C.white : C.bg; ctx.strokeStyle = this.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - r / 2, y); ctx.lineTo(x + r / 2, y); ctx.stroke();
            return;
        }
        const fr = (typeof LH !== 'undefined' && LH.eFrame) ? LH.eFrame(this) : 0, id = ENEMY_SPR[t][flash ? 1 : 0] + fr;   // 2 fotogramas de animación
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => enemyBody(c, t, r, this.color, flash, fr));
        ctx.drawImage(s.cv, this.x - s.w / 2, this.y - s.h / 2, s.w, s.h);
        if (t === 1) { ctx.fillStyle = C.red; ctx.fillRect(this.x - r, this.y - r - 12, r * 2 * (this.hp / this.maxHp), 5); }
    }
}
 
const ENEMY_SPR = [['e0n', 'e0f'], ['e1n', 'e1f'], ['e2n', 'e2f']];
// Cuerpo de los enemigos normales (se pinta una sola vez en un sprite; ver Spr en core.js)
function enemyBody(c, t, r, color, flash) {
    c.fillStyle = flash ? C.white : C.bg; c.strokeStyle = color; c.lineWidth = 3;
    c.shadowBlur = 18; c.shadowColor = color;
    if (t === 1) {
        c.fillRect(-r, -r, r * 2, r * 2); c.strokeRect(-r, -r, r * 2, r * 2);
    } else if (t === 2) {
        c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath();
        c.fill(); c.stroke();
        c.fillStyle = C.red; c.fillRect(0, -3, 8, 6);
    } else {
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-r / 2, 0); c.lineTo(r / 2, 0); c.stroke();
    }
}
 
class Bullet extends Entity {
    constructor(x, y, angle, weapon, isEnemy = false) {
        super(x, y, weapon.name==='SHOTGUN'? 4:3, weapon.color);
        this.vx = Math.cos(angle) * weapon.speed;
        this.vy = Math.sin(angle) * weapon.speed;
        this.damage = weapon.damage;
        this.life = weapon.name==='SHOTGUN'? 0.4 : 1.5;
        this.isEnemy = isEnemy; this.pierce = weapon.pierce || 0; this.hit = null;   // `hit` solo existe si la bala atraviesa
        this.px = x; this.py = y; this.ox = x; this.oy = y;
        this.tl = isEnemy ? 0.18 : 0.06;           // duración de la estela (s)
        this.tx = x; this.ty = y;                  // extremo de la estela
        this.gk = this.color + this.radius;        // clave para dibujar por lotes
    }
    update(dt) {
        this.px = this.x; this.py = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        const dx = this.vx * this.tl, dy = this.vy * this.tl, lx = this.x - this.ox, ly = this.y - this.oy;
        if (lx * lx + ly * ly < dx * dx + dy * dy) { this.tx = this.ox; this.ty = this.oy; }   // al nacer, la estela parte del cañón
        else { this.tx = this.x - dx; this.ty = this.y - dy; }
        if (engine.wallHit(this.px, this.py, this.x, this.y)) {
            this.life = 0;
            engine.spawnParticle(this.x, this.y, this.color, 3, -this.vx*0.2, -this.vy*0.2, 100);
        }
    }
}
 
class Pickup extends Entity {
    constructor(x, y, type) {
        super(x, y, 12, type === 'HEALTH' ? C.green : (EXTRA_PK[type] || WEAPONS[type]).color);
        this.itemType = type; this.life = 12; this.floatY = 0;
        this.boost = pickupBoost(); this.hit = this.radius * this.boost; this.sid = 'pk' + type;
    }
    update(dt) {
        this.life -= dt;
        this.floatY = Math.sin(engine.time * 5) * 5;
        const pl = engine.player;
        if (pl && engine.state === 'PLAYING') {          // imán suave: recoger objetos no exige precisión de dedo
            const d = dist(this.x, this.y, pl.x, pl.y);
            if (d < 130 && d > 1) {
                const s = (1 - d / 130) * 420 * dt;
                this.x += (pl.x - this.x) / d * s; this.y += (pl.y - this.y) / d * s;
            }
        }
    }
    draw(ctx) {
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
        const k = this.boost, r = this.radius, type = this.itemType, col = this.color;
        const s = Spr.map.get(this.sid) || Spr.make(this.sid, 80, 80, c => {
            c.shadowBlur = 15; c.shadowColor = col; c.fillStyle = col;
            if (type === 'HEALTH') {
                c.fillRect(-r / 2, -r, r, r * 2); c.fillRect(-r, -r / 2, r * 2, r);
            } else if (EXTRA_PK[type]) {                       // objetos especiales: disco con anillo
                c.globalAlpha = 0.4; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
                c.globalAlpha = 1; c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
            } else if (type === 'KATANA') {
                c.beginPath(); c.moveTo(-8, 8); c.lineTo(8, -8); c.lineWidth = 3; c.strokeStyle = col; c.stroke();
                c.fillRect(-10, 6, 6, 6);
            } else {
                c.beginPath(); c.moveTo(0, -r); c.lineTo(r, r); c.lineTo(-r, r); c.closePath(); c.fill();
            }
        });
        const y = this.y + this.floatY;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(s.cv, this.x - s.w * k / 2, y - s.h * k / 2, s.w * k, s.h * k);
        if (type !== 'HEALTH' && type !== 'KATANA') {
            ctx.fillStyle = C.white; ctx.font = (10 * k) + 'px Orbitron'; ctx.textAlign = 'center';
            ctx.fillText(pkGlyph(type), this.x, y + 4 * k);
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}
 
class Particle {
    constructor(x, y, color, speed, vx, vy, size, type = 'normal') {
        this.x = x; this.y = y; this.color = color; this.type = type;
        if (type === 'text') {
            this.text = speed; this.life = 1.0; this.vy = -40; this.vx = (Math.random() - 0.5) * 20;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const s = Math.random() * speed;
            this.vx = vx + Math.cos(angle) * s; this.vy = vy + Math.sin(angle) * s;
            this.life = type === 'blood' ? 0.5 + Math.random() * 0.7 : Math.random() * 0.5 + 0.2;
            this.size = Math.random() * size + 2;
        }
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.type === 'normal' || this.type === 'blood') this.bounce();
        if(this.type === 'normal' || this.type === 'blood') { this.vx *= 0.93; this.vy *= 0.93; }
        this.life -= dt;
 
        if (this.type === 'blood' && this.life <= 0 && this.x > 0 && this.x < width && this.y > 0 && this.y < height) engine.addDecal(this.x, this.y, this.size * 1.4, this.color);
    }
}

// PIXEL ART: punto cuadrado alineado a una rejilla de PIX_U unidades (el tamaño crece en saltos, como en un juego de 8 bits)
const PIX_U = 3;
function pixDot(ctx, x, y, r) {
    const s = Math.max(PIX_U, Math.round(r * 2 / PIX_U) * PIX_U);
    ctx.fillRect(Math.round((x - s / 2) / PIX_U) * PIX_U, Math.round((y - s / 2) / PIX_U) * PIX_U, s, s);
}

// ########## [engine.js] ##########
class GameEngine {
    constructor() {
        this.state = 'MENU';
        this.time = 0; this.hitStop = 0;
        this.reset();
    }
 
    reset() {
        this.player = new Player(width/2, height/2);
        this.bullets = []; this.enemies = []; this.particles = []; this.pickups = [];
        this.score = 0; this.combo = 0; this.maxCombo = 0; this.kills = 0; this.comboTimer = 0; this.maxComboTimer = 3.5;
        this.shakeAmount = 0; this.time = 0; this.spawnTimer = 0; this.difficulty = 1;
        this.wave = 0; this.waveState = 'BREAK'; this.waveTimer = 1.5; this.queue = [];
        this.slashes = []; this.beams = []; this.ghosts = []; this.hpGhost = 100; this.bossHp = 1;
        this.rings = []; this.stains = [];
        
        this.generateObstacles();
        this.redrawBackground();
        this.updateUI();
    }
 
    generateObstacles() {
        this.obstacles = [];
        const numObstacles = Math.floor(Math.random() * 4) + 4; 
        for(let i=0; i<numObstacles; i++) {
            let w = Math.random() > 0.5 ? 40 : 150 + Math.random()*100;
            let h = w === 40 ? 150 + Math.random()*100 : 40;
            let x, y, distToCenter;
            let attempts = 0;
            do {
                x = Math.random() * Math.max(1, width - w - 100) + 50;
                y = Math.random() * Math.max(1, height - h - 100) + 50;
                distToCenter = dist(x+w/2, y+h/2, width/2, height/2);
                attempts++;
            } while(distToCenter < 200 && attempts < 50); 
            
            if (attempts < 50) this.obstacles.push(new Obstacle(x, y, w, h));
        }
    }
 
    // La cuadrícula del fondo es un Path2D que se dibuja como vector (unas 40 líneas), en vez de copiar un lienzo entero.
    redrawBackground() {
        const p = new Path2D(), gs = 80;
        for (let x = 0; x < width; x += gs) { p.moveTo(x, 0); p.lineTo(x, height); }
        for (let y = 0; y < height; y += gs) { p.moveTo(0, y); p.lineTo(width, y); }
        this.gridPath = p;
    }
 
    init() {
        audio.resume(); audio.music.newRun(); audio.startMusic();
        // Cada partida empieza con la calidad del modo elegido (antes la bajada automática se arrastraba para siempre
        // y con ella desaparecían el ecualizador y el fondo al ritmo tras reintentar)
        _qGrace = performance.now() + 6000;
        if (typeof reapplyQualityLevel === 'function') { const ql = Q.level; reapplyQualityLevel(); if (Q.level !== ql) resize(); }
        this.reset();
        DOM.screens.classList.add('hidden');
        DOM.uiLayer.classList.remove('chromatic-glitch');
        this.state = 'PLAYING';
        
        try {
            enterImmersive();
        } catch(e) {}
    }
 
    addShake(amount) { if (Settings.shake) this.shakeAmount = Math.min(this.shakeAmount + amount, 50); }
    doHitStop(duration) { this.hitStop = Math.max(this.hitStop, duration); }
 
    spawnText(x, y, text, color) { this.particles.push(new Particle(x, y, color, text, 0, 0, 0, 'text')); }
    spawnParticle(x, y, color, amount, vx=0, vy=0, speed=200, type='normal') {
        const max = Settings.perf ? 350 : [800, 600, 450, 350][Q.level], n = Math.ceil(amount * (Settings.perf ? 0.4 : [1, 0.75, 0.6, 0.5][Q.level]));
        for(let i=0; i<n && this.particles.length<max; i++) this.particles.push(new Particle(x, y, color, speed, vx, vy, 5, type));
    }
 
    addScore(amount, x, y) {
        const multi = this.combo > 0 ? this.combo : 1;
        const total = amount * multi;
        this.score += total;
        this.combo++; this.kills++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; this.comboTimer = this.maxComboTimer;
        
        if(x && y) { this.spawnText(x, y, '+' + total, C.white); if (this.combo % 5 === 0) this.spawnText(x, y - 26, 'COMBO x' + this.combo + '!', C.yellow); }
        this.addShake(Math.min(this.combo * 0.4, 6));
        audio.playHit(); audio.music.setCombo(this.combo); audio.music.onKill();
        
        if (this.combo > 10 && this.combo % 5 === 0) this.glitch();
 
        if (this.score > bestScore) {
            bestScore = this.score; this._bestDirty = true;
            setText(DOM.highScore, `HI: ${bestScore.toString().padStart(6, '0')}`);
        }
        this.updateUI();
    }
 
    glitch() {
        DOM.uiLayer.classList.add('chromatic-glitch');
        clearTimeout(this._gt);
        this._gt = setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
    }
    flushBest() {                                    // escribir en localStorage es síncrono: solo cuando hace falta
        if (!this._bestDirty) return;
        this._bestDirty = false; this._bestT = 0;
        try { localStorage.setItem('neonCarnageBest', bestScore); } catch (e) {}
    }
 
    updateUI() {
        setText(DOM.score, this.score.toString().padStart(6, '0'));
        if (this.combo > 1) {
            const h = `x${this.combo}<br>COMBO`;
            if (DOM.combo._h !== h) { DOM.combo._h = h; DOM.combo.innerHTML = h; }
            DOM.combo.classList.add('active');
        } else {
            DOM.combo.classList.remove('active');
        }
    }
 
    gameOver() {
        this.state = 'GAMEOVER';
        this.spawnParticle(this.player.x, this.player.y, C.cyan, 150, 0, 0, 1000);
        audio.playExplosion(); audio.stopMusic(); haptic([100, 50, 100, 50, 500]); this.flushBest();
        this.addShake(80); this.doHitStop(0.5);
        DOM.uiLayer.classList.add('chromatic-glitch');
        DOM.canvas.style.transform = `rotate(0deg)`; 
 
        setTimeout(() => {
            if (this.state !== 'GAMEOVER') return;
            Menu.fillOver(this);
            Menu.open('pOver', true);
            DOM.uiLayer.classList.remove('chromatic-glitch');
        }, 2000);
    }
 
    spawnLogic(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.difficulty = 1 + (this.time / 20); 
            let spawnRate = Math.max(0.15, 1.2 - (this.difficulty * 0.1));
            this.spawnTimer = spawnRate;
 
            let sx, sy;
            if (Math.random() > 0.5) { sx = Math.random() > 0.5 ? -30 : width + 30; sy = Math.random() * height; } 
            else { sx = Math.random() * width; sy = Math.random() > 0.5 ? -30 : height + 30; }
 
            const r = Math.random();
            let type = 0; 
            if (this.time > 15 && r < 0.25) type = 2; 
            if (this.time > 30 && r > 0.85) type = 1; 
 
            this.enemies.push(new Enemy(type, sx, sy, this.difficulty));
        }
    }
 
    hitEnemy(e, damage, forceX, forceY, isMelee = false) {
        e.hp -= damage;
        e.knockback.x = forceX; e.knockback.y = forceY;
        this.spawnParticle(e.x, e.y, e.color, isMelee ? 15 : 6, forceX*0.5, forceY*0.5, isMelee ? 400 : 200, 'blood');
        
        if (e.hp <= 0 && !e.dead) {
            e.dead = true; 
            this.spawnParticle(e.x, e.y, e.color, 40, 0, 0, 500, 'blood');
            this.addScore(e.type === 1 ? 500 : (e.type === 2 ? 200 : 100), e.x, e.y);
            
            if (e.type === 1) this.doHitStop(0.08); 
            else if (isMelee || this.combo % 10 === 0) this.doHitStop(0.04);
 
            if (Math.random() < 0.12 || (e.type === 1 && Math.random() < 0.8)) {
                const types = ['SHOTGUN', 'MINIGUN', 'KATANA', 'HEALTH'];
                this.pickups.push(new Pickup(e.x, e.y, types[Math.floor(Math.random()*types.length)]));
            }
        }
    }
 
    update(dt) {
        if (this.state === 'PAUSED') return;
        if (this.hitStop > 0) { this.hitStop -= dt; return; }
        if (this.state !== 'PLAYING') { this.updateArrays(dt, true); return; }
 
        this.time += dt;
        if (this._bestDirty && (this._bestT = (this._bestT || 0) + dt) > 2) this.flushBest();
        this.spawnLogic(dt);
 
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.updateUI(); audio.music.setCombo(0); }
        }
 
        this.player.update(dt);
        this.updateArrays(dt, false);
        this.checkCollisions();
 
        
         
    }
    
    updateArrays(dt, particlesOnly) {
        const P = this.particles; let w = 0;
        for (let i = 0; i < P.length; i++) { const p = P[i]; p.update(dt); if (p.life > 0) P[w++] = p; }
        P.length = w;
        for (let i = this.stains.length - 1; i >= 0; i--) if ((this.stains[i].life -= dt) <= 0) this.stains.splice(i, 1);
        for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].life -= dt) <= 0) this.rings.splice(i, 1);
        if(particlesOnly) return;
 
        const B = this.bullets; let k = 0;
        for (let i = 0; i < B.length; i++) {
            const b = B[i]; b.update(dt);
            if (b.life > 0 && b.x >= 0 && b.x <= width && b.y >= 0 && b.y <= height) B[k++] = b;
        }
        B.length = k;
 
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i]; p.update(dt);
            if (p.life <= 0) this.pickups.splice(i, 1);
        }
 
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.dead) { this.enemies.splice(i, 1); continue; }
            e.update(dt, this.player.x, this.player.y);
        }
    }
 
    checkCollisions() {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            if (dist(this.player.x, this.player.y, p.x, p.y) < this.player.radius + p.hit) {
                if (p.itemType === 'HEALTH') {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
                    this.spawnText(p.x, p.y, "+HP", C.green);
                } else {
                    // dos ranuras de arma (js/10-armas-inventario.js): con las dos ocupadas, un arma nueva se queda en el suelo (se cambia con F)
                    if (typeof LH !== 'undefined' && LH.wBlocked && LH.wBlocked(this.player, p)) continue;
                    if (p.ammoLeft !== undefined) LH._restore = { ammo: p.ammoLeft, dual: !!p.dualLeft };     // arma soltada: conserva su munición
                    this.player.equip(p.itemType, p.itemType === 'SHOTGUN' ? 25 : (p.itemType === 'KATANA' ? 50 : (p.itemType === 'RAILGUN' ? 8 : 150)), p.wd);
                    if (typeof LH !== 'undefined') LH._restore = null;
                }
                audio.playPickup(); haptic(50);
                this.spawnParticle(p.x, p.y, p.color, 20, 0, 0, 400);
                this.pickups.splice(i, 1);
            }
        }
 
        for (let j = this.bullets.length - 1; j >= 0; j--) {
            const b = this.bullets[j];
            if (b.isEnemy && this.player.iframes <= 0) {
                if (dist(b.x, b.y, this.player.x, this.player.y) < this.player.radius + b.radius) {
                    this.player.hp -= b.damage; this.player.iframes = 0.6;
                    this.addShake(25); haptic(200);
                    this.glitch();
                    this.spawnParticle(this.player.x, this.player.y, C.red, 30, b.vx*0.5, b.vy*0.5, 500, 'blood');
                    this.bullets.splice(j, 1);
                    if (this.player.hp <= 0) { this.gameOver(); return; }
                    continue;
                }
            }
        }
 
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
 
            if (!e.dead && this.player.iframes <= 0 && dist(this.player.x, this.player.y, e.x, e.y) < this.player.radius + e.radius - 2) {
                this.player.hp -= e.dmg; this.player.iframes = 0.8; 
                this.addShake(30); haptic(200);
                this.glitch();
                this.spawnParticle(this.player.x, this.player.y, C.red, 25, 0, 0, 500, 'blood');
                
                e.knockback.x = (e.x - this.player.x) * 15;
                e.knockback.y = (e.y - this.player.y) * 15;
 
                if (this.player.hp <= 0) { this.gameOver(); return; }
            }
 
        }
 
        const B = this.bullets, E = this.enemies;
        for (let j = B.length - 1; j >= 0; j--) {
            const b = B[j];
            if (b.isEnemy) continue;
            for (let i = 0; i < E.length; i++) {
                const e = E[i];
                if (e.dead) continue;
                const rr = e.radius + b.radius, dx = b.x - e.x, dy = b.y - e.y;
                if (dx * dx + dy * dy >= rr * rr || (b.hit && b.hit.has(e))) continue;
                if (b.pierce > 0) (b.hit || (b.hit = new Set())).add(e);
                this.hitEnemy(e, b.damage * bulletFalloff(b), b.vx * 0.4, b.vy * 0.4);
                if (b.pierce-- > 0) continue;
                B.splice(j, 1);
                break;
            }
        }
    }
 
    drawJoysticks(ctx) {
        // Joysticks en pixel art: disco escalonado, aro de puntos, marcas cardinales y cabeza cuadrada con bisel.
        const R = Input.maxRadius, sn = (v) => Math.round(v / 2) * 2;
        [Input.left, Input.right].forEach((stick, idx) => {
            if (!stick.active) return;
            const color = idx === 0 ? C.cyan : C.pink;
            const bx = sn(stick.base.x), by = sn(stick.base.y);
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // joysticks en px de pantalla, no del mundo
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.14;                           // disco de fondo, línea a línea
            for (let y = -R; y < R; y += 4) { const w = Math.sqrt(Math.max(0, R * R - (y + 2) * (y + 2))); ctx.fillRect(sn(bx - w), by + y, sn(w * 2), 4); }
            ctx.globalAlpha = 0.9;                            // aro de cuadraditos
            for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; ctx.fillRect(sn(bx + Math.cos(a) * R) - 2, sn(by + Math.sin(a) * R) - 2, 4, 4); }
            ctx.globalAlpha = 0.9;                            // marcas N, E, S, O
            ctx.fillRect(bx - 2, by - R - 8, 4, 8); ctx.fillRect(bx - 2, by + R, 4, 8);
            ctx.fillRect(bx - R - 8, by - 2, 8, 4); ctx.fillRect(bx + R, by - 2, 8, 4);
            const hx = sn(bx + stick.vector.x * (R * stick.force)), hy = sn(by + stick.vector.y * (R * stick.force));
            ctx.globalAlpha = 1;                              // cabeza: sombra, marco de color, relleno claro y bisel
            ctx.fillStyle = '#000'; ctx.fillRect(hx - 18, hy - 18, 40, 40);
            ctx.fillStyle = color; ctx.fillRect(hx - 20, hy - 20, 40, 40);
            ctx.fillStyle = C.white; ctx.fillRect(hx - 16, hy - 16, 32, 32);
            ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(hx - 16, hy + 10, 32, 6); ctx.fillRect(hx + 10, hy - 16, 6, 32);
            ctx.fillStyle = color; ctx.fillRect(hx - 6, hy - 6, 12, 12);
            ctx.restore();
        });
    }
 
    // PARTÍCULAS por lotes: sin save/restore por partícula, fillStyle solo cuando cambia el color y fillRect para las diminutas.
    // pass 0 = sangre (debajo de enemigos y jugador) · pass 1 = chispas y textos (encima)
    drawParticles(ctx, pass) {
        const P = this.particles, n = P.length;
        if (pass === 0) {
            ctx.globalCompositeOperation = 'lighter';
            let cur = null;
            for (let i = 0; i < n; i++) {
                const p = P[i];
                if (p.type !== 'blood' || p.life <= 0) continue;
                const r = p.size * (p.life * 2);
                if (p.color !== cur) { cur = p.color; ctx.fillStyle = cur; }
                pixDot(ctx, p.x, p.y, r);
            }
            ctx.globalCompositeOperation = 'source-over';
            return;
        }
        ctx.globalCompositeOperation = 'lighter';
        let cur = null;
        for (let i = 0; i < n; i++) {
            const p = P[i];
            if (p.type !== 'normal' || p.life <= 0) continue;
            const r = p.size * (p.life * 2);
            if (p.color !== cur) { cur = p.color; ctx.fillStyle = cur; }
            pixDot(ctx, p.x, p.y, r);
        }
        ctx.globalCompositeOperation = 'source-over';
        let font = null;
        ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        for (let i = 0; i < n; i++) {
            const p = P[i];
            if (p.type !== 'text') continue;
            const f = `900 ${p.fs || Math.round(22 * textBoost())}px Orbitron`;
            if (f !== font) { font = f; ctx.font = f; }
            const a = Math.max(0, p.life);
            if (!Settings.perf) {                                     // halo barato en lugar de shadowBlur
                ctx.globalAlpha = a * 0.3; ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.strokeText(p.text, p.x, p.y);
            }
            ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
    }
 
    // BALAS por lotes: las del mismo color y grosor comparten trazado. La estela se imita con tres pasadas de
    // longitud y grosor crecientes (en modo aditivo se ve como un degradado) y un halo de luz en la punta.
    drawBullets(ctx) {
        const B = this.bullets;
        if (!B.length) return;
        const G = this._bg || (this._bg = new Map());
        for (const a of G.values()) a.length = 0;
        for (let i = 0; i < B.length; i++) {
            const b = B[i]; let a = G.get(b.gk);
            if (!a) { a = []; G.set(b.gk, a); }
            a.push(b);
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const a of G.values()) {
            const n = a.length; if (!n) continue;
            const r = a[0].radius, col = a[0].color;
            ctx.strokeStyle = col;
            for (let pass = 0; pass < 3; pass++) {
                const f = pass === 0 ? 1 : pass === 1 ? 0.55 : 0.25;
                ctx.globalAlpha = pass === 0 ? 0.45 : pass === 1 ? 0.55 : 0.85;
                ctx.lineWidth = r * (pass === 0 ? 1.1 : pass === 1 ? 1.7 : 2.3);
                ctx.beginPath();
                for (let i = 0; i < n; i++) { const b = a[i]; ctx.moveTo(b.x + (b.tx - b.x) * f, b.y + (b.ty - b.y) * f); ctx.lineTo(b.x, b.y); }
                ctx.stroke();
            }
            if (!Settings.perf) {
                const s = Spr.halo(col), k = r / 3;
                ctx.globalAlpha = 0.9;
                for (let i = 0; i < n; i++) ctx.drawImage(s.cv, a[i].x - s.w * k / 2, a[i].y - s.h * k / 2, s.w * k, s.h * k);
            }
            ctx.globalAlpha = 1; ctx.fillStyle = C.white; ctx.beginPath();
            const rr = r * 0.7;
            for (let i = 0; i < n; i++) { ctx.moveTo(a[i].x + rr, a[i].y); ctx.arc(a[i].x, a[i].y, rr, 0, TAU); }
            ctx.fill();
        }
        ctx.restore();
    }
 
    draw() {
        this.needsDraw = false;
        Spr.sync();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.drawBackdrop(ctx);
        ctx.setTransform(Cam.m[0] * renderK, Cam.m[1] * renderK, Cam.m[2] * renderK, Cam.m[3] * renderK, Cam.m[4], Cam.m[5]);
 
        ctx.save();
        if (this.shakeAmount > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            ctx.translate(dx, dy);
            this.shakeAmount *= 0.85;
            if (this.shakeAmount < 0.5) this.shakeAmount = 0;
        }
 
        this.drawWalls(ctx); this.drawStains(ctx); this.drawRings(ctx);
 
        for (const p of this.pickups) p.draw(ctx);
        this.drawParticles(ctx, 0);
        this.drawFx(ctx); this.drawBullets(ctx);
        for (const e of this.enemies) e.draw(ctx);
        
        if (this.state === 'PLAYING' || this.state === 'GAMEOVER' || this.state === 'COUNT' || this.state === 'UPGRADE') {
            if(this.player.hp > 0) { this.player.drawTrail(ctx); this.player.draw(ctx); }
        }
 
        this.drawParticles(ctx, 1);
        ctx.restore();
 
        if (this.state === 'PLAYING') this.drawJoysticks(ctx);
        
        if (this.hitStop > 0 && this.shakeAmount > 15 && !Settings.perf && !Settings.calm && Q.level === 0) {
            ctx.globalCompositeOperation = 'screen';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(canvas, -2 * dpr, 0);
            ctx.drawImage(canvas, 2 * dpr, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}
 


// ########## [upgrade.js] ##########
// ===================== UPGRADE PACK =====================
const TAU = Math.PI * 2;
const UI2 = { wave: document.getElementById('waveEl'), bossBar: document.getElementById('bossBar'), bossFill: document.getElementById('bossFill'), hpGhost: document.getElementById('healthGhost') };
function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return dist(px, py, x1 + dx * t, y1 + dy * t);
}
 
const _playShoot = AudioEngine.prototype.playShoot;
AudioEngine.prototype.playShoot = function(w, e) {
    if (w !== 'RAILGUN') return _playShoot.call(this, w, e);
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.5);
};
 
Particle.prototype.bounce = function() {
    if (this.x < 0 || this.x > width) { this.vx *= -0.6; this.x = clamp(this.x, 0, width); }
    if (this.y < 0 || this.y > height) { this.vy *= -0.6; this.y = clamp(this.y, 0, height); }
    const o = engine.wallAt(this.x, this.y);
    if (o) {
        const l = this.x - o.x, r = o.x + o.w - this.x, t = this.y - o.y, b = o.y + o.h - this.y, m = Math.min(l, r, t, b);
        if (m === l || m === r) { this.vx *= -0.6; this.x += m === l ? -m - 1 : m + 1; }
        else { this.vy *= -0.6; this.y += m === t ? -m - 1 : m + 1; }
    }
};
 

Enemy.prototype.drawBig = function(ctx) {
    if (typeof LH !== 'undefined' && LH.drawBig) return LH.drawBig(ctx, this);   // coraza en pixel art (extras.js › pixel3.js)
    const r = this.radius, t = engine.time, boss = this.boss, col = this.color;
    if (!boss) { ctx.fillStyle = C.red; ctx.fillRect(-r, -r - 14, r * 2 * (this.hp / this.maxHp), 5); }
    const poly = (c, rad, n) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); };
    const idO = (boss ? 'bgO' : 'mjO') + col, idI = (boss ? 'bgI' : 'mjI') + col;   // un sprite por color (cada jefe tiene el suyo)
    const so = Spr.map.get(idO) || Spr.make(idO, r * 2 + 90, r * 2 + 90, c => {
        c.fillStyle = C.bg; c.strokeStyle = col; c.lineWidth = boss ? 5 : 4; c.shadowBlur = 30; c.shadowColor = col;
        poly(c, r, boss ? 8 : 6); c.fill(); c.stroke();
    });
    const si = Spr.map.get(idI) || Spr.make(idI, r * 1.1 + 90, r * 1.1 + 90, c => {
        c.strokeStyle = col; c.lineWidth = boss ? 5 : 4; c.shadowBlur = 30; c.shadowColor = col;
        poly(c, r * 0.55, boss ? 4 : 3); c.stroke();
    });
    ctx.rotate(t * (boss ? 0.6 : 1.2));
    ctx.drawImage(so.cv, -so.w / 2, -so.h / 2, so.w, so.h);
    ctx.rotate(-t * (boss ? 1.8 : 3.6));
    ctx.drawImage(si.cv, -si.w / 2, -si.h / 2, si.w, si.h);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * (6 + (1 - this.hp / this.maxHp) * 14));
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
};
 
Object.assign(GameEngine.prototype, {
    edge() {
        const r = Math.random();
        return r < 0.25 ? {x: -30, y: Math.random() * height} : r < 0.5 ? {x: width + 30, y: Math.random() * height}
             : r < 0.75 ? {x: Math.random() * width, y: -30} : {x: Math.random() * width, y: height + 30};
    },
    freeSpot() {
        let x, y, n = 0;
        do { x = 80 + Math.random() * (width - 160); y = 80 + Math.random() * (height - 160); n++; }
        while (n < 30 && this.obstacles.some(o => x > o.x - 30 && x < o.x + o.w + 30 && y > o.y - 30 && y < o.y + o.h + 30));
        return {x, y};
    },
    banner(text, color) {
        this.spawnText(width / 2, height * 0.35, text, color);
        const p = this.particles[this.particles.length - 1];
        p.fs = Math.min(56, width * 0.9 / (text.length * 0.85)); p.life = 2; p.vx = 0; p.vy = 0;
    },
    startWave() {
        const w = ++this.wave, q = [], push = (t, n, d, c) => { for (let i = 0; i < c; i++) q.push({t, n, d}); };
        this.waveState = 'FIGHT'; UI2.wave.innerText = 'WAVE ' + w;
        audio.music.setWave(w);
        audio.music.setSection(w % 5 === 0 ? 'boss' : (w % 5 === 4 ? 'pre' : 'fight'));   // 'pre' = la oleada antes de un jefe (los minijefes lo sustituyen en oleadas múltiplo de 4)
        if (w % 5 === 0) {
            this.banner('BOSS WAVE ' + w, C.red);
            push(5, 1, 1, 1); push(0, 1, 1.2, 3);
            ['MINIGUN', 'RAILGUN'].forEach(k => { const s = this.freeSpot(); this.pickups.push(new Pickup(s.x, s.y, k)); });
        } else {
            this.banner('WAVE ' + w, C.cyan);
            // CURVA SUAVE (v1.4): un enemigo nuevo cada pocas oleadas y menos cantidad
            push(0, 1, 0.7, 3 + Math.floor(w * 0.85) + Math.floor(w / 4));
            if (w >= 4) push(2, 1, 1.0, Math.min(3, Math.floor((w - 1) / 3)));
            if (w >= 4) push(3, 6 + Math.floor(Math.random() * 3), 1.3, Math.ceil((w - 2) / 4));
            if (w >= 8) push(1, 1, 0.9, Math.floor((w - 5) / 3));
            if (w >= 9) push(4, 1, 1.1, Math.floor((w - 4) / 5));
        }
        q.sort(() => Math.random() - 0.5);
        this.queue = q;
    },
    spawnLogic(dt) {
        if (this.waveState === 'BREAK') { if ((this.waveTimer -= dt) <= 0) this.startWave(); return; }
        this.spawnTimer -= dt;
        const _D = typeof LH !== 'undefined' && LH.DIF ? LH.DIF : null;      // curva de js/12-dificultad.js (igual que antes hasta la oleada 12)
        if (this.queue.length && this.spawnTimer <= 0 && this.enemies.length < (_D ? _D.maxVivos(this.wave) : 7 + Math.min(Math.floor(this.wave * 1.2), 10))) {
            const s = this.queue.shift(), p = this.edge(), hp = _D ? LH.difHp(this.wave) : 1 + this.wave * 0.07;
            for (let i = 0; i < s.n; i++) this.enemies.push(makeEnemy(s.t, p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 120, hp));
            this.spawnTimer = s.d * (_D ? _D.espera(this.wave) : Math.max(0.85, 1.3 - this.wave * 0.02));
        }
        if (!this.queue.length && !this.enemies.length) {
            this.waveState = 'BREAK'; this.waveTimer = 2; audio.music.setSection('calm');
            this.banner('WAVE ' + this.wave + ' CLEARED', C.green);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
            if (Math.random() < 0.6) { const s = this.freeSpot(), k = DROP_POOL; this.pickups.push(new Pickup(s.x, s.y, k[Math.floor(Math.random() * k.length)])); }
        }
    },
    bossAttack(b) {
        const mk = (a, s) => this.bullets.push(new Bullet(b.x, b.y, a, {speed: s, color: C.pink, damage: 12, name: 'ENEMY_GUN'}, true));
        if (b.burst > 0) {
            b.burst--; for (let k = 0; k < 3; k++) mk(b.t * 3 + k * TAU / 3, 240);
            b.fireCooldown = b.burst ? 0.07 : 1.2; if (b.burst % 5 === 0) audio.playShoot('ENEMY_GUN', true); return;
        }
        const pa = Math.atan2(this.player.y - b.y, this.player.x - b.x), n = (b.pat = (b.pat || 0) + 1) % 3;
        if (n === 0) { for (let i = 0; i < 28; i++) mk(i / 28 * TAU + b.t, 230); b.fireCooldown = 1.4; }
        else if (n === 1) { b.burst = 30; b.fireCooldown = 0.07; }
        else { for (let i = -3; i <= 3; i++) mk(pa + i * 0.16, 420); b.fireCooldown = 1.1; }
        audio.playShoot('ENEMY_GUN', true); this.addShake(6);
    },
    hitEnemy(e, damage, fx, fy, isMelee = false) {
        e.hp -= damage;
        if (!e.boss) { e.knockback.x = fx; e.knockback.y = fy; }
        this.spawnParticle(e.x, e.y, e.color, isMelee ? 30 : 10, fx * 0.5, fy * 0.5, isMelee ? 500 : 250, 'blood');
        if (isMelee) this.doHitStop(0.05);
        if (e.hp > 0 || e.dead) return;
        e.dead = true;
        const big = e.type >= 4;
        this.spawnParticle(e.x, e.y, e.color, e.boss ? 400 : big ? 200 : e.type === 3 ? 25 : 90, fx * 0.3, fy * 0.3, big ? 800 : 550, 'blood');
        this.spawnParticle(e.x, e.y, C.white, big ? 40 : 10, 0, 0, 400);
        this.addScore([100, 500, 200, 25, 400, 5000][e.type], e.x, e.y);
        if (big) {
            const n = e.boss ? 36 : 20;
            for (let i = 0; i < n; i++) this.bullets.push(new Bullet(e.x, e.y, i / n * TAU, {speed: 280, color: C.red, damage: 10, name: 'ENEMY_GUN'}, true));
            audio.playExplosion(); this.addShake(e.boss ? 80 : 55); this.doHitStop(e.boss ? 0.35 : 0.15); haptic([80, 40, 160]);
        } else if (e.type === 1) this.doHitStop(0.1);
        else if (isMelee || this.combo % 10 === 0) this.doHitStop(0.05);
        if (e.boss) { this.pickups.push(new Pickup(e.x, e.y, 'HEALTH')); this.player.hp = this.player.maxHp; }
        else if (this.player.hp < this.player.maxHp * 0.4 && Math.random() < 0.12) this.pickups.push(new Pickup(e.x, e.y, 'HEALTH'));
        else if (Math.random() < 0.1 || (e.type === 1 && Math.random() < 0.8)) {
            const k = DROP_POOL;
            this.pickups.push(new Pickup(e.x, e.y, k[Math.floor(Math.random() * k.length)]));
        }
    },
    drawFx(ctx) {
        if (!this.beams.length && !this.slashes.length) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const b of this.beams) {
            const k = b.life / 0.35;
            ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
            ctx.strokeStyle = `rgba(0,243,255,${k * 0.22})`; ctx.lineWidth = 56 * k; ctx.stroke();
            ctx.strokeStyle = `rgba(0,243,255,${k})`; ctx.lineWidth = 26 * k; ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 8 * k; ctx.stroke();
        }
        for (const s of this.slashes) {
            const k = s.life / 0.5;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, s.a - Math.PI / 2, s.a + Math.PI / 2);
            ctx.strokeStyle = `rgba(255,255,255,${k * 0.25})`; ctx.lineWidth = 30 * k + 4; ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 14 * k + 2; ctx.stroke();
        }
        ctx.restore();
    }
});
const _update = GameEngine.prototype.update;
GameEngine.prototype.update = function(dt) { _update.call(this, dt); this.postUpdate(dt); };
// ========================================================
 
let engine;
let fpsFrames = 0, fpsAcc = 0;
 
// Limita a ~60 fotogramas (en pantallas de 120/144 Hz se hacía el doble o el triple de trabajo sin ganar nada),
// no repinta en pausa (la imagen ya está en el lienzo) y baja el ritmo en menús, donde hay un desenfoque encima.
// v1.7 · RITMO DE FOTOGRAMAS según la pantalla real. Antes se medía el tiempo con un margen fijo y en pantallas de 75/90/144 Hz
// salían 37/45/48 FPS (se saltaba un refresco de más). Ahora se mide la frecuencia del monitor y se dibuja cada N refrescos:
// 60 Hz → todos · 90 Hz → todos (90 FPS) · 120 Hz → 1 de cada 2 (60) · 144 Hz → 1 de cada 2 (72) · 240 Hz → 1 de cada 4 (60).
let _lastRaf = 0, _rafN = 0, _hz = 60, _skip = 1, _skipPend = 1, _loopHold = false;
const _rd = [];
function _trackHz(ts) {
    const d = ts - _lastRaf; _lastRaf = ts;
    if (d < 2 || d > 40) return;
    _rd.push(d); if (_rd.length > 48) _rd.shift();
    if (_rd.length >= 24 && (_rafN & 15) === 0) {
        const s = _rd.slice().sort((a, b) => a - b), per = s[Math.floor(s.length * 0.2)];     // percentil 20: ignora los fotogramas lentos
        const est = 1000 / per;
        if (est >= 55) _hz = est;                      // una medida baja es el juego yendo lento, no la pantalla: se ignora
        const want = Math.max(1, Math.floor(_hz / 58));
        if (want === _skip) _skipPend = want; else if (want === _skipPend) _skip = want; else _skipPend = want;   // exige 2 medidas iguales
    }
}
function loop(timestamp) {
    requestAnimationFrame(loop);
    _rafN++; _trackHz(timestamp);
    if (_loopHold) return;                                   // la pantalla de preparación dibuja por su cuenta
    const st = engine.state;
    if (st === 'PAUSED') { if (!engine.needsDraw) return; }
    else if ((_rafN % (_skip * ((st === 'PLAYING' || st === 'COUNT') ? 1 : 2))) !== 0) return;   // menús a la mitad de ritmo (hay desenfoque encima)
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    updateMouseWorld();
    // Con tirones (dt grande) el juego se calcula en varios pasos cortos: así nada atraviesa paredes ni se salta colisiones
    const steps = Math.ceil(dt / 0.034);
    for (let i = 0; i < steps; i++) engine.update(dt / steps);
    engine.draw();
    fpsFrames++; fpsAcc += dt;
    if (fpsAcc >= 0.5) {
        if (Settings.showFps) setText(document.getElementById('fpsEl'), Math.round(fpsFrames / fpsAcc) + ' FPS');
        autoQuality(fpsFrames / fpsAcc); fpsFrames = 0; fpsAcc = 0;
    }

}

// ########## [controles.js] ##########
// ########## [input.js] ##########
// GESTIÓN HÍBRIDA DE INPUTS (Táctil + PC)
const Input = {
    left: { active: false, id: null, base: {x:0, y:0}, vector: {x:0, y:0}, force: 0 },
    right: { active: false, id: null, base: {x:0, y:0}, vector: {x:0, y:0}, force: 0 },
    maxRadius: 56, deadZone: 8, lastTouch: 0,
    lastLeftTapTime: 0,
    lastDir: { x: 1, y: 0 }, 
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: window.innerWidth/2, y: window.innerHeight/2, active: false }
};
 
// Eventos de Teclado
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(key)) Input.keys.w = true;
    if (['s', 'arrowdown'].includes(key)) Input.keys.s = true;
    if (['a', 'arrowleft'].includes(key)) Input.keys.a = true;
    if (['d', 'arrowright'].includes(key)) Input.keys.d = true;
    
    if ((key === ' ' || key === 'shift') && engine && engine.player && engine.state === 'PLAYING') {
        e.preventDefault();
        engine.player.pulse();
    }
    if ((key === 'escape' || key === 'p') && engine) engine.togglePause();
});
 
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(key)) Input.keys.w = false;
    if (['s', 'arrowdown'].includes(key)) Input.keys.s = false;
    if (['a', 'arrowleft'].includes(key)) Input.keys.a = false;
    if (['d', 'arrowright'].includes(key)) Input.keys.d = false;
});
 
// Eventos de Ratón
window.addEventListener('mousemove', (e) => {
    if (Date.now() - Input.lastTouch < 700) return;
    Input.mouse.cx = e.clientX; Input.mouse.cy = e.clientY;
    
});
window.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('button, input, #screens')) return;
    if (Date.now() - Input.lastTouch < 700) return; 
    Input.mouse.active = true;
});
window.addEventListener('mouseup', () => {
    Input.mouse.active = false;
});
 
// Eventos Táctiles Originales
function handleTouch(e) {
    if (e.cancelable) e.preventDefault();
    Input.lastTouch = Date.now();
    const touches = e.changedTouches, half = window.innerWidth / 2;

    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];

        if (e.type === 'touchstart') {
            const stick = t.clientX < half ? Input.left : Input.right;
            if (!stick.active) {
                stick.active = true; stick.id = t.identifier;
                stick.base = { x: t.clientX, y: t.clientY };
                stick.force = 0; stick.vector = { x: 0, y: 0 };
            }
        } else if (e.type === 'touchmove') {
            const stick = Input.left.id === t.identifier ? Input.left : (Input.right.id === t.identifier ? Input.right : null);
            if (stick && stick.active) {
                let dx = t.clientX - stick.base.x, dy = t.clientY - stick.base.y;
                let d = Math.hypot(dx, dy);
                const R = Input.maxRadius;
                if (d > R) {                       // la base sigue al dedo: nunca hay que "volver" al centro
                    const k = (d - R) / d;
                    stick.base.x += dx * k; stick.base.y += dy * k;
                    dx = t.clientX - stick.base.x; dy = t.clientY - stick.base.y; d = R;
                }
                const dz = Input.deadZone;
                stick.force = d <= dz ? 0 : Math.min((d - dz) / (R - dz), 1);
                if (d > 0) stick.vector = { x: dx / d, y: dy / d };
            }
        } else {                                   // touchend / touchcancel
            for (const stick of [Input.left, Input.right]) {
                if (stick.id === t.identifier) { stick.active = false; stick.id = null; stick.force = 0; stick.vector = { x: 0, y: 0 }; }
            }
        }
    }
}
 
canvas.addEventListener('touchstart', handleTouch, {passive: false});
canvas.addEventListener('touchmove', handleTouch, {passive: false});
canvas.addEventListener('touchend', handleTouch, {passive: false});
canvas.addEventListener('touchcancel', handleTouch, {passive: false});
 


// ########## [mobile.js] ##########

// ===================== MÓVIL (v3) =====================
Object.assign(GameEngine.prototype, {
    // Al girar el teléfono o cambiar el zoom, el mundo cambia de tamaño lógico: se recolocan las entidades.
    rescaleWorld(ow, oh) {
        const fx = width / ow, fy = height / oh;
        const mv = (o) => { o.x *= fx; o.y *= fy; };
        mv(this.player); this.enemies.forEach(mv); this.pickups.forEach(mv);
        this.obstacles.forEach(o => {
            mv(o);
            o.x = clamp(o.x, 0, Math.max(0, width - o.w));
            o.y = clamp(o.y, 0, Math.max(0, height - o.h));
        });
        this.bullets.length = 0; this.particles.length = 0; this.stains.length = 0;
        this.rings.length = 0; this.slashes.length = 0; this.beams.length = 0;
        this.player.trail.length = 0;
    },
    // Ayuda de puntería (solo táctil): si hay un enemigo dentro de un cono estrecho, la mira se inclina hacia él.
    assistAim(x, y, a) {
        let best = null, bd = Infinity;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
            if (d > 800 || d < 1) continue;
            let diff = Math.atan2(dy, dx) - a;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            if (Math.abs(diff) < 0.16 + Math.atan2(e.radius, d) && d < bd) { bd = d; best = diff; }
        }
        return best === null ? a : a + best * 0.7;
    }
});

// Botón de pulso: anillo de recarga y brillo cuando está listo
let _pLast = -1, _pReady = null;
function updatePulseButton(cd) {
    const btn = DOM.pulseBtn;
    if (!btn) return;
    const ready = cd <= 0;
    const p = ready ? 100 : Math.round(100 - (cd / PULSE_COOLDOWN) * 100);
    if (p !== _pLast) { _pLast = p; btn.style.setProperty('--p', p); }
    if (ready !== _pReady) { _pReady = ready; btn.classList.toggle('ready', ready); }
}

function setupTouchUI() {
    const body = document.body;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) body.classList.add('touch');
    // Portátiles/tablets con pantalla táctil: el modo móvil se activa con el primer toque
    window.addEventListener('touchstart', () => {
        Input.lastTouch = Date.now();
        if (!body.classList.contains('touch')) body.classList.add('touch');
    }, { passive: true, capture: true });

    const btn = DOM.pulseBtn;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Input.lastTouch = Date.now();
        if (!engine || engine.state !== 'PLAYING' || !engine.player) return;
        if (engine.player.pulseCooldown > 0) {            // aún recargando: pequeño aviso
            btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny');
            haptic(15);
            return;
        }
        engine.player.pulse();
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());

    document.getElementById('scaleRange').addEventListener('input', (e) => {
        Settings.scale = parseFloat(e.target.value); applySettings();
    });
    // Sin zoom de pellizco ni menú contextual al mantener pulsado
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (body.classList.contains('touch')) e.preventDefault(); });
}

// ########## [menus.js] ##########
 
// ===================== PULSO, PAUSA, MENÚS Y AJUSTES =====================
AudioEngine.prototype.playPulse = function () {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
};

Object.assign(GameEngine.prototype, {
    shockwave(x, y, r) {
        this.rings.push({ x, y, max: r, life: 0.45, maxLife: 0.45 });
        for (const e of this.enemies) {
            const d = dist(x, y, e.x, e.y);
            if (e.dead || d > r + e.radius) continue;
            const n = Math.max(d, 1);
            this.hitEnemy(e, 1.5, (e.x - x) / n * 900, (e.y - y) / n * 900);
        }
        this.bullets = this.bullets.filter(b => !(b.isEnemy && dist(x, y, b.x, b.y) < r));
        this.addShake(12);
    },
    drawRings(ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 4;
        for (const r of this.rings) {
            const k = Math.max(0, r.life / r.maxLife);
            ctx.globalAlpha = k; ctx.strokeStyle = r.col || '#00f3ff';
            const R = r.max * (1 - k), n = Math.max(8, Math.min(72, Math.round(R * TAU / 7)));      // anillo punteado de cuadrados
            ctx.fillStyle = ctx.strokeStyle;
            for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.fillRect(Math.round((r.x + Math.cos(a) * R) / 4) * 4 - 2, Math.round((r.y + Math.sin(a) * R) / 4) * 4 - 2, 4, 4); }
        }
        ctx.restore();
    },
    togglePause() {
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') (Menu.current === 'pPause' ? this.resume() : Menu.back());
    },
    pause() {
        this.state = 'PAUSED';
        Input.keys = { w: false, a: false, s: false, d: false };
        Input.mouse.active = false;
        audio.ctx.suspend();
        Menu.open('pPause', true);
    },
    resume() {
        this.state = 'PLAYING';
        audio.resume();
        Menu.close();
    },
    toMenu() {
        audio.music.newRun();
        audio.startMusic();
        this.state = 'MENU';
        this.reset();
        Menu.open('pMain', true);
    }
});

// ----- Estadísticas guardadas (partidas, mejor onda) -----
const Stats = {
    key: 'linehotStats', d: { games: 0, bestWave: 0, kills: 0 },
    load() { try { Object.assign(this.d, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch (e) {} },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) {} },
    time(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
    paintMain() {
        document.getElementById('menuBest').innerText = bestScore.toString().padStart(6, '0');
        document.getElementById('menuBestWave').innerText = this.d.bestWave;
        document.getElementById('menuGames').innerText = this.d.games;
    },
    paintPause() {
        document.getElementById('pauseWave').innerText = engine.wave;
        document.getElementById('pauseScore').innerText = engine.score;
        document.getElementById('pauseTime').innerText = this.time(engine.time);
    }
};
Stats.load();

// Botones de confirmación: el primer toque "arma" el botón, el segundo ejecuta (se desarma solo a los 3 s)
function disarm(b) { clearTimeout(b._t); if (b._html != null) b.innerHTML = b._html; b._html = null; b.classList.remove('armed'); }
function armConfirm(b) {
    if (b.classList.contains('armed')) { disarm(b); return true; }
    b._html = b.innerHTML; b.classList.add('armed');
    b.innerHTML = '<span>' + b.dataset.confirm + '</span>';
    b._t = setTimeout(() => disarm(b), 3000);
    return false;
}

const Menu = {
    stack: [], current: 'pMain',
    show(id) {
        this.current = id;
        document.querySelectorAll('#screens .armed').forEach(disarm);
        document.querySelectorAll('#screens .panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
        DOM.screens.dataset.mode = id;
        DOM.screens.classList.remove('hidden');
        const p = document.getElementById(id);
        if (id === 'pMain') Stats.paintMain();
        if (id === 'pPause') Stats.paintPause();
        if (id === 'pOptions') { this.setTab(p, 'game'); this.syncOptions(); }
        if (id === 'pControls') this.setTab(p, isTouchUI() ? 'mobile' : 'pc');
        p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter');
        if (document.body.classList.contains('kbd')) setTimeout(() => this.focusFirst(p), 40);
    },
    focusFirst(p) {
        const f = this.focusables(p)[0];
        if (f) f.focus({ preventScroll: true });
    },
    focusables(p) {
        p = p || document.getElementById(this.current);
        return [...p.querySelectorAll('button, input[type=range]')].filter(el => el.offsetParent !== null && !el.disabled);
    },
    setTab(p, name) {
        p.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
        p.querySelectorAll('.tab-pane').forEach(x => x.classList.toggle('hidden', x.dataset.pane !== name));
        const body = p.querySelector('.card-body'); if (body) body.scrollTop = 0;
    },
    open(id, fresh = false) {
        if (fresh) this.stack = []; else this.stack.push(this.current);
        this.show(id);
    },
    back() { if (this.stack.length) this.show(this.stack.pop()); },
    close() { DOM.screens.classList.add('hidden'); },
    fillSlider(inp) {
        const k = (inp.value - inp.min) / (inp.max - inp.min) * 100;
        inp.style.setProperty('--p', k + '%');
    },
    syncOptions() {
        document.querySelectorAll('[data-action="toggle"]').forEach(b => {
            const on = !!Settings[b.dataset.key];
            b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
        });
        const set = (inp, val, out) => {
            const i = document.getElementById(inp); i.value = val; this.fillSlider(i);
            document.getElementById(out).innerText = Math.round(val * 100) + '%';
        };
        set('volRange', Settings.volume, 'volVal');
        set('musicRange', Settings.music, 'musicVal');
        set('scaleRange', Settings.scale, 'scaleVal');
        document.getElementById('pulseSideVal').innerText = Settings.pulseSide === 'left' ? 'IZQUIERDA' : 'DERECHA';
    }
};

// ----- Sonidos de interfaz (solo si el audio está activo; si no, quedarían en cola hasta reanudar) -----
AudioEngine.prototype.playUI = function (kind) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = { hover: [900, 1250, .05, .05], click: [520, 1040, .1, .16], back: [720, 360, .1, .13], toggle: [640, 960, .07, .11] }[kind] || [600, 900, .08, .1];
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(P[3] * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + P[2] + 0.03);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + P[2] + 0.04);
};

// ----- Estadísticas de la partida (inicio y fin) -----
const _initE = GameEngine.prototype.init;
GameEngine.prototype.init = function () {
    this._startBest = Number(bestScore) || 0;
    Stats.d.games++; Stats.save();
    return _initE.apply(this, arguments);
};
Menu.fillOver = function (e) {
    const isRec = e.score > 0 && e.score > (e._startBest || 0);
    const cell = (k, v, cls = '') => `<div class="stat ${cls}"><span class="stat-k">${k}</span><span class="stat-v">${v}</span></div>`;
    document.getElementById('overStats').innerHTML =
        cell('PUNTUACIÓN', e.score, 'wide') + cell('ONDA', e.wave) + cell('COMBO MÁX.', e.maxCombo || 0) +
        cell('ENEMIGOS', e.kills || 0) + cell('TIEMPO', Stats.time(e.time));
    document.getElementById('newRecord').classList.toggle('hidden', !isRec);
    Stats.d.bestWave = Math.max(Stats.d.bestWave, e.wave); Stats.d.kills += e.kills || 0; Stats.save();
};

function applySettings() {
    saveSettings();
    document.body.classList.toggle('perf', Settings.perf);
    audio.master.gain.value = Settings.volume;
    audio.music.setLevel(Settings.music);
    audio.music.setQuality(Settings.perf);
    document.body.classList.toggle('pulse-left', Settings.pulseSide === 'left');
    resize();
    document.getElementById('fpsEl').classList.toggle('hidden', !Settings.showFps);
    Menu.syncOptions();
}

function setupMenu() {
    let musicUnlocked = false;
    const startMenuMusic = () => {
        audio.resume();
        if (musicUnlocked) return;
        musicUnlocked = true;
        audio.music.newRun(); audio.startMusic();
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, startMenuMusic, { passive: true }));
    // Al volver a la app (o tras una llamada) el navegador puede dejar el audio suspendido
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (engine && engine.state === 'PLAYING') engine.pause(); }
    });
    DOM.screens.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const act = b.dataset.action;
        if (b.dataset.confirm && !armConfirm(b)) { audio.playUI('toggle'); return; }
        audio.playUI(act === 'back' ? 'back' : (act === 'toggle' || act === 'pulseSide' || act === 'tab' || b.closest('.seg')) ? 'toggle' : 'click');
        switch (act) {
            case 'tab': Menu.setTab(b.closest('.panel'), b.dataset.tab); break;
            case 'fullscreen': if (document.fullscreenElement) { document.exitFullscreen(); } else { enterImmersive(); } break;
            case 'play': case 'retry': engine.init(); break;
            case 'resume': engine.resume(); break;
            case 'menu': engine.toMenu(); break;
            case 'options': Menu.open('pOptions'); break;
            case 'controls': Menu.open('pControls'); break;
            case 'back': Menu.back(); break;
            case 'pulseSide': Settings.pulseSide = Settings.pulseSide === 'left' ? 'right' : 'left'; applySettings(); break;
            case 'toggle': Settings[b.dataset.key] = !Settings[b.dataset.key]; applySettings(); break;
            case 'clearBest':
                bestScore = 0; try { localStorage.removeItem('neonCarnageBest'); } catch (e) {}
                Stats.d.bestWave = 0; Stats.save();
                DOM.highScore.innerText = 'HI: 000000'; Menu.show('pOptions'); Menu.setTab(document.getElementById('pOptions'), 'game'); break;
        }
    });
    // --- teclado: modo "kbd" (anillo de foco visible), flechas/W-S para navegar, Esc para volver ---
    const fsBtn = document.getElementById('fsBtn');
    if (fsBtn && !document.fullscreenEnabled) fsBtn.classList.add('hidden');
    document.addEventListener('pointerdown', () => document.body.classList.remove('kbd'), true);
    document.addEventListener('keydown', (e) => {
        if (DOM.screens.classList.contains('hidden')) return;
        const k = e.key.toLowerCase();
        if (!document.body.classList.contains('kbd') && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab', 'enter', 'w', 's'].includes(k)) {
            document.body.classList.add('kbd');
            if (!DOM.screens.contains(document.activeElement)) Menu.focusFirst(document.getElementById(Menu.current));
        }
        const st = engine && engine.state;
        if (k === 'escape' && st !== 'PLAYING' && st !== 'PAUSED' && Menu.stack.length) { Menu.back(); audio.playUI('back'); return; }
        if (k === 'arrowup' || k === 'arrowdown' || k === 'w' || k === 's') {
            const list = Menu.focusables(), i = list.indexOf(document.activeElement);
            const d = (k === 'arrowdown' || k === 's') ? 1 : -1;
            const n = list[(i + d + list.length) % list.length];
            if (n && list.length) { n.focus({ preventScroll: false }); audio.playUI('hover'); e.preventDefault(); }
        }
        if ((k === 'arrowleft' || k === 'arrowright') && document.activeElement && document.activeElement.classList.contains('tab')) {
            const tabs = [...document.activeElement.parentElement.querySelectorAll('.tab')], i = tabs.indexOf(document.activeElement);
            const n = tabs[(i + (k === 'arrowright' ? 1 : -1) + tabs.length) % tabs.length];
            n.focus(); n.click(); e.preventDefault();
        }
    });
    // sonido al pasar el ratón por encima (solo ratón, no táctil)
    let lastHover = null;
    DOM.screens.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const t = e.target.closest('.btn, .row, .tab, .seg button');
        if (t && t !== lastHover) { lastHover = t; audio.playUI('hover'); } else if (!t) lastHover = null;
    });
    document.getElementById('volRange').addEventListener('input', (e) => {
        Settings.volume = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('musicRange').addEventListener('input', (e) => {
        Settings.music = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('pauseBtn').addEventListener('click', () => engine.togglePause());
}

// ########## [walls.js] ##########
// ===================== v4 · PAREDES, CÁMARA Y HORIZONTAL =====================
// PAREDES: arenas en cuadrícula con simetría, pasillos garantizados (>= 2 celdas) y conectividad comprobada.
// Se rehacen en cada oleada (jefe = arena casi abierta) y, con la misma semilla, al girar el móvil.
const CELL = 50;
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Piezas con las que se arman las arenas: [peso, celdas]. Las grandes dan estructura (cobertura real);
// las pequeñas rompen la monotonía. Cada pieza se gira/voltea al azar y se espeja según el "modo" de la arena.
const STAMP_LIB = [
    [2, [[0,0],[1,0],[2,0]]],                                   // barra 3
    [2, [[0,0],[1,0],[2,0],[3,0],[4,0]]],                       // barra 5
    [1, [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]],           // barra 7
    [2, [[0,0],[1,0],[2,0],[0,1],[0,2]]],                       // L
    [1, [[0,0],[1,0],[2,0],[1,1]]],                             // T
    [1, [[0,0],[1,0],[2,0],[1,1],[1,2]]],                       // T larga
    [1, [[1,0],[0,1],[1,1],[2,1],[1,2]]],                       // cruz
    [2, [[0,0],[0,1],[0,2],[1,0],[1,2]]],                       // U: cobertura con abertura
    [1, [[0,0],[1,0],[0,1],[1,1]]],                             // bloque 2x2
    [1, [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]],                 // bloque 3x2
    [1, [[0,0]]],                                               // pilar
    [1, [[0,0],[0,1],[1,1],[1,2]]],                             // S
    [1, [[0,0],[1,0],[1,1],[2,1],[2,2]]]                        // escalera
];
const STAMPS = STAMP_LIB.flatMap(([w, c]) => Array(w).fill(c));
const BOSS_STAMPS = [[[0,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]]];   // arena de jefe: pilares y bloques
// Paleta de paredes por "zona" (cambia tras cada jefe): verde -> azul -> violeta
const WALL_PAL = [[0, 255, 102], [47, 155, 255], [192, 75, 255]];
const Cam = { tilt: 0, ox: 0, oy: 0, punch: 0, m: [1, 0, 0, 1, 0, 0] };

Object.assign(GameEngine.prototype, {
    generateObstacles() { this.layout(false, null); },
    gridConnected(g, cols, rows) {
        let total = 0, start = -1;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!g[r][c]) { total++; if (start < 0) start = r * cols + c; }
        const seen = new Uint8Array(cols * rows), q = [start]; seen[start] = 1; let n = 0;
        while (q.length) {
            const i = q.pop(), c = i % cols, r = (i / cols) | 0; n++;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = c + dc, y = r + dr, j = y * cols + x;
                if (x >= 0 && y >= 0 && x < cols && y < rows && !g[y][x] && !seen[j]) { seen[j] = 1; q.push(j); }
            }
        }
        return n === total;
    },
    // Longitud máxima de una pared continua (en celdas) para que nunca se parta la arena en dos de un tajo
    maxRun(g, cols, rows) {
        let m = 0;
        for (let r = 0; r < rows; r++) { let n = 0; for (let c = 0; c < cols; c++) { n = g[r][c] ? n + 1 : 0; if (n > m) m = n; } }
        for (let c = 0; c < cols; c++) { let n = 0; for (let r = 0; r < rows; r++) { n = g[r][c] ? n + 1 : 0; if (n > m) m = n; } }
        return m;
    },
    layout(boss, avoid, seed, wv) {
        this.layoutBoss = boss; this.layoutSeed = seed = seed ?? ((Math.random() * 2 ** 31) | 0);
        wv = this.layoutWave = wv ?? (this.wave + 1);                    // nº de oleada de esta arena (se conserva al girar el móvil)
        const rnd = mulberry32(seed), cols = Math.floor(width / CELL), rows = Math.floor(height / CELL);
        const ox = (width - cols * CELL) / 2, oy = (height - rows * CELL) / 2, M = 2;
        const g = Array.from({ length: rows }, () => new Uint8Array(cols));
        const zones = (avoid && avoid.length ? avoid : [{ x: width / 2, y: height / 2 }]).map(p => ({ c: (p.x - ox) / CELL, r: (p.y - oy) / CELL }));
        const near = (c, r, R) => { for (let y = r - R; y <= r + R; y++) for (let x = c - R; x <= c + R; x++) if (g[y] && g[y][x]) return true; return false; };
        const okCell = (c, r) => c >= M && r >= M && c < cols - M && r < rows - M && !near(c, r, 2) && zones.every(z => Math.hypot(c + .5 - z.c, r + .5 - z.r) > 3.5);
        // Arenas simétricas (justas y legibles); casi nunca sin simetría
        const q = rnd(), mode = boss ? 'quad' : q < 0.25 ? 'mx' : q < 0.45 ? 'my' : q < 0.8 ? 'quad' : q < 0.95 ? 'rot' : 'none';
        const small = cols * rows < 200;                                 // pantallas pequeñas: menos densidad
        const target = Math.max(boss ? 4 : 10, Math.floor(cols * rows * (boss ? 0.03 : (small ? 0.06 : 0.075) + Math.min(wv, 10) * 0.004)));
        const LIM = Math.max(6, Math.min(8, Math.floor(Math.max(cols, rows) / 3)));
        let placed = 0;
        for (let n = 0; n < 260 && placed < target; n++) {
            let s = boss ? BOSS_STAMPS[Math.floor(rnd() * BOSS_STAMPS.length)] : STAMPS[Math.floor(rnd() * STAMPS.length)];
            if (rnd() < 0.5) s = s.map(([x, y]) => [-x, y]);
            for (let k = Math.floor(rnd() * 4); k-- > 0;) s = s.map(([x, y]) => [-y, x]);
            const mx = Math.min(...s.map(p => p[0])), my = Math.min(...s.map(p => p[1]));
            const bc = M + Math.floor(rnd() * (cols - 2 * M)), br = M + Math.floor(rnd() * (rows - 2 * M));
            const base = s.map(([x, y]) => [bc + x - mx, br + y - my]), copies = [base];
            const flip = (f) => base.map(([c, r]) => f(c, r));
            if (mode === 'mx' || mode === 'quad') copies.push(flip((c, r) => [cols - 1 - c, r]));
            if (mode === 'my' || mode === 'quad') copies.push(flip((c, r) => [c, rows - 1 - r]));
            if (mode === 'quad' || mode === 'rot') copies.push(flip((c, r) => [cols - 1 - c, rows - 1 - r]));
            // una copia y su espejo pueden fundirse en una pieza mayor, pero nunca dejar un pasillo de 1 celda
            const tight = copies.some((a, i) => copies.some((b, j) => i < j && a.some(([c1, r1]) => b.some(([c2, r2]) => Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2)) === 2))));
            const all = copies.flat();
            if (tight || !all.every(([c, r]) => okCell(c, r))) continue;
            const fresh = all.filter(([c, r]) => !g[r][c]);
            all.forEach(([c, r]) => g[r][c] = 1);
            if (!this.gridConnected(g, cols, rows) || this.maxRun(g, cols, rows) > LIM) { fresh.forEach(([c, r]) => g[r][c] = 0); continue; }
            placed += fresh.length;
        }
        const rects = [];                                  // celdas -> rectángulos (colisiones)
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (!g[r][c]) continue;
            let w = 1; while (c + w < cols && g[r][c + w]) w++;
            const up = rects.find(q => q.c === c && q.w === w && q.r + q.h === r);
            if (up) up.h++; else rects.push({ c, r, w, h: 1 });
            c += w - 1;
        }
        this.obstacles = rects.map(q => new Obstacle(ox + q.c * CELL, oy + q.r * CELL, q.w * CELL, q.h * CELL));
        this.wallGrid = { g, cols, rows, ox, oy }; this.wallCache = null; this.wallAnim = 0;
        this.wallPal = WALL_PAL[Math.floor((Math.max(wv, 1) - 1) / 5) % WALL_PAL.length];
        this._flow = null;                                  // el mapa de rutas de los enemigos se rehace con la arena nueva
        // índice celda -> muro: balas, partículas y enemigos consultan solo la celda en la que están
        const map = this.wallMap = new Int16Array(cols * rows).fill(-1);
        rects.forEach((q, i) => { for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) map[r * cols + c] = i; });
        for (const p of this.pickups) if (this.obstacles.some(w => p.x > w.x - 14 && p.x < w.x + w.w + 14 && p.y > w.y - 14 && p.y < w.y + w.h + 14)) Object.assign(p, this.freeSpot());
    },
    wallAt(x, y) {
        const w = this.wallGrid; if (!w) return null;
        const c = Math.floor((x - w.ox) / CELL), r = Math.floor((y - w.oy) / CELL);
        if (c < 0 || r < 0 || c >= w.cols || r >= w.rows) return null;
        const i = this.wallMap[r * w.cols + c];
        return i < 0 ? null : this.obstacles[i];
    },
    wallHit(x1, y1, x2, y2) {                          // ¿el tramo atraviesa un muro? (muestreo cada <=12 px)
        const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 12));
        for (let k = 1; k <= n; k++) if (this.wallAt(x1 + dx * k / n, y1 + dy * k / n)) return true;
        return false;
    },
    // Las paredes se pintan una vez (con su resplandor) en un lienzo y luego solo se copian: mucho más barato en móvil.
    // PIXEL ART: cada celda es un azulejo de 10x10 píxeles (1 px = 5 u. de juego) que se pinta en un lienzo diminuto
    // y se amplía SIN suavizado. Sin resplandor borroso: la luz es un halo punteado (dither), como en un juego de 16 bits.
    // Zona 0 = ladrillo, zona 1 = placas de metal con remaches, zona 2 = cristal tallado.
    buildWallCache(key) {
        const { g, cols, rows, ox, oy } = this.wallGrid;
        const cv = this.wallCache = this.wallCache || document.createElement('canvas');
        cv.width = canvas.width; cv.height = canvas.height;
        const c = cv.getContext('2d'); c.setTransform(renderK, 0, 0, renderK, 0, 0);
        const T = 10, P = CELL / T, M = 3, lw = cols * T + 2 * M, lh = rows * T + 2 * M;
        const lo = this._wallLow = this._wallLow || document.createElement('canvas'); lo.width = lw; lo.height = lh;
        const L = lo.getContext('2d'); L.clearRect(0, 0, lw, lh);
        const on = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && g[y][x];
        const pal = this.wallPal || WALL_PAL[0], zone = Math.max(0, WALL_PAL.findIndex(p => p === pal));
        const seed = (this.layoutSeed || 7) | 0;
        const hs = (x, y) => (((Math.imul(x + 11, 73856093) ^ Math.imul(y + 5, 19349663) ^ Math.imul(seed, 83492791)) >>> 0) % 1000) / 1000;
        const mix = (k, base) => 'rgb(' + pal.map((v, i) => Math.min(255, Math.round(v * k + base[i]))).join(',') + ')';
        const neon = 'rgb(' + pal.join(',') + ')', neonHi = 'rgb(' + pal.map(v => Math.round(v + (255 - v) * 0.55)).join(',') + ')';
        const neonLo = mix(0.5, [0, 0, 0]), dark = mix(0.05, [3, 5, 8]);
        const px = (x, y, w, h, col) => { L.fillStyle = col; L.fillRect(x, y, w, h); };
        // 1) sombra proyectada (luz arriba-izquierda) y halo punteado de neón por fuera de cada borde expuesto
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            if (!g[r][q]) continue;
            const x0 = M + q * T, y0 = M + r * T;
            if (!on(q, r + 1)) px(x0 + 1, y0 + T, T, 3, 'rgba(0,0,0,.42)');
            if (!on(q + 1, r)) px(x0 + T, y0 + 1, 2, T, 'rgba(0,0,0,.34)');
            L.fillStyle = 'rgba(' + pal.join(',') + ',.30)';
            for (let i = 0; i < T; i++) {
                if (!on(q, r - 1) && (x0 + i) % 2 === 0) L.fillRect(x0 + i, y0 - 1, 1, 1);
                if (!on(q, r + 1) && (x0 + i + 1) % 2 === 0) L.fillRect(x0 + i, y0 + T, 1, 1);
                if (!on(q - 1, r) && (y0 + i) % 2 === 0) L.fillRect(x0 - 1, y0 + i, 1, 1);
                if (!on(q + 1, r) && (y0 + i + 1) % 2 === 0) L.fillRect(x0 + T, y0 + i, 1, 1);
            }
        }
        // 2) cuerpo de cada celda según la zona
        const base = mix(0.15, [8, 10, 15]), lite = mix(0.27, [12, 15, 20]), liter = mix(0.38, [16, 20, 26]);
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            if (!g[r][q]) continue;
            const x0 = M + q * T, y0 = M + r * T;
            px(x0, y0, T, T, base);
            if (zone === 0) {                                              // ladrillo: 2 hileras de ladrillos de 5x5, desfasadas
                for (let rj = 0; rj < 2; rj++) {
                    const yy = y0 + rj * 5, off = rj ? 2 : 0;
                    for (let bi = 0; bi < 2; bi++) {
                        const bx = x0 + ((bi * 5 + off) % T), v = hs(q * 2 + bi + rj * 7, r * 2 + rj);
                        const col = v < 0.3 ? base : v < 0.75 ? lite : liter;
                        const wrap = bx + 4 > x0 + T - 1;                        // el ladrillo desfasado se parte en el borde de la celda
                        px(bx, yy, wrap ? x0 + T - bx : 4, 4, col);
                        if (wrap) px(x0, yy, 4 - (x0 + T - bx), 4, col);
                        px(bx, yy, wrap ? x0 + T - bx : 4, 1, liter);           // brillo superior
                    }
                    px(x0, yy + 4, T, 1, dark);                                 // junta horizontal
                    for (let bi = 0; bi < 2; bi++) px(x0 + ((bi * 5 + off + 4) % T), yy, 1, 4, dark);   // juntas verticales
                }
            } else if (zone === 1) {                                       // placas de metal 5x5 con remaches y luces
                for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
                    const bx = x0 + i * 5, by = y0 + j * 5, v = hs(q * 2 + i, r * 2 + j);
                    px(bx, by, 4, 4, v < 0.5 ? lite : base);
                    px(bx, by, 4, 1, liter); px(bx, by, 1, 4, liter);          // bisel claro arriba/izquierda
                    px(bx + 3, by + 1, 1, 3, dark); px(bx + 1, by + 3, 3, 1, dark);   // bisel oscuro abajo/derecha
                    px(bx + 1, by + 1, 1, 1, neonHi);                           // remache
                    if (v > 0.9) px(bx + 2, by + 2, 1, 1, neon);                // luz de estado
                    px(bx + 4, by, 1, 5, dark); px(bx, by + 4, 5, 1, dark);     // juntas
                }
            } else {                                                       // cristal: facetas diagonales y destellos
                for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
                    const d = (i + j + hs(q, r) * 3 | 0) % 6, col = d < 2 ? base : d < 4 ? lite : liter;
                    if (col !== base) px(x0 + i, y0 + j, 1, 1, col);
                }
                px(x0, y0 + 4, T, 1, dark); px(x0 + 4, y0, 1, T, dark);        // grietas entre facetas
                if (hs(q + 9, r + 3) > 0.55) px(x0 + 2 + (hs(q, r) * 5 | 0), y0 + 2 + (hs(r, q) * 5 | 0), 1, 1, neonHi);   // destello
            }
        }
        // 3) borde de neón en cada lado expuesto (2 px, con luz arriba/izquierda y sombra abajo/derecha) y esquinas
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            if (!g[r][q]) continue;
            const x0 = M + q * T, y0 = M + r * T, u = !on(q, r - 1), d = !on(q, r + 1), l = !on(q - 1, r), rt = !on(q + 1, r);
            if (u) { px(x0, y0, T, 1, neonHi); px(x0, y0 + 1, T, 1, neon); }
            if (l) { px(x0, y0, 1, T, neonHi); px(x0 + 1, y0 + (u ? 2 : 0), 1, T - (u ? 2 : 0), neon); }
            if (d) { px(x0, y0 + T - 2, T, 1, neon); px(x0, y0 + T - 1, T, 1, neonLo); }
            if (rt) { px(x0 + T - 2, y0, 1, T - (d ? 2 : 0), neon); px(x0 + T - 1, y0, 1, T, neonLo); }
            if (u && l) px(x0, y0, 2, 2, '#ffffff');
            if (u && rt) px(x0 + T - 1, y0, 1, 1, neonHi);
            if (d && l) px(x0, y0 + T - 1, 1, 1, neonLo);
            // esquinas cóncavas: celda con vecinos arriba e izquierda pero vacío en la diagonal
            if (!u && !l && !on(q - 1, r - 1)) px(x0, y0, 2, 2, neon);
            if (!u && !rt && !on(q + 1, r - 1)) px(x0 + T - 2, y0, 2, 2, neon);
            if (!d && !l && !on(q - 1, r + 1)) px(x0, y0 + T - 2, 2, 2, neonLo);
            if (!d && !rt && !on(q + 1, r + 1)) px(x0 + T - 2, y0 + T - 2, 2, 2, neonLo);
        }
        c.imageSmoothingEnabled = false;
        c.drawImage(lo, 0, 0, lw, lh, ox - M * P, oy - M * P, lw * P, lh * P);
        this.wallKey = key;
    },
    drawWalls(ctx) {
        if (!this.wallGrid) return;
        const key = canvas.width + 'x' + canvas.height + '@' + renderK.toFixed(3) + Settings.perf + Q.level;
        if (!this.wallCache || this.wallKey !== key) this.buildWallCache(key);
        const a = this.wallAnim ?? 1;
        ctx.save(); ctx.globalAlpha = a * a; ctx.drawImage(this.wallCache, 0, 0, width, height); ctx.restore();
    },
    drawStains(ctx) {                                      // las manchas existían pero nunca se dibujaban
        if (Settings.perf || !this.stains.length) return;
        ctx.save();
        for (const s of this.stains) { ctx.globalAlpha = 0.35 * Math.min(1, s.life / 2); ctx.fillStyle = s.color; pixDot(ctx, s.x, s.y, s.r); }
        ctx.restore();
    },
    // CÁMARA: balanceo (inclinación + desfase según la velocidad) y "golpe" de zoom con las sacudidas.
    // Ahora va dentro del canvas: funciona también en táctil y el ratón sigue apuntando bien.
    updateCam(dt) {
        const p = this.player, on = Settings.sway && this.state === 'PLAYING' && p, k = 1 - Math.exp(-dt * 8);
        Cam.tilt += ((on ? clamp(p.vx * 0.015, -4, 4) * Math.PI / 180 : 0) - Cam.tilt) * k;
        Cam.ox += ((on ? clamp(-p.vx * 0.02, -8, 8) : 0) - Cam.ox) * k;
        Cam.oy += ((on ? clamp(-p.vy * 0.02, -8, 8) : 0) - Cam.oy) * k;
        Cam.punch += (Math.min(this.shakeAmount * 0.0008, 0.04) - Cam.punch) * k;
        this.wallAnim = Math.min(1, (this.wallAnim ?? 1) + dt / 0.6);
    },
    drawBackdrop(ctx) {
        const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
        const s = 1.02 + Math.abs(Cam.tilt) * 1.2 + Cam.punch, co = Math.cos(Cam.tilt) * s, si = Math.sin(Cam.tilt) * s;
        Cam.m = [co, si, -si, co, cx - co * cx + si * cy + Cam.ox * dpr, cy - si * cx - co * cy + Cam.oy * dpr];
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
        if (!this.gridPath) return;
        // cuadrícula como vector, con la misma cámara que el mundo (antes: copia de un lienzo del tamaño de la pantalla)
        ctx.setTransform(Cam.m[0] * renderK, Cam.m[1] * renderK, Cam.m[2] * renderK, Cam.m[3] * renderK, Cam.m[4], Cam.m[5]);
        const zi = Math.floor((Math.max(this.layoutWave || 1, 1) - 1) / 5) % 3, gc = [[0, 243, 255], [47, 155, 255], [192, 75, 255]][zi];
        const ga = 0.05 + Math.min(0.14, this.shakeAmount * 0.003 + (this._gp || 0));       // la cuadrícula late con los golpes y las bajas
        ctx.strokeStyle = 'rgba(' + gc.join(',') + ',' + ga.toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke(this.gridPath);
    }
});
function updateMouseWorld() {                              // pantalla -> mundo, deshaciendo la cámara
    const m = Input.mouse; if (m.cx === undefined) return;
    const [a, b, c, d, e, f] = Cam.m, det = a * d - b * c, X = m.cx * dpr - e, Y = m.cy * dpr - f;
    m.x = (d * X - c * Y) / det / renderK; m.y = (-b * X + a * Y) / det / renderK;
}
const _startWave = GameEngine.prototype.startWave;
GameEngine.prototype.startWave = function () {
    const next = this.wave + 1;
    if (next > 1) { this.layout(next % 5 === 0, [this.player]); this.addShake(14); audio.playPulse(); }
    _startWave.call(this);
};
const _rescale = GameEngine.prototype.rescaleWorld;
GameEngine.prototype.rescaleWorld = function (ow, oh) {
    _rescale.call(this, ow, oh);
    this.layout(this.layoutBoss, [this.player], this.layoutSeed, this.layoutWave); this.wallAnim = 1;
};

// HORIZONTAL: intenta bloquear la orientación (Android, en pantalla completa) y, si sigue en vertical, sugiere girar.
function enterImmersive() {
    const lock = () => { try { if (isTouchUI() && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    try { const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen().then(lock).catch(() => {}); else lock(); } catch (e) {}
}
const Orient = {
    el: document.getElementById('rotateOverlay'), mq: matchMedia('(orientation: portrait)'), auto: false,
    dismissed: (() => { try { return sessionStorage.getItem('ncPortraitOk') === '1'; } catch (e) { return false; } })(),
    needed() { return isTouchUI() && this.mq.matches && Math.min(innerWidth, innerHeight) < 640; },
    check() {
        if (!engine) return;
        const portrait = this.needed();
        if (portrait && !this.dismissed && engine.state === 'PLAYING') { this.auto = true; engine.pause(); }
        if (engine.state !== 'PAUSED') this.auto = false;
        this.el.classList.toggle('hidden', !(portrait && !this.dismissed && this.auto));
        if (!portrait && this.auto) this.release();
    },
    release() { this.auto = false; this.el.classList.add('hidden'); if (engine.state === 'PAUSED' && Menu.current === 'pPause') engine.resume(); }
};
Orient.mq.addEventListener('change', () => Orient.check());
window.addEventListener('resize', () => Orient.check());
document.getElementById('rotateDismiss').addEventListener('click', () => {
    Orient.dismissed = true; try { sessionStorage.setItem('ncPortraitOk', '1'); } catch (e) {}
    try { screen.orientation.unlock(); } catch (e) {}
    Orient.release();
});
const _init = GameEngine.prototype.init;
GameEngine.prototype.init = function () { _init.call(this); setTimeout(() => Orient.check(), 150); };
// ========================================================

// ########## [jefes.js] ##########
// ########## [boss.js] ##########

// ===================== JEFE Y DAÑO POR DISTANCIA (v2) =====================
// Balas del jugador: más daño de cerca, menos de lejos. Así acercarse compensa.
function bulletFalloff(b) {
    if (b.isEnemy) return 1;
    return clamp(1.5 - dist(b.x, b.y, b.ox, b.oy) / 600, 0.5, 1.4);
}

// IA del jefe: se acerca, guarda distancia, dispara patrones, marca una embestida y carga.
Enemy.prototype.bossAI = function (dt, px, py) {
    const b = this, rage = b.hp / b.maxHp < 0.5;
    b.t += dt; b.enraged = rage;
    b.fireCooldown -= dt;
    b.chargeCd = (b.chargeCd ?? 4) - dt;
    let vx = 0, vy = 0;

    if (b.rush > 0) {                                   // embestida en curso
        b.rush -= dt; vx = b.rushX; vy = b.rushY;
        if (b.rush <= 0) b.recover = 0.8;
    } else if (b.telegraph > 0) {                       // aviso: la línea punteada marca la dirección
        b.telegraph -= dt;
        if (b.telegraph <= 0) {
            const d = Math.max(dist(b.x, b.y, px, py), 1);
            b.rushX = (px - b.x) / d * 950; b.rushY = (py - b.y) / d * 950; b.rush = 0.4;
        }
    } else if (b.recover > 0) {                         // vulnerable un momento tras embestir
        b.recover -= dt;
    } else {                                            // combate a media distancia
        const d = dist(b.x, b.y, px, py), ang = Math.atan2(py - b.y, px - b.x);
        const sp = rage ? 130 : 90, along = d > 320 ? 1 : d < 200 ? -0.9 : 0.25;
        const side = Math.sin(b.t * 1.4) * 0.8;         // se mueve de lado a lado
        vx = Math.cos(ang) * sp * along - Math.sin(ang) * sp * side;
        vy = Math.sin(ang) * sp * along + Math.cos(ang) * sp * side;
        if (b.fireCooldown <= 0 && b.t > 1.5) engine.bossAttack(b);
        if (b.chargeCd <= 0) { b.telegraph = rage ? 0.8 : 1.1; b.chargeCd = rage ? 4 : 6; }
    }

    if (b.spiral) {                                     // espiral de 3 brazos
        b.spiral.timer -= dt;
        if (b.spiral.timer <= 0) {
            b.spiral.timer = 0.07;
            for (let k = 0; k < 3; k++) engine.bullets.push(new Bullet(b.x, b.y, b.spiral.a + k * TAU / 3, { speed: 240, color: C.pink, damage: 10, name: 'ENEMY_GUN' }, true));
            b.spiral.a += 0.2;
            if (--b.spiral.n <= 0) b.spiral = null;
        }
    }

    b.x = clamp(b.x + vx * dt, b.radius, width - b.radius);
    b.y = clamp(b.y + vy * dt, b.radius, height - b.radius);
    engine.obstacles.forEach(obs => {
        const res = rectCircleCollide(b.x, b.y, b.radius, obs.x, obs.y, obs.w, obs.h);
        if (res.hit) { b.x += res.nx * res.pen; b.y += res.ny * res.pen; }
    });
};

// Patrones del jefe, en rotación. Cada uno tiene una forma distinta de esquivarse.
Object.assign(GameEngine.prototype, {
    bossAttack(b) {
        const rage = b.enraged, pa = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        const mk = (a, s, dmg = 10) => this.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: C.pink, damage: dmg, name: 'ENEMY_GUN' }, true));
        const pick = (b.pat = ((b.pat ?? -1) + 1) % 4);

        if (pick === 0) {                               // anillo con hueco: hay que buscar la salida
            const n = rage ? 30 : 22, gap = Math.floor(Math.random() * n);
            for (let i = 0; i < n; i++) if (((i - gap + n) % n) >= 3) mk(i / n * TAU + b.t, rage ? 240 : 190);
            b.fireCooldown = rage ? 1.8 : 2.4;
        } else if (pick === 1) {                        // espiral (se procesa en bossAI)
            b.spiral = { n: rage ? 32 : 22, a: pa, timer: 0 };
            b.fireCooldown = 3.0;
        } else if (pick === 2) {                        // abanico dirigido al jugador
            const k = rage ? 3 : 2;
            for (let i = -k; i <= k; i++) mk(pa + i * 0.13, 420);
            b.fireCooldown = rage ? 1.3 : 1.8;
        } else {                                        // invoca enjambre (máximo 14 enemigos en pantalla)
            if (this.enemies.length < 14) {
                for (let i = 0; i < (rage ? 3 : 2); i++) {
                    const a = Math.random() * TAU;
                    this.enemies.push(new Enemy(0, b.x + Math.cos(a) * b.radius, b.y + Math.sin(a) * b.radius, 1.2));
                }
            }
            b.fireCooldown = 3.0;
        }
        audio.playShoot('ENEMY_GUN', true); this.addShake(8);
    }
});

// Línea punteada de aviso de embestida, dibujada en el espacio local del jefe
const _drawBigBase = Enemy.prototype.drawBig;
Enemy.prototype.drawBig = function (ctx) {
    if (this.boss && this.telegraph > 0 && engine.player) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = C.red; ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.telegraph * 40);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(engine.player.x - this.x, engine.player.y - this.y);
        ctx.stroke();
        ctx.restore();
    }
    _drawBigBase.call(this, ctx);
};


// ########## [minijefes.js] ##########
// =====================================================================
//  MINIJEFES (antes minijefes.js, va DESPUÉS de game.js)
// =====================================================================

// =====================================================================
//  MINIJEFES — Neon Carnage (v6)
//  Cargar DESPUÉS de game.js (sobrescribe métodos de sus clases).
//
//  CÍRCULOS (tipo 4, rojos, hexágono que gira):
//    move → se acercan girando · aim → se paran y apuntan con una línea de aviso
//    que se alarga (1.1 s para salir) · charge → embisten en esa dirección
//    · recover → quedan vulnerables un momento. Si chocan con una pared, frenan.
//
//  CUADRADOS (tipo 1, morados):
//    move → se acercan · crouch → se agachan y marcan en el suelo el círculo
//    donde caerán (0.6 s) · air → saltan hacia ese punto (0.9 s) mientras el
//    círculo de aviso se cierra · impacto → onda expansiva con daño en área
//    · stun → aturdidos un momento.
//
//  Enemigos normales: al tocar al jugador rebotan (no se quedan pegados).
//  Jugador: un poco más rápido para poder escapar.
// =====================================================================

const MINI_R = 78;                       // radio de impacto del cuadrado
const MINI_CHARGE_T = 0.55;

const miniTurn = (a, target, max) => a + clamp(Math.atan2(Math.sin(target - a), Math.cos(target - a)), -max, max);
const miniSet = (e, s) => { e.mstate = s; e.mt = 0; };
function miniBounds(e) {
    e.x = clamp(e.x, e.radius, width - e.radius);
    e.y = clamp(e.y, e.radius, height - e.radius);
}
function miniWalls(e) {                  // empuja fuera de las paredes; devuelve true si chocó
    let hit = false;
    for (const obs of engine.obstacles) {
        const res = rectCircleCollide(e.x, e.y, e.radius, obs.x, obs.y, obs.w, obs.h);
        if (res.hit) { e.x += res.nx * res.pen; e.y += res.ny * res.pen; hit = true; }
    }
    return hit;
}

// ---------- CÍRCULO ----------
function miniCircle(dt, px, py) {
    const e = this;
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    e.mstate = e.mstate || 'move';
    e.mt = (e.mt || 0) + dt;
    e.spin = (e.spin || 0) + dt * (e.mstate === 'charge' ? 14 : e.mstate === 'aim' ? 4 : 1.5);
    const ang = Math.atan2(py - e.y, px - e.x), d = dist(e.x, e.y, px, py);
    let vx = e.knockback.x, vy = e.knockback.y;

    if (e.mstate === 'move') {
        const sa = engine.steer(e, ang); vx += Math.cos(sa) * 75; vy += Math.sin(sa) * 75;
        e.chargeCd = (e.chargeCd ?? 1.8) - dt;
        if (e.chargeCd <= 0 && d < 560) { e.aimA = ang; miniSet(e, 'aim'); }
    } else if (e.mstate === 'aim') {                    // parado: la línea sigue al jugador despacio
        e.aimA = miniTurn(e.aimA, ang, dt * 1.8);
        if (e.mt >= 1.3) { e.dirX = Math.cos(e.aimA); e.dirY = Math.sin(e.aimA); miniSet(e, 'charge'); }
    } else if (e.mstate === 'charge') {
        vx += e.dirX * 580; vy += e.dirY * 580;
        if (e.mt >= MINI_CHARGE_T) miniSet(e, 'recover');
    } else if (e.mstate === 'recover') {
        if (e.mt >= 1.3) { e.chargeCd = 2.4 + Math.random() * 1.4; miniSet(e, 'move'); }
    }

    e.x += vx * dt; e.y += vy * dt;
    if (miniWalls(e) && e.mstate === 'charge') miniSet(e, 'recover');
    miniBounds(e);
}

// ---------- CUADRADO ----------
function miniSquare(dt, px, py) {
    const e = this;
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    e.mstate = e.mstate || 'move';
    e.mt = (e.mt || 0) + dt;
    const ang = Math.atan2(py - e.y, px - e.x), d = dist(e.x, e.y, px, py);
    let vx = e.knockback.x, vy = e.knockback.y;

    if (e.mstate === 'move') {
        const sa = engine.steer(e, ang); vx += Math.cos(sa) * 85; vy += Math.sin(sa) * 85;
        e.jumpCd = (e.jumpCd ?? 1.2) - dt;
        if (e.jumpCd <= 0 && d < 620) {                  // fija el punto de caída en este instante
            e.sx = e.x; e.sy = e.y; e.tx = px; e.ty = py; e.z = 0;
            miniSet(e, 'crouch');
        }
    } else if (e.mstate === 'crouch') {
        if (e.mt >= 0.6) miniSet(e, 'air');
    } else if (e.mstate === 'air') {
        const k = clamp(e.mt / 0.9, 0, 1);
        e.x = e.sx + (e.tx - e.sx) * k;
        e.y = e.sy + (e.ty - e.sy) * k;
        e.z = Math.sin(Math.PI * k) * 130;               // arco de salto
        if (k >= 1) { e.z = 0; miniImpact(e); miniSet(e, 'stun'); }
    } else if (e.mstate === 'stun') {
        if (e.mt >= 1.1) { e.jumpCd = 2.0 + Math.random() * 1.3; miniSet(e, 'move'); }
    }

    if (e.mstate === 'move') {
        e.x += vx * dt; e.y += vy * dt;
        miniWalls(e); miniBounds(e);
    }
}

function miniImpact(e) {
    const p = engine.player;
    engine.spawnParticle(e.tx, e.ty, e.color, 45, 0, 0, 600, 'blood');
    engine.spawnParticle(e.tx, e.ty, C.white, 12, 0, 0, 350);
    engine.rings.push({ x: e.tx, y: e.ty, max: MINI_R * 1.2, life: 0.5, maxLife: 0.5, col: '#ff3333' });
    engine.addShake(38); haptic([60, 30, 120]); audio.playExplosion();
    if (engine.state === 'PLAYING' && p && p.iframes <= 0 && dist(e.tx, e.ty, p.x, p.y) < MINI_R + p.radius) {
        const n = Math.max(dist(e.tx, e.ty, p.x, p.y), 1);
        p.hp -= 16; p.iframes = 0.8;
        p.kx += (p.x - e.tx) / n * 420; p.ky += (p.y - e.ty) / n * 420;
        engine.addShake(30);
        engine.spawnParticle(p.x, p.y, C.red, 25, 0, 0, 500, 'blood');
        if (p.hp <= 0) engine.gameOver();
    }
}

// ---------- ENGANCHE: enemigos normales rebotan en vez de quedarse pegados ----------
function antiStick(e) {
    const p = engine.player;
    if (!p || e.boss) return;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), min = p.radius + e.radius;
    if (d < min && d > 0.01) {
        const k = (min - d) / d;
        e.x += dx * k * 0.35; e.y += dy * k * 0.35;      // separación suave
        e.knockback.x += dx / d * 60; e.knockback.y += dy / d * 60;   // rebote
    }
}

// ---------- ACTUALIZACIÓN ----------
const _enemyUpdate = Enemy.prototype.update;
Enemy.prototype.update = function (dt, px, py) {
    if (this.type === 4) return miniCircle.call(this, dt, px, py);
    if (this.type === 1) return miniSquare.call(this, dt, px, py);
    _enemyUpdate.call(this, dt, px, py);
    antiStick(this);
};

// ---------- DIBUJO ----------
function miniLanding(ctx, e) {
    const k = e.mstate === 'air' ? clamp(e.mt / 0.9, 0, 1) : clamp(e.mt / 0.6, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(engine.time * 16);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,51,51,${0.08 + 0.12 * pulse + 0.1 * k})`;
    ctx.strokeStyle = `rgba(255,51,51,${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(e.tx, e.ty, MINI_R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,230,0,0.9)'; ctx.lineWidth = 2;   // el anillo amarillo se cierra hasta el impacto
    ctx.beginPath(); ctx.arc(e.tx, e.ty, Math.max(2, MINI_R * (1 - k)), 0, TAU); ctx.stroke();
    ctx.restore();
}

function miniAim(ctx, e) {
    const k = clamp(e.mt / 1.3, 0, 1), L = 40 + 520 * k, pulse = 0.5 + 0.5 * Math.sin(engine.time * 18);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(e.x, e.y); ctx.rotate(e.aimA);
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = `rgba(255,51,51,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(e.radius, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,51,51,0.85)';
    ctx.beginPath(); ctx.moveTo(L + 14, 0); ctx.lineTo(L - 6, -10); ctx.lineTo(L - 6, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
}

function miniSpinDots(ctx, e) {                        // círculo: tres puntos orbitando (muestran lo rápido que gira)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = e.mstate === 'charge' ? C.white : e.color;
    for (let i = 0; i < 3; i++) {
        const a = e.spin + i * TAU / 3, r = e.radius + 12;
        ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 3.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
}

const _enemyDraw = Enemy.prototype.draw;
Enemy.prototype.draw = function (ctx) {
    if (this.type !== 1 && this.type !== 4) return _enemyDraw.call(this, ctx);
    const e = this;
    if (e.type === 1 && (e.mstate === 'crouch' || e.mstate === 'air')) miniLanding(ctx, e);
    if (e.type === 4 && e.mstate === 'aim') miniAim(ctx, e);

    const y0 = e.y, z = e.z || 0;
    e.y -= z;                                          // el cuadrado sube al saltar
    _enemyDraw.call(e, ctx);
    e.y = y0;

    if (e.type === 4) miniSpinDots(ctx, e);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(10 * textBoost())}px Orbitron`;
    ctx.fillStyle = C.yellow;
    ctx.fillText('MINIJEFE', e.x, e.y - z - e.radius - 26);
    ctx.restore();
};

// ---------- JUGADOR MÁS RÁPIDO ----------
// Antes el jugador era más lento que los enemigos en contacto y estos se quedaban pegados.
const _reset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function () {
    _reset.call(this);
    this.player.baseSpeed = 440;
};

// ---------- OLEADAS DE MINIJEFES ----------
const _startWaveMini = GameEngine.prototype.startWave;
GameEngine.prototype.startWave = function () {
    _startWaveMini.call(this);
    const w = this.wave;
    if (w % 5 !== 0 && w % 4 === 0) {                  // cada 4 oleadas (no de jefe): tema y minijefes extra
        audio.music.setSection('mini');
        const extra = 1 + Math.floor(w / 12);
        for (let i = 0; i < extra; i++) this.queue.splice(Math.floor(Math.random() * (this.queue.length + 1)), 0, { t: 4, n: 1, d: 1.4 });
        this.spawnText(width / 2, height * 0.45, 'MINIJEFES', C.yellow);
    }
    audio.music.call('setWaveSize', this.queue.reduce((a, q) => a + q.n, 0));
};

// ########## [sfx.js] ##########
// =====================================================================
//  EFECTOS DE SONIDO — oscuros, frenéticos y saturados
//  Base: MI FRIGIO (E F G A B C D): la segunda menor (F) da tensión y el
//  tritono (E-Bb) da el toque siniestro. Mismo centro tonal que el tema
//  "abyss" (mi frigio) y tempo de 165 BPM (la rejilla de semicorcheas).
//  Técnicas: bajos de sierra desafinados una octava abajo + sub cuadrado,
//  envolventes de filtro con ataque rápido, saturación fuerte, FM metálico
//  con relación de tritono, y pinchazos que caen de tono.
//  Los sonidos críticos (explosión, golpe al jugador, pulso) nunca se descartan.
// =====================================================================

const SFX_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let SFX_LITE = false;                           // se activa solo si el audio se entrecorta (ver MusicEngine.noteResync)
const SFX_MAX_VOICES = SFX_TOUCH ? 14 : 24;     // cada voz son varios nodos: en móvil saturaban el hilo de audio

// Nivel de carga del audio: 0 = normal · 1 = el motor va apretado (sin reverb larga, menos capas) · 2 = se está cortando (modo ligero).
// Se sube antes de que se corte: si la música gasta más de ~45 % de su tiempo o hubo un corte hace menos de 6 s.
const sfxLevel = () => {
    if (SFX_LITE) return 2;
    const m = typeof audio !== 'undefined' && audio.music;
    if (!m) return 0;
    return (m.cpu > 0.45 || performance.now() - (m.lastResync || -1e9) < 6000) ? 1 : 0;
};
let _sfxVoices = 0;

const SFX_BPM = 165;
const SFX_STEP = 60 / SFX_BPM / 4;
const SFX_PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];   // E F G A B C D
const SFX_ROOT = 64;                            // E4
const sfxMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const sfxNote = (deg, oct = 0) => SFX_ROOT + SFX_PHRYGIAN[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
const SFX_TRITONE = 6;                          // E -> Bb: el intervalo "siniestro"

// Siguiente semicorchea de la rejilla, anclada al inicio de la música
const sfxGrid = (c, t) => {
    const t0 = (audio.music && audio.music.baseFrame) ? audio.music.baseFrame / c.sampleRate : 0;
    return t0 + Math.ceil((t - t0) / SFX_STEP - 1e-6) * SFX_STEP;
};

const sfxFilter = (c, type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
const sfxOsc = (c, type, f0, f1, t, d) => {
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && d > 0) o.frequency.exponentialRampToValueAtTime(f1, t + d);
    return o;
};
const sfxEnv = (g, t, peak, attack, decay) => {
    const a = Math.max(attack, 0.0005);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
};
const sfxSweep = (param, f0, f1, t, d) => { param.setValueAtTime(f0, t); param.exponentialRampToValueAtTime(f1, t + d); };
// Saturación fuerte y bitcrush opcional: lo "sucio" y oscuro
const _sfxCurves = new Map();                     // cada curva se calcula una sola vez (antes: 1024 tanh en cada sonido)
const sfxCurve = (k, levels = 0) => {
    const key = k + '|' + levels, hit = _sfxCurves.get(key);
    if (hit) return hit;
    const n = 1024, c = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        let y = Math.tanh(k * x) / norm;
        if (levels) y = Math.round(y * levels) / levels;
        c[i] = y;
    }
    _sfxCurves.set(key, c);
    return c;
};
// Envolvente y saturación al final de la cadena
const sfxDirty = (c, o, t, d, peak, k = 14, levels = 0) => {
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k, levels); sh.oversample = d > 0.3 ? '2x' : 'none';
    sfxEnv(g, t, peak, 0.001, d);
    o.connect(sh); sh.connect(g);
    return g;
};
// Bajo oscuro: dos sierras desafinadas una octava abajo + sub cuadrado, filtro que cae
const sfxDarkBass = (c, t, midi, d, peak, k = 18) => {
    const a = sfxOsc(c, 'sawtooth', sfxMidi(midi - 12) * 0.99, sfxMidi(midi - 12) * 0.8, t, d);
    const b = sfxOsc(c, 'sawtooth', sfxMidi(midi - 12) * 1.01, sfxMidi(midi - 12) * 0.8, t, d);
    const sub = sfxOsc(c, 'square', sfxMidi(midi - 24), sfxMidi(midi - 24) * 0.9, t, d);
    const mix = c.createGain(); mix.gain.value = 0.35;
    a.connect(mix); b.connect(mix); sub.connect(mix);
    const lp = sfxFilter(c, 'lowpass', 900, 4);
    sfxSweep(lp.frequency, 900, 90, t, d);
    mix.connect(lp);
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k); sh.oversample = d > 0.3 ? '2x' : 'none';   // el sobremuestreo solo compensa en sonidos largos
    sfxEnv(g, t, peak, 0.001, d);
    lp.connect(sh); sh.connect(g);
    [a, b, sub].forEach((o) => { o.start(t); o.stop(t + d + 0.03); });
    return g;
};
// Pinchazo: sierra + cuadrada desafinadas, filtro que cierra, saturación
const sfxStab = (c, t, f0, f1, d, peak, k = 16) => {
    const a = sfxOsc(c, 'sawtooth', f0, f1, t, d), b = sfxOsc(c, 'square', f0 * 1.007, f1 * 1.007, t, d);
    const mix = c.createGain(); mix.gain.value = 0.5;
    a.connect(mix); b.connect(mix);
    const lp = sfxFilter(c, 'lowpass', 3500, 3);
    sfxSweep(lp.frequency, 3500, 200, t, d);
    mix.connect(lp);
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k); sh.oversample = d > 0.3 ? '2x' : 'none';
    sfxEnv(g, t, peak, 0.001, d);
    lp.connect(sh); sh.connect(g);
    a.start(t); a.stop(t + d + 0.02); b.start(t); b.stop(t + d + 0.02);
    return g;
};
// Campana FM metálica: relación 1.414 (tritono) da un timbre inarmónico y siniestro
const sfxFMMetal = (c, f, idx, t, d, peak) => {
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.setValueAtTime(f, t); mod.frequency.setValueAtTime(f * 1.414, t);
    mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(0.01, t + d);
    mod.connect(mg); mg.connect(car.frequency);
    sfxEnv(g, t, peak, 0.001, d); car.connect(g);
    car.start(t); mod.start(t); car.stop(t + d + 0.05); mod.stop(t + d + 0.05);
    return g;
};

// ---------- infraestructura: ruido y salas ----------
AudioEngine.prototype._sfxInit = function () {
    if (this._sfx) return this._sfx;
    const c = this.ctx, sr = c.sampleRate;
    const noise = c.createBuffer(1, sr, sr), nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const makeIR = (sec, pow) => {
        const len = Math.floor(sr * sec), ir = c.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, pow);
        }
        return ir;
    };
    const dry = c.createGain(); dry.connect(this.master);
    const room = c.createConvolver(); room.buffer = makeIR(0.3, 3);
    const roomOut = c.createGain(); roomOut.gain.value = 0.3; room.connect(roomOut); roomOut.connect(this.master);
    const hall = c.createConvolver(); hall.buffer = makeIR(SFX_TOUCH ? 0.9 : 1.4, 2);   // la reverb larga es lo que más cuesta al hilo de audio
    const hallOut = c.createGain(); hallOut.gain.value = 0.4; hall.connect(hallOut); hallOut.connect(this.master);
    this._sfx = { noise, dry, room, hall };
    return this._sfx;
};

AudioEngine.prototype._sfxOut = function (node, roomAmt = 0, hallAmt = 0) {
    const f = this._sfxInit(), lv = sfxLevel();
    node.connect(f.dry);
    if (roomAmt > 0 && lv < 2) { const s = this.ctx.createGain(); s.gain.value = roomAmt; node.connect(s); s.connect(f.room); }
    if (hallAmt > 0 && lv < 1) { const s = this.ctx.createGain(); s.gain.value = hallAmt; node.connect(s); s.connect(f.hall); }
};

AudioEngine.prototype._sfxNoise = function (t, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._sfxInit().noise;
    s.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
    s.start(t, Math.random() * 0.5, dur);
    return s;
};

AudioEngine.prototype._sfxBand = function (t, dur, type, f0, f1, q, peak, attack, decay, room = 0, hall = 0) {
    const c = this.ctx, d = Math.max(dur, attack + decay + 0.02);
    const n = this._sfxNoise(t, d), f = sfxFilter(c, type, f0, q), g = c.createGain();
    if (f1) sfxSweep(f.frequency, f0, f1, t, d);
    sfxEnv(g, t, peak, attack, decay);
    n.connect(f); f.connect(g);
    this._sfxOut(g, room, hall);
};

AudioEngine.prototype._sfxVoice = function (dur, critical = false) {
    const lv = sfxLevel();
    if (!critical && _sfxVoices >= (lv === 2 ? 8 : lv === 1 ? Math.round(SFX_MAX_VOICES * 0.7) : SFX_MAX_VOICES)) return false;
    if (critical && _sfxVoices >= SFX_MAX_VOICES + (SFX_TOUCH ? 6 : 12)) return false;   // v1.8: tope duro (explosiones en cadena en oleadas altas saturaban el hilo de audio y todo dejaba de sonar)
    _sfxVoices++;
    setTimeout(() => { _sfxVoices--; }, dur * 1000 + 50);
    return true;
};

// ---------- armas ----------
// Pistola: crujido seco, bajo oscuro en E y pinchazo que cae
AudioEngine.prototype._sfxPistol = function (t) {
    if (!this._sfxVoice(0.15)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.01, 'bandpass', 2500, 800, 1.2, 0.8, 0.0005, 0.008, 0.05);
    this._sfxOut(sfxDarkBass(c, t, 40, 0.1, 0.9), 0.05);
    this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2)), sfxMidi(sfxNote(0, 1)), 0.05, 0.3, 14), 0.08);
};

// Escopeta: explosión sucia con sub profundo y metal FM en tritono
AudioEngine.prototype._sfxShotgun = function (t) {
    if (!this._sfxVoice(0.35)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.12, 'lowpass', 2500, 120, 0.7, 1.0, 0.0005, 0.1, 0.1);
    this._sfxOut(sfxDarkBass(c, t, 40, 0.35, 1.0, 20), 0.1);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(0, 1)), 1.5, t, 0.12, 0.2), 0.1);
    for (let i = 0; i < 3; i++) {                  // bomba: tres clics descendentes
        this._sfxBand(t + 0.36 + i * 0.03, 0.02, 'bandpass', 1400 - i * 300, null, 2, 0.4, 0.0005, 0.018, 0.1);
    }
};

// Ametralladora: tacs graves y agresivos alternando notas frigias (ritmo tenso)
AudioEngine.prototype._sfxMinigun = function (t) {
    if (!this._sfxVoice(0.05)) return;
    this._sfxMinigun.n = ((this._sfxMinigun.n || 0) + 1) % 4;
    const deg = [0, 1, 0, 3][this._sfxMinigun.n];
    const o = sfxOsc(this.ctx, 'square', sfxMidi(sfxNote(deg, 0)) * 1.5, sfxMidi(sfxNote(deg, 0)), t, 0.02);
    this._sfxOut(sfxDirty(this.ctx, o, t, 0.02, 0.25, 16, 8), 0.02);
    o.start(t); o.stop(t + 0.04);
    this._sfxBand(t, 0.006, 'highpass', 5000, null, 0.8, 0.35, 0.0005, 0.005);
};

// Katana: silbido oscuro y campana metálica en tritono
AudioEngine.prototype._sfxKatana = function (t) {
    if (!this._sfxVoice(0.2)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.12, 'bandpass', 600, 5000, 1.5, 0.5, 0.005, 0.11, 0.2);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(4, 1)) * 1.0, 2, t + 0.03, 0.25, 0.2), 0.3);
};

// Railgun (oscuro y de cine): drone que sube en E, boom profundo, y un zumbido FM que se corta
AudioEngine.prototype._sfxRail = function (t) {
    if (!this._sfxVoice(1.0, true)) return;
    const c = this.ctx;
    this._sfxOut(sfxDarkBass(c, t - 0.3, 40, 0.3, 0.5, 10), 0.1, 0.3);
    this._sfxBand(t, 0.06, 'highpass', 2500, null, 0.7, 0.9, 0.0005, 0.05, 0.1, 0.2);
    this._sfxOut(sfxDarkBass(c, t, 28, 0.5, 1.0, 22), 0.1, 0.5);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(0, 1)) * 2, 3, t, 0.4, 0.1), 0.2, 0.6);
};

AudioEngine.prototype.playShoot = function (w, isEnemy = false) {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime;
    if (isEnemy) {                                  // disparo enemigo: segunda menor, sucia y tensa
        if (!this._sfxVoice(0.12)) return;
        this._sfxOut(sfxStab(this.ctx, t, sfxMidi(sfxNote(2, 0)), sfxMidi(sfxNote(1, 0)), 0.09, 0.25, 16), 0.08);
        return;
    }
    if (w === 'KATANA') return this._sfxKatana(t);
    if (w === 'RAILGUN') return this._sfxRail(t);
    if (w === 'SHOTGUN') return this._sfxShotgun(t);
    if (w === 'MINIGUN') return this._sfxMinigun(t);
    return this._sfxPistol(t);
};

// ---------- impactos y eventos ----------
// Impacto sin muerte: golpe seco con la segunda menor (F)
AudioEngine.prototype.playTick = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.05)) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastTick || 0) < (sfxLevel() ? 0.08 : 0.04)) return;
    this._lastTick = t;
    this._sfxOut(sfxStab(this.ctx, t, sfxMidi(sfxNote(1, 1)), sfxMidi(sfxNote(1, 1)) * 0.97, 0.025, 0.22, 14), 0.02);
};

// Muerte: salpicadura y arpegio frigio sombrío que termina en tritono; el combo lo hace más tenso
AudioEngine.prototype.playHit = function (isPlayer = false) {
    if (!this.isPlaying) return;
    const c = this.ctx, t = c.currentTime;
    if (isPlayer) {                                 // te golpean: bajo brutal + tritono
        if (!this._sfxVoice(0.4, true)) return;
        this._sfxOut(sfxDarkBass(c, t, 40, 0.25, 1.0, 20), 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2)), sfxMidi(sfxNote(0, 2)), 0.15, 0.3, 18), 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2) + SFX_TRITONE), sfxMidi(sfxNote(0, 2) + SFX_TRITONE), 0.15, 0.25, 18), 0.05);
        return;
    }
    const lv = sfxLevel();
    if (t - (this._lastKillSfx || 0) < (lv === 2 ? 0.09 : lv === 1 ? 0.07 : 0.045)) return;     // varias muertes casi a la vez suenan como una
    this._lastKillSfx = t;
    if (!this._sfxVoice(0.3)) return;
    this._sfxBand(t, 0.03, 'lowpass', 1200, 150, 0.8, 0.7, 0.0005, 0.03, 0.05);
    const combo = (typeof engine !== 'undefined' && engine) ? engine.combo : 0;
    const pattern = [0, 1, 3, 1];                   // E F A F: tensión frigia
    const t0 = sfxGrid(c, t + 0.005), oct = Math.min(Math.floor(combo / 4), 2);
    for (let i = 0; i < (lv === 2 ? 2 : lv === 1 ? 3 : 4); i++) {
        const deg = pattern[(i + combo) % 4];
        const f = sfxMidi(sfxNote(deg, oct));
        this._sfxOut(sfxStab(c, t0 + i * SFX_STEP, f, f * 0.99, SFX_STEP * 0.9, 0.22, 16), 0.1);
    }
};

AudioEngine.prototype.playExplosion = function () {
    if (!this.isPlaying) return;
    const c = this.ctx, t = c.currentTime;
    if (t - (this._lastExp || -1) < (sfxLevel() ? 0.12 : 0.07)) return;     // v1.8: explosiones casi simultáneas suenan como una (cada una son ~25 nodos con reverb)
    this._lastExp = t;
    if (!this._sfxVoice(1.3, true)) return;
    this._sfxBand(t, 0.02, 'highpass', 3000, null, 0.7, 0.9, 0.0005, 0.015, 0.05);
    this._sfxOut(sfxDarkBass(c, t, 28, 1.0, 1.0, 20), 0.1, 0.5);
    // cluster en tritono: el "acorde" de la explosión
    [sfxMidi(SFX_ROOT - 24), sfxMidi(SFX_ROOT - 24 + SFX_TRITONE)].forEach((f) => this._sfxOut(sfxFMMetal(c, f, 2, t, 0.6, 0.12), 0.1, 0.4));
    for (let i = 0; i < 8; i++) {                    // escombros oscuros
        this._sfxBand(t + 0.02 + i * SFX_STEP * 0.5, 0.02, 'bandpass', 1200 + Math.random() * 1500, null, 1.5, 0.3, 0.001, 0.015, 0.05, 0.1);
    }
};

// Recoger objeto: campana grave y lenta que sube por la escala frigia (sin ser alegre)
AudioEngine.prototype.playPickup = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.4)) return;
    const c = this.ctx, t0 = sfxGrid(c, c.currentTime);
    [0, 1, 3, 5].forEach((deg, i) => this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(deg, 0)), 1.2, t0 + i * SFX_STEP * 2, 0.35, 0.14), 0.15, 0.2));
};

// Pulso: barrido oscuro de E1 a E3 con golpe de sub
AudioEngine.prototype.playPulse = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.6, true)) return;
    const c = this.ctx, t = c.currentTime;
    this._sfxOut(sfxDarkBass(c, t, 28, 0.5, 1.0, 22), 0.1, 0.4);
    this._sfxBand(t, 0.4, 'bandpass', 200, 3000, 1.5, 0.4, 0.05, 0.35, 0.2, 0.3);
};

AudioEngine.prototype.playDash = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.1)) return;
    const t = this.ctx.currentTime;
    this._sfxBand(t, 0.1, 'bandpass', 700, 4500, 1.5, 0.35, 0.005, 0.09, 0.1);
};

// Impacto sin muerte: se engancha al final de hitEnemy de game.js
const _hitEnemyFx = GameEngine.prototype.hitEnemy;
GameEngine.prototype.hitEnemy = function (e, damage, fx, fy, isMelee = false) {
    const wasAlive = !e.dead;
    _hitEnemyFx.call(this, e, damage, fx, fy, isMelee);
    if (wasAlive && !e.dead) audio.playTick();
};
// Prepara ruido y reverberaciones al arrancar la música (si no, el primer disparo se atasca generándolos)
const _startMusicSfx = AudioEngine.prototype.startMusic;
AudioEngine.prototype.startMusic = function () { _startMusicSfx.call(this); this._sfxInit(); };

// ########## [arranque.js] ##########
// ########## [boot.js] ##########

// ===================== v5 · CALIDAD ADAPTABLE =====================
// Si los FPS caen de forma sostenida, el juego baja solo resolución, brillo y partículas (sin tocar la jugabilidad).
function setQuality(l) { Q.level = l; Q.glow = [1, 0.6, 0.3, 0][l]; document.body.dataset.q = l; }
let _slow = 0, _qGrace = 0;      // _qGrace: hasta ese instante (performance.now) no se baja la calidad
function autoQuality(fps) {
    if (!Settings.autoQ || Settings.perf || !engine || engine.state !== 'PLAYING' || Q.level >= 3) { _slow = 0; return; }
    // Solo baja si va mal de forma SOSTENIDA (3 s) y no justo al empezar la partida ni con la pestaña oculta
    if (document.hidden || performance.now() < _qGrace) { _slow = 0; return; }
    _slow = fps < 40 ? _slow + 1 : 0;
    if (_slow >= 6) { _slow = 0; setQuality(Q.level + 1); resize(); }
}
const _applySettings = applySettings;
applySettings = function () { if (!Settings.autoQ || Settings.perf) setQuality(0); _applySettings(); };
// ==================================================================

window.onload = function() {
    resize();
    engine = new GameEngine();
    setupMenu();
    setupTouchUI();
    applySettings();
    Menu.show('pMain');
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
};


// ########## [calidad.js] ##########
// =====================================================================
//  CALIDAD GRÁFICA Y OPTIMIZACIONES (antes calidad.js, va la ÚLTIMA)
// =====================================================================

// =====================================================================
//  CALIDAD — tres modos: CALIDAD · EQUILIBRADO · RENDIMIENTO
//  Cargar AL FINAL (después de minijefes.js).
//
//  Cada modo ajusta: resolución, resplandor, partículas, CRT, sombras
//  y la frecuencia interna de la música. El modo se guarda en el navegador.
//
//  Además, optimizaciones que NO cambian lo que se ve:
//   - el HUD solo escribe en el DOM cuando el valor cambia
//   - no se crean objetos nuevos cada fotograma (dirección del jugador)
//   - el degradado de la estela se crea una vez y se reutiliza
// =====================================================================

const QUALITY = {
    calidad:     { label: 'CALIDAD',     level: 0, musicSR: 48000, musicSRtouch: 24000 },
    equilibrado: { label: 'EQUILIBRADO', level: 1, musicSR: 24000, musicSRtouch: 16000 },
    rendimiento: { label: 'RENDIMIENTO', level: 2, musicSR: 16000, musicSRtouch: 16000 }
};
const QUALITY_ORDER = ['calidad', 'equilibrado', 'rendimiento'];

let qualityMode = (() => {
    try { const v = localStorage.getItem('neonCarnageQuality'); return QUALITY[v] ? v : 'equilibrado'; }
    catch (e) { return 'equilibrado'; }
})();

// ---------- Ajustes de un modo ----------
// "level" es el índice de calidad que ya usa game.js (resolución, resplandor, partículas, CRT).
// El modo rendimiento además activa Settings.perf (sin resplandor, sin manchas, sin inclinación).
function applyQuality(id) {
    if (!QUALITY[id]) return;
    qualityMode = id;
    try { localStorage.setItem('neonCarnageQuality', id); } catch (e) {}
    Settings.perf = id === 'rendimiento';
    saveSettings();
    setQuality(QUALITY[id].level);
    document.body.classList.toggle('perf', Settings.perf);
    audio.music.setQuality(id === 'rendimiento');
    audio.music.setSampleRate(audio.music.touch ? QUALITY[id].musicSRtouch : QUALITY[id].musicSR);
    resize();
    syncQualityLabel();
}

// Tras cualquier ajuste, el nivel vuelve al del modo elegido (el automático solo baja desde ahí).
function reapplyQualityLevel() {
    setQuality(QUALITY[qualityMode].level);
    document.body.classList.toggle('perf', Settings.perf);
}

const QUALITY_HINT = {
    calidad: 'Todo al máximo: resplandor, CRT y partículas.',
    equilibrado: 'Buen equilibrio entre aspecto y fluidez.',
    rendimiento: 'Más FPS: sin resplandor ni CRT.'
};
function syncQualityLabel() {
    document.querySelectorAll('#qualitySeg [data-q]').forEach(b => {
        const on = b.dataset.q === qualityMode;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    const h = document.getElementById('qualityHint');
    if (h) h.textContent = QUALITY_HINT[qualityMode] || '';
}

// Selector de calidad (3 botones)
DOM.screens.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#qualitySeg [data-q]');
    if (b) applyQuality(b.dataset.q);
});

const _syncOptions = Menu.syncOptions;
Menu.syncOptions = function () { _syncOptions.call(this); syncQualityLabel(); };

const _applySettingsQ = applySettings;
applySettings = function () { _applySettingsQ(); reapplyQualityLevel(); };

const _onloadQ = window.onload;
window.onload = function () { _onloadQ.call(this); applyQuality(qualityMode); };

// ---------- Optimización: escribir en el DOM solo si cambia ----------
// (los anchos de las barras se redondean a 0,5 %: así no se reescribe el estilo en cada fotograma por décimas invisibles)
const pct = (x) => (Math.round(x * 2) / 2) + '%';
function setCss(el, prop, v) {
    if (!el._q) el._q = {};
    if (el._q[prop] !== v) { el._q[prop] = v; el.style[prop] = v; }
}
function setText(el, v) {
    if (el._qt !== v) { el._qt = v; el.innerText = v; }
}

// ---------- Jugador: misma lógica que game.js, sin escrituras repetidas ----------
Player.prototype.update = function (dt) {
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    let speedMult = (this.weapon.name === 'MINIGUN' && (Input.right.active || Input.mouse.active)) ? 0.5 : 1;
    if (this.katanaSwingTime > 0) speedMult = 0.2;

    let kx = 0, ky = 0;
    if (Input.keys.w) ky -= 1;
    if (Input.keys.s) ky += 1;
    if (Input.keys.a) kx -= 1;
    if (Input.keys.d) kx += 1;

    if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        kx /= len; ky /= len;
        this.vx = kx * this.baseSpeed * speedMult;
        this.vy = ky * this.baseSpeed * speedMult;
        Input.lastDir.x = kx; Input.lastDir.y = ky;
    } else if (Input.left.active && Input.left.force > 0.1) {
        this.vx = Input.left.vector.x * this.baseSpeed * Input.left.force * speedMult;
        this.vy = Input.left.vector.y * this.baseSpeed * Input.left.force * speedMult;
        Input.lastDir.x = Input.left.vector.x; Input.lastDir.y = Input.left.vector.y;
    } else {
        this.vx *= 0.8; this.vy *= 0.8;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x += this.kx * dt; this.y += this.ky * dt;
    this.kx *= 0.86; this.ky *= 0.86;
    this.iframes -= dt;
    if (this.trail.length >= 16) { const o = this.trail.shift(); o.x = this.x; o.y = this.y; this.trail.push(o); }
    else this.trail.push({ x: this.x, y: this.y });
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    const obs = engine.obstacles;
    for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        const res = rectCircleCollide(this.x, this.y, this.radius, o.x, o.y, o.w, o.h);
        if (res.hit) { this.x += res.nx * res.pen; this.y += res.ny * res.pen; }
    }

    this.fireCooldown -= dt;
    if (this.katanaSwingTime > 0) this.katanaSwingTime -= dt;

    if (Input.mouse.active) {
        this.angle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);
        if (this.fireCooldown <= 0) this.shoot();
    } else if (Input.right.active && Input.right.force > 0.3) {
        let aim = Math.atan2(Input.right.vector.y, Input.right.vector.x);
        if (Settings.aimAssist) aim = engine.assistAim(this.x, this.y, aim);
        this.angle = aim;
        if (this.fireCooldown <= 0) this.shoot();
    } else if (Input.mouse.cx !== undefined && Date.now() - Input.lastTouch >= 700 && !(typeof LH !== 'undefined' && LH.GP && LH.GP.active)) {
        this.angle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);   // sin disparar: el protagonista también sigue al ratón
    }

    setCss(DOM.healthFill, 'width', pct(Math.max(0, (this.hp / this.maxHp) * 100)));
    if (DOM.hpNum) setText(DOM.hpNum, Math.max(0, Math.ceil(this.hp)));
    setCss(DOM.dashFill, 'width', pct(this.pulseCooldown <= 0 ? 100 : 100 - (this.pulseCooldown / PULSE_COOLDOWN) * 100));
    updatePulseButton(this.pulseCooldown);
    setText(DOM.weaponName, (typeof LH !== 'undefined' && LH.wLabel) ? LH.wLabel(this) : this.weapon.name);
    if (typeof LH !== 'undefined' && LH.paintWeaponIcon) LH.paintWeaponIcon(this);
    setCss(DOM.weaponName, 'color', this.weapon.color);
    setText(DOM.weaponAmmo, this.ammo === Infinity ? '∞' : this.ammo);
};

// ---------- Estela: un solo degradado reutilizado (se dibuja desplazado a la posición) ----------
let _trailGrad = null;
Player.prototype.drawTrail = function (ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const t = this.trail;
    ctx.strokeStyle = C.cyan;
    for (let i = 1; i < t.length; i++) {
        const a = i / t.length;
        ctx.globalAlpha = a * 0.5; ctx.lineWidth = a * 14;
        ctx.beginPath(); ctx.moveTo(t[i - 1].x, t[i - 1].y); ctx.lineTo(t[i].x, t[i].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!_trailGrad) {
        _trailGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
        _trailGrad.addColorStop(0, 'rgba(0,243,255,0.25)');
        _trailGrad.addColorStop(1, 'rgba(0,243,255,0)');
    }
    ctx.translate(this.x, this.y);
    ctx.fillStyle = _trailGrad;
    ctx.fillRect(-100, -100, 200, 200);
    ctx.restore();
};

// ---------- Postproceso: misma lógica que game.js, HUD solo al cambiar ----------
GameEngine.prototype.postUpdate = function (dt) {
    const p = this.player;
    this.hpGhost = this.hpGhost > p.hp ? this.hpGhost + (p.hp - this.hpGhost) * Math.min(1, dt * 2.5) : p.hp;
    setCss(UI2.hpGhost, 'width', pct(Math.max(0, this.hpGhost / p.maxHp * 100)));
    audio.music.setHealth(p.hp / p.maxHp);

    let boss = null;
    for (const e of this.enemies) if (e.boss && !e.dead) { boss = e; break; }
    const showBoss = !!boss && this.state === 'PLAYING';
    if (UI2.bossBar._shown !== showBoss) { UI2.bossBar._shown = showBoss; UI2.bossBar.classList.toggle('hidden', !showBoss); }
    if (boss) {
        this.bossHp += (boss.hp / boss.maxHp - this.bossHp) * Math.min(1, dt * 8);
        setCss(UI2.bossFill, 'width', pct(Math.max(0, this.bossHp * 100)));
    } else this.bossHp = 1;

    if (p.weapon.type === 'rail') setText(DOM.weaponAmmo, p.ammo + (isTouchUI() ? (p.fireCooldown > 0 ? ' ..' : ' OK') : (p.fireCooldown > 0 ? '  RECARGANDO' : '  LISTO')));

    for (const s of this.slashes) {
        s.life -= dt;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b.isEnemy || dist(s.x, s.y, b.x, b.y) > s.r + 10) continue;
            const d = Math.atan2(b.y - s.y, b.x - s.x) - s.a;
            if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < Math.PI / 2) {
                this.spawnParticle(b.x, b.y, C.white, 6, 0, 0, 250);
                this.bullets.splice(i, 1);
            }
        }
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    for (let i = this.beams.length - 1; i >= 0; i--) {
        this.beams[i].life -= dt;
        if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    this.updateCam(dt);
};

// ---------- Sprites precalentados ----------
// Cada sprite con resplandor se crea la primera vez que se dibuja; si eso ocurre en plena partida (un jefe nuevo,
// un cambio de calidad) provoca un tirón. Aquí se crean todos de golpe al arrancar y al cambiar resolución/calidad.
function warmSprites() {
    try {
        const sc = document.createElement('canvas').getContext('2d');
        for (const t of [0, 1, 2, 4, 5]) for (const f of [0, 1]) {
            const e = new Enemy(t, 0, 0, 1); if (f) e.knockback.x = 99; e.draw(sc);
        }
        new Player(0, 0).draw(sc);
        for (const k of ['SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'HEALTH']) new Pickup(0, 0, k).draw(sc);
        for (const col of [C.yellow, C.pink, C.cyan, C.red]) Spr.halo(col);
    } catch (e) {}
}
