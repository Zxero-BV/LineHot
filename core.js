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
        set(v) { desc.set.call(this, (BLUR_OK && !Settings.perf) ? v * renderK * Q.glow : 0); }
    });
})();
const Q = { level: 0, glow: 1 };   // calidad automática: 0 = máxima ... 3 = mínima

// SPRITES CON RESPLANDOR: cada figura se pinta UNA vez (con su shadowBlur) en un lienzo pequeño y después solo se
// copia con drawImage: mismo aspecto, una fracción del coste. Se rehacen solos al cambiar resolución o calidad.
const Spr = {
    map: new Map(), ver: '', stamp: 0,
    sync() {
        const v = renderK.toFixed(3) + '|' + Settings.perf + '|' + Q.level;
        if (v !== this.ver) { this.ver = v; this.map.clear(); this.stamp++; if (typeof warmSprites === 'function') warmSprites(); }
    },
    make(id, w, h, draw) {                       // w, h en unidades del mundo; el origen queda en el centro
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil(w * renderK)); cv.height = Math.max(1, Math.ceil(h * renderK));
        const c = cv.getContext('2d');
        c.setTransform(renderK, 0, 0, renderK, cv.width / 2, cv.height / 2);
        BLUR_OK = true; try { draw(c); } finally { BLUR_OK = false; }
        const s = { cv, w: cv.width / renderK, h: cv.height / renderK };
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
    dpr = Settings.perf ? 1 : Math.min(window.devicePixelRatio || 1, [isTouchUI() ? 1.5 : 2, 1.25, 1, 1][Q.level]);
    renderK = zoom * dpr;
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
