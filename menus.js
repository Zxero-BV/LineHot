 
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

const Menu = {
    stack: [], current: 'pMain',
    show(id) {
        this.current = id;
        document.querySelectorAll('#screens .panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
        DOM.screens.classList.remove('hidden');
        if (id === 'pMain') document.getElementById('menuBest').innerText = bestScore.toString().padStart(6, '0');
        if (id === 'pOptions') this.syncOptions();
    },
    open(id, fresh = false) {
        if (fresh) this.stack = []; else this.stack.push(this.current);
        this.show(id);
    },
    back() { if (this.stack.length) this.show(this.stack.pop()); },
    close() { DOM.screens.classList.add('hidden'); },
    syncOptions() {
        const labels = { perf: 'MODO RENDIMIENTO', shake: 'SACUDIDA DE PANTALLA', vibrate: 'VIBRACIÓN', showFps: 'MOSTRAR FPS', aimAssist: 'AYUDA DE PUNTERÍA', sway: 'BALANCEO DE CÁMARA', autoQ: 'CALIDAD AUTOMÁTICA' };
        document.querySelectorAll('[data-action="toggle"]').forEach(b => {
            const k = b.dataset.key;
            b.innerText = `${labels[k]}: ${Settings[k] ? 'ON' : 'OFF'}`;
            b.classList.toggle('on', !!Settings[k]);
        });
        document.getElementById('volRange').value = Settings.volume;
        document.getElementById('volVal').innerText = Math.round(Settings.volume * 100) + '%';
        document.getElementById('musicRange').value = Settings.music;
        document.getElementById('musicVal').innerText = Math.round(Settings.music * 100) + '%';
        document.getElementById('pulseSideBtn').innerText = 'BOTÓN DE PULSO: ' + (Settings.pulseSide === 'left' ? 'IZQUIERDA' : 'DERECHA');
        document.getElementById('scaleRange').value = Settings.scale;
        document.getElementById('scaleVal').innerText = Math.round(Settings.scale * 100) + '%';
    }
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
        switch (b.dataset.action) {
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
                DOM.highScore.innerText = 'HI: 000000'; Menu.show('pOptions'); break;
        }
    });
    document.getElementById('volRange').addEventListener('input', (e) => {
        Settings.volume = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('musicRange').addEventListener('input', (e) => {
        Settings.music = parseFloat(e.target.value); applySettings();
    });
    document.getElementById('pauseBtn').addEventListener('click', () => engine.togglePause());
}
