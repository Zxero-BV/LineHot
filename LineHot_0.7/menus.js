 
// ===================== PULSO, PAUSA, MENÚS Y AJUSTES =====================
AudioEngine.prototype.playPulse = function () {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
};

Object.assign(GameEngine.prototype, {
    shockwave(x, y, r) {
        this.rings.push({ x, y, max: r, life: 0.45, maxLife: 0.45 });
        for (const e of this.enemies) {
            const d = dist(x, y, e.x, e.y);
            if (e.dead || d > r + e.radius) continue;
            const n = Math.max(d, 1);
            this.hitEnemy(e, 1.5, (e.x - x) / n * 900, (e.y - y) / n * 900);
        }
        this.bullets = this.bullets.filter(b => !(b.isEnemy && dist(x, y, b.x, b.y) < r));
        this.addShake(12);
    },
    drawRings(ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 4;
        for (const r of this.rings) {
            const k = r.life / r.maxLife;
            ctx.strokeStyle = `rgba(0,243,255,${k})`;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.max * (1 - k), 0, TAU); ctx.stroke();
        }
        ctx.restore();
    },
    togglePause() {
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') (Menu.current === 'pPause' ? this.resume() : Menu.back());
    },
    pause() {
        this.state = 'PAUSED';
        Input.keys = { w: false, a: false, s: false, d: false };
        Input.mouse.active = false;
        audio.ctx.suspend();
        Menu.open('pPause', true);
    },
    resume() {
        this.state = 'PLAYING';
        audio.resume();
        Menu.close();
    },
    toMenu() {
        audio.music.newRun();
        audio.startMusic();
        this.state = 'MENU';
        this.reset();
        Menu.open('pMain', true);
    }
});

// ----- Estadísticas guardadas (partidas, mejor onda) -----
const Stats = {
    key: 'linehotStats', d: { games: 0, bestWave: 0, kills: 0 },
    load() { try { Object.assign(this.d, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch (e) {} },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) {} },
    time(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
    paintMain() {
        document.getElementById('menuBest').innerText = bestScore.toString().padStart(6, '0');
        document.getElementById('menuBestWave').innerText = this.d.bestWave;
        document.getElementById('menuGames').innerText = this.d.games;
    },
    paintPause() {
        document.getElementById('pauseWave').innerText = engine.wave;
        document.getElementById('pauseScore').innerText = engine.score;
        document.getElementById('pauseTime').innerText = this.time(engine.time);
    }
};
Stats.load();

// Botones de confirmación: el primer toque "arma" el botón, el segundo ejecuta (se desarma solo a los 3 s)
function disarm(b) { clearTimeout(b._t); if (b._html != null) b.innerHTML = b._html; b._html = null; b.classList.remove('armed'); }
function armConfirm(b) {
    if (b.classList.contains('armed')) { disarm(b); return true; }
    b._html = b.innerHTML; b.classList.add('armed');
    b.innerHTML = '<span>' + b.dataset.confirm + '</span>';
    b._t = setTimeout(() => disarm(b), 3000);
    return false;
}

const Menu = {
    stack: [], current: 'pMain',
    show(id) {
        this.current = id;
        document.querySelectorAll('#screens .armed').forEach(disarm);
        document.querySelectorAll('#screens .panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
        DOM.screens.dataset.mode = id;
        DOM.screens.classList.remove('hidden');
        const p = document.getElementById(id);
        if (id === 'pMain') Stats.paintMain();
        if (id === 'pPause') Stats.paintPause();
        if (id === 'pOptions') { this.setTab(p, 'game'); this.syncOptions(); }
        if (id === 'pControls') this.setTab(p, isTouchUI() ? 'mobile' : 'pc');
        p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter');
        if (document.body.classList.contains('kbd')) setTimeout(() => this.focusFirst(p), 40);
    },
    focusFirst(p) {
        const f = this.focusables(p)[0];
        if (f) f.focus({ preventScroll: true });
    },
    focusables(p) {
        p = p || document.getElementById(this.current);
        return [...p.querySelectorAll('button, input[type=range]')].filter(el => el.offsetParent !== null && !el.disabled);
    },
    setTab(p, name) {
        p.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
        p.querySelectorAll('.tab-pane').forEach(x => x.classList.toggle('hidden', x.dataset.pane !== name));
        const body = p.querySelector('.card-body'); if (body) body.scrollTop = 0;
    },
    open(id, fresh = false) {
        if (fresh) this.stack = []; else this.stack.push(this.current);
        this.show(id);
    },
    back() { if (this.stack.length) this.show(this.stack.pop()); },
    close() { DOM.screens.classList.add('hidden'); },
    fillSlider(inp) {
        const k = (inp.value - inp.min) / (inp.max - inp.min) * 100;
        inp.style.setProperty('--p', k + '%');
    },
    syncOptions() {
        document.querySelectorAll('[data-action="toggle"]').forEach(b => {
            const on = !!Settings[b.dataset.key];
            b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
        });
        const set = (inp, val, out) => {
            const i = document.getElementById(inp); i.value = val; this.fillSlider(i);
            document.getElementById(out).innerText = Math.round(val * 100) + '%';
        };
        set('volRange', Settings.volume, 'volVal');
        set('musicRange', Settings.music, 'musicVal');
        set('scaleRange', Settings.scale, 'scaleVal');
        document.getElementById('pulseSideVal').innerText = Settings.pulseSide === 'left' ? 'IZQUIERDA' : 'DERECHA';
    }
};

// ----- Sonidos de interfaz (solo si el audio está activo; si no, quedarían en cola hasta reanudar) -----
AudioEngine.prototype.playUI = function (kind) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = { hover: [900, 1250, .05, .05], click: [520, 1040, .1, .16], back: [720, 360, .1, .13], toggle: [640, 960, .07, .11] }[kind] || [600, 900, .08, .1];
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(P[3] * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + P[2] + 0.03);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + P[2] + 0.04);
};

// ----- Estadísticas de la partida (inicio y fin) -----
const _initE = GameEngine.prototype.init;
GameEngine.prototype.init = function () {
    this._startBest = Number(bestScore) || 0;
    Stats.d.games++; Stats.save();
    return _initE.apply(this, arguments);
};
Menu.fillOver = function (e) {
    const isRec = e.score > 0 && e.score > (e._startBest || 0);
    const cell = (k, v, cls = '') => `<div class="stat ${cls}"><span class="stat-k">${k}</span><span class="stat-v">${v}</span></div>`;
    document.getElementById('overStats').innerHTML =
        cell('PUNTUACIÓN', e.score, 'wide') + cell('ONDA', e.wave) + cell('COMBO MÁX.', e.maxCombo || 0) +
        cell('ENEMIGOS', e.kills || 0) + cell('TIEMPO', Stats.time(e.time));
    document.getElementById('newRecord').classList.toggle('hidden', !isRec);
    Stats.d.bestWave = Math.max(Stats.d.bestWave, e.wave); Stats.d.kills += e.kills || 0; Stats.save();
};

function applySettings() {
    saveSettings();
    document.body.classList.toggle('perf', Settings.perf);
    audio.master.gain.value = Settings.volume;
    audio.music.setLevel(Settings.music);
    audio.music.setQuality(Settings.perf);
    document.body.classList.toggle('pulse-left', Settings.pulseSide === 'left');
    resize();
    document.getElementById('fpsEl').classList.toggle('hidden', !Settings.showFps);
    Menu.syncOptions();
}

function setupMenu() {
    let musicUnlocked = false;
    const startMenuMusic = () => {
        audio.resume();
        if (musicUnlocked) return;
        musicUnlocked = true;
        audio.music.newRun(); audio.startMusic();
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, startMenuMusic, { passive: true }));
    // Al volver a la app (o tras una llamada) el navegador puede dejar el audio suspendido
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (engine && engine.state === 'PLAYING') engine.pause(); }
    });
    DOM.screens.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const act = b.dataset.action;
        if (b.dataset.confirm && !armConfirm(b)) { audio.playUI('toggle'); return; }
        audio.playUI(act === 'back' ? 'back' : (act === 'toggle' || act === 'pulseSide' || act === 'tab' || b.closest('.seg')) ? 'toggle' : 'click');
        switch (act) {
            case 'tab': Menu.setTab(b.closest('.panel'), b.dataset.tab); break;
            case 'fullscreen': if (document.fullscreenElement) { document.exitFullscreen(); } else { enterImmersive(); } break;
            case 'play': case 'retry': engine.init(); break;
            case 'resume': engine.resume(); break;
            case 'menu': engine.toMenu(); break;
            case 'options': Menu.open('pOptions'); break;
            case 'controls': Menu.open('pControls'); break;
            case 'back': Menu.back(); break;
            case 'pulseSide': Settings.pulseSide = Settings.pulseSide === 'left' ? 'right' : 'left'; applySettings(); break;
            case 'toggle': Settings[b.dataset.key] = !Settings[b.dataset.key]; applySettings(); break;
            case 'clearBest':
                bestScore = 0; localStorage.removeItem('neonCarnageBest');
                Stats.d.bestWave = 0; Stats.save();
                DOM.highScore.innerText = 'HI: 000000'; Menu.show('pOptions'); Menu.setTab(document.getElementById('pOptions'), 'game'); break;
        }
    });
    // --- teclado: modo "kbd" (anillo de foco visible), flechas/W-S para navegar, Esc para volver ---
    const fsBtn = document.getElementById('fsBtn');
    if (fsBtn && !document.fullscreenEnabled) fsBtn.classList.add('hidden');
    document.addEventListener('pointerdown', () => document.body.classList.remove('kbd'), true);
    document.addEventListener('keydown', (e) => {
        if (DOM.screens.classList.contains('hidden')) return;
        const k = e.key.toLowerCase();
        if (!document.body.classList.contains('kbd') && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab', 'enter', 'w', 's'].includes(k)) {
            document.body.classList.add('kbd');
            if (!DOM.screens.contains(document.activeElement)) Menu.focusFirst(document.getElementById(Menu.current));
        }
        const st = engine && engine.state;
        if (k === 'escape' && st !== 'PLAYING' && st !== 'PAUSED' && Menu.stack.length) { Menu.back(); audio.playUI('back'); return; }
        if (k === 'arrowup' || k === 'arrowdown' || k === 'w' || k === 's') {
            const list = Menu.focusables(), i = list.indexOf(document.activeElement);
            const d = (k === 'arrowdown' || k === 's') ? 1 : -1;
            const n = list[(i + d + list.length) % list.length];
            if (n && list.length) { n.focus({ preventScroll: false }); audio.playUI('hover'); e.preventDefault(); }
        }
        if ((k === 'arrowleft' || k === 'arrowright') && document.activeElement && document.activeElement.classList.contains('tab')) {
            const tabs = [...document.activeElement.parentElement.querySelectorAll('.tab')], i = tabs.indexOf(document.activeElement);
            const n = tabs[(i + (k === 'arrowright' ? 1 : -1) + tabs.length) % tabs.length];
            n.focus(); n.click(); e.preventDefault();
        }
    });
    // sonido al pasar el ratón por encima (solo ratón, no táctil)
    let lastHover = null;
    DOM.screens.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const t = e.target.closest('.btn, .row, .tab, .seg button');
        if (t && t !== lastHover) { lastHover = t; audio.playUI('hover'); } else if (!t) lastHover = null;
    });
    document.getElementById('volRange').addEventListener('input', (e) => {
        Settings.volume = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('musicRange').addEventListener('input', (e) => {
        Settings.music = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('pauseBtn').addEventListener('click', () => engine.togglePause());
}
