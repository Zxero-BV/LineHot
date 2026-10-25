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
        if (D.cv.width !== canvas.width || D.cv.height !== canvas.height) {
            // v1.7: con la resolución dinámica el lienzo cambia de tamaño en plena partida: la sangre del suelo se reescala (antes se borraba)
            const ow = D.cv.width, oh = D.cv.height;
            if (D.n > 0 && ow > 0 && Math.abs(ow / oh - canvas.width / canvas.height) < 0.01) {
                const t = LH._decTmp || (LH._decTmp = document.createElement('canvas')); t.width = ow; t.height = oh;
                const tc = t.getContext('2d'); tc.clearRect(0, 0, ow, oh); tc.drawImage(D.cv, 0, 0);
                D.cv.width = canvas.width; D.cv.height = canvas.height; D.c.setTransform(1, 0, 0, 1, 0, 0); D.c.drawImage(t, 0, 0, ow, oh, 0, 0, D.cv.width, D.cv.height);
            } else { D.cv.width = canvas.width; D.cv.height = canvas.height; D.n = 0; }
        }
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
        const n = 0;   // casquillos: ahora los anima animaciones2.js
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
        if (w >= 10 && w % 5 !== 0) {
            const n = Math.min(2, Math.floor((w - 6) / 3));
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

