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
            push(0, 1, 0.6, 4 + w + Math.floor(w / 2));
            if (w > 1) push(2, 1, 0.9, Math.floor((w + 1) / 3));
            if (w >= 2) push(3, 8 + Math.floor(Math.random() * 4), 1.2, Math.ceil(w / 4));
            if (w >= 3) push(1, 1, 0.8, Math.floor(w / 3));
            if (w >= 6) push(4, 1, 1, Math.floor((w - 1) / 5));
        }
        q.sort(() => Math.random() - 0.5);
        this.queue = q;
    },
    spawnLogic(dt) {
        if (this.waveState === 'BREAK') { if ((this.waveTimer -= dt) <= 0) this.startWave(); return; }
        this.spawnTimer -= dt;
        if (this.queue.length && this.spawnTimer <= 0 && this.enemies.length < 10 + Math.min(this.wave * 2, 14)) {
            const s = this.queue.shift(), p = this.edge(), hp = 1 + this.wave * 0.18;
            for (let i = 0; i < s.n; i++) this.enemies.push(new Enemy(s.t, p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 120, hp));
            this.spawnTimer = s.d * Math.max(0.55, 1 - this.wave * 0.03);
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
 
    updateMouseWorld();
    engine.update(dt);
    engine.draw();
    fpsFrames++; fpsAcc += dt;
    if (fpsAcc >= 0.5) {
        if (Settings.showFps) document.getElementById('fpsEl').innerText = Math.round(fpsFrames / fpsAcc) + ' FPS';
        autoQuality(fpsFrames / fpsAcc); fpsFrames = 0; fpsAcc = 0;
    }
 
    requestAnimationFrame(loop);
}
