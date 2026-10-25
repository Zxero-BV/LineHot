// ########## [mejoras10.js] ##########
// =====================================================================
//  v2.0 — TRES MINIJEFES NUEVOS Y UN JEFE NUEVO: "ECLIPSE"   (va justo antes de carga.js)
//
//  MINIJEFES (tipos 11-13; salen desde la oleada 6, en las pares que no son de jefe)
//   · PRISMA   (triángulo cian)   fija 3 líneas de aviso y dispara 5 ráfagas de balas rapidísimas por ellas.
//   · PULSAR   (estrella dorada)  lleva 6 orbes que giran a su alrededor (queman); los suelta en todas direcciones y queda aturdido.
//   · TEJEDOR  (araña verde)      se lanza en embestidas dejando un rastro de chispas que quema unos segundos.
//
//  JEFE ECLIPSE (3.er jefe: oleada 15)  un sol negro con corona dorada. Ataques en rotación:
//   · EMBERS     abanico de brasas hacia ti
//   · METEOROS   círculos naranjas que se cierran (1 s) y caen; el primero apunta a donde estás
//   · GRAVEDAD   te arrastra hacia él mientras suelta anillos de brasas con hueco (aléjate a máxima velocidad)
//   · SUPERNOVA  se carga 1,5 s y lanza un anillo expansivo con un HUECO: cruza por la abertura
//  FASES   2: más meteoros y 2 ondas de supernova · 3: 9 meteoros, 3 ondas y brasas en anillo
//  Consola para probarlo: LH.saltar(15)  (salta a esa oleada)
// =====================================================================
const MN_PR = '#2ff3ff', MN_PU = '#ffd23f', MN_TE = '#9dff3a', EC_NAME = 'ECLIPSE', EC_COL = '#ff9a1f';
LH.MININAMES = { 11: 'PRISMA', 12: 'PULSAR', 13: 'TEJEDOR' };
LH.BOSSES.splice(2, 0, [EC_NAME, EC_COL]);
LH.mnPoly = (c, x, y, r, n, rot) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };

{
    // ------------------------------------------------------------ creación
    const _mk = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        if (t >= 11 && t <= 13) {
            const e = new Enemy(0, x, y, hp);
            e.mini = true; e.mk = t; e.nm = LH.MININAMES[t]; e.st = 'move'; e.stt = 0; e.cd = 1.4 + Math.random(); e.aim = 0; e.oa = 0; e.spin = 0;
            if (t === 11) { e.radius = 34; e.color = MN_PR; e.maxHp = e.hp = 14 * hp; e.speed = 95; e.dmg = 22; }
            else if (t === 12) { e.radius = 36; e.color = MN_PU; e.maxHp = e.hp = 17 * hp; e.speed = 70; e.dmg = 24; e.orbs = 6; e.orbR = 76; }
            else { e.radius = 30; e.color = MN_TE; e.maxHp = e.hp = 13 * hp; e.speed = 110; e.dmg = 22; e.trail = 0; }
            return e;
        }
        const e = _mk(t, x, y, hp);
        if (t === 5 && e.bossName === EC_NAME) {
            e.eclipse = true; e.tier = 1;                          // tier 1: sin orbes ni láser giratorio de otros jefes
            e.radius = 62; e.maxHp = e.hp = e.maxHp * 0.95;
            e.es = 'drift'; e.est = 0; e.act = -1; e.met = []; e.nq = 0; e.nqT = 0;
        }
        return e;
    };
    const _ai = Enemy.prototype.bossAI;
    Enemy.prototype.bossAI = function (dt, px, py) { return this.eclipse ? LH.eclipseAI(this, dt, px, py) : _ai.call(this, dt, px, py); };
    const _up = Enemy.prototype.update;
    Enemy.prototype.update = function (dt, px, py) { return this.mini ? LH.miniNewAI(this, dt, px, py) : _up.call(this, dt, px, py); };
    const _dr = Enemy.prototype.draw;
    Enemy.prototype.draw = function (ctx) { return this.mini ? LH.miniNewDraw(ctx, this) : _dr.call(this, ctx); };

    const _rs = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _rs.call(this); this.pools = []; this.novas = []; this.miniN = 0; };

    // ------------------------------------------------------------ cuándo salen los minijefes nuevos
    const _sw = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        this.pools = []; this.novas = [];
        _sw.call(this);
        const w = this.wave, q = this.queue;
        if (w >= 6 && w % 5 !== 0 && w % 2 === 0) {
            const n = w >= 20 ? 2 : 1, names = [];
            for (let k = 0; k < n; k++) {
                const t = 11 + ((this.miniN = this.miniN || 0) % 3); this.miniN++; names.push(LH.MININAMES[t]);
                const i = (k === 0 && w % 4 === 0) ? q.findIndex(s => s.t === 4) : -1;      // en las de minijefes clásicos sustituye a uno
                if (i >= 0) q[i] = { t, n: 1, d: 1.5 }; else q.splice(Math.floor(Math.random() * (q.length + 1)), 0, { t, n: 1, d: 1.5 });
            }
            this.spawnText(width / 2, height * 0.53, 'MINIJEFE · ' + names.join(' + '), C.yellow);
            audio.music.call('setWaveSize', q.reduce((a, x) => a + x.n, 0));
        }
    };

    // ------------------------------------------------------------ recompensa al derrotar un minijefe nuevo
    const _he = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _he.call(this, en, dmg, fx, fy, melee);
        if (alive && en.dead && en.mini) {
            this.spawnParticle(en.x, en.y, en.color, 120, fx * 0.3, fy * 0.3, 700, 'blood'); this.spawnParticle(en.x, en.y, C.white, 24, 0, 0, 380);
            this.rings.push({ x: en.x, y: en.y, max: 190, life: 0.5, maxLife: 0.5, col: en.color });
            this.addShake(30); this.doHitStop(0.12); audio.playExplosion();
            LH.bonus(this, 300, en.x, en.y - 30, 'MINIJEFE ', en.color);
            const k = this.player.hp < this.player.maxHp * 0.7 ? 'HEALTH' : LH.EXTRA_DROPS[Math.floor(Math.random() * LH.EXTRA_DROPS.length)];
            this.pickups.push(new Pickup(en.x, en.y, k));
        }
    };

    // ------------------------------------------------------------ chispas, ondas de supernova (daño) y orden de postUpdate
    const _pp = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _pp.call(this, dt);
        if (this.state !== 'PLAYING' || this.hitStop > 0) return;
        const p = this.player, P = this.pools, N = this.novas;
        if (P && P.length) for (let i = P.length - 1; i >= 0; i--) {
            const o = P[i]; o.t += dt;
            if (o.t > 0.45 && dist(o.x, o.y, p.x, p.y) < 24 + p.radius) LH.glitchHurt(this, 9);
            if (o.t >= o.life) P.splice(i, 1);
        }
        if (N && N.length) {
            if (!this.bossRef) N.length = 0;
            else for (let i = N.length - 1; i >= 0; i--) {
                const o = N[i]; o.r += o.spd * dt;
                if (!o.hit && Math.abs(dist(o.x, o.y, p.x, p.y) - o.r) < p.radius + 9) {
                    const a = Math.atan2(p.y - o.y, p.x - o.x);
                    if (Math.abs(Math.atan2(Math.sin(a - o.gap), Math.cos(a - o.gap))) > o.gw) { o.hit = true; LH.glitchHurt(this, 18); }
                }
                if (o.r > 1300) N.splice(i, 1);
            }
        }
    };
}

// ================================================================ IA DE LOS MINIJEFES
LH.miniNewAI = (e, dt, px, py) => {
    const G = engine, p = G.player;
    e.knockback.x *= 0.85; e.knockback.y *= 0.85; e.stt += dt; e.spin += dt;
    const a = Math.atan2(py - e.y, px - e.x), d = dist(e.x, e.y, px, py);
    const mk = (ang, s, col, dm) => G.bullets.push(new Bullet(e.x, e.y, ang, { speed: s, color: col, damage: dm, name: 'ENEMY_GUN' }, true));
    const go = (st) => { e.st = st; e.stt = 0; };
    let mv = 0, ma = a;

    if (e.mk === 11) {                                                 // ---- PRISMA
        if (e.st === 'move') {
            e.cd -= dt; mv = e.speed; ma = G.steer(e, d < 260 ? a + Math.PI : d > 380 ? a : a + Math.PI / 2);
            if (e.cd <= 0 && d < 620 && G.hasLOS(e)) { e.aim = a; go('charge'); LH.panned(e.x, () => audio.playGlitch('line')); }
        } else if (e.st === 'charge') {
            if (e.stt < 0.6) e.aim = miniTurn(e.aim, a, dt * 2.2);   // las líneas te siguen y a los 0,6 s se fijan
            if (e.stt >= 1.0) { e.vn = 5; e.vt = 0; go('fire'); }
        } else if (e.st === 'fire') {
            e.vt -= dt;
            if (e.vt <= 0) {
                for (let k = -1; k <= 1; k++) mk(e.aim + k * 0.34, 560, MN_PR, 9);
                audio.playShoot('ENEMY_GUN', true); G.addShake(4); e.vt = 0.09;
                if (--e.vn <= 0) go('recover');
            }
        } else if (e.stt >= 1.3) { go('move'); e.cd = 2.4 + Math.random() * 1.2; }
    } else if (e.mk === 12) {                                          // ---- PULSAR
        e.oa += dt * (e.st === 'warn' ? 9 : 2.2);
        if (e.st === 'move') {
            e.cd -= dt; mv = d > 300 ? e.speed : e.speed * 0.3; ma = G.steer(e, a);
            if (e.cd <= 0) go('warn');
        } else if (e.st === 'warn') {
            if (e.stt >= 0.9) {                                        // suelta los orbes
                for (let i = 0; i < 6; i++) mk(e.oa + i / 6 * TAU, 250, MN_PU, 10);
                e.orbs = 0; G.rings.push({ x: e.x, y: e.y, max: 200, life: 0.45, maxLife: 0.45, col: MN_PU });
                G.addShake(14); audio.playGlitch('warp'); go('stun');
            }
        } else if (e.st === 'stun') { if (e.stt >= 1.4) go('grow'); }  // aturdido: es tu momento
        else {                                                         // grow: los orbes vuelven uno a uno
            mv = e.speed; ma = G.steer(e, a); e.orbs = Math.min(6, Math.floor(e.stt / 0.45));
            if (e.orbs >= 6) { go('move'); e.cd = 3.2 + Math.random() * 1.5; }
        }
        for (let i = 0; i < e.orbs; i++) {                              // los orbes queman al tocarte
            const q = e.oa + i / 6 * TAU;
            if (dist(e.x + Math.cos(q) * e.orbR, e.y + Math.sin(q) * e.orbR, p.x, p.y) < p.radius + 9) LH.glitchHurt(G, 10);
        }
    } else {                                                           // ---- TEJEDOR
        if (e.st === 'move') {
            e.cd -= dt; mv = e.speed; ma = G.steer(e, a + Math.sin(e.spin * 3) * 0.5);
            if (e.cd <= 0 && d < 620) { e.aim = a; go('aim'); }
        } else if (e.st === 'aim') {
            if (e.stt < 0.55) e.aim = miniTurn(e.aim, a, dt * 3);
            if (e.stt >= 0.8) { go('dash'); audio.playGlitch('line'); }
        } else if (e.st === 'dash') {
            mv = 560; ma = e.aim;
            if ((e.trail -= dt) <= 0) { e.trail = 0.06; const P = G.pools || (G.pools = []); P.push({ x: e.x, y: e.y, t: 0, life: 3.2 }); if (P.length > 90) P.shift(); }
            if (e.stt >= 0.5) go('rest');
        } else if (e.stt >= 1.1) { go('move'); e.cd = 1.6 + Math.random() * 1.2; }
    }
    e.x += (Math.cos(ma) * mv + e.knockback.x) * dt; e.y += (Math.sin(ma) * mv + e.knockback.y) * dt;
    const hit = miniWalls(e); miniBounds(e);
    if (e.mk === 13 && e.st === 'dash' && hit) go('rest');
};

// ================================================================ IA DE ECLIPSE
LH.eclipseImpact = (m) => {
    const G = engine, p = G.player;
    G.spawnParticle(m.x, m.y, EC_COL, 36, 0, 0, 520, 'blood'); G.spawnParticle(m.x, m.y, C.white, 10, 0, 0, 340);
    G.rings.push({ x: m.x, y: m.y, max: m.r * 1.5, life: 0.4, maxLife: 0.4, col: EC_COL });
    G.addShake(14); if (m.first) audio.playExplosion();
    if (G.state === 'PLAYING' && dist(m.x, m.y, p.x, p.y) < m.r + p.radius) LH.glitchHurt(G, 16);
};
LH.eclipseMeteors = (b, px, py, ph) => {
    const n = ph === 1 ? 5 : ph === 2 ? 7 : 9;
    for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, r = i ? 70 + Math.random() * 250 : 0;
        b.met.push({ x: clamp(px + Math.cos(a) * r, 50, width - 50), y: clamp(py + Math.sin(a) * r, 50, height - 50), r: 64, t: -i * 0.14, w: 1.15, done: false, first: i === 0 });
    }
    audio.playGlitch('warp');
};
LH.eclipseNova = (b) => {
    const G = engine;
    (G.novas || (G.novas = [])).push({ x: b.x, y: b.y, r: b.radius, gap: Math.random() * TAU, gw: 0.5, spd: 340, hit: false });
    G.rings.push({ x: b.x, y: b.y, max: 300, life: 0.5, maxLife: 0.5, col: '#ffffff' });
    G.addShake(30); audio.playExplosion(); haptic([40, 30, 80]);
};
LH.eclipseAI = (b, dt, px, py) => {
    const G = engine, p = G.player, ph = b.phase || 1, rage = ph >= 2;
    b.t += dt; b.fireCooldown -= dt; b.est += dt;
    if (b.recover > 0) b.recover -= dt;
    const d = Math.max(dist(b.x, b.y, px, py), 1), ang = Math.atan2(py - b.y, px - b.x);
    const mk = (a, s, dm = 11) => G.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: EC_COL, damage: dm, name: 'ENEMY_GUN' }, true));

    for (let i = b.met.length - 1; i >= 0; i--) {                      // meteoros en curso
        const m = b.met[i]; m.t += dt;
        if (!m.done && m.t >= m.w) { m.done = true; LH.eclipseImpact(m); }
        if (m.t >= m.w + 0.4) b.met.splice(i, 1);
    }
    if (b.nq > 0 && (b.nqT -= dt) <= 0) { b.nq--; b.nqT = 0.7; LH.eclipseNova(b); }   // ondas extra de supernova

    let vx = 0, vy = 0;
    if (b.es === 'grav') {
        if (b.est > 0.8) {                                             // tras el aviso: arrastra y suelta anillos con hueco
            const k = (rage ? 1250 : 1000) * dt;
            p.kx += (b.x - p.x) / d * k; p.ky += (b.y - p.y) / d * k;
            if (b.fireCooldown <= 0) {
                const n = 20, gap = Math.floor(Math.random() * n);
                for (let i = 0; i < n; i++) if (((i - gap + n) % n) >= 3) mk(i / n * TAU + b.t, 170);
                audio.playShoot('ENEMY_GUN', true); b.fireCooldown = rage ? 0.8 : 1.0;
            }
        }
        if (b.est >= 0.8 + (rage ? 3.4 : 3.0)) { b.es = 'drift'; b.fireCooldown = 1.8; }
    } else if (b.es === 'nova') {                                      // carga: la corona crece
        if (b.est >= 1.5) { LH.eclipseNova(b); b.nq = ph - 1; b.nqT = 0.7; b.es = 'drift'; b.recover = 1.2; b.fireCooldown = 2.2; }
    } else {
        const sp = rage ? 110 : 80, along = d > 360 ? 1 : d < 240 ? -1 : 0, side = Math.sin(b.t * 0.7) * 0.8;
        vx = Math.cos(ang) * sp * along - Math.sin(ang) * sp * side; vy = Math.sin(ang) * sp * along + Math.cos(ang) * sp * side;
        if (b.fireCooldown <= 0 && b.t > 1.6 && !(b.recover > 0)) {
            b.act = (b.act + 1) % 4;
            if (b.act === 0) {                                         // brasas
                const n = ph === 1 ? 3 : ph === 2 ? 5 : 7;
                for (let i = -(n >> 1); i <= (n >> 1); i++) mk(ang + i * 0.16, 380);
                if (ph === 3) for (let i = 0; i < 12; i++) mk(i / 12 * TAU + b.t, 200);
                audio.playShoot('ENEMY_GUN', true); G.addShake(6); b.fireCooldown = rage ? 1.6 : 2.2;
            } else if (b.act === 1) { LH.eclipseMeteors(b, px, py, ph); b.fireCooldown = 2.8; }
            else if (b.act === 2) { b.es = 'grav'; b.est = 0; b.fireCooldown = 0.8; audio.playGlitch('warp'); }
            else { b.es = 'nova'; b.est = 0; audio.playGlitch('warp'); }
        }
    }
    b.x = clamp(b.x + vx * dt, b.radius, width - b.radius); b.y = clamp(b.y + vy * dt, b.radius, height - b.radius);
    for (const o of G.obstacles) { const r = rectCircleCollide(b.x, b.y, b.radius, o.x, o.y, o.w, o.h); if (r.hit) { b.x += r.nx * r.pen; b.y += r.ny * r.pen; } }
};

// ================================================================ DIBUJO
LH.miniNewDraw = (ctx, e) => {
    const G = engine, t = G.time, r = e.radius, col = e.color, P = LH.mnPoly;
    const fl = Math.abs(e.knockback.x) > 50 || Math.abs(e.knockback.y) > 50, cc = fl ? '#ffffff' : col;
    if ((e.mk === 11 && e.st === 'charge') || (e.mk === 13 && e.st === 'aim')) {          // líneas de aviso
        const pr = e.mk === 11, k = Math.min(1, e.stt / (pr ? 1.0 : 0.8)), lock = e.stt > (pr ? 0.6 : 0.55);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (let i = pr ? -1 : 0; i <= (pr ? 1 : 0); i++) {
            const a = e.aim + i * 0.34, L = LH.rayEnd(e.x, e.y, a, pr ? 900 : 520);
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); ctx.lineTo(e.x + Math.cos(a) * L, e.y + Math.sin(a) * L);
            if (lock) { ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(t * 60)) + ')'; ctx.lineWidth = 3; }
            else { ctx.setLineDash([10, 8]); ctx.strokeStyle = (pr ? 'rgba(47,243,255,' : 'rgba(157,255,58,') + (0.25 + 0.5 * k) + ')'; ctx.lineWidth = 1.5 + 1.5 * k; }
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.save(); ctx.translate(e.x, e.y); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    ctx.shadowBlur = 18; ctx.shadowColor = col; ctx.strokeStyle = cc; ctx.lineWidth = 4;
    if (e.mk === 11) {                                                  // PRISMA
        const rot = (e.st === 'charge' || e.st === 'fire') ? e.aim : t * 0.8;
        P(ctx, 0, 0, r, 3, rot); ctx.stroke();
        ctx.lineWidth = 2; ctx.globalAlpha = 0.8; P(ctx, 0, 0, r * 0.55, 3, rot + Math.PI + Math.sin(t * 2) * 0.3); ctx.stroke();
        ['#ff2a8a', '#ffe14d', '#2fffc4'].forEach((c, i) => {           // refracción
            ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(rot + i / 3 * TAU) * r * 0.95, Math.sin(rot + i / 3 * TAU) * r * 0.95); ctx.stroke();
        });
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4 + 2 * Math.sin(t * 10), 0, TAU); ctx.fill();
    } else if (e.mk === 12) {                                           // PULSAR
        const warn = e.st === 'warn', rot = t * 0.5;
        P(ctx, 0, 0, r, 8, rot); ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < 16; i++) { const q = rot + i / 16 * TAU, rr = i % 2 ? r * 0.5 : r * 1.0; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(q) * rr, Math.sin(q) * rr); }
        ctx.closePath(); ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = warn ? '#fff' : cc; ctx.beginPath(); ctx.arc(0, 0, r * 0.3 * (1 + 0.25 * Math.sin(t * (warn ? 30 : 6))), 0, TAU); ctx.fill();
        if (e.orbs > 0) { ctx.setLineDash([4, 10]); ctx.globalAlpha = 0.18; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, e.orbR, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        for (let i = 0; i < e.orbs; i++) {
            const q = e.oa + i / 6 * TAU, ox = Math.cos(q) * e.orbR, oy = Math.sin(q) * e.orbR;
            if (warn) { ctx.globalAlpha = 0.15 + 0.5 * (e.stt / 0.9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ox, oy); ctx.stroke(); }
            ctx.globalAlpha = 1; ctx.fillStyle = warn && Math.floor(t * 24) % 2 ? '#fff' : col; ctx.beginPath(); ctx.arc(ox, oy, 10, 0, TAU); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, TAU); ctx.fill();
        }
    } else {                                                            // TEJEDOR
        const mov = e.st === 'dash' || e.st === 'aim', rot = mov ? e.aim : t * 0.7;
        P(ctx, 0, 0, r, 6, rot); ctx.stroke();
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {                                    // seis patas articuladas
            const s = i % 2 ? 1 : -1, a = rot + i / 6 * TAU + Math.sin(t * (e.st === 'dash' ? 30 : 8) + i * 1.3) * 0.22;
            const kx = Math.cos(a) * r * 1.15, ky = Math.sin(a) * r * 1.15;
            ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.lineTo(kx, ky);
            ctx.lineTo(Math.cos(a + 0.35 * s) * r * 1.75, Math.sin(a + 0.35 * s) * r * 1.75); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = e.st === 'aim' ? '#fff' : cc; P(ctx, 0, 0, r * 0.4, 6, -rot); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = C.red; ctx.fillRect(e.x - r, e.y - r - 16, r * 2 * Math.max(0, e.hp / e.maxHp), 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(e.x - r, e.y - r - 16, r * 2, 4);
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(10 * textBoost())}px Orbitron`; ctx.fillStyle = C.yellow;
    ctx.fillText('MINIJEFE · ' + e.nm, e.x, e.y - r - 24);
    ctx.restore();
};

{
    const _db = Enemy.prototype.drawBig;
    Enemy.prototype.drawBig = function (ctx) {                           // ECLIPSE: corona dorada alrededor de un disco negro
        if (!this.eclipse) return _db.call(this, ctx);
        const G = engine, t = G.time, r = this.radius, ph = this.phase || 1, pl = G.player;
        const ch = this.es === 'nova' ? Math.min(1, this.est / 1.5) : 0, la = Math.atan2(pl.y - this.y, pl.x - this.x);
        const hot = ph === 3 ? '#ff3d2e' : ph === 2 ? '#ff7a1a' : EC_COL;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const R = r * (2.1 + ch * 0.9), g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, R);
        g.addColorStop(0, 'rgba(255,170,40,' + (0.55 + 0.4 * ch) + ')'); g.addColorStop(1, 'rgba(255,90,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        ctx.fillStyle = hot; ctx.globalAlpha = 0.85;                      // rayos de la corona
        for (let i = 0; i < 28; i++) {
            const a = i / 28 * TAU + t * 0.25 * (i % 2 ? 1 : -1), L = r * (1.25 + 0.3 * Math.sin(t * 3 + i * 1.7) + ch * 0.5 + (ph - 1) * 0.08);
            ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.06) * r * 0.95, Math.sin(a - 0.06) * r * 0.95); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.06) * r * 0.95, Math.sin(a + 0.06) * r * 0.95); ctx.fill();
        }
        if (this.es === 'grav') {                                         // anillos que se cierran sobre él
            ctx.lineWidth = 2; ctx.strokeStyle = hot;
            for (let k = 0; k < 3; k++) { const f = (t * 1.2 + k / 3) % 1; ctx.globalAlpha = f * 0.6; ctx.beginPath(); ctx.arc(0, 0, r * (3.2 - f * 2.2), 0, TAU); ctx.stroke(); }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#030006'; ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0, TAU); ctx.fill();          // el disco negro
        ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 20; ctx.shadowColor = '#ffd27a';
        ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r * 0.93, la - 1.1, la + 1.1); ctx.stroke();   // media luna hacia ti
        ctx.shadowBlur = 0; ctx.strokeStyle = hot; ctx.lineWidth = 2; ctx.globalAlpha = 0.45; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff3c4';
        for (let i = 0; i < 3; i++) { const a = t * 1.4 + i * TAU / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, 3.5, 0, TAU); ctx.fill(); }
        ctx.restore();
    };

    const _fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _fx.call(this, ctx);
        const b = this.bossRef, P = this.pools, N = this.novas, hasM = b && b.eclipse && b.met && b.met.length;
        if (!(P && P.length) && !(N && N.length) && !hasM) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (P) for (const o of P) {                                        // chispas del Tejedor
            const live = o.t >= 0.45, k = live ? Math.min(1, (o.life - o.t) / 0.8) : o.t / 0.45;
            ctx.strokeStyle = 'rgba(157,255,58,' + (live ? 0.5 + 0.4 * k : 0.3) + ')'; ctx.fillStyle = 'rgba(157,255,58,' + 0.08 * k + ')';
            ctx.lineWidth = 2; if (!live) ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(o.x, o.y, 24, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
            if (live) {
                const s = Math.floor(this.time * 14 + o.x) % 3, a = s * 2.1 + o.y;
                ctx.strokeStyle = 'rgba(255,255,255,' + 0.7 * k + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o.x - Math.cos(a) * 18, o.y - Math.sin(a) * 18);
                ctx.lineTo(o.x + Math.sin(a) * 6, o.y - Math.cos(a) * 6); ctx.lineTo(o.x + Math.cos(a) * 18, o.y + Math.sin(a) * 18); ctx.stroke();
            }
        }
        if (N) for (const o of N) {                                        // supernova: anillo con hueco
            const a0 = o.gap + o.gw, a1 = o.gap + TAU - o.gw, f = Math.max(0.35, 1 - o.r / 1300);
            ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,122,26,' + 0.5 * f + ')'; ctx.lineWidth = 22;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r, a0, a1); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,240,200,' + f + ')'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, a0, a1); ctx.stroke();
            ctx.strokeStyle = 'rgba(120,255,160,0.7)'; ctx.lineWidth = 2;   // bordes del hueco, para verlo de lejos
            for (const a of [o.gap - o.gw, o.gap + o.gw]) { ctx.beginPath(); ctx.moveTo(o.x + Math.cos(a) * (o.r - 16), o.y + Math.sin(a) * (o.r - 16)); ctx.lineTo(o.x + Math.cos(a) * (o.r + 16), o.y + Math.sin(a) * (o.r + 16)); ctx.stroke(); }
        }
        if (hasM) for (const m of b.met) {                                 // meteoros: círculo naranja que se cierra
            if (m.t < 0 || m.done) continue;
            const k = clamp(m.t / m.w, 0, 1), pulse = 0.5 + 0.5 * Math.sin(this.time * 16);
            ctx.fillStyle = 'rgba(255,122,26,' + (0.07 + 0.12 * pulse + 0.1 * k) + ')'; ctx.strokeStyle = 'rgba(255,154,31,' + (0.6 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(2, m.r * (1 - k)), 0, TAU); ctx.stroke();
        }
        ctx.restore();
    };
}

// ================================================================ ATAJO DE PRUEBA Y GUÍA DE CONTROLES
LH.saltar = (w) => {                                                    // consola: LH.saltar(15) empieza esa oleada
    const G = engine; if (!G || G.state !== 'PLAYING') return 'Empieza una partida primero';
    G.enemies.length = 0; G.bullets.length = 0; G.queue = []; G.wave = Math.max(0, w - 1); G.waveState = 'FIGHT'; G.startWave(); return 'Oleada ' + G.wave;
};
{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const add = (h, txt) => { const t = document.createElement('div'); t.className = 'tip'; t.innerHTML = '<b>' + h + '</b>' + txt; pane.appendChild(t); };
        add('MINIJEFES NUEVOS', 'PRISMA: fija 3 líneas y dispara por ellas, sal de la línea. PULSAR: sus orbes queman; cuando brilla blanco los suelta y queda aturdido, ¡ataca! TEJEDOR: se lanza y deja chispas que queman 3 s.');
        add('ECLIPSE', 'Jefe de la oleada 15. Los círculos naranjas son meteoros (caen al cerrarse). En GRAVEDAD te arrastra: huye a toda velocidad y pasa por los huecos de los anillos. En SUPERNOVA lanza un anillo: cruza por su abertura.');
    }
}

