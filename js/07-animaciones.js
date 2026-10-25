// ########## [animaciones.js] ##########
// ---------------------------------------------------------------- ANIMACIONES DEL PROTAGONISTA + FONDO DE MENÚ EN PIXEL ART
// PROTAGONISTA (sustituye a LH.drawHero de pixel3.js; los fotogramas están en LH.heroGrid):
//   · respira al estar quieto (frame 3) · retrocede al disparar (frame 4) · zancada al moverse (0-2)
//   · APARICIÓN: se materializa de arriba abajo con una línea de escaneo al empezar la partida
//   · GOLPE: se tiñe de rojo 0,18 s al recibir daño · POCA VIDA (<30 %): LED rojo y chispas/humo por la espalda
//   · polvo en los pies al correr. MODO ANTI-EPILEPSIA / REDUCIR DESTELLOS: LED fijo, sin chispas ni tinte repetido.
LH.tintCache = new WeakMap();
LH.heroTint = (cv) => {
    let o = LH.tintCache.get(cv); if (o) return o;
    o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const g = o.getContext('2d');
    g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,45,61,.7)'; g.fillRect(0, 0, o.width, o.height);
    LH.tintCache.set(cv, o); return o;
};
LH.heroFx = (p, t, moving, low, calm) => {
    if (moving && t - (p._dustT || 0) > 0.13) { p._dustT = t; engine.spawnParticle(p.x - p.vx * 0.03, p.y - p.vy * 0.03, '#8a8fb8', 1, -p.vx * 0.1, -p.vy * 0.1, 30); }
    if (low && !calm && t - (p._smkT || 0) > 0.22) {
        p._smkT = t; const bx = p.x - Math.cos(p.angle) * 9, by = p.y - Math.sin(p.angle) * 9, k = (p._smk = (p._smk || 0) + 1) & 1;
        engine.spawnParticle(bx, by, k ? '#ff9a3c' : '#6b6f8f', 1, 0, -35, 45);
    }
};
LH.drawHero = (ctx, p) => {
    if (LH.shards && LH.shards.length && engine.state === 'GAMEOVER') return;          // se está rompiendo en píxeles (mejoras9.js)
    ctx.rotate(-p.angle);
    const t = LH.now(), calm = !!(Settings.calm || Settings.epi), moving = Math.hypot(p.vx || 0, p.vy || 0) > 40;
    const firing = (p.flashT || 0) > t, low = p.maxHp > 0 && p.hp / p.maxHp < 0.3;
    if (p._born === undefined) p._born = t;
    if (p._hp0 !== undefined && p.hp < p._hp0) p._hurtT = t;
    p._hp0 = p.hp;
    const age = t - p._born;
    if (!p._bornFx && age < 0.3) { p._bornFx = 1; engine.spawnParticle(p.x, p.y, '#00f3ff', 14, 0, 0, 160); }
    if (engine.state === 'PLAYING' && p.hp > 0) LH.heroFx(p, t, moving, low, calm);
    const frame = firing ? 4 : moving ? [0, 1, 0, 2][Math.floor(t * 10) & 3] : (Math.floor(t * 1.25) & 1 ? 3 : 0);
    const blink = low ? (calm ? 2 : (Math.floor(t * 2) & 1) * 2) : (calm ? 0 : Math.floor(t * 2) & 1);
    const q = Math.round((((p.angle % TAU) + TAU) % TAU) / TAU * 32) % 32;
    let cv = LH.heroRot(q, frame, p.dual ? 1 : 0, blink);
    if (p._hurtT !== undefined && t - p._hurtT < 0.18) cv = LH.heroTint(cv);
    const tr = ctx.getTransform(), k = Math.hypot(tr.a, tr.b) || 1, S = Math.max(1, Math.round(2 * k)) / k;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.34)';                       // sombra en píxeles
    for (let j = -3; j <= 3; j++) { const hw = Math.round(Math.sqrt(1 - (j / 3.6) ** 2) * 6); ctx.fillRect(-hw * 2 + 4, j * 2 + 10, hw * 4, 2); }
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    const w = cv.width * S, h = cv.height * S, kick = firing ? -S : 0;
    if (age < 0.6) {                                                      // aparición: se revela de arriba abajo
        const rows = Math.max(1, Math.round(cv.height * age / 0.6));
        ctx.drawImage(cv, 0, 0, cv.width, rows, -w / 2, -h / 2, w, rows * S);
        ctx.fillStyle = '#9ffcff'; ctx.fillRect(-w / 2, -h / 2 + rows * S, w, S);
    } else ctx.drawImage(cv, -w / 2 + kick, -h / 2, w, h);
};

// ---------------------------------------------------------------- FONDO DE MENÚ EN PIXEL ART
// Escena de 144 px de alto escalada sin suavizar: cielo con estrellas, sol retro con franjas, dos capas de ciudad neón con
// parallax, suelo en perspectiva y, en primer plano, el protagonista corriendo y disparando a enemigos que llegan.
const MB = { c: null, g: null, W: 0, H: 144, t: 0, last: 0, en: [], bu: [], pa: [], spawnT: 1, shootT: 0, seed: 1 };
MB.R = () => (MB.seed = (MB.seed * 16807) % 2147483647) / 2147483647;
MB.cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
MB.build = () => {
    const H = MB.H, W = MB.W = Math.max(220, Math.min(420, Math.round(H * innerWidth / innerHeight))), hy = MB.hy = Math.round(H * 0.6), R = MB.R; MB.seed = 4242;
    MB.c.width = W; MB.c.height = H; MB.g = MB.c.getContext('2d');
    const sky = MB.sky = MB.cv(W, H), g = sky.getContext('2d'), B = ['#0a001a', '#12002e', '#1d0640', '#2b0a55', '#3d0f68', '#561480', '#7a1a8c', '#a5207f', '#d1346f'];
    for (let y = 0; y < hy; y++) for (let x = 0; x < W; x++) { const i = y / hy * 8, b = Math.floor(i); g.fillStyle = (i - b > 0.7 && ((x + y) & 1)) ? B[Math.min(8, b + 1)] : B[b]; g.fillRect(x, y, 1, 1); }
    for (let y = hy; y < H; y++) { g.fillStyle = y - hy < 2 ? '#ff2f8a' : '#0b0220'; g.fillRect(0, y, W, 1); }
    MB.stars = Array.from({ length: 80 }, () => ({ x: Math.floor(R() * W), y: Math.floor(R() * hy * 0.75), p: R() * 6 }));
    const r = Math.round(hy * 0.34), sun = MB.sun = MB.cv(r * 2, r * 2), sg = sun.getContext('2d');
    for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) if (Math.hypot(x + .5 - r, y + .5 - r) <= r) { sg.fillStyle = y < r * 0.7 ? '#ffe600' : y < r * 1.2 ? '#ff9a3c' : y < r * 1.6 ? '#ff4d7a' : '#ff2f8a'; sg.fillRect(x, y, 1, 1); }
    MB.sunR = r;
    const layer = (hMin, hMax, col, lit, rim) => {
        const c = MB.cv(W, Math.round(H * 0.5)), q = c.getContext('2d'); let x = 0;
        while (x < W) {
            const w = Math.min(W - x, 8 + Math.floor(R() * 14)), h = Math.floor(hMin + R() * (hMax - hMin)), y = c.height - h;
            q.fillStyle = col; q.fillRect(x, y, w, h); q.fillStyle = rim; q.fillRect(x, y, w, 1); q.fillStyle = 'rgba(0,0,0,.35)'; q.fillRect(x + w - 1, y, 1, h);
            for (let wy = y + 3; wy < c.height - 2; wy += 3) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (R() < 0.3) { q.fillStyle = lit[Math.floor(R() * lit.length)]; q.fillRect(wx, wy, 1, 2); }
            if (R() < 0.35) { q.fillStyle = col; q.fillRect(x + Math.floor(w / 2), y - 4, 1, 4); }
            x += w + (R() < 0.3 ? 1 : 0);
        }
        return c;
    };
    MB.far = layer(12, 32, '#1b0a3a', ['#ff2f8a', '#7a1a8c', '#00b8cc'], '#3a1a6a');
    MB.near = layer(18, 42, '#0b0420', ['#ffe600', '#00f3ff', '#ff2f8a', '#ff9a3c'], '#2a1060');
    MB.ants = []; for (let i = 0; i < 6; i++) MB.ants.push({ x: Math.floor(R() * W), y: hy - 30 - Math.floor(R() * 28), p: R() * 6 });
};
MB.shoot = (a) => { MB.bu.push({ x: MB.hx + 16, y: MB.hy2 - 1, vx: 300, vy: 0 }); MB.hf = 2; };
MB.burst = (x, y, col) => { for (let i = 0; i < 14; i++) { const a = MB.R() * 6.283, s = 20 + MB.R() * 60; MB.pa.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, l: 0.5 + MB.R() * 0.4, c: i % 3 ? col : '#ffffff' }); } };
MB.frame = (now) => {
    const dts = (now - MB.last) / 1000; if (dts < 1 / 31) return; MB.last = now;
    const scr = DOM.screens; if (!scr || scr.classList.contains('hidden') || scr.dataset.mode === 'pPause' || document.hidden || Settings.perf) return;
    const dt = Math.min(dts, 0.05), calm = !!(Settings.calm || Settings.epi), W = MB.W, H = MB.H, hy = MB.hy, g = MB.g, sp = calm ? 0.5 : 1;
    MB.t += dt; const t = MB.t;
    const BT = (Settings.beatBg && !calm && LH.beatUpdate && LH.beatUpdate()) ? LH.beat : null, bv = BT ? BT.v : 0;   // ritmo de la música
    g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.drawImage(MB.sky, 0, 0);
    for (const s of MB.stars) { if (!calm && Math.sin(t * 2.2 + s.p) < -0.6) continue; g.fillStyle = s.p > 4.5 ? '#9ffcff' : '#ffffff'; g.fillRect(s.x, s.y, 1, 1); }
    const r = MB.sunR, sx = Math.round(W / 2 - r), sy = hy - Math.round(r * 2.6) - Math.round(bv * 3);
    g.drawImage(MB.sun, sx, sy);
    for (let y = Math.round(r * 0.9), k = 0; y < r * 2; y += 4 + (k++ >> 1)) {                      // franjas del sol, bajan despacio
        const yy = Math.round(sy + y + ((t * 5 * sp) % (4 + (k >> 1)))); if (yy < hy) { g.drawImage(MB.sky, sx, yy, r * 2, 1, sx, yy, r * 2, 1); }
    }
    const off1 = Math.floor((t * 3 * sp) % W), off2 = Math.floor((t * 8 * sp) % W), bh = MB.far.height;
    g.drawImage(MB.far, -off1, hy - bh); g.drawImage(MB.far, W - off1, hy - bh);
    g.drawImage(MB.near, -off2, hy - bh + 4); g.drawImage(MB.near, W - off2, hy - bh + 4);
    if (!calm) for (const a of MB.ants) if (Math.sin(t * 3 + a.p) > 0.2) { const ax = ((a.x - off2) % W + W) % W; g.fillStyle = '#ff2d3d'; g.fillRect(ax, a.y, 1, 1); }
    // suelo en perspectiva
    for (let i = -14; i <= 14; i++) for (let y = hy + 2; y < H; y++) { const p = (y - hy) / (H - hy); g.fillStyle = 'rgba(0,243,255,' + (0.18 + 0.5 * p).toFixed(2) + ')'; g.fillRect(Math.round(W / 2 + i * W * 0.07 * p), y, 1, 1); }
    for (let j = 0; j < 12; j++) { const z = ((j + t * 0.9 * sp) % 12) / 12, y = Math.round(hy + 2 + (H - hy - 2) * Math.pow(z, 2.3)); g.fillStyle = 'rgba(255,47,138,' + (0.2 + 0.5 * z).toFixed(2) + ')'; g.fillRect(0, y, W, 1); }
    if (BT) {                                                                                 // ecualizador en píxeles + brillo del horizonte
        const n = 32, bw = W / n;
        for (let i = 0; i < n; i++) {
            const bh = Math.round(Math.pow(BT.bars[i], 1.4) * H * 0.3); if (bh < 1) continue; const bx = Math.round(i * bw) + 1, bww = Math.max(1, Math.floor(bw) - 1);
            g.fillStyle = i % 2 ? 'rgba(0,243,255,.45)' : 'rgba(255,47,138,.45)'; g.fillRect(bx, H - bh, bww, bh); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(bx, H - bh, bww, 1);
        }
        g.fillStyle = 'rgba(255,47,138,' + (0.35 * bv).toFixed(2) + ')'; for (let k = 0; k < 5; k++) g.fillRect(0, hy - k, W, 1);
    }
    // actores
    const lane = Math.round(hy + (H - hy) * 0.7), hx = MB.hx = Math.round(W * 0.2), hyy = MB.hy2 = lane - 8;
    MB.spawnT -= dt; if (MB.spawnT <= 0) {
        const T = [['drone', '#00f3ff', 1, 30], ['tank', '#b537f2', 3, 22], ['diamond', '#ff3333', 2, 28], ['kami', '#ff7a00', 1, 55], ['split', '#00ff66', 2, 26]][Math.floor(MB.R() * 5)];
        MB.en.push({ n: T[0], c: T[1], hp: T[2], v: T[3] * sp, x: W + 14, y: lane - 8 + Math.round(MB.R() * 14 - 7), f: 0 }); MB.spawnT = 1.1 + MB.R() * 1.4;
    }
    const tgt = MB.en.filter(e => e.x > hx + 20).sort((a, b) => a.x - b.x)[0];
    MB.shootT -= dt; if (tgt && tgt.x < W * 0.72 && MB.shootT <= 0) { MB.shootT = 0.26; MB.shoot(); }
    for (const e of MB.en) { e.x -= e.v * dt; e.fl = Math.max(0, (e.fl || 0) - dt); }
    for (const b of MB.bu) { b.x += b.vx * dt; for (const e of MB.en) if (!e.dead && Math.abs(b.x - e.x) < 9 && Math.abs(b.y - e.y) < 9) { b.x = 9999; e.hp--; e.fl = 0.08; e.x += 2; if (e.hp <= 0) { e.dead = 1; MB.burst(e.x, e.y, e.c); } } }
    MB.bu = MB.bu.filter(b => b.x < W + 10); MB.en = MB.en.filter(e => !e.dead && e.x > -20);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(hx - 8, lane + 1, 17, 2);
    for (const e of MB.en) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(Math.round(e.x) - 6, lane + 1, 12, 2); const a = LH.eArt(e.n, Math.floor(t * 4 + e.x * 0.05) & 1, e.c, e.fl > 0 ? 1 : 0); g.drawImage(a, Math.round(e.x - a.width / 2), Math.round(e.y - a.height / 2)); }
    const ang = tgt ? Math.atan2(tgt.y - hyy, tgt.x - hx) : 0, q = Math.round(((ang + 6.2832) % 6.2832) / 6.2832 * 32) % 32;
    MB.hf = Math.max(0, (MB.hf || 0) - 1);
    const frame = MB.hf ? 4 : [0, 1, 0, 2][Math.floor(t * 10) & 3], hs = LH.heroRot(q, frame, 0, calm ? 0 : Math.floor(t * 2) & 1), pis = LH.pixSprite('PISTOL');
    g.drawImage(hs, hx - 18, hyy - 18 + ((Math.floor(t * 10) & 3) % 2 ? 0 : 0));
    if (pis) { g.save(); g.translate(hx, hyy); g.rotate(ang); g.drawImage(pis, 5, -4); g.restore(); }
    if (MB.hf && !calm) { g.fillStyle = '#ffffff'; g.fillRect(hx + 17 + Math.round(Math.cos(ang) * 4), hyy - 1 + Math.round(Math.sin(ang) * 4), 3, 3); g.fillStyle = '#ffe600'; g.fillRect(hx + 20, hyy, 2, 1); }
    for (const b of MB.bu) { g.fillStyle = 'rgba(255,230,0,.5)'; g.fillRect(b.x - 5, b.y, 5, 1); g.fillStyle = '#ffffff'; g.fillRect(b.x - 1, b.y, 3, 1); }
    for (const p of MB.pa) { p.l -= dt; p.vy += 140 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, Math.min(1, p.l * 2.5)); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    g.globalAlpha = 1; MB.pa = MB.pa.filter(p => p.l > 0);
};
MB.loop = (now) => { try { MB.frame(now); } catch (e) { MB.err = e; } requestAnimationFrame(MB.loop); };
{
    const _onloadMB = window.onload;
    window.onload = function () {
        _onloadMB.call(this);
        try {
            const bg = document.querySelector('.menu-bg'); if (!bg || !LH.heroRot || !LH.eArt) return;
            MB.c = document.createElement('canvas'); MB.c.className = 'mb-pix'; bg.insertBefore(MB.c, bg.firstChild); bg.classList.add('px');
            for (const cls of ['mb-vig', 'mb-scan']) { const d = document.createElement('div'); d.className = cls; bg.appendChild(d); }
            MB.build(); let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { try { MB.build(); } catch (e) {} }, 200); });
            requestAnimationFrame(MB.loop);
        } catch (e) { console.warn('[fondo]', e); }
    };
}

// ########## [mejoras9.js] ##########
// ---------------------------------------------------------------- A) BARRAS / HALO / LUCES AL RITMO: ya no desaparecen
// Causas: (1) la calidad automática solo BAJABA (nunca subía) y con ella se apagaban los efectos al ritmo en oleadas altas;
//         (2) al pausar se suspendía el audio, así que el analizador no oía nada y el fondo no se redibujaba.
// Ahora: tope de nivel 2 para estos efectos · la calidad vuelve a SUBIR si el rendimiento se recupera (con espera creciente
// para no oscilar) · en pausa la música sigue más baja y el fondo se redibuja a 30 FPS para que el ritmo siga vivo.
{
    let good = 0, lastDrop = 0, lastRec = 0, wait = 15000;
    const _aq = autoQuality;
    autoQuality = function (fps) {
        const before = Q.level; _aq(fps);
        const now = performance.now();
        if (Q.level > before) { if (now - lastRec < 25000) wait = Math.min(wait * 2, 240000); lastDrop = now; good = 0; return; }
        if (!Settings.autoQ || Settings.perf || !engine || engine.state !== 'PLAYING' || Q.level === 0 || document.hidden || now < _qGrace) { good = 0; return; }
        if (now - lastDrop < wait) { good = 0; return; }
        good = fps > 57 ? good + 1 : 0;                                  // ~una muestra cada 0,5 s → 10 s seguidos a ≥57 FPS
        if (good >= 20) { good = 0; lastRec = lastDrop = now; setQuality(Q.level - 1); resize(); }
    };
    LH.duck = (on) => {
        const m = audio && audio.master; if (!m) return; const t = audio.ctx.currentTime;
        if (on) { if (LH._mv == null) LH._mv = m.gain.value; m.gain.cancelScheduledValues(t); m.gain.setTargetAtTime(LH._mv * 0.4, t, 0.08); }
        else if (LH._mv != null) { m.gain.cancelScheduledValues(t); m.gain.setTargetAtTime(LH._mv, t, 0.08); LH._mv = null; }
    };
    const _pause = GameEngine.prototype.pause, _resume = GameEngine.prototype.resume;
    GameEngine.prototype.pause = function () { _pause.call(this); try { audio.ctx.resume(); LH.duck(true); } catch (e) {} };
    GameEngine.prototype.resume = function () { try { LH.duck(false); } catch (e) {} _resume.call(this); };
    setInterval(() => { if (engine && engine.state === 'PAUSED' && Menu.current === 'pPause' && Settings.beatBg && !Settings.perf && !document.hidden) engine.needsDraw = true; }, 33);
}

// ---------------------------------------------------------------- B) ENEMIGOS NUEVOS: FLANQUEADOR (tipo 10) y MÉDICO (tipo 11)
// FLANQUEADOR: te rodea a ~280 px, se detiene, marca una línea amarilla (0,5 s) y embiste en esa dirección. Aparece desde la oleada 6.
// MÉDICO: se mantiene lejos, esquiva y cada 2,6 s lanza un pulso que cura un 15 % a los enemigos cercanos. Desde la oleada 9. ¡Mátalo primero!
Object.assign(LH.SPR, {
    flank: ['top', ['..............kk....', '............kkcck...', '..kk......kcllhk....', '..kcckkkkkcllhhk....', '...kcccccclllhhhwk..', '....kccclllmmhhwwk..', 'zzzzzkkcllkkmmmkwEEk.', 'xxxxxkkkkkkkkkkkrrEk']],
    medic: ['both', ['.....kkk', '.....kcm', '.....kcl', '.kkkkkcl', 'kkcccclh', 'kcllllhw', 'kclhhwww', 'kcmhwwrr']]
});
const FLANK_COL = '#ffe600', MEDIC_COL = '#4dffd2';
LH.eid = (e) => e.boss ? 'boss' : (e.kind || ['drone', 'tank', 'diamond', 'swarm', 'giant', 'boss'][e.type] || 'drone');
LH.seen = (e) => {
    if (LH._probe) return; const id = LH.eid(e); LH.prog.seen = LH.prog.seen || {};
    if (!LH.prog.seen[id]) { LH.prog.seen[id] = 1; LH.save('linehotProg', LH.prog); if (LH.BEST && LH.BEST.every(b => LH.prog.seen[b.id])) LH.unlock('bestia'); }
};
{
    const _mk = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        if (t === 10 || t === 14) {
            const e = new Enemy(0, x, y, hp), fl = t === 10;
            e.kind = fl ? 'flank' : 'medic'; e.radius = fl ? 15 : 17; e.color = fl ? FLANK_COL : MEDIC_COL; e.speed = fl ? 185 : 105;
            e.maxHp = e.hp = (fl ? 2.2 : 2.5) * hp; e.dmg = fl ? 18 : 8; e.state = fl ? 'orbit' : 'keep'; e.st = 0; e.cd = fl ? 1.2 + Math.random() * 1.2 : 2.4;
            e.ang = 0; e.side = Math.random() < 0.5 ? 1 : -1;
            if (engine && engine.mut && engine.mut.frenzy) e.speed *= 1.25;
            LH.seen(e); return e;
        }
        const e = _mk(t, x, y, hp); LH.seen(e); return e;
    };
    const _eu = Enemy.prototype.update;
    Enemy.prototype.update = function (dt, px, py) {
        if (this.kind === 'flank') return LH.flankAI(this, dt, px, py);
        if (this.kind === 'medic') return LH.medicAI(this, dt, px, py);
        return _eu.call(this, dt, px, py);
    };
    const _ed = Enemy.prototype.draw;
    Enemy.prototype.draw = function (ctx) {
        if (this.kind !== 'flank' && this.kind !== 'medic') return _ed.call(this, ctx);
        const r = this.radius, nm = this.kind, col = this.color, flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50, fr = LH.eFrame(this), id = nm + (flash ? 'f' : 'n') + fr;
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => LH.eDraw(c, nm, fr, col, flash, r));
        ctx.save();
        if (nm === 'flank') {
            if (this.state === 'tele') {                             // línea de aviso: se ve hacia dónde va a embestir
                ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,230,0,${0.25 + 0.5 * Math.min(1, this.st / 0.5)})`;
                ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + Math.cos(this.ang) * 620, this.y + Math.sin(this.ang) * 620); ctx.stroke(); ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over';
            }
            if (this.state === 'dash') for (let i = 3; i >= 1; i--) {                        // estela de imágenes
                ctx.save(); ctx.globalAlpha = 0.22 / i * 2; ctx.translate(this.x - Math.cos(this.ang) * i * 20, this.y - Math.sin(this.ang) * i * 20); ctx.rotate(this.ang); ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h); ctx.restore();
            }
        } else if (this.st > this.cd - 0.6) {                                              // médico cargando su pulso
            const k = (this.st - (this.cd - 0.6)) / 0.6; ctx.strokeStyle = `rgba(77,255,210,${0.15 + 0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, r + 6 + 22 * k, 0, TAU); ctx.stroke();
        }
        ctx.translate(this.x, this.y); if (nm === 'flank') ctx.rotate(this.ang || 0);
        ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h); ctx.restore();
        ctx.fillStyle = nm === 'medic' ? MEDIC_COL : C.red; ctx.fillRect(this.x - r, this.y - r - 12, r * 2 * Math.max(0, this.hp / this.maxHp), 4);
    };
    const _sw = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        _sw.call(this);
        const w = this.wave, q = this.queue; if (!q || w % 5 === 0) return;
        const add = (t, n) => { for (let i = 0; i < n; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, { t, n: 1, d: 1.3 }); };
        if (w >= 6) add(10, Math.min(5, 1 + Math.floor((w - 6) / 3)));
        if (w >= 9) add(14, Math.min(3, 1 + Math.floor((w - 9) / 4)));
        try { audio.music.call('setWaveSize', q.reduce((a, x) => a + x.n, 0)); } catch (e) {}
    };
}
LH.keepIn = (e) => { const r = e.radius; e.x = clamp(e.x, r, width - r); e.y = clamp(e.y, r, height - r); };
LH.flankAI = (e, dt, px, py) => {
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    const a = Math.atan2(py - e.y, px - e.x), d = Math.hypot(px - e.x, py - e.y), r = e.radius;
    if (e.x > r && e.y > r && e.x < width - r && e.y < height - r) e._in = true;
    if (!e._in) { LH.moveE(e, dt, a, e.speed * 1.3); e.ang = a; return; }
    e.st += dt;
    if (e.state === 'orbit') {
        e.ang = a; const t = a + e.side * Math.PI / 2, rad = d > 330 ? 0.6 : d < 230 ? -0.6 : 0;
        LH.moveE(e, dt, Math.atan2(Math.sin(t) + Math.sin(a) * rad, Math.cos(t) + Math.cos(a) * rad), e.speed);
        if (e.st >= e.cd) { e.state = 'tele'; e.st = 0; }
    } else if (e.state === 'tele') { e.ang = a; LH.moveE(e, dt, a, 0); if (e.st >= 0.5) { e.state = 'dash'; e.st = 0; } }
    else if (e.state === 'dash') { LH.moveE(e, dt, e.ang, 620); if (e.st >= 0.38) { e.state = 'rest'; e.st = 0; } }
    else { e.ang = a; LH.moveE(e, dt, a + Math.PI, e.speed * 0.3); if (e.st >= 0.6) { e.state = 'orbit'; e.st = 0; e.cd = 1.4 + Math.random() * 1.2; e.side = Math.random() < 0.5 ? 1 : -1; } }
    LH.keepIn(e);
};
LH.medicAI = (e, dt, px, py) => {
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    const a = Math.atan2(py - e.y, px - e.x), d = Math.hypot(px - e.x, py - e.y), r = e.radius;
    if (e.x > r && e.y > r && e.x < width - r && e.y < height - r) e._in = true;
    if (!e._in) { LH.moveE(e, dt, a, e.speed * 1.5); return; }
    e.st += dt; e.ang = a;
    LH.moveE(e, dt, d < 330 ? a + Math.PI : d > 430 ? a : a + e.side * Math.PI / 2, e.speed * (d < 330 ? 1.15 : 0.7));
    LH.keepIn(e);
    if (e.st >= e.cd) { e.st = 0; e.cd = 2.6; LH.medicPulse(e); }
};
LH.medicPulse = (e) => {
    const G = engine;
    for (const o of G.enemies) if (o !== e && !o.dead && !o.boss && o.hp < o.maxHp && Math.hypot(o.x - e.x, o.y - e.y) < 230) {
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); G.spawnParticle(o.x, o.y, MEDIC_COL, 4, 0, -30, 60); G.spawnText(o.x, o.y - o.radius - 8, '+', MEDIC_COL);
    }
    if (G.rings) G.rings.push({ x: e.x, y: e.y, max: 230, life: 0.5, maxLife: 0.5, col: MEDIC_COL });
};
LH.ACH.push(
    { id: 'flank', name: 'ESQUIVADOR', desc: 'Derrota a 20 flanqueadores', prog: () => [LH.prog.flank || 0, 20] },
    { id: 'medic', name: 'SIN MÉDICOS', desc: 'Derrota a 10 médicos', prog: () => [LH.prog.medic || 0, 10] },
    { id: 'syn', name: 'SINERGIA', desc: 'Activa una sinergia entre dos mejoras' },
    { id: 'bestia', name: 'NATURALISTA', desc: 'Descubre a todos los enemigos del bestiario' }
);

// ---------------------------------------------------------------- C) SINERGIAS DE MEJORAS (se activan solas al reunir las dos mejoras)
//   SED DE SANGRE  = VAMPIRISMO + CRÍTICOS     · cada 8 bajas, +6 de vida
//   FUEGO CRUZADO  = POTENCIA 2+ + CADENCIA 2+ · 12 % de que una baja deje el arma lista al instante
//   SOBRECARGA     = PULSO RÁPIDO + ONDA EXPANSIVA · cada 12 bajas el pulso se recarga del todo
LH.syn = { n: 0, seen: {} };
LH.synTxt = (e, en, txt, col, id) => {
    try { e.spawnText(en.x, en.y - 26, txt, col); } catch (x) {}
    LH.unlock('syn'); if (!LH.syn.seen[id]) { LH.syn.seen[id] = 1; LH.toast('⚡ SINERGIA · ' + txt); }
};
LH.synergy = (e, en) => {
    const p = e.player, L = LH.lvl; LH.syn.n++;
    if (L('vamp') && L('crit') && LH.syn.n % 8 === 0) { p.hp = Math.min(p.maxHp, p.hp + 6); LH.synTxt(e, en, 'SED DE SANGRE +6', '#ff2d6f', 'vc'); }
    if (L('dmg') >= 2 && L('fire') >= 2 && Math.random() < 0.12) { p.fireCooldown = 0; LH.synTxt(e, en, 'FUEGO CRUZADO', '#ffe600', 'df'); }
    if (L('pulse') && L('radius') && LH.syn.n % 12 === 0 && p.pulseCooldown > 0) { p.pulseCooldown = 0; LH.synTxt(e, en, 'SOBRECARGA', '#00f3ff', 'pr'); }
};
{
    const _ok = LH.onKill;
    LH.onKill = (e, en) => {
        _ok(e, en);
        try {
            const id = LH.eid(en); LH.prog.bk = LH.prog.bk || {}; LH.prog.bk[id] = (LH.prog.bk[id] || 0) + 1;
            if (en.kind === 'flank' && (LH.prog.flank = (LH.prog.flank || 0) + 1) >= 20) LH.unlock('flank');
            if (en.kind === 'medic' && (LH.prog.medic = (LH.prog.medic || 0) + 1) >= 10) LH.unlock('medic');
            LH.synergy(e, en);
        } catch (x) {}
    };
}

// ---------------------------------------------------------------- D) SKINS DEL PROTAGONISTA (se desbloquean con logros) + BESTIARIO
// Los skins giran el tono de TODO el traje (azules y cian) en cada fotograma ya cacheado; se eligen en Progreso > SKINS.
LH.SKINS = [
    { id: 'cian', name: 'CIAN', hue: null, req: () => true, desc: 'El clásico' },
    { id: 'magenta', name: 'MAGENTA', hue: 320, req: () => Stats.d.bestWave >= 5, desc: 'Llega a la onda 5' },
    { id: 'dorado', name: 'DORADO', hue: 48, req: () => LH.ach.w10, desc: 'Logro SUPERVIVIENTE' },
    { id: 'verde', name: 'TÓXICO', hue: 112, req: () => LH.ach.k500, desc: 'Logro CAZADOR' },
    { id: 'rojo', name: 'CARMESÍ', hue: 356, req: () => LH.ach.boss, desc: 'Logro CAZAJEFES' },
    { id: 'violeta', name: 'ULTRAVIOLETA', hue: 275, req: () => LH.ach.daily, desc: 'Logro MADRUGADOR' },
    { id: 'fantasma', name: 'FANTASMA', hue: -1, req: () => LH.ach.w15, desc: 'Logro LEYENDA' }
];
LH.skinOk = (s) => { try { return !!s.req(); } catch (e) { return s.id === 'cian'; } };
LH.hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx / 255]; };
LH.rgbOf = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, k = Math.floor(h / 60) % 6, t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k]; return [(t[0] + m) * 255, (t[1] + m) * 255, (t[2] + m) * 255]; };
LH.skinCv = (cv, id) => {
    const sk = LH.SKINS.find(s => s.id === id); if (!sk || sk.hue === null) return cv;
    const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const g = o.getContext('2d'); g.drawImage(cv, 0, 0);
    const im = g.getImageData(0, 0, o.width, o.height), d = im.data, delta = sk.hue - 195;
    for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue; const [h, s, v] = LH.hsv(d[i], d[i + 1], d[i + 2]);
        if (s < 0.3 || h < 165 || h > 255) continue;                                // solo el traje azul/cian (blancos, rojo y grises se quedan)
        const c = sk.hue < 0 ? LH.rgbOf(h, s * 0.12, Math.min(1, v * 1.1)) : LH.rgbOf((h + delta + 360) % 360, s, v);
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    g.putImageData(im, 0, 0); return o;
};
LH.skin = LH.load('linehotSkin', 'cian'); LH.skinCache = {};
{
    const _hr = LH.heroRot; LH.heroRot0 = _hr;
    LH.heroRot = (q, f, d, k) => {
        const sk = LH.skin; if (!sk || sk === 'cian') return _hr(q, f, d, k);
        const key = sk + '|' + q + '|' + f + '|' + d + '|' + k;
        return LH.skinCache[key] || (LH.skinCache[key] = LH.skinCv(_hr(q, f, d, k), sk));
    };
    const _u = LH.unlock;
    LH.unlock = (id) => { const n0 = LH.SKINS.filter(LH.skinOk).length; _u(id); if (LH.SKINS.filter(LH.skinOk).length > n0) setTimeout(() => LH.toast('🎨 NUEVO SKIN DESBLOQUEADO'), 1800); };
}
LH.paintSkins = () => {
    const el = $id('skinList'); if (!el) return;
    if (!LH.SKINS.find(s => s.id === LH.skin && LH.skinOk(s))) LH.skin = 'cian';
    el.innerHTML = LH.SKINS.map(s => { const ok = LH.skinOk(s), on = LH.skin === s.id;
        return `<button class="row skin${on ? ' on' : ''}${ok ? '' : ' lock'}" data-sk="${s.id}"><canvas class="sk-cv" data-skcv="${s.id}" width="36" height="36"></canvas><span class="row-label">${ok ? '' : '🔒 '}${s.name}<small>${ok ? (on ? 'EQUIPADO' : s.desc) : 'Bloqueado · ' + s.desc}</small></span><span class="val-pill">${on ? '✓' : ''}</span></button>`; }).join('');
    el.querySelectorAll('canvas[data-skcv]').forEach(cv => {
        const id = cv.dataset.skcv, s = LH.SKINS.find(x => x.id === id), g = cv.getContext('2d'); g.clearRect(0, 0, 36, 36); g.imageSmoothingEnabled = false;
        if (!LH.skinOk(s)) g.globalAlpha = 0.3; g.drawImage(LH.skinCv(LH.heroRot0(0, 0, 0, 0), id), 0, 0);
    });
};
LH.BEST = [
    { id: 'drone', t: 0, art: 'drone', name: 'DRON', desc: 'Te persigue sin parar y siempre va en grupo.' },
    { id: 'tank', t: 1, art: 'tank', name: 'TANQUE', desc: 'Lento y blindado: aguanta muchísimo daño.' },
    { id: 'diamond', t: 2, art: 'diamond', name: 'TIRADOR', desc: 'Mantiene la distancia y te dispara.' },
    { id: 'swarm', t: 3, art: 'swarm', name: 'ENJAMBRE', desc: 'Diminutos y rapidísimos: llegan por docenas.' },
    { id: 'kami', t: 6, art: 'kami', name: 'KAMIKAZE', desc: 'Se lanza contra ti: esquívalo en el último momento.' },
    { id: 'split', t: 7, art: 'split', name: 'DIVISOR', desc: 'Al morir se parte en tres enjambres.' },
    { id: 'sniper', t: 8, art: 'sniper', name: 'FRANCOTIRADOR', desc: 'Apunta con láser rojo: cúbrete tras las paredes.' },
    { id: 'shield', t: 9, art: 'shield', name: 'ESCUDERO', desc: 'Su escudo frontal desvía balas: rómpelo con el pulso.' },
    { id: 'flank', t: 10, art: 'flank', name: 'FLANQUEADOR', desc: 'Te rodea, avisa con una línea amarilla y embiste.' },
    { id: 'medic', t: 14, art: 'medic', name: 'MÉDICO', desc: 'Cura a los demás enemigos: elimínalo primero.' }
];
LH.paintBest = () => {
    const el = $id('bestList'); if (!el) return;
    const seen = LH.prog.seen || {}, bk = LH.prog.bk || {}, n = LH.BEST.filter(b => seen[b.id]).length; LH._probe = true;
    el.innerHTML = `<p class="hint">DESCUBIERTOS ${n}/${LH.BEST.length}</p>` + LH.BEST.map(b => {
        let col = '#8f97b8'; try { col = makeEnemy(b.t, 0, 0, 1).color; } catch (e) {} const ok = !!seen[b.id];
        return `<div class="row static be${ok ? ' on' : ''}"><canvas class="sk-cv" data-be="${b.id}" data-col="${col}" data-ok="${ok ? 1 : 0}"></canvas><span class="row-label">${ok ? b.name : '???'}<small>${ok ? b.desc + ' · BAJAS ' + (bk[b.id] || 0) : 'Aún no te has encontrado con este enemigo'}</small></span></div>`; }).join('');
    LH._probe = false; LH.animBest(); if (n === LH.BEST.length) LH.unlock('bestia');
};
LH.animBest = () => {
    const pane = $id('bestList'); if (!pane || pane.classList.contains('hidden')) return; const fr = Math.floor(performance.now() / 450) & 1;
    pane.querySelectorAll('canvas[data-be]').forEach(cv => {
        const b = LH.BEST.find(x => x.id === cv.dataset.be), a = LH.eArt(LH.SPR[b.art] ? b.art : 'drone', fr, cv.dataset.ok === '1' ? cv.dataset.col : '#2b3050', 0), S = Math.max(2, Math.min(3, Math.floor(56 / Math.max(a.width, a.height))));
        cv.width = a.width; cv.height = a.height; cv.style.width = a.width * S + 'px'; cv.style.height = a.height * S + 'px'; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(a, 0, 0);
    });
};
setInterval(() => { if (typeof Menu !== 'undefined' && Menu.current === 'pProg') LH.animBest(); }, 450);
{
    const _pp = LH.paintProg;
    LH.paintProg = () => { _pp(); try { LH.paintSkins(); LH.paintBest(); } catch (e) { console.warn('[progreso]', e); } };
    const _onloadS = window.onload;
    window.onload = function () {
        _onloadS.call(this);
        const sl = $id('skinList'); if (sl) sl.addEventListener('click', (ev) => {
            const b = ev.target.closest && ev.target.closest('[data-sk]'); if (!b) return;
            const s = LH.SKINS.find(x => x.id === b.dataset.sk); if (!s || !LH.skinOk(s)) { try { audio.playUI('back'); } catch (e) {} return; }
            LH.skin = s.id; LH.save('linehotSkin', LH.skin); LH.paintSkins(); try { audio.playUI('toggle'); } catch (e) {}
        });
    };
}

// ---------------------------------------------------------------- E) MUERTE EN PÍXELES: el protagonista se rompe en sus propios píxeles + onda de choque cuadrada
LH.shards = [];
LH.shatter = (p) => {
    const q = Math.round((((p.angle % TAU) + TAU) % TAU) / TAU * 32) % 32, cv = LH.heroRot(q, 0, p.dual ? 1 : 0, 0), w = cv.width, h = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data, calm = !!(Settings.calm || Settings.epi); LH.shards = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; if (d[i + 3] < 128) continue;
        const dx = (x - w / 2) * 2, dy = (y - h / 2) * 2, a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9, s = (50 + Math.random() * 230) * (calm ? 0.6 : 1);
        LH.shards.push({ x: p.x + dx, y: p.y + dy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')', l: 1.6 + Math.random() * 0.9 });
    }
    LH.shX = p.x; LH.shY = p.y; LH.shT = performance.now(); LH._shl = 0;
};
{
    const _go = GameEngine.prototype.gameOver;
    GameEngine.prototype.gameOver = function () { try { LH.shatter(this.player); } catch (e) { console.warn('[muerte]', e); } _go.call(this); };
    const _dr = GameEngine.prototype.draw;
    GameEngine.prototype.draw = function () {
        _dr.call(this);
        if (!LH.shards.length) return;
        if (this.state === 'PLAYING') { LH.shards.length = 0; return; }
        const now = performance.now(), dt = LH._shl ? Math.min(0.05, (now - LH._shl) / 1000) : 0.016; LH._shl = now;
        const k = Cam.m, calm = !!(Settings.calm || Settings.epi), dr = Math.exp(-dt * 2.2); let alive = 0;
        ctx.save(); ctx.setTransform(k[0] * renderK, k[1] * renderK, k[2] * renderK, k[3] * renderK, k[4], k[5]);
        for (const s of LH.shards) {
            s.l -= dt; if (s.l <= 0) continue; alive++; s.vx *= dr; s.vy *= dr; s.x += s.vx * dt; s.y += s.vy * dt;
            ctx.globalAlpha = Math.min(1, s.l * 2); ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x / 2) * 2, Math.round(s.y / 2) * 2, 2, 2);
        }
        const t = (now - LH.shT) / 1000;
        if (!calm && t < 0.9) {
            const R = t * 380, step = Math.max(0.02, 6 / Math.max(R, 20)); ctx.globalAlpha = (1 - t / 0.9) * 0.8; ctx.fillStyle = '#9ffcff';
            for (let a = 0; a < TAU; a += step) ctx.fillRect(Math.round((LH.shX + Math.cos(a) * R) / 2) * 2, Math.round((LH.shY + Math.sin(a) * R) / 2) * 2, 2, 2);
        }
        ctx.restore(); ctx.globalAlpha = 1; if (!alive && t > 0.9) LH.shards.length = 0;
    };
}

// ########## [animaciones2.js] ##########
// ---------------------------------------------------------------- ANIMACIONES DEL GAMEPLAY v2 (todo en pixel art)
// Todo cuelga de LH.A. Cada gancho va protegido: si algo fallara 3 veces, esa parte se apaga sola (LH.A.off) y el juego sigue.
//   PROTAGONISTA · ciclo de 8 fases al andar (los pies siguen la dirección real: adelante, atrás y de lado), balanceo del arma,
//                  respiración al estar quieto, inclinación al correr, polvo y huellas, flinch al recibir daño, pose de PULSO,
//                  estocada de la katana, sacar el arma (equipar) y chispa al cambiar.
//   ARMAS        · retroceso propio de cada arma (la mano y el arma retroceden juntas), corredera de la escopeta, calentamiento del
//                  minigun, carga del railgun, fogonazos pixel art de varios fotogramas, casquillos que ruedan y rebotan.
//   ENEMIGOS     · aparición con rebote, ciclo de andar según su velocidad (ya no parpadean todos a la vez), balanceo propio por tipo
//                  (dron flota, tanque pisa, divisor se estira…), aplastamiento al recibir un golpe, destello, aviso antes de disparar,
//                  y al morir: se rompen en TROZOS DE SU PROPIO SPRITE + silueta blanca + chispa + anillo.
//   BALAS        · balas enemigas que giran con contorno oscuro, nacen con un pequeño estirón, chispas al chocar con paredes y enemigos.
//   OBJETOS      · rebotan al caer, brillan, y al recogerlos estallan en confeti de píxeles. Texto flotante con "pop" de entrada.
//   EFECTOS      · katana con estela de píxeles que barre el arco, railgun con chispas a lo largo del rayo, cohete con llama y humo,
//                  explosión de bola de fuego, onda del PULSO con anillos y rayos, HUD (combo, vida, arma) con animaciones a saltos.
LH.A = { off: {}, fx: [], deb: [], cap: 480, errs: {}, noPix: false };
{
const A = LH.A, PU = 3, TAU2 = Math.PI * 2;
const snap = (v) => Math.round(v / PU) * PU;
const rnd = Math.random;
const ease = { out: (u) => 1 - (1 - u) * (1 - u), back: (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); } };
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
A.guard = (name, fn, fb) => function (...args) {
    if (A.off[name]) return fb ? fb.apply(this, args) : undefined;
    try { return fn.apply(this, args); }
    catch (e) { A.errs[name] = (A.errs[name] || 0) + 1; if (A.errs[name] >= 3) A.off[name] = true; console.warn('[anim2:' + name + ']', e); return fb ? fb.apply(this, args) : undefined; }
};
A.calm = () => !!(Settings.calm || Settings.epi);
A.k = () => Settings.perf ? 0.3 : ([1, 0.75, 0.55, 0.4][Q.level] || 0.4);      // cantidad de partículas según calidad
A.lite = () => !!Settings.perf || Q.level >= 3;
A.add = (o) => { if (A.fx.length < A.cap) { o.t = o.t || 0; A.fx.push(o); } return o; };
A.ember = (x, y, ang, sp, col, d, s, col2) => A.add({ k: 'ember', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, fr: 0.9, d, s: s || PU, col, col2 });
A.spark = (x, y, col, sc, d, delay) => A.add({ k: 'spark', x, y, col, sc: sc || 1, d: d || 0.22, t: delay || 0 });
A.ringfx = (x, y, r0, r1, d, col, th, spokes, delay) => A.add({ k: 'ring', x, y, r0, r1, d, col, th: th || PU, sp: spokes || 0, t: delay || 0 });
A.burst = (x, y, col, n, sp0, sp1, d, s, col2) => { n = Math.ceil(n * A.k()); for (let i = 0; i < n; i++) A.ember(x, y, rnd() * TAU2, sp0 + rnd() * (sp1 - sp0), col, d * (0.6 + rnd() * 0.6), s, col2); };

// ---------------------------------------------------------------- SISTEMA DE EFECTOS (chispas, polvo, casquillos, escombros…)
const SPARK = [
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]],
    [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2], [3, 0], [-3, 0], [0, 3], [0, -3]],
    [[3, 1], [-3, 1], [3, -1], [-3, -1], [1, 3], [-1, 3], [1, -3], [-1, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]
];
const ADD = { spark: 1, ring: 1, ember: 1, beam: 1, ghost: 1 };
const LAYER0 = { foot: 1, puff: 1 };
A.step = (dt) => {
    const F = A.fx; let w = 0;
    for (let i = 0; i < F.length; i++) {
        const o = F[i]; o.t += dt;
        if (o.t < 0) { F[w++] = o; continue; }
        if (o.t >= o.d) continue;
        if (o.vx !== undefined) { const f = Math.pow(o.fr || 0.9, dt * 60); o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= f; o.vy *= f; }
        if (o.k === 'shell') {
            o.z += o.vz * dt; o.vz -= 900 * dt; o.rot += dt * o.vr;
            if (o.z < 0) { o.z = 0; o.vz = -o.vz * 0.38; o.vx *= 0.55; o.vy *= 0.55; if (Math.abs(o.vz) < 45) { o.vz = 0; o.vr = 0; o.vx = o.vy = 0; } }
        }
        F[w++] = o;
    }
    F.length = w;
    const D = A.deb; w = 0;
    for (let i = 0; i < D.length; i++) {
        const o = D[i]; if ((o.t += dt) >= o.d) continue;
        const f = Math.pow(o.fr, dt * 60); o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= f; o.vy *= f;
        if (o.x < 0 || o.x > width) { o.vx *= -0.5; o.x = clamp(o.x, 0, width); }
        if (o.y < 0 || o.y > height) { o.vy *= -0.5; o.y = clamp(o.y, 0, height); }
        D[w++] = o;
    }
    D.length = w;
};
A.fball = (f, R) => {                                         // bola de fuego pixel art (fotograma f de 0 a 5), cacheada
    const key = 'fb' + f; A._fb = A._fb || {}; if (A._fb[key]) return A._fb[key];
    const cs = 5, n = Math.ceil(R * 2 / cs), cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d');
    const rf = [0.32, 0.64, 0.92, 1, 1, 0.96][f], hole = f >= 4 ? (f === 4 ? 0.3 : 0.5) : 0, cols = ['#fff6c0', '#ffd23a', '#ff8a1f', '#e8381c', '#7a1d3a'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - n / 2, dy = y + 0.5 - n / 2, d = Math.hypot(dx, dy) / (n / 2), hs = ((x * 73856093) ^ (y * 19349663) ^ (f * 83492791)) >>> 0;
        const rag = ((hs % 100) / 100 - 0.5) * 0.28 * (f + 1) / 3; if (d > rf + rag * 0.5 || d < hole) continue;
        const q = clamp01((d - hole) / Math.max(0.05, rf - hole) + rag * 0.4 + f * 0.04);
        c.fillStyle = cols[Math.min(4, Math.floor(q * 5))]; c.fillRect(x, y, 1, 1);
    }
    return (A._fb[key] = { cv, n, cs });
};
A.drawFx = (ctx, layer) => {
    const F = A.fx; if (!F.length && !(layer === 1 && A.deb.length)) return;
    for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
        for (let i = 0; i < F.length; i++) {
            const o = F[i]; if (o.t < 0 || (!!ADD[o.k] !== !!pass) || ((LAYER0[o.k] ? 0 : 1) !== layer)) continue;
            const u = o.t / o.d, a = 1 - u;
            switch (o.k) {
                case 'puff': { const s = Math.max(PU, snap(o.s0 + (o.s1 - o.s0) * u)); ctx.globalAlpha = (o.al || 0.5) * a; ctx.fillStyle = o.col || '#8a8fb8'; ctx.fillRect(snap(o.x - s / 2), snap(o.y - s / 2), s, s); break; }
                case 'foot': { ctx.globalAlpha = 0.34 * a; ctx.fillStyle = o.col || '#00b8cc'; ctx.fillRect(snap(o.x) - (o.h ? 3 : 1), snap(o.y) - (o.h ? 1 : 3), o.h ? 6 : 3, o.h ? 3 : 6); break; }
                case 'smoke': { const s = Math.max(PU, snap(o.s0 + (o.s1 - o.s0) * u)); ctx.globalAlpha = 0.5 * Math.pow(a, 0.8); ctx.fillStyle = u < 0.25 && o.hot ? o.hot : (o.col || '#4b4f69'); ctx.fillRect(snap(o.x - s / 2), snap(o.y - s / 2), s, s); break; }
                case 'shell': {
                    const al = u > 0.72 ? 1 - (u - 0.72) / 0.28 : 1, hz = (Math.floor(o.rot) & 1) === 0, gx = snap(o.x), gy = snap(o.y);
                    ctx.globalAlpha = 0.3 * al; ctx.fillStyle = '#000'; ctx.fillRect(gx - 2, gy + 1, 4, 2);
                    ctx.globalAlpha = al; ctx.fillStyle = '#ffd27a'; const zy = gy - Math.round(o.z / 2) * 2; if (hz) ctx.fillRect(gx - 2, zy - 1, 4, 2); else ctx.fillRect(gx - 1, zy - 2, 2, 4);
                    if (o.z === 0 && o.vz === 0 && u < 0.5 && Math.floor(o.t * 16) % 5 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(gx, zy - 1, 2, 1); }      // destello al reposar
                    break;
                }
                case 'ghost': { const sc = 1 + 0.32 * ease.out(u); ctx.globalAlpha = 0.9 * a * a; ctx.drawImage(o.cv, o.x - o.w * sc / 2, o.y - o.h * sc / 2, o.w * sc, o.h * sc); break; }
                case 'spark': {
                    const fr = Math.min(3, Math.floor(u * 4)), cs = PU * (o.sc >= 2.2 ? 3 : o.sc >= 1.4 ? 2 : 1), cells = SPARK[fr], x0 = snap(o.x), y0 = snap(o.y);
                    ctx.globalAlpha = fr >= 3 ? 0.55 : fr === 2 ? 0.85 : 1; ctx.fillStyle = fr === 0 ? '#ffffff' : (o.col || '#ffffff');
                    for (let j = 0; j < cells.length; j++) ctx.fillRect(x0 + cells[j][0] * cs - cs / 2, y0 + cells[j][1] * cs - cs / 2, cs, cs);
                    if (fr === 1) { ctx.fillStyle = '#fff'; ctx.fillRect(x0 - cs / 2, y0 - cs / 2, cs, cs); }
                    break;
                }
                case 'ring': {
                    const R = o.r0 + (o.r1 - o.r0) * ease.out(u), th = o.th, n = Math.max(8, Math.min(90, Math.round(R * TAU2 / (th * 2.3))));
                    ctx.globalAlpha = a; ctx.fillStyle = o.col;
                    for (let j = 0; j < n; j++) { const an = j / n * TAU2; ctx.fillRect(snap(o.x + Math.cos(an) * R) - th / 2, snap(o.y + Math.sin(an) * R) - th / 2, th, th); }
                    if (o.sp) for (let j = 0; j < o.sp; j++) {            // rayos: tres cuadrados que salen disparados
                        const an = j / o.sp * TAU2 + 0.2;
                        for (let q = 0; q < 3; q++) { const rr = R * 0.55 + q * th * 2.2 + R * 0.5 * u; ctx.globalAlpha = a * (1 - q * 0.28); ctx.fillRect(snap(o.x + Math.cos(an) * rr) - th / 2, snap(o.y + Math.sin(an) * rr) - th / 2, th, th); }
                    }
                    break;
                }
                case 'ember': { const s = Math.max(2, snap(o.s * (1 - 0.55 * u))) || PU; ctx.globalAlpha = 1 - u * u; ctx.fillStyle = (u > 0.5 && o.col2) ? o.col2 : o.col; ctx.fillRect(snap(o.x) - s / 2, snap(o.y) - s / 2, s, s); break; }
                case 'beam': {
                    const dx = o.x2 - o.x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = Math.min(110, Math.floor(L / 24)), fl = Math.floor(o.t * 36);
                    ctx.fillStyle = o.col;
                    for (let j = 0; j < n; j++) {
                        if ((j * 7 + fl) % 3 === 0) continue; const f = (j + 0.5) / n, off = (((j * 53 + fl * 17) % 9) - 4) * 2 * (1 - u), s = PU * (a > 0.5 ? 2 : 1);
                        ctx.globalAlpha = a; ctx.fillRect(snap(o.x1 + dx * f + nx * off) - s / 2, snap(o.y1 + dy * f + ny * off) - s / 2, s, s);
                    }
                    break;
                }
                case 'fball': {
                    const f = Math.min(5, Math.floor(u * 6)), S = A.fball(f, o.R), sc = o.R * 2 / (S.n * S.cs) * S.cs;
                    ctx.globalAlpha = u > 0.62 ? 1 - (u - 0.62) / 0.38 : 1; ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(S.cv, o.x - o.R, o.y - o.R, o.R * 2, o.R * 2);
                    break;
                }
            }
        }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (layer === 1) {                                              // escombros: trozos del propio sprite
        const D = A.deb;
        for (let i = 0; i < D.length; i++) {
            const o = D[i], u = o.t / o.d; if (u > 0.7 && (Math.floor(o.t * 30) & 1)) continue;          // parpadean al final
            ctx.globalAlpha = u > 0.7 ? 0.75 : 1; ctx.fillStyle = o.col; const s = Math.max(2, Math.round(o.s * (1 - 0.4 * u)));
            ctx.fillRect(Math.round(o.x - s / 2), Math.round(o.y - s / 2), s, s);
        }
        ctx.globalAlpha = 1;
    }
};
A.shellFx = (x, y, ang, side, delay) => {                             // casquillo: sale de lado, rebota y rueda
    const sx = -Math.sin(ang) * side, sy = Math.cos(ang) * side, sp = 90 + rnd() * 90;
    A.add({ k: 'shell', x, y, vx: sx * sp - Math.cos(ang) * (20 + rnd() * 30), vy: sy * sp - Math.sin(ang) * (20 + rnd() * 30), z: 10, vz: 130 + rnd() * 100, rot: rnd() * 4, vr: 18 + rnd() * 16, fr: 0.93, d: 0.95, t: delay || 0 });
};
A.puffFx = (x, y, vx, vy, s0, s1, d, col, al) => A.add({ k: 'puff', x, y, vx, vy, fr: 0.9, s0, s1, d, col, al });

// ---------------------------------------------------------------- PROTAGONISTA: fotogramas
LH.heroGrid2 = (P) => {
    const W = 24, H = 22, g = Array.from({ length: H }, () => Array(W).fill(null));
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const ell = (ex, ey, rx, ry, fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + .5 - ex) / rx, v = (y + .5 - ey) / ry; if (u * u + v * v <= 1) fn(x, y, u, v); } };
    const ax = P.ax | 0, ay = P.ay | 0, br = P.br | 0, hx = P.hx | 0, pose = P.pose | 0, blink = P.blink | 0, hurt = pose === 3;
    const pk = ax >= 3 ? -1 : ax <= -3 ? 1 : 0, sh = ax >= 3 ? 1 : ax <= -3 ? -1 : 0;
    rect(7 + ax, 1 + ay, 6, 3, '#0d1530'); rect(11 + ax, 1 + ay, 2, 3, '#00d9ee'); rect(12 + ax, 1 + ay, 1, 1, '#ffffff');                 // botas: cada pie sigue la dirección del paso
    rect(7 - ax, 19 - ay, 6, 3, '#0d1530'); rect(11 - ax, 19 - ay, 2, 3, '#00d9ee'); rect(12 - ax, 19 - ay, 1, 1, '#ffffff');
    rect(1 + pk, 7, 5, 8, '#4b5170'); rect(1 + pk, 7, 5, 2, '#8b91ab'); rect(1 + pk, 13, 5, 2, '#2d3250');   // mochila (balanceo por inercia)
    set(2 + pk, 10, blink === 2 ? '#ff2d3d' : blink ? '#ffffff' : '#00f3ff'); set(2 + pk, 11, blink === 2 ? '#a01028' : blink ? '#00f3ff' : '#087782'); set(3 + pk, 10, '#2d3250'); set(3 + pk, 11, '#2d3250');
    ell(9.5, 10.5, 6 + 0.4 * br, 8.4 + 0.3 * br, (x, y, u, v) => { const l = -u * .45 - v * .85; set(x, y, l > .6 ? '#4a9be0' : l > .15 ? '#2b7fc0' : l > -.35 ? '#1d5f9c' : '#124a78'); });   // el pecho se hincha al respirar
    rect(7 + sh, 2, 6, 2, '#00d9ee'); rect(8 + sh, 2, 3, 1, '#9ffcff'); rect(7 - sh, 18, 6, 2, '#0098ad'); rect(8 - sh, 18, 3, 1, '#00d9ee');   // hombreras
    rect(6, 10, 4, 2, '#5ffbff'); rect(6, 10, 1, 2, '#ffffff');
    ell(12.5, 10.5, 5.7, 5.7, (x, y) => { if (g[y][x]) set(x, y, '#0b1a3a'); });
    ell(12.5, 10.5, 4.7, 4.7, (x, y, u, v) => { const l = -u * .4 - v * .85; set(x, y, l > .55 ? '#7d9fe0' : l > .05 ? '#566fba' : l > -.4 ? '#3a4f93' : '#26356b'); });
    for (let y = 7; y < 15; y++) for (let x = 14; x < 19; x++) { const u = (x + .5 - 12.5) / 4.7, v = (y + .5 - 10.5) / 4.7; if (u * u + v * v <= 1 && u > 0.38 && Math.abs(v) < 0.78) set(x, y, hurt ? '#ff6a7a' : '#00f3ff'); }
    set(16, 8 + br, '#ffffff'); set(16, 9 + br, hurt ? '#ffd0d6' : '#c8ffff'); set(15, 8 + br, hurt ? '#ffb0ba' : '#8afaff');
    if (hx <= -2) { set(15, 9, '#ffffff'); set(15, 10, '#c8ffff'); set(16, 10, '#ffffff'); }       // entrecierra la visera con el retroceso fuerte
    rect(10, 9, 4, 3, '#3a4f93'); rect(11, 10, 3, 1, '#5ffbff');
    const line = (x0, y0, x1, y1, c, c2) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; set(x, y, c); set(x, y + 1, c2); } };
    let hands = P.dual ? [[18, 5], [18, 15]] : [[17, 8], [17, 12]];
    if (pose === 1) hands = P.dual ? [[16, 0], [16, 20]] : [[16, 1], [16, 19]];                   // PULSO: brazos abiertos
    else if (pose === 2) hands = hands.map(([a, b]) => [a + 2, b]);                               // estocada: brazos adelante
    else if (pose === 3) hands = hands.map(([a, b]) => [a - 2, b + (b < 10 ? 1 : -1)]);           // golpe recibido: se encoge
    hands = hands.map(([a, b]) => [a + (pose === 0 ? hx : 0), b]);
    line(11, 4, hands[0][0] - 1, hands[0][1], '#2b7fc0', '#1d5f9c'); line(11, 17, hands[1][0] - 1, hands[1][1] + 1, '#1d5f9c', '#124a78');
    for (const [x, y] of hands) { rect(x, y, 2, 2, pose === 1 ? '#ffffff' : '#5ffbff'); set(x, y, '#ffffff'); }
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) { const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b] && g[y + b][x + a]); if (nb) out[y][x] = '#02080f'; }
    return out;
};
LH.heroCache2 = {}; LH.heroCache2n = 0;
LH.heroRot2 = (q, P) => {
    const ck = q + '|' + P.ax + '|' + P.ay + '|' + P.br + '|' + P.hx + '|' + P.pose + '|' + P.blink + '|' + (P.dual ? 1 : 0) + '|' + (P.red ? 1 : 0);
    const hit = LH.heroCache2[ck]; if (hit) return hit;
    if (LH.heroCache2n > 3000) { LH.heroCache2 = {}; LH.heroCache2n = 0; }
    const g = LH.heroGrid2(P), art = document.createElement('canvas'); art.width = 24; art.height = 22;
    const a = art.getContext('2d'); g.forEach((row, y) => row.forEach((col, x) => { if (col) { a.fillStyle = col; a.fillRect(x, y, 1, 1); } }));
    const n = 36, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.translate(n / 2, n / 2); c.rotate(q / 32 * TAU2); c.drawImage(art, -10, -11);
    LH.heroCache2n++; return (LH.heroCache2[ck] = cv);
};

// ---------------------------------------------------------------- PROTAGONISTA: estado, pose y dibujo
const COS8 = [1, 0.7, 0, -0.7, -1, -0.7, 0, 0.7], SIN8 = [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7];
A.sprite = LH.pixSprite;                                              // sprite real del arma (LH.pixSprite se oculta mientras se dibuja la nave antigua)
LH.pixSprite = (k) => A.noPix ? null : A.sprite(k);
A.WP = {                                                              // k: retroceso en píxeles de arte · d: duración · fl: tipo de fogonazo
    PISTOL: { k: 1, d: 0.10, fl: 'sm', shell: 1, fd: 0.09 }, AKIMBO: { k: 1, d: 0.10, fl: 'sm', shell: 1, fd: 0.09 },
    SHOTGUN: { k: 3, d: 0.24, fl: 'cone', shell: 2, pump: 1, fd: 0.11 }, MINIGUN: { k: 1, d: 0.07, fl: 'long', shell: 1, jit: 1, fd: 0.08 },
    KATANA: { k: 0, d: 0.1 }, RAILGUN: { k: 3, d: 0.5, fl: 'rail', fd: 0.16 }, LASER: { k: 1, d: 0.06, fl: 'beam', fd: 0.07 },
    ROCKET: { k: 3, d: 0.32, fl: 'tube', fd: 0.12 }, ARC: { k: 1, d: 0.09, fl: 'arc', fd: 0.09 }
};
A.hs = (p) => p._a || (p._a = { ph: 0, v: 0, dx: 1, dy: 0, walking: false, lastSg: 0, shotT: -9, key: 'PISTOL', shots: 0, heat: 0, hurtT: -9, hfx: 0, hfy: 0, pulseT: -9, swingT: -9, swingR: 15, eq: -9, w: null, hp0: undefined, ox: 0, oy: 0, hx: 0, smkT: 0, zapT: 0 });
A.plant = (p, a, side) => {
    const c = Math.cos(p.angle), s = Math.sin(p.angle), bx = p.x - a.dx * 5 - s * side * 6, by = p.y - a.dy * 5 + c * side * 6;
    if (!A.lite() && a.v > 60) A.add({ k: 'foot', x: bx, y: by, h: Math.abs(a.dx) > Math.abs(a.dy), d: 0.9 });
    if (a.v > 150 && !A.lite()) A.puffFx(bx, by, -a.dx * 30 + (rnd() - 0.5) * 20, -a.dy * 30 + (rnd() - 0.5) * 20, 3, 9, 0.32, '#8a8fb8', 0.5);
};
A.onHurt = (p, a, t) => {
    a.hurtT = t; let best = 1e9, bx = 0, by = 0;
    for (const e of engine.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < best) { best = d; bx = e.x; by = e.y; } }
    if (best < 220) { const d = best || 1; a.hfx = (p.x - bx) / d; a.hfy = (p.y - by) / d; } else { a.hfx = -Math.cos(p.angle); a.hfy = -Math.sin(p.angle); }
    A.spark(p.x + a.hfx * -8, p.y + a.hfy * -8, '#ff2d3d', 1.6, 0.22); A.burst(p.x, p.y, '#ff2d3d', 7, 80, 260, 0.35, PU, '#7a1d3a');
    A.hudPop('.bars-container', 'hudHit');
};
A.onEquip = (p, a) => {
    const c = Math.cos(p.angle), s = Math.sin(p.angle), col = p.weapon.color || '#fff';
    A.spark(p.x + c * 26, p.y + s * 26, col, 1.6, 0.26); A.ringfx(p.x, p.y, 10, 38, 0.26, col, PU); A.hudPop('.weapon-info', 'hudEq');
};
A.heroStep = A.guard('step', function (p, dt, px, py, kx, ky) {
    const a = A.hs(p), t = LH.now();
    const dx = p.x - px, dy = p.y - py, rx = dx - kx * dt, ry = dy - ky * dt, L = Math.hypot(rx, ry);
    let v = L / Math.max(dt, 1e-4); const want = Math.hypot(p.vx || 0, p.vy || 0); v = Math.min(v, want * 1.05 + 1);
    a.v += (v - a.v) * Math.min(1, dt * 16);
    if (L > 0.05 && v > 25) { const k = Math.min(1, dt * 22); a.dx += (rx / L - a.dx) * k; a.dy += (ry / L - a.dy) * k; const n = Math.hypot(a.dx, a.dy) || 1; a.dx /= n; a.dy /= n; }
    a.walking = a.walking ? a.v > 28 : a.v > 60;
    if (a.walking) a.ph += a.v * dt / 110;                                  // un ciclo de pasos cada ~110 px recorridos
    else { const tg = Math.round(a.ph * 2) / 2; a.ph += (tg - a.ph) * Math.min(1, dt * 16); }
    const s = Math.sin(a.ph * TAU2), sg = s > 0.85 ? 1 : s < -0.85 ? -1 : 0;
    if (a.walking && sg && sg !== a.lastSg) { a.lastSg = sg; A.plant(p, a, sg); }
    if (!a.walking) a.lastSg = 0;
    if (a.hp0 !== undefined && p.hp < a.hp0 - 0.01) A.onHurt(p, a, t);
    a.hp0 = p.hp;
    if (a.w !== p.weapon) { if (a.w) { a.eq = t; A.onEquip(p, a); } a.w = p.weapon; }
    a.heat = Math.max(0, a.heat - dt * 0.6);
    if (p.maxHp > 0 && p.hp > 0 && p.hp / p.maxHp < 0.3 && !A.calm()) {       // poca vida: humo y chispas eléctricas
        if (t - a.smkT > 0.22) { a.smkT = t; const bx = p.x - Math.cos(p.angle) * 9, by = p.y - Math.sin(p.angle) * 9; engine.spawnParticle(bx, by, (a.shots & 1) ? '#ff9a3c' : '#6b6f8f', 1, 0, -35, 45); a.shots++; }
        if (t - a.zapT > 0.5 + rnd() * 0.5) { a.zapT = t; A.spark(p.x + (rnd() - 0.5) * 20, p.y + (rnd() - 0.5) * 20, '#ffe600', 1, 0.2); }
    }
});
A.heroPose = (p, a, t) => {
    const key = LH.wKey(p) || 'PISTOL', wp = A.WP[key] || A.WP.PISTOL, since = t - a.shotT;
    let kick = 0; if (wp.k && since >= 0 && since < wp.d) kick = Math.round(wp.k * Math.pow(1 - since / wp.d, 0.8));
    let pump = 0; if (wp.pump && since > 0.1 && since < 0.34) { const u = (since - 0.1) / 0.24; pump = u < 0.5 ? Math.round(u * 4) : Math.round((1 - u) * 4); }
    const s = Math.sin(a.ph * TAU2), S = (Math.abs(s) > 0.8 ? 3 : Math.abs(s) > 0.35 ? 2 : 0) * Math.sign(s);
    const dl = Math.atan2(a.dy, a.dx) - p.angle, sec = ((Math.round(dl / (Math.PI / 4)) % 8) + 8) % 8;
    const bob = a.walking ? (S >= 3 ? 1 : S <= -3 ? -1 : 0) : 0;
    let pose = 0; if (t - a.hurtT < 0.14) pose = 3; else if (t - a.pulseT < 0.26) pose = 1; else if (t - a.swingT < 0.2) pose = 2;
    const calm = A.calm(), low = p.maxHp > 0 && p.hp / p.maxHp < 0.3;
    let ox = 0, oy = 0;
    if (a.walking && a.v > 200) { ox += Math.round(a.dx) * 2; oy += Math.round(a.dy) * 2; }            // se inclina hacia donde corre
    const us = (t - a.swingT) / 0.09; if (us >= 0 && us < 1) { const r = a.swingR * (1 - ease.out(us)); ox -= Math.cos(p.angle) * r; oy -= Math.sin(p.angle) * r; }   // estocada suave (la posición real salta de golpe)
    const uh = (t - a.hurtT) / 0.16; if (uh >= 0 && uh < 1) { const f = 4 * (1 - uh); ox += a.hfx * f; oy += a.hfy * f; }
    a.ox = ox; a.oy = oy; a.hx = clamp(-kick - pump + bob, -3, 1);
    return {
        q: Math.round((((p.angle % TAU2) + TAU2) % TAU2) / TAU2 * 32) % 32, ax: Math.round(S * COS8[sec]), ay: Math.round(S * SIN8[sec]),
        br: (!a.walking && since > 0.4) ? (Math.floor(t * 0.8) & 1) : 0, hx: a.hx, pose, dual: p.dual ? 1 : 0,
        blink: low ? (calm ? 2 : (Math.floor(t * 2) & 1) * 2) : (calm ? 0 : Math.floor(t * 2) & 1)
    };
};
const _dh0 = LH.drawHero;
A.drawHero = (ctx, p) => {
    if (LH.shards && LH.shards.length && engine.state === 'GAMEOVER') return;       // se está rompiendo en píxeles (mejoras9.js)
    ctx.rotate(-p.angle);
    const t = LH.now(), a = A.hs(p);
    if (p._born === undefined) p._born = t;
    const age = t - p._born;
    if (!p._bornFx && age < 0.3) { p._bornFx = 1; engine.spawnParticle(p.x, p.y, '#00f3ff', 14, 0, 0, 160); A.ringfx(p.x, p.y, 6, 52, 0.38, '#9ffcff', PU, 8); }
    const P = A.heroPose(p, a, t);
    let cv = LH.heroRot2(P.q, P);
    if (t - a.hurtT < 0.18 && LH.heroTint) cv = LH.heroTint(cv);
    const tr = ctx.getTransform(), k = Math.hypot(tr.a, tr.b) || 1, S = Math.max(1, Math.round(2 * k)) / k;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.34)';                                    // sombra en píxeles (se queda en el suelo)
    for (let j = -3; j <= 3; j++) { const hw = Math.round(Math.sqrt(1 - (j / 3.6) ** 2) * 6); ctx.fillRect(-hw * 2 + 4, j * 2 + 10, hw * 4, 2); }
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    const w = cv.width * S, h = cv.height * S, X = -w / 2 + a.ox, Y = -h / 2 + a.oy;
    if (age < 0.6) {                                                                  // aparición: se revela de arriba abajo
        const rows = Math.max(1, Math.round(cv.height * age / 0.6));
        ctx.drawImage(cv, 0, 0, cv.width, rows, X, Y, w, rows * S);
        ctx.fillStyle = '#9ffcff'; ctx.fillRect(X, Y + rows * S, w, S);
    } else ctx.drawImage(cv, X, Y, w, h);
};
LH.drawHero = (ctx, p) => { if (A.off.hero) return _dh0(ctx, p); try { A.drawHero(ctx, p); } catch (e) { A.errs.hero = (A.errs.hero || 0) + 1; if (A.errs.hero >= 3) A.off.hero = true; console.warn('[anim2:hero]', e); _dh0(ctx, p); } };

// ---------------------------------------------------------------- ARMAS: disparo, arma en la mano y fogonazos
const FL = {
    sm: [[[0, 0, 1], [1, 0, 1], [2, 0, 0], [1, 1, 0], [1, -1, 0], [3, 0, 0], [0, 1, 0], [0, -1, 0]], [[1, 0, 1], [2, 0, 0], [3, 0, 0], [2, 1, 0], [2, -1, 0]], [[2, 0, 0], [4, 0, 0], [3, 1, 0], [3, -1, 0]]],
    cone: [[[0, 0, 1], [1, 0, 1], [1, 1, 1], [1, -1, 1], [2, 0, 1], [2, 1, 0], [2, -1, 0], [2, 2, 0], [2, -2, 0], [3, 0, 0], [3, 1, 0], [3, -1, 0], [3, 2, 0], [3, -2, 0], [3, 3, 0], [3, -3, 0], [4, 0, 0], [4, 1, 0], [4, -1, 0], [4, 2, 0], [4, -2, 0], [5, 0, 0]],
        [[1, 0, 1], [2, 0, 0], [2, 1, 0], [2, -1, 0], [3, 0, 0], [3, 2, 0], [3, -2, 0], [4, 1, 0], [4, -1, 0], [4, 3, 0], [4, -3, 0], [5, 0, 0]], [[3, 0, 0], [3, 2, 0], [3, -2, 0], [5, 1, 0], [5, -1, 0], [6, 0, 0]]],
    long: [[[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 0], [4, 0, 0], [1, 1, 0], [1, -1, 0], [2, 1, 0], [2, -1, 0], [5, 0, 0]], [[1, 0, 1], [2, 0, 0], [3, 0, 0], [4, 0, 0], [2, 1, 0], [2, -1, 0]], [[2, 0, 0], [4, 0, 0], [5, 0, 0]]],
    rail: [[[0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1], [0, -1, 1], [1, 2, 0], [1, -2, 0], [1, 3, 0], [1, -3, 0], [2, 1, 0], [2, -1, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [6, 0, 0]],
        [[1, 0, 1], [1, 2, 0], [1, -2, 0], [1, 4, 0], [1, -4, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [7, 0, 0]], [[1, 3, 0], [1, -3, 0], [1, 5, 0], [1, -5, 0], [4, 0, 0], [8, 0, 0]]],
    beam: [[[0, 0, 1], [1, 0, 0], [1, 1, 0], [1, -1, 0], [2, 0, 0]], [[0, 0, 1], [1, 0, 0]], [[1, 0, 0]]],
    tube: [[[0, 0, 1], [1, 0, 1], [1, 1, 0], [1, -1, 0], [2, 0, 0], [2, 1, 0], [2, -1, 0], [3, 0, 0], [0, 1, 0], [0, -1, 0]], [[1, 0, 1], [2, 0, 0], [3, 0, 0], [3, 1, 0], [3, -1, 0]], [[3, 0, 0], [4, 1, 0], [4, -1, 0]]]
};
A.onShoot = A.guard('shoot', function (p, w, nb) {
    const a = A.hs(p), t = LH.now(), key = Object.keys(WEAPONS).find(k => WEAPONS[k] === w) || 'PISTOL';
    a.shotT = t; a.key = key;
    if (w.type === 'melee') { a.swingT = t; a.swingR = Math.abs(w.recoil || 15); return; }
    const wp = A.WP[key] || A.WP.PISTOL, c = Math.cos(p.angle), s = Math.sin(p.angle), sp = A.sprite(key), tip = sp ? -4 + 2 * sp.width - 2 : 30, lats = p.dual ? [-9, 9] : [0];
    if (!A.lite()) for (const l of lats) {
        const mx = p.x + c * tip - s * l, my = p.y + s * tip + c * l, n = key === 'SHOTGUN' ? 4 : 2;
        for (let i = 0; i < n; i++) A.ember(mx, my, p.angle + (rnd() - 0.5) * (key === 'SHOTGUN' ? 1.2 : 0.8), 240 + rnd() * 220, w.color, 0.13, PU, '#ffffff');
    }
    if (wp.shell && !A.lite()) for (let i = 0; i < wp.shell; i++) for (const l of lats) A.shellFx(p.x + c * 8 - s * l, p.y + s * 8 + c * l, p.angle, rnd() < 0.85 ? 1 : -1, wp.pump ? 0.2 + i * 0.07 : 0);
    if (key === 'MINIGUN' || key === 'LASER') a.heat = Math.min(1, a.heat + 0.05);
    if (w.type === 'rail' && engine.beams.length > nb) { const b = engine.beams[engine.beams.length - 1]; A.add({ k: 'beam', x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, d: 0.45, col: '#9ffcff' }); A.ringfx(p.x + c * 30, p.y + s * 30, 6, 40, 0.3, '#9ffcff', PU); }
    if (key === 'ROCKET') for (let i = 0; i < 6; i++) A.add({ k: 'smoke', x: p.x - c * 14, y: p.y - s * 14, vx: -c * (120 + rnd() * 120) + (rnd() - 0.5) * 90, vy: -s * (120 + rnd() * 120) + (rnd() - 0.5) * 90, fr: 0.9, s0: 6, s1: 18, d: 0.5 + rnd() * 0.3, col: '#6b6f8f', hot: '#ff9a3c' });
});
{
    const _sh = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        const w = this.weapon, cd0 = this.fireCooldown, nb = engine.beams ? engine.beams.length : 0;
        const r = _sh.call(this);
        if (this.fireCooldown > 0 && this.fireCooldown !== cd0) A.onShoot(this, w, nb);
        return r;
    };
    const _pu = Player.prototype.update;
    Player.prototype.update = function (dt) {
        const px = this.x, py = this.y, kx = this.kx || 0, ky = this.ky || 0;
        const r = _pu.call(this, dt);
        A.heroStep(this, dt, px, py, kx, ky);
        return r;
    };
    const _pp = Player.prototype.pulse;
    Player.prototype.pulse = function () {
        const cd = this.pulseCooldown; _pp.call(this);
        if (cd <= 0 && this.pulseCooldown > 0) A.hs(this).pulseT = LH.now();
    };
}
A.cells = (ctx, list, x0, y0, ang, tip, lat, col, alpha) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < list.length; i++) {
        const q = list[i], lx = tip + q[0] * PU, ly = lat + q[1] * PU, wx = x0 + c * lx - s * ly, wy = y0 + s * lx + c * ly;
        ctx.globalAlpha = alpha; ctx.fillStyle = q[2] ? '#ffffff' : col; ctx.fillRect(snap(wx) - PU / 2, snap(wy) - PU / 2, PU, PU);
    }
};
A.drawWeapon = A.guard('weapon', function (ctx, p) {
    const a = A.hs(p), t = LH.now(), key = LH.wKey(p), sp = key && A.sprite(key); if (!sp) return;
    const w = p.weapon, wp = A.WP[key] || A.WP.PISTOL, S = 2, ang = p.angle, left = Math.cos(ang) < 0, since = t - a.shotT, melee = w.type === 'melee';
    ctx.save();
    try {
        if (p.iframes > 0 && Math.floor(p.iframes * 20) % 2) ctx.globalAlpha = 0.5;
        ctx.translate(p.x + a.ox, p.y + a.oy); ctx.rotate(ang); if (left) ctx.scale(1, -1);
        ctx.imageSmoothingEnabled = false;
        const eqk = (t - a.eq) / 0.24;
        if (eqk >= 0 && eqk < 1) { const e = ease.back(eqk); ctx.rotate(-0.9 * (1 - e)); ctx.translate(-8 * (1 - e), 0); ctx.scale(0.65 + 0.35 * e, 0.65 + 0.35 * e); }   // sacar el arma
        if (melee) { const k = clamp01((t - a.swingT) / 0.2); if (k < 1) ctx.rotate(-1.1 + ease.out(k) * 2.2); }
        const hxw = a.hx * 2, jit = wp.jit && since < 0.1 ? ((Math.floor(t * 40) & 1) ? 2 : -2) : 0, ys = p.dual ? [-9, 9] : [0];
        for (const oy of ys) ctx.drawImage(sp, -4 + hxw, oy + jit - sp.height * S / 2, sp.width * S, sp.height * S);
        if (p.dual && melee) { ctx.rotate(Math.PI); ctx.drawImage(sp, -4, -sp.height * S / 2, sp.width * S, sp.height * S); }
        let glow = 0;
        if ((key === 'MINIGUN' || key === 'LASER') && a.heat > 0.05) glow = a.heat * 0.4;                           // el cañón se calienta
        else if (key === 'RAILGUN' && p.fireCooldown > 0) { const pr = 1 - p.fireCooldown / 1.6; glow = 0.08 + 0.4 * pr * pr; }       // carga del railgun
        if (glow > 0.03 && !melee) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow; for (const oy of ys) ctx.drawImage(sp, -4 + hxw, oy - sp.height * S / 2, sp.width * S, sp.height * S); }
    } finally { ctx.restore(); }
    // fogonazo (rejilla de píxeles de 3 u., alineada a la pantalla)
    const fd = wp.fd || 0.09;
    if (!melee && wp.fl && since >= 0 && since < fd && !Settings.perf) {
        const fr = since < fd * 0.33 ? 0 : since < fd * 0.66 ? 1 : 2, f = (key === 'ARC') ? [[[0, 0, 1], [1, (Math.floor(t * 60) % 3) - 1, 0], [2, (Math.floor(t * 47) % 3) - 1, 0], [3, 0, 0]], [[1, 1, 0], [2, -1, 0]], [[2, 0, 0]]][fr] : FL[wp.fl][fr];
        const sp2 = sp, tip = -4 + 2 * sp2.width - 2 + a.hx * 2, lats = p.dual ? [-9, 9] : [0];
        ctx.save(); try {
            ctx.globalCompositeOperation = 'lighter';
            for (const l of lats) A.cells(ctx, f, p.x + a.ox, p.y + a.oy, ang, tip, l, w.color, fr === 2 ? 0.7 : 1);
        } finally { ctx.restore(); }
    }
});
{
    const _pd = Player.prototype.draw;
    Player.prototype.draw = function (ctx) {
        if (A.off.hero) return _pd.call(this, ctx);
        const ft = this.flashT, ks = this.katanaSwingTime; this.flashT = 0; this.katanaSwingTime = 0; A.noPix = true;      // las animaciones antiguas del arma se sustituyen por las nuevas
        try { _pd.call(this, ctx); } finally { A.noPix = false; this.flashT = ft; this.katanaSwingTime = ks; }
        A.drawWeapon(ctx, this);
    };
}

// ---------------------------------------------------------------- HUD con animaciones a saltos (clases CSS alternas: reinician sin forzar reflow)
A.hudPop = (sel, cls) => {
    if (A.calm()) return;
    const el = A.hud && A.hud[sel] || ((A.hud = A.hud || {})[sel] = document.querySelector(sel)); if (!el) return;
    const n = el._pp ? 0 : 1; el._pp = n; el.classList.remove(cls + 'A', cls + 'B'); el.classList.add(cls + (n ? 'A' : 'B'));
};

// ---------------------------------------------------------------- ENEMIGOS
A.STEP = { drone: 34, tank: 46, diamond: 36, swarm: 24, giant: 70, boss: 90, kami: 30, split: 34, sniper: 40, shield: 40, flank: 28, medic: 32 };
A.enemyInit = (e, t) => (e._a = { born: t, px: e.x, py: e.y, walk: rnd() * 2, v: 0, hitT: -9, hx: 0, hy: 0, fc: e.fireCooldown || 0, tele: 0, kickT: -9, kang: 0, kind: LH.eid ? LH.eid(e) : 'drone' });
LH.eFrame = (e) => (e._a ? Math.floor(e._a.walk) & 1 : Math.floor(LH.now() * 4 + (e._ph || 0)) & 1);     // ciclo de andar según la velocidad real
A.enemyStep = (e, dt, t, pl) => {
    const a = e._a || A.enemyInit(e, t), dx = e.x - a.px, dy = e.y - a.py; a.px = e.x; a.py = e.y;
    a.v += (Math.hypot(dx, dy) / Math.max(dt, 1e-4) - a.v) * Math.min(1, dt * 12);
    const prev = Math.floor(a.walk); a.walk += a.v > 25 ? a.v * dt / (A.STEP[a.kind] || 36) : dt * 1.4;
    if ((a.kind === 'tank' || a.kind === 'giant') && a.v > 25 && Math.floor(a.walk) !== prev) {       // pisada pesada
        if (!A.lite()) A.puffFx(e.x + (rnd() - 0.5) * e.radius, e.y + e.radius * 0.5, 0, 0, 4, 12, 0.3, '#6b6f8f', 0.45);
        if (Math.hypot(e.x - pl.x, e.y - pl.y) < 420) engine.addShake(a.kind === 'giant' ? 2.5 : 1);
    }
    if (e.type === 2 && !e.kind) {                                                                       // tirador: aviso y fogonazo
        const fc = e.fireCooldown;
        if (fc > a.fc + 0.4) { const an = Math.atan2(pl.y - e.y, pl.x - e.x); a.kickT = t; a.kang = an; A.spark(e.x + Math.cos(an) * e.radius * 1.15, e.y + Math.sin(an) * e.radius * 1.15, '#ff2d3d', 1.4, 0.18); if (!A.lite()) for (let i = 0; i < 3; i++) A.ember(e.x + Math.cos(an) * e.radius, e.y + Math.sin(an) * e.radius, an + (rnd() - 0.5) * 0.8, 200 + rnd() * 120, '#ff2d3d', 0.14, PU, '#fff'); }
        a.tele = (fc < a.fc && fc > 0 && fc < 0.45) ? 1 - fc / 0.45 : 0; a.fc = fc;
    }
};
A.drawEnemy = (e, ctx, chain) => {
    if (e.dead) return;                                                                                   // ya se está rompiendo en trozos
    const t = LH.now(), a = e._a || A.enemyInit(e, t), age = t - a.born, kind = a.kind, calm = A.calm();
    let sx = 1, sy = 1, ox = 0, oy = 0, flash = false, alpha = 1;
    const big = !!e.boss || e.radius >= 40, pdur = e.boss ? 0.7 : 0.4;
    if (age < pdur) { const u = age / pdur, k = ease.back(u); sx = sy = 0.2 + 0.8 * k; alpha = Math.min(1, u * 3); flash = u < 0.28 && !calm; }       // aparición con rebote
    else {
        const fr = a.walk - Math.floor(a.walk), arc = Math.sin(fr * Math.PI), mv = a.v > 25;
        if (kind === 'drone' || kind === 'medic') oy = mv ? -Math.round(arc * 2.5) : Math.round(Math.sin(t * 3 + a.walk) * 1.5);
        else if (kind === 'tank' || kind === 'giant') { const st = Math.max(0, 1 - fr * 5) * (mv ? 1 : 0); sx = 1 + 0.07 * st; sy = 1 - 0.07 * st; oy = Math.round(st * 1.5); }
        else if (kind === 'diamond') { const b = Math.sin(t * 9 + a.walk * 3) * 0.04; sx = 1 + b; sy = 1 - b; }
        else if (kind === 'swarm') { const q = Math.floor(t * 30); ox = ((q * 7 + (a.walk * 5 | 0)) % 3) - 1; oy = ((q * 5) % 3) - 1; }
        else if (kind === 'split') { const b = Math.sin(t * 7 + a.walk * 3) * 0.08; sx = 1 + b; sy = 1 - b; }
        else if (kind === 'kami' && e.state === 'wind') { ox = (Math.floor(t * 40) & 1) ? 2 : -2; const b = 1 + 0.08 * Math.sin(t * 40); sx = sy = b; }
        else if (kind === 'boss' || big) { const b = 1 + 0.025 * Math.sin(t * (3 + (1 - e.hp / e.maxHp) * 5)); sx = sy = b; }
    }
    const ht = t - a.hitT;
    if (ht >= 0 && ht < 0.26) {                                                                           // golpe: aplastamiento con rebote sobre el eje del impacto
        const k = Math.exp(-ht * 13) * Math.cos(ht * 38), amp = e.boss ? 0.03 : e.radius > 40 ? 0.08 : 0.2;
        if (Math.abs(a.hx) > Math.abs(a.hy)) { sx *= 1 - amp * k; sy *= 1 + amp * 0.7 * k; } else { sx *= 1 + amp * 0.7 * k; sy *= 1 - amp * k; }
        if (ht < 0.06 && !calm) flash = true;
    }
    const ku = (t - a.kickT) / 0.12; if (ku >= 0 && ku < 1) { ox -= Math.cos(a.kang) * 3 * (1 - ku); oy -= Math.sin(a.kang) * 3 * (1 - ku); }
    if (kind === 'kami' && e.state === 'dash' && !A.lite()) {                                              // estela de imágenes al embestir
        const x0 = e.x, y0 = e.y; ctx.save();
        try { for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.16 * (4 - i) / 3; e.x = x0 - Math.cos(e.ang || 0) * i * 16; e.y = y0 - Math.sin(e.ang || 0) * i * 16; chain.call(e, ctx); } }
        finally { e.x = x0; e.y = y0; ctx.restore(); }
    }
    ctx.save();
    const kb = e.knockback, kx0 = kb.x; e._fl = flash;
    try {
        ctx.translate(e.x + ox, e.y + oy); ctx.scale(sx, sy); ctx.translate(-e.x, -e.y);
        if (alpha < 1) ctx.globalAlpha = alpha;
        if (flash && Math.abs(kb.x) <= 50 && Math.abs(kb.y) <= 50) kb.x = 60;                                // fuerza el fotograma blanco
        chain.call(e, ctx);
    } finally { kb.x = kx0; e._fl = false; ctx.restore(); }
    if (a.tele > 0.05 && !Settings.perf) {                                                                // aviso antes de disparar
        ctx.save(); try {
            ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff2d3d'; const R = e.radius + 6 + a.tele * 4;
            for (let i = 0; i < 12; i++) { const an = i / 12 * TAU2 + t * 3; ctx.globalAlpha = a.tele * (0.45 + 0.45 * Math.sin(t * 40 + i)); ctx.fillRect(snap(e.x + Math.cos(an) * R) - 1.5, snap(e.y + Math.sin(an) * R) - 1.5, PU, PU); }
        } finally { ctx.restore(); }
    }
};
{
    const _ed = Enemy.prototype.draw; A.edraw = _ed;
    Enemy.prototype.draw = function (ctx) {
        if (A.off.enemy) return _ed.call(this, ctx);
        try { A.drawEnemy(this, ctx, _ed); } catch (e) { A.errs.enemy = (A.errs.enemy || 0) + 1; if (A.errs.enemy >= 3) A.off.enemy = true; console.warn('[anim2:enemy]', e); }
    };
}
A.tmp = null;
A.sample = (en) => {                                                                                      // pinta el sprite actual del enemigo en un lienzo temporal
    const r = en.radius, R = Math.ceil(r * 1.3 + 8), S = R * 2;
    if (!A.tmp || A.tmp.width < S) { A.tmp = document.createElement('canvas'); A.tmp.width = A.tmp.height = Math.max(S, 64); A.tmpX = A.tmp.getContext('2d', { willReadFrequently: true }); }
    const c = A.tmpX; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, A.tmp.width, A.tmp.height); c.globalAlpha = 1;
    const ox = en.x, oy = en.y, was = en.dead; en.x = R; en.y = R; en.dead = false; c.save();
    try { A.edraw.call(en, c); } finally { c.restore(); en.x = ox; en.y = oy; en.dead = was; }
    return { R, S, d: c.getImageData(0, 0, S, S).data };
};
A.onDeath = A.guard('death', function (en, fx, fy, melee) {
    if (en._dfx) return; en._dfx = true;
    const e = engine, r = en.radius, big = !!en.boss || r >= 40, col = en.color || '#fff', calm = A.calm(), kx = fx || 0, ky = fy || 0;
    A.spark(en.x, en.y, col, big ? 3 : r > 20 ? 2.2 : 1.4, big ? 0.32 : 0.24);
    A.ringfx(en.x, en.y, r * 0.6, r * (big ? 3 : 2.2), big ? 0.4 : 0.26, col, PU);
    if (Settings.perf) return;
    const bs = Math.max(3, Math.round(r / 5)), maxN = Math.round((en.boss ? 70 : big ? 40 : 22) * A.k()), blocks = [];
    if (A.sb++ < 8) {                                                                                      // trozos de su propio sprite
        const sm = A.sample(en), d = sm.d, R = sm.R, S = sm.S;
        for (let by = 0; by < S; by += bs) for (let bx = 0; bx < S; bx += bs) {
            const cx = bx + bs / 2 - R, cy = by + bs / 2 - R; if (cx * cx + cy * cy > (r * 1.25) * (r * 1.25)) continue;
            let best = -1, cr = 0, cg = 0, cb = 0, n = 0;
            for (let y = by; y < by + bs && y < S; y++) for (let x = bx; x < bx + bs && x < S; x++) { const i = (y * S + x) * 4; if (d[i + 3] < 90) continue; n++; const l = d[i] + d[i + 1] * 1.5 + d[i + 2]; if (l > best) { best = l; cr = d[i]; cg = d[i + 1]; cb = d[i + 2]; } }
            if (n >= bs * bs * 0.35) blocks.push({ cx, cy, col: 'rgb(' + cr + ',' + cg + ',' + cb + ')' });
        }
        if (A.gb++ < 5 && !calm) {                                                                         // silueta blanca que se expande
            const g = document.createElement('canvas'); g.width = g.height = S; const gc = g.getContext('2d'); gc.drawImage(A.tmp, 0, 0, S, S, 0, 0, S, S); gc.globalCompositeOperation = 'source-atop'; gc.fillStyle = '#fff'; gc.fillRect(0, 0, S, S);
            A.add({ k: 'ghost', x: en.x, y: en.y, cv: g, w: S, h: S, d: 0.17 });
        }
    } else for (let y = -r; y <= r; y += bs) for (let x = -r; x <= r; x += bs) if (x * x + y * y <= r * r) blocks.push({ cx: x, cy: y, col });
    for (let i = blocks.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t; }
    const m = Math.hypot(kx, ky), bias = m > 5 ? 0.35 : 0;
    for (let i = 0; i < Math.min(maxN, blocks.length) && A.deb.length < 380; i++) {
        const b = blocks[i], an = Math.atan2(b.cy, b.cx) + (rnd() - 0.5) * 0.7, sp = 80 + rnd() * 240 + (big ? 100 : 0);
        A.deb.push({ x: en.x + b.cx, y: en.y + b.cy, vx: Math.cos(an) * sp + kx * bias, vy: Math.sin(an) * sp + ky * bias, s: bs, col: b.col, t: 0, d: 0.5 + rnd() * 0.45, fr: 0.9 });
    }
    if (en.kind === 'kami' && e.player && Math.hypot(en.x - e.player.x, en.y - e.player.y) < e.player.radius + r + 12) A.add({ k: 'fball', x: en.x, y: en.y, R: 60, d: 0.4 });
});
A.onHit = A.guard('hit', function (en, fx, fy, melee, dmg) {
    const t = LH.now(), a = en._a || A.enemyInit(en, t), m = Math.hypot(fx, fy);
    a.hitT = t; if (m > 1) { a.hx = fx / m; a.hy = fy / m; }
    if (A.fx.length > A.cap * 0.8) return;
    if (melee) { A.spark(en.x, en.y, '#ffffff', en.radius > 30 ? 2.2 : 1.4, 0.2); A.burst(en.x, en.y, en.color, 5, 120, 320, 0.3, PU); }
    else { A.spark(en.x - a.hx * en.radius * 0.9, en.y - a.hy * en.radius * 0.9, en.color, 1, 0.16); if (!A.lite()) A.ember(en.x - a.hx * en.radius, en.y - a.hy * en.radius, Math.atan2(-a.hy, -a.hx) + (rnd() - 0.5), 160 + rnd() * 120, en.color, 0.18, PU, '#fff'); }
});
{
    const _he = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead, r = _he.call(this, en, dmg, fx, fy, melee);
        if (alive) { if (en.dead) A.onDeath(en, fx, fy, melee); else A.onHit(en, fx, fy, melee, dmg); }
        return r;
    };
    const _db = LH.drawBig;                                                                                // jefes: destello al recibir un golpe
}

// ---------------------------------------------------------------- BALAS
A.drawBullets = (ctx, e) => {
    const B = e.bullets; if (!B.length) return; const t = LH.now(), U = PU, order = [0, 1, 3, 2];
    ctx.save();
    try {
        if (!Settings.perf) { ctx.fillStyle = 'rgba(5,1,10,.45)'; for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.isEnemy) ctx.fillRect(snap(b.x) - 6, snap(b.y) - 6, 12, 12); } }   // placa oscura: se leen sobre cualquier fondo
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < B.length; i++) {
            const b = B[i], col = b.color, dx = b.tx - b.x, dy = b.ty - b.y, d0 = Math.hypot(b.x - b.ox, b.y - b.oy), pop = d0 < 36 ? 1.5 - d0 / 72 : 1;
            let s = Math.max(U, Math.round(b.radius * 1.6 / U) * U); ctx.fillStyle = col;
            for (let k = 3; k >= 1; k--) {
                const f = k / 3.4, ss = Math.max(U, s - k * U * 0.5 | 0), sz = Math.max(U, Math.round(ss / U) * U);
                ctx.globalAlpha = (b.isEnemy ? 0.4 : 0.5) - k * 0.1; ctx.fillRect(snap(b.x + dx * f) - sz / 2, snap(b.y + dy * f) - sz / 2, sz, sz);
            }
            if (b.isEnemy) {                                                                               // orbe giratorio con contorno
                const fr = order[Math.floor(t * 16 + b.x * 0.02) & 3], x0 = snap(b.x) - s / 2, y0 = snap(b.y) - s / 2, cell = s / 2;
                ctx.globalAlpha = 0.18 + 0.1 * Math.sin(t * 14 + b.y * 0.05); ctx.fillRect(x0 - U, y0 - U, s + U * 2, s + U * 2);
                ctx.globalAlpha = 0.95;
                for (let q = 0; q < 4; q++) { ctx.fillStyle = q === fr ? '#ffffff' : col; ctx.fillRect(x0 + (q & 1) * cell, y0 + (q >> 1) * cell, cell, cell); }
            } else {
                const sh = Math.max(U, Math.round(s * pop / U) * U);                                       // nace con un pequeño estirón
                ctx.globalAlpha = 0.9; ctx.fillRect(snap(b.x) - sh / 2, snap(b.y) - sh / 2, sh, sh);
                const c = Math.max(U, sh - U * 2); ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(snap(b.x) - c / 2, snap(b.y) - c / 2, c, c);
            }
        }
    } finally { ctx.restore(); }
};
{
    const _db0 = GameEngine.prototype.drawBullets;
    GameEngine.prototype.drawBullets = function (ctx) { if (A.off.bullets) return _db0.call(this, ctx); try { A.drawBullets(ctx, this); } catch (e) { A.errs.bullets = (A.errs.bullets || 0) + 1; if (A.errs.bullets >= 3) A.off.bullets = true; console.warn('[anim2:bullets]', e); } };
    const _bu = Bullet.prototype.update;
    Bullet.prototype.update = function (dt) {
        const l0 = this.life; _bu.call(this, dt);
        if (this.life === 0 && l0 > 0 && !A.off.impact) A.wallSpark(this);
    };
}
A.wallSpark = A.guard('impact', function (b) {
    if (A.fx.length > A.cap * 0.85) return;
    const m = Math.hypot(b.vx, b.vy) || 1, ang = Math.atan2(-b.vy / m, -b.vx / m);
    A.spark(b.x, b.y, b.color, b.isEnemy ? 1 : 1.2, 0.16);
    if (!A.lite()) for (let i = 0; i < 2; i++) A.ember(b.x, b.y, ang + (rnd() - 0.5) * 1.6, 120 + rnd() * 160, b.color, 0.2, PU, '#fff');
});

// ---------------------------------------------------------------- OBJETOS
{
    const _pku = Pickup.prototype.update;
    Pickup.prototype.update = function (dt) {
        if (this._b === undefined) { this._b = LH.now(); const an = rnd() * TAU2, sp = 150 + rnd() * 100; this._tv = { x: Math.cos(an) * sp, y: Math.sin(an) * sp }; }
        _pku.call(this, dt);
        const tv = this._tv;
        if (tv) {                                                                                          // sale despedido al caer
            const f = Math.pow(0.9, dt * 60), nx = this.x + tv.x * dt, ny = this.y + tv.y * dt;
            if (engine.wallAt(nx, ny) || nx < 18 || nx > width - 18 || ny < 18 || ny > height - 18) this._tv = null;
            else { this.x = nx; this.y = ny; tv.x *= f; tv.y *= f; if (Math.hypot(tv.x, tv.y) < 8) this._tv = null; }
        }
        if (!A.lite() && (this._sp = (this._sp || rnd() * 1.2) - dt) < 0) { this._sp = 0.9 + rnd() * 0.8; A.spark(this.x + (rnd() - 0.5) * 24, this.y + (rnd() - 0.5) * 24 - 4, this.itemType === 'HEALTH' ? '#7dffb0' : '#ffffff', 1, 0.2); }   // destellos
    };
    const _pkd = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        if (A.off.pickup || this._b === undefined) return _pkd.call(this, ctx);
        const age = LH.now() - this._b, du = 0.55; let h = 0;
        if (age < du) { const u = age / du; h = Math.abs(Math.sin(u * Math.PI * 1.5)) * 26 * (1 - u); }       // rebote al caer
        ctx.save(); try {
            ctx.fillStyle = 'rgba(0,0,0,' + (0.32 * (1 - Math.min(1, h / 40))).toFixed(2) + ')';              // sombra en el suelo
            const sw = Math.round(7 - h / 8) * 2; ctx.fillRect(Math.round(this.x - sw / 2), Math.round(this.y + 11), sw, 3);
            if (h > 0) ctx.translate(0, -Math.round(h / 2) * 2);
            _pkd.call(this, ctx);
        } finally { ctx.restore(); }
    };
}

// ---------------------------------------------------------------- TEXTO FLOTANTE CON "POP"
A.drawTexts = (ctx, list) => {
    ctx.save(); try {
        ctx.textAlign = 'center'; ctx.lineJoin = 'round'; let font = null;
        for (let i = 0; i < list.length; i++) {
            const p = list[i]; if (p.life <= 0) continue; if (p._l0 === undefined) p._l0 = p.life;
            const age = p._l0 - p.life, fs = p.fs || Math.round(22 * textBoost()), big = fs >= 30, u = clamp01(age / (big ? 0.22 : 0.14)), sc = 0.35 + 0.65 * ease.back(u), f = '900 ' + fs + 'px Orbitron';
            if (f !== font) { font = f; ctx.font = f; }
            const al = clamp01(p.life / 0.35);
            ctx.save(); ctx.translate(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2); ctx.scale(sc, sc);
            ctx.globalAlpha = al; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(5,1,10,.85)'; ctx.strokeText(p.text, 0, 0);
            ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
            if (age < 0.09) { ctx.globalAlpha = al * (1 - age / 0.09); ctx.fillStyle = '#fff'; ctx.fillText(p.text, 0, 0); }
            ctx.restore();
        }
    } finally { ctx.restore(); }
};
{
    const _dp = GameEngine.prototype.drawParticles, hid = [];
    GameEngine.prototype.drawParticles = function (ctx, pass) {
        if (A.off.draw) return _dp.call(this, ctx, pass);
        if (pass === 0) { _dp.call(this, ctx, 0); try { A.drawFx(ctx, 0); } catch (e) { A.errs.draw = (A.errs.draw || 0) + 1; if (A.errs.draw >= 3) A.off.draw = true; console.warn('[anim2:draw]', e); } return; }
        hid.length = 0; const P = this.particles;
        for (let i = 0; i < P.length; i++) if (P[i].type === 'text') { P[i].type = 'tx'; hid.push(P[i]); }
        try { _dp.call(this, ctx, 1); } finally { for (let i = 0; i < hid.length; i++) hid[i].type = 'text'; }
        try { A.drawFx(ctx, 1); A.drawTexts(ctx, hid); } catch (e) { A.errs.draw = (A.errs.draw || 0) + 1; if (A.errs.draw >= 3) A.off.draw = true; console.warn('[anim2:draw]', e); }
        hid.length = 0;
    };
}

// ---------------------------------------------------------------- KATANA, COHETES, EXPLOSIONES Y ONDA DEL PULSO
A.EMPTY = [];
A.drawSlashes = (ctx, e) => {
    const S = e.slashes; if (!S.length) return;
    for (const s of S) {
        const age = 0.5 - s.life; if (age < 0) continue;
        const N = Math.max(18, Math.round(s.r * Math.PI / (PU * 1.7)));
        for (let i = 0; i < N; i++) {
            const f = i / (N - 1), ag = age - f * 0.1; if (ag < 0 || ag > 0.3) continue;
            const aa = s.a - Math.PI / 2 + f * Math.PI, fade = 1 - ag / 0.3, th = fade > 0.66 ? 3 : fade > 0.33 ? 2 : 1, c = Math.cos(aa), sn = Math.sin(aa);
            for (let q = 0; q < th; q++) {
                const rr = s.r - q * PU; ctx.globalAlpha = fade * (q === 0 ? 0.6 : 1); ctx.fillStyle = q === 0 ? '#5ffbff' : '#ffffff';
                ctx.fillRect(snap(s.x + c * rr) - PU / 2, snap(s.y + sn * rr) - PU / 2, PU, PU);
            }
        }
        if (age < 0.12) { const aa = s.a - Math.PI / 2 + Math.min(1, age / 0.1) * Math.PI; ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(snap(s.x + Math.cos(aa) * s.r) - PU, snap(s.y + Math.sin(aa) * s.r) - PU, PU * 2, PU * 2); }
    }
};
A.drawRockets = (ctx, e, R) => {
    const t = LH.now(), fc = ['#ffe600', '#ff9a3c', '#ff3355'];
    for (const r of R) {
        const sp = Math.hypot(r.vx, r.vy) || 1, ux = r.vx / sp, uy = r.vy / sp;
        for (let k = 1; k <= 4; k++) { ctx.globalAlpha = 1 - k * 0.18; ctx.fillStyle = fc[(Math.floor(t * 30) + k) % 3]; ctx.fillRect(snap(r.x - ux * (k * PU + 5)) - PU / 2, snap(r.y - uy * (k * PU + 5)) - PU / 2, PU, PU); }   // llama
        ctx.globalAlpha = 1; ctx.fillStyle = '#8f97b8'; ctx.fillRect(snap(r.x - ux * PU) - PU / 2, snap(r.y - uy * PU) - PU / 2, PU, PU);
        ctx.fillStyle = '#cfd6ff'; ctx.fillRect(snap(r.x) - PU / 2, snap(r.y) - PU / 2, PU, PU); ctx.fillStyle = '#ffffff'; ctx.fillRect(snap(r.x + ux * PU) - PU / 2, snap(r.y + uy * PU) - PU / 2, PU, PU);
    }
};
{
    const _dfx = GameEngine.prototype.drawFx;
    GameEngine.prototype.drawFx = function (ctx) {
        if (A.off.fx) return _dfx.call(this, ctx);
        const sl = this.slashes, rk = this.rockets; this.slashes = A.EMPTY; if (rk) this.rockets = A.EMPTY;
        try { _dfx.call(this, ctx); } finally { this.slashes = sl; this.rockets = rk; }
        try { ctx.save(); try { ctx.globalCompositeOperation = 'lighter'; A.drawSlashes(ctx, this); if (rk && rk.length) { ctx.globalCompositeOperation = 'source-over'; A.drawRockets(ctx, this, rk); } } finally { ctx.restore(); } }
        catch (e) { A.errs.fx = (A.errs.fx || 0) + 1; if (A.errs.fx >= 3) A.off.fx = true; console.warn('[anim2:fx]', e); }
    };
    const _sw = GameEngine.prototype.shockwave;
    GameEngine.prototype.shockwave = function (x, y, r) {
        const v = _sw.call(this, x, y, r);
        try { if (!A.off.shock) { A.ringfx(x, y, 8, r, 0.34, '#ffffff', PU * 2, 12); A.ringfx(x, y, 4, r * 0.7, 0.3, '#00f3ff', PU, 0, 0.05); if (!A.calm()) A.spark(x, y, '#9ffcff', 3, 0.2); } } catch (e) { A.off.shock = true; }
        return v;
    };
    const _ex = LH.explode;
    LH.explode = function (x, y) {
        const v = _ex.call(this, x, y);
        try {
            if (!A.off.boom) {
                A.add({ k: 'fball', x, y, R: 125, d: 0.5 }); A.ringfx(x, y, 10, 125, 0.3, '#ffd23a', PU * 2, 10);
                A.burst(x, y, '#ff9a3c', 16, 120, 420, 0.5, PU * 2, '#ff3355');
                for (let i = 0; i < Math.ceil(6 * A.k()); i++) A.add({ k: 'smoke', x: x + (rnd() - 0.5) * 50, y: y + (rnd() - 0.5) * 50, vx: (rnd() - 0.5) * 60, vy: -20 - rnd() * 40, fr: 0.95, s0: 10, s1: 34, d: 0.7 + rnd() * 0.4, col: '#3a3350', hot: '#ff7a00' });
                if (!A.calm()) A.spark(x, y, '#ffffff', 3, 0.14);
            }
        } catch (e) { A.off.boom = true; }
        return v;
    };
}

// ---------------------------------------------------------------- BUCLE: se engancha a update y reset
A.pk = [];
A.pre = (e, dt) => {
    A.gb = 0; A.sb = 0;
    const E = e.enemies; for (let i = 0; i < E.length; i++) if (E[i].dead && !E[i]._dfx) A.onDeath(E[i], 0, 0, false);
    A.pk.length = 0; for (let i = 0; i < e.pickups.length; i++) A.pk.push(e.pickups[i]);
    A.c0 = e.combo;
};
A.post = (e, dt) => {
    A.step(dt);
    if (e.state !== 'PLAYING') return;
    const t = LH.now(), pl = e.player;
    for (let i = 0; i < e.enemies.length; i++) if (!e.enemies[i].dead) A.enemyStep(e.enemies[i], dt, t, pl);
    for (let i = 0; i < A.pk.length; i++) {                                                                // objeto recogido: confeti de píxeles
        const p = A.pk[i]; if (p.life <= 0 || e.pickups.includes(p)) continue;
        A.spark(p.x, p.y, p.color, 2.2, 0.26); A.ringfx(p.x, p.y, 4, 38, 0.26, p.color, PU); A.burst(p.x, p.y, p.color, 9, 90, 300, 0.45, PU, '#ffffff');
    }
    if (e.rockets) for (const r of e.rockets) if ((r._sm = (r._sm || 0) + dt) > 0.03 && !A.lite()) { r._sm = 0; A.add({ k: 'smoke', x: r.x, y: r.y, vx: (rnd() - 0.5) * 20, vy: (rnd() - 0.5) * 20, fr: 0.92, s0: 4, s1: 12, d: 0.45, col: '#4b4f69' }); }
    if (e.combo > A.c0 && e.combo > 1) A.hudPop('#comboEl', 'hudCombo');
};
A.bossFlash = () => {};
{
    const _gu = GameEngine.prototype.update;
    GameEngine.prototype.update = function (dt) {
        if (A.off.core || this.state === 'PAUSED' || this.hitStop > 0) return _gu.call(this, dt);
        try { A.pre(this, dt); } catch (e) { A.errs.core = (A.errs.core || 0) + 1; if (A.errs.core >= 3) A.off.core = true; console.warn('[anim2:core]', e); }
        const r = _gu.call(this, dt);
        try { A.post(this, dt); } catch (e) { A.errs.core = (A.errs.core || 0) + 1; if (A.errs.core >= 3) A.off.core = true; console.warn('[anim2:core]', e); }
        return r;
    };
    const _rs = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _rs.call(this); A.fx.length = 0; A.deb.length = 0; A.pk.length = 0; };
}
{
    const _pre = LH.preloadTasks;                                                                           // precarga de las posturas nuevas del héroe (pantalla de carga)
    LH.preloadTasks = function () {
        const T = _pre.call(this);
        for (let q = 0; q < 32; q++) T.push(['PROTAGONISTA (NUEVAS ANIMACIONES)', () => { for (const ax of [-3, -2, 0, 2, 3]) for (const br of [0, 1]) for (const hx of [-1, 0, 1]) LH.heroRot2(q, { ax, ay: 0, br, hx, pose: 0, blink: 0, dual: 0 }); }]);
        return T;
    };
}
}

