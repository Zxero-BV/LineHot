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

