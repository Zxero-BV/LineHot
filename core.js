const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
 
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d', { alpha: false });
 
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
const PULSE_COOLDOWN = 5;
const Settings = Object.assign(
    { perf: false, volume: 0.6, music: 0.6, vibrate: true, shake: true, showFps: false, aimAssist: true, pulseSide: 'right', scale: 1, autoQ: true, sway: !matchMedia('(prefers-reduced-motion: reduce)').matches },
    (() => { try { return JSON.parse(localStorage.getItem('neonCarnageSettings')) || {}; } catch (e) { return {}; } })()
);
function saveSettings() { localStorage.setItem('neonCarnageSettings', JSON.stringify(Settings)); }
// Modo rendimiento: anula el resplandor (shadowBlur) en todo el canvas sin tocar cada llamada
(() => {
    const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, Settings.perf ? 0 : v * renderK * Q.glow); }
    });
})();
const Q = { level: 0, glow: 1 };   // calidad automática: 0 = máxima ... 3 = mínima
let bestScore = localStorage.getItem('neonCarnageBest') || 0;
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
    RAILGUN: { name: "RAILGUN", fireRate: 1.6, color: C.cyan, damage: 12, type: 'rail', recoil: 30 }
};
 
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
    if (bgCanvas.width !== pw) bgCanvas.width = pw;
    if (bgCanvas.height !== ph) bgCanvas.height = ph;
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
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
// Al alejar el mundo (móvil) los objetos pequeños se compensan un poco para seguir viéndose bien.
const pickupBoost = () => clamp(Math.pow(1 / zoom, 0.7), 1, 1.6);
const textBoost = () => clamp(Math.pow(1 / zoom, 0.5), 1, 1.35);
const isTouchUI = () => document.body.classList.contains('touch');
 
function rectCircleCollide(cx, cy, radius, rx, ry, rw, rh) {
    let testX = cx; let testY = cy;
    if (cx < rx) testX = rx; else if (cx > rx + rw) testX = rx + rw;
    if (cy < ry) testY = ry; else if (cy > ry + rh) testY = ry + rh;
    
    let distX = cx - testX; let distY = cy - testY;
    let distance = Math.sqrt((distX*distX) + (distY*distY));
    
    if (distance <= radius) {
        if (distance === 0) {
            let dLeft = cx - rx; let dRight = (rx+rw) - cx;
            let dTop = cy - ry; let dBot = (ry+rh) - cy;
            let minD = Math.min(dLeft, dRight, dTop, dBot);
            if(minD === dLeft) return { hit: true, nx: -1, ny: 0, pen: radius + dLeft };
            if(minD === dRight) return { hit: true, nx: 1, ny: 0, pen: radius + dRight };
            if(minD === dTop) return { hit: true, nx: 0, ny: -1, pen: radius + dTop };
            return { hit: true, nx: 0, ny: 1, pen: radius + dBot };
        }
        return { hit: true, nx: distX / distance, ny: distY / distance, pen: radius - distance };
    }
    return { hit: false };
}
 
function lineRectCollide(x1, y1, x2, y2, rx, ry, rw, rh) {
    let left = lineLineCollide(x1,y1,x2,y2, rx,ry,rx,ry+rh);
    let right = lineLineCollide(x1,y1,x2,y2, rx+rw,ry,rx+rw,ry+rh);
    let top = lineLineCollide(x1,y1,x2,y2, rx,ry,rx+rw,ry);
    let bottom = lineLineCollide(x1,y1,x2,y2, rx,ry+rh,rx+rw,ry+rh);
    return left || right || top || bottom;
}
 
function lineLineCollide(x1, y1, x2, y2, x3, y3, x4, y4) {
    let uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    let uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
}
 
