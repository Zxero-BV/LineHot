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
    canvas: document.getElementById('gameCanvas')
};

let width, height;
let lastTime = 0;
let bestScore = localStorage.getItem('neonCarnageBest') || 0;
DOM.highScore.innerText = `HI: ${bestScore.toString().padStart(6, '0')}`;

const C = {
    pink: '#ff007f', cyan: '#00f3ff', yellow: '#ffe600',
    purple: '#b537f2', green: '#00ff66', red: '#ff3333',
    bg: '#05010a', white: '#ffffff', darkGray: '#111'
};

const WEAPONS = {
    PISTOL: { name: "PISTOL", fireRate: 0.15, spread: 0.05, speed: 1200, color: C.yellow, damage: 1, type: 'single', recoil: 5 },
    SHOTGUN: { name: "SHOTGUN", fireRate: 0.7, spread: 0.4, speed: 1000, color: C.pink, damage: 1.5, type: 'spread', count: 6, recoil: 15 },
    MINIGUN: { name: "MINIGUN", fireRate: 0.06, spread: 0.2, speed: 1600, color: C.cyan, damage: 0.7, type: 'single', recoil: 8 },
    KATANA: { name: "KATANA", fireRate: 0.4, range: 90, color: C.white, damage: 8, type: 'melee', recoil: -15, arc: Math.PI }
};

function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width; canvas.height = height;
    
    if (bgCanvas.width !== width || bgCanvas.height !== height) {
        bgCanvas.width = width;
        bgCanvas.height = height;
        if(engine && engine.state !== 'MENU') {
            engine.redrawBackground();
        }
    }
}
window.addEventListener('resize', resize);

// Utilidades Matemáticas
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

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

    startMusic() { this.isPlaying = true; this.nextNoteTime = this.ctx.currentTime + 0.1; this.scheduler(); }
    stopMusic() { this.isPlaying = false; }

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
    maxRadius: 60,
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
        engine.player.dash();
    }
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
    Input.mouse.x = e.clientX;
    Input.mouse.y = e.clientY;
});
window.addEventListener('mousedown', (e) => {
    if (e.target.id === 'startBtn') return; 
    Input.mouse.active = true;
});
window.addEventListener('mouseup', () => {
    Input.mouse.active = false;
});

// Eventos Táctiles Originales
function handleTouch(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    const now = Date.now();

    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        const isLeft = t.clientX < width / 2;

        if (e.type === 'touchstart') {
            if (isLeft && !Input.left.active) {
                if (now - Input.lastLeftTapTime < 250 && engine.player && engine.state === 'PLAYING') {
                    engine.player.dash();
                }
                Input.lastLeftTapTime = now;
                Input.left.active = true; Input.left.id = t.identifier;
                Input.left.base = { x: t.clientX, y: t.clientY };
            } else if (!isLeft && !Input.right.active) {
                Input.right.active = true; Input.right.id = t.identifier;
                Input.right.base = { x: t.clientX, y: t.clientY };
            }
        }

        if (e.type === 'touchmove') {
            const stick = Input.left.id === t.identifier ? Input.left : (Input.right.id === t.identifier ? Input.right : null);
            if (stick) {
                const dx = t.clientX - stick.base.x;
                const dy = t.clientY - stick.base.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                stick.force = Math.min(dist / Input.maxRadius, 1);
                if (dist > 0) stick.vector = { x: dx / dist, y: dy / dist };
            }
        }

        if (e.type === 'touchend' || e.type === 'touchcancel') {
            if (Input.left.id === t.identifier) { Input.left.active = false; Input.left.force = 0; Input.left.vector = {x:0,y:0}; }
            if (Input.right.id === t.identifier) { Input.right.active = false; Input.right.force = 0; Input.right.vector = {x:0,y:0}; }
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
        
        this.dashCooldown = 0; this.dashTime = 0;
        this.isDashing = false; this.dashVector = {x:0, y:0};
        
        this.katanaSwingTime = 0;
    }

    equip(weaponKey, ammoAmount) {
        this.weapon = WEAPONS[weaponKey];
        this.ammo = ammoAmount;
        engine.spawnText(this.x, this.y - 30, this.weapon.name, this.weapon.color);
    }

    dash() {
        if (this.dashCooldown > 0 || this.isDashing) return;
        let dx = Input.lastDir.x;
        let dy = Input.lastDir.y;
        if(dx === 0 && dy === 0) { dx = 1; dy = 0; }
        
        this.isDashing = true; this.dashTime = 0.2; this.dashCooldown = 1.2;
        this.dashVector = {x: dx, y: dy};
        audio.playDash(); haptic(40);
        engine.spawnText(this.x, this.y, "DASH", C.white);
    }

    update(dt) {
        if (this.dashTime > 0) {
            this.dashTime -= dt;
            this.vx = this.dashVector.x * this.baseSpeed * 4;
            this.vy = this.dashVector.y * this.baseSpeed * 4;
            engine.spawnParticle(this.x, this.y, this.color, 1, 0, 0, 15, 'ghost');
            if (this.dashTime <= 0) this.isDashing = false;
        } else {
            if (this.dashCooldown > 0) this.dashCooldown -= dt;
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
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

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
        if (Input.mouse.active && !this.isDashing) {
            this.angle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);
            if (this.fireCooldown <= 0) this.shoot();
        } else if (Input.right.active && Input.right.force > 0.3 && !this.isDashing) {
            this.angle = Math.atan2(Input.right.vector.y, Input.right.vector.x);
            if (this.fireCooldown <= 0) this.shoot();
        }
        
        DOM.healthFill.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
        DOM.dashFill.style.width = `${this.dashCooldown <= 0 ? 100 : 100 - (this.dashCooldown / 1.2) * 100}%`;
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
            audio.playShoot('KATANA');
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

        let shots = this.weapon.type === 'spread' ? this.weapon.count : 1;
        for(let i=0; i<shots; i++) {
            const spread = (Math.random() - 0.5) * this.weapon.spread;
            engine.bullets.push(new Bullet(
                this.x + Math.cos(this.angle)*this.radius, 
                this.y + Math.sin(this.angle)*this.radius, 
                this.angle + spread, this.weapon, false
            ));
        }
        
        if(!this.isDashing) {
            this.x -= Math.cos(this.angle) * this.weapon.recoil;
            this.y -= Math.sin(this.angle) * this.weapon.recoil;
        }
        
        if (this.weapon.name !== 'PISTOL') this.ammo--;
        this.fireCooldown = this.weapon.fireRate;
        
        engine.addShake(this.weapon.recoil * 0.4);
        audio.playShoot(this.weapon.name);
        
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

        if (this.isDashing) ctx.globalAlpha = 0.5;

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
        this.knockback = {x:0, y:0};
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

        let d = dist(this.x, this.y, px, py);
        let angleToPlayer = Math.atan2(py - this.y, px - this.x);
        let moveAngle = angleToPlayer;

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
        this.isEnemy = isEnemy;
        this.px = x; this.py = y;
    }
    update(dt) {
        this.px = this.x; this.py = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.history.push({x: this.x, y: this.y});
        if(this.history.length > 4) this.history.shift();

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
    }
    update(dt) {
        this.life -= dt;
        this.floatY = Math.sin(engine.time * 5) * 5;
    }
    draw(ctx) {
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return; 
        ctx.save();
        ctx.translate(this.x, this.y + this.floatY);
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
            this.life = type === 'blood' ? 0.6 : Math.random() * 0.5 + 0.2;
            this.size = Math.random() * size + 2;
        }
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        if(this.type === 'normal' || this.type === 'blood') { this.vx *= 0.85; this.vy *= 0.85; }
        this.life -= dt;

        if (this.type === 'blood' && this.life <= 0 && this.x > 0 && this.x < width && this.y > 0 && this.y < height) {
            bgCtx.fillStyle = '#8b0000'; 
            bgCtx.globalAlpha = 0.8;
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI*2);
            bgCtx.fill();
            bgCtx.globalAlpha = 1.0;
        }
    }
    draw(ctx) {
        if (this.life <= 0 && this.type !== 'text') return;
        ctx.save();
        if (this.type === 'text') {
            ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
            ctx.font = '900 22px Orbitron'; ctx.textAlign = 'center';
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
                x = Math.random() * (width - w - 100) + 50;
                y = Math.random() * (height - h - 100) + 50;
                distToCenter = dist(x+w/2, y+h/2, width/2, height/2);
                attempts++;
            } while(distToCenter < 200 && attempts < 50); 
            
            if (attempts < 50) this.obstacles.push(new Obstacle(x, y, w, h));
        }
    }

    redrawBackground() {
        bgCtx.fillStyle = C.bg;
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.strokeStyle = 'rgba(0, 243, 255, 0.05)'; bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        const gs = 80;
        for(let x = 0; x < width; x += gs) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, height); }
        for(let y = 0; y < height; y += gs) { bgCtx.moveTo(0, y); bgCtx.lineTo(width, y); }
        bgCtx.stroke();
    }

    init() {
        audio.resume(); audio.startMusic();
        this.reset();
        DOM.screens.classList.add('hidden');
        DOM.uiLayer.classList.remove('chromatic-glitch');
        this.state = 'PLAYING';
        
        try {
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        } catch(e) {}
    }

    addShake(amount) { this.shakeAmount = Math.min(this.shakeAmount + amount, 50); }
    doHitStop(duration) { this.hitStop = duration; }

    spawnText(x, y, text, color) { this.particles.push(new Particle(x, y, color, text, 0, 0, 0, 'text')); }
    spawnParticle(x, y, color, amount, vx=0, vy=0, speed=200, type='normal') {
        for(let i=0; i<amount; i++) this.particles.push(new Particle(x, y, color, speed, vx, vy, 5, type));
    }

    addScore(amount, x, y) {
        const multi = this.combo > 0 ? this.combo : 1;
        const total = amount * multi;
        this.score += total;
        this.combo++; this.comboTimer = this.maxComboTimer;
        
        if(x && y) this.spawnText(x, y, total, C.white);
        this.addShake(this.combo * 0.4);
        audio.playHit();
        
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
            DOM.screens.classList.remove('hidden');
            DOM.mainTitle.innerHTML = "SYSTEM<br>FAILURE";
            DOM.subTitle.innerHTML = `FINAL SCORE: <span class="highlight">${this.score}</span><br>MAX COMBO: <span class="highlight">${this.combo}</span>`;
            DOM.startBtn.innerText = "REBOOT";
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
        if (this.hitStop > 0) { this.hitStop -= dt; return; }
        if (this.state !== 'PLAYING') { this.updateArrays(dt, true); return; }

        this.time += dt;
        this.spawnLogic(dt);

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.updateUI(); }
        }

        this.player.update(dt);
        this.updateArrays(dt, false);
        this.checkCollisions();

        const targetTilt = clamp(this.player.vx * 0.015, -4, 4);
        DOM.canvas.style.transform = `rotate(${targetTilt}deg) scale(1.05)`; 
    }
    
    updateArrays(dt, particlesOnly) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]; p.update(dt);
            if (p.life <= 0 && p.type !== 'blood') this.particles.splice(i, 1);
            else if (p.type === 'blood' && p.life <= 0) this.particles.splice(i,1); 
        }
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
            if (dist(this.player.x, this.player.y, p.x, p.y) < this.player.radius + p.radius) {
                if (p.itemType === 'HEALTH') {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
                    this.spawnText(p.x, p.y, "+HP", C.green);
                } else {
                    this.player.equip(p.itemType, p.itemType === 'SHOTGUN' ? 25 : (p.itemType === 'KATANA' ? 50 : 150));
                }
                audio.playPickup(); haptic(50);
                this.spawnParticle(p.x, p.y, p.color, 20, 0, 0, 400);
                this.pickups.splice(i, 1);
            }
        }

        for (let j = this.bullets.length - 1; j >= 0; j--) {
            const b = this.bullets[j];
            if (b.isEnemy && !this.player.isDashing) {
                if (dist(b.x, b.y, this.player.x, this.player.y) < this.player.radius + b.radius) {
                    this.player.hp -= b.damage;
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

            if (!this.player.isDashing && dist(this.player.x, this.player.y, e.x, e.y) < this.player.radius + e.radius - 2) {
                this.player.hp -= (e.type === 1 ? 40 : 15); 
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
                if (!b.isEnemy && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
                    this.hitEnemy(e, b.damage, b.vx * 0.4, b.vy * 0.4);
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
                ctx.globalAlpha = 0.2; ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(stick.base.x, stick.base.y, Input.maxRadius, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

                const headX = stick.base.x + stick.vector.x * (Input.maxRadius * stick.force);
                const headY = stick.base.y + stick.vector.y * (Input.maxRadius * stick.force);
                
                ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(headX, headY, 15, 0, Math.PI*2);
                ctx.fillStyle = C.white; ctx.fill();
                ctx.restore();
            }
        });
    }

    draw() {
        ctx.drawImage(bgCanvas, 0, 0);

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
        this.particles.filter(p => p.type === 'blood' || p.type === 'ghost').forEach(p => p.draw(ctx));
        this.bullets.forEach(b => b.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx));
        
        if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
            if(this.player.hp > 0) this.player.draw(ctx);
        }

        this.particles.filter(p => p.type !== 'blood' && p.type !== 'ghost').forEach(p => p.draw(ctx));
        ctx.restore();

        if (this.state === 'PLAYING') this.drawJoysticks(ctx);
        
        if (this.hitStop > 0 && this.shakeAmount > 15) {
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(canvas, -2, 0);
            ctx.drawImage(canvas, 2, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

let engine;

function loop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    engine.update(dt);
    engine.draw();

    requestAnimationFrame(loop);
}

window.onload = function() {
    engine = new GameEngine();
    resize();
    DOM.startBtn.addEventListener('click', () => engine.init());
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
};