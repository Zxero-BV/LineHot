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
        const B = LH.beat, calm = !!Settings.calm, perf = !!Settings.perf, lvl = perf ? 3 : Math.min(Q.level, 2), k = calm ? 0.3 : 1, v = B.v * k, sv = B.sv * k, lv = B.lv * k;
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

