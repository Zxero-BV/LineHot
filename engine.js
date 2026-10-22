
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
                this.player.hp -= e.dmg; this.player.iframes = 0.6; 
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
                if (r < 2.5) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
                else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
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
            if (r < 2.5) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
            else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
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
            for (let i = 0; i < s.n; i++) this.enemies.push(makeEnemy(s.t, p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 120, hp));
            this.spawnTimer = s.d * Math.max(0.55, 1 - this.wave * 0.03);
        }
        if (!this.queue.length && !this.enemies.length) {
            this.waveState = 'BREAK'; this.waveTimer = 2; audio.music.setSection('calm');
            this.banner('WAVE ' + this.wave + ' CLEARED', C.green);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
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
            for (let i = 0; i < n; i++) this.bullets.push(new Bullet(e.x, e.y, i / n * TAU, {speed: 300, color: C.red, damage: 15, name: 'ENEMY_GUN'}, true));
            audio.playExplosion(); this.addShake(e.boss ? 80 : 55); this.doHitStop(e.boss ? 0.35 : 0.15); haptic([80, 40, 160]);
        } else if (e.type === 1) this.doHitStop(0.1);
        else if (isMelee || this.combo % 10 === 0) this.doHitStop(0.05);
        if (e.boss) { this.pickups.push(new Pickup(e.x, e.y, 'HEALTH')); this.player.hp = this.player.maxHp; }
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
const FRAME_MS = 1000 / 60;
let _lastDraw = 0;
function loop(timestamp) {
    requestAnimationFrame(loop);
    const st = engine.state;
    const el = timestamp - _lastDraw;
    if (st === 'PAUSED') { if (!engine.needsDraw) return; }
    else {
        const interval = (st === 'PLAYING' || st === 'COUNT') ? FRAME_MS : 1000 / 30;
        if (el < interval - 2) return;
        _lastDraw = timestamp - (el % interval);
    }
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

