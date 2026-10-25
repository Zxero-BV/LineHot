// ########## [seguridad.js] ##########
// ---------------------------------------------------------------- ADVERTENCIA DE EPILEPSIA + MODO ANTI-EPILEPSIA + AUDIO ESTABLE
// · La primera vez que se abre el juego aparece #pEpi (clave linehotEpiVisto). Desde ahí o desde Ajustes > Juego se activa
//   el MODO ANTI-EPILEPSIA (Settings.epi): fuerza calm=true, shake=false, beatBg=false, sway=false y la clase body.epi (sin animaciones
//   de parpadeo). Al desactivarlo vuelven los valores que tenía el jugador (Settings.epiPrev).
// · AUDIO ESTABLE (Settings.audioSafe, por defecto sí): ver AudioEngine (latencyHint 'playback').
if (Settings.epi === undefined) Settings.epi = false;
if (Settings.audioSafe === undefined) Settings.audioSafe = true;
LH.EPI_FORCE = { calm: true, shake: false, beatBg: false, sway: false };
{
    const _m_apply = applySettings;
    applySettings = function () {
        if (Settings.epi) {
            if (!Settings.epiPrev) Settings.epiPrev = { calm: Settings.calm, shake: Settings.shake, beatBg: Settings.beatBg, sway: Settings.sway };
            Object.assign(Settings, LH.EPI_FORCE);
        } else if (Settings.epiPrev) { Object.assign(Settings, Settings.epiPrev); delete Settings.epiPrev; }
        _m_apply();
        document.body.classList.toggle('epi', !!Settings.epi);
    };
    DOM.screens.addEventListener('click', (ev) => {
        const b = ev.target.closest && ev.target.closest('#pEpi [data-action]'); if (!b) return;
        if (b.dataset.action === 'epiSafe') { Settings.epi = true; applySettings(); }
        try { localStorage.setItem('linehotEpiVisto', '1'); } catch (e) {}
        Menu.stack = []; Menu.show('pMain');
    });
    const _onloadEpi = window.onload;
    window.onload = function () {
        _onloadEpi.call(this);
        try { applySettings(); } catch (e) {}
        let seen = false; try { seen = localStorage.getItem('linehotEpiVisto') === '1'; } catch (e) {}
        if (!seen) { Menu.stack = []; Menu.show('pEpi'); }
    };
}

// ########## [perfil.js] ##########
// ---------------------------------------------------------------- MEDIDOR DE RENDIMIENTO (no cambia nada del juego)
// En la consola (F12) escribe  LH.prof(8)  y juega 8 segundos: al terminar muestra una tabla con cuánto tarda cada parte
// del fotograma (en ms por fotograma, "incluye" = contiene a las demás de debajo). Los ganchos solo existen mientras mide;
// al acabar se retiran y el juego queda exactamente igual.
LH.prof = (secs = 8) => {
    if (LH._profOn) return 'ya está midiendo…';
    const T = {}, undo = [], t0 = performance.now(), calls = { draw: 0, upd: 0 };
    LH._profOn = true;
    const hook = (obj, name, label) => {
        const f = obj && obj[name]; if (typeof f !== 'function') return;
        obj[name] = function () {
            const t = performance.now();
            try { return f.apply(this, arguments); }
            finally { const d = performance.now() - t, r = T[label] || (T[label] = { ms: 0, n: 0, max: 0 }); r.ms += d; r.n++; if (d > r.max) r.max = d; }
        };
        undo.push(() => { obj[name] = f; });
    };
    const G = GameEngine.prototype;
    hook(G, 'update', '1 update (incluye lógica y envoltorios)');
    hook(G, 'draw', '2 draw TOTAL (incluye todo lo de abajo)');
    hook(G, 'drawBackdrop', '  fondo + luces/barras al ritmo');
    hook(G, 'drawWalls', '  paredes');
    hook(G, 'drawStains', '  manchas de sangre');
    hook(G, 'drawRings', '  anillos');
    hook(G, 'drawParticles', '  partículas (2 pasadas)');
    hook(G, 'drawFx', '  rayos y cortes');
    hook(G, 'drawBullets', '  balas');
    hook(Enemy.prototype, 'draw', '  enemigos (suma de todos)');
    hook(Player.prototype, 'draw', '  jugador');
    hook(Pickup.prototype, 'draw', '  objetos (suma de todos)');
    hook(LH, 'beatUpdate', '  analizador del ritmo');
    const snap = { en: 0, pa: 0, bu: 0 };
    const iv = setInterval(() => { try { snap.en = Math.max(snap.en, engine.enemies.length); snap.pa = Math.max(snap.pa, (engine.particles || []).length); snap.bu = Math.max(snap.bu, (engine.bullets || []).length); } catch (e) {} }, 250);
    console.log('%c[medidor] midiendo ' + secs + ' s… juega con normalidad (en PLAYING).', 'color:#0ff');
    setTimeout(() => {
        clearInterval(iv); undo.forEach(u => u()); LH._profOn = false;
        const el = (performance.now() - t0) / 1000, dr = (T['2 draw TOTAL (incluye todo lo de abajo)'] || { n: 0 }).n;
        const rows = Object.keys(T).sort().map(k => ({ parte: k, 'ms/fotograma': +(T[k].ms / Math.max(1, dr)).toFixed(2), 'peor ms': +T[k].max.toFixed(1), llamadas: T[k].n }));
        console.log('[medidor] ' + dr + ' fotogramas en ' + el.toFixed(1) + ' s = ' + (dr / el).toFixed(0) + ' FPS · nivel de calidad ' + Q.level + ' · lienzo ' + canvas.width + '×' + canvas.height + ' · máx. enemigos ' + snap.en + ', partículas ' + snap.pa + ', balas ' + snap.bu);
        console.table(rows);
        console.log('Fotograma completo a 60 FPS = 16.7 ms. update + draw por encima de ~12 ms = el juego va justo.');
        LH.profLast = { fps: dr / el, rows, max: snap };
    }, secs * 1000);
    return 'midiendo ' + secs + ' s…';
};

// ########## [fluidez.js] ##########
// =====================================================================
//  v1.7 · FLUIDEZ — 60 FPS en modo CALIDAD sin quitar efectos
//
//  1. RESOLUCIÓN DINÁMICA (LH.dyn): si el juego no llega a los FPS de la pantalla, baja un poco los PÍXELS del lienzo
//     (100 % → 86 → 74 → 64 %, nunca por debajo de ~0,75 px por px CSS) y NO toca resplandor, partículas, CRT ni fondo al ritmo.
//     Los sprites se dibujan una vez a resolución completa (sprK) y no se rehacen al cambiar de paso. Si el rendimiento se
//     recupera, sube de nuevo (con espera creciente si oscila). Solo cuando ya está al mínimo actúa la calidad automática de siempre
//     (bajar efectos), como último recurso.
//  2. PANTALLA «PREPARANDO PARTIDA» al pulsar JUGAR / REINTENTAR (LH.prep): precalienta gráficos, prueba unos fotogramas de una
//     escena cargada (enemigos, partículas, balas, anillos) para calibrar la resolución inicial y comprueba que la música está lista.
//     El resultado se recuerda por dispositivo/tamaño (localStorage linehotDyn).
//  3. El ritmo de fotogramas se adapta a la frecuencia real de la pantalla (motor.js · loop).
//  Depuración: LH.dyn, LH.fluz() (resumen), LH.prep.last.
// =====================================================================
LH.dyn = { steps: [1, 0.86, 0.74, 0.64], i: 0, bad: 0, good: 0, last: 0, wait: 12000, lastUp: 0, changes: 0 };
LH.dynKey = () => innerWidth + 'x' + innerHeight + '@' + (window.devicePixelRatio || 1) + '|' + qualityMode;
LH.dynSave = () => { try { const o = JSON.parse(localStorage.getItem('linehotDyn') || '{}'); o[LH.dynKey()] = LH.dyn.i; localStorage.setItem('linehotDyn', JSON.stringify(o)); } catch (e) {} };
LH.dynLoad = () => { try { const v = (JSON.parse(localStorage.getItem('linehotDyn') || '{}'))[LH.dynKey()]; return typeof v === 'number' ? v : 0; } catch (e) { return 0; } };
LH.setDyn = (i, save) => {
    const D = LH.dyn; i = clamp(i | 0, 0, D.steps.length - 1);
    if (Settings.perf) i = 0;                                              // RENDIMIENTO ya trabaja a 1 px
    if (i === D.i && dynScale === D.steps[i]) return false;
    D.i = i; dynScale = D.steps[i]; D.last = performance.now(); D.changes++; D.bad = D.good = 0;
    resize(); if (save !== false) LH.dynSave(); return true;
};
LH.fluz = () => ({ hz: Math.round(_hz), cadaN: _skip, fpsObjetivo: Math.round(Math.min(60, _hz / _skip)), resolucion: Math.round(dynScale * 100) + '%', lienzo: canvas.width + 'x' + canvas.height, calidadEfectos: Q.level, cambios: LH.dyn.changes });
{
    const _aq2 = autoQuality;
    autoQuality = function (fps) {
        const D = LH.dyn, now = performance.now();
        if (!Settings.autoQ || Settings.perf || !engine || engine.state !== 'PLAYING' || document.hidden) { D.bad = D.good = 0; return _aq2(fps); }
        const base = QUALITY[qualityMode].level, floor = D.i >= D.steps.length - 1;
        if (floor || Q.level > base) _aq2(fps);                            // último recurso: bajar efectos (y recuperarlos después)
        if (Q.level > base || now < _qGrace - 3500) { D.bad = D.good = 0; return; }
        const target = Math.min(60, _hz / _skip), lo = target * 0.88, hi = target * 0.97;
        if (fps < lo) { D.bad++; D.good = 0; } else if (fps >= hi) { D.good++; D.bad = Math.max(0, D.bad - 1); } else { D.bad = Math.max(0, D.bad - 1); D.good = Math.max(0, D.good - 1); }
        if (D.bad >= 3 && now - D.last > 1500 && D.i < D.steps.length - 1) {            // 1,5 s por debajo del 88 % → baja un paso
            if (now - D.lastUp < 30000) D.wait = Math.min(D.wait * 2, 120000);          // subió hace poco y volvió a fallar: espera más antes de probar otra vez
            LH.setDyn(D.i + 1);
        } else if (D.good >= 24 && D.i > 0 && now - D.last > D.wait) {                 // 12 s seguidos bien → prueba subir un paso
            D.lastUp = now; LH.setDyn(D.i - 1);
        }
    };
}

// ---------------------------------------------------------------- PANTALLA «PREPARANDO PARTIDA»
LH.prep = { busy: false, last: null };
{
    const _init0 = GameEngine.prototype.init;
    const raf = () => new Promise(r => requestAnimationFrame(r));
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const EVS = ['keydown', 'keyup'];
    const blk = (e) => { if (LH.prep.busy && e.key !== 'F5' && e.key !== 'F12') e.stopPropagation(); };
    function stage(e) {                                                    // escena de prueba: lo más pesado que se ve en una oleada alta
        e.reset();
        const W = width, H = height, R = (a, b) => a + Math.random() * (b - a);
        for (let t = 0; t <= 9; t++) for (let k = 0; k < 2; k++) { try { const en = makeEnemy(t, R(80, W - 80), R(80, H - 80), 12); if (en) e.enemies.push(en); } catch (x) {} }
        for (const k of ['SHOTGUN', 'MINIGUN', 'RAILGUN', 'HEALTH']) { try { e.pickups.push(new Pickup(R(80, W - 80), R(80, H - 80), k)); } catch (x) {} }
        for (let i = 0; i < 40; i++) { try { e.bullets.push(new Bullet(R(0, W), R(0, H), R(0, TAU), WEAPONS[i % 3 ? 'PISTOL' : 'MINIGUN'], i % 4 === 0)); } catch (x) {} }
        for (let i = 0; i < 14; i++) e.spawnParticle(R(100, W - 100), R(100, H - 100), [C.pink, C.cyan, C.yellow, C.red][i & 3], 70, 0, 0, 380);
        for (let i = 0; i < 5; i++) e.rings.push({ x: R(100, W - 100), y: R(100, H - 100), max: 160, life: 5, maxLife: 5, col: '#00f3ff' });
        e.shakeAmount = 18;
    }
    async function measure(frames) {                                       // mediana del tiempo entre fotogramas dibujando la escena de prueba
        const d = []; let last = await raf();
        for (let i = 0; i < frames; i++) { const t = await raf(); try { engine.draw(); } catch (x) {} if (i >= 4) d.push(t - last); last = t; }
        d.sort((a, b) => a - b); return d[d.length >> 1] || 16.7;
    }
    LH.prepRun = async () => {
        const t0 = performance.now(), info = { steps: [] };
        const el = document.createElement('div'); el.id = 'playLoader'; el.setAttribute('role', 'status');
        el.innerHTML = '<div class="ld-box"><h1 class="ld-title">LINE<span>HOT</span></h1><div class="ld-bar"><div class="ld-fill"></div></div><p class="ld-step">PREPARANDO PARTIDA…</p><p class="ld-pct">0%</p></div>';
        document.body.appendChild(el);
        const fill = el.querySelector('.ld-fill'), stp = el.querySelector('.ld-step'), pct = el.querySelector('.ld-pct');
        const set = (v, t) => { fill.style.width = v + '%'; pct.textContent = Math.round(v) + '%'; if (t) stp.textContent = t; };
        EVS.forEach(ev => window.addEventListener(ev, blk, true)); document.body.classList.add('prepping');
        try { audio.resume(); } catch (x) {}
        await raf(); set(8, 'PREPARANDO ARENA…'); await raf();
        try {
            _loopHold = true;
            if (LH.dyn.changes === 0) LH.setDyn(LH.dynLoad(), false);        // paso recordado de la última vez en este dispositivo
            try { Spr.sync(); warmSprites(); } catch (x) {}
            set(25, 'PREPARANDO GRÁFICOS…'); await raf();
            stage(engine);
            // CALIBRACIÓN: se dibuja la escena cargada y se mira si el navegador mantiene el ritmo; si no, se baja un paso de resolución
            const period = 1000 / Math.max(30, Math.min(_hz, 240)) * _skip, okMs = Math.max(period, 1000 / 60) * 1.18;
            const maxStep = LH.dyn.steps.length - 1;
            for (let n = 0, tc = performance.now(); n <= maxStep; n++) {
                set(40 + 12 * n, 'CALIBRANDO FLUIDEZ ' + Math.round(dynScale * 100) + '%…');
                const m = await measure(16); info.steps.push({ res: dynScale, ms: +m.toFixed(1) });
                if (m <= okMs || LH.dyn.i >= maxStep || n >= 2 || performance.now() - tc > 2200) break;   // como mucho 2 bajadas y ~2 s: el resto lo ajusta la partida
                LH.setDyn(LH.dyn.i + 1, false); await raf();
            }
            LH.dynSave();
            set(85, 'AFINANDO AUDIO…');
            await new Promise(r => { try { audio.music.whenReady(r, 3000); } catch (x) { r(); } });
        } catch (x) { console.warn('[prep]', x); }
        _loopHold = false;
        const rest = Math.max(0, 900 - (performance.now() - t0)); if (rest) await wait(rest);   // que no parpadee si todo va rápido
        set(100, '¡A MATAR!'); info.ms = Math.round(performance.now() - t0); info.fluz = LH.fluz(); LH.prep.last = info;
        return () => {                                                     // se llama justo tras arrancar la partida
            EVS.forEach(ev => window.removeEventListener(ev, blk, true)); document.body.classList.remove('prepping');
            el.classList.add('done'); setTimeout(() => el.remove(), 450);
        };
    };
    GameEngine.prototype.init = function () {
        if (LH.prep.busy) return;
        LH.prep.busy = true;
        LH.prepRun().then(done => { LH.prep.busy = false; lastTime = performance.now(); _init0.call(this); done(); },
            (e) => { console.warn('[prep]', e); _loopHold = false; LH.prep.busy = false; const o = document.getElementById('playLoader'); if (o) o.remove(); document.body.classList.remove('prepping'); _init0.call(this); });
    };
}

