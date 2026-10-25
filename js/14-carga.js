// ########## [carga.js] ##########
// =====================================================================
//  PANTALLA DE CARGA — precarga todo ANTES de poder jugar (va la ÚLTIMA)
//
//  v2.9: la precarga incluye ahora las OLEADAS (todos los tipos de enemigo de oleadas 1-32, con destello de golpe) y los halos de las balas.
//  Qué prepara, en orden:
//   FASE 1/2 · 1. Motor gráfico (warmSprites)  2. Efectos de sonido  3. PRECARGA de entidades: héroe (384 posturas), enemigos por color,
//            jefes y minijefes (12 giros), armas y objetos → ya no se generan en plena partida (LH.preloadTasks).
//   FASE 2/2 · Música (abajo). Antes de esto estaba todo en una sola barra.
//   2. Efectos de sonido: ruido y reverbs (salas) que antes se creaban al primer clic.
//   3. Música: el worker compila los temas, mide el dispositivo y ENSAYA el render completo
//      (luchas, jefe, descanso y cruces entre temas). Hasta que no avisa 'ready' no se juega.
//
//  Mientras carga se bloquean los clics y teclas (así la música no arranca a medias).
//  Si algo tarda más de 15 s, el juego entra igualmente (no se queda atascado).
// =====================================================================
// ---------------------------------------------------------------- PRECARGA DE ENTIDADES (fase 1 de la pantalla de carga)
// Estos sprites antes se generaban la primera vez que aparecían (jefe nuevo, color nuevo, girar el héroe…), es decir, EN
// PLENA PARTIDA, justo cuando más trabaja la música. Ahora se crean todos aquí, por tandas, antes de poder jugar.
LH.preloadTasks = () => {
    const T = [], add = (label, fn) => T.push([label, fn]);
    const cols = new Set(['#ff007f']), bossCols = new Set();
    try { for (let w = 1; w <= 30; w += 3) for (let t = 0; t <= 9; t++) { const e = makeEnemy(t, 0, 0, w); if (e && e.color) cols.add(e.color); } } catch (e) {}
    try { cols.add(SNIPE_COL); cols.add(SHIELD_COL); for (const b of LH.BOSSES) { cols.add(b[1]); bossCols.add(b[1]); } } catch (e) {}
    if (LH.heroRot) for (let q = 0; q < 32; q++) add('PROTAGONISTA (ANIMACIONES)', () => { for (let f = 0; f < 5; f++) for (let d = 0; d < 2; d++) for (let k = 0; k < 3; k++) LH.heroRot(q, f, d, k); });
    if (LH.eArt) for (const c of cols) add('ENEMIGOS', () => { for (const n of Object.keys(LH.SPR)) for (let f = 0; f < 2; f++) for (let fl = 0; fl < 2; fl++) LH.eArt(n, f, c, fl); });
    if (LH.bigArt) {
        for (const c of cols) add('JEFES Y MINIJEFES', () => { for (let st = 0; st < 12; st++) for (const w of ['o', 'i']) { LH.bigArt(false, w, st, c, false); if (bossCols.has(c)) LH.bigArt(true, w, st, c, false); } });
    }
    add('ARMAS Y OBJETOS', () => { for (const k of Object.keys(WEAPONS)) { try { LH.pixSprite(k); } catch (e) {} try { Spr.halo(WEAPONS[k].color); } catch (e) {} } });
    // v2.9 · PRECARGA DE OLEADAS (ver LH.warmWaves): un paso por muestra de oleada + halos de balas
    if (typeof makeEnemy === 'function' && typeof engine !== 'undefined' && engine) {
        for (const w of LH.WARM_WAVES) add('OLEADA ' + w, () => LH.warmWaves([w]));
        add('BALAS Y EFECTOS', () => LH.warmWaves([]));
    }
    return T;
};

// v2.9 · Dibuja de verdad cada tipo de enemigo (andar 0/1 y destello de golpe) de varias oleadas en un lienzo oculto: kamikaze, divisor,
// francotirador, escudero, flanqueador, médico y los halos de las balas ya no se generan por primera vez EN plena oleada. Se usa en la pantalla
// de carga y otra vez cada vez que Spr.sync vacía la caché (p. ej. cuando la calidad baja sola por FPS bajos: justo cuando más falta hace).
LH.WARM_WAVES = [1, 5, 8, 10, 14, 15, 20, 25, 26, 30, 32];
LH.warmWaves = (waves) => {
    if (typeof makeEnemy !== 'function' || typeof engine === 'undefined' || !engine) return;
    const cv = LH._warmCv || (LH._warmCv = document.createElement('canvas')); cv.width = cv.height = 96; const cx = cv.getContext('2d');
    const halos = LH._halos || (LH._halos = new Set([C.yellow, C.pink, C.cyan, C.red, C.white, C.green, C.purple, '#ff7a00', '#39ff14', '#4da6ff', '#b388ff', '#ff9f1c', '#ff3355', '#9d8cff']));
    for (const k of Object.keys(WEAPONS)) halos.add(WEAPONS[k].color);
    const G = engine, w0 = G.wave, f0 = LH.eFrame, dib = (LH.A && LH.A.edraw) || Enemy.prototype.draw;   // LH.A.edraw = dibujo base sin animaciones (el que crea los sprites)
    try {
        for (const w of (waves || LH.WARM_WAVES)) {
            G.wave = w;
            for (let t = 0; t <= 14; t++) {
                let e; try { e = makeEnemy(t, 48, 48, 1 + w * 0.07); } catch (x) { continue; }
                if (!e) continue; if (e.color) halos.add(e.color);
                for (let fr = 0; fr < 2; fr++) {
                    LH.eFrame = () => fr;
                    for (const kb of [0, 120]) { try { e.knockback.x = kb; e.x = e.y = 48; cx.clearRect(0, 0, 96, 96); dib.call(e, cx); } catch (x) {} }
                }
            }
        }
    } finally { LH.eFrame = f0; G.wave = w0; }
    for (const c of halos) { try { Spr.halo(c); } catch (e) {} }
};
LH.warmReady = false;                       // se activa al terminar la carga: desde entonces, cada vez que Spr.sync vacía la caché se vuelve a precalentar
{ const _ws = warmSprites; warmSprites = function () { const r = _ws.apply(this, arguments); if (LH.warmReady) { try { LH.warmWaves(); } catch (e) {} } return r; }; }

const Loader = (() => {
    const el = document.getElementById('loader');
    const fill = document.getElementById('ldFill');
    const stepEl = document.getElementById('ldStep');
    const pctEl = document.getElementById('ldPct');
    const MIN_MS = 700;                         // para que no parpadee si todo está en caché
    const t0 = performance.now();
    let value = 0, finished = false;

    const block = (e) => { if (!finished) e.stopPropagation(); };   // sin preventDefault: F5 y demás siguen funcionando
    const EVS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown', 'keyup', 'contextmenu'];
    EVS.forEach(ev => window.addEventListener(ev, block, true));

    function set(v, text) {
        value = Math.max(value, Math.min(100, v));
        fill.style.width = value + '%';
        pctEl.textContent = Math.round(value) + '%';
        if (text) stepEl.textContent = text;
    }
    function restart(text) {                    // la barra vuelve a 0 (sin animar hacia atrás): empieza la siguiente fase
        const tr = fill.style.transition; fill.style.transition = 'none'; value = 0; fill.style.width = '0%'; pctEl.textContent = '0%'; void fill.offsetWidth; fill.style.transition = tr;
        if (text) stepEl.textContent = text;
    }
    // cede el control al navegador para que se pinte la barra entre pasos
    const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[carga]', e); } };

    async function finish(musicOk) {
        if (finished) return;
        set(100, musicOk ? 'LISTO' : 'LISTO (SIN PRECARGA COMPLETA)');
        const wait = Math.max(0, MIN_MS - (performance.now() - t0));
        await new Promise(r => setTimeout(r, wait + 150));
        finished = true; LH.warmReady = true;
        EVS.forEach(ev => window.removeEventListener(ev, block, true));
        el.classList.add('done');
        setTimeout(() => el.remove(), 600);
    }

    async function run() {
        // FASE 1/2 · GRÁFICOS Y SONIDO (el worker de música ya está calentándose en paralelo desde que se creó el audio)
        set(6, 'FASE 1/2 · CARGANDO MOTOR…'); await tick();
        safe(() => { if (typeof Spr !== 'undefined') Spr.sync(); });
        safe(() => warmSprites());
        set(20, 'FASE 1/2 · PREPARANDO GRÁFICOS…'); await tick();
        safe(() => audio._sfxInit());
        set(30, 'FASE 1/2 · CARGANDO EFECTOS…'); await tick();
        // sprites que antes se creaban en plena partida: se hacen por tandas de ~10 ms para que se vea avanzar la barra
        const tasks = safe(() => LH.preloadTasks()) || [], tp = performance.now();
        for (let i = 0; i < tasks.length; i++) {
            safe(tasks[i][1]);
            if (performance.now() - tp > 25 * (i + 1) || i === tasks.length - 1 || i % 4 === 0) { set(30 + 70 * (i + 1) / tasks.length, 'FASE 1/2 · ' + tasks[i][0] + '…'); await tick(); }
        }
        const preMs = performance.now() - tp; LH.boot = { preloadMs: Math.round(preMs), tareas: tasks.length };
        if (preMs > 2500 && audio.music) { audio.music.look = Math.max(audio.music.look, 1.6); LH.boot.equipoJusto = true; }   // equipo lento (sin efecto: la música ya no se calcula en tiempo real)
        set(100, 'FASE 1/2 · LISTO'); await tick();

        // FASE 2/2 · MÚSICA: espera a que el MP3 del menú esté decodificado; mientras, la barra avanza despacio hasta el 95 %
        restart('FASE 2/2 · CARGANDO MÚSICA…'); await tick();
        const slow = setTimeout(() => el.classList.add('slow'), 4000);
        const creep = setInterval(() => { if (value < 95) set(value + (95 - value) * 0.06); }, 150);
        const ok = await new Promise(res => audio.music.whenReady(res, 15000));
        clearTimeout(slow); clearInterval(creep);
        el.classList.remove('slow');
        set(97, 'FASE 2/2 · AFINANDO…'); await tick();
        safe(() => console.info('[carga] precarga', LH.boot, 'música:', audio.music.diag()));
        await finish(ok);
    }
    setTimeout(() => finish(false), 30000);     // seguro: si algo falla antes de cargar, la pantalla no se queda para siempre
    return { run };
})();

const _onloadCarga = window.onload;
window.onload = function () {
    _onloadCarga.call(this);
    Loader.run();
};
