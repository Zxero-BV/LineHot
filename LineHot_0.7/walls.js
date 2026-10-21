
// ===================== v4 · PAREDES, CÁMARA Y HORIZONTAL =====================
// PAREDES: arenas en cuadrícula con simetría, pasillos garantizados (>= 2 celdas) y conectividad comprobada.
// Se rehacen en cada oleada (jefe = arena casi abierta) y, con la misma semilla, al girar el móvil.
const CELL = 50;
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const STAMPS = [
    [[0,0],[1,0],[2,0]], [[0,0],[1,0],[2,0],[3,0],[4,0]], [[0,0],[1,0],[2,0],[0,1],[0,2]],
    [[0,0],[1,0],[2,0],[1,1]], [[0,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[0,1],[1,1],[1,2]]
];
const Cam = { tilt: 0, ox: 0, oy: 0, punch: 0, m: [1, 0, 0, 1, 0, 0] };

Object.assign(GameEngine.prototype, {
    generateObstacles() { this.layout(false, null); },
    gridConnected(g, cols, rows) {
        let total = 0, start = -1;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!g[r][c]) { total++; if (start < 0) start = r * cols + c; }
        const seen = new Uint8Array(cols * rows), q = [start]; seen[start] = 1; let n = 0;
        while (q.length) {
            const i = q.pop(), c = i % cols, r = (i / cols) | 0; n++;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = c + dc, y = r + dr, j = y * cols + x;
                if (x >= 0 && y >= 0 && x < cols && y < rows && !g[y][x] && !seen[j]) { seen[j] = 1; q.push(j); }
            }
        }
        return n === total;
    },
    layout(boss, avoid, seed) {
        this.layoutBoss = boss; this.layoutSeed = seed = seed ?? ((Math.random() * 2 ** 31) | 0);
        const rnd = mulberry32(seed), cols = Math.floor(width / CELL), rows = Math.floor(height / CELL);
        const ox = (width - cols * CELL) / 2, oy = (height - rows * CELL) / 2, M = 2;
        const g = Array.from({ length: rows }, () => new Uint8Array(cols));
        const zones = (avoid && avoid.length ? avoid : [{ x: width / 2, y: height / 2 }]).map(p => ({ c: (p.x - ox) / CELL, r: (p.y - oy) / CELL }));
        const near = (c, r, R) => { for (let y = r - R; y <= r + R; y++) for (let x = c - R; x <= c + R; x++) if (g[y] && g[y][x]) return true; return false; };
        const okCell = (c, r) => c >= M && r >= M && c < cols - M && r < rows - M && !near(c, r, 2) && zones.every(z => Math.hypot(c + .5 - z.c, r + .5 - z.r) > 3.5);
        const mode = boss ? 'quad' : ['mx', 'my', 'quad', 'rot', 'none'][Math.floor(rnd() * 5)];
        const target = Math.max(boss ? 4 : 8, Math.floor(cols * rows * (boss ? 0.015 : 0.032 + Math.min(this.wave + 1, 10) * 0.002)));
        let placed = 0;
        for (let n = 0; n < 200 && placed < target; n++) {
            let s = STAMPS[boss ? 4 : Math.floor(rnd() * STAMPS.length)];
            for (let k = Math.floor(rnd() * 4); k-- > 0;) s = s.map(([x, y]) => [-y, x]);
            const mx = Math.min(...s.map(p => p[0])), my = Math.min(...s.map(p => p[1]));
            const bc = M + Math.floor(rnd() * (cols - 2 * M)), br = M + Math.floor(rnd() * (rows - 2 * M));
            const base = s.map(([x, y]) => [bc + x - mx, br + y - my]), copies = [base];
            const flip = (f) => base.map(([c, r]) => f(c, r));
            if (mode === 'mx' || mode === 'quad') copies.push(flip((c, r) => [cols - 1 - c, r]));
            if (mode === 'my' || mode === 'quad') copies.push(flip((c, r) => [c, rows - 1 - r]));
            if (mode === 'quad' || mode === 'rot') copies.push(flip((c, r) => [cols - 1 - c, rows - 1 - r]));
            // una copia y su espejo pueden fundirse en una pieza mayor, pero nunca dejar un pasillo de 1 celda
            const tight = copies.some((a, i) => copies.some((b, j) => i < j && a.some(([c1, r1]) => b.some(([c2, r2]) => Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2)) === 2))));
            const all = copies.flat();
            if (tight || !all.every(([c, r]) => okCell(c, r))) continue;
            all.forEach(([c, r]) => g[r][c] = 1);
            if (!this.gridConnected(g, cols, rows)) { all.forEach(([c, r]) => g[r][c] = 0); continue; }
            placed += all.length;
        }
        const rects = [];                                  // celdas -> rectángulos (colisiones)
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (!g[r][c]) continue;
            let w = 1; while (c + w < cols && g[r][c + w]) w++;
            const up = rects.find(q => q.c === c && q.w === w && q.r + q.h === r);
            if (up) up.h++; else rects.push({ c, r, w, h: 1 });
            c += w - 1;
        }
        this.obstacles = rects.map(q => new Obstacle(ox + q.c * CELL, oy + q.r * CELL, q.w * CELL, q.h * CELL));
        this.wallGrid = { g, cols, rows, ox, oy }; this.wallCache = null; this.wallAnim = 0;
        // índice celda -> muro: balas, partículas y enemigos consultan solo la celda en la que están
        const map = this.wallMap = new Int16Array(cols * rows).fill(-1);
        rects.forEach((q, i) => { for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) map[r * cols + c] = i; });
        for (const p of this.pickups) if (this.obstacles.some(w => p.x > w.x - 14 && p.x < w.x + w.w + 14 && p.y > w.y - 14 && p.y < w.y + w.h + 14)) Object.assign(p, this.freeSpot());
    },
    wallAt(x, y) {
        const w = this.wallGrid; if (!w) return null;
        const c = Math.floor((x - w.ox) / CELL), r = Math.floor((y - w.oy) / CELL);
        if (c < 0 || r < 0 || c >= w.cols || r >= w.rows) return null;
        const i = this.wallMap[r * w.cols + c];
        return i < 0 ? null : this.obstacles[i];
    },
    wallHit(x1, y1, x2, y2) {                          // ¿el tramo atraviesa un muro? (muestreo cada <=12 px)
        const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 12));
        for (let k = 1; k <= n; k++) if (this.wallAt(x1 + dx * k / n, y1 + dy * k / n)) return true;
        return false;
    },
    // Las paredes se pintan una vez (con su resplandor) en un lienzo y luego solo se copian: mucho más barato en móvil.
    buildWallCache(key) {
        const { g, cols, rows, ox, oy } = this.wallGrid;
        const cv = this.wallCache = this.wallCache || document.createElement('canvas');
        cv.width = canvas.width; cv.height = canvas.height;
        const c = cv.getContext('2d'); c.setTransform(renderK, 0, 0, renderK, 0, 0);
        const on = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && g[y][x];
        c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = C.green; c.beginPath();
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            if (!g[r][q]) continue;
            const x = ox + q * CELL, y = oy + r * CELL;
            c.fillStyle = 'rgba(0,255,102,0.1)'; c.fillRect(x, y, CELL, CELL);
            c.fillStyle = 'rgba(0,255,102,0.35)'; c.fillRect(x + CELL / 2 - 1.5, y + CELL / 2 - 1.5, 3, 3);
            if (!on(q, r - 1)) { c.moveTo(x, y); c.lineTo(x + CELL, y); }
            if (!on(q, r + 1)) { c.moveTo(x, y + CELL); c.lineTo(x + CELL, y + CELL); }
            if (!on(q - 1, r)) { c.moveTo(x, y); c.lineTo(x, y + CELL); }
            if (!on(q + 1, r)) { c.moveTo(x + CELL, y); c.lineTo(x + CELL, y + CELL); }
        }
        BLUR_OK = true; c.shadowBlur = 15; c.shadowColor = C.green; c.stroke(); BLUR_OK = false;
        this.wallKey = key;
    },
    drawWalls(ctx) {
        if (!this.wallGrid) return;
        const key = canvas.width + 'x' + canvas.height + '@' + renderK.toFixed(3) + Settings.perf + Q.level;
        if (!this.wallCache || this.wallKey !== key) this.buildWallCache(key);
        const a = this.wallAnim ?? 1;
        ctx.save(); ctx.globalAlpha = a * a; ctx.drawImage(this.wallCache, 0, 0, width, height); ctx.restore();
    },
    drawStains(ctx) {                                      // las manchas existían pero nunca se dibujaban
        if (Settings.perf || !this.stains.length) return;
        ctx.save();
        for (const s of this.stains) { ctx.globalAlpha = 0.35 * Math.min(1, s.life / 2); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
        ctx.restore();
    },
    // CÁMARA: balanceo (inclinación + desfase según la velocidad) y "golpe" de zoom con las sacudidas.
    // Ahora va dentro del canvas: funciona también en táctil y el ratón sigue apuntando bien.
    updateCam(dt) {
        const p = this.player, on = Settings.sway && this.state === 'PLAYING' && p, k = 1 - Math.exp(-dt * 8);
        Cam.tilt += ((on ? clamp(p.vx * 0.015, -4, 4) * Math.PI / 180 : 0) - Cam.tilt) * k;
        Cam.ox += ((on ? clamp(-p.vx * 0.02, -8, 8) : 0) - Cam.ox) * k;
        Cam.oy += ((on ? clamp(-p.vy * 0.02, -8, 8) : 0) - Cam.oy) * k;
        Cam.punch += (Math.min(this.shakeAmount * 0.0008, 0.04) - Cam.punch) * k;
        this.wallAnim = Math.min(1, (this.wallAnim ?? 1) + dt / 0.6);
    },
    drawBackdrop(ctx) {
        const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
        const s = 1.02 + Math.abs(Cam.tilt) * 1.2 + Cam.punch, co = Math.cos(Cam.tilt) * s, si = Math.sin(Cam.tilt) * s;
        Cam.m = [co, si, -si, co, cx - co * cx + si * cy + Cam.ox * dpr, cy - si * cx - co * cy + Cam.oy * dpr];
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
        if (!this.gridPath) return;
        // cuadrícula como vector, con la misma cámara que el mundo (antes: copia de un lienzo del tamaño de la pantalla)
        ctx.setTransform(Cam.m[0] * renderK, Cam.m[1] * renderK, Cam.m[2] * renderK, Cam.m[3] * renderK, Cam.m[4], Cam.m[5]);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)'; ctx.lineWidth = 1; ctx.stroke(this.gridPath);
    }
});
function updateMouseWorld() {                              // pantalla -> mundo, deshaciendo la cámara
    const m = Input.mouse; if (m.cx === undefined) return;
    const [a, b, c, d, e, f] = Cam.m, det = a * d - b * c, X = m.cx * dpr - e, Y = m.cy * dpr - f;
    m.x = (d * X - c * Y) / det / renderK; m.y = (-b * X + a * Y) / det / renderK;
}
const _startWave = GameEngine.prototype.startWave;
GameEngine.prototype.startWave = function () {
    const next = this.wave + 1;
    if (next > 1) { this.layout(next % 5 === 0, [this.player]); this.addShake(14); audio.playPulse(); }
    _startWave.call(this);
};
const _rescale = GameEngine.prototype.rescaleWorld;
GameEngine.prototype.rescaleWorld = function (ow, oh) {
    _rescale.call(this, ow, oh);
    this.layout(this.layoutBoss, [this.player], this.layoutSeed); this.wallAnim = 1;
};

// HORIZONTAL: intenta bloquear la orientación (Android, en pantalla completa) y, si sigue en vertical, sugiere girar.
function enterImmersive() {
    const lock = () => { try { if (isTouchUI() && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    try { const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen().then(lock).catch(() => {}); else lock(); } catch (e) {}
}
const Orient = {
    el: document.getElementById('rotateOverlay'), mq: matchMedia('(orientation: portrait)'), auto: false,
    dismissed: sessionStorage.getItem('ncPortraitOk') === '1',
    needed() { return isTouchUI() && this.mq.matches && Math.min(innerWidth, innerHeight) < 640; },
    check() {
        if (!engine) return;
        const portrait = this.needed();
        if (portrait && !this.dismissed && engine.state === 'PLAYING') { this.auto = true; engine.pause(); }
        if (engine.state !== 'PAUSED') this.auto = false;
        this.el.classList.toggle('hidden', !(portrait && !this.dismissed && this.auto));
        if (!portrait && this.auto) this.release();
    },
    release() { this.auto = false; this.el.classList.add('hidden'); if (engine.state === 'PAUSED' && Menu.current === 'pPause') engine.resume(); }
};
Orient.mq.addEventListener('change', () => Orient.check());
window.addEventListener('resize', () => Orient.check());
document.getElementById('rotateDismiss').addEventListener('click', () => {
    Orient.dismissed = true; sessionStorage.setItem('ncPortraitOk', '1');
    try { screen.orientation.unlock(); } catch (e) {}
    Orient.release();
});
const _init = GameEngine.prototype.init;
GameEngine.prototype.init = function () { _init.call(this); setTimeout(() => Orient.check(), 150); };
// ========================================================
