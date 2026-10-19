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
        const s = Spr.map.get('pl') || Spr.make('pl', 120, 100, c => {
            c.fillStyle = C.bg; c.strokeStyle = C.cyan; c.lineWidth = 3;
            c.shadowBlur = 20; c.shadowColor = C.cyan;
            c.beginPath();
            c.moveTo(r * 1.5, 0); c.lineTo(-r, r); c.lineTo(-r * 0.5, 0); c.lineTo(-r, -r);
            c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = C.white; c.lineWidth = 1; c.stroke();
        });
        ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
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
        if (t === 3) {                                   // enjambre: sin resplandor, se pinta directo
            const x = this.x, y = this.y;
            ctx.fillStyle = flash ? C.white : C.bg; ctx.strokeStyle = this.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - r / 2, y); ctx.lineTo(x + r / 2, y); ctx.stroke();
            return;
        }
        const id = ENEMY_SPR[t][flash ? 1 : 0];
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => enemyBody(c, t, r, this.color, flash));
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
        super(x, y, 12, type === 'HEALTH' ? C.green : WEAPONS[type].color);
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
            ctx.fillText(type[0], this.x, y + 4 * k);
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
 
        if (this.type === 'blood' && this.life <= 0 && this.x > 0 && this.x < width && this.y > 0 && this.y < height && engine.stains.length < (Settings.perf ? 60 : 220)) {
            engine.stains.push({ x: this.x, y: this.y, r: this.size * 1.5, color: this.color, life: 6, max: 6 });
        }
    }
}
