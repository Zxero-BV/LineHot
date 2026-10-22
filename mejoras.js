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
        if (w >= 4 && w % 5 !== 0) {
            const n = Math.min(4, Math.floor((w - 1) / 3));
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
                G.bullets.push(new Bullet(e.x + c * e.radius, e.y + s * e.radius, e.ang, { speed: 1500, color: SNIPE_COL, damage: 30, name: 'ENEMY_GUN' }, true));
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
        const r = this.radius, flash = Math.abs(this.knockback.x) > 50 || Math.abs(this.knockback.y) > 50, id = flash ? 'snf' : 'snn';
        const s = Spr.map.get(id) || Spr.make(id, r * 2 + 64, r * 2 + 64, c => {
            c.fillStyle = flash ? C.white : C.bg; c.strokeStyle = SNIPE_COL; c.lineWidth = 3; c.shadowBlur = 16; c.shadowColor = SNIPE_COL;
            c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
            c.lineWidth = 2; c.beginPath(); c.moveTo(-r * 0.55, 0); c.lineTo(r * 0.55, 0); c.moveTo(0, -r * 0.55); c.lineTo(0, r * 0.55); c.stroke();
            c.lineWidth = 4; c.beginPath(); c.moveTo(r, 0); c.lineTo(r + 11, 0); c.stroke();
            c.fillStyle = '#ff2d55'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill();
        });
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
