// =====================================================================
//  LINEHOT · EXTRAS Y MEJORAS
//  Todo lo que se añade sobre el motor (va después de motor.js): mejoras, enemigos, jefes, fondo al ritmo, etc. carga.js va el último.
//  Cada sección empieza con una marca  // ########## [archivo.js] ##########  (búscala con Ctrl+F).
//  Secciones, en orden de ejecución (NO cambiar el orden: unas envuelven funciones de otras):
//    · [extras.js]  mejoras, modificadores, enemigos/armas/objetos, fases de jefe, mando, tutorial, logros
//    · [mejoras.js]  navegación de enemigos, sangre, francotirador, graze, láser del jefe
//    · [mejoras2.js]  élites, arco voltaico, orbes del jefe, sonido panoramizado
//    · [mejoras3.js]  enemigo ESCUDERO, separación entre enemigos
//    · [mejoras4.js]  multikill, sangre neón, jefe abatido
//    · [mejoras5.js]  jefe NULL SIGNAL
//    · [mejoras6.js]  fondo al ritmo (analizador de música)
//    · [mejoras7.js]  en ritmo, sobrecarga, críticos, detonación
//    · [mejoras8.js]  rango y estadísticas del fin de partida, halo del jefe
//    · [carga.js]  pantalla de carga / precarga
// =====================================================================

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
        e.maxHp = e.hp = 2 * hp * 0.9; e.dmg = 20; e.state = 'chase'; e.st = 0; e.cd = 1 + Math.random(); e.ang = 0; e.dir = 0;
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
    const r = this.radius, fr = LH.eFrame(this), id = (this.kind === 'kami' ? 'km' : 'sp') + (flash ? 'f' : 'n') + fr;
    const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => kindBody(c, this.kind, r, this.color, flash, fr));
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
        if (w >= 6) add(6, 1, 1.3, Math.min(5, Math.floor((w - 3) / 3)));
        if (w >= 7) add(7, 1, 1.5, Math.min(4, Math.floor((w - 4) / 3)));
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
        if (w === 2 || w % 3 === 0 || w % 5 === 0) this.upT = 1.0;
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

// ########## [mejoras.js] ##########
// =====================================================================
//  MEJORAS (v0.4) — va después de extras.js y antes de carga.js
//
//  NAVEGACIÓN     enemigos que rodean las paredes (mapa de rutas BFS) · tirador que busca línea de tiro
//  SENSACIÓN      sangre persistente en el suelo · fogonazos y casquillos · cámara lenta en la última baja · anuncios de combo
//  MECÁNICAS      rozar balas (graze) · francotirador · jefes con nombre y láser giratorio · reto diario con arenas fijas
//  COMODIDAD      cuenta atrás al reanudar · pantalla siempre encendida · reducir destellos · pausa al perder el foco
//
//  Todo cuelga de LH (definido en extras.js) y de GameEngine.prototype, igual que el resto de módulos.
// =====================================================================

// ---------------------------------------------------------------- NAVEGACIÓN: mapa de rutas hacia el jugador
// BFS sobre la cuadrícula de paredes, desde la celda del jugador. Se rehace solo cuando el jugador cambia de celda
// o hay una arena nueva. Cada enemigo mira cada ~0.12 s si ve al jugador; si no, sigue la ruta celda a celda,
// saltando al punto más lejano de la ruta que ve en línea recta (así no hace zigzag).
Object.assign(GameEngine.prototype, {
    flowGet() {
        const w = this.wallGrid, p = this.player; if (!w || !p) return null;
        const pc = clamp(Math.floor((p.x - w.ox) / CELL), 0, w.cols - 1), pr = clamp(Math.floor((p.y - w.oy) / CELL), 0, w.rows - 1);
        let f = this._flow;
        if (f && f.grid === w && f.pc === pc && f.pr === pr) return f;
        const { cols, rows, g } = w, N = cols * rows;
        if (!f || f.grid !== w) f = this._flow = { grid: w, d: new Int16Array(N), q: new Int16Array(N), pc, pr };
        const d = f.d, q = f.q; f.pc = pc; f.pr = pr; d.fill(-1);
        let sc = pc, sr = pr;
        if (g[sr][sc]) {                                       // el jugador roza una celda de pared: parte de la libre más cercana
            let best = 1e9;
            for (let r = Math.max(0, pr - 2); r <= Math.min(rows - 1, pr + 2); r++) for (let c = Math.max(0, pc - 2); c <= Math.min(cols - 1, pc + 2); c++)
                if (!g[r][c]) { const k = (r - pr) * (r - pr) + (c - pc) * (c - pc); if (k < best) { best = k; sc = c; sr = r; } }
            if (best === 1e9) return (f.ok = false, f);
        }
        let h = 0, t = 0; q[t++] = sr * cols + sc; d[sr * cols + sc] = 0;
        while (h < t) {
            const i = q[h++], c = i % cols, r = (i / cols) | 0, nd = d[i] + 1;
            if (c > 0 && !g[r][c - 1] && d[i - 1] < 0) { d[i - 1] = nd; q[t++] = i - 1; }
            if (c < cols - 1 && !g[r][c + 1] && d[i + 1] < 0) { d[i + 1] = nd; q[t++] = i + 1; }
            if (r > 0 && !g[r - 1][c] && d[i - cols] < 0) { d[i - cols] = nd; q[t++] = i - cols; }
            if (r < rows - 1 && !g[r + 1][c] && d[i + cols] < 0) { d[i + cols] = nd; q[t++] = i + cols; }
        }
        f.ok = true; return f;
    },
    // ¿hay línea libre entre dos puntos para un cuerpo de ese radio? (3 rayos: centro y los dos bordes)
    clearLine(x1, y1, x2, y2, rad) {
        if (this.wallHit(x1, y1, x2, y2)) return false;
        if (!rad) return true;
        const dx = x2 - x1, dy = y2 - y1, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l * rad * 0.8, ny = dx / l * rad * 0.8;
        return !this.wallHit(x1 + nx, y1 + ny, x2 + nx, y2 + ny) && !this.wallHit(x1 - nx, y1 - ny, x2 - nx, y2 - ny);
    },
    hasLOS(e) {                                              // ¿ve este enemigo al jugador? (se reevalúa cada ~0.12 s)
        const p = this.player; if (!p) return true;
        if (!(e._ln > this.time - 0.001) || e._ln - this.time > 1) {
            e._ln = this.time + 0.1 + Math.random() * 0.05;
            e._los = this.clearLine(e.x, e.y, p.x, p.y, Math.min(e.radius, 20));
        }
        return e._los;
    },
    // Devuelve el ángulo hacia el que debe caminar el enemigo: directo si ve al jugador, o hacia la ruta si hay paredes.
    steer(e, ang) {
        const w = this.wallGrid;
        if (!w || !this.obstacles.length || e.boss) return ang;
        if (this.hasLOS(e)) { e._wp = false; return ang; }
        const p = this.player;
        if (!(e._sn > this.time - 0.001) || e._sn - this.time > 1) {
            e._sn = this.time + 0.1 + Math.random() * 0.05;
            e._wp = false;
            const f = this.flowGet();
            if (f && f.ok) {
                const { cols, rows, g } = w, d = f.d;
                let c = Math.floor((e.x - w.ox) / CELL), r = Math.floor((e.y - w.oy) / CELL);
                if (c >= 0 && r >= 0 && c < cols && r < rows && d[r * cols + c] > 0) {
                    const rad = Math.min(e.radius, 22);
                    for (let k = 0; k < 6; k++) {                 // sigue la ruta hasta 6 celdas, quedándose con el punto más lejano que ve
                        let bc = c, br = r, bd = d[r * cols + c];
                        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                            if (!dc && !dr) continue;
                            const nc = c + dc, nr = r + dr;
                            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || g[nr][nc]) continue;
                            if (dc && dr && (g[r][nc] || g[nr][c])) continue;      // sin cortar esquinas
                            const nd = d[nr * cols + nc];
                            if (nd >= 0 && nd < bd) { bd = nd; bc = nc; br = nr; }
                        }
                        if (bc === c && br === r) break;
                        c = bc; r = br;
                        const tx = w.ox + (c + 0.5) * CELL, ty = w.oy + (r + 0.5) * CELL;
                        if (k > 0 && !this.clearLine(e.x, e.y, tx, ty, rad)) break;
                        e._wx = tx; e._wy = ty; e._wp = true;
                        if (d[r * cols + c] === 0) break;
                    }
                }
            }
        }
        return e._wp ? Math.atan2(e._wy - e.y, e._wx - e.x) : ang;
    }
});

// ---------------------------------------------------------------- SONIDOS NUEVOS (mismo estilo oscuro: mi frigio, tritono, saturación)
Object.assign(AudioEngine.prototype, {
    playGraze() {                                             // roce de bala: chasquido agudo y seco
        if (!this.isPlaying) return;
        const c = this.ctx, t = c.currentTime;
        if (t - (this._lastGraze || 0) < 0.06 || !this._sfxVoice(0.08)) return;
        this._lastGraze = t;
        this._sfxBand(t, 0.04, 'bandpass', 3400, 7000, 3, 0.32, 0.0005, 0.03, 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(1, 2)), sfxMidi(sfxNote(1, 2)) * 1.5, 0.04, 0.12, 14), 0.05);
    },
    playAnnounce(tier = 0) {                                  // anuncio de combo: golpe grave + cluster en tritono que sube con el nivel
        if (!this.isPlaying || !this._sfxVoice(0.7, true)) return;
        const c = this.ctx, t = c.currentTime, base = sfxNote(0, 1) + Math.min(tier, 4);
        this._sfxOut(sfxDarkBass(c, t, 36, 0.5, 0.9, 20), 0.1, 0.3);
        this._sfxOut(sfxStab(c, t, sfxMidi(base), sfxMidi(base + 12), 0.22, 0.3, 18), 0.1, 0.2);
        this._sfxOut(sfxStab(c, t + 0.06, sfxMidi(base + SFX_TRITONE), sfxMidi(base + SFX_TRITONE + 12), 0.2, 0.22, 18), 0.1, 0.2);
    },
    playRewind() {                                            // cámara lenta: barrido que cae y sub
        if (!this.isPlaying || !this._sfxVoice(0.9, true)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxBand(t, 0.8, 'bandpass', 3200, 110, 1.4, 0.5, 0.02, 0.75, 0.1, 0.4);
        this._sfxOut(sfxDarkBass(c, t, 28, 0.8, 0.8, 18), 0.1, 0.3);
    },
    playSnipe(kind) {                                         // francotirador: carga que sube y disparo seco
        if (!this.isPlaying) return;
        const c = this.ctx, t = c.currentTime;
        if (kind === 'charge') {
            if (!this._sfxVoice(1.2)) return;
            this._sfxBand(t, 1.2, 'bandpass', 500, 4200, 5, 0.16, 0.05, 1.1, 0.1);
            return;
        }
        if (!this._sfxVoice(0.5, true)) return;
        this._sfxBand(t, 0.03, 'highpass', 2500, null, 0.7, 0.9, 0.0005, 0.02, 0.05, 0.2);
        this._sfxOut(sfxDarkBass(c, t, 38, 0.3, 1.0, 22), 0.1, 0.3);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 3)), sfxMidi(sfxNote(0, 1)), 0.18, 0.4, 18), 0.1, 0.2);
    },
    playSweep() {                                             // láser giratorio del jefe: zumbido grave en tritono
        if (!this.isPlaying || !this._sfxVoice(1.8, true)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxDarkBass(c, t, 34, 1.7, 0.7, 22), 0.1, 0.4);
        this._sfxOut(sfxFMMetal(c, sfxMidi(SFX_ROOT - 12 + SFX_TRITONE), 2.5, t, 1.4, 0.1), 0.1, 0.3);
    },
    playTickCount(last) {                                     // cuenta atrás al reanudar
        if (!this.ctx || this.ctx.state !== 'running') return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(last ? 0 : 1, 1)) * (last ? 2 : 1), sfxMidi(sfxNote(last ? 0 : 1, 1)), 0.09, 0.28, 14), 0.05);
    }
});

// ---------------------------------------------------------------- SANGRE PERSISTENTE (decals)
// Las gotas y los cuerpos dejan manchas que se quedan en el suelo toda la oleada (pintadas una vez en un lienzo, coste casi cero).
// Al empezar la oleada siguiente se desvanecen.
LH.dec = { cv: null, c: null, k: 0, n: 0 };
Object.assign(GameEngine.prototype, {
    decalCtx() {
        if (Settings.perf) return null;
        const D = LH.dec;
        if (!D.cv) { D.cv = document.createElement('canvas'); D.c = D.cv.getContext('2d'); }
        if (D.cv.width !== canvas.width || D.cv.height !== canvas.height) { D.cv.width = canvas.width; D.cv.height = canvas.height; D.n = 0; }
        D.c.setTransform(renderK, 0, 0, renderK, 0, 0);
        return D.c;
    },
    addDecal(x, y, r, color) {
        const c = this.decalCtx(); if (!c) return;
        c.globalAlpha = 0.18 + Math.random() * 0.2; c.fillStyle = color;
        if (r < 2.2) c.fillRect(x - r, y - r, r * 2, r * 2); else { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
        LH.dec.n++;
    },
    splat(en, fx, fy) {                                       // charco grande donde cae un enemigo + salpicaduras en la dirección del golpe
        const c = this.decalCtx(); if (!c) return;
        const R = en.radius * (en.boss ? 1.2 : 0.95), m = Math.max(Math.hypot(fx, fy), 1), dx = fx / m, dy = fy / m;
        c.fillStyle = en.color; c.globalAlpha = 0.3;
        c.beginPath(); c.arc(en.x, en.y, R, 0, TAU); c.fill();
        const n = en.boss ? 26 : en.radius > 20 ? 14 : 7;
        for (let i = 0; i < n; i++) {
            const d = R * (0.6 + Math.random() * 2.4), a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2.2, r = (0.25 + Math.random() * 0.6) * R * (1 - d / (R * 4));
            c.globalAlpha = 0.18 + Math.random() * 0.2;
            c.beginPath(); c.arc(en.x + Math.cos(a) * d, en.y + Math.sin(a) * d, Math.max(1.5, r), 0, TAU); c.fill();
        }
        LH.dec.n += n + 1;
    },
    clearDecals(fade) {
        if (fade && LH.dec.n > 0) { this._decFade = 1.2; return; }
        this._decFade = 0; if (LH.dec.c) LH.dec.c.clearRect(-1e4, -1e4, 2e4, 2e4); LH.dec.n = 0;
    },
    drawStains(ctx) {
        const D = LH.dec; if (Settings.perf || !D.cv || !D.n) return;
        let a = 0.8;
        if (this._decFade > 0) a *= this._decFade / 1.2;
        ctx.save(); ctx.globalAlpha = a; ctx.drawImage(D.cv, 0, 0, width, height); ctx.restore();
    }
});
{
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead) this.splat(en, fx, fy);
    };
    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this.clearDecals(false); this.slowmo = 0; this.cdT = 0; LH.hideCount && LH.hideCount(); };
    const _m_resc = GameEngine.prototype.rescaleWorld;
    GameEngine.prototype.rescaleWorld = function (ow, oh) { _m_resc.call(this, ow, oh); this.clearDecals(false); };
}

// ---------------------------------------------------------------- FOGONAZOS Y CASQUILLOS
{
    const _m_shoot = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        const w = this.weapon;
        _m_shoot.call(this);
        if (w.type === 'melee' || Settings.perf) return;
        const e = engine;
        this.flashT = e.time + 0.06; this.flashC = w.color;
        const n = w.name === 'SHOTGUN' ? 2 : (w.type === 'laser' || w.type === 'rocket' || w.type === 'rail') ? 0 : 1;
        for (let i = 0; i < n && e.particles.length < 500; i++) {   // casquillo: sale de lado y rebota
            const a = this.angle + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.7), sp = 130 + Math.random() * 130;
            e.particles.push(new Particle(this.x + Math.cos(this.angle) * 6, this.y + Math.sin(this.angle) * 6, '#ffd27a', 0, Math.cos(a) * sp + this.vx * 0.3, Math.sin(a) * sp + this.vy * 0.3, 1));
        }
    };
    const _m_draw = Player.prototype.draw;
    Player.prototype.draw = function (ctx) {
        _m_draw.call(this, ctx);
        const k = (this.flashT || 0) - engine.time;
        if (k > 0 && !Settings.perf) {
            const f = Math.min(1, k / 0.06), r = this.radius;
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = this.flashC || C.yellow; ctx.globalAlpha = 0.85 * f;
            ctx.beginPath(); ctx.moveTo(r, -5 * f); ctx.lineTo(r + 14 + 30 * f, 0); ctx.lineTo(r, 5 * f); ctx.closePath(); ctx.fill();
            ctx.fillStyle = C.white; ctx.globalAlpha = f; ctx.beginPath(); ctx.arc(r + 5, 0, 5 + 3 * f, 0, TAU); ctx.fill();
            ctx.restore();
        }
    };
}

// ---------------------------------------------------------------- CÁMARA LENTA, ANUNCIOS Y BONIFICACIONES
LH.announce = (text, color, yk = 0.15, fs = 34) => {
    const e = engine; e.spawnText(width / 2, height * yk, text, color);
    const p = e.particles[e.particles.length - 1];
    p.fs = Math.min(fs * textBoost(), width * 0.9 / (text.length * 0.8)); p.life = 1.7; p.vx = 0; p.vy = -10;
};
LH.bonus = (e, pts, x, y, label, color) => {                  // puntos extra que NO cuentan como baja (no tocan el combo)
    pts = Math.round(pts * (e.scoreMult || 1));
    e.score += pts;
    if (e.score > bestScore) { bestScore = e.score; e._bestDirty = true; setText(DOM.highScore, `HI: ${bestScore.toString().padStart(6, '0')}`); }
    e.updateUI();
    if (x !== undefined) e.spawnText(x, y, (label || '') + '+' + pts, color || C.cyan);
};
LH.COMBO_CALLS = { 10: ['¡CARNICERÍA!', C.yellow], 20: ['¡MASACRE!', C.pink], 35: ['¡NEÓN FURIOSO!', C.cyan], 50: ['¡IMPARABLE!', C.red], 75: ['¡LEYENDA VIVA!', C.green], 100: ['¡APOCALIPSIS!', C.white] };
{
    const _m_add = GameEngine.prototype.addScore;
    GameEngine.prototype.addScore = function (amount, x, y) {
        const r = _m_add.call(this, amount, x, y), call = LH.COMBO_CALLS[this.combo];
        if (call && this.state === 'PLAYING') {
            LH.announce(call[0], call[1]); this.addShake(18);
            audio.playAnnounce(Object.keys(LH.COMBO_CALLS).indexOf(String(this.combo)));
        }
        return r;
    };
    const _m_upd = GameEngine.prototype.update;
    GameEngine.prototype.update = function (dt) {
        if (this._decFade > 0 && (this._decFade -= dt) <= 0) this.clearDecals(false);   // la sangre de la oleada anterior se desvanece
        if (this.state === 'COUNT') {                          // cuenta atrás tras reanudar: el mundo se queda quieto
            this.cdT -= dt; LH.showCount(this.cdT);
            if (this.cdT <= 0) { this.state = 'PLAYING'; LH.hideCount(); }
            return _m_upd.call(this, dt);
        }
        if (this.slowmo > 0 && this.state === 'PLAYING') { this.slowmo -= dt; dt *= 0.3; }
        return _m_upd.call(this, dt);
    };
    const _m_spawn = GameEngine.prototype.spawnLogic;
    GameEngine.prototype.spawnLogic = function (dt) {
        const was = this.waveState;
        _m_spawn.call(this, dt);
        if (was === 'FIGHT' && this.waveState === 'BREAK') {   // ¡oleada superada!
            const w = this.wave, boss = w % 5 === 0;
            this.slowmo = boss ? 1.4 : 0.8; audio.playRewind();
            if (this.hitWave !== w && w >= 2) {                // oleada sin recibir daño
                LH.bonus(this, 250 * w, this.player.x, this.player.y - 56, 'SIN DAÑO ', C.green);
                LH.announce('SIN DAÑO', C.green, 0.25, 24);
            }
        }
    };
    const _m_wave = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        this.clearDecals(true);
        _m_wave.call(this);
        const w = this.wave, q = this.queue;
        // francotiradores: desde la oleada 4 (no en las de jefe)
        if (w >= 8 && w % 5 !== 0) {
            const n = Math.min(3, Math.floor((w - 5) / 3));
            for (let i = 0; i < n; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, { t: 8, n: 1, d: 1.4 });
            audio.music.call('setWaveSize', q.reduce((a, x) => a + x.n, 0));
        }
        if (w % 5 === 0) { const nm = LH.bossName(w); LH.announce(nm[0], nm[1], 0.46, 26); }
    };
}

// ---------------------------------------------------------------- JEFES CON NOMBRE (cada uno con su color)
LH.BOSSES = [['NEON WARDEN', '#ff007f'], ['SYNTH REAPER', '#ffb300'], ['CHROME HYDRA', '#7dff00'], ['VOID CANTOR', '#b537f2']];
LH.bossName = (w) => LH.BOSSES[(Math.max(1, Math.floor(w / 5)) - 1) % LH.BOSSES.length];

// ---------------------------------------------------------------- ROZAR BALAS (graze)
// Una bala enemiga que pasa a un dedo de ti sin tocarte da puntos, alarga el combo y recarga un poco el pulso.
LH.ACH.push({ id: 'graze', name: 'ROZADURA', desc: 'Roza 100 balas enemigas', prog: () => [LH.prog.graze || 0, 100] });
LH.ACH.push({ id: 'snipe', name: 'CONTRA EL FRANCOTIRADOR', desc: 'Derrota a 10 francotiradores', prog: () => [LH.prog.snipe || 0, 10] });
LH.onGraze = (e, b) => {
    if (e.time - (LH._gT || -9) < 0.12) return;               // un anillo de balas no debe dar 28 premios a la vez
    LH._gT = e.time;
    LH.prog.graze = (LH.prog.graze || 0) + 1; if (LH.prog.graze >= 100) LH.unlock('graze');
    LH.bonus(e, 15, b.x, b.y - 12, '', '#7df9ff');
    const p = e.player;
    p.pulseCooldown = Math.max(0, p.pulseCooldown - 0.25);
    if (e.combo > 0) e.comboTimer = Math.max(e.comboTimer, 1.6);
    e.spawnParticle(b.x, b.y, '#7df9ff', 3, 0, 0, 120);
    audio.playGraze();
};
LH.grazeTick = (e) => {
    const p = e.player; if (p.iframes > 0 || p.hp <= 0) return;
    const R = p.radius + 18, B = e.bullets;
    for (let i = 0; i < B.length; i++) {
        const b = B[i]; if (!b.isEnemy || b._gz) continue;
        const d = dist(b.x, b.y, p.x, p.y); if (d > R + 40) continue;
        if (b._gd === undefined || d < b._gd) b._gd = d;
        else if (d > b._gd + 1.5 && b._gd < R && b._gd > p.radius + b.radius) { b._gz = 1; LH.onGraze(e, b); }   // ya pasó de largo
    }
};

// ---------------------------------------------------------------- FRANCOTIRADOR (enemigo nuevo, tipo 8)
// Se coloca donde te ve, apunta con una línea roja que se vuelve blanca al fijarse y dispara una bala rapidísima.
// Las paredes lo bloquean: úsalas de cobertura. El pulso y la katana desvían la bala.
const SNIPE_COL = '#ffffff';
{
    const _m_make = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        if (t === 8) {
            const e = new Enemy(0, x, y, hp); e.kind = 'sniper'; e.radius = 17; e.color = SNIPE_COL; e.speed = 120;
            e.maxHp = e.hp = 3 * hp; e.dmg = 15; e.state = 'seek'; e.st = 0; e.cd = 1.2 + Math.random(); e.ang = 0; e.side = Math.random() < 0.5 ? 1 : -1;
            if (engine && engine.mut && engine.mut.frenzy) e.speed *= 1.25;
            return e;
        }
        const e = _m_make(t, x, y, hp);
        if (t === 5) {                                            // jefe: nombre, color y nivel según la oleada
            const w = engine.wave, nm = LH.bossName(w);
            e.bossName = nm[0]; e.color = nm[1]; e.tier = Math.max(1, Math.floor(w / 5));
        }
        return e;
    };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    LH.sniperAI = (e, dt, px, py) => {
        LH.sniperAI0(e, dt, px, py);
        // una vez dentro, nunca sale de la arena (antes podía huir fuera de pantalla y la oleada no terminaba)
        const r = e.radius;
        if (e.x > r && e.y > r && e.x < width - r && e.y < height - r) e._in = true;
        if (e._in) { e.x = clamp(e.x, r, width - r); e.y = clamp(e.y, r, height - r); }
    };
    LH.sniperAI0 = (e, dt, px, py) => {
        e.knockback.x *= 0.85; e.knockback.y *= 0.85;
        const G = engine, d = dist(e.x, e.y, px, py), a = Math.atan2(py - e.y, px - e.x), los = G.hasLOS(e);
        e.st += dt;
        if (!e._in) { LH.moveE(e, dt, a, e.speed * 1.4); e.ang = a; return; }   // aún fuera de la arena: entra primero
        if (e.state === 'seek') {
            e.cd -= dt; e.ang = a;
            if (!los || d > 560) LH.moveE(e, dt, G.steer(e, a), e.speed);
            else if (d < 250) {                                   // retrocede, pero sin salirse de la arena (si está en un borde, rodea)
                const m = 70, edge = e.x < m || e.y < m || e.x > width - m || e.y > height - m;
                LH.moveE(e, dt, edge ? a + e.side * Math.PI / 2 : a + Math.PI, e.speed * 0.9);
            }
            else LH.moveE(e, dt, a + e.side * Math.PI / 2, e.speed * 0.35);
            if (los && d < 660 && e.cd <= 0) { e.state = 'aim'; e.st = 0; LH.panned(e.x, () => audio.playSnipe('charge')); }
        } else if (e.state === 'aim') {
            if (!los && e.st < 0.85) { e.state = 'seek'; e.cd = 0.8; return; }   // lo perdiste de vista (te tapó una pared)
            if (e.st < 0.85) e.ang += clamp(wrap(a - e.ang), -dt * 3.2, dt * 3.2);  // sigue al jugador y a los 0.85 s fija el tiro
            LH.moveE(e, dt, a, 0);
            if (e.st >= 1.25) {
                const c = Math.cos(e.ang), s = Math.sin(e.ang);
                G.bullets.push(new Bullet(e.x + c * e.radius, e.y + s * e.radius, e.ang, { speed: 1300, color: SNIPE_COL, damage: 22, name: 'ENEMY_GUN' }, true));
                e.knockback.x = -c * 260; e.knockback.y = -s * 260;
                G.spawnParticle(e.x + c * e.radius, e.y + s * e.radius, C.white, 8, c * 100, s * 100, 220);
                G.addShake(7); LH.panned(e.x, () => audio.playSnipe('fire')); e.state = 'recover'; e.st = 0;
            }
        } else {
            e.ang = a; LH.moveE(e, dt, a + e.side * Math.PI / 2, e.speed * 0.3);
            if (e.st >= 0.7) { e.state = 'seek'; e.cd = 1.8 + Math.random() * 1.2; }
        }
    };
    const _m_eUpd = Enemy.prototype.update;
    Enemy.prototype.update = function (dt, px, py) {
        if (this.kind === 'sniper') return LH.sniperAI(this, dt, px, py);
        return _m_eUpd.call(this, dt, px, py);
    };
    LH.rayEnd = (x, y, a, max) => {                              // hasta dónde llega una línea antes de chocar con una pared o salir de la arena
        const c = Math.cos(a), s = Math.sin(a), e = engine;
        for (let d = 10; d < max; d += 10) {
            const X = x + c * d, Y = y + s * d;
            if (X < 0 || Y < 0 || X > width || Y > height || e.wallAt(X, Y)) return d;
        }
        return max;
    };
    const _m_eDraw = Enemy.prototype.draw;
    Enemy.prototype.draw = function (ctx) {
        if (this.kind !== 'sniper') return _m_eDraw.call(this, ctx);
        const r = this.radius, flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50, fr = LH.eFrame(this), id = (flash ? 'snf' : 'snn') + fr;
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => LH.sniperBody(c, r, flash, fr));
        if (this.state === 'aim') {                                // línea de puntería: roja mientras sigue, blanca y fija al bloquear
            const L = LH.rayEnd(this.x, this.y, this.ang, 1800), locked = this.st >= 0.85, k = Math.min(1, this.st / 0.85);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(this.x + Math.cos(this.ang) * r, this.y + Math.sin(this.ang) * r); ctx.lineTo(this.x + Math.cos(this.ang) * L, this.y + Math.sin(this.ang) * L);
            if (locked) {
                const f = 0.6 + 0.4 * Math.sin(engine.time * 60);
                ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 3; ctx.stroke();
                ctx.strokeStyle = 'rgba(255,45,85,0.35)'; ctx.lineWidth = 10; ctx.stroke();
            } else { ctx.strokeStyle = `rgba(255,45,85,${0.25 + 0.5 * k})`; ctx.lineWidth = 1.5 + 1.5 * k; ctx.stroke(); }
            ctx.restore();
        }
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang || 0);
        ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
        ctx.restore();
        ctx.fillStyle = C.red; ctx.fillRect(this.x - r, this.y - r - 12, r * 2 * Math.max(0, this.hp / this.maxHp), 4);
    };
    const _m_warm = warmSprites;
    warmSprites = function () {
        _m_warm();
        try { const sc = document.createElement('canvas').getContext('2d'); for (const f of [0, 1]) { const e = makeEnemy(8, 0, 0, 1); if (f) e.knockback.x = 99; e.draw(sc); } } catch (e) {}
    };
    const _m_hit2 = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit2.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead && en.kind === 'sniper') {
            LH.bonus(this, 150, en.x, en.y - 24, '', '#ffffff');
            LH.prog.snipe = (LH.prog.snipe || 0) + 1; if (LH.prog.snipe >= 10) LH.unlock('snipe');
        }
    };
}

// ---------------------------------------------------------------- JEFES: LÁSER GIRATORIO (desde el 2.º jefe, fase 2+)
LH.sweepTick = (e, dt) => {
    const b = e.bossRef, p = e.player;
    if (!b || b.dead || !(b.tier >= 2) || !(b.phase >= 2)) { if (b && b.sw) b.sw = null; return; }
    if (!b.sw) {
        b.swCd = (b.swCd === undefined ? 4 : b.swCd) - dt;
        if (b.swCd <= 0 && !(b.recover > 0) && !(b.telegraph > 0) && !(b.rush > 0)) {
            b.sw = { a0: Math.atan2(p.y - b.y, p.x - b.x), dir: Math.random() < 0.5 ? 1 : -1, t: 0, warn: 1.0, dur: 2.1, rate: 1.2, n: b.tier >= 3 ? 2 : 1, hit: 0, cur: [] };
            e.addShake(10); audio.playSweep();
        }
        return;
    }
    const S = b.sw; S.t += dt;
    const a = S.a0 + (S.t > S.warn ? S.dir * S.rate * (S.t - S.warn) : 0);
    S.cur.length = 0;
    for (let k = 0; k < S.n; k++) { const ang = a + k * Math.PI; S.cur.push({ a: ang, L: LH.rayEnd(b.x, b.y, ang, 2200) }); }
    if (S.t > S.warn && p.iframes <= 0 && e.state === 'PLAYING') {
        for (const bm of S.cur) {
            if (segDist(p.x, p.y, b.x, b.y, b.x + Math.cos(bm.a) * bm.L, b.y + Math.sin(bm.a) * bm.L) < p.radius + 7) {
                p.hp -= 22; p.iframes = 0.6; e.addShake(24); haptic(150); e.glitch();
                e.spawnParticle(p.x, p.y, C.red, 26, 0, 0, 500, 'blood');
                if (p.hp <= 0) { e.gameOver(); return; }
                break;
            }
        }
    }
    if (S.t >= S.warn + S.dur) { b.sw = null; b.swCd = 6.5 + Math.random() * 2.5; }
};
{
    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        const b = this.bossRef, S = b && !b.dead && b.sw;
        if (!S || !S.cur.length) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const bm of S.cur) {
            const x2 = b.x + Math.cos(bm.a) * bm.L, y2 = b.y + Math.sin(bm.a) * bm.L;
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2);
            if (S.t < S.warn) {                                    // aviso: línea fina punteada que parpadea
                ctx.setLineDash([16, 10]); ctx.strokeStyle = `rgba(255,45,111,${0.35 + 0.4 * Math.sin(S.t * 30) ** 2})`; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
            } else {
                const f = 0.85 + 0.15 * Math.sin(this.time * 70);
                ctx.strokeStyle = `rgba(255,0,90,${0.22 * f})`; ctx.lineWidth = 38; ctx.stroke();
                ctx.strokeStyle = `rgba(255,60,120,${0.8 * f})`; ctx.lineWidth = 14; ctx.stroke();
                ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 4; ctx.stroke();
            }
        }
        ctx.restore();
    };
}

// ---------------------------------------------------------------- HUD: barra de combo, enemigos restantes, nombre del jefe
LH.hudT = 0;
LH.tick2 = (e, dt) => {
    if (e.state !== 'PLAYING' || e.hitStop > 0) return;
    LH.grazeTick(e); LH.sweepTick(e, dt);
    // barra de tiempo del combo (la pone el CSS con --ct)
    const ct = e.combo > 1 ? Math.round(clamp(e.comboTimer / e.maxComboTimer, 0, 1) * 25) / 25 : 0;
    if (DOM.combo._ct !== ct) { DOM.combo._ct = ct; DOM.combo.style.setProperty('--ct', ct); DOM.combo.classList.toggle('hot', ct < 0.3 && ct > 0); }
    LH.hudT -= dt;
    if (LH.hudT <= 0) {
        LH.hudT = 0.2;
        const left = e.queue.reduce((a, q) => a + q.n, 0) + e.enemies.filter(x => !x.dead).length;
        const h = e.waveState === 'BREAK' ? `WAVE ${e.wave}<small>DESPEJADO</small>` : `WAVE ${e.wave}<small>${left} RESTANTES</small>`;
        if (UI2.wave._h !== h) { UI2.wave._h = h; UI2.wave.innerHTML = h; }
        const bb = e.bossRef, nm = bb && !bb.dead && bb.bossName ? '// ' + bb.bossName + ' //' : '// BOSS //';
        if (UI2.bossBar.firstChild && UI2.bossBar._nm !== nm) { UI2.bossBar._nm = nm; UI2.bossBar.firstChild.nodeValue = nm; }
    }
};
{
    const _m_post = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) { _m_post.call(this, dt); LH.tick2(this, dt); };
}

// ---------------------------------------------------------------- RETO DIARIO: arenas con semilla del día (misma arena para todos)
LH.hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
{
    const _m_layout = GameEngine.prototype.layout;
    GameEngine.prototype.layout = function (boss, avoid, seed, wv) {
        if (seed == null && LH.dailyRun) seed = LH.hashStr(LH.dayKey() + ':arena:' + (wv ?? (this.wave + 1))) & 0x7fffffff;
        return _m_layout.call(this, boss, avoid, seed, wv);
    };
}

// ---------------------------------------------------------------- COMODIDAD
// Cuenta atrás al reanudar: 3-2-1 con el mundo quieto (en el móvil, soltar el dedo del botón de pausa y volver a agarrar los joysticks)
LH.countEl = null;
LH.showCount = (t) => {
    const el = LH.countEl || (LH.countEl = document.getElementById('countdown')); if (!el) return;
    const n = Math.max(1, Math.ceil(t / 0.5));
    if (el._n !== n) {
        el._n = n; el.classList.remove('hidden'); el.innerHTML = '<span>' + n + '</span>';
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        audio.playTickCount(n === 1);
    }
};
LH.hideCount = () => { const el = LH.countEl || (LH.countEl = document.getElementById('countdown')); if (el) { el._n = 0; el.classList.add('hidden'); } };
{
    const _m_resume = GameEngine.prototype.resume;
    GameEngine.prototype.resume = function () {
        if (this.state !== 'PAUSED') return _m_resume.call(this);
        audio.resume(); Menu.close();
        Input.keys = { w: false, a: false, s: false, d: false }; Input.mouse.active = false;
        this.state = 'COUNT'; this.cdT = 1.5; this.needsDraw = true;
        LH.showCount(this.cdT);
    };
    const _m_toMenu = GameEngine.prototype.toMenu;
    GameEngine.prototype.toMenu = function () { LH.hideCount(); return _m_toMenu.call(this); };
    const _m_pause = GameEngine.prototype.pause;
    GameEngine.prototype.pause = function () { if (this.state === 'COUNT') LH.hideCount(); return _m_pause.call(this); };
}

// Pantalla siempre encendida mientras se juega (móvil/tablet)
LH.wake = {
    lock: null,
    async on() {
        try {
            if (!navigator.wakeLock || this.lock || document.visibilityState !== 'visible') return;
            const l = await navigator.wakeLock.request('screen'); this.lock = l;
            l.addEventListener('release', () => { if (this.lock === l) this.lock = null; });
        } catch (e) {}
    },
    off() { try { if (this.lock) this.lock.release(); } catch (e) {} this.lock = null; }
};
setInterval(() => { const s = engine && engine.state; (s === 'PLAYING' || s === 'COUNT' || s === 'UPGRADE') ? LH.wake.on() : LH.wake.off(); }, 1000);

// Reducir destellos (accesibilidad): sin parpadeo CRT, sin cortes de color, sacudidas más suaves y sin el efecto de doble imagen
if (Settings.calm === undefined) Settings.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
{
    const _m_apply = applySettings;
    applySettings = function () { _m_apply(); document.body.classList.toggle('calm', !!Settings.calm); };
    const _m_glitch = GameEngine.prototype.glitch;
    GameEngine.prototype.glitch = function () { if (!Settings.calm) _m_glitch.call(this); };
    const _m_shake = GameEngine.prototype.addShake;
    GameEngine.prototype.addShake = function (a) { return _m_shake.call(this, Settings.calm ? a * 0.4 : a); };
}

// Pausa automática si la ventana pierde el foco (alt-tab, notificaciones, llamada...)
window.addEventListener('blur', () => { if (engine && engine.state === 'PLAYING') engine.pause(); });

// ########## [mejoras2.js] ##########
// =====================================================================
//  MEJORAS v0.5 — va después de mejoras.js y antes de carga.js
//
//  JUGABILIDAD   enemigos ÉLITE · arma nueva ARCO VOLTAICO (rayo en cadena) · mejoras RICOCHET y ADRENALINA
//                jefes de nivel 3+ con orbes orbitales · marcas en los últimos enemigos de la oleada
//  DISEÑO        esquirlas de cristal al morir · la cuadrícula del fondo late con las bajas
//  SONIDO        sonido panoramizado (de dónde vienen los disparos y las bajas) · latido con poca vida
//                presentación del jefe · aviso de élite · "clic" sin munición · volumen de EFECTOS propio
// =====================================================================

const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- SONIDO: panorámica, volumen de efectos y sonidos nuevos
LH.pan = (x) => clamp((x - width / 2) / (width / 2), -1, 1) * 0.75;
LH.panned = (x, fn) => { audio._px = LH.pan(x); try { fn(); } finally { audio._px = null; } };
{
    // todo sonido que pase por _sfxOut puede salir por un lado concreto si audio._px está definido
    const _m_out = AudioEngine.prototype._sfxOut;
    AudioEngine.prototype._sfxOut = function (node, roomAmt, hallAmt) {
        if (this._px != null && this.ctx.createStereoPanner) { const pn = this.ctx.createStereoPanner(); pn.pan.value = this._px; node.connect(pn); node = pn; }
        return _m_out.call(this, node, roomAmt, hallAmt);
    };
    // volumen de EFECTOS independiente: los efectos pasan por su propio nodo de ganancia antes del volumen general
    const _m_init = AudioEngine.prototype._sfxInit;
    AudioEngine.prototype._sfxInit = function () {
        if (this._sfx) return this._sfx;
        if (!this.sfxGain) { this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = Settings.sfx; this.sfxGain.connect(this.master); }
        const m = this.master; this.master = this.sfxGain;
        try { return _m_init.call(this); } finally { this.master = m; }
    };
    if (Settings.sfx === undefined) Settings.sfx = 1;
    const _m_apply = applySettings;
    applySettings = function () { _m_apply(); if (audio.sfxGain) audio.sfxGain.gain.value = Settings.sfx; };
    const _m_sync = Menu.syncOptions;
    Menu.syncOptions = function () {
        _m_sync.call(this);
        const i = document.getElementById('sfxRange'); if (!i) return;
        i.value = Settings.sfx; this.fillSlider(i); document.getElementById('sfxVal').innerText = Math.round(Settings.sfx * 100) + '%';
    };
    document.getElementById('sfxRange').addEventListener('input', (e) => { Settings.sfx = parseFloat(e.target.value); applySettings(); });

    // disparos enemigos: salen por el lado de la pantalla donde está la bala
    const _m_shoot = AudioEngine.prototype.playShoot;
    AudioEngine.prototype.playShoot = function (w, isEnemy) {
        if (w === 'ARC') return this.playArc();
        if (isEnemy && typeof engine !== 'undefined' && engine) {
            const b = engine.bullets[engine.bullets.length - 1];
            if (b && b.isEnemy) { this._px = LH.pan(b.x); try { return _m_shoot.call(this, w, isEnemy); } finally { this._px = null; } }
        }
        return _m_shoot.call(this, w, isEnemy);
    };
    // bajas: el sonido sale por el lado donde murió el enemigo
    const _m_add = GameEngine.prototype.addScore;
    GameEngine.prototype.addScore = function (amount, x, y) {
        if (x != null) audio._px = LH.pan(x);
        try { this._gp = 0.08; return _m_add.call(this, amount, x, y); } finally { audio._px = null; }
    };
}
Object.assign(AudioEngine.prototype, {
    playArc() {                                               // arco voltaico: chisporroteo agudo y seco
        if (!this.isPlaying || !this._sfxVoice(0.12)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxBand(t, 0.06, 'bandpass', 3000, 7500, 2.5, 0.45, 0.0005, 0.05, 0.05);
        this._sfxBand(t + 0.03, 0.05, 'highpass', 4200, null, 1, 0.3, 0.0005, 0.04, 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(1, 3)), sfxMidi(sfxNote(1, 2)), 0.07, 0.22, 16), 0.05);
    },
    playHeartbeat(k = 1) {                                    // poca vida: dos latidos graves (más rápidos cuanto menos vida)
        if (!this.isPlaying || !this._sfxVoice(0.4)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxDarkBass(c, t, 28, 0.16, 0.55 * k, 16), 0.02);
        this._sfxOut(sfxDarkBass(c, t + 0.15, 30, 0.14, 0.4 * k, 16), 0.02);
    },
    playBossIntro() {                                         // llegada del jefe: golpe enorme y racimo en tritono
        if (!this.isPlaying || !this._sfxVoice(2.2, true)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxDarkBass(c, t, 24, 1.8, 1.0, 24), 0.15, 0.6);
        [0, SFX_TRITONE, 12, 12 + SFX_TRITONE].forEach((n, i) => this._sfxOut(sfxFMMetal(c, sfxMidi(SFX_ROOT - 24 + n), 2.2, t + i * 0.09, 1.2, 0.1), 0.15, 0.5));
        this._sfxBand(t, 1.2, 'bandpass', 150, 2600, 1.2, 0.35, 0.3, 0.9, 0.2, 0.5);
    },
    playElite() {                                             // élite: campana dorada y amenazante
        if (!this.isPlaying || !this._sfxVoice(0.5)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(3, 1)), 1.8, t, 0.4, 0.14), 0.2, 0.3);
        this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(3, 1) + SFX_TRITONE), 1.8, t + 0.08, 0.4, 0.1), 0.2, 0.3);
    },
    playEmpty() {                                             // sin munición: clic seco
        if (!this.isPlaying || !this._sfxVoice(0.1)) return;
        const t = this.ctx.currentTime;
        this._sfxBand(t, 0.02, 'bandpass', 1800, 900, 3, 0.45, 0.0005, 0.015, 0.02);
        this._sfxBand(t + 0.07, 0.02, 'bandpass', 1100, 600, 3, 0.3, 0.0005, 0.015, 0.02);
    }
});

// ---------------------------------------------------------------- ÉLITES
// Desde la oleada 3 algunos enemigos nacen "élite": aro dorado, 2× de vida y puntos extra; sueltan siempre un objeto.
LH.ACH.push({ id: 'elite', name: 'CAZAÉLITES', desc: 'Derrota a 10 élites', prog: () => [LH.prog.elite || 0, 10] });
LH.makeElite = (e) => {
    e.elite = true; e.maxHp *= 2; e.hp = e.maxHp; e.speed *= 1.05; e.dmg *= 1.15;
    if (engine.state === 'PLAYING') LH.panned(e.x, () => audio.playElite());
};
{
    const _m_make = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        const e = _m_make(t, x, y, hp);
        if (!e.boss && (t === 0 || t === 2 || t === 6 || t === 7 || t === 8) && engine && engine.waveState === 'FIGHT' && engine.wave >= 6
            && Math.random() < Math.min(0.08, 0.01 + engine.wave * 0.005)) LH.makeElite(e);
        return e;
    };
    const _m_draw = Enemy.prototype.draw;
    Enemy.prototype.draw = function (ctx) {
        _m_draw.call(this, ctx);
        if (!this.elite || this.dead) return;
        const t = engine.time, r = this.radius + 8 + Math.sin(t * 6) * 1.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(this.x, this.y);
        ctx.strokeStyle = `rgba(255,208,40,${0.55 + 0.25 * Math.sin(t * 8)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.rotate(t * 1.6); ctx.fillStyle = 'rgba(255,230,120,0.95)';
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(r - 2, -1.5, 6, 3); }
        ctx.restore();
    };
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead) {
            this.shatter(en, fx, fy);
            if (en.elite) {
                LH.bonus(this, 300, en.x, en.y - 26, 'ÉLITE ', '#ffd028');
                this.spawnParticle(en.x, en.y, '#ffd028', 40, 0, 0, 500);
                const k = DROP_POOL, kk = Math.random() < 0.3 ? LH.EXTRA_DROPS : k;
                this.pickups.push(new Pickup(en.x, en.y, kk[Math.floor(Math.random() * kk.length)]));
                LH.prog.elite = (LH.prog.elite || 0) + 1; if (LH.prog.elite >= 10) LH.unlock('elite');
            }
        }
    };
    // ¿quedan pocos? marca a los últimos enemigos para que no haya que buscarlos por detrás de las paredes
    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        if (this.state === 'PLAYING' && this.waveState === 'FIGHT' && !this.queue.length) {
            const left = this.enemies.filter(x => !x.dead);
            if (left.length && left.length <= 2) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2;
                const k = 0.5 + 0.5 * Math.sin(this.time * 7);
                for (const en of left) {
                    ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.4 * k})`;
                    ctx.beginPath(); ctx.arc(en.x, en.y, en.radius + 14 + k * 6, 0, TAU); ctx.stroke();
                }
                ctx.restore();
            }
        }
        LH.drawArcs(ctx, this); LH.drawShards(ctx, this); LH.drawOrbs(ctx, this);
    };
}

// ---------------------------------------------------------------- ARMA NUEVA: ARCO VOLTAICO (rayo en cadena)
// Apunta en su dirección (cono de ±30°): el rayo salta al enemigo más cercano que ve y de ahí a otros 3 (80% de daño cada salto).
WEAPONS.ARC = { name: 'ARC', fireRate: 0.2, color: '#9d8cff', damage: 1.3, type: 'arc', recoil: 2, g: 'A' };
DROP_POOL.push('ARC');
LH.jag = (pts, a, b) => {                                    // línea quebrada entre a y b
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), n = Math.max(2, Math.floor(d / 26)), nx = -dy / (d || 1), ny = dx / (d || 1);
    for (let i = 1; i < n; i++) { const o = (Math.random() - 0.5) * 22; pts.push({ x: a.x + dx * i / n + nx * o, y: a.y + dy * i / n + ny * o }); }
    pts.push({ x: b.x, y: b.y });
};
LH.fireArc = (p) => {
    if (p.ammo <= 0) { p.equip('PISTOL', Infinity); return; }
    const e = engine, w = p.weapon, c = Math.cos(p.angle), s = Math.sin(p.angle), dm = 1 + 0.2 * LH.lvl('dmg');
    let t = null, best = 1e9;
    for (const en of e.enemies) {
        if (en.dead) continue;
        const dx = en.x - p.x, dy = en.y - p.y, d = Math.hypot(dx, dy);
        if (d > 440 + en.radius) continue;
        const diff = Math.abs(wrapAng(Math.atan2(dy, dx) - p.angle));
        if (diff > 0.55 + Math.atan2(en.radius, d) || !e.clearLine(p.x, p.y, en.x, en.y, 0)) continue;
        const sc = diff * 300 + d; if (sc < best) { best = sc; t = en; }
    }
    const pts = [{ x: p.x + c * p.radius, y: p.y + s * p.radius }];
    if (!t) { const L = Math.min(230, LH.rayEnd(p.x, p.y, p.angle, 230)); LH.jag(pts, pts[0], { x: p.x + c * L, y: p.y + s * L }); }
    else {
        const hit = new Set(), chain = 3 + LH.lvl('pierce');
        let cur = t, last = pts[0], dmg = w.damage * dm;
        for (let k = 0; cur && k <= chain; k++) {
            hit.add(cur); LH.jag(pts, last, cur);
            e.hitEnemy(cur, dmg, (cur.x - last.x) * 2.5, (cur.y - last.y) * 2.5);
            e.spawnParticle(cur.x, cur.y, w.color, 5, 0, 0, 200);
            dmg *= 0.8; last = { x: cur.x, y: cur.y };
            let nx = null, nd = 170 + cur.radius;
            for (const en of e.enemies) {
                if (en.dead || hit.has(en)) continue;
                const d = dist(cur.x, cur.y, en.x, en.y);
                if (d < nd && e.clearLine(cur.x, cur.y, en.x, en.y, 0)) { nd = d; nx = en; }
            }
            cur = nx;
        }
    }
    e.arcs.push({ pts, life: 0.14 });
    p.ammo--; p.fireCooldown = w.fireRate; p.kx -= c * 25; p.ky -= s * 25;
    e.addShake(2.5); audio.playShoot('ARC'); haptic(10);
};
LH.drawArcs = (ctx, e) => {
    if (!e.arcs.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const a of e.arcs) {
        const k = Math.max(0, a.life / 0.14);
        ctx.beginPath(); ctx.moveTo(a.pts[0].x, a.pts[0].y); for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
        ctx.strokeStyle = `rgba(157,140,255,${k * 0.3})`; ctx.lineWidth = 16; ctx.stroke();
        ctx.strokeStyle = `rgba(157,140,255,${k})`; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.restore();
};
{
    const _m_shoot = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        const e = engine, n0 = e.bullets.length;
        if (this.weapon.type === 'arc') {
            LH.tut.shots++; LH.fireArc(this);
            this.fireCooldown *= Math.pow(0.85, LH.lvl('fire')); return;
        }
        _m_shoot.call(this);
        const bl = LH.lvl('bounce');
        if (bl) for (let i = n0; i < e.bullets.length; i++) if (!e.bullets[i].isEnemy) e.bullets[i].bounce = bl;
    };
    const _m_equip = Player.prototype.equip;
    Player.prototype.equip = function (key, amount) {
        const prev = this.weapon;
        if (key === 'ARC' && amount !== Infinity) amount = 110;
        const r = _m_equip.call(this, key, amount);
        if (key === 'PISTOL' && prev && prev.name !== 'PISTOL' && engine.state === 'PLAYING') audio.playEmpty();   // se acabó la munición
        return r;
    };
    const _m_warm = warmSprites;
    warmSprites = function () { _m_warm(); try { new Pickup(0, 0, 'ARC').draw(document.createElement('canvas').getContext('2d')); } catch (e) {} };
}

// ---------------------------------------------------------------- NUEVAS MEJORAS: RICOCHET y ADRENALINA
LH.UPS.push({ id: 'bounce', cat: 'atk', name: 'RICOCHET', desc: 'Tus balas rebotan en las paredes (+1 rebote)', max: 2 });
LH.UPS.push({ id: 'adren', cat: 'uti', name: 'ADRENALINA', desc: 'Cada baja recarga 0.3 s el pulso', max: 3, needsPulse: true });
{
    const _m_upd = Bullet.prototype.update;
    Bullet.prototype.update = function (dt) {
        if (!(this.bounce > 0) || this.isEnemy) return _m_upd.call(this, dt);
        const px = this.x, py = this.y;
        _m_upd.call(this, dt);
        if (this.life > 0 || !engine.wallHit(px, py, this.x, this.y)) return;
        // choque con una pared: refleja en el eje que bloquea
        const e = engine, bx = e.wallAt(px + this.vx * dt, py), by = e.wallAt(px, py + this.vy * dt);
        if (bx || !by) this.vx = -this.vx;
        if (by || !bx) this.vy = -this.vy;
        this.x = px; this.y = py; this.ox = px; this.oy = py; this.tx = px; this.ty = py; this.bounce--; this.life = 0.9;
        e.spawnParticle(px, py, this.color, 4, 0, 0, 160);
    };
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead) {
            const a = LH.lvl('adren');
            if (a && this.player.pulseCooldown > 0) this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - 0.3 * a);
        }
    };
}

// ---------------------------------------------------------------- ESQUIRLAS DE CRISTAL al morir
Object.assign(GameEngine.prototype, {
    shatter(en, fx, fy) {
        if (Settings.perf || this.shards.length > 180) return;
        const n = en.boss ? 34 : en.radius > 30 ? 18 : en.radius < 10 ? 3 : 8, m = Math.max(Math.hypot(fx, fy), 1), a0 = Math.atan2(fy, fx);
        for (let i = 0; i < n; i++) {
            const a = (m > 5 && Math.random() < 0.55) ? a0 + (Math.random() - 0.5) * 1.4 : Math.random() * TAU, sp = 120 + Math.random() * 380;
            this.shards.push({ x: en.x, y: en.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: Math.random() * TAU, va: (Math.random() - 0.5) * 18, len: 5 + Math.random() * 11, life: 0.45 + Math.random() * 0.5, max: 0.95, col: en.color });
        }
    }
});
LH.drawShards = (ctx, e) => {
    const S = e.shards; if (!S.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    let cur = null;
    for (let i = 0; i < S.length; i++) {
        const s = S[i]; if (s.col !== cur) { cur = s.col; ctx.strokeStyle = cur; }
        ctx.globalAlpha = Math.min(1, s.life / 0.4);
        const dx = Math.cos(s.a) * s.len, dy = Math.sin(s.a) * s.len;
        ctx.beginPath(); ctx.moveTo(s.x - dx, s.y - dy); ctx.lineTo(s.x + dx, s.y + dy); ctx.stroke();
    }
    ctx.restore();
};
LH.stepShards = (e, dt) => {
    const S = e.shards; let w = 0;
    for (let i = 0; i < S.length; i++) {
        const s = S[i]; s.life -= dt; if (s.life <= 0) continue;
        s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; s.vx *= 0.94; s.vy *= 0.94;
        if (s.x < 0 || s.x > width) { s.vx *= -0.6; s.x = clamp(s.x, 0, width); }
        if (s.y < 0 || s.y > height) { s.vy *= -0.6; s.y = clamp(s.y, 0, height); }
        S[w++] = s;
    }
    S.length = w;
    for (let i = e.arcs.length - 1; i >= 0; i--) if ((e.arcs[i].life -= dt) <= 0) e.arcs.splice(i, 1);
    if (e._gp > 0) e._gp *= 0.9;
};

// ---------------------------------------------------------------- JEFES DE NIVEL 3+: ORBES ORBITALES
// Cuatro (o más) orbes giran alrededor del jefe: queman al tocarte y se pueden destruir a tiros (reaparecen a los 7 s).
LH.orbTick = (e, dt) => {
    const b = e.bossRef, p = e.player;
    if (!b || b.dead || !(b.tier >= 3)) return;
    if (!b.orbs) { const n = Math.min(6, b.tier + 1); b.orbs = Array.from({ length: n }, (_, i) => ({ a: i * TAU / n, hp: 5, rs: 0, x: b.x, y: b.y })); }
    const R = b.radius + 70, spd = b.phase >= 2 ? 1.7 : 1.2;
    b.orbA = (b.orbA || 0) + dt * spd;
    for (const o of b.orbs) {
        if (o.rs > 0) { o.rs -= dt; if (o.rs > 0) continue; o.hp = 5; }
        const ang = o.a + b.orbA; o.x = b.x + Math.cos(ang) * R; o.y = b.y + Math.sin(ang) * R;
        for (const bl of e.bullets) {
            if (bl.isEnemy || bl.life <= 0) continue;
            if (Math.hypot(bl.x - o.x, bl.y - o.y) < 18 + bl.radius) { o.hp -= bl.damage; if (bl.pierce > 0) bl.pierce--; else bl.life = 0; e.spawnParticle(o.x, o.y, '#d58bff', 3, 0, 0, 120); }
        }
        if (o.hp <= 0) {
            o.rs = 7; e.spawnParticle(o.x, o.y, '#b537f2', 30, 0, 0, 400, 'blood'); LH.bonus(e, 100, o.x, o.y, '', '#d58bff'); audio.playTick(); continue;
        }
        if (p.iframes <= 0 && e.state === 'PLAYING' && Math.hypot(p.x - o.x, p.y - o.y) < p.radius + 14) {
            p.hp -= 15; p.iframes = 0.5; e.addShake(18); haptic(120); e.glitch(); e.spawnParticle(p.x, p.y, C.red, 20, 0, 0, 400, 'blood');
            if (p.hp <= 0) { e.gameOver(); return; }
        }
    }
};
LH.drawOrbs = (ctx, e) => {
    const b = e.bossRef; if (!b || b.dead || !b.orbs) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const o of b.orbs) {
        if (o.rs > 0) continue;
        ctx.strokeStyle = 'rgba(181,55,242,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(o.x, o.y); ctx.stroke();
        ctx.fillStyle = 'rgba(181,55,242,0.35)'; ctx.beginPath(); ctx.arc(o.x, o.y, 24, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d58bff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
};

// ---------------------------------------------------------------- ciclo: reinicio, tick y latido
{
    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this.shards = []; this.arcs = []; this._gp = 0; LH.beatT = 0; };
    const _m_upd = GameEngine.prototype.update;
    GameEngine.prototype.update = function (dt) {
        if (this.state !== 'PAUSED' && !(this.hitStop > 0)) LH.stepShards(this, dt);
        return _m_upd.call(this, dt);
    };
    const _m_post = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _m_post.call(this, dt);
        if (this.state !== 'PLAYING' || this.hitStop > 0) return;
        LH.orbTick(this, dt);
        const r = this.player.hp / this.player.maxHp;                // latido con poca vida
        if (r < 0.3 && r > 0 && (LH.beatT -= dt) <= 0) { LH.beatT = 0.55 + r * 1.6; audio.playHeartbeat(1 - r); }
    };
    const _m_wave = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () { _m_wave.call(this); if (this.wave % 5 === 0) audio.playBossIntro(); };
}

// ########## [mejoras3.js] ##########
// =====================================================================
//  MEJORAS v0.6 — va después de mejoras2.js y antes de carga.js
//
//  JUGABILIDAD   enemigo ESCUDERO (tipo 9): su escudo frontal frena las balas; hay que flanquearlo,
//                romperle la guardia con el PULSO o cortarlo con katana/railgun/cohete
//                los enemigos ya no se apelotonan en una sola mancha (separación suave)
//  SONIDO        clang metálico al bloquear una bala, estallido al romperse el escudo
//  EXTRAS        logro FLANQUEADOR · consejo nuevo en CONTROLES > TRUCOS
// =====================================================================

const SHIELD_COL = '#8ab4ff';

// ---------------------------------------------------------------- SONIDO
Object.assign(AudioEngine.prototype, {
    playClang() {                                             // bala rebotando en el escudo: metal agudo y seco
        if (!this.isPlaying || !this._sfxVoice(0.15)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxBand(t, 0.03, 'highpass', 5200, null, 1, 0.45, 0.0005, 0.025, 0.05);
        this._sfxOut(sfxFMMetal(c, 1250 + Math.random() * 400, 3.2, t, 0.12, 0.22), 0.12);
    },
    playShieldBreak() {                                       // guardia rota: golpe grave + cristal
        if (!this.isPlaying || !this._sfxVoice(0.5, true)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxDarkBass(c, t, 38, 0.3, 0.9, 18), 0.1);
        this._sfxBand(t, 0.25, 'bandpass', 1800, 6500, 1.4, 0.5, 0.001, 0.22, 0.15);
        this._sfxOut(sfxFMMetal(c, 880, 4, t, 0.35, 0.28), 0.2, 0.2);
    }
});

// ---------------------------------------------------------------- ESCUDERO
// Estados: walk (avanza girando despacio hacia ti) -> wind (se para y avisa) -> dash (embiste con el escudo)
//          -> recover (¡guardia baja! es tu momento) · stun (guardia rota por el pulso)
LH.ACH.push({ id: 'flank', name: 'FLANQUEADOR', desc: 'Derrota a 15 escuderos', prog: () => [LH.prog.shield || 0, 15] });
{
    const _m_make = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        if (t !== 9) return _m_make(t, x, y, hp);
        const e = new Enemy(0, x, y, hp); e.kind = 'shield'; e.radius = 21; e.color = SHIELD_COL; e.speed = 100;
        e.maxHp = e.hp = 6 * hp; e.dmg = 22; e.state = 'walk'; e.st = 0; e.cd = 1.6 + Math.random(); e.ang = 0; e.dir = 0; e.stun = 0;
        if (engine && engine.mut && engine.mut.frenzy) e.speed *= 1.25;
        return e;
    };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const guardUp = (e) => e.state === 'walk' || e.state === 'wind' || e.state === 'dash';

    LH.shieldAI = (e, dt, px, py) => {
        e.knockback.x *= 0.85; e.knockback.y *= 0.85;
        const G = engine, d = dist(e.x, e.y, px, py), a = Math.atan2(py - e.y, px - e.x);
        e.st += dt;
        if (e.state === 'walk') {
            e.ang += clamp(wrap(a - e.ang), -dt * 1.9, dt * 1.9);        // gira despacio: rodéalo y no podrá encararte a tiempo
            LH.moveE(e, dt, G.steer(e, a), e.speed);
            e.cd -= dt;
            if (e.cd <= 0 && d < 300 && Math.abs(wrap(a - e.ang)) < 0.5 && G.hasLOS(e)) { e.state = 'wind'; e.st = 0; }
        } else if (e.state === 'wind') {
            e.ang += clamp(wrap(a - e.ang), -dt * 1.2, dt * 1.2);
            LH.moveE(e, dt, e.ang, e.speed * 0.1);
            if (e.st >= 0.6) { e.state = 'dash'; e.st = 0; e.dir = e.ang; LH.panned(e.x, () => audio.playShoot('KATANA')); }
        } else if (e.state === 'dash') {
            e.ang = e.dir; LH.moveE(e, dt, e.dir, 520);
            if (e.st >= 0.42) { e.state = 'recover'; e.st = 0; }
        } else if (e.state === 'recover') {                                // guardia baja: castigo
            e.ang += clamp(wrap(a - e.ang), -dt * 1.0, dt * 1.0);
            LH.moveE(e, dt, a, e.speed * 0.25);
            if (e.st >= 1.1) { e.state = 'walk'; e.st = 0; e.cd = 2 + Math.random() * 1.2; }
        } else {                                                           // stun: guardia rota
            LH.moveE(e, dt, a, 0);
            if (e.st >= e.stun) { e.state = 'walk'; e.st = 0; e.cd = 1.4; }
        }
    };
    const _m_upd = Enemy.prototype.update;
    Enemy.prototype.update = function (dt, px, py) {
        if (this.kind === 'shield') return LH.shieldAI(this, dt, px, py);
        return _m_upd.call(this, dt, px, py);
    };

    // dibujo: el cuerpo se pinta una vez en un sprite; el escudo se dibuja cada fotograma (barato, sin resplandor)
    const _m_draw = Enemy.prototype.draw;
    Enemy.prototype.draw = function (ctx) {
        if (this.kind !== 'shield') return _m_draw.call(this, ctx);
        const r = this.radius, flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50 || (this.state === 'wind' && Math.floor(this.st * 14) % 2 === 0);
        const id = flash ? 'shf' : 'shn';
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => LH.pixShield(c, r, flash));
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang || 0);
        if (this.state === 'wind') {                                       // línea de aviso de la embestida
            ctx.strokeStyle = 'rgba(138,180,255,.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.moveTo(r + 14, 0); ctx.lineTo(r + 14 + 230, 0); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
        const R = r + 11, up = guardUp(this);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        if (up) {
            ctx.beginPath(); ctx.arc(0, 0, R, -1.1, 1.1);
            ctx.strokeStyle = 'rgba(138,180,255,.28)'; ctx.lineWidth = 12; ctx.stroke();
            ctx.strokeStyle = this.state === 'dash' ? '#ffffff' : '#cfe0ff'; ctx.lineWidth = 4; ctx.stroke();
        } else {                                                           // guardia caída: arco partido y tenue
            ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([5, 9]);
            ctx.beginPath(); ctx.arc(0, 0, R, -1.1, 1.1); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
        ctx.fillStyle = C.red; ctx.fillRect(this.x - r, this.y - r - 14, r * 2 * Math.max(0, this.hp / this.maxHp), 4);
    };
    const _m_warm = warmSprites;
    warmSprites = function () {
        _m_warm();
        try { const sc = document.createElement('canvas').getContext('2d'); for (const f of [0, 1]) { const e = makeEnemy(9, 0, 0, 1); if (f) e.knockback.x = 99; e.draw(sc); } } catch (e) {}
    };

    // bloqueo: las balas y rayos que llegan de frente rebotan; katana, railgun, cohete y bomba atraviesan la guardia
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        if (en.kind === 'shield' && !en.dead) {
            if (!melee && guardUp(en)) {
                const m = Math.sqrt(fx * fx + fy * fy);
                if (m > 1 && (-fx * Math.cos(en.ang) - fy * Math.sin(en.ang)) / m > 0.3) {          // viene de unos ±72° del frente
                    const k = this.time - (en._clk || -9);
                    if (k > 0.07) { en._clk = this.time; LH.panned(en.x, () => audio.playClang()); }
                    this.spawnParticle(en.x + Math.cos(en.ang) * (en.radius + 8), en.y + Math.sin(en.ang) * (en.radius + 8), '#cfe0ff', 4, -fx * 0.15, -fy * 0.15, 220);
                    if (!en._tx || this.time - en._tx > 0.6) { en._tx = this.time; this.spawnText(en.x, en.y - en.radius - 22, 'BLOQUEADO', '#cfe0ff'); }
                    // la bala que rebota no puede seguir atravesándolo (escopeta / PERFORANTES): se le quita la perforación para que el motor la elimine
                    for (const b of this.bullets) if (!b.isEnemy && b.vx * 0.4 === fx && b.vy * 0.4 === fy && b.pierce > 0 && dist(b.x, b.y, en.x, en.y) < en.radius + b.radius + 4) { b.pierce = 0; break; }
                    return;
                }
            }
            const alive = !en.dead;
            _m_hit.call(this, en, dmg, fx, fy, melee);
            if (alive && en.dead) {
                LH.bonus(this, 250, en.x, en.y - 24, '', SHIELD_COL);
                LH.prog.shield = (LH.prog.shield || 0) + 1; if (LH.prog.shield >= 15) LH.unlock('flank');
            }
            return;
        }
        return _m_hit.call(this, en, dmg, fx, fy, melee);
    };

    // el pulso rompe la guardia: aturdido 1.6 s, con el escudo caído
    const _m_shock = GameEngine.prototype.shockwave;
    GameEngine.prototype.shockwave = function (x, y, r) {
        let broke = 0;
        for (const e of this.enemies) {
            if (e.kind === 'shield' && !e.dead && dist(x, y, e.x, e.y) <= r + e.radius) { e.state = 'stun'; e.stun = 1.6; e.st = 0; broke++; this.spawnText(e.x, e.y - e.radius - 22, '¡GUARDIA ROTA!', '#ffffff'); }
        }
        if (broke) { audio.playShieldBreak(); this.addShake(10); }
        return _m_shock.call(this, x, y, r);
    };

    // aparecen desde la oleada 5 (no en las de jefe): 1, 1, 2, 2, 2, 3...
    const _m_wave = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        _m_wave.call(this);
        const w = this.wave, q = this.queue;
        if (w >= 9 && w % 5 !== 0) {
            const n = Math.min(3, Math.floor((w - 6) / 3));
            for (let i = 0; i < n; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, { t: 9, n: 1, d: 1.5 });
            audio.music.call('setWaveSize', q.reduce((a, x) => a + x.n, 0));
        }
    };
}

// ---------------------------------------------------------------- SEPARACIÓN ENTRE ENEMIGOS
// Antes se amontonaban en una sola mancha (parecía un enemigo solo y las balas se desperdiciaban). Empuje suave y proporcional.
// RED DE SEGURIDAD: un enemigo que ya entró en la arena no puede volver a salir (si te pegas a una esquina o un borde, el
// empuje entre ellos, el pulso o un retroceso los sacaba fuera y ya no se les podía disparar: la oleada no acababa).
{
    const inArena = (o) => o.x >= 0 && o.y >= 0 && o.x <= width && o.y <= height;
    const _m_post = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _m_post.call(this, dt);
        if (this.state !== 'PLAYING' || this.hitStop > 0) return;
        const E = this.enemies, n = E.length;
        for (let i = 0; i < n; i++) {
            const a = E[i]; if (a.dead || a.boss || a.type >= 4) continue;
            for (let j = i + 1; j < n; j++) {
                const b = E[j]; if (b.dead || b.boss || b.type >= 4) continue;
                const rr = (a.radius + b.radius) * 0.92, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
                if (d2 >= rr * rr) continue;
                const d = Math.sqrt(d2) || 0.01, nx = d > 0.02 ? dx / d : 1, ny = d > 0.02 ? dy / d : 0;
                const pen = (rr - d) * 0.35, ma = b.radius / (a.radius + b.radius), mb = 1 - ma;
                const adash = a.state === 'dash', bdash = b.state === 'dash';       // quien embiste no se desvía
                if (!adash) { a.x -= nx * pen * ma * (bdash ? 2 : 1); a.y -= ny * pen * ma * (bdash ? 2 : 1); }
                if (!bdash) { b.x += nx * pen * mb * (adash ? 2 : 1); b.y += ny * pen * mb * (adash ? 2 : 1); }
            }
        }
        for (let i = 0; i < n; i++) {                                                // red de seguridad: dentro de la arena se queda dentro
            const e = E[i]; if (e.dead || e.boss || e.type >= 4) continue;
            if (inArena(e)) e._in = true;
            else if (e._in) { const m = e.radius * 0.5; e.x = clamp(e.x, m, width - m); e.y = clamp(e.y, m, height - m); }
        }
    };
}

// ---------------------------------------------------------------- CONSEJO NUEVO + LOGRO EN EL PANEL
{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const t = document.createElement('div'); t.className = 'tip';
        t.innerHTML = '<b>ESCUDERO</b>El azul con escudo frontal bloquea tus balas. Rodéalo (gira despacio), rómpele la guardia con el PULSO o córtalo con katana, railgun o cohete. Tras embestir deja la guardia baja un segundo.';
        const ref = pane.querySelector('.tip:nth-child(4)');
        pane.insertBefore(t, ref ? ref.nextSibling : null);
    }
    try { if (LH.paintDaily) LH.paintDaily(); } catch (e) {}
}

// ########## [mejoras4.js] ##########
// =====================================================================
//  MEJORAS v0.7 — va después de mejoras3.js y antes de carga.js
//
//  MULTIKILL     varias bajas en menos de 0.4 s: DOBLE · TRIPLE · CUÁDRUPLE · ¡MULTIKILL! con bonus, sacudida y sonido ascendente
//  SANGRE NEÓN   con menos del 30 % de vida cada baja te cura un poco: arriesgar se premia (estilo Hotline Miami)
//  JEFE ABATIDO  cámara lenta larga, anillos de choque y anuncio al derrotar a un jefe
// =====================================================================
LH.ACH.push({ id: 'multi', name: 'CARNICERO', desc: 'Consigue un MULTIKILL de 5 o más' });

Object.assign(AudioEngine.prototype, {
    playMulti(n) {                                            // sube de tono con cada baja de la cadena
        if (!this.isPlaying || !this._sfxVoice(0.4, true)) return;
        const c = this.ctx, t = c.currentTime, f = 330 * Math.pow(2, Math.min(n, 8) / 6);
        this._sfxOut(sfxFMMetal(c, f, 3.5, t, 0.3, 0.3), 0.15, 0.1);
        this._sfxOut(sfxDarkBass(c, t, 34 + n * 2, 0.2, 0.8, 18), 0.05);
        this._sfxBand(t, 0.12, 'highpass', 3500, null, 1, 0.4, 0.0005, 0.1, 0.1);
    },
    playBossDown() {                                          // jefe abatido: derrumbe grave largo y cristal
        if (!this.isPlaying || !this._sfxVoice(1.8, true)) return;
        const c = this.ctx, t = c.currentTime;
        this._sfxOut(sfxDarkBass(c, t, 26, 1.4, 1.0, 26), 0.2, 0.5);
        [0, 7, 12, 19].forEach((n, i) => this._sfxOut(sfxFMMetal(c, 440 * Math.pow(2, n / 12), 3, t + 0.1 + i * 0.12, 0.9, 0.18), 0.2, 0.4));
        this._sfxBand(t, 1.2, 'bandpass', 3000, 400, 1.0, 0.4, 0.01, 1.0, 0.2, 0.4);
    }
});

LH.MULTI = ['', '', 'DOBLE', 'TRIPLE', 'CUÁDRUPLE', '¡PENTAKILL!', '¡MULTIKILL!'];
LH.MULTI_COL = ['', '', C.cyan, C.yellow, C.pink, C.red, C.white];
{
    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this._mk = 0; this._mkT = -9; };

    const _m_add = GameEngine.prototype.addScore;
    GameEngine.prototype.addScore = function (amount, x, y) {
        const r = _m_add.call(this, amount, x, y);
        if (this.state !== 'PLAYING') return r;
        // cadena de bajas muy seguidas
        this._mk = (this.time - this._mkT < 0.4) ? this._mk + 1 : 1;
        this._mkT = this.time;
        const n = this._mk;
        if (n >= 2) {
            const k = Math.min(n, 6), pts = 75 * n * n;
            LH.bonus(this, pts, x, (y || 0) - 44, '', LH.MULTI_COL[k]);
            LH.announce(LH.MULTI[k], LH.MULTI_COL[k], 0.27, 22 + k * 3);
            this.addShake(8 + n * 3);
            if (this.rings && x != null) this.rings.push({ x, y, max: 90 + n * 40, life: 0.4, maxLife: 0.4, col: LH.MULTI_COL[k] });
            audio.playMulti(n);
            if (n >= 5) LH.unlock('multi');
        }
        // sangre neón: poca vida -> cada baja cura
        const p = this.player;
        if (p.hp > 0 && p.hp / p.maxHp < 0.3) {
            p.hp = Math.min(p.maxHp, p.hp + 3);
            if (x != null) this.spawnText(x, y - 22, '+3 HP', C.green);
        }
        return r;
    };

    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead && en.boss) {
            this.slowmo = 2.2; audio.playBossDown(); this.glitch(); this.addShake(60);
            LH.announce('JEFE ABATIDO', en.color || C.red, 0.3, 40);
            for (let i = 0; i < 3; i++) this.rings.push({ x: en.x, y: en.y, max: 500 + i * 380, life: 0.6 + i * 0.25, maxLife: 0.6 + i * 0.25, col: i % 2 ? '#ffffff' : (en.color || C.red) });
        }
    };
}

{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const t = document.createElement('div'); t.className = 'tip';
        t.innerHTML = '<b>MULTIKILL Y SANGRE NEÓN</b>Mata varios enemigos en menos de 0,4 s (bomba, escopeta, pulso + disparo) para ganar bonus. Con menos del 30 % de vida cada baja te cura un poco: arriesgar compensa.';
        pane.insertBefore(t, pane.querySelector('.tip:nth-child(6)'));
    }
    try { if (LH.paintDaily) LH.paintDaily(); } catch (e) {}
}

// ########## [mejoras5.js] ##########
// =====================================================================
//  MEJORAS v0.8 — JEFE NUEVO: "NULL SIGNAL"   (va después de mejoras4.js y antes de carga.js)
//
//  Una señal corrupta con forma de monitor roto. Su estética es el propio "glitch" del juego: se parte en
//  canales rojo/cian, salta de un sitio a otro y dispara líneas de escaneo sobre la arena.
//  Aparece como 2.º jefe (oleada 10) y se repite en la rotación.
//
//  ATAQUES (en rotación)
//   · RÁFAGAS     tres ráfagas de 3 balas dirigidas a ti
//   · ESCANEO     líneas horizontales/verticales: primero un aviso fino (1 s), luego un haz que quema (¡sal de la línea!)
//   · SALTO       marca dónde reaparecerá, desaparece (intocable) y vuelve con un anillo de balas
//  FASES   2: deja un ECO donde estaba (dispara un abanico al desvanecerse) · 3: más líneas y saltos más rápidos
//  Sin orbes ni láser giratorio: su dificultad viene de leer el tablero, no de esquivar más balas.
// =====================================================================
const GLITCH_NAME = 'NULL SIGNAL', GLITCH_COL = '#dff6ff';
LH.BOSSES.splice(1, 0, [GLITCH_NAME, GLITCH_COL]);

Object.assign(AudioEngine.prototype, {
    playGlitch(kind) {                                        // crujido digital: ráfagas de ruido con filtros saltando
        if (!this.isPlaying || !this._sfxVoice(0.5, true)) return;
        const c = this.ctx, t = c.currentTime;
        for (let i = 0; i < 5; i++) this._sfxBand(t + i * 0.035, 0.05, 'bandpass', 700 + Math.random() * 3500, 300 + Math.random() * 6000, 6, 0.5, 0.0005, 0.04, 0.05);
        this._sfxOut(sfxDarkBass(c, t, kind === 'line' ? 30 : 44, 0.22, 0.8, 22), 0.05);
        if (kind !== 'line') this._sfxOut(sfxFMMetal(c, 1800, 5, t + 0.05, 0.18, 0.2), 0.1);
    }
});

{
    const _m_make = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        const e = _m_make(t, x, y, hp);
        if (t === 5 && e.bossName === GLITCH_NAME) {
            e.glitch = true; e.tier = 1;                          // tier 1: sin orbes ni láser giratorio
            e.radius = 58; e.maxHp = e.hp = e.maxHp * 0.9;
            e.gs = 'drift'; e.gt = 0; e.act = -1; e.lines = []; e.vol = null; e.gcw = 1; e.tx = 0; e.ty = 0; e.rad0 = e.radius; e.dmg0 = e.dmg;
        }
        return e;
    };

    const _m_ai = Enemy.prototype.bossAI;
    Enemy.prototype.bossAI = function (dt, px, py) { return this.glitch ? LH.glitchAI(this, dt, px, py) : _m_ai.call(this, dt, px, py); };

    // intocable mientras está "fuera de la señal"
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        if (en.glitch && en.gs === 'gone') return;
        return _m_hit.call(this, en, dmg, fx, fy, melee);
    };

    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this.echoes = []; };
}

LH.glitchHurt = (e, d) => {
    const p = e.player;
    if (p.iframes > 0 || p.hp <= 0 || e.state !== 'PLAYING') return;
    p.hp -= d; p.iframes = 0.6; e.addShake(26); haptic(150); e.glitch();
    e.spawnParticle(p.x, p.y, C.red, 26, 0, 0, 500, 'blood');
    if (p.hp <= 0) e.gameOver();
};
LH.glitchAI = (b, dt, px, py) => {
    const G = engine, ph = b.phase || 1, rage = ph >= 2;
    b.t += dt; b.fireCooldown -= dt;
    const d = dist(b.x, b.y, px, py), ang = Math.atan2(py - b.y, px - b.x);
    const mk = (a, s, dmg = 12) => G.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: GLITCH_COL, damage: dmg, name: 'ENEMY_GUN' }, true));
    if (b.recover > 0) b.recover -= dt;

    // ---- líneas de escaneo (se procesan siempre)
    for (let i = b.lines.length - 1; i >= 0; i--) {
        const L = b.lines[i]; L.t += dt;
        if (L.t >= L.warn && !L.fired) { L.fired = true; if (i === 0 || !b._lsnd) { b._lsnd = true; audio.playGlitch('line'); } G.addShake(10); }
        if (L.fired) {
            const p = G.player, off = L.ax === 'h' ? Math.abs(p.y - L.pos) : Math.abs(p.x - L.pos);
            if (off < p.radius + 12 && !L.hit) { L.hit = true; LH.glitchHurt(G, 22); }
        }
        if (L.t >= L.warn + 0.35) b.lines.splice(i, 1);
    }
    if (!b.lines.length) b._lsnd = false;

    // ---- ráfagas en curso
    if (b.vol && b.gs === 'drift') {
        b.vol.t -= dt;
        if (b.vol.t <= 0) {
            b.vol.t = 0.45; for (let i = -1; i <= 1; i++) mk(ang + i * 0.12, 520);
            audio.playShoot('ENEMY_GUN', true); if (--b.vol.n <= 0) b.vol = null;
        }
    }

    let vx = 0, vy = 0;
    if (b.gs === 'warp') {                                    // aviso del salto: parpadea quieto
        b.gt -= dt;
        if (b.gt <= 0) {
            b.gs = 'gone'; b.gt = 0.25; b.radius = 0.5; b.dmg = 0;
            if (rage) (G.echoes || (G.echoes = [])).push({ x: b.x, y: b.y, t: 0, fired: false });
        }
    } else if (b.gs === 'gone') {
        b.gt -= dt;
        if (b.gt <= 0) {
            b.gs = 'drift'; b.radius = b.rad0; b.dmg = b.dmg0; b.x = b.tx; b.y = b.ty;
            G.rings.push({ x: b.x, y: b.y, max: 220, life: 0.4, maxLife: 0.4, col: GLITCH_COL });
            const n = rage ? 18 : 12, a0 = Math.random() * TAU;
            for (let i = 0; i < n; i++) mk(a0 + i / n * TAU, 230);
            G.addShake(18); audio.playGlitch('warp'); b.fireCooldown = rage ? 1.0 : 1.5;
        }
    } else {                                                  // deriva: orbita al jugador a media distancia
        const sp = rage ? 150 : 110, along = d > 380 ? 1 : d < 250 ? -1 : 0, side = Math.sin(b.t * 0.8) * 0.9;
        vx = Math.cos(ang) * sp * along - Math.sin(ang) * sp * side; vy = Math.sin(ang) * sp * along + Math.cos(ang) * sp * side;
        if (b.fireCooldown <= 0 && b.t > 1.5 && !(b.recover > 0) && !b.vol) {
            b.act = (b.act + 1) % 3;
            if (b.act === 0) { b.vol = { n: 3, t: 0 }; b.fireCooldown = rage ? 1.6 : 2.2; }
            else if (b.act === 1) {                           // escaneo: la 1.ª línea apunta a donde estás; las demás, cerca
                const n = ph === 1 ? 2 : ph === 2 ? 3 : 4, warn = ph === 3 ? 0.85 : 1.0;
                for (let i = 0; i < n; i++) {
                    const ax = (i % 2 === 0) ? 'h' : 'v', base = ax === 'h' ? py : px, lim = ax === 'h' ? height : width;
                    b.lines.push({ ax, pos: clamp(base + (i < 2 ? 0 : 1) * (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 140) + (i === 0 ? 0 : (Math.random() - 0.5) * 120), 20, lim - 20), t: -i * 0.18, warn, fired: false, hit: false });
                }
                audio.playGlitch('line'); b.fireCooldown = rage ? 2.2 : 2.8;
            } else {                                          // salto: busca un hueco libre a 200-420 px del jugador
                let s = null;
                for (let k = 0; k < 40; k++) { const c = G.freeSpot(), dd = dist(c.x, c.y, px, py); if (dd > 200 && dd < 420) { s = c; break; } s = s || c; }
                b.tx = s.x; b.ty = s.y; b.gs = 'warp'; b.gt = ph === 3 ? 0.45 : 0.65; audio.playGlitch('warp');
                b.fireCooldown = 0;
            }
        }
    }
    b.x = clamp(b.x + vx * dt, b.radius, width - b.radius); b.y = clamp(b.y + vy * dt, b.radius, height - b.radius);
    if (b.gs !== 'gone') for (const o of G.obstacles) { const r = rectCircleCollide(b.x, b.y, b.radius, o.x, o.y, o.w, o.h); if (r.hit) { b.x += r.nx * r.pen; b.y += r.ny * r.pen; } }
};

// ecos: fantasmas que disparan un abanico y se desvanecen
{
    const _m_post = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _m_post.call(this, dt);
        const E = this.echoes; if (!E || !E.length || this.state !== 'PLAYING' || this.hitStop > 0) return;
        for (let i = E.length - 1; i >= 0; i--) {
            const o = E[i]; o.t += dt;
            if (!o.fired && o.t >= 0.9) {
                o.fired = true; const a = Math.atan2(this.player.y - o.y, this.player.x - o.x);
                for (let k = -2; k <= 2; k++) this.bullets.push(new Bullet(o.x, o.y, a + k * 0.14, { speed: 440, color: GLITCH_COL, damage: 12, name: 'ENEMY_GUN' }, true));
                audio.playShoot('ENEMY_GUN', true);
            }
            if (o.t >= 1.5 || !this.bossRef) E.splice(i, 1);
        }
    };
}

// ---------------------------------------------------------------- DIBUJO
{
    const _m_big = Enemy.prototype.drawBig;
    Enemy.prototype.drawBig = function (ctx) {
        if (!this.glitch) return _m_big.call(this, ctx);
        const t = engine.time, r = this.rad0, G = engine;
        if (this.gs === 'warp') {                             // marcador de dónde reaparecerá
            const k = 1 - this.gt / (G.player && this.phase === 3 ? 0.45 : 0.65);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(223,246,255,' + (0.35 + 0.4 * k) + ')'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
            ctx.beginPath(); ctx.arc(this.tx - this.x, this.ty - this.y, r * (1.4 - 0.5 * k), 0, TAU); ctx.stroke(); ctx.restore();
        }
        if (this.gs === 'gone') return;
        const flick = this.gs === 'warp' && Math.floor(t * 30) % 2 === 0, j = (Math.floor(t * 12) % 5 === 0) ? 4 : 1.5;
        const poly = (ox, oy, rad, n, rot) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; ctx[i ? 'lineTo' : 'moveTo'](ox + Math.cos(a) * rad, oy + Math.sin(a) * rad); } ctx.closePath(); };
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 4; ctx.globalAlpha = flick ? 0.35 : 1;
        ctx.strokeStyle = '#ff2a55'; poly(-j, 0, r, 4, Math.PI / 4 + t * 0.4); ctx.stroke();    // canal rojo
        ctx.strokeStyle = '#19e6ff'; poly(j, 0, r, 4, Math.PI / 4 + t * 0.4); ctx.stroke();     // canal cian
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; poly(0, 0, r * 0.98, 4, Math.PI / 4 + t * 0.4); ctx.stroke();
        ctx.fillStyle = 'rgba(5,1,10,0.85)'; poly(0, 0, r * 0.62, 4, Math.PI / 4 - t * 0.9); ctx.fill();
        ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3; ctx.stroke();
        // ojo: una rendija vertical que sigue al jugador
        const pl = G.player, a = Math.atan2(pl.y - this.y, pl.x - this.x);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.cos(a) * 9 - 3, -r * 0.3, 6, r * 0.6);
        ctx.fillStyle = '#ff2a55'; ctx.fillRect(Math.cos(a) * 9 - 3 - j, -2, 6, 4);
        // rebanadas desplazadas (efecto glitch)
        if (Math.floor(t * 9) % 3 === 0) {
            const y0 = ((Math.floor(t * 9) * 37) % 100) / 100 * r * 1.6 - r * 0.8;
            ctx.save(); ctx.beginPath(); ctx.rect(-r - 12, y0, r * 2 + 24, 9); ctx.clip(); ctx.translate(10 * (Math.floor(t * 9) % 2 ? 1 : -1), 0);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; poly(0, 0, r, 4, Math.PI / 4 + t * 0.4); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    };

    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        const b = this.bossRef, E = this.echoes;
        if ((!b || !b.glitch) && !(E && E.length)) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
        if (b && b.glitch) for (const L of b.lines) {
            if (L.t < 0) continue;
            const h = L.ax === 'h', x1 = h ? 0 : L.pos, y1 = h ? L.pos : 0, x2 = h ? width : L.pos, y2 = h ? L.pos : height;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            if (!L.fired) {                                   // aviso: línea fina y punteada que se va llenando
                const k = L.t / L.warn; ctx.setLineDash([14, 10]); ctx.strokeStyle = 'rgba(223,246,255,' + (0.25 + 0.5 * k) + ')'; ctx.lineWidth = 1.5 + 1.5 * k; ctx.stroke(); ctx.setLineDash([]);
            } else {                                          // haz: canales separados y núcleo blanco
                const k = 1 - (L.t - L.warn) / 0.35, o = 5 * k;
                for (const [dx, col] of [[-o, 'rgba(255,42,85,' + k + ')'], [o, 'rgba(25,230,255,' + k + ')']]) {
                    ctx.beginPath(); ctx.moveTo(x1 + (h ? 0 : dx), y1 + (h ? dx : 0)); ctx.lineTo(x2 + (h ? 0 : dx), y2 + (h ? dx : 0)); ctx.strokeStyle = col; ctx.lineWidth = 16 * k + 2; ctx.stroke();
                }
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = 'rgba(255,255,255,' + k + ')'; ctx.lineWidth = 8 * k + 1; ctx.stroke();
            }
        }
        if (E) for (const o of E) {                           // ecos: contorno fantasma que parpadea y se desvanece
            const k = Math.max(0, 1 - o.t / 1.5);
            ctx.globalAlpha = k * (Math.floor(o.t * 20) % 2 ? 0.9 : 0.4); ctx.strokeStyle = GLITCH_COL; ctx.lineWidth = 3;
            const r = 58, a = Math.PI / 4 + o.t; ctx.beginPath();
            for (let i = 0; i < 4; i++) { const q = a + i / 4 * TAU; ctx[i ? 'lineTo' : 'moveTo'](o.x + Math.cos(q) * r, o.y + Math.sin(q) * r); }
            ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
    };
}

{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const t = document.createElement('div'); t.className = 'tip';
        t.innerHTML = '<b>NULL SIGNAL</b>Jefe de la oleada 10. Las líneas finas punteadas son avisos: en 1 s se convierten en un haz que quema, sal de ellas. Cuando parpadea y marca un círculo, va a saltar allí (y mientras salta es intocable). En fase 2 deja un eco que dispara.';
        pane.appendChild(t);
    }
}

// ########## [mejoras6.js] ##########
// =====================================================================
//  MEJORAS v0.9 / v1.0 — FONDO AL RITMO   (va después de mejoras5.js y antes de mejoras7.js)
//
//  Ajustes > GRÁFICOS > FONDO AL RITMO (Settings.beatBg). Un analizador de audio escucha la música (solo la música,
//  no los efectos) y separa DOS bandas:
//    BOMBO (graves)    resplandor central · cuadrícula encendida y más gruesa · anillos que se expanden ·
//                      la cámara da un "bombazo" (zoom) · los muros se iluminan · aro latiendo alrededor de tu nave
//    CAJA / HATS (medios-agudos)   focos verticales que barren la pantalla · franjas de luz arriba y abajo
//    SIEMPRE           ecualizador de barras abajo + espectro RADIAL girando en el centro
//  El color sube con tu COMBO: zona/rosa → rosa/amarillo (combo 15+) → amarillo/blanco (combo 40+).
//  REDUCIR DESTELLOS lo atenúa mucho (sin anillos, focos ni zoom). Se adapta a la calidad gráfica (Q.level, también la automática):
//    nivel 0 todo · nivel 1 sin espectro radial · nivel 2 solo resplandor, cuadrícula y anillos · nivel 3 / RENDIMIENTO solo cuadrícula
//  Por defecto: activado en PC, desactivado en móvil (se enciende en Ajustes).
//  Depuración: LH.beat.n (bombos), LH.beat.sn (cajas), LH.beat.v (intensidad actual 0-1).
// =====================================================================
if (Settings.beatBg === undefined) Settings.beatBg = !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

LH.beat = { an: null, f: null, hist: [], avg: 0, prev: 0, v: 0, lv: 0, last: 0, n: 0, t: 0, ok: false,
            sHist: [], sAvg: 0, sPrev: 0, sv: 0, sLast: 0, sn: 0, rings: [], beams: [], bars: new Float32Array(32), idx: null, spin: 0 };
LH.beatF = { glow: 1, beams: 1, strips: 1, grid: 1, rings: 1, eq: 1, radial: 1, walls: 1, aura: 1 };   // interruptores de depuración (para medir el coste de cada efecto)
LH.beatUpdate = () => {
    const B = LH.beat, now = performance.now();
    if (B.t && now - B.t < 6) return B.ok;                               // una sola vez por fotograma
    const dt = Math.min(0.1, Math.max(0.001, (now - (B.t || now)) / 1000)); B.t = now;
    if (!B.an) {
        try {
            if (!audio || !audio.ctx || !audio.music || !audio.music.out) return (B.ok = false);
            B.an = audio.ctx.createAnalyser(); B.an.fftSize = 512; B.an.smoothingTimeConstant = 0.35; B.an.maxDecibels = -12;   // más margen: con el rango por defecto los graves se saturaban en 1.0 y el bombo no se distinguía
            B.f = new Uint8Array(B.an.frequencyBinCount); audio.music.out.connect(B.an);   // en paralelo: no altera el sonido
            B.idx = Array.from({ length: 32 }, (_, i) => Math.max(1, Math.round(Math.pow(90, i / 31))));
        } catch (e) { B.an = null; return (B.ok = false); }
    }
    B.an.getByteFrequencyData(B.f);
    // ---- bombo: graves
    let e = 0; for (let i = 0; i < 4; i++) e += B.f[i]; e /= 4 * 255;
    const flux = e - B.prev; B.prev = e;
    B.hist.push(e); if (B.hist.length > 40) B.hist.shift();
    B.avg = B.hist.reduce((a, b) => a + b, 0) / B.hist.length;
    if (flux > Math.max(0.03, Math.min(B.avg * 0.1, 0.06)) && e > 0.18 && now - B.last > 170) {
        B.last = now; B.n++; B.v = Math.min(1, 0.55 + flux * 3); B.rings.push({ t: 0 });
        if (B.rings.length > 4) B.rings.shift();
        if (!Settings.calm && !Settings.perf && typeof engine !== 'undefined' && engine && engine.state === 'PLAYING') Cam.punch += 0.007 * B.v;   // bombazo de cámara
    }
    // ---- caja / hats: medios y agudos
    let s = 0; for (let i = 10; i < 40; i++) s += B.f[i]; s /= 30 * 255;
    const sf = s - B.sPrev; B.sPrev = s;
    B.sHist.push(s); if (B.sHist.length > 40) B.sHist.shift();
    B.sAvg = B.sHist.reduce((a, b) => a + b, 0) / B.sHist.length;
    if (sf > Math.max(0.025, Math.min(B.sAvg * 0.12, 0.05)) && s > 0.12 && now - B.sLast > 130) {
        B.sLast = now; B.sn++; B.sv = Math.min(1, 0.5 + sf * 4);
        B.beams.push({ x: Math.random(), t: 0, w: 0.025 + Math.random() * 0.03 }); if (B.beams.length > 6) B.beams.shift();
    }
    B.v *= Math.exp(-dt * 5.5); B.sv *= Math.exp(-dt * 9); B.lv += (e - B.lv) * Math.min(1, dt * 8); B.spin += dt * (0.25 + B.lv * 0.8);
    for (let i = 0; i < 32; i++) { const x = B.f[B.idx[i]] / 255, c = B.bars[i]; B.bars[i] = x > c ? x : c + (x - c) * Math.min(1, dt * 9); }
    for (const r of B.rings) r.t += dt * 1.4;
    while (B.rings.length && B.rings[0].t > 1) B.rings.shift();
    for (const b of B.beams) b.t += dt * 2.8;
    while (B.beams.length && B.beams[0].t > 1) B.beams.shift();
    return (B.ok = true);
};
// color según la zona y el combo: [principal, secundario]
LH.beatCols = (engine_) => {
    const zi = Math.floor((Math.max(engine_.layoutWave || 1, 1) - 1) / 5) % 3, zc = [[0, 243, 255], [47, 155, 255], [192, 75, 255]][zi], c = engine_.combo || 0;
    if (c >= 40) return [[255, 230, 0], [255, 255, 255]];
    if (c >= 15) return [[255, 0, 127], [255, 230, 0]];
    return [zc, [255, 0, 127]];
};
{
    const _m_back = GameEngine.prototype.drawBackdrop;
    GameEngine.prototype.drawBackdrop = function (ctx) {
        _m_back.call(this, ctx);
        if (!Settings.beatBg) return;
        if (!LH.beatUpdate()) return;
        const B = LH.beat, calm = !!Settings.calm, perf = !!Settings.perf, lvl = perf ? 3 : Q.level, k = calm ? 0.3 : 1, v = B.v * k, sv = B.sv * k, lv = B.lv * k;
        if (v < 0.01 && sv < 0.01 && lv < 0.02 && !B.rings.length) return;
        const w = canvas.width, h = canvas.height, cs = LH.beatCols(this), c1 = cs[0].join(','), c2 = cs[1].join(','), rgb = (B.n % 2) ? c2 : c1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (lvl <= 2 && (LH.beatF.glow || LH.beatF.beams || LH.beatF.strips)) {                // luces suaves: se pintan a 1/4 de resolución y se amplían (una sola pasada de pantalla completa)
            const lw = Math.max(8, Math.ceil(w / 4)), lh = Math.max(8, Math.ceil(h / 4)), cv = LH.beatCv || (LH.beatCv = document.createElement('canvas'));
            if (cv.width !== lw || cv.height !== lh) { cv.width = lw; cv.height = lh; } else if (LH.beatCx) LH.beatCx.clearRect(0, 0, lw, lh);
            const lc = LH.beatCx = cv.getContext('2d'); lc.globalCompositeOperation = 'lighter';
            if (LH.beatF.glow) {                                                             // resplandor central
                const R = Math.max(lw, lh) * 0.8, g = lc.createRadialGradient(lw / 2, lh / 2, 0, lw / 2, lh / 2, R);
                g.addColorStop(0, 'rgba(' + rgb + ',' + (0.04 * lv + 0.26 * v).toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(' + rgb + ',' + (0.015 * lv + 0.08 * v).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
                lc.fillStyle = g; lc.fillRect(0, 0, lw, lh);
            }
            if (!calm && lvl <= 1 && LH.beatF.beams) for (const b of B.beams) {                          // focos verticales (cajas): barren la pantalla
                const a = (1 - b.t) * 0.22, bw = lw * b.w, x = b.x * lw - bw / 2, gg = lc.createLinearGradient(0, 0, 0, lh);
                gg.addColorStop(0, 'rgba(' + c2 + ',' + a.toFixed(3) + ')'); gg.addColorStop(1, 'rgba(' + c2 + ',0)');
                lc.fillStyle = gg; lc.fillRect(x, 0, bw, lh);
            }
            if (!calm && lvl <= 1 && sv > 0.02 && LH.beatF.strips) {                                     // franjas de luz arriba y abajo
                const sh = lh * 0.07 * sv, g1 = lc.createLinearGradient(0, 0, 0, sh), g2 = lc.createLinearGradient(0, lh, 0, lh - sh);
                g1.addColorStop(0, 'rgba(' + c2 + ',' + (0.35 * sv).toFixed(3) + ')'); g1.addColorStop(1, 'rgba(' + c2 + ',0)');
                g2.addColorStop(0, 'rgba(' + c2 + ',' + (0.35 * sv).toFixed(3) + ')'); g2.addColorStop(1, 'rgba(' + c2 + ',0)');
                lc.fillStyle = g1; lc.fillRect(0, 0, lw, sh); lc.fillStyle = g2; lc.fillRect(0, lh - sh, lw, sh);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, 0, 0, w, h);
        }
        if (this.gridPath && LH.beatF.grid) {                                                // la cuadrícula se enciende
            ctx.setTransform(Cam.m[0] * renderK, Cam.m[1] * renderK, Cam.m[2] * renderK, Cam.m[3] * renderK, Cam.m[4], Cam.m[5]);
            ctx.strokeStyle = 'rgba(' + rgb + ',' + Math.min(0.6, 0.06 * lv + 0.5 * v).toFixed(3) + ')'; ctx.lineWidth = 1 + 2.2 * v; ctx.stroke(this.gridPath);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!calm && lvl <= 2 && LH.beatF.rings) for (const r of B.rings) {                                                // anillos por golpe
            ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - r.t) * 0.35).toFixed(3) + ')'; ctx.lineWidth = (2 + 6 * (1 - r.t)) * dpr;
            ctx.beginPath(); ctx.arc(w / 2, h / 2, r.t * Math.max(w, h) * 0.6, 0, TAU); ctx.stroke();
        }
        if (lvl <= 2 && (LH.beatF.eq || LH.beatF.radial)) {      // el ecualizador también en calidad media-baja (es barato); el radial solo en nivel 0
            const n = 32, bw = w / n, mh = h * 0.26;                                         // ecualizador inferior
            ctx.fillStyle = 'rgba(' + c1 + ',' + (0.12 + 0.2 * v).toFixed(3) + ')';
            if (LH.beatF.eq) for (let i = 0; i < n; i++) { const bh = Math.pow(B.bars[i], 1.4) * mh * (calm ? 0.5 : 1); ctx.fillRect(i * bw + bw * 0.12, h - bh, bw * 0.76, bh); }
            // espectro radial: 64 radios simétricos que giran despacio y se abren con el bombo
            const cx = w / 2, cy = h / 2, r0 = Math.min(w, h) * (0.17 + 0.03 * v), L = Math.min(w, h) * 0.2 * (calm ? 0.5 : 1);
            ctx.lineWidth = Math.max(1.5, 2.2 * dpr); ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(' + c2 + ',' + (0.14 + 0.28 * v).toFixed(3) + ')'; ctx.beginPath();
            if (LH.beatF.radial && lvl === 0) for (let i = 0; i < 64; i++) {
                const q = i < 32 ? i : 63 - i, a = B.spin + i / 64 * TAU, len = 6 + Math.pow(B.bars[q], 1.5) * L;
                ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
            }
            ctx.stroke();
        }
        ctx.restore();
    };

    // los muros se iluminan con el bombo
    const _m_walls = GameEngine.prototype.drawWalls;
    GameEngine.prototype.drawWalls = function (ctx) {
        _m_walls.call(this, ctx);
        if (!Settings.beatBg || !LH.beat.ok || !LH.beatF.walls || Settings.perf || Q.level > 1) return;
        const v = LH.beat.v * (Settings.calm ? 0.3 : 1); if (v < 0.05 || !this.obstacles.length) return;
        const pal = this.wallPal || [0, 255, 102];
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(' + pal.join(',') + ',' + (0.2 * v).toFixed(3) + ')';
        for (const o of this.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.restore();
    };

    // aro latiendo alrededor de tu nave
    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        if (!Settings.beatBg || !LH.beat.ok || !LH.beatF.aura || Settings.perf || Q.level > 1 || Settings.calm || this.state !== 'PLAYING' || !this.player || this.player.hp <= 0) return;
        const v = LH.beat.v; if (v < 0.05) return;
        const p = this.player, c = LH.beatCols(this)[0].join(',');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(' + c + ',' + (v * 0.55).toFixed(3) + ')'; ctx.lineWidth = 2 + 3 * v;
        ctx.beginPath(); ctx.arc(p.x, p.y, 26 + 34 * (1 - v), 0, TAU); ctx.stroke(); ctx.restore();
    };
}

// ########## [mejoras7.js] ##########
// =====================================================================
//  MEJORAS v1.0 — VARIAS   (va después de mejoras6.js y antes de carga.js)
//
//  EN RITMO      con FONDO AL RITMO activo, matar justo después de un golpe de bombo da bonus (♪) y suma al logro GROOVE
//  OBJETO        SOBRECARGA (magenta, «O»): 6,5 s disparando al doble de cadencia
//  MEJORAS       CRÍTICOS (8 % por nivel de que una bala haga doble daño) · DETONACIÓN (los enemigos explotan al morir
//                y dañan a los de alrededor: reacciones en cadena)
// =====================================================================
LH.ACH.push({ id: 'groove', name: 'GROOVE', desc: 'Mata 40 enemigos al ritmo de la música (activa FONDO AL RITMO)', prog: () => [LH.prog.groove || 0, 40] });

// ---------------------------------------------------------------- EN RITMO
{
    const _m_add = GameEngine.prototype.addScore;
    GameEngine.prototype.addScore = function (amount, x, y) {
        const r = _m_add.call(this, amount, x, y);
        if (this.state === 'PLAYING' && Settings.beatBg && LH.beat.ok && performance.now() - LH.beat.last < 90) {
            LH.bonus(this, 30 * Math.min(10, Math.max(1, this.combo)), x, (y || 0) - 62, '♪ ', '#ff7ad9');
            if (this.rings && x != null) this.rings.push({ x, y, max: 60, life: 0.25, maxLife: 0.25, col: '#ff7ad9' });
            LH.prog.groove = (LH.prog.groove || 0) + 1; if (LH.prog.groove >= 40) LH.unlock('groove');
        }
        return r;
    };
}

// ---------------------------------------------------------------- SOBRECARGA (objeto)
EXTRA_PK.OVERDRIVE = { color: '#ff2bd6', g: 'O' };
LH.EXTRA_DROPS.push('OVERDRIVE', 'OVERDRIVE');
{
    const _m_apply = GameEngine.prototype.applyPower;
    GameEngine.prototype.applyPower = function (key) {
        if (key === 'OVERDRIVE') {
            const p = this.player; this.odT = 6.5; this.spawnText(p.x, p.y - 30, '¡SOBRECARGA!', '#ff2bd6');
            this.rings.push({ x: p.x, y: p.y, max: 240, life: 0.45, maxLife: 0.45, col: '#ff2bd6' }); this.addShake(10); audio.playAnnounce(1);
            return;
        }
        return _m_apply.call(this, key);
    };
    const _m_shoot = Player.prototype.shoot;
    Player.prototype.shoot = function () { const r = _m_shoot.call(this); if (engine.odT > 0 && this.fireCooldown > 0.02) this.fireCooldown *= 0.5; return r; };
    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this.odT = 0; this._boomD = 0; };
    const _m_post = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _m_post.call(this, dt);
        if (this.state !== 'PLAYING' || this.hitStop > 0) return;
        if (this.odT > 0) this.odT -= dt;
        const el = document.getElementById('fxChips'); if (!el) return;
        let c = el.querySelector('.fx.o');
        if (this.odT > 0) { if (!c) { c = document.createElement('span'); c.className = 'fx o'; el.appendChild(c); } const t = 'SOBRECARGA ' + Math.ceil(this.odT); if (c._t !== t) { c._t = t; c.textContent = t; } }
        else if (c) c.remove();
    };
    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        if (!(this.odT > 0) || this.state !== 'PLAYING' || this.player.hp <= 0) return;
        const p = this.player, f = 0.5 + 0.5 * Math.sin(this.time * 24);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,43,214,' + (0.25 + 0.35 * f).toFixed(3) + ')'; ctx.lineWidth = 3;
        ctx.setLineDash([6, 8]); ctx.lineDashOffset = -this.time * 60; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, TAU); ctx.stroke(); ctx.restore();
    };
}

// ---------------------------------------------------------------- MEJORAS NUEVAS: CRÍTICOS y DETONACIÓN
LH.UPS.push(
    { id: 'crit', cat: 'atk', name: 'CRÍTICOS', desc: '+8% de que una bala haga doble daño', max: 4 },
    { id: 'boom', cat: 'atk', name: 'DETONACIÓN', desc: 'Los enemigos explotan al morir y dañan a los cercanos', max: 3 }
);
{
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const cl = LH.lvl('crit');
        if (cl && !melee && !en.dead && Math.random() < 0.08 * cl) {
            dmg *= 2;
            if (this.time - (LH._crT || -9) > 0.3) { LH._crT = this.time; this.spawnText(en.x, en.y - en.radius - 10, 'CRÍTICO', C.yellow); }
        }
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        const bl = LH.lvl('boom');
        if (bl && alive && en.dead && !en.boss && (this._boomD || 0) < 4) {
            this._boomD = (this._boomD || 0) + 1;
            const R = 55 + 22 * bl, D = 1.5 + 1.5 * bl;
            this.rings.push({ x: en.x, y: en.y, max: R, life: 0.3, maxLife: 0.3, col: '#ffb300' });
            this.spawnParticle(en.x, en.y, '#ffb300', 14, 0, 0, 380);
            if (this.time - (LH._bmT || -9) > 0.12) { LH._bmT = this.time; try { LH.panned(en.x, () => audio.playTick()); } catch (e) {} }
            try {
                for (const n of this.enemies) {
                    if (n === en || n.dead) continue;
                    const d = dist(en.x, en.y, n.x, n.y); if (d > R + n.radius) continue;
                    const m = Math.max(d, 1); this.hitEnemy(n, D, (n.x - en.x) / m * 300, (n.y - en.y) / m * 300);
                }
            } finally { this._boomD--; }
        }
    };
}

// ---------------------------------------------------------------- consejos
{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const add = (b, t) => { const d = document.createElement('div'); d.className = 'tip'; d.innerHTML = '<b>' + b + '</b>' + t; pane.appendChild(d); };
        add('EN RITMO', 'Con FONDO AL RITMO activado (Ajustes > Gráficos), matar justo después de un golpe de bombo da puntos extra ♪. El fondo reacciona a la música y el color sube con tu combo.');
        add('SOBRECARGA', 'El objeto magenta «O» duplica tu cadencia de disparo durante 6,5 s.');
        add('CRÍTICOS Y DETONACIÓN', 'Dos mejoras nuevas: tus balas pueden hacer doble daño y los enemigos explotan al morir, encadenando explosiones.');
    }
    try { if (LH.paintDaily) LH.paintDaily(); } catch (e) {}
}

// ########## [mejoras8.js] ##########
// =====================================================================
//  MEJORAS v1.2 — va después de mejoras7.js y antes de carga.js
//
//  FIN DE PARTIDA   RANGO (S/A/B/C/D) y estadísticas nuevas: jefes derrotados · multikill máximo · bajas al ritmo
//  JEFE             el jefe late con un halo al compás de la música (con FONDO AL RITMO activo)
// =====================================================================

{
    const _m_reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _m_reset.call(this); this.bossKills = 0; this.mkMax = 0; this.beatKills = 0; };

    const _m_add = GameEngine.prototype.addScore;
    GameEngine.prototype.addScore = function (amount, x, y) {
        const r = _m_add.call(this, amount, x, y);
        if (this.state === 'PLAYING') {
            if ((this._mk || 0) > this.mkMax) this.mkMax = this._mk;
            if (Settings.beatBg && LH.beat.ok && performance.now() - LH.beat.last < 90) this.beatKills++;
        }
        return r;
    };
    const _m_hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _m_hit.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead && en.boss) this.bossKills++;
    };

    // rango: onda alcanzada, con un escalón extra por combo ≥ 50 y otro por derrotar 3 jefes o más
    LH.RANKS = [['D', '#8a8fa8'], ['C', '#00f3ff'], ['B', '#00ff66'], ['A', '#ffe600'], ['S', '#ff007f']];
    LH.rankOf = (e) => {
        let t = e.wave >= 20 ? 4 : e.wave >= 15 ? 3 : e.wave >= 10 ? 2 : e.wave >= 5 ? 1 : 0;
        if (e.maxCombo >= 50) t++;
        if (e.bossKills >= 3) t++;
        return LH.RANKS[Math.min(4, t)];
    };
    const _m_over = Menu.fillOver;
    Menu.fillOver = function (e) {
        _m_over.call(this, e);
        const el = document.getElementById('overStats'); if (!el) return;
        const cell = (k, v, st) => `<div class="stat"><span class="stat-k">${k}</span><span class="stat-v"${st ? ' style="' + st + '"' : ''}>${v}</span></div>`;
        const rk = LH.rankOf(e);
        let h = cell('RANGO', rk[0], `color:${rk[1]};text-shadow:0 0 14px ${rk[1]};font-size:1.5em`) + cell('JEFES', e.bossKills || 0);
        if (e.mkMax >= 2) h += cell('MULTIKILL', 'x' + e.mkMax);
        if (e.beatKills > 0) h += cell('AL RITMO', e.beatKills);
        el.insertAdjacentHTML('beforeend', '<div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px">' + h + '</div>');   // una sola fila compacta: no empuja los botones fuera de pantalla
    };

    // halo del jefe al compás
    const _m_fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _m_fx.call(this, ctx);
        const b = this.bossRef;
        if (!b || b.dead || !Settings.beatBg || !LH.beat.ok || Settings.calm || Settings.perf || Q.level > 1 || b.gs === 'gone') return;
        const v = LH.beat.v; if (v < 0.05) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = b.color || '#ff007f'; ctx.globalAlpha = Math.min(0.7, v * 0.7); ctx.lineWidth = 3 + 5 * v;
        ctx.beginPath(); ctx.arc(b.x, b.y, (b.rad0 || b.radius) + 10 + 36 * (1 - v), 0, TAU); ctx.stroke(); ctx.restore();
    };
}

// ########## [armas.js] ##########
// ---------------------------------------------------------------- ARMAS EN PIXEL ART + ARMAS DOBLES
// · Cada arma tiene un sprite pixel art (se ve en tu mano y en el HUD). 'a'/'A' = color del arma.
// · Armas dobles: recoge OTRA VEZ la misma arma (escopeta, minigun, katana, láser, arco) o la nueva AKIMBO (2 pistolas).
//   Disparan a la vez (munición: 1 por andanada, cadencia −20 %). Katanas dobles: cortan por delante Y por detrás.
WEAPONS.AKIMBO = { name: 'AKIMBO', fireRate: 0.15, spread: 0.07, speed: 1200, color: '#ff9f1c', damage: 1, type: 'single', recoil: 5, g: 'D', dual: true };
DROP_POOL.push('AKIMBO');
for (const k of ['SHOTGUN', 'MINIGUN', 'KATANA', 'LASER', 'ARC']) WEAPONS[k].canDual = true;
LH.PIX = {
    PISTOL: ['..............', '.kkkkkkkkkkk..', '.kwwwwwwwwwwk.', '.kggggggggAak.', '.kkkkkkgkkkkk.', '.....kdgk.....', '.....kdgk.....', '......kk......'],
    AKIMBO: ['..............', '.kkkkkkkkkkk..', '.kwwwwwwwwwwk.', '.kggggggggAak.', '.kkkkkkgkkkkk.', '.....kdgk.....', '.....kdgk.....', '......kk......'],
    SHOTGUN: ['....................', '..kkkkkkkkkkkkkkkk..', '.kbbbkkwwwwwwwwwwwwk', '.kbbbbkggggggggggaak', 'kbbbbbkkkkkkkkkkkkk.', '.kbbbk.kdddk........', '..kbk...kkk.........'],
    MINIGUN: ['....................', '.......kkkkkkkkkkkk.', '..kkkk.kgggggggggAak', '.kdddkkkwwwwwwwwwwak', '.kdaakkkgggggggggAak', '.kdddk.kkkkkkkkkkkk.', '..kdk..kdk..........', '..kdk...kk..........'],
    KATANA: ['....................', '.........k..........', '.kbkbkbkkAkkkkkkkkkk.', '.kbbbbbbaAwwwwwwwwwwk', '.kbkbkbkkAkgggggggkk.', '.........k...kkkkk...'],
    RAILGUN: ['......................', '..kkkkkkkkkkkkkkkkkkk.', '.kddkAkAkAkAkAkwwwwwwk', '.kddkaAaAaAaAaAggggggAk'.slice(0, 22), '.kkkkkkkkkkkkkkkkkkkk.', '..kdk.kdk.............', '..kdk..kk.............'],
    LASER: ['................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kggddddddgAAak.', '.kkkkkkkkkkkaak.', '....kdgk..kkk...', '....kdgk........', '.....kk.........'],
    ROCKET: ['......................', '.....kkkkkkkkkkkkkoo..', '..kkkkgggggggggggkroor', '.kdddkwwwwwwwwwwwkrooy'.slice(0, 22), '.kdaakggggggggggkkroor'.slice(0, 22), '..kdkkkkkkkkkkkkkkoo..', '..kdk.................', '...kk.................'],
    ARC: ['..............', '..aa......aa..', '.aAAa.kk.aAAa.', '..aakkkkkkaa..', '...kwwwwwwk...', '...kgAAAAgk...', '...kkkkkkkk...', '....kdddk.....', '....kdddk.....', '.....kkk......']
};
LH.pixCache = {};
LH.pixSprite = (key) => {                                  // devuelve un canvas 1 px = 1 pixel del sprite
    const w = WEAPONS[key]; if (!w) return null;
    const base = key === 'AKIMBO' ? 'PISTOL' : key, rows = LH.PIX[key] || LH.PIX[base], ck = key + w.color;
    if (LH.pixCache[ck]) return LH.pixCache[ck];
    const W = Math.max(...rows.map(r => r.length)), cv = document.createElement('canvas'); cv.width = W; cv.height = rows.length;
    const c = cv.getContext('2d'), pal = { k: '#120d1f', w: '#e9edff', g: '#8b91ab', d: '#4b4f69', b: '#8a5230', a: w.color, A: '#ffffff', o: '#ff9a3c', r: '#ff3355', y: '#ffe600' };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; c.fillStyle = ch === 'A' ? LH.mix(w.color) : pal[ch]; c.fillRect(x, y, 1, 1); } });
    return (LH.pixCache[ck] = cv);
};
LH.mix = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v + (255 - v) * 0.55); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
// arma en la mano (se dibuja sobre la nave, mirando hacia donde apuntas)
{
    const _p_draw = Player.prototype.draw;
    Player.prototype.draw = function (ctx) {
        _p_draw.call(this, ctx);
        const sp = LH.pixSprite(Object.keys(WEAPONS).find(k => WEAPONS[k] === this.weapon));
        if (!sp) return;
        const S = 2, kick = ((this.flashT || 0) - engine.time) > 0 ? -2 : 0, ang = this.angle, left = Math.cos(ang) < 0;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(ang); if (left) ctx.scale(1, -1);
        if (this.weapon.type === 'melee' && this.katanaSwingTime > 0) ctx.rotate(-1.1 + (1 - this.katanaSwingTime / 0.2) * 2.2);
        ctx.imageSmoothingEnabled = false;
        const ys = this.dual ? [-9, 9] : [0];
        for (const oy of ys) ctx.drawImage(sp, -4 + kick, oy - sp.height * S / 2, sp.width * S, sp.height * S);
        if (this.dual && this.weapon.type === 'melee') { ctx.rotate(Math.PI); ctx.drawImage(sp, -4, -sp.height * S / 2, sp.width * S, sp.height * S); }
        ctx.restore();
    };
}
// equipar: misma arma otra vez = dobles; AKIMBO = dobles de serie
{
    const _p_equip = Player.prototype.equip;
    Player.prototype.equip = function (key, amount) {
        const W = WEAPONS[key];
        if (!W || EXTRA_PK[key]) return _p_equip.call(this, key, amount);
        if (key === 'AKIMBO' && amount !== Infinity) amount = 120;
        const same = this.weapon === W && W.canDual && isFinite(this.ammo) && isFinite(amount), prev = this.ammo;
        const r = _p_equip.call(this, key, amount);
        if (same) {
            this.ammo = Math.min(prev + this.ammo, Math.round(this.ammo * 2.2));
            if (!this.dual) engine.spawnText(this.x, this.y - 52, '¡DOBLE ' + W.name + '!', W.color);
            this.dual = true;
        } else this.dual = !!W.dual;
        return r;
    };
    const _p_shoot = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        if (!this.dual || this.ammo <= 0 || this.weapon.type === 'rail' || this.weapon.type === 'rocket') return _p_shoot.call(this);
        const x0 = this.x, y0 = this.y, a0 = this.angle, w = this.weapon, melee = w.type === 'melee', fin = isFinite(this.ammo);
        const nx = -Math.sin(a0) * 9, ny = Math.cos(a0) * 9;
        if (!melee) { this.x = x0 + nx; this.y = y0 + ny; }
        _p_shoot.call(this);
        if (this.weapon !== w) { this.x = x0; this.y = y0; this.angle = a0; return; }   // se acabó la munición a media andanada
        if (!melee) { this.x = x0 - nx; this.y = y0 - ny; } else this.angle = a0 + Math.PI;
        if (fin) this.ammo += 1;                                  // las dos armas gastan solo 1 de munición por andanada
        _p_shoot.call(this);
        this.x = x0; this.y = y0; this.angle = a0;
        this.fireCooldown *= 1.2;
    };
}
// HUD: icono pixel art + nombre (con ×2 si son dobles)
LH.wKey = (p) => Object.keys(WEAPONS).find(k => WEAPONS[k] === p.weapon);
LH.wLabel = (p) => (p.dual ? '2× ' : '') + p.weapon.name;
LH.paintWeaponIcon = (p) => {
    const cv = document.getElementById('weaponIcon'); if (!cv) return;
    const key = LH.wKey(p) + (p.dual ? '2' : '');
    if (cv._k === key) return; cv._k = key;
    const sp = LH.pixSprite(LH.wKey(p)); if (!sp) return;
    const n = p.dual ? 2 : 1, gap = 2, c = cv.getContext('2d');
    cv.width = sp.width; cv.height = sp.height * n + gap * (n - 1);
    c.imageSmoothingEnabled = false; c.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < n; i++) c.drawImage(sp, 0, i * (sp.height + gap));
    const sc = (document.body.classList.contains('touch') || sp.width > 20) ? 2 : 3;      // escala ENTERA: todos los píxeles del mismo tamaño
    cv.style.width = sp.width * sc + 'px'; cv.style.filter = 'none';
    const box = cv.closest('.weapon-info'); if (box) box.style.setProperty('--wc', p.weapon.color);   // marco del panel con el color del arma
};

// ########## [pixel.js] ##########
// ---------------------------------------------------------------- PIXEL ART v2 (armas, enemigos y objetos)
// · Armas: sprites de hasta 24×12 con contorno, 4 tonos de metal/madera, brillos y detalles. 'a' 'A' 'q' = acento del arma.
// · Enemigos: se generan por código a resolución de píxel (≈2.4 px de mundo por píxel): contorno neón, núcleo oscuro
//   teñido con 3 bandas + tramado, anillo interior de luz y detalles. Mismo resplandor y mismos tamaños que antes.
// · Objetos: las armas del suelo se ven con su pixel art. Todo se cachea en Spr (cero coste extra por fotograma).
Object.assign(LH.PIX, {
    PISTOL: ['....k..........k...', '...kkkkkkkkkkkkkkk.', '..khhhhwwwwwwwwwwk.', '..kwwwwwwwwwwggggk.', '..kggddwwwwggAAAak.', '..kkkkkkkkkkkkkkkk.', '..kdddsssdk........', '..kkkkkdsk.........', '......kbbBk........', '......kbBBk........', '......kkkkk........'],
    SHOTGUN: ['.......kkkkkkkkkkkkkkkkk', 'kkkkkkkkhhhhhhhhhhhhhhak', 'kbbbbbbkwwwwwwwwwwwwwAak', 'kbhbbbBkggggggggggggaaak', 'kbbbBBBkkkkkkkkkkkkkkkk.', 'kbbBBBkkdddsskBBBBk.....', '.kBBBkk.kkkkkkBBBBk.....', '..kkk.........kkkk......'],
    MINIGUN: ['......kkkkkkkkkkkkkkkk', '.kkkk.khhwwwwwwwwwwwak', 'kdddskkkwgwgwgwgwgwAak', 'kdAAdkkkgdgdgdgdgdgaak', 'kdaadkkkwgwgwgwgwgwAak', 'kdddskkkkkkkkkkkkkkkk.', '.kdskk.kddk...........', '..kdk..kddk...........', '...kk...kk............'],
    KATANA: ['....................', '..........kk..........', '.kbkbkbkkkAAkkkkkkkkkkk', '.kBbBbBkAaAhhhhhhhwwwwwk', '.kbkbkbkkaAwwwwwwggggggk', '..........kkkkkkkkkkkkk.'],
    RAILGUN: ['.......................', '..kkkkkkkkkkkkkkkkkkkkk', '.khhhkAkAkAkAkAkwwwwwwwk', 'kddAdkaAaAaAaAaAggggggAk', 'kddddkkkkkkkkkkkkkkkkkk.', '.kdsk.kddk.............', '..kdk..kk..............'],
    LASER: ['................', '...kkkkkkkkkkk..', '..khhhhhhhhhhhkk', '..kwwwwwwwwwwwwAk', '..kggAAAAAAAggak', '..kkkkkkkkkkkkkk', '.....kdgk.kk....', '.....kdgk.......', '......kk........'],
    ROCKET: ['.....................', '.....kkkkkkkkkkkkkoo.', '..kkkkhhhhhhhhhhhkroor', '.kdddkwwwwwwwwwwwkrooyk', '.kdAakggggggggggkkroor.', '..kdkkkkkkkkkkkkkkoo..', '..kdk.kddk............', '...kk..kk.............'],
    ARC: ['.............kkkkkkkkkk.', '.kkkkkkkkkkkkaAAAAAAAAak', 'khhwwwwwwwwwwkkkkkkkkkk.', 'kwwAAAAAAAwwwwwAaAaAaAa.', 'kggAhhhhAgggggkkkkkkkkk.', 'kkkkkkkkkkkkkaAAAAAAAAak', '.kdddsk......kkkkkkkkkk.', '.kdddsk.................', '..kkkk..................']
});
LH.PIX.AKIMBO = LH.PIX.PISTOL;
LH.pixCache = {};
LH.shade = (hex, k) => {                                    // k<1 oscurece, k>1 aclara
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
LH.pixSprite = (key) => {
    const w = WEAPONS[key]; if (!w) return null;
    const rows = LH.PIX[key]; if (!rows) return null;
    const ck = key + w.color; if (LH.pixCache[ck]) return LH.pixCache[ck];
    const W = Math.max(...rows.map(r => r.length)), cv = document.createElement('canvas'); cv.width = W; cv.height = rows.length;
    const c = cv.getContext('2d'), pal = {
        k: '#0a0614', h: '#ffffff', w: '#dfe6ff', g: '#8f97b8', d: '#555b7c', s: '#2b2f4a', b: '#a8652f', B: '#5c3519',
        a: w.color, A: LH.shade(w.color, 1.6), q: LH.shade(w.color, 0.5), o: '#ff9a3c', r: '#ff3355', y: '#ffe600'
    };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.') { c.fillStyle = pal[ch] || '#f0f'; c.fillRect(x, y, 1, 1); } } });
    return (LH.pixCache[ck] = cv);
};
LH.pxRGB = {};
LH.rgb = (col) => {
    if (LH.pxRGB[col]) return LH.pxRGB[col];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return (LH.pxRGB[col] = [d[0], d[1], d[2]]);
};
LH.tone = (a, k) => { const f = (v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))); return `rgb(${f(a[0])},${f(a[1])},${f(a[2])})`; };
// Genera un cuerpo pixel art n×n. shape(u,v) <= 1 dentro; deco(u,v) devuelve una clave de color o null.
LH.pixBody = (n, color, flash, shape, deco) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), a = LH.rgb(color);
    const P = { w: '#ffffff', r: '#ff2d3d', y: '#ffe600', o: '#ff9a3c', D: '#07020d', m: '#a7aed0', L: LH.tone(a, 1.55) };
    const inn = (x, y) => x >= 0 && y >= 0 && x < n && y < n && shape((x + .5) / n * 2 - 1, (y + .5) / n * 2 - 1) <= 1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (!inn(x, y)) continue;
        const u = (x + .5) / n * 2 - 1, v = (y + .5) / n * 2 - 1, edge = !inn(x - 1, y) || !inn(x + 1, y) || !inn(x, y - 1) || !inn(x, y + 1);
        const rim = !inn(x - 2, y) || !inn(x + 2, y) || !inn(x, y - 2) || !inn(x, y + 2), d = deco(u, v);
        let col;
        if (flash) col = d && d !== 'D' ? '#ffffff' : (edge ? '#ffffff' : '#cfd6ff');
        else if (d) col = P[d];
        else if (edge) col = LH.tone(a, 1.2);
        else if (rim) col = LH.tone(a, 0.6);
        else { const l = -u * 0.55 - v * 0.75 + (((x + y) & 1) ? 0.07 : -0.07); col = LH.tone(a, l > 0.8 ? 0.5 : l > 0.3 ? 0.36 : l > -0.2 ? 0.24 : 0.13); }
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return cv;
};
LH.pixDraw = (c, r, color, flash, shape, deco) => {
    const S = r * 2.2, n = Math.max(12, Math.min(34, Math.round(S / 2.4)));
    c.imageSmoothingEnabled = false; c.shadowBlur = 16; c.shadowColor = color;
    c.drawImage(LH.pixBody(n, color, flash, shape, deco), -S / 2, -S / 2, S, S);
};
const ab = Math.abs, hyp = Math.hypot;
LH.SH = {
    drone: (u, v) => hyp(u, v),
    tank: (u, v) => Math.pow(u ** 4 + v ** 4, 0.25),
    diamond: (u, v) => ab(u) + ab(v),
    dart: (u, v) => { if (u < -0.8 || u > 1 || (u < -0.45 && ab(v) < 0.18)) return 2; return ab(v) / Math.max(0.001, 0.9 * (1.08 - u) / 1.88); },
    blob: (u, v) => Math.min(hyp((u - 0.4) / 0.62, v / 0.78), hyp((u + 0.4) / 0.62, v / 0.78)),
    shield: (u, v) => (ab(u) > 1 ? 2 : ab(v) / (u < 0.55 ? 1 : 1 - (u - 0.55) * 0.67))
};
LH.DE = {
    drone: (u, v) => ab(v + 0.02) < 0.22 && ab(u) < 0.7 ? (ab(u) < 0.2 ? 'r' : 'D') : (ab(u) > 0.55 && ab(u) < 0.75 && ab(v - 0.52) < 0.13 ? 'L' : null),
    tank: (u, v) => ab(u) < 0.12 && ab(v) < 0.12 ? 'w' : (ab(u) < 0.3 && ab(v) < 0.3 ? 'L' : (ab(u) > 0.55 && ab(u) < 0.76 && ab(v) > 0.55 && ab(v) < 0.76 ? 'm' : (ab(u) < 0.06 && ab(v) > 0.4 ? 'D' : null))),
    diamond: (u, v) => hyp(u, v) < 0.1 ? 'w' : hyp(u, v) < 0.24 ? 'r' : (u > 0.24 && u < 0.92 && ab(v) < 0.12 ? (u > 0.74 ? 'r' : 'm') : null),
    dart: (u, v) => ab(v) < 0.13 && u > -0.05 && u < 0.4 ? (ab(v) < 0.06 ? 'r' : 'w') : (u < -0.6 && ab(v) < 0.5 ? (u < -0.72 ? 'y' : 'o') : (u < -0.05 && u > -0.55 && Math.floor((u + ab(v) * 1.2) * 5) % 2 === 0 ? 'L' : null)),
    blob: (u, v) => { const d1 = hyp(u - 0.4, v), d2 = hyp(u + 0.4, v); return d1 < 0.09 || d2 < 0.09 ? 'w' : (d1 < 0.22 || d2 < 0.22 ? 'L' : (ab(u) < 0.07 && ab(v) > 0.32 ? 'D' : null)); },
    shield: (u, v) => u > 0.5 && u < 0.7 && ab(v) < 0.55 ? 'L' : ((ab(u + 0.6) < 0.06 || ab(u + 0.2) < 0.06) && ab(v) < 0.62 ? 'D' : null)
};
enemyBody = function (c, t, r, color, flash) { const k = t === 1 ? 'tank' : t === 2 ? 'diamond' : 'drone'; LH.pixDraw(c, r, color, flash, LH.SH[k], LH.DE[k]); };
kindBody = function (c, kind, r, color, flash) { const k = kind === 'kami' ? 'dart' : 'blob'; LH.pixDraw(c, r, color, flash, LH.SH[k], LH.DE[k]); };
LH.pixShield = (c, r, flash) => LH.pixDraw(c, r, SHIELD_COL, flash, LH.SH.shield, LH.DE.shield);
// armas en el suelo: se ven con su pixel art, flotando y con un ligero balanceo
{
    const _pk = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        const t = this.itemType, sp = WEAPONS[t] && !EXTRA_PK[t] ? LH.pixSprite(t) : null;
        if (!sp) return _pk.call(this, ctx);
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
        const k = this.boost, y = this.y + this.floatY, S = 1.7 * k, h = Spr.halo(this.color);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(h.cv, this.x - h.w * k * 0.7, y - h.h * k * 0.7, h.w * k * 1.4, h.h * k * 1.4);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(this.x, y); ctx.rotate(Math.sin(engine.time * 3) * 0.18 - 0.2); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sp, -sp.width * S / 2, -sp.height * S / 2, sp.width * S, sp.height * S); ctx.restore();
    };
}

// ########## [pixel3.js] ##########
// ---------------------------------------------------------------- PIXEL ART v3 (protagonista, enemigos, jefes, balas, objetos)
// · Protagonista: héroe cenital (mochila, casco con visera, manos que sujetan el arma) dibujado en una rejilla de 24×22 píxeles,
//   con animación de zancada al moverse. Gira EN la rejilla de arte (32 ángulos, vecino más cercano) y se amplía a escala entera.
// · Enemigos: sprites dibujados a mano de 2 fotogramas (parpadeo de ojos, llamas, patas). Rampa de 5 tonos del color del enemigo,
//   contorno oscuro y aura de píxeles (tramado) en vez de resplandor borroso.
// · Jefes y minijefes: coraza poligonal generada píxel a píxel con luz fija (placas, remaches, jaula interior que gira en contra).
// · Balas: proyectiles cuadrados con estela de 3 píxeles. Objetos (corazón, escudo, reloj, imán, bomba): iconos pixel art.
// Sustituye por ganchos (LH.drawHero, LH.drawBig, LH.eFrame…) llamados desde motor.js; si no existen, se usa el dibujo antiguo.
LH.PX = true;
LH.now = () => (engine ? engine.time : 0);
LH.SPR = {"drone": ["half", ["....kkkk", "..kkcccl", ".kcllhhh", ".kcllhhl", "kkcllllm", "kGkcmmmd", "kgGkddkk", "kgGkkrww", "kgGkkrrE", "kgGkddkk", "kGkcmmmd", "kkcllllm", ".kcllmmm", "..kkcddd", "...kkkkk", "....zZzZ"]], "tank": ["half", ["kkkkkkkkkk", "kcccccccck", "kclllllllc", "kclkkkkkkk", "kclkmmmmmm", "kclkmcccll", "kclkmclhhh", "kclkmclhww", "kclkmclhwk", "kclkmcllll", "kclkmcllll", "kclkmclhwk", "kclkmclhww", "kclkmclhhh", "kclkmcccll", "kclkmmmmmm", "kclkkkkkkk", "kclllllllc", "kcdddddddk", "kkkkkkkkkk"]], "diamond": ["half", [".......k", "......kc", ".....kcl", "....kclm", "...kclmd", "..kclmdk", ".kclmkrr", "kclmkrww", "kclmkrwE", ".kclmkrr", "..kclmdk", "...kclmd", "....kclm", ".....kcl", "......kc", ".......k"]], "swarm": ["half", ["..kk", ".kcc", "kcll", "kchw", "kcll", ".kcm", ".xk.", "x..x"]], "split": ["half", ["....kkkkkk", "..kkcccclc", ".kcllllhhh", "kcllhhhhwk", "kclhhwwkrr", "kclhwkkrww", "kcllhkkrwE", "kcllllkrrk", "kcmmllhhhc", ".kdmmcllhh", "..kddmmccl", "...kkdddmm", ".....kkkkk"]], "kami": ["top", ["...........kk.......", "..........kccl......", ".....kkkkkkcllk.....", "....kcllllllhhhlk...", ".zZkclhhhhhhhwwwwlk.", "zZzkkkkmmmmcllwrrrk.", "zZzZkdddddmmmcccckk."]], "sniper": ["top", ["...kkkkkk..........", "..kkllllkk.........", ".kllhhhhllk........", "kcllhwwwhllk.......", "kcllhwrrwhllkkkkkkkkk", "kclllhwwhlllkwwwwwwwk", "kcmmmllllllmkgggggggG", "kcdmmmmmmmmdkkkkkkkkk"]], "shield": ["top", [".........kkkk", ".......kkcccc", ".....kkcllllh", "....kclllhhhh", "...kcllhhwwww", "..kclmmhwwkk", "..kcmdmhwkgg", ".kcmddmhwkGg", ".kcmdkkhwkGg", ".kcdkmmmhkkk"]], "heart": ["half", ["..kkk.", ".kcllk", "kcllhh", "kclhhw", "kcllhh", ".kcllh", "..kcml", "...kcm", "....kk"]], "pshield": ["half", ["kkkkkk", "kcccll", "kclllh", "kcllhh", "kcllhw", "kcllhw", "kcmllh", ".kcmll", "..kcml", "...kcc", "....kk"]], "hourglass": ["both", ["kkkkkk", "kcllhh", "kkclhh", ".kcmlh", "..kcyy", "...kyy"]], "magnet": ["half", ["kkkkk.", "krrrk.", "kwwwk.", "kcllk.", "kcllk.", "kcllk.", "kcllkk", "kcmlll", ".kcmlh", "..kccl", "...kkk"]], "bomb": ["half", ["......y", ".....oo", "....koo", "..kkkkc", ".kccllh", "kcllhhh", "kclhwhh", "kcllhhh", "kcmlllh", "kcmmlll", ".kcmmll", "..kkddd"]]};
const _px_tone = (a, k) => LH.tone(a, k);
LH.expand = (name) => {                                   // rejilla completa (array de filas) a partir de la mitad guardada
    const [mode, rows0] = LH.SPR[name], w = Math.max(...rows0.map(r => r.length)), rows = rows0.map(r => r.padEnd(w, '.'));
    if (mode === 'half') return rows.map(r => r + r.split('').reverse().join(''));
    if (mode === 'top') return rows.concat(rows.slice().reverse());
    const h = rows.map(r => r + r.split('').reverse().join('')); return h.concat(h.slice().reverse());
};
LH.eCache = {};
LH.eArt = (name, frame, color, flash) => {                // canvas con 2 px de margen para el aura
    const ck = name + '|' + frame + '|' + color + '|' + (flash ? 1 : 0); if (LH.eCache[ck]) return LH.eCache[ck];
    const rows = LH.expand(name), w = rows[0].length, h = rows.length, P = 2, a = LH.rgb(color);
    const pal = { k: '#0a0614', d: _px_tone(a, 0.28), m: _px_tone(a, 0.5), c: color, l: _px_tone(a, 1.45), h: _px_tone(a, 1.9), w: '#ffffff', r: '#ff2d3d', y: '#ffe600', o: '#ff9a3c', g: '#8f97b8', G: '#4b5170', E: frame ? '#0a0614' : '#ff2d3d', z: '#ffe600', Z: '#ff9a3c' };
    const cv = document.createElement('canvas'); cv.width = w + P * 2; cv.height = h + P * 2; const c = cv.getContext('2d');
    const solid = (x, y) => { const ch = rows[y] && rows[y][x]; if (!ch || ch === '.') return false; if (frame ? ch === 'x' : (ch === 'z' || ch === 'Z')) return false; return true; };
    for (let y = -P; y < h + P; y++) for (let x = -P; x < w + P; x++) {
        if (solid(x, y)) {
            const ch = rows[y][x]; let col = ch === 'x' ? pal.o : pal[ch];
            if (flash && ch !== 'k') col = (ch === 'h' || ch === 'l') ? '#ffffff' : '#dfe6ff';
            c.fillStyle = col || '#f0f'; c.fillRect(x + P, y + P, 1, 1);
        } else {
            let d = 9; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (solid(x + i, y + j)) d = Math.min(d, Math.abs(i) + Math.abs(j));
            if (d === 1 && ((x + y) & 1) === 0 || d === 2 && (x & 1) === 0 && (y & 1) === 0) { c.fillStyle = color; c.globalAlpha = d === 1 ? 0.45 : 0.28; c.fillRect(x + P, y + P, 1, 1); c.globalAlpha = 1; }
        }
    }
    return (LH.eCache[ck] = cv);
};
LH.eDraw = (c, name, fr, color, flash, r) => {
    const a = LH.eArt(name, fr, color, flash), rows = LH.SPR[name][1], iw = Math.max(...rows.map(q => q.length)) * (LH.SPR[name][0] === 'half' || LH.SPR[name][0] === 'both' ? 2 : 1), ih = rows.length * (LH.SPR[name][0] === 'top' || LH.SPR[name][0] === 'both' ? 2 : 1);
    const S = Math.max(1.6, Math.min(3.4, 2.2 * r / Math.max(iw, ih)));
    c.imageSmoothingEnabled = false; c.drawImage(a, -a.width * S / 2, -a.height * S / 2, a.width * S, a.height * S);
};
enemyBody = function (c, t, r, color, flash, fr) { LH.eDraw(c, ['drone', 'tank', 'diamond', 'swarm'][t] || 'drone', fr | 0, color, flash, r); };
kindBody = function (c, kind, r, color, flash, fr) { LH.eDraw(c, kind === 'kami' ? 'kami' : 'split', fr | 0, color, flash, r); };
LH.sniperBody = (c, r, flash, fr) => LH.eDraw(c, 'sniper', fr | 0, SNIPE_COL, flash, r);
LH.pixShield = (c, r, flash) => LH.eDraw(c, 'shield', 0, SHIELD_COL, flash, r);
ENEMY_SPR[3] = ['e3n', 'e3f'];
LH.eFrame = (e) => { if (e._ph === undefined) e._ph = Math.random() * 2; return Math.floor(LH.now() * 4 + e._ph) & 1; };

// ---------------------------------------------------------------- PROTAGONISTA
LH.heroGrid = (frame, dual, blink) => {
    const W = 24, H = 22, g = Array.from({ length: H }, () => Array(W).fill(null));
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const ell = (ex, ey, rx, ry, fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + .5 - ex) / rx, v = (y + .5 - ey) / ry; if (u * u + v * v <= 1) fn(x, y, u, v); } };
    const st = [0, 3, -3][frame];
    rect(8 + st, 3, 5, 3, '#0d1530'); rect(11 + st, 3, 2, 3, '#00b8cc');          // botas (zancada)
    rect(8 - st, 18, 5, 3, '#0d1530'); rect(11 - st, 18, 2, 3, '#00b8cc');
    rect(1, 7, 5, 8, '#4b5170'); rect(1, 7, 5, 2, '#8b91ab'); rect(1, 13, 5, 2, '#2d3250');   // mochila
    set(2, 10, blink ? '#ffffff' : '#00f3ff'); set(2, 11, blink ? '#00f3ff' : '#087782'); set(3, 10, '#2d3250'); set(3, 11, '#2d3250');
    ell(9.5, 10.5, 6, 8.4, (x, y, u, v) => { const l = -u * .45 - v * .85; set(x, y, l > .6 ? '#4a9be0' : l > .15 ? '#2b7fc0' : l > -.35 ? '#1d5f9c' : '#124a78'); });
    rect(7, 2, 6, 2, '#00d9ee'); rect(8, 2, 3, 1, '#9ffcff'); rect(7, 18, 6, 2, '#0098ad'); rect(8, 18, 3, 1, '#00d9ee');   // hombreras
    rect(6, 10, 4, 2, '#5ffbff'); rect(6, 10, 1, 2, '#ffffff');                     // cresta de la mochila al casco
    ell(12.5, 10.5, 5.7, 5.7, (x, y) => { if (g[y][x]) set(x, y, '#0b1a3a'); });
    ell(12.5, 10.5, 4.7, 4.7, (x, y, u, v) => { const l = -u * .4 - v * .85; set(x, y, l > .55 ? '#7d9fe0' : l > .05 ? '#566fba' : l > -.4 ? '#3a4f93' : '#26356b'); });
    for (let y = 7; y < 15; y++) for (let x = 14; x < 19; x++) { const u = (x + .5 - 12.5) / 4.7, v = (y + .5 - 10.5) / 4.7; if (u * u + v * v <= 1 && u > 0.38 && Math.abs(v) < 0.78) set(x, y, '#00f3ff'); }
    set(16, 8, '#ffffff'); set(16, 9, '#c8ffff'); set(15, 8, '#8afaff');             // brillo de la visera
    rect(10, 9, 4, 3, '#3a4f93'); rect(11, 10, 3, 1, '#5ffbff');                     // placa del casco
    const body = g.map(r => r.map(c => !!c));
    const line = (x0, y0, x1, y1, c, c2) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; set(x, y, c); set(x, y + 1, c2); } };
    const hands = dual ? [[18, 5], [18, 15]] : [[17, 8], [17, 12]];
    line(11, 4, hands[0][0] - 1, hands[0][1], '#2b7fc0', '#1d5f9c'); line(11, 17, hands[1][0] - 1, hands[1][1] + 1, '#1d5f9c', '#124a78');
    for (const [hx, hy] of hands) { rect(hx, hy, 2, 2, '#5ffbff'); set(hx, hy, '#ffffff'); }
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) { const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b] && g[y + b][x + a]); if (nb) out[y][x] = '#02080f'; }
    return out;
};;
LH.heroCache = {};
LH.heroRot = (q, frame, dual, blink) => {
    const ck = [q, frame, dual, blink].join('|'); if (LH.heroCache[ck]) return LH.heroCache[ck];
    const g = LH.heroGrid(frame, dual, blink), art = document.createElement('canvas'); art.width = 24; art.height = 22;
    const a = art.getContext('2d'); g.forEach((row, y) => row.forEach((col, x) => { if (col) { a.fillStyle = col; a.fillRect(x, y, 1, 1); } }));
    const n = 36, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.translate(n / 2, n / 2); c.rotate(q / 32 * TAU); c.drawImage(art, -10, -11);
    return (LH.heroCache[ck] = cv);
};
LH.drawHero = (ctx, p) => {
    ctx.rotate(-p.angle);                                      // el sprite ya viene girado en la rejilla de arte
    const t = LH.now(), moving = Math.hypot(p.vx || 0, p.vy || 0) > 40, frame = moving ? [0, 1, 0, 2][Math.floor(t * 10) & 3] : 0, blink = Math.floor(t * 2) & 1;
    const q = Math.round((((p.angle % TAU) + TAU) % TAU) / TAU * 32) % 32, cv = LH.heroRot(q, frame, p.dual ? 1 : 0, blink);
    const tr = ctx.getTransform(), k = Math.hypot(tr.a, tr.b) || 1, S = Math.max(1, Math.round(2 * k)) / k;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.34)';                       // sombra en píxeles
    for (let j = -3; j <= 3; j++) { const hw = Math.round(Math.sqrt(1 - (j / 3.6) ** 2) * 6); ctx.fillRect(-hw * 2 + 4, j * 2 + 10, hw * 4, 2); }
    ctx.restore();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, -cv.width * S / 2, -cv.height * S / 2, cv.width * S, cv.height * S);
};

// ---------------------------------------------------------------- JEFES Y MINIJEFES
LH.bigCache = {};
LH.bigGrid = (boss, which, step, col, flash) => {
    const outer = which === 'o', N = outer ? (boss ? 8 : 6) : (boss ? 4 : 3), n = outer ? (boss ? 50 : 36) : (boss ? 30 : 22);
    const sector = TAU / N, rot = step / 12 * sector, Rmax = n / 2 - 1.5, a = LH.rgb(col), K = '#0a0614', g = [];
    for (let y = 0; y < n; y++) {
        const row = []; g.push(row);
        for (let x = 0; x < n; x++) {
            const u = x + 0.5 - n / 2, v = y + 0.5 - n / 2, rho = Math.hypot(u, v), ang = Math.atan2(v, u);
            const aa = ((((ang - rot) % sector) + sector) % sector) - sector / 2, Rp = Rmax * Math.cos(Math.PI / N) / Math.cos(aa), light = (-u * 0.5 - v * 0.85) / (n / 2), edgeA = Math.abs(Math.abs(aa) - sector / 2);
            let c = null;
            if (outer) {
                if (rho <= Rp) {
                    const de = Rp - rho;
                    if (rho < Rp * 0.56) c = rho > Rp * 0.56 - 1.3 ? _px_tone(a, 1.5) : (((x + y) & 1) ? '#08030f' : '#0c0618');
                    else if (de < 1.1) c = K;
                    else if (de < 2.3) c = light > 0 ? _px_tone(a, 1.4) : col;
                    else if (edgeA < 0.05) c = K;
                    else if (edgeA > 0.1 && edgeA < 0.2 && Math.abs(rho / Rp - 0.8) < 0.06) c = '#ffffff';
                    else { const l = light + (((x + y) & 1) ? 0.06 : -0.06); c = _px_tone(a, l > 0.35 ? 0.62 : l > 0 ? 0.46 : l > -0.3 ? 0.32 : 0.2); }
                }
            } else if (Math.abs(Rp - rho) < 1.3) c = (rho > Rp * 0.95 && edgeA < 0.22) ? '#ffffff' : (light > 0 ? _px_tone(a, 1.8) : _px_tone(a, 1.25));
            if (c && flash && c !== K) c = '#ffffff';
            row.push(c);
        }
    }
    return g;
};
LH.bigArt = (boss, which, step, col, flash) => {
    const ck = [boss ? 1 : 0, which, step, col, flash ? 1 : 0].join('|'); if (LH.bigCache[ck]) return LH.bigCache[ck];
    const g = LH.bigGrid(boss, which, step, col, flash), cv = document.createElement('canvas'); cv.width = cv.height = g.length; const c = cv.getContext('2d');
    g.forEach((row, y) => row.forEach((col2, x) => { if (col2) { c.fillStyle = col2; c.fillRect(x, y, 1, 1); } }));
    return (LH.bigCache[ck] = cv);
};
LH.drawBig = (ctx, e) => {
    const r = e.radius, t = LH.now(), boss = !!e.boss, col = e.color, N = boss ? 8 : 6, Ni = boss ? 4 : 3, so = boss ? 0.6 : 1.2, si = boss ? -1.2 : -2.4;
    if (!boss) { ctx.fillStyle = C.red; ctx.fillRect(-r, -r - 14, r * 2 * (e.hp / e.maxHp), 5); }
    const st = (ang, N2) => { const s = TAU / N2; return Math.floor((((ang % s) + s) % s) / s * 12) % 12; };
    const o = LH.bigArt(boss, 'o', st(t * so, N), col, false), i = LH.bigArt(boss, 'i', st(t * si, Ni), col, false);
    const So = r / (o.width / 2 - 1.5), Si = r * 0.55 / (i.width / 2 - 1.5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o, -o.width * So / 2, -o.height * So / 2, o.width * So, o.height * So);
    ctx.drawImage(i, -i.width * Si / 2, -i.height * Si / 2, i.width * Si, i.height * Si);
    const pr = r * 0.3, u = Math.max(3, pr * 2 / 7);                       // núcleo que late (círculo de cuadrados)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * (6 + (1 - e.hp / e.maxHp) * 14));
    for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) if (j * j + k * k <= 9) ctx.fillRect(Math.round((k * u - u / 2) / 2) * 2, Math.round((j * u - u / 2) / 2) * 2, u, u);
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(-u, -u, u * 2, u * 2);
};

// ---------------------------------------------------------------- BALAS
GameEngine.prototype.drawBullets = function (ctx) {
    const B = this.bullets; if (!B.length) return;
    const U = 3; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < B.length; i++) {
        const b = B[i], s = Math.max(U, Math.round(b.radius * 1.6 / U) * U), col = b.color, dx = b.tx - b.x, dy = b.ty - b.y;
        ctx.fillStyle = col;
        for (let k = 3; k >= 1; k--) {                                   // estela: 3 cuadrados que menguan
            const f = k / 3.4, ss = Math.max(U, s - k * U * 0.5 | 0), sz = Math.max(U, Math.round(ss / U) * U);
            ctx.globalAlpha = 0.5 - k * 0.12; ctx.fillRect(Math.round((b.x + dx * f - sz / 2) / U) * U, Math.round((b.y + dy * f - sz / 2) / U) * U, sz, sz);
        }
        ctx.globalAlpha = 0.9; ctx.fillRect(Math.round((b.x - s / 2) / U) * U, Math.round((b.y - s / 2) / U) * U, s, s);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; const c = Math.max(U, s - U * 2); ctx.fillRect(Math.round((b.x - c / 2) / U) * U, Math.round((b.y - c / 2) / U) * U, c, c);
    }
    ctx.restore();
};

// ---------------------------------------------------------------- OBJETOS (corazón, escudo, reloj de arena, imán, bomba)
{
    const ICON = { HEALTH: 'heart', SHIELD: 'pshield', SLOW: 'hourglass', MAGNET: 'magnet', NUKE: 'bomb' };
    const _pk2 = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        const nm = ICON[this.itemType]; if (!nm) return _pk2.call(this, ctx);
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
        const k = this.boost, y = this.y + this.floatY, h = Spr.halo(this.color), a = LH.eArt(nm, 0, this.color, false), S = 1.9 * k;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(h.cv, this.x - h.w * k * 0.6, y - h.h * k * 0.6, h.w * k * 1.2, h.h * k * 1.2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
        const bob = Math.round(Math.sin(LH.now() * 5) * 1.5);
        ctx.drawImage(a, Math.round(this.x - a.width * S / 2), Math.round(y - a.height * S / 2) + bob, a.width * S, a.height * S);
    };
}
{
    const _px_warm = warmSprites;
    warmSprites = function () {
        _px_warm();
        try { for (const n of Object.keys(LH.SPR)) for (const f of [0, 1]) for (const fl of [0, 1]) LH.eArt(n, f, n === 'sniper' ? SNIPE_COL : n === 'shield' ? SHIELD_COL : '#ff007f', fl); } catch (e) {}
    };
}

// ########## [carga.js] ##########
// =====================================================================
//  PANTALLA DE CARGA — precarga todo ANTES de poder jugar (va la ÚLTIMA)
//
//  Qué prepara, en orden:
//   1. Motor gráfico: el juego, los menús, los controles y los sprites con resplandor (warmSprites).
//   2. Efectos de sonido: ruido y reverbs (salas) que antes se creaban al primer clic.
//   3. Música: el worker compila los temas, mide el dispositivo y ENSAYA el render completo
//      (luchas, jefe, descanso y cruces entre temas). Hasta que no avisa 'ready' no se juega.
//
//  Mientras carga se bloquean los clics y teclas (así la música no arranca a medias).
//  Si algo tarda más de 15 s, el juego entra igualmente (no se queda atascado).
// =====================================================================
const Loader = (() => {
    const el = document.getElementById('loader');
    const fill = document.getElementById('ldFill');
    const stepEl = document.getElementById('ldStep');
    const pctEl = document.getElementById('ldPct');
    const MIN_MS = 700;                         // para que no parpadee si todo está en caché
    const t0 = performance.now();
    let value = 0, finished = false;

    const block = (e) => { if (!finished) e.stopPropagation(); };   // sin preventDefault: F5 y demás siguen funcionando
    const EVS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown', 'keyup', 'contextmenu'];
    EVS.forEach(ev => window.addEventListener(ev, block, true));

    function set(v, text) {
        value = Math.max(value, Math.min(100, v));
        fill.style.width = value + '%';
        pctEl.textContent = Math.round(value) + '%';
        if (text) stepEl.textContent = text;
    }
    // cede el control al navegador para que se pinte la barra entre pasos
    const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[carga]', e); } };

    async function finish(musicOk) {
        if (finished) return;
        set(100, musicOk ? 'LISTO' : 'LISTO (SIN PRECARGA COMPLETA)');
        const wait = Math.max(0, MIN_MS - (performance.now() - t0));
        await new Promise(r => setTimeout(r, wait + 150));
        finished = true;
        EVS.forEach(ev => window.removeEventListener(ev, block, true));
        el.classList.add('done');
        setTimeout(() => el.remove(), 600);
    }

    async function run() {
        // 1. Motor gráfico (el juego ya se creó en window.onload; aquí se calientan sus sprites)
        set(8, 'CARGANDO MOTOR…'); await tick();
        safe(() => { if (typeof Spr !== 'undefined') Spr.sync(); });
        safe(() => warmSprites());
        set(35, 'PREPARANDO GRÁFICOS…'); await tick();

        // 2. Efectos de sonido (ruido + reverbs)
        set(40, 'CARGANDO EFECTOS…'); await tick();
        safe(() => audio._sfxInit());
        set(55, 'CARGANDO MÚSICA…'); await tick();

        // 3. Música: espera al aviso del worker; mientras, la barra avanza despacio hasta el 95 %
        const slow = setTimeout(() => el.classList.add('slow'), 4000);
        const creep = setInterval(() => { if (value < 95) set(value + (95 - value) * 0.06); }, 150);
        const ok = await new Promise(res => audio.music.whenReady(res, 15000));
        clearTimeout(slow); clearInterval(creep);
        el.classList.remove('slow');
        set(97, 'AFINANDO…'); await tick();
        await finish(ok);
    }
    setTimeout(() => finish(false), 20000);     // seguro: si algo falla antes de cargar, la pantalla no se queda para siempre
    return { run };
})();

const _onloadCarga = window.onload;
window.onload = function () {
    _onloadCarga.call(this);
    Loader.run();
};
