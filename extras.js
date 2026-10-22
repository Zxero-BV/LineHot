// ########## [extras.js] ##########
// =====================================================================
//  EXTRAS (va después de arranque.js; envuelve funciones ya existentes)
//
//  REJUGABILIDAD   mejoras entre oleadas · enemigos nuevos (kamikaze, divisor) · modificadores de partida
//  SENSACIÓN       armas nuevas (láser, lanzacohetes) · objetos (escudo, tiempo lento, imán, bomba) · jefes con fases
//  COMODIDAD       mando · tutorial interactivo · compartir resultado · instalar como app (PWA)
//
//  Todo cuelga del objeto LH para no chocar con variables de otros archivos.
// =====================================================================
const LH = {};
const $id = (id) => document.getElementById(id);

// ---------------------------------------------------------------- avisos
LH.toast = (msg) => {
    const el = $id('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(LH._tt); LH._tt = setTimeout(() => el.classList.remove('show'), 2400);
};

// ---------------------------------------------------------------- modificadores de partida
LH.MUTS = [
    { id: 'glass', name: 'CRISTAL', desc: 'Recibes el doble de daño', mult: 0.3 },
    { id: 'frenzy', name: 'FRENESÍ', desc: 'Los enemigos son un 25% más rápidos', mult: 0.25 },
    { id: 'horde', name: 'HORDA', desc: '50% más de enemigos en cada oleada', mult: 0.4 },
    { id: 'nopulse', name: 'SIN PULSO', desc: 'El pulso está desactivado', mult: 0.3 },
    { id: 'onehit', name: 'UN GOLPE', desc: 'Cualquier golpe te mata', mult: 1 }
];
LH.mods = (() => { try { return JSON.parse(localStorage.getItem('linehotMods')) || {}; } catch (e) { return {}; } })();
LH.modMult = (m = LH.mods) => 1 + LH.MUTS.reduce((a, x) => a + (m[x.id] ? x.mult : 0), 0);
LH.modsActive = (m = LH.mods) => LH.MUTS.filter(x => m[x.id]);
LH.paintMods = () => {
    document.querySelectorAll('#pMods [data-mut]').forEach(b => {
        const on = !!LH.mods[b.dataset.mut]; b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
    });
    $id('modMult').textContent = '×' + LH.modMult().toFixed(2);
    const n = LH.modsActive().length, badge = $id('modsCount');
    if (badge) { badge.textContent = n ? n + ' · ×' + LH.modMult().toFixed(2) : ''; badge.classList.toggle('hidden', !n); }
};
(() => {   // filas de la pantalla de modificadores
    const list = $id('modList'); if (!list) return;
    list.innerHTML = LH.MUTS.map(m =>
        `<button class="row switch" data-action="mut" data-mut="${m.id}" role="switch"><span class="row-label">${m.name}<small>${m.desc}</small></span>` +
        `<span class="val-pill">+${Math.round(m.mult * 100)}%</span><span class="sw"></span></button>`).join('');
})();

// ---------------------------------------------------------------- mejoras entre oleadas
LH.UPS = [
    { id: 'fire', cat: 'atk', name: 'CADENCIA', desc: 'Disparas un 15% más rápido', max: 5 },
    { id: 'dmg', cat: 'atk', name: 'POTENCIA', desc: '+20% de daño con todas las armas', max: 5 },
    { id: 'pierce', cat: 'atk', name: 'PERFORANTES', desc: 'Tus balas atraviesan a un enemigo más', max: 3 },
    { id: 'ammo', cat: 'atk', name: 'MUNICIÓN EXTRA', desc: 'Las armas recogidas traen +50% de munición', max: 3 },
    { id: 'hp', cat: 'def', name: 'BLINDAJE', desc: '+25 de vida máxima y te cura 25', max: 4 },
    { id: 'shield', cat: 'def', name: 'ESCUDO', desc: 'Absorbe 1 golpe; se recarga cada oleada', max: 3 },
    { id: 'vamp', cat: 'def', name: 'VAMPIRISMO', desc: 'Recuperas 1 de vida por cada baja', max: 3 },
    { id: 'speed', cat: 'uti', name: 'REFLEJOS', desc: 'Te mueves un 7% más rápido', max: 4 },
    { id: 'magnet', cat: 'uti', name: 'IMÁN', desc: 'Recoges objetos desde más lejos', max: 3 },
    { id: 'pulse', cat: 'uti', name: 'PULSO RÁPIDO', desc: 'El pulso recarga un 20% más rápido', max: 4, needsPulse: true },
    { id: 'radius', cat: 'uti', name: 'ONDA EXPANSIVA', desc: 'El pulso llega un 25% más lejos', max: 3, needsPulse: true }
];
LH.lvl = (id) => (engine.up && engine.up[id]) || 0;
LH.offer = () => {
    const e = engine;
    const pool = LH.UPS.filter(u => LH.lvl(u.id) < u.max && !(e.mut.nopulse && u.needsPulse));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
};
LH.applyUp = (id) => {
    const e = engine, p = e.player;
    e.up[id] = LH.lvl(id) + 1;
    if (Object.values(e.up).reduce((a, b) => a + b, 0) >= 8) LH.unlock('ups');
    if (id === 'hp') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
    if (id === 'shield') p.shield = Math.min(3, (p.shield || 0) + 1);
    if (id === 'pulse') PULSE_COOLDOWN = 5 * Math.pow(0.8, e.up.pulse);
};
LH.openUpgrade = () => {
    const e = engine, opts = LH.offer();
    if (!opts.length || e.state !== 'PLAYING') return;
    e.upOpts = opts; e.state = 'UPGRADE';
    Input.keys = { w: false, a: false, s: false, d: false }; Input.mouse.active = false;
    $id('upSub').textContent = 'ONDA ' + e.wave + ' SUPERADA';
    $id('upGrid').innerHTML = opts.map((u, i) =>
        `<button class="up-card ${u.cat}" data-action="upgrade" data-i="${i}"><span class="up-key">${i + 1}</span><b>${u.name}</b>` +
        `<small>${u.desc}</small><em>NIVEL ${LH.lvl(u.id) + 1} / ${u.max}</em></button>`).join('');
    if (LH.GP.active) document.body.classList.add('kbd');
    Menu.open('pUpgrade', true);
    audio.playUI('click');
};
LH.pickUp = (i) => {
    const e = engine, u = e.upOpts && e.upOpts[i];
    if (!u || e.state !== 'UPGRADE') return;
    LH.applyUp(u.id);
    e.state = 'PLAYING'; e.upOpts = null; Menu.close();
    e.waveTimer = Math.max(e.waveTimer, 1.4);
    e.spawnText(e.player.x, e.player.y - 40, u.name + ' ' + LH.lvl(u.id), C.yellow);
    audio.playPickup(); haptic(40);
};
LH.chipsHTML = (over) => {
    const e = engine; if (!e || !e.up) return '';
    const a = LH.UPS.filter(u => LH.lvl(u.id)).map(u => `<span class="chip ${u.cat}">${u.name} <b>${LH.lvl(u.id)}</b></span>`);
    const m = LH.modsActive(e.mut).map(x => `<span class="chip mod">${x.name}</span>`);
    if (m.length) m.push(`<span class="chip mod">×${e.scoreMult.toFixed(2)}</span>`);
    const x = [];
    if (over ? (LH.last && LH.last.daily) : LH.dailyRun) x.push('<span class="chip uti">RETO DIARIO</span>');
    if (over && LH.rank) x.push(`<span class="chip uti">PUESTO ${LH.rank} DE TUS 5 MEJORES</span>`);
    return x.concat(a, m).join('');
};
LH.paintChips = (id, over) => { const el = $id(id); if (!el) return; const h = LH.chipsHTML(over); el.innerHTML = h; el.classList.toggle('hidden', !h); };

// ---------------------------------------------------------------- daño recibido: escudo y modificadores (un único sitio)
Object.defineProperty(Player.prototype, 'hp', {
    configurable: true,
    get() { return this._hp; },
    set(v) {
        const o = this._hp;
        if (o !== undefined && v < o && typeof engine !== 'undefined' && engine && engine.mut) {
            let d = o - v;
            if (this.shield > 0) {                                   // el escudo se come el golpe
                this.shield--;
                engine.spawnText(this.x, this.y - 34, 'ESCUDO', '#4da6ff');
                engine.spawnParticle(this.x, this.y, '#4da6ff', 24, 0, 0, 350);
                engine.addShake(8); return;
            }
            engine.hitWave = engine.wave;
            if (engine.mut.glass) d *= 2;
            if (engine.mut.onehit) d = o + 1;
            v = o - d;
        }
        this._hp = v;
    }
});

// ---------------------------------------------------------------- enemigos nuevos
const KAMI_COL = '#ff7a00', SPLIT_COL = '#00ffc8';
function makeEnemy(t, x, y, hp) {
    let e;
    if (t === 6) {                       // KAMIKAZE: avisa, embiste en línea recta y explota al tocarte
        e = new Enemy(0, x, y, hp); e.kind = 'kami'; e.radius = 13; e.color = KAMI_COL; e.speed = 210;
        e.maxHp = e.hp = 2 * hp * 0.9; e.dmg = 25; e.state = 'chase'; e.st = 0; e.cd = 1 + Math.random(); e.ang = 0; e.dir = 0;
    } else if (t === 7) {                // DIVISOR: al morir se rompe en tres enjambres
        e = new Enemy(0, x, y, hp); e.kind = 'split'; e.radius = 22; e.color = SPLIT_COL; e.speed = 125;
        e.maxHp = e.hp = 5 * hp; e.dmg = 18;
    } else e = new Enemy(t, x, y, hp);
    if (engine && engine.mut && engine.mut.frenzy && !e.boss && t !== 4) e.speed *= 1.25;
    return e;
}
LH.moveE = (e, dt, ang, sp) => {
    e.x += (Math.cos(ang) * sp + e.knockback.x) * dt; e.y += (Math.sin(ang) * sp + e.knockback.y) * dt;
    const ob = engine.obstacles;
    for (let i = 0; i < ob.length; i++) {
        const o = ob[i], r = rectCircleCollide(e.x, e.y, e.radius, o.x, o.y, o.w, o.h);
        if (r.hit) { e.x += r.nx * r.pen; e.y += r.ny * r.pen; }
    }
};
const _x_eUpdate = Enemy.prototype.update;
Enemy.prototype.update = function (dt, px, py) {
    if (!this.kind) return _x_eUpdate.call(this, dt, px, py);
    this.knockback.x *= 0.85; this.knockback.y *= 0.85;
    const d = dist(this.x, this.y, px, py), a = Math.atan2(py - this.y, px - this.x);
    if (this.kind === 'split') { LH.moveE(this, dt, engine.steer(this, a), this.speed); return; }
    this.st += dt;
    if (this.state === 'chase') {
        LH.moveE(this, dt, engine.steer(this, a) + Math.sin(engine.time * 5 + this.x * 0.03) * 0.3, this.speed);
        this.ang = a; this.cd -= dt;
        if (this.cd <= 0 && d < 330) { this.state = 'wind'; this.st = 0; }
    } else if (this.state === 'wind') {                              // aviso: se detiene y apunta
        this.ang = a; LH.moveE(this, dt, a, this.speed * 0.12);
        if (this.st >= 0.7) { this.state = 'dash'; this.st = 0; this.dir = a; }
    } else if (this.state === 'dash') {                              // embestida en línea recta
        this.ang = this.dir; LH.moveE(this, dt, this.dir, 640);
        if (this.st >= 0.6) { this.state = 'recover'; this.st = 0; }
    } else {                                                         // recupera el aliento
        this.ang = a; LH.moveE(this, dt, a, this.speed * 0.4);
        if (this.st >= 1) { this.state = 'chase'; this.cd = 1.8 + Math.random(); }
    }
};
function kindBody(c, kind, r, color, flash) {
    c.fillStyle = flash ? C.white : C.bg; c.strokeStyle = color; c.lineWidth = 3; c.shadowBlur = 16; c.shadowColor = color;
    c.beginPath();
    if (kind === 'kami') {
        c.moveTo(r * 1.35, 0); c.lineTo(-r, r * 0.95); c.lineTo(-r * 0.45, 0); c.lineTo(-r, -r * 0.95); c.closePath();
        c.fill(); c.stroke(); c.fillStyle = color; c.fillRect(-2, -2, 5, 4);
    } else {
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.fill(); c.stroke();
        c.lineWidth = 2; for (const k of [-1, 1]) { c.beginPath(); c.arc(k * r * 0.32, 0, r * 0.26, 0, TAU); c.stroke(); }
    }
}
const _x_eDraw = Enemy.prototype.draw;
Enemy.prototype.draw = function (ctx) {
    if (!this.kind) return _x_eDraw.call(this, ctx);
    const flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50 || (this.state === 'wind' && Math.floor(this.st * 14) % 2 === 0);
    const r = this.radius, id = (this.kind === 'kami' ? 'km' : 'sp') + (flash ? 'f' : 'n');
    const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => kindBody(c, this.kind, r, this.color, flash));
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.kind === 'kami') {
        ctx.rotate(this.ang || 0);
        if (this.state === 'wind') {                                 // línea de aviso hacia donde va a embestir
            ctx.strokeStyle = 'rgba(255,122,0,.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r + 340, 0); ctx.stroke(); ctx.setLineDash([]);
        }
    }
    ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
};

// Al morir un enemigo: vampirismo, divisor y objetos especiales
LH.EXTRA_DROPS = ['SHIELD', 'SHIELD', 'SHIELD', 'SLOW', 'SLOW', 'SLOW', 'MAGNET', 'MAGNET', 'MAGNET', 'NUKE'];
LH.onKill = (e, en) => {
    const p = e.player;
    LH.prog.kills++;
    if (LH.prog.kills >= 500) LH.unlock('k500');
    if (en.kind === 'kami' && ++LH.prog.kami >= 15) LH.unlock('kami');
    if (en.boss) LH.unlock('boss');
    if (LH.lvl('vamp')) p.hp = Math.min(p.maxHp, p.hp + LH.lvl('vamp'));
    if (en.kind === 'split') {
        for (let i = 0; i < 3; i++) {
            const a = i / 3 * TAU + Math.random(), k = new Enemy(3, en.x + Math.cos(a) * 18, en.y + Math.sin(a) * 18, 1);
            k.knockback.x = Math.cos(a) * 500; k.knockback.y = Math.sin(a) * 500; e.enemies.push(k);
        }
    }
    if (!en.boss && Math.random() < 0.045) e.pickups.push(new Pickup(en.x, en.y, LH.EXTRA_DROPS[Math.floor(Math.random() * LH.EXTRA_DROPS.length)]));
};
const _x_hitEnemy = GameEngine.prototype.hitEnemy;
GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
    const alive = !en.dead;
    _x_hitEnemy.call(this, en, dmg * (this._dmgMul || 1), fx, fy, melee);
    if (alive && en.dead) LH.onKill(this, en);
};

// ---------------------------------------------------------------- objetos especiales
LH.nuke = () => {
    const e = engine, p = e.player, k0 = e.kills;
    e.rings.push({ x: p.x, y: p.y, max: 1500, life: 0.7, maxLife: 0.7, col: '#ff3355' });
    e.addShake(60); e.doHitStop(0.15); audio.playExplosion(); haptic([80, 40, 160]);
    for (let pass = 0; pass < 2; pass++) {                           // 2.ª pasada: crías de divisores
        for (const en of e.enemies.slice()) {
            if (en.dead || (pass && (en.boss || en.type === 4))) continue;
            if (en.boss) e.hitEnemy(en, en.maxHp * 0.12, 0, 0);
            else if (en.type === 4) e.hitEnemy(en, en.maxHp * 0.5, 0, 0);
            else e.hitEnemy(en, 9999, (en.x - p.x) * 2, (en.y - p.y) * 2, true);
        }
    }
    e.bullets = e.bullets.filter(b => !b.isEnemy);
    if (e.kills - k0 >= 8) LH.unlock('boom');
};
GameEngine.prototype.applyPower = function (key) {
    const p = this.player;
    if (key === 'SHIELD') { p.shield = Math.min(3, (p.shield || 0) + 1); this.spawnText(p.x, p.y - 30, '+ESCUDO', '#4da6ff'); }
    else if (key === 'SLOW') { this.slowT = 5; this.spawnText(p.x, p.y - 30, 'TIEMPO LENTO', '#b388ff'); }
    else if (key === 'MAGNET') { this.magnetT = 8; this.spawnText(p.x, p.y - 30, 'IMÁN', '#ff9f1c'); }
    else if (key === 'NUKE') { LH.nuke(); this.spawnText(p.x, p.y - 30, '¡BOMBA!', '#ff3355'); }
};
const _x_equip = Player.prototype.equip;
Player.prototype.equip = function (key, amount) {
    if (EXTRA_PK[key]) { engine.applyPower(key); return; }
    if (amount !== Infinity) {
        if (key === 'ROCKET') amount = 14; else if (key === 'LASER') amount = 170;
        amount = Math.round(amount * (1 + 0.5 * LH.lvl('ammo')));
    }
    return _x_equip.call(this, key, amount);
};
const _x_pkUpdate = Pickup.prototype.update;
Pickup.prototype.update = function (dt) {
    _x_pkUpdate.call(this, dt);
    const e = engine, pl = e.player;
    if (!pl || e.state !== 'PLAYING') return;
    const mag = e.magnetT > 0, R = mag ? 2600 : 130 * (1 + 0.6 * LH.lvl('magnet'));
    if (R <= 130) return;
    const d = dist(this.x, this.y, pl.x, pl.y);
    if (d < R && d > 1) {
        const s = (mag ? 560 : (1 - d / R) * 420) * dt;
        this.x += (pl.x - this.x) / d * s; this.y += (pl.y - this.y) / d * s;
        if (mag) this.life = Math.max(this.life, 3.2);
    }
};

// ---------------------------------------------------------------- armas nuevas: LÁSER y LANZACOHETES
LH.fireLaser = (p) => {
    if (p.ammo <= 0) { p.equip('PISTOL', Infinity); return; }
    const e = engine, w = p.weapon, c = Math.cos(p.angle), s = Math.sin(p.angle);
    let L = 780;
    if (e.wallHit) for (let d = 40; d <= 780; d += 40) if (e.wallHit(p.x + c * (d - 40), p.y + s * (d - 40), p.x + c * d, p.y + s * d)) { L = d; break; }
    const x2 = p.x + c * L, y2 = p.y + s * L;
    e.lasers.push({ x1: p.x + c * p.radius, y1: p.y + s * p.radius, x2, y2, life: 0.07 });
    for (const en of e.enemies.slice()) if (!en.dead && segDist(en.x, en.y, p.x, p.y, x2, y2) < en.radius + 5) e.hitEnemy(en, w.damage, c * 160, s * 160);
    p.ammo--; p.fireCooldown = w.fireRate; p.kx -= c * 30; p.ky -= s * 30;
    e.addShake(1.5); audio.playShoot('MINIGUN'); haptic(12);
};
LH.fireRocket = (p) => {
    if (p.ammo <= 0) { p.equip('PISTOL', Infinity); return; }
    const e = engine, c = Math.cos(p.angle), s = Math.sin(p.angle);
    e.rockets.push({ x: p.x + c * p.radius, y: p.y + s * p.radius, px: p.x, py: p.y, vx: c * 680, vy: s * 680, life: 2.2, k: 0 });
    p.ammo--; p.fireCooldown = p.weapon.fireRate; p.kx -= c * 500; p.ky -= s * 500;
    e.addShake(10); audio.playShoot('SHOTGUN'); haptic(40);
};
LH.explode = (x, y) => {
    const e = engine, R = 125, dm = 1 + 0.2 * LH.lvl('dmg');
    e.rings.push({ x, y, max: R, life: 0.35, maxLife: 0.35, col: '#ff9a3c' });
    for (const en of e.enemies.slice()) {
        if (en.dead) continue;
        const d = dist(x, y, en.x, en.y); if (d > R + en.radius) continue;
        const k = 1 - 0.5 * Math.min(1, d / R), n = Math.max(d, 1);
        e.hitEnemy(en, 5 * k * dm, (en.x - x) / n * 700, (en.y - y) / n * 700, true);
    }
    e.bullets = e.bullets.filter(b => !(b.isEnemy && dist(x, y, b.x, b.y) < R));
    e.spawnParticle(x, y, '#ff9a3c', 60, 0, 0, 500); e.spawnParticle(x, y, C.white, 12, 0, 0, 300);
    e.addShake(28); e.doHitStop(0.04); audio.playExplosion(); haptic(60);
};
LH.stepRockets = (dt) => {
    const e = engine;
    for (let i = e.rockets.length - 1; i >= 0; i--) {
        const r = e.rockets[i];
        r.px = r.x; r.py = r.y; r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt;
        let boom = r.life <= 0 || r.x < 0 || r.x > width || r.y < 0 || r.y > height || (e.wallHit && e.wallHit(r.px, r.py, r.x, r.y));
        if (!boom) for (const en of e.enemies) if (!en.dead && dist(r.x, r.y, en.x, en.y) < en.radius + 9) { boom = true; break; }
        if (boom) { LH.explode(r.x, r.y); e.rockets.splice(i, 1); }
        else if ((r.k = (r.k + 1) % 2) === 0) e.spawnParticle(r.x, r.y, '#ff9a3c', 2, 0, 0, 60);
    }
};
const _x_shoot = Player.prototype.shoot;
Player.prototype.shoot = function () {
    const e = engine, w = this.weapon, dm = 1 + 0.2 * LH.lvl('dmg'), n0 = e.bullets.length;
    LH.tut.shots++;
    e._dmgMul = dm;
    if (w.type === 'laser') LH.fireLaser(this); else if (w.type === 'rocket') LH.fireRocket(this); else _x_shoot.call(this);
    e._dmgMul = 1;
    const pb = LH.lvl('pierce');
    for (let i = n0; i < e.bullets.length; i++) { const b = e.bullets[i]; if (!b.isEnemy) { b.damage *= dm; b.pierce += pb; } }
    this.fireCooldown *= Math.pow(0.85, LH.lvl('fire'));
};
const _x_pulse = Player.prototype.pulse;
Player.prototype.pulse = function () {
    if (engine.mut && engine.mut.nopulse) return;
    const cd = this.pulseCooldown; _x_pulse.call(this);
    if (this.pulseCooldown > 0 && cd <= 0) LH.tut.pulses++;
};
const _x_shock = GameEngine.prototype.shockwave;
GameEngine.prototype.shockwave = function (x, y, r) { return _x_shock.call(this, x, y, r * (1 + 0.25 * LH.lvl('radius'))); };

// ---------------------------------------------------------------- jefes con fases
LH.bossTick = (e, dt) => {
    const b = e.enemies.find(x => x.boss && !x.dead);
    e.bossRef = b || null;
    if (!b) return;
    const r = b.hp / b.maxHp, ph = r < 0.34 ? 3 : r < 0.67 ? 2 : 1;
    if (b.phase === undefined) b.phase = 1;
    if (ph > b.phase) {                                              // cambio de fase: sacudida, onda y el jefe queda vulnerable un instante
        b.phase = ph; b.phT = 1.2;
        e.banner(ph === 3 ? 'FASE 3 · FURIA' : 'FASE 2', ph === 3 ? C.red : C.pink);
        e.rings.push({ x: b.x, y: b.y, max: 560, life: 0.6, maxLife: 0.6, col: '#ff2d6f' });
        e.bullets = e.bullets.filter(q => !q.isEnemy);
        e.addShake(45); e.doHitStop(0.25); audio.playExplosion(); haptic([60, 40, 120]);
        b.rush = 0; b.telegraph = 0; b.recover = 1.0;
    }
    if (b.phase >= 2) {
        b.phT = (b.phT || 0) - dt;
        if (b.phT <= 0 && !(b.recover > 0)) {
            const pa = Math.atan2(e.player.y - b.y, e.player.x - b.x), mk = (a, s) => e.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: C.pink, damage: 12, name: 'ENEMY_GUN' }, true));
            for (let i = -1; i <= 1; i++) mk(pa + i * 0.2, 500);
            if (b.phase === 3) for (let i = 0; i < 14; i++) mk(i / 14 * TAU + e.time, 260);
            b.phT = b.phase === 3 ? 1.9 : 2.7; audio.playShoot('ENEMY_GUN', true);
        }
    }
};

// ---------------------------------------------------------------- mando (gamepad)
LH.GP = {
    pad: null, prev: [], last: 0, navT: 0, ax: [0, 0, 0, 0], aim: 0,
    get active() { return performance.now() - this.last < 6000; },
    pressed(i) { const b = this.pad && this.pad.buttons[i]; return !!(b && b.pressed); },
    edge(i) { return this.pressed(i) && !this.prev[i]; },
    rumble(ms) {
        const p = this.pad; if (!p || !Settings.vibrate || !p.vibrationActuator) return;
        try { p.vibrationActuator.playEffect('dual-rumble', { duration: Math.min(350, ms || 60), strongMagnitude: 0.6, weakMagnitude: 0.5 }); } catch (e) {}
    },
    nav(d) {
        const list = Menu.focusables(); if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        document.body.classList.add('kbd');
        list[(i + d + list.length) % list.length].focus({ preventScroll: false }); audio.playUI('hover');
    },
    horiz(d) {
        const a = document.activeElement;
        if (a && a.classList && a.classList.contains('tab')) {
            const tabs = [...a.parentElement.querySelectorAll('.tab')], n = tabs[(tabs.indexOf(a) + d + tabs.length) % tabs.length]; n.focus(); n.click();
        } else if (a && a.type === 'range') {
            a.value = (+a.value) + d * (+a.step || 0.05); a.dispatchEvent(new Event('input', { bubbles: true }));
        } else this.nav(d);
    },
    menus() {
        const st = engine.state;
        if (st === 'PLAYING') return;
        const up = this.edge(12), dn = this.edge(13), lf = this.edge(14), rt = this.edge(15);
        const sy = this.ax[1], sx = this.ax[0], now = performance.now(), stick = (Math.abs(sy) > 0.6 || Math.abs(sx) > 0.6) && now > this.navT;
        if (stick) this.navT = now + 230;
        if (up || (stick && sy < -0.6)) this.nav(-1);
        if (dn || (stick && sy > 0.6)) this.nav(1);
        if (lf || (stick && sx < -0.6)) this.horiz(-1);
        if (rt || (stick && sx > 0.6)) this.horiz(1);
        if (this.edge(0)) {
            const a = document.activeElement;
            if (a && DOM.screens.contains(a) && a.tagName === 'BUTTON') a.click();
            else { const p = $id(Menu.current), m = p && p.querySelector('.btn-main'); if (m) m.click(); else { document.body.classList.add('kbd'); Menu.focusFirst(p); } }
        }
        if (this.edge(1)) {
            if (st === 'PAUSED' && Menu.current === 'pPause') engine.resume();
            else if (st !== 'PAUSED' && st !== 'UPGRADE' && Menu.stack.length) { Menu.back(); audio.playUI('back'); }
            else if (st === 'PAUSED') Menu.back();
        }
    },
    tick() {
        requestAnimationFrame(() => LH.GP.tick());
        const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null;
        for (const q of pads) if (q && q.connected) { p = q; break; }
        if (p !== this.pad) { this.pad = p; if (p) LH.toast('MANDO CONECTADO'); }
        if (!p || !engine) return;
        const dz = (v) => Math.abs(v) < 0.2 ? 0 : v;
        this.ax = [dz(p.axes[0] || 0), dz(p.axes[1] || 0), dz(p.axes[2] || 0), dz(p.axes[3] || 0)];
        if (this.ax.some(v => v) || p.buttons.some(b => b.pressed)) this.last = performance.now();
        if (engine.state === 'PLAYING') {
            if (this.edge(0) || this.edge(4) || this.edge(6)) engine.player.pulse();
            if (this.edge(9)) engine.togglePause();
        } else if (engine.state === 'PAUSED' && this.edge(9) && Menu.current === 'pPause') engine.resume();
        this.menus();
        this.prev = p.buttons.map(b => b.pressed);
    },
    drive(pl) {                                     // inyecta el mando como si fueran los joysticks (solo durante update)
        const g = this.pad; if (!g || !this.active) return null;
        const L = Input.left, R = Input.right, saved = [L.active, L.force, L.vector.x, L.vector.y, R.active, R.force, R.vector.x, R.vector.y];
        const [lx, ly, rx, ry] = this.ax, lm = Math.hypot(lx, ly), rm = Math.hypot(rx, ry);
        let touched = false;
        if (lm > 0) { L.active = true; L.force = Math.min(1, lm); L.vector.x = lx / lm; L.vector.y = ly / lm; touched = true; }
        const fire = this.pressed(7) || this.pressed(5);
        if (rm > 0.3) { this.aim = Math.atan2(ry, rx); R.active = true; R.force = Math.min(1, rm); R.vector.x = rx / rm; R.vector.y = ry / rm; touched = true; }
        else if (fire) { R.active = true; R.force = 1; R.vector.x = Math.cos(this.aim); R.vector.y = Math.sin(this.aim); touched = true; }
        return touched ? saved : null;
    },
    restore(s) {
        if (!s) return; const L = Input.left, R = Input.right;
        [L.active, L.force, L.vector.x, L.vector.y, R.active, R.force, R.vector.x, R.vector.y] = s;
    }
};
const _x_haptic = haptic;
haptic = function (ms) { _x_haptic(ms); LH.GP.rumble(Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) / 2 : ms); };
window.addEventListener('gamepaddisconnected', () => LH.toast('MANDO DESCONECTADO'));

// ---------------------------------------------------------------- jugador: velocidad, tiempo lento, mando, escudo visible
const _x_pUpd = Player.prototype.update;
Player.prototype.update = function (dt) {
    const e = engine, slow = e.slowT > 0;
    this.baseSpeed = 440 * (1 + 0.07 * LH.lvl('speed')) * (slow ? 1.8 : 1);
    if (slow) this.fireCooldown -= dt;                               // en tiempo lento tú sigues a ritmo normal
    const saved = LH.GP.drive(this);
    _x_pUpd.call(this, dt);
    LH.GP.restore(saved);
    const m = Math.hypot(this.vx, this.vy); LH.tut.moved += m * dt / (slow ? 1.8 : 1);
};
const _x_pDraw = Player.prototype.draw;
Player.prototype.draw = function (ctx) {
    _x_pDraw.call(this, ctx);
    if (this.shield > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#4da6ff'; ctx.lineWidth = 3;
        for (let i = 0; i < this.shield; i++) {
            ctx.globalAlpha = 0.55 + 0.3 * Math.sin(engine.time * 10 + i);
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 9 + i * 6, 0, TAU); ctx.stroke();
        }
        ctx.restore();
    }
};
const _x_upd = GameEngine.prototype.update;
GameEngine.prototype.update = function (dt) {
    if (this.state === 'PLAYING' && this.slowT > 0) { this.slowT -= dt; dt *= 0.5; }
    return _x_upd.call(this, dt);
};

// ---------------------------------------------------------------- partida: reinicio, oleadas y puntuación
const _x_reset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function () {
    _x_reset.call(this);
    this.up = {}; this.mut = LH.dailyRun ? LH.dailyMods() : Object.assign({}, LH.mods); this.scoreMult = LH.modMult(this.mut);
    this.hitWave = -1; this.bossRef = null;
    this.slowT = 0; this.magnetT = 0; this.rockets = []; this.lasers = []; this.upT = 0; this._dmgMul = 1; this.upOpts = null;
    PULSE_COOLDOWN = 5;
    this.player.shield = 0;
    document.body.classList.toggle('nopulse', !!this.mut.nopulse);
    document.body.classList.remove('lowhp'); LH._low = false;
    LH.tutReset();
};
const _x_addScore = GameEngine.prototype.addScore;
GameEngine.prototype.addScore = function (amount, x, y) { return _x_addScore.call(this, Math.round(amount * (this.scoreMult || 1)), x, y); };
const _x_startWave = GameEngine.prototype.startWave;
GameEngine.prototype.startWave = function () {
    _x_startWave.call(this);
    const w = this.wave, q = this.queue;
    if (w >= 10) LH.unlock('w10');
    if (w >= 15) LH.unlock('w15');
    if (w >= 5) { if (this.mut.onehit || this.mut.nopulse) LH.unlock('hard'); if (LH.dailyRun) LH.unlock('daily'); }
    const add = (t, n, d, c) => { for (let i = 0; i < c; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, { t, n, d }); };
    if (w % 5 !== 0) {
        if (w >= 3) add(6, 1, 1.1, Math.min(6, Math.floor(w / 3)));
        if (w >= 5) add(7, 1, 1.3, Math.min(5, Math.floor((w - 2) / 3)));
    }
    if (this.mut.horde) add(0, 1, 0.6, Math.ceil(q.length * 0.5));
    this.player.shield = Math.max(this.player.shield || 0, LH.lvl('shield'));
    audio.music.call('setWaveSize', q.reduce((a, x) => a + x.n, 0));
};
const _x_spawnLogic = GameEngine.prototype.spawnLogic;
GameEngine.prototype.spawnLogic = function (dt) {
    const was = this.waveState;
    _x_spawnLogic.call(this, dt);
    if (was === 'FIGHT' && this.waveState === 'BREAK') {            // oleada superada
        const w = this.wave;
        if (w >= 3 && this.hitWave !== w) LH.unlock('clean');
        if (w % 3 === 0 || w % 5 === 0) this.upT = 1.0;
        if (Math.random() < 0.35) { const s = this.freeSpot(); this.pickups.push(new Pickup(s.x, s.y, LH.EXTRA_DROPS[Math.floor(Math.random() * LH.EXTRA_DROPS.length)])); }
    }
};

// ---------------------------------------------------------------- tutorial interactivo
LH.TUT = [
    { t: { kbd: 'MUÉVETE con W A S D', touch: 'MUÉVETE con el joystick izquierdo', pad: 'MUÉVETE con el stick izquierdo' }, done: () => LH.tut.moved > 260 },
    { t: { kbd: 'DISPARA con el ratón (mantén pulsado)', touch: 'APUNTA Y DISPARA con el joystick derecho', pad: 'APUNTA Y DISPARA con el stick derecho' }, done: () => LH.tut.shots >= 8 },
    { t: { kbd: 'PULSO: pulsa ESPACIO para repeler enemigos', touch: 'PULSO: toca el botón circular', pad: 'PULSO: pulsa A' }, done: () => LH.tut.pulses >= 1 },
    { t: { kbd: 'RECOGE los objetos que sueltan los enemigos', touch: 'RECOGE los objetos que sueltan los enemigos', pad: 'RECOGE los objetos que sueltan los enemigos' }, done: () => LH.tut.picks >= 1 || LH.tut.t > 40 }
];
LH.tut = { step: 0, t: 0, st: 0, moved: 0, shots: 0, pulses: 0, picks: 0, end: 0, shown: -1 };
LH.tutReset = () => { LH.tut = { step: 0, t: 0, st: 0, moved: 0, shots: 0, pulses: 0, picks: 0, end: 0, shown: -1 }; const h = $id('hintBar'); if (h) h.classList.add('hidden'); };
LH.tutTick = (dt) => {
    const tu = LH.tut, h = $id('hintBar');
    if (!h) return;
    if (!Settings.tutorial) { if (!h.classList.contains('hidden')) h.classList.add('hidden'); return; }
    tu.t += dt; tu.st += dt;
    if (tu.end) { if ((tu.end -= dt) <= 0) { Settings.tutorial = false; saveSettings(); h.classList.add('hidden'); } return; }
    const s = LH.TUT[tu.step];
    if (tu.st > 1.5 && s.done()) {
        tu.step++; tu.st = 0; tu.shots = 0;
        if (tu.step >= LH.TUT.length) { tu.end = 2.2; h.innerHTML = '<b>¡LISTO!</b> SOBREVIVE A LAS OLEADAS'; h.classList.remove('hidden'); tu.shown = -2; return; }
    }
    const mode = isTouchUI() ? 'touch' : (LH.GP.active ? 'pad' : 'kbd'), key = tu.step + mode;
    if (tu.shown !== key) { tu.shown = key; h.innerHTML = `<i>${tu.step + 1}/${LH.TUT.length}</i> ${LH.TUT[tu.step].t[mode]}`; h.classList.remove('hidden'); }
};
const _x_playPickup = AudioEngine.prototype.playPickup;
AudioEngine.prototype.playPickup = function () { LH.tut.picks++; return _x_playPickup.apply(this, arguments); };

// ---------------------------------------------------------------- bucle de extras (dentro del update, ya sin pausa)
LH.chipsT = 0;
LH.tick = (e, dt) => {
    if (e.state !== 'PLAYING' || e.hitStop > 0) return;
    if (e.magnetT > 0) e.magnetT -= dt;
    LH.prog.time += dt;
    if (e.combo >= 25) { LH.unlock('c25'); if (e.combo >= 50) LH.unlock('c50'); }
    if (e.combo > LH.prog.bestCombo) LH.prog.bestCombo = e.combo;
    if (e.score >= 50000) LH.unlock('s50');
    const low = e.player.hp / e.player.maxHp < 0.3;
    if (low !== LH._low) { LH._low = low; document.body.classList.toggle('lowhp', low); }
    if (e.upT > 0 && (e.upT -= dt) <= 0) { LH.openUpgrade(); return; }
    LH.stepRockets(dt);
    for (let i = e.lasers.length - 1; i >= 0; i--) if ((e.lasers[i].life -= dt) <= 0) e.lasers.splice(i, 1);
    // kamikazes: explotan al tocarte durante la embestida
    const p = e.player;
    for (const en of e.enemies) {
        if (en.kind === 'kami' && !en.dead && en.state === 'dash' && dist(en.x, en.y, p.x, p.y) < p.radius + en.radius + 6) {
            en.dead = true;
            e.rings.push({ x: en.x, y: en.y, max: 95, life: 0.3, maxLife: 0.3, col: KAMI_COL });
            e.spawnParticle(en.x, en.y, KAMI_COL, 60, 0, 0, 500, 'blood'); e.spawnParticle(en.x, en.y, C.white, 10, 0, 0, 300);
            e.addShake(26); audio.playExplosion();
            if (p.iframes <= 0 && dist(en.x, en.y, p.x, p.y) < 95) { p.hp -= 20; p.iframes = 0.5; e.glitch(); if (p.hp <= 0) { e.gameOver(); return; } }
        }
    }
    LH.bossTick(e, dt);
    // indicadores de efectos activos
    LH.chipsT -= dt;
    if (LH.chipsT <= 0) {
        LH.chipsT = 0.15;
        const t = [];
        if (p.shield > 0) t.push(`<span class="fx s">ESCUDO ×${p.shield}</span>`);
        if (e.slowT > 0) t.push(`<span class="fx t">LENTO ${Math.ceil(e.slowT)}</span>`);
        if (e.magnetT > 0) t.push(`<span class="fx m">IMÁN ${Math.ceil(e.magnetT)}</span>`);
        const h = t.join(''), el = $id('fxChips');
        if (el && el._h !== h) { el._h = h; el.innerHTML = h; }
        document.body.classList.toggle('slowmo', e.slowT > 0);
    }
    LH.tutTick(dt);
};
const _x_post = GameEngine.prototype.postUpdate;
GameEngine.prototype.postUpdate = function (dt) { _x_post.call(this, dt); LH.tick(this, dt); };

// ---------------------------------------------------------------- dibujo de efectos nuevos
const _x_drawFx = GameEngine.prototype.drawFx;
GameEngine.prototype.drawFx = function (ctx) {
    _x_drawFx.call(this, ctx);
    const bb = this.bossRef, aura = !!bb && !bb.dead && bb.phase >= 2;
    if (!this.lasers.length && !this.rockets.length && !aura) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const l of this.lasers) {
        const k = l.life / 0.07;
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);
        ctx.strokeStyle = `rgba(57,255,20,${k * 0.28})`; ctx.lineWidth = 18 * k + 4; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 4 * k + 1.5; ctx.stroke();
    }
    for (const r of this.rockets) {
        ctx.strokeStyle = 'rgba(255,154,60,.85)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(r.x - r.vx * 0.045, r.y - r.vy * 0.045); ctx.lineTo(r.x, r.y); ctx.stroke();
        ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(r.x, r.y, 4, 0, TAU); ctx.fill();
    }
    if (aura) { const b = bb;
        ctx.strokeStyle = `rgba(255,0,60,${0.3 + 0.2 * Math.sin(this.time * 8)})`; ctx.lineWidth = b.phase === 3 ? 6 : 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 14 + Math.sin(this.time * 6) * 4, 0, TAU); ctx.stroke();
    }
    ctx.restore();
};
const _x_warm = warmSprites;
warmSprites = function () {
    _x_warm();
    try {
        const sc = document.createElement('canvas').getContext('2d');
        for (const t of [6, 7]) for (const f of [0, 1]) { const e = makeEnemy(t, 0, 0, 1); if (f) e.knockback.x = 99; e.draw(sc); }
        for (const k of ['ROCKET', 'LASER', 'SHIELD', 'SLOW', 'MAGNET', 'NUKE']) new Pickup(0, 0, k).draw(sc);
    } catch (e) {}
};

// ---------------------------------------------------------------- menús: pantallas nuevas y acciones
const _x_menuShow = Menu.show;
Menu.show = function (id) {
    _x_menuShow.call(this, id);
    if (id === 'pMain' || id === 'pMods') LH.paintMods();
    if (id === 'pMain') LH.paintDaily();
    if (id === 'pProg') { this.setTab($id('pProg'), 'ach'); LH.paintProg(); }
    if (id === 'pPause') LH.paintChips('pauseChips');
    if (id === 'pOver') LH.paintChips('overChips', true);
};
const _x_fillOver = Menu.fillOver;
Menu.fillOver = function (e) {
    _x_fillOver.call(this, e);
    const daily = !!LH.dailyRun;
    LH.last = { wave: e.wave, score: e.score, combo: e.maxCombo || 0, kills: e.kills || 0, mods: Object.assign({}, e.mut), daily };
    document.body.classList.remove('lowhp'); LH._low = false;
    LH.rank = 0;
    if (e.score > 0) {
        const ent = { s: e.score, w: e.wave, c: e.maxCombo || 0, m: +e.scoreMult.toFixed(2), d: Date.now(), y: daily };
        LH.top.push(ent); LH.top.sort((a, b) => b.s - a.s); LH.top = LH.top.slice(0, 5);
        LH.rank = LH.top.indexOf(ent) + 1; LH.save('linehotTop', LH.top);
    }
    if (daily) {
        const k = LH.dayKey(); if (LH.daily.date !== k) LH.daily = { date: k, best: 0 };
        LH.daily.best = Math.max(LH.daily.best, e.score); LH.save('linehotDaily', LH.daily);
    }
    LH.save('linehotProg', LH.prog);
};
LH.share = async () => {
    const r = LH.last; if (!r) return;
    const m = LH.modsActive(r.mods);
    const txt = `LINEHOT · Onda ${r.wave} · ${r.score} pts · combo x${r.combo} · ${r.kills} enemigos` +
        (m.length ? ` · ${m.map(x => x.name).join('+')} ×${LH.modMult(r.mods).toFixed(2)}` : '') + (r.daily ? ' · RETO DIARIO' : '') + ' — ¿Me superas?';
    const url = location.href.split('#')[0];
    if (navigator.share) { try { await navigator.share({ title: 'LineHot', text: txt, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(txt + ' ' + url); LH.toast('RESULTADO COPIADO'); }
    catch (e) { window.prompt('Copia tu resultado:', txt + ' ' + url); }
};
let _x_installEv = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); _x_installEv = ev; const b = $id('installBtn'); if (b) b.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { _x_installEv = null; const b = $id('installBtn'); if (b) b.classList.add('hidden'); LH.toast('APP INSTALADA'); });
DOM.screens.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    switch (b.dataset.action) {
        case 'play': if (!LH._viaDaily) LH.dailyRun = false; break;
        case 'daily': LH.dailyRun = true; LH._viaDaily = true; document.querySelector('#pMain [data-action="play"]').click(); LH._viaDaily = false; break;
        case 'prog': Menu.open('pProg'); break;
        case 'mods': Menu.open('pMods'); break;
        case 'mut': LH.mods[b.dataset.mut] = !LH.mods[b.dataset.mut]; try { localStorage.setItem('linehotMods', JSON.stringify(LH.mods)); } catch (e) {} LH.paintMods(); break;
        case 'upgrade': LH.pickUp(+b.dataset.i); break;
        case 'share': LH.share(); break;
        case 'install': if (_x_installEv) { _x_installEv.prompt(); _x_installEv = null; b.classList.add('hidden'); } break;
    }
});
document.addEventListener('keydown', (ev) => {
    if (engine && engine.state === 'UPGRADE' && ['1', '2', '3'].includes(ev.key)) LH.pickUp(+ev.key - 1);
});
LH.GP.tick();

// ---------------------------------------------------------------- progreso: logros, mejores partidas, reto diario
LH.load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
LH.save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
LH.ach = LH.load('linehotAch', {});
LH.prog = Object.assign({ kills: 0, kami: 0, bestCombo: 0, time: 0 }, LH.load('linehotProg', {}));
LH.top = LH.load('linehotTop', []);
LH.daily = LH.load('linehotDaily', { date: '', best: 0 });
LH.dailyRun = false; LH.rank = 0;
LH.ACH = [
    { id: 'boss', name: 'CAZAJEFES', desc: 'Derrota a un jefe' },
    { id: 'w10', name: 'SUPERVIVIENTE', desc: 'Llega a la onda 10' },
    { id: 'w15', name: 'LEYENDA', desc: 'Llega a la onda 15' },
    { id: 'c25', name: 'EN RACHA', desc: 'Consigue un combo de 25' },
    { id: 'c50', name: 'IMPARABLE', desc: 'Consigue un combo de 50' },
    { id: 'k500', name: 'CAZADOR', desc: 'Derrota a 500 enemigos en total', prog: () => [LH.prog.kills, 500] },
    { id: 's50', name: '50 MIL', desc: 'Haz 50.000 puntos en una partida' },
    { id: 'clean', name: 'INTOCABLE', desc: 'Supera una oleada (desde la 3) sin recibir daño' },
    { id: 'ups', name: 'ARSENAL', desc: 'Reúne 8 niveles de mejora en una partida' },
    { id: 'boom', name: 'BOOM', desc: 'Derrota a 8 enemigos o más con una sola bomba' },
    { id: 'kami', name: 'ESQUIVA', desc: 'Derrota a 15 kamikazes', prog: () => [LH.prog.kami, 15] },
    { id: 'hard', name: 'SIN RED', desc: 'Llega a la onda 5 con UN GOLPE o SIN PULSO' },
    { id: 'daily', name: 'MADRUGADOR', desc: 'Llega a la onda 5 en el reto diario' }
];
LH.unlock = (id) => {
    if (LH.ach[id]) return;
    LH.ach[id] = Date.now(); LH.save('linehotAch', LH.ach);
    const a = LH.ACH.find(x => x.id === id);
    LH.toast('★ LOGRO · ' + a.name); try { audio.playUI('toggle'); } catch (e) {}
};
LH.dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
LH.dailyMods = () => {                           // dos modificadores fijos para todo el mundo ese día (sin "un golpe")
    let h = 2166136261; for (const c of LH.dayKey() + 'linehot') { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    h >>>= 0;
    const ids = LH.MUTS.map(m => m.id).filter(i => i !== 'onehit'), i = h % ids.length, j = (i + 1 + ((h >>> 8) % (ids.length - 1))) % ids.length;
    return { [ids[i]]: true, [ids[j]]: true };
};
LH.paintDaily = () => {
    const k = LH.dayKey(), m = LH.dailyMods(), names = LH.MUTS.filter(x => m[x.id]).map(x => x.name).join(' + ');
    const best = LH.daily.date === k ? LH.daily.best : 0;
    $id('dailyTxt').innerHTML = `RETO DIARIO<small>${names} · ×${LH.modMult(m).toFixed(2)}${best ? ' · MEJOR ' + best : ''}</small>`;
    $id('progCount').textContent = LH.ACH.filter(a => LH.ach[a.id]).length + '/' + LH.ACH.length;
};
LH.paintProg = () => {
    const n = LH.ACH.filter(a => LH.ach[a.id]).length;
    $id('achList').innerHTML = LH.ACH.map(a => {
        const on = !!LH.ach[a.id], pr = a.prog && !on ? a.prog() : null;
        return `<div class="row static ach${on ? ' on' : ''}"><span class="row-label">${a.name}<small>${a.desc}</small></span><span class="val-pill">${on ? '✓' : pr ? Math.min(pr[0], pr[1]) + '/' + pr[1] : '—'}</span></div>`;
    }).join('');
    $id('topList').innerHTML = LH.top.length ? LH.top.map((t, i) =>
        `<div class="row static"><span class="rk">${i + 1}</span><span class="row-label">${t.s}<small>ONDA ${t.w} · COMBO ×${t.c} · ×${t.m.toFixed(2)}${t.y ? ' · DIARIO' : ''} · ${new Date(t.d).toLocaleDateString()}</small></span></div>`).join('')
        : '<p class="hint">Todavía no hay partidas guardadas. ¡Juega una!</p>';
    const S = Stats.d, h = Math.floor(LH.prog.time / 3600), mi = Math.floor(LH.prog.time % 3600 / 60);
    const rows = [['PARTIDAS', S.games], ['ENEMIGOS DERROTADOS', LH.prog.kills], ['MEJOR ONDA', S.bestWave], ['MEJOR COMBO', '×' + LH.prog.bestCombo],
        ['TIEMPO JUGADO', h ? h + ' h ' + mi + ' min' : mi + ' min'], ['LOGROS', n + ' / ' + LH.ACH.length]];
    $id('statList').innerHTML = rows.map(r => `<div class="row static"><span class="row-label">${r[0]}</span><span class="val-pill">${r[1]}</span></div>`).join('');
};
window.addEventListener('pagehide', () => LH.save('linehotProg', LH.prog));

// ---------------------------------------------------------------- PWA: funciona sin conexión y se instala
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
