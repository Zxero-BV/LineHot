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
 
let width, height;                    // tamaño LÓGICO del mundo (unidades de juego)
let viewW = 0, viewH = 0;             // tamaño de pantalla en px CSS
let zoom = 1, dpr = 1, renderK = 1;   // zoom del mundo, densidad de píxeles, zoom*dpr
let lastTime = 0;
const PULSE_COOLDOWN = 5;
const Settings = Object.assign(
    { perf: false, volume: 0.6, music: 0.6, vibrate: true, shake: true, showFps: false, aimAssist: true, pulseSide: 'right', scale: 1 },
    (() => { try { return JSON.parse(localStorage.getItem('neonCarnageSettings')) || {}; } catch (e) { return {}; } })()
);
function saveSettings() { localStorage.setItem('neonCarnageSettings', JSON.stringify(Settings)); }
// Modo rendimiento: anula el resplandor (shadowBlur) en todo el canvas sin tocar cada llamada
(() => {
    const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, Settings.perf ? 0 : v * renderK); }
    });
})();
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
    dpr = Settings.perf ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
        if (ow && oh) engine.rescaleWorld(ow, oh);
        engine.redrawBackground();
    }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); setTimeout(resize, 600); });
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
 
// Motor de Audio
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(15, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);
 
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
    Input.mouse.x = e.clientX / zoom;
    Input.mouse.y = e.clientY / zoom;
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
 
// Entidades del Juego
class Obstacle {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = C.green;
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(0, 255, 102, 0.1)';
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y); ctx.lineTo(this.x+this.w, this.y+this.h);
        ctx.moveTo(this.x+this.w, this.y); ctx.lineTo(this.x, this.y+this.h);
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
        ctx.stroke();
        ctx.restore();
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
 
    update(dt) {
        if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
            let speedMult = (this.weapon.name === 'MINIGUN' && (Input.right.active || Input.mouse.active)) ? 0.5 : 1;
            if (this.katanaSwingTime > 0) speedMult = 0.2;
 
            // Procesar input de teclado
            let kx = 0, ky = 0;
            if (Input.keys.w) ky -= 1;
            if (Input.keys.s) ky += 1;
            if (Input.keys.a) kx -= 1;
            if (Input.keys.d) kx += 1;
 
            if (kx !== 0 || ky !== 0) {
                // Normalizar vector del teclado (para evitar movimiento diagonal rápido)
                let length = Math.hypot(kx, ky);
                kx /= length; ky /= length;
                this.vx = kx * this.baseSpeed * speedMult;
                this.vy = ky * this.baseSpeed * speedMult;
                Input.lastDir = {x: kx, y: ky};
            } else if (Input.left.active && Input.left.force > 0.1) {
                // Input móvil táctil
                this.vx = Input.left.vector.x * this.baseSpeed * Input.left.force * speedMult;
                this.vy = Input.left.vector.y * this.baseSpeed * Input.left.force * speedMult;
                Input.lastDir = {x: Input.left.vector.x, y: Input.left.vector.y};
            } else {
                this.vx *= 0.8; this.vy *= 0.8;
            }
 
        this.x += this.vx * dt;
        this.y += this.vy * dt;
 
        this.x += this.kx * dt; this.y += this.ky * dt; this.kx *= 0.86; this.ky *= 0.86; this.iframes -= dt;
        this.trail.push({x: this.x, y: this.y}); if (this.trail.length > 16) this.trail.shift();
        this.x = clamp(this.x, this.radius, width - this.radius);
        this.y = clamp(this.y, this.radius, height - this.radius);
 
        engine.obstacles.forEach(obs => {
            let res = rectCircleCollide(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h);
            if (res.hit) {
                this.x += res.nx * res.pen;
                this.y += res.ny * res.pen;
            }
        });
 
        this.fireCooldown -= dt;
        if (this.katanaSwingTime > 0) this.katanaSwingTime -= dt;
 
        // Apuntado y disparo Híbrido (Ratón o Táctil)
        if (Input.mouse.active) {
            this.angle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);
            if (this.fireCooldown <= 0) this.shoot();
        } else if (Input.right.active && Input.right.force > 0.3) {
            let aim = Math.atan2(Input.right.vector.y, Input.right.vector.x);
            if (Settings.aimAssist) aim = engine.assistAim(this.x, this.y, aim);
            this.angle = aim;
            if (this.fireCooldown <= 0) this.shoot();
        }
        
        DOM.healthFill.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
        DOM.dashFill.style.width = `${this.pulseCooldown <= 0 ? 100 : 100 - (this.pulseCooldown / PULSE_COOLDOWN) * 100}%`;
        updatePulseButton(this.pulseCooldown);
        DOM.weaponName.innerText = this.weapon.name;
        DOM.weaponName.style.color = this.weapon.color;
        DOM.weaponAmmo.innerText = this.ammo === Infinity ? "∞" : this.ammo;
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
        
        engine.spawnParticle(
            this.x + Math.cos(this.angle)*(this.radius+10), 
            this.y + Math.sin(this.angle)*(this.radius+10), 
            this.weapon.color, 4, 0, 0, 10, 'flash'
        );
    }
 
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
 
        if (this.iframes > 0 && Math.floor(this.iframes * 20) % 2) ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 20; ctx.shadowColor = this.color;
 
        if (this.katanaSwingTime > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.weapon.range, -this.weapon.arc/2, this.weapon.arc/2);
            ctx.lineWidth = (this.katanaSwingTime / 0.2) * 10;
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.katanaSwingTime / 0.2})`;
            ctx.stroke();
        }
 
        ctx.fillStyle = C.bg;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        
        ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }
}
 
class Enemy extends Entity {
    constructor(type, x, y, hpMult) {
        super(x, y, 16, C.pink);
        this.type = type;
        this.maxHp = 2 * hpMult; this.hp = this.maxHp;
        this.speed = 220;
        this.knockback = {x:0, y:0}; this.dmg = type === 1 ? 40 : 15; this.t = 0; this.burst = 0;
        if (type === 3) { this.radius = 7; this.color = C.green; this.speed = 300 + Math.random() * 90; this.maxHp = 1; this.hp = 1; this.dmg = 8; }
        else if (type === 4) { this.radius = 44; this.color = C.red; this.speed = 70; this.maxHp = 30 * hpMult; this.hp = this.maxHp; this.dmg = 40; }
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
        let moveAngle = angleToPlayer;
        if (this.type === 3) moveAngle += Math.sin(engine.time * 9 + this.x * 0.05) * 0.6;
 
        if (this.type === 2) { 
            if (d < 250) {
                moveAngle += Math.PI / 2; 
                this.fireCooldown -= dt;
                if (this.fireCooldown <= 0) {
                    engine.bullets.push(new Bullet(
                        this.x + Math.cos(angleToPlayer)*this.radius, 
                        this.y + Math.sin(angleToPlayer)*this.radius, 
                        angleToPlayer, {speed: 600, color: C.red, damage: 15, name:'ENEMY_GUN'}, true
                    ));
                    audio.playShoot('ENEMY_GUN', true);
                    this.fireCooldown = 1.2;
                    this.knockback.x = -Math.cos(angleToPlayer) * 150;
                    this.knockback.y = -Math.sin(angleToPlayer) * 150;
                }
            }
        }
 
        this.x += (Math.cos(moveAngle) * this.speed + this.knockback.x) * dt;
        this.y += (Math.sin(moveAngle) * this.speed + this.knockback.y) * dt;
 
        engine.obstacles.forEach(obs => {
            let res = rectCircleCollide(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h);
            if (res.hit) {
                this.x += res.nx * res.pen;
                this.y += res.ny * res.pen;
            }
        });
    }
 
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = (Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50) ? C.white : C.bg;
        if (this.type !== 3) { ctx.shadowBlur = 18; ctx.shadowColor = this.color; }
        if (this.type >= 4) { this.drawBig(ctx); ctx.restore(); return; }
        ctx.strokeStyle = this.color; ctx.lineWidth = 3;
        
        if (this.type === 1) { 
            ctx.fillRect(-this.radius, -this.radius, this.radius*2, this.radius*2);
            ctx.strokeRect(-this.radius, -this.radius, this.radius*2, this.radius*2);
            ctx.fillStyle = C.red;
            ctx.fillRect(-this.radius, -this.radius - 12, (this.radius*2) * (this.hp/this.maxHp), 5);
        } else if (this.type === 2) { 
            ctx.beginPath();
            ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, 0);
            ctx.lineTo(0, this.radius); ctx.lineTo(-this.radius, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = C.red;
            ctx.fillRect(0, -3, 8, 6);
        } else { 
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-this.radius/2, 0); ctx.lineTo(this.radius/2, 0); ctx.stroke();
        }
        ctx.restore();
    }
}
 
class Bullet extends Entity {
    constructor(x, y, angle, weapon, isEnemy = false) {
        super(x, y, weapon.name==='SHOTGUN'? 4:3, weapon.color);
        this.vx = Math.cos(angle) * weapon.speed;
        this.vy = Math.sin(angle) * weapon.speed;
        this.damage = weapon.damage;
        this.life = weapon.name==='SHOTGUN'? 0.4 : 1.5;
        this.history = [{x,y}];
        this.isEnemy = isEnemy; this.pierce = weapon.pierce || 0; this.hit = new Set();
        this.px = x; this.py = y; this.ox = x; this.oy = y;
    }
    update(dt) {
        this.px = this.x; this.py = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.history.push({x: this.x, y: this.y});
        if(this.history.length > (this.isEnemy ? 12 : 4)) this.history.shift();
 
        for (let obs of engine.obstacles) {
            if (lineRectCollide(this.px, this.py, this.x, this.y, obs.x, obs.y, obs.w, obs.h)) {
                this.life = 0; 
                engine.spawnParticle(this.x, this.y, this.color, 3, -this.vx*0.2, -this.vy*0.2, 100);
                break;
            }
        }
    }
    draw(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius * 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }
}
 
class Pickup extends Entity {
    constructor(x, y, type) {
        super(x, y, 12, type === 'HEALTH' ? C.green : WEAPONS[type].color);
        this.itemType = type; this.life = 12; this.floatY = 0;
        this.boost = pickupBoost(); this.hit = this.radius * this.boost;
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
        ctx.save();
        ctx.translate(this.x, this.y + this.floatY);
        ctx.scale(this.boost, this.boost);
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        if (this.itemType === 'HEALTH') {
            ctx.fillRect(-this.radius/2, -this.radius, this.radius, this.radius*2);
            ctx.fillRect(-this.radius, -this.radius/2, this.radius*2, this.radius);
        } else if (this.itemType === 'KATANA') {
            ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, -8); ctx.lineWidth=3; ctx.strokeStyle=this.color; ctx.stroke();
            ctx.fillRect(-10, 6, 6, 6);
        } else {
            ctx.beginPath(); ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, this.radius); ctx.lineTo(-this.radius, this.radius);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = C.white; ctx.font = '10px Orbitron'; ctx.textAlign = 'center';
            ctx.fillText(this.itemType[0], 0, 4);
        }
        ctx.restore();
    }
}
 
class Particle {
    constructor(x, y, color, speed, vx, vy, size, type = 'normal') {
        this.x = x; this.y = y; this.color = color; this.type = type;
        if (type === 'text') {
            this.text = speed; this.life = 1.0; this.vy = -40; this.vx = (Math.random() - 0.5) * 20;
        } else if (type === 'ghost' || type === 'flash') {
            this.life = 0.2; this.size = size;
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
 
        if (this.type === 'blood' && this.life <= 0 && this.x > 0 && this.x < width && this.y > 0 && this.y < height && engine.stains.length < (Settings.perf ? 60 : 220)) {
            engine.stains.push({ x: this.x, y: this.y, r: this.size * 1.5, color: this.color, life: 6, max: 6 });
        }
    }
    draw(ctx) {
        if (this.life <= 0 && this.type !== 'text') return;
        ctx.save();
        if (this.type === 'text') {
            ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
            ctx.font = `900 ${this.fs || Math.round(22 * textBoost())}px Orbitron`; ctx.textAlign = 'center';
            ctx.shadowBlur = 10; ctx.shadowColor = this.color;
            ctx.fillText(this.text, this.x, this.y);
        } else if (this.type === 'ghost') {
            ctx.globalAlpha = this.life * 2; ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (this.life*2), 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}
 
class GameEngine {
    constructor() {
        this.state = 'MENU';
        this.time = 0; this.hitStop = 0;
        this.reset();
    }
 
    reset() {
        this.player = new Player(width/2, height/2);
        this.bullets = []; this.enemies = []; this.particles = []; this.pickups = [];
        this.score = 0; this.combo = 0; this.comboTimer = 0; this.maxComboTimer = 3.5;
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
 
    redrawBackground() {
        bgCtx.fillStyle = C.bg;
        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.setTransform(renderK, 0, 0, renderK, 0, 0);
        bgCtx.strokeStyle = 'rgba(0, 243, 255, 0.05)'; bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        const gs = 80;
        for(let x = 0; x < width; x += gs) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, height); }
        for(let y = 0; y < height; y += gs) { bgCtx.moveTo(0, y); bgCtx.lineTo(width, y); }
        bgCtx.stroke();
    }
 
    init() {
        audio.resume(); audio.music.newRun(); audio.startMusic();
        this.reset();
        DOM.screens.classList.add('hidden');
        DOM.uiLayer.classList.remove('chromatic-glitch');
        this.state = 'PLAYING';
        
        try {
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        } catch(e) {}
    }
 
    addShake(amount) { if (Settings.shake) this.shakeAmount = Math.min(this.shakeAmount + amount, 80); }
    doHitStop(duration) { this.hitStop = Math.max(this.hitStop, duration); }
 
    spawnText(x, y, text, color) { this.particles.push(new Particle(x, y, color, text, 0, 0, 0, 'text')); }
    spawnParticle(x, y, color, amount, vx=0, vy=0, speed=200, type='normal') {
        const max = Settings.perf ? 350 : 1200, n = Settings.perf ? Math.ceil(amount * 0.4) : amount;
        for(let i=0; i<n && this.particles.length<max; i++) this.particles.push(new Particle(x, y, color, speed, vx, vy, 5, type));
    }
 
    addScore(amount, x, y) {
        const multi = this.combo > 0 ? this.combo : 1;
        const total = amount * multi;
        this.score += total;
        this.combo++; this.comboTimer = this.maxComboTimer;
        
        if(x && y) { this.spawnText(x, y, '+' + total, C.white); if (this.combo % 5 === 0) this.spawnText(x, y - 26, 'COMBO x' + this.combo + '!', C.yellow); }
        this.addShake(this.combo * 0.4);
        audio.playHit(); audio.music.setCombo(this.combo); audio.music.onKill();
        
        if (this.combo > 10 && this.combo % 5 === 0) DOM.uiLayer.classList.add('chromatic-glitch');
        setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
 
        if (this.score > bestScore) {
            bestScore = this.score;
            localStorage.setItem('neonCarnageBest', bestScore);
            DOM.highScore.innerText = `HI: ${bestScore.toString().padStart(6, '0')}`;
        }
        this.updateUI();
    }
 
    updateUI() {
        DOM.score.innerText = this.score.toString().padStart(6, '0');
        if (this.combo > 1) {
            DOM.combo.innerHTML = `x${this.combo}<br>COMBO`; DOM.combo.classList.add('active');
        } else {
            DOM.combo.classList.remove('active');
        }
    }
 
    gameOver() {
        this.state = 'GAMEOVER';
        this.spawnParticle(this.player.x, this.player.y, C.cyan, 150, 0, 0, 1000);
        audio.playExplosion(); audio.stopMusic(); haptic([100, 50, 100, 50, 500]);
        this.addShake(80); this.doHitStop(0.5);
        DOM.uiLayer.classList.add('chromatic-glitch');
        DOM.canvas.style.transform = `rotate(0deg)`; 
 
        setTimeout(() => {
            if (this.state !== 'GAMEOVER') return;
            document.getElementById('overStats').innerHTML = `ONDA: <span class="highlight">${this.wave}</span><br>PUNTUACIÓN: <span class="highlight">${this.score}</span><br>COMBO MÁXIMO: <span class="highlight">${this.combo}</span>`;
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
        this.spawnLogic(dt);
 
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.updateUI(); audio.music.setCombo(0); }
        }
 
        this.player.update(dt);
        this.updateArrays(dt, false);
        this.checkCollisions();
 
        const targetTilt = clamp(this.player.vx * 0.015, -4, 4);
        DOM.canvas.style.transform = (Settings.perf || isTouchUI()) ? 'none' : `rotate(${targetTilt}deg) scale(1.05)`; 
    }
    
    updateArrays(dt, particlesOnly) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]; p.update(dt);
            if (p.life <= 0 && p.type !== 'blood') this.particles.splice(i, 1);
            else if (p.type === 'blood' && p.life <= 0) this.particles.splice(i,1); 
        }
        for (let i = this.stains.length - 1; i >= 0; i--) if ((this.stains[i].life -= dt) <= 0) this.stains.splice(i, 1);
        for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].life -= dt) <= 0) this.rings.splice(i, 1);
        if(particlesOnly) return;
 
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i]; b.update(dt);
            if (b.life <= 0 || b.x<0 || b.x>width || b.y<0 || b.y>height) this.bullets.splice(i, 1);
        }
 
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
                    this.player.equip(p.itemType, p.itemType === 'SHOTGUN' ? 25 : (p.itemType === 'KATANA' ? 50 : (p.itemType === 'RAILGUN' ? 8 : 150)));
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
                    this.player.hp -= b.damage; this.player.iframes = 0.4;
                    this.addShake(25); haptic(200);
                    DOM.uiLayer.classList.add('chromatic-glitch');
                    setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
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
                this.player.hp -= e.dmg; this.player.iframes = 0.6; 
                this.addShake(30); haptic(200);
                DOM.uiLayer.classList.add('chromatic-glitch');
                setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
                this.spawnParticle(this.player.x, this.player.y, C.red, 25, 0, 0, 500, 'blood');
                
                e.knockback.x = (e.x - this.player.x) * 15;
                e.knockback.y = (e.y - this.player.y) * 15;
 
                if (this.player.hp <= 0) { this.gameOver(); return; }
            }
 
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (!b.isEnemy && !e.dead && !b.hit.has(e) && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
                    b.hit.add(e);
                    this.hitEnemy(e, b.damage * bulletFalloff(b), b.vx * 0.4, b.vy * 0.4); if (b.pierce-- > 0) continue;
                    this.bullets.splice(j, 1);
                }
            }
        }
    }
 
    drawJoysticks(ctx) {
        [Input.left, Input.right].forEach((stick, idx) => {
            if (stick.active) {
                const color = idx === 0 ? C.cyan : C.pink;
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // joysticks en px de pantalla, no del mundo
                ctx.globalAlpha = 0.2; ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(stick.base.x, stick.base.y, Input.maxRadius, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
 
                const headX = stick.base.x + stick.vector.x * (Input.maxRadius * stick.force);
                const headY = stick.base.y + stick.vector.y * (Input.maxRadius * stick.force);
                
                ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(headX, headY, 18, 0, Math.PI*2);
                ctx.fillStyle = C.white; ctx.fill();
                ctx.restore();
            }
        });
    }
 
    draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bgCanvas, 0, 0);
        ctx.setTransform(renderK, 0, 0, renderK, 0, 0);
 
        ctx.save();
        if (this.shakeAmount > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            ctx.translate(dx, dy);
            this.shakeAmount *= 0.85;
            if (this.shakeAmount < 0.5) this.shakeAmount = 0;
        }
 
        this.obstacles.forEach(o => o.draw(ctx));
 
        this.pickups.forEach(p => p.draw(ctx));
        for (const p of this.particles) if (p.type === 'blood' || p.type === 'ghost') p.draw(ctx);
        this.drawFx(ctx); for (const b of this.bullets) b.draw(ctx);
        this.enemies.forEach(e => e.draw(ctx));
        
        if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
            if(this.player.hp > 0) { this.player.drawTrail(ctx); this.player.draw(ctx); }
        }
 
        for (const p of this.particles) if (p.type !== 'blood' && p.type !== 'ghost') p.draw(ctx);
        ctx.restore();
 
        if (this.state === 'PLAYING') this.drawJoysticks(ctx);
        
        if (this.hitStop > 0 && this.shakeAmount > 15) {
            ctx.globalCompositeOperation = 'screen';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(canvas, -2 * dpr, 0);
            ctx.drawImage(canvas, 2 * dpr, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}
 
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
    for (const o of engine.obstacles) {
        if (this.x > o.x && this.x < o.x + o.w && this.y > o.y && this.y < o.y + o.h) {
            const l = this.x - o.x, r = o.x + o.w - this.x, t = this.y - o.y, b = o.y + o.h - this.y, m = Math.min(l, r, t, b);
            if (m === l || m === r) { this.vx *= -0.6; this.x += m === l ? -m - 1 : m + 1; }
            else { this.vy *= -0.6; this.y += m === t ? -m - 1 : m + 1; }
            break;
        }
    }
};
 
Bullet.prototype.draw = function(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.shadowBlur = 14; ctx.shadowColor = this.color;
    const h = this.history, n = h.length;
    for (let i = 1; i < n; i++) {
        const a = i / n;
        ctx.globalAlpha = a; ctx.strokeStyle = this.color; ctx.lineWidth = this.radius * 2 * a;
        ctx.beginPath(); ctx.moveTo(h[i - 1].x, h[i - 1].y); ctx.lineTo(h[i].x, h[i].y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 0.7, 0, TAU); ctx.fill();
    ctx.restore();
};
 
Player.prototype.drawTrail = function(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const t = this.trail;
    for (let i = 1; i < t.length; i++) {
        const a = i / t.length;
        ctx.strokeStyle = `rgba(0,243,255,${a * 0.5})`; ctx.lineWidth = a * 14;
        ctx.beginPath(); ctx.moveTo(t[i - 1].x, t[i - 1].y); ctx.lineTo(t[i].x, t[i].y); ctx.stroke();
    }
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 100);
    g.addColorStop(0, 'rgba(0,243,255,0.25)'); g.addColorStop(1, 'rgba(0,243,255,0)');
    ctx.fillStyle = g; ctx.fillRect(this.x - 100, this.y - 100, 200, 200);
    ctx.restore();
};
 
Enemy.prototype.drawBig = function(ctx) {
    const r = this.radius, t = engine.time, boss = this.boss;
    if (!boss) { ctx.fillStyle = C.red; ctx.fillRect(-r, -r - 14, r * 2 * (this.hp / this.maxHp), 5); }
    const poly = (rad, n) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); };
    ctx.fillStyle = C.bg; ctx.strokeStyle = this.color; ctx.lineWidth = boss ? 5 : 4; ctx.shadowBlur = 30;
    ctx.rotate(t * (boss ? 0.6 : 1.2)); poly(r, boss ? 8 : 6); ctx.fill(); ctx.stroke();
    ctx.rotate(-t * (boss ? 1.8 : 3.6)); poly(r * 0.55, boss ? 4 : 3); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = this.color;
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
        audio.music.setSection(w % 5 === 0 ? 'boss' : 'fight');
        if (w % 5 === 0) {
            this.banner('BOSS WAVE ' + w, C.red);
            push(5, 1, 1, 1); push(0, 1, 1.2, 4);
            ['MINIGUN', 'RAILGUN'].forEach(k => { const s = this.freeSpot(); this.pickups.push(new Pickup(s.x, s.y, k)); });
        } else {
            this.banner('WAVE ' + w, C.cyan);
            push(0, 1, 0.45, 5 + w * 2);
            if (w > 1) push(2, 1, 0.8, Math.floor(w / 2));
            if (w >= 2) push(3, 15 + Math.floor(Math.random() * 6), 1, Math.ceil(w / 3));
            if (w >= 3) push(1, 1, 0.8, Math.floor(w / 3));
            if (w >= 4) push(4, 1, 1, Math.floor(w / 4));
        }
        q.sort(() => Math.random() - 0.5);
        this.queue = q;
    },
    spawnLogic(dt) {
        if (this.waveState === 'BREAK') { if ((this.waveTimer -= dt) <= 0) this.startWave(); return; }
        this.spawnTimer -= dt;
        if (this.queue.length && this.spawnTimer <= 0) {
            const s = this.queue.shift(), p = this.edge(), hp = 1 + this.wave * 0.18;
            for (let i = 0; i < s.n; i++) this.enemies.push(new Enemy(s.t, p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 120, hp));
            this.spawnTimer = s.d * Math.max(0.35, 1 - this.wave * 0.04);
        }
        if (!this.queue.length && !this.enemies.length) {
            this.waveState = 'BREAK'; this.waveTimer = 2; audio.music.setSection('calm');
            this.banner('WAVE ' + this.wave + ' CLEARED', C.green);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
            if (Math.random() < 0.6) { const s = this.freeSpot(), k = ['SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'HEALTH']; this.pickups.push(new Pickup(s.x, s.y, k[Math.floor(Math.random() * k.length)])); }
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
            for (let i = 0; i < n; i++) this.bullets.push(new Bullet(e.x, e.y, i / n * TAU, {speed: 300, color: C.red, damage: 15, name: 'ENEMY_GUN'}, true));
            audio.playExplosion(); this.addShake(e.boss ? 80 : 55); this.doHitStop(e.boss ? 0.35 : 0.15); haptic([80, 40, 160]);
        } else if (e.type === 1) this.doHitStop(0.1);
        else if (isMelee || this.combo % 10 === 0) this.doHitStop(0.05);
        if (e.boss) { this.pickups.push(new Pickup(e.x, e.y, 'HEALTH')); this.player.hp = this.player.maxHp; }
        else if (Math.random() < 0.1 || (e.type === 1 && Math.random() < 0.8)) {
            const k = ['SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'HEALTH'];
            this.pickups.push(new Pickup(e.x, e.y, k[Math.floor(Math.random() * k.length)]));
        }
    },
    postUpdate(dt) {
        const p = this.player;
        this.hpGhost = this.hpGhost > p.hp ? this.hpGhost + (p.hp - this.hpGhost) * Math.min(1, dt * 2.5) : p.hp;
        UI2.hpGhost.style.width = Math.max(0, this.hpGhost / p.maxHp * 100) + '%';
        audio.music.setHealth(p.hp / p.maxHp);
        const boss = this.enemies.find(e => e.boss && !e.dead);
        UI2.bossBar.classList.toggle('hidden', !boss || this.state !== 'PLAYING');
        if (boss) { this.bossHp += (boss.hp / boss.maxHp - this.bossHp) * Math.min(1, dt * 8); UI2.bossFill.style.width = Math.max(0, this.bossHp * 100) + '%'; } else this.bossHp = 1;
        if (p.weapon.type === 'rail') DOM.weaponAmmo.innerText = p.ammo + (p.fireCooldown > 0 ? '  RECARGANDO' : '  LISTO');
        for (const s of this.slashes) {
            s.life -= dt;
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const b = this.bullets[i];
                if (!b.isEnemy || dist(s.x, s.y, b.x, b.y) > s.r + 10) continue;
                const d = Math.atan2(b.y - s.y, b.x - s.x) - s.a;
                if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < Math.PI / 2) { this.spawnParticle(b.x, b.y, C.white, 6, 0, 0, 250); this.bullets.splice(i, 1); }
            }
        }
        for (const l of [this.slashes, this.beams, this.ghosts]) {
            for (let i = l.length - 1; i >= 0; i--) { if (l !== this.slashes) l[i].life -= dt; if (l[i].life <= 0) l.splice(i, 1); }
        }
    },
    drawFx(ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const g of this.ghosts) {
            ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a);
            ctx.globalAlpha = g.life / 0.35 * 0.7; ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = C.cyan;
            ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-16, 16); ctx.lineTo(-8, 0); ctx.lineTo(-16, -16); ctx.closePath(); ctx.stroke();
            ctx.restore();
        }
        ctx.shadowBlur = 30; ctx.shadowColor = C.cyan;
        for (const b of this.beams) {
            const k = b.life / 0.35;
            ctx.strokeStyle = `rgba(0,243,255,${k})`; ctx.lineWidth = 26 * k;
            ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 8 * k; ctx.stroke();
        }
        ctx.shadowColor = C.white;
        for (const s of this.slashes) {
            const k = s.life / 0.5;
            ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 14 * k + 2;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, s.a - Math.PI / 2, s.a + Math.PI / 2); ctx.stroke();
        }
        ctx.restore();
    }
});
const _update = GameEngine.prototype.update;
GameEngine.prototype.update = function(dt) { _update.call(this, dt); this.postUpdate(dt); };
// ========================================================
 
let engine;
let fpsFrames = 0, fpsAcc = 0;
 
function loop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;
 
    engine.update(dt);
    engine.draw();
    fpsFrames++; fpsAcc += dt;
    if (fpsAcc >= 0.5) {
        if (Settings.showFps) document.getElementById('fpsEl').innerText = Math.round(fpsFrames / fpsAcc) + ' FPS';
        fpsFrames = 0; fpsAcc = 0;
    }
 
    requestAnimationFrame(loop);
}
 
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
            const k = r.life / r.maxLife;
            ctx.strokeStyle = `rgba(0,243,255,${k})`;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.max * (1 - k), 0, TAU); ctx.stroke();
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

const Menu = {
    stack: [], current: 'pMain',
    show(id) {
        this.current = id;
        document.querySelectorAll('#screens .panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
        DOM.screens.classList.remove('hidden');
        if (id === 'pMain') document.getElementById('menuBest').innerText = bestScore.toString().padStart(6, '0');
        if (id === 'pOptions') this.syncOptions();
    },
    open(id, fresh = false) {
        if (fresh) this.stack = []; else this.stack.push(this.current);
        this.show(id);
    },
    back() { if (this.stack.length) this.show(this.stack.pop()); },
    close() { DOM.screens.classList.add('hidden'); },
    syncOptions() {
        const labels = { perf: 'MODO RENDIMIENTO', shake: 'SACUDIDA DE PANTALLA', vibrate: 'VIBRACIÓN', showFps: 'MOSTRAR FPS', aimAssist: 'AYUDA DE PUNTERÍA' };
        document.querySelectorAll('[data-action="toggle"]').forEach(b => {
            const k = b.dataset.key;
            b.innerText = `${labels[k]}: ${Settings[k] ? 'ON' : 'OFF'}`;
            b.classList.toggle('on', !!Settings[k]);
        });
        document.getElementById('volRange').value = Settings.volume;
        document.getElementById('volVal').innerText = Math.round(Settings.volume * 100) + '%';
        document.getElementById('musicRange').value = Settings.music;
        document.getElementById('musicVal').innerText = Math.round(Settings.music * 100) + '%';
        document.getElementById('pulseSideBtn').innerText = 'BOTÓN DE PULSO: ' + (Settings.pulseSide === 'left' ? 'IZQUIERDA' : 'DERECHA');
        document.getElementById('scaleRange').value = Settings.scale;
        document.getElementById('scaleVal').innerText = Math.round(Settings.scale * 100) + '%';
    }
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
        switch (b.dataset.action) {
            case 'play': case 'retry': engine.init(); break;
            case 'resume': engine.resume(); break;
            case 'menu': engine.toMenu(); break;
            case 'options': Menu.open('pOptions'); break;
            case 'controls': Menu.open('pControls'); break;
            case 'back': Menu.back(); break;
            case 'pulseSide': Settings.pulseSide = Settings.pulseSide === 'left' ? 'right' : 'left'; applySettings(); break;
            case 'toggle': Settings[b.dataset.key] = !Settings[b.dataset.key]; applySettings(); break;
            case 'clearBest':
                bestScore = 0; localStorage.removeItem('neonCarnageBest');
                DOM.highScore.innerText = 'HI: 000000'; Menu.show('pOptions'); break;
        }
    });
    document.getElementById('volRange').addEventListener('input', (e) => {
        Settings.volume = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('musicRange').addEventListener('input', (e) => {
        Settings.music = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('pauseBtn').addEventListener('click', () => engine.togglePause());
}

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
        if (b.chargeCd <= 0) { b.telegraph = rage ? 0.6 : 0.9; b.chargeCd = rage ? 3 : 5; }
    }

    if (b.spiral) {                                     // espiral de 3 brazos
        b.spiral.timer -= dt;
        if (b.spiral.timer <= 0) {
            b.spiral.timer = 0.07;
            for (let k = 0; k < 3; k++) engine.bullets.push(new Bullet(b.x, b.y, b.spiral.a + k * TAU / 3, { speed: 260, color: C.pink, damage: 12, name: 'ENEMY_GUN' }, true));
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
        const mk = (a, s, dmg = 12) => this.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: C.pink, damage: dmg, name: 'ENEMY_GUN' }, true));
        const pick = (b.pat = ((b.pat ?? -1) + 1) % 4);

        if (pick === 0) {                               // anillo con hueco: hay que buscar la salida
            const n = rage ? 30 : 22, gap = Math.floor(Math.random() * n);
            for (let i = 0; i < n; i++) if (((i - gap + n) % n) >= 2) mk(i / n * TAU + b.t, rage ? 260 : 210);
            b.fireCooldown = rage ? 1.5 : 2.0;
        } else if (pick === 1) {                        // espiral (se procesa en bossAI)
            b.spiral = { n: rage ? 40 : 28, a: pa, timer: 0 };
            b.fireCooldown = 2.6;
        } else if (pick === 2) {                        // abanico dirigido al jugador
            const k = rage ? 3 : 2;
            for (let i = -k; i <= k; i++) mk(pa + i * 0.13, 480);
            b.fireCooldown = rage ? 1.0 : 1.4;
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

window.onload = function() {
    resize();
    engine = new GameEngine();
    setupMenu();
    setupTouchUI();
    applySettings();
    Menu.show('pMain');
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
};
