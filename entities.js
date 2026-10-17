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
 
