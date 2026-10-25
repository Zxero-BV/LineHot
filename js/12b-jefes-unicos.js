// ########## [jefes-unicos.js] ##########
// =====================================================================
//  v2.6 — JEFES CON MECÁNICA PROPIA (va justo después de 12-dificultad.js)
//
//  ANTES: NEON WARDEN, SYNTH REAPER, CHROME HYDRA y VOID CANTOR compartían la misma IA (anillo, espiral, abanico, enjambre y
//  embestida); solo cambiaban el nombre y el color. NULL SIGNAL y ECLIPSE ya tenían la suya.
//  AHORA: cada uno añade una regla que cambia CÓMO se pelea, no cuántas balas esquivas. Los patrones de ataque base se mantienen.
//
//   · NEON WARDEN   ESCUDO ROTATORIO   Un arco frontal bloquea balas y rayos y gira hacia ti. Rodéalo y dispara por la espalda.
//                                      Se abre ~2 s tras cada embestida (esquívala de lado) y el PULSO también lo rompe.
//   · SYNTH REAPER  ESPEJO Y GUADAÑA   Cada pocos segundos se vuelve espejo (aviso 0.9 s): lo que dispares vuelve hacia ti.
//                                      Después gira una guadaña (2-3 hojas; las paredes la frenan) y queda AGOTADO (×1.7 de daño).
//   · CHROME HYDRA  CABEZAS            El cuello está blindado (−84 % de daño) mientras viva alguna cabeza. Cada cabeza dispara distinto.
//                                      Con todas cortadas, el cuello queda EXPUESTO (×1.5) hasta que se regeneran (8-11 s).
//   · VOID CANTOR   RESONANCIA         Un anillo se cierra sobre él al compás. Si tu disparo llega con el anillo encima: ×2.4.
//                                      Fuera de compás: ×0.4. El ritmo se acelera en cada fase. Cada 2 golpes suelta un anillo de notas.
//
//  Ajustes: tablas WARC/WSPD (Warden) y los arrays [fase1, fase2, fase3] dentro de cada función.
// =====================================================================
{
    const WARDEN = 'NEON WARDEN', REAPER = 'SYNTH REAPER', HYDRA = 'CHROME HYDRA', CANTOR = 'VOID CANTOR';
    const WARC = [1.25, 1.05, 0.9], WSPD = [0.75, 1.05, 1.4];          // Warden: medio arco del escudo (rad) y velocidad de giro (rad/s) por fase
    const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const tip = (b, txt, col) => { if (!b._tip && b.t > 1.3 && engine.state === 'PLAYING') { b._tip = 1; engine.banner(txt, col); } };
    const say = (G, b, key, txt, col, gap) => { if (!b[key] || G.time - b[key + 'T'] > gap) { b[key] = 1; b[key + 'T'] = G.time; G.spawnText(b.x, b.y - b.radius - 24, txt, col); } };
    const unpierce = (G, en, fx, fy) => {                              // la bala rebotada no debe seguir atravesando (escopeta / PERFORANTES)
        for (const q of G.bullets) if (!q.isEnemy && q.vx * 0.4 === fx && q.vy * 0.4 === fy && q.pierce > 0 && dist(q.x, q.y, en.x, en.y) < en.radius + q.radius + 4) { q.pierce = 0; break; }
    };
    const eBullet = (b, a, s, col, dm) => engine.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: col, damage: dm, name: 'ENEMY_GUN' }, true));

    // ------------------------------------------------------------ creación
    const _mk = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        const e = _mk(t, x, y, hp);
        if (t === 5 && !e.glitch && !e.eclipse) {
            if (e.bossName === WARDEN) { e.warden = true; e.sa = 0; e.shBreak = 0; e._pr = false; }
            else if (e.bossName === REAPER) { e.reaper = true; e.rs = 'hunt'; e.rt = 0; e.mirror = false; e.scN = 0; e.scA = 0; e.scDir = 1; }
            else if (e.bossName === HYDRA) { e.hydra = true; e.maxHp = e.hp = e.maxHp * 0.85; e.hy = []; e.hyR = []; e.hAng = 0; e.hyInit = false; e.hyAlive = 1; }
            else if (e.bossName === CANTOR) { e.cantor = true; e.cT = 0; e.cN = 0; e.cPer = 0; }
        }
        return e;
    };

    const _ai = Enemy.prototype.bossAI;
    Enemy.prototype.bossAI = function (dt, px, py) {
        if (this.reaper) return LH.reaperAI(this, dt, px, py, _ai);
        const r = _ai.call(this, dt, px, py);
        if (this.warden) LH.wardenTick(this, dt);
        else if (this.hydra) LH.hydraTick(this, dt);
        else if (this.cantor) LH.cantorTick(this, dt);
        return r;
    };

    // ------------------------------------------------------------ NEON WARDEN · escudo rotatorio
    LH.wardenUp = (b) => b.shBreak <= 0 && !(b.recover > 0);
    LH.wardenTick = (b, dt) => {
        const G = engine, p = G.player, ph = b.phase || 1;
        tip(b, 'ESCUDO FRONTAL · RODÉALO', '#ff5fa8');
        const rushing = b.rush > 0;
        if (b._pr && !rushing) { b.shBreak = 1.9; G.spawnText(b.x, b.y - b.radius - 30, '¡ESCUDO ABIERTO!', '#ffffff'); }   // tras la embestida: ventana para castigar
        b._pr = rushing;
        if (b.shBreak > 0) b.shBreak -= dt;
        else if (!(b.recover > 0)) {
            const d = wrapA(Math.atan2(p.y - b.y, p.x - b.x) - b.sa), s = WSPD[ph - 1] * dt;
            b.sa += Math.max(-s, Math.min(s, d));                       // gira hacia ti, pero con velocidad limitada: rodearlo más rápido que eso funciona
        }
    };
    {
        const _sh = GameEngine.prototype.shockwave;                     // el PULSO rompe la guardia, igual que con los escuderos
        GameEngine.prototype.shockwave = function (x, y, r) {
            const out = _sh.call(this, x, y, r);
            for (const e of this.enemies) if (e.warden && !e.dead && dist(x, y, e.x, e.y) <= r + e.radius) { e.shBreak = 2.4; this.spawnText(e.x, e.y - e.radius - 30, '¡GUARDIA ROTA!', '#ffffff'); }
            return out;
        };
    }

    // ------------------------------------------------------------ SYNTH REAPER · espejo, guadaña, agotado
    LH.reaperAI = (b, dt, px, py, base) => {
        const G = engine, p = G.player, ph = b.phase || 1;
        tip(b, 'ESPEJO: NO DISPARES · GUADAÑA: ESQUIVA', '#ffb300');
        if (b.rs === 'hunt') {                                          // ciclo normal (patrones del jefe base)
            base.call(b, dt, px, py); b.rt += dt;
            if (b.rt >= [7, 6, 5][ph - 1] && b.t > 3 && !(b.rush > 0 || b.telegraph > 0 || b.recover > 0)) {
                b.rs = 'mirror'; b.rt = 0; b.spiral = null; b.chargeCd = 6;
                G.spawnText(b.x, b.y - b.radius - 30, '¡ESPEJO!', '#ffffff'); audio.playGlitch('warp');
            }
            return;
        }
        b.t += dt; b.rt += dt; b.fireCooldown = Math.max(b.fireCooldown, 0.8); b.chargeCd = Math.max(b.chargeCd, 2);
        let vx = 0, vy = 0;
        const ang = Math.atan2(p.y - b.y, p.x - b.x), d = Math.max(dist(b.x, b.y, p.x, p.y), 1);
        if (b.rs === 'mirror') {
            b.mirror = b.rt >= 0.9;                                     // primero aviso (0.9 s), luego refleja
            if (b.rt >= 0.9 + [2.4, 2.6, 2.8][ph - 1]) { b.rs = 'scythe'; b.rt = 0; b.mirror = false; b.scA = ang; b.scDir = (++b.scN) % 2 ? 1 : -1; audio.playGlitch('line'); }
        } else if (b.rs === 'scythe') {
            const W = 0.8, D = [3.0, 3.4, 3.8][ph - 1], n = ph === 1 ? 2 : 3, spd = [1.45, 1.8, 2.1][ph - 1];
            if (b.rt >= W) {                                            // las hojas giran y queman; las paredes las detienen
                b.scA += b.scDir * spd * dt;
                for (let i = 0; i < n; i++) {
                    const a = b.scA + i * TAU / n, L = LH.rayEnd(b.x, b.y, a, 600);
                    if (segDist(p.x, p.y, b.x, b.y, b.x + Math.cos(a) * L, b.y + Math.sin(a) * L) < p.radius + 8) LH.glitchHurt(G, 16);
                }
            }
            if (d > 170) { vx = Math.cos(ang) * 55; vy = Math.sin(ang) * 55; }
            if (b.rt >= W + D) {
                b.rs = 'tired'; b.rt = 0;
                G.spawnText(b.x, b.y - b.radius - 30, '¡AGOTADO!', '#ffd24a'); G.rings.push({ x: b.x, y: b.y, max: 300, life: 0.5, maxLife: 0.5, col: '#ffb300' });
            }
        } else if (b.rt >= 2.3) { b.rs = 'hunt'; b.rt = 0; b.chargeCd = 3; b.fireCooldown = 1.2; }   // tired: quieto 2.3 s, daño ×1.7
        b.x = clamp(b.x + vx * dt, b.radius, width - b.radius); b.y = clamp(b.y + vy * dt, b.radius, height - b.radius);
        for (const o of G.obstacles) { const r = rectCircleCollide(b.x, b.y, b.radius, o.x, o.y, o.w, o.h); if (r.hit) { b.x += r.nx * r.pen; b.y += r.ny * r.pen; } }
    };

    // ------------------------------------------------------------ CHROME HYDRA · cabezas
    LH.hydraSpawn = (b, i) => {
        const h = new Enemy(0, b.x, b.y, 1);
        h.hhead = b; h.hi = i; h.radius = 20; h.color = ['#9dff3a', '#2ff3ff', '#ffb02e', '#ff4fd8'][i]; h.maxHp = h.hp = Math.max(5, b.maxHp * 0.1);
        h.dmg = 12; h.speed = 0; h.cd = 1.6 + i * 0.6;
        engine.enemies.push(h); return h;
    };
    LH.hydraTick = (b, dt) => {
        const G = engine, ph = b.phase || 1, n = ph === 3 ? 4 : 3, per = [11, 9, 8][ph - 1];
        tip(b, 'BLINDADO · CORTA LAS CABEZAS', '#9dff3a');
        b.hAng += dt * (0.7 + 0.25 * ph);
        let alive = 0;
        for (let i = 0; i < n; i++) {
            let h = b.hy[i];
            if (h && h.dead) { b.hy[i] = h = null; b.hyR[i] = per; }     // acaba de caer: empieza su regeneración
            if (h) { alive++; continue; }
            if (b.hyR[i] > 0) { b.hyR[i] -= dt; if (b.hyR[i] > 0) continue; }
            b.hy[i] = LH.hydraSpawn(b, i); b.hyR[i] = 0; alive++;
            if (b.hyInit) { G.rings.push({ x: b.x, y: b.y, max: 200, life: 0.4, maxLife: 0.4, col: '#9dff3a' }); G.spawnText(b.x, b.y - b.radius - 30, 'REGENERA', '#9dff3a'); }
        }
        b.hyInit = true;
        if (b.hyAlive > 0 && alive === 0) { G.spawnText(b.x, b.y - b.radius - 30, '¡CUELLO EXPUESTO!', '#ffd24a'); G.rings.push({ x: b.x, y: b.y, max: 320, life: 0.5, maxLife: 0.5, col: '#ffd24a' }); G.addShake(14); }
        b.hyAlive = alive;
    };
    LH.hydraHeadAI = (h, dt) => {
        const b = h.hhead, G = engine;
        if (!b || b.dead) { if (!h.dead) { h.dead = true; if (G) G.spawnParticle(h.x, h.y, h.color, 14, 0, 0, 300); } return; }
        const ph = b.phase || 1, a = b.hAng + h.hi * TAU / (ph === 3 ? 4 : 3), R = b.radius + 52 + Math.sin(h.t * 2 + h.hi) * 6;
        h.t += dt; h.knockback.x = h.knockback.y = 0;
        h.x = clamp(b.x + Math.cos(a) * R, h.radius, width - h.radius); h.y = clamp(b.y + Math.sin(a) * R, h.radius, height - h.radius);
        h.cd -= dt;
        if (h.cd <= 0 && b.t > 1.8 && G.state === 'PLAYING') {
            const p = G.player, pa = Math.atan2(p.y - h.y, p.x - h.x), k = h.hi % 3;
            if (k === 0) { for (let i = -1; i <= 1; i++) eBullet(h, pa + i * 0.16, 400, h.color, 9); }                                    // abanico de 3
            else if (k === 1) { const o = Math.random() * TAU; for (let i = 0; i < 8; i++) eBullet(h, o + i * TAU / 8, 170, h.color, 9); }  // anillo lento de 8
            else eBullet(h, pa, 560, h.color, 13);                                                                                         // bala rápida
            audio.playShoot('ENEMY_GUN', true); h.cd = [2.6, 2.1, 1.7][ph - 1] + Math.random() * 0.5;
        }
    };
    LH.hydraHeadDraw = (ctx, h) => {
        const G = engine, r = h.radius, p = G.player, la = p ? Math.atan2(p.y - h.y, p.x - h.x) : 0;
        ctx.save(); ctx.translate(h.x, h.y);
        ctx.fillStyle = '#0a1208'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = h.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = h.color; ctx.beginPath(); ctx.arc(Math.cos(la) * r * 0.4, Math.sin(la) * r * 0.4, 5, 0, TAU); ctx.fill();          // el ojo te sigue
        ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, h.hp) / h.maxHp); ctx.stroke();   // vida
        ctx.restore();
    };
    {
        const _up = Enemy.prototype.update;
        Enemy.prototype.update = function (dt, px, py) { return this.hhead ? LH.hydraHeadAI(this, dt) : _up.call(this, dt, px, py); };
        const _dr = Enemy.prototype.draw;
        Enemy.prototype.draw = function (ctx) { return this.hhead ? LH.hydraHeadDraw(ctx, this) : _dr.call(this, ctx); };
    }

    // ------------------------------------------------------------ VOID CANTOR · resonancia
    LH.cantorWin = (b) => { const k = (b.cT || 0) / (b.cPer || 1.3); return Math.min(k, 1 - k) < 0.14; };
    LH.cantorTick = (b, dt) => {
        const G = engine, ph = b.phase || 1, per = [1.3, 1.1, 0.9][ph - 1];
        tip(b, 'RESONANCIA · DISPARA AL CERRARSE EL ANILLO', '#e0a8ff');
        if (b.cPer && b.cPer !== per) b.cT = b.cT / b.cPer * per;       // al cambiar de fase mantiene el compás
        b.cPer = per; b.cT += dt;
        if (b.cT >= per) {
            b.cT -= per; b.cN++;
            G.rings.push({ x: b.x, y: b.y, max: b.radius * 2.4, life: 0.35, maxLife: 0.35, col: '#e0a8ff' });
            if (b.cN % 2 === 0 && b.t > 1.8 && !(b.recover > 0)) {      // cada 2 golpes: anillo de notas con hueco
                const n = [10, 12, 14][ph - 1], gap = Math.floor(Math.random() * n);
                for (let i = 0; i < n; i++) if (((i - gap + n) % n) >= 2) eBullet(b, i / n * TAU + b.t, 150, '#e0a8ff', 10);
                audio.playShoot('ENEMY_GUN', true);
            }
        }
    };

    // ------------------------------------------------------------ daño: una sola entrada para todos
    const _hit = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        if (en.dead) return _hit.call(this, en, dmg, fx, fy, melee);
        if (en.warden && !melee && LH.wardenUp(en)) {                    // escudo: bloquea lo que llega de frente (katana, railgun, cohete y bomba pasan)
            const m = Math.hypot(fx, fy);
            if (m > 1 && (-fx * Math.cos(en.sa) - fy * Math.sin(en.sa)) / m > Math.cos(WARC[(en.phase || 1) - 1])) {
                if (this.time - (en._clk || -9) > 0.07) { en._clk = this.time; LH.panned(en.x, () => audio.playClang()); }
                this.spawnParticle(en.x + Math.cos(en.sa) * (en.radius + 12), en.y + Math.sin(en.sa) * (en.radius + 12), '#ffd0ea', 4, -fx * 0.15, -fy * 0.15, 220);
                say(this, en, '_bq', 'BLOQUEADO', '#ffd0ea', 0.7); unpierce(this, en, fx, fy);
                return;
            }
        } else if (en.reaper) {
            if (en.mirror) {
                if (!melee) {                                            // espejo: lo que disparas vuelve hacia ti
                    const pa = Math.atan2(this.player.y - en.y, this.player.x - en.x);
                    if (this.time - (en._rf || -9) > 0.14) {
                        en._rf = this.time;
                        this.bullets.push(new Bullet(en.x + Math.cos(pa) * (en.radius + 6), en.y + Math.sin(pa) * (en.radius + 6), pa, { speed: 470, color: '#ffffff', damage: 9, name: 'ENEMY_GUN' }, true));
                        LH.panned(en.x, () => audio.playClang());
                    }
                    this.spawnParticle(en.x - Math.cos(pa) * en.radius, en.y - Math.sin(pa) * en.radius, '#ffffff', 3, 0, 0, 160);
                    say(this, en, '_rx', 'REFLEJO · ¡NO DISPARES!', '#ffffff', 0.9); unpierce(this, en, fx, fy);
                    return;
                }
                dmg *= 0.35;                                             // cuerpo a cuerpo: entra, pero muy poco
            } else if (en.rs === 'tired') { dmg *= 1.7; say(this, en, '_tx', 'AGOTADO ×1.7', '#ffd24a', 1.2); }
        } else if (en.hydra) {
            if (en.hyAlive > 0) { dmg *= 0.16; say(this, en, '_hx', 'BLINDADO · CORTA LAS CABEZAS', '#9dff3a', 1.4); }
            else dmg *= 1.5;
        } else if (en.cantor) {
            if (LH.cantorWin(en)) { dmg *= 2.4; say(this, en, '_cx', '¡RESONANCIA!', '#e9b8ff', 0.45); }
            else { dmg *= 0.4; say(this, en, '_cy', 'FUERA DE COMPÁS', '#8a6aa8', 1.6); }
        } else if (en.hhead) {                                           // cabezas: sin botín propio
            const n = this.pickups.length, r = _hit.call(this, en, dmg, fx, fy, melee);
            if (en.dead) { this.pickups.length = Math.min(this.pickups.length, n); this.spawnText(en.x, en.y - 30, '¡CABEZA CORTADA!', en.color); }
            return r;
        }
        return _hit.call(this, en, dmg, fx, fy, melee);
    };

    // ------------------------------------------------------------ dibujo (espacio del mundo)
    const _fx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        _fx.call(this, ctx);
        const b = this.bossRef;
        if (!b || b.dead || !(b.warden || b.reaper || b.hydra || b.cantor)) return;
        const t = this.time, ph = b.phase || 1, r = b.radius;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        if (b.warden) {
            const up = LH.wardenUp(b), arc = WARC[ph - 1], R = r + 14;
            ctx.strokeStyle = up ? '#ff5fa8' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = up ? 10 : 3; ctx.globalAlpha = up ? 0.8 : 0.6;
            if (!up) ctx.setLineDash([6, 8]);
            ctx.beginPath(); ctx.arc(b.x, b.y, R, b.sa - arc, b.sa + arc); ctx.stroke(); ctx.setLineDash([]);
            if (up) {
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(b.x, b.y, R, b.sa - arc, b.sa + arc); ctx.stroke();
                const wa = b.sa + Math.PI; ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 8); ctx.fillStyle = '#ffe066';          // punto débil, a su espalda
                ctx.beginPath(); ctx.arc(b.x + Math.cos(wa) * (r + 10), b.y + Math.sin(wa) * (r + 10), 5, 0, TAU); ctx.fill();
            }
        } else if (b.reaper) {
            if (b.rs === 'mirror') {
                const warn = b.rt < 0.9;
                ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, r + 16, 0, TAU);
                if (warn) { ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.globalAlpha = 0.3 + 0.6 * (b.rt / 0.9); ctx.stroke(); ctx.setLineDash([]); }
                else {
                    ctx.fillStyle = 'rgba(180,230,255,0.12)'; ctx.fill(); ctx.lineWidth = 6; ctx.globalAlpha = 0.85; ctx.stroke();
                    ctx.lineWidth = 3; ctx.globalAlpha = 0.7; for (let i = 0; i < 6; i++) { const a = t * 2 + i * TAU / 6; ctx.beginPath(); ctx.arc(b.x, b.y, r + 16, a, a + 0.35); ctx.stroke(); }
                }
            } else if (b.rs === 'scythe') {
                const W = 0.8, n = ph === 1 ? 2 : 3, warn = b.rt < W;
                for (let i = 0; i < n; i++) {
                    const a = b.scA + i * TAU / n, L = LH.rayEnd(b.x, b.y, a, 600), ex = b.x + Math.cos(a) * L, ey = b.y + Math.sin(a) * L;
                    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey);
                    if (warn) { ctx.setLineDash([10, 8]); ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2; ctx.globalAlpha = 0.25 + 0.5 * (b.rt / W); ctx.stroke(); ctx.setLineDash([]); }
                    else { ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 14; ctx.globalAlpha = 0.35; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.stroke(); }
                }
            } else if (b.rs === 'tired') {
                ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 12); ctx.setLineDash([6, 6]);
                ctx.beginPath(); ctx.arc(b.x, b.y, r + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            }
        } else if (b.hydra) {
            ctx.lineWidth = 6;
            for (const h of b.hy) if (h && !h.dead) { ctx.strokeStyle = h.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(h.x, h.y); ctx.stroke(); }
            if (b.hyAlive > 0) { ctx.strokeStyle = '#9dff3a'; ctx.lineWidth = 3; ctx.globalAlpha = 0.45; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(b.x, b.y, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
            else {
                const per = [11, 9, 8][ph - 1], mn = Math.min(...b.hyR.filter(v => v > 0), per);          // anillo dorado = ventana de daño; el arco se vacía hasta que regeneran
                ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 5; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 10);
                ctx.beginPath(); ctx.arc(b.x, b.y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * mn / per); ctx.stroke();
            }
        } else if (b.cantor) {
            const k = (b.cT || 0) / (b.cPer || 1.3), s = k < 0.5 ? k : k - 1, win = LH.cantorWin(b), br = r + 8;
            if (s < 0) { ctx.strokeStyle = '#e0a8ff'; ctx.lineWidth = 3 + 3 * (1 + s * 2); ctx.globalAlpha = 0.35 + 0.5 * (1 + s * 2); ctx.beginPath(); ctx.arc(b.x, b.y, br + 95 * (-s / 0.5), 0, TAU); ctx.stroke(); }
            if (win) { ctx.fillStyle = 'rgba(233,184,255,0.18)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, TAU); ctx.fill(); ctx.stroke(); }
        }
        ctx.restore();
    };
}
