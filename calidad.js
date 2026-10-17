// =====================================================================
//  CALIDAD GRÁFICA Y OPTIMIZACIONES (antes calidad.js, va la ÚLTIMA)
// =====================================================================

// =====================================================================
//  CALIDAD — tres modos: CALIDAD · EQUILIBRADO · RENDIMIENTO
//  Cargar AL FINAL (después de minijefes.js).
//
//  Cada modo ajusta: resolución, resplandor, partículas, CRT, sombras
//  y la frecuencia interna de la música. El modo se guarda en el navegador.
//
//  Además, optimizaciones que NO cambian lo que se ve:
//   - el HUD solo escribe en el DOM cuando el valor cambia
//   - no se crean objetos nuevos cada fotograma (dirección del jugador)
//   - el degradado de la estela se crea una vez y se reutiliza
// =====================================================================

const QUALITY = {
    calidad:     { label: 'CALIDAD',     level: 0, musicSR: 48000, musicSRtouch: 24000 },
    equilibrado: { label: 'EQUILIBRADO', level: 1, musicSR: 24000, musicSRtouch: 16000 },
    rendimiento: { label: 'RENDIMIENTO', level: 2, musicSR: 16000, musicSRtouch: 16000 }
};
const QUALITY_ORDER = ['calidad', 'equilibrado', 'rendimiento'];

let qualityMode = (() => {
    try { const v = localStorage.getItem('neonCarnageQuality'); return QUALITY[v] ? v : 'equilibrado'; }
    catch (e) { return 'equilibrado'; }
})();

// ---------- Ajustes de un modo ----------
// "level" es el índice de calidad que ya usa game.js (resolución, resplandor, partículas, CRT).
// El modo rendimiento además activa Settings.perf (sin resplandor, sin manchas, sin inclinación).
function applyQuality(id) {
    if (!QUALITY[id]) return;
    qualityMode = id;
    try { localStorage.setItem('neonCarnageQuality', id); } catch (e) {}
    Settings.perf = id === 'rendimiento';
    saveSettings();
    setQuality(QUALITY[id].level);
    document.body.classList.toggle('perf', Settings.perf);
    audio.music.setQuality(id === 'rendimiento');
    audio.music.setSampleRate(audio.music.touch ? QUALITY[id].musicSRtouch : QUALITY[id].musicSR);
    resize();
    syncQualityLabel();
}

// Tras cualquier ajuste, el nivel vuelve al del modo elegido (el automático solo baja desde ahí).
function reapplyQualityLevel() {
    setQuality(QUALITY[qualityMode].level);
    document.body.classList.toggle('perf', Settings.perf);
}

function syncQualityLabel() {
    const b = document.getElementById('qualityBtn');
    if (b) b.innerText = 'CALIDAD GRÁFICA: ' + QUALITY[qualityMode].label;
}

// Botón de calidad: cicla entre los tres modos
DOM.screens.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#qualityBtn');
    if (!b) return;
    const i = QUALITY_ORDER.indexOf(qualityMode);
    applyQuality(QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length]);
});

const _syncOptions = Menu.syncOptions;
Menu.syncOptions = function () { _syncOptions.call(this); syncQualityLabel(); };

const _applySettingsQ = applySettings;
applySettings = function () { _applySettingsQ(); reapplyQualityLevel(); };

const _onloadQ = window.onload;
window.onload = function () { _onloadQ.call(this); applyQuality(qualityMode); };

// ---------- Música: frecuencia interna según el modo ----------
// Se aplica al empezar la siguiente partida si la música ya está sonando (así no se corta a mitad).
MusicEngine.prototype.setSampleRate = function (sr) {
    if (sr === MUSIC_SR && !this._pendingSR) return;
    if (this.running) { this._pendingSR = sr; return; }
    this._pendingSR = null;
    this._applySampleRate(sr);
};
MusicEngine.prototype._applySampleRate = function (sr) {
    MUSIC_SR = sr;
    this.bandA = 1 - Math.exp(-MUSIC_TWO_PI * MUSIC_BAND_HZ / MUSIC_SR);
    this.n = 0; this.frac = 0.999999;
    this.s0L = this.s0R = this.s1L = this.s1R = 0;
    this.hardReset();
};
const _musicStart = MusicEngine.prototype.start;
MusicEngine.prototype.start = function () {
    if (this._pendingSR && !this.running) { this._applySampleRate(this._pendingSR); this._pendingSR = null; }
    return _musicStart.call(this);
};

// ---------- Optimización: escribir en el DOM solo si cambia ----------
function setCss(el, prop, v) {
    if (!el._q) el._q = {};
    if (el._q[prop] !== v) { el._q[prop] = v; el.style[prop] = v; }
}
function setText(el, v) {
    if (el._qt !== v) { el._qt = v; el.innerText = v; }
}

// ---------- Jugador: misma lógica que game.js, sin escrituras repetidas ----------
Player.prototype.update = function (dt) {
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    let speedMult = (this.weapon.name === 'MINIGUN' && (Input.right.active || Input.mouse.active)) ? 0.5 : 1;
    if (this.katanaSwingTime > 0) speedMult = 0.2;

    let kx = 0, ky = 0;
    if (Input.keys.w) ky -= 1;
    if (Input.keys.s) ky += 1;
    if (Input.keys.a) kx -= 1;
    if (Input.keys.d) kx += 1;

    if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        kx /= len; ky /= len;
        this.vx = kx * this.baseSpeed * speedMult;
        this.vy = ky * this.baseSpeed * speedMult;
        Input.lastDir.x = kx; Input.lastDir.y = ky;
    } else if (Input.left.active && Input.left.force > 0.1) {
        this.vx = Input.left.vector.x * this.baseSpeed * Input.left.force * speedMult;
        this.vy = Input.left.vector.y * this.baseSpeed * Input.left.force * speedMult;
        Input.lastDir.x = Input.left.vector.x; Input.lastDir.y = Input.left.vector.y;
    } else {
        this.vx *= 0.8; this.vy *= 0.8;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x += this.kx * dt; this.y += this.ky * dt;
    this.kx *= 0.86; this.ky *= 0.86;
    this.iframes -= dt;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 16) this.trail.shift();
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    const obs = engine.obstacles;
    for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        const res = rectCircleCollide(this.x, this.y, this.radius, o.x, o.y, o.w, o.h);
        if (res.hit) { this.x += res.nx * res.pen; this.y += res.ny * res.pen; }
    }

    this.fireCooldown -= dt;
    if (this.katanaSwingTime > 0) this.katanaSwingTime -= dt;

    if (Input.mouse.active) {
        this.angle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);
        if (this.fireCooldown <= 0) this.shoot();
    } else if (Input.right.active && Input.right.force > 0.3) {
        let aim = Math.atan2(Input.right.vector.y, Input.right.vector.x);
        if (Settings.aimAssist) aim = engine.assistAim(this.x, this.y, aim);
        this.angle = aim;
        if (this.fireCooldown <= 0) this.shoot();
    }

    setCss(DOM.healthFill, 'width', `${Math.max(0, (this.hp / this.maxHp) * 100)}%`);
    setCss(DOM.dashFill, 'width', `${this.pulseCooldown <= 0 ? 100 : 100 - (this.pulseCooldown / PULSE_COOLDOWN) * 100}%`);
    updatePulseButton(this.pulseCooldown);
    setText(DOM.weaponName, this.weapon.name);
    setCss(DOM.weaponName, 'color', this.weapon.color);
    setText(DOM.weaponAmmo, this.ammo === Infinity ? '∞' : this.ammo);
};

// ---------- Estela: un solo degradado reutilizado (se dibuja desplazado a la posición) ----------
let _trailGrad = null;
Player.prototype.drawTrail = function (ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const t = this.trail;
    for (let i = 1; i < t.length; i++) {
        const a = i / t.length;
        ctx.strokeStyle = `rgba(0,243,255,${a * 0.5})`; ctx.lineWidth = a * 14;
        ctx.beginPath(); ctx.moveTo(t[i - 1].x, t[i - 1].y); ctx.lineTo(t[i].x, t[i].y); ctx.stroke();
    }
    if (!_trailGrad) {
        _trailGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
        _trailGrad.addColorStop(0, 'rgba(0,243,255,0.25)');
        _trailGrad.addColorStop(1, 'rgba(0,243,255,0)');
    }
    ctx.translate(this.x, this.y);
    ctx.fillStyle = _trailGrad;
    ctx.fillRect(-100, -100, 200, 200);
    ctx.restore();
};

// ---------- Postproceso: misma lógica que game.js, HUD solo al cambiar ----------
GameEngine.prototype.postUpdate = function (dt) {
    const p = this.player;
    this.hpGhost = this.hpGhost > p.hp ? this.hpGhost + (p.hp - this.hpGhost) * Math.min(1, dt * 2.5) : p.hp;
    setCss(UI2.hpGhost, 'width', Math.max(0, this.hpGhost / p.maxHp * 100) + '%');
    audio.music.setHealth(p.hp / p.maxHp);

    let boss = null;
    for (const e of this.enemies) if (e.boss && !e.dead) { boss = e; break; }
    const showBoss = !!boss && this.state === 'PLAYING';
    if (UI2.bossBar._shown !== showBoss) { UI2.bossBar._shown = showBoss; UI2.bossBar.classList.toggle('hidden', !showBoss); }
    if (boss) {
        this.bossHp += (boss.hp / boss.maxHp - this.bossHp) * Math.min(1, dt * 8);
        setCss(UI2.bossFill, 'width', Math.max(0, this.bossHp * 100) + '%');
    } else this.bossHp = 1;

    if (p.weapon.type === 'rail') setText(DOM.weaponAmmo, p.ammo + (p.fireCooldown > 0 ? '  RECARGANDO' : '  LISTO'));

    for (const s of this.slashes) {
        s.life -= dt;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b.isEnemy || dist(s.x, s.y, b.x, b.y) > s.r + 10) continue;
            const d = Math.atan2(b.y - s.y, b.x - s.x) - s.a;
            if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < Math.PI / 2) {
                this.spawnParticle(b.x, b.y, C.white, 6, 0, 0, 250);
                this.bullets.splice(i, 1);
            }
        }
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    for (const list of [this.beams, this.ghosts]) {
        for (let i = list.length - 1; i >= 0; i--) {
            list[i].life -= dt;
            if (list[i].life <= 0) list.splice(i, 1);
        }
    }
    this.updateCam(dt);
};
