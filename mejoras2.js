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
// Desde la oleada 3 algunos enemigos nacen "élite": aro dorado, 2.5× de vida y puntos extra; sueltan siempre un objeto.
LH.ACH.push({ id: 'elite', name: 'CAZAÉLITES', desc: 'Derrota a 10 élites', prog: () => [LH.prog.elite || 0, 10] });
LH.makeElite = (e) => {
    e.elite = true; e.maxHp *= 2.5; e.hp = e.maxHp; e.speed *= 1.1; e.dmg *= 1.3;
    if (engine.state === 'PLAYING') LH.panned(e.x, () => audio.playElite());
};
{
    const _m_make = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        const e = _m_make(t, x, y, hp);
        if (!e.boss && (t === 0 || t === 2 || t === 6 || t === 7 || t === 8) && engine && engine.waveState === 'FIGHT' && engine.wave >= 3
            && Math.random() < Math.min(0.12, 0.02 + engine.wave * 0.008)) LH.makeElite(e);
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
