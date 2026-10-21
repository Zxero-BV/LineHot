// ########## [carga.js] ##########
// =====================================================================
//  PANTALLA DE CARGA — precarga todo ANTES de poder jugar (va la ÚLTIMA)
//
//  Qué prepara, en orden:
//   1. Motor gráfico: el juego, los menús, los controles y los sprites con resplandor (warmSprites).
//   2. Efectos de sonido: ruido y reverbs (salas) que antes se creaban al primer clic.
//   3. Música: el worker compila los temas, mide el dispositivo y ENSAYA el render completo
//      (luchas, jefe, descanso y cruces entre temas). Hasta que no avisa 'ready' no se juega.
//
//  Mientras carga se bloquean los clics y teclas (así la música no arranca a medias).
//  Si algo tarda más de 15 s, el juego entra igualmente (no se queda atascado).
// =====================================================================
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
    // cede el control al navegador para que se pinte la barra entre pasos
    const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[carga]', e); } };

    async function finish(musicOk) {
        if (finished) return;
        set(100, musicOk ? 'LISTO' : 'LISTO (SIN PRECARGA COMPLETA)');
        const wait = Math.max(0, MIN_MS - (performance.now() - t0));
        await new Promise(r => setTimeout(r, wait + 150));
        finished = true;
        EVS.forEach(ev => window.removeEventListener(ev, block, true));
        el.classList.add('done');
        setTimeout(() => el.remove(), 600);
    }

    async function run() {
        // 1. Motor gráfico (el juego ya se creó en window.onload; aquí se calientan sus sprites)
        set(8, 'CARGANDO MOTOR…'); await tick();
        safe(() => { if (typeof Spr !== 'undefined') Spr.sync(); });
        safe(() => warmSprites());
        set(35, 'PREPARANDO GRÁFICOS…'); await tick();

        // 2. Efectos de sonido (ruido + reverbs)
        set(40, 'CARGANDO EFECTOS…'); await tick();
        safe(() => audio._sfxInit());
        set(55, 'CARGANDO MÚSICA…'); await tick();

        // 3. Música: espera al aviso del worker; mientras, la barra avanza despacio hasta el 95 %
        const slow = setTimeout(() => el.classList.add('slow'), 4000);
        const creep = setInterval(() => { if (value < 95) set(value + (95 - value) * 0.06); }, 150);
        const ok = await new Promise(res => audio.music.whenReady(res, 15000));
        clearTimeout(slow); clearInterval(creep);
        el.classList.remove('slow');
        set(97, 'AFINANDO…'); await tick();
        await finish(ok);
    }
    setTimeout(() => finish(false), 20000);     // seguro: si algo falla antes de cargar, la pantalla no se queda para siempre
    return { run };
})();

const _onloadCarga = window.onload;
window.onload = function () {
    _onloadCarga.call(this);
    Loader.run();
};
