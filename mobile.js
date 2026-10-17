
// ===================== MÓVIL (v3) =====================
Object.assign(GameEngine.prototype, {
    // Al girar el teléfono o cambiar el zoom, el mundo cambia de tamaño lógico: se recolocan las entidades.
    rescaleWorld(ow, oh) {
        const fx = width / ow, fy = height / oh;
        const mv = (o) => { o.x *= fx; o.y *= fy; };
        mv(this.player); this.enemies.forEach(mv); this.pickups.forEach(mv);
        this.obstacles.forEach(o => {
            mv(o);
            o.x = clamp(o.x, 0, Math.max(0, width - o.w));
            o.y = clamp(o.y, 0, Math.max(0, height - o.h));
        });
        this.bullets.length = 0; this.particles.length = 0; this.stains.length = 0;
        this.rings.length = 0; this.slashes.length = 0; this.beams.length = 0;
        this.player.trail.length = 0;
    },
    // Ayuda de puntería (solo táctil): si hay un enemigo dentro de un cono estrecho, la mira se inclina hacia él.
    assistAim(x, y, a) {
        let best = null, bd = Infinity;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
            if (d > 800 || d < 1) continue;
            let diff = Math.atan2(dy, dx) - a;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            if (Math.abs(diff) < 0.16 + Math.atan2(e.radius, d) && d < bd) { bd = d; best = diff; }
        }
        return best === null ? a : a + best * 0.7;
    }
});

// Botón de pulso: anillo de recarga y brillo cuando está listo
let _pLast = -1, _pReady = null;
function updatePulseButton(cd) {
    const btn = DOM.pulseBtn;
    if (!btn) return;
    const ready = cd <= 0;
    const p = ready ? 100 : Math.round(100 - (cd / PULSE_COOLDOWN) * 100);
    if (p !== _pLast) { _pLast = p; btn.style.setProperty('--p', p); }
    if (ready !== _pReady) { _pReady = ready; btn.classList.toggle('ready', ready); }
}

function setupTouchUI() {
    const body = document.body;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) body.classList.add('touch');
    // Portátiles/tablets con pantalla táctil: el modo móvil se activa con el primer toque
    window.addEventListener('touchstart', () => {
        Input.lastTouch = Date.now();
        if (!body.classList.contains('touch')) body.classList.add('touch');
    }, { passive: true, capture: true });

    const btn = DOM.pulseBtn;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Input.lastTouch = Date.now();
        if (!engine || engine.state !== 'PLAYING' || !engine.player) return;
        if (engine.player.pulseCooldown > 0) {            // aún recargando: pequeño aviso
            btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny');
            haptic(15);
            return;
        }
        engine.player.pulse();
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());

    document.getElementById('scaleRange').addEventListener('input', (e) => {
        Settings.scale = parseFloat(e.target.value); applySettings();
    });
    // Sin zoom de pellizco ni menú contextual al mantener pulsado
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (body.classList.contains('touch')) e.preventDefault(); });
}
