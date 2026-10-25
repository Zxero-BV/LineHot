// ########## [partida.js] ##########
// =====================================================================
//  v2.3 — GUARDADO DE PARTIDA (punto de control)
//
//  Al empezar cada oleada (con la anterior superada y la mejora ya elegida) se guarda la partida:
//  onda, puntos, vida, mejoras, modificadores y TODAS tus armas (con munición, rareza, calidad y modificadores).
//  · Menú principal → CONTINUAR · ONDA N  (aparece solo si hay una partida guardada).
//  · Se guarda en la clave «linehotPartida»: nube.js la sube a Supabase, así puedes seguir en otro móvil.
//  · Si mueres, la partida guardada se borra (una vida por partida). Salir al menú NO la borra.
//  · Al continuar empiezas la oleada siguiente con 2 s de calma; lo que había en pantalla (enemigos, balas) no se guarda.
//  Va justo antes de carga.js (envuelve startWave y Menu.fillOver).
// =====================================================================
LH.PART_K = 'linehotPartida';

LH.partida = () => {
    const s = LH.load(LH.PART_K, null);
    return s && s.v === 1 && s.wave >= 1 && s.inv ? s : null;
};

LH.partidaGuardar = () => {
    const e = engine, p = e && e.player;
    if (!e || !p || e.state !== 'PLAYING' || e.wave < 1 || p._hp <= 0) return;
    try { LH.wStash(p); } catch (x) {}
    const inv = {};
    for (const k in (p.inv || {})) {
        const o = p.inv[k]; if (!WEAPONS[k]) continue;
        inv[k] = { ammo: o.ammo === Infinity ? -1 : (o.ammo | 0), dual: !!o.dual, wd: o.wd || null };
    }
    LH.save(LH.PART_K, {
        v: 1, t: Date.now(), wave: e.wave, score: e.score, kills: e.kills, maxCombo: e.maxCombo, time: e.time,
        hp: p._hp, maxHp: p.maxHp, shield: p.shield || 0, up: e.up || {}, mut: e.mut || {}, mult: e.scoreMult || 1,
        daily: !!LH.dailyRun, cur: LH.wCur(p), sl: (p.slots || []).slice(0, 2), inv
    });
    LH.paintContinuar();
};

LH.partidaBorrar = () => { try { localStorage.removeItem(LH.PART_K); } catch (e) {} LH.paintContinuar(); };

// engine.init() es asíncrono (pantalla «PREPARANDO PARTIDA», ver [perfil/fluidez]): la partida empieza ~1 s después.
// Por eso primero se arranca una partida normal y, en cuanto está en marcha (state PLAYING), se le aplica lo guardado.
LH.partidaAplicar = (s) => {
    const e = engine, p = e.player;
    e.wave = s.wave; e.score = s.score | 0; e.kills = s.kills | 0; e.maxCombo = s.maxCombo | 0; e.time = +s.time || 0;
    e.up = s.up || {}; e.mut = s.mut || {}; e.scoreMult = s.mult || LH.modMult(e.mut);
    document.body.classList.toggle('nopulse', !!e.mut.nopulse);
    PULSE_COOLDOWN = 5 * Math.pow(0.8, e.up.pulse || 0);
    p.maxHp = s.maxHp || 100; p._hp = Math.max(1, Math.min(p.maxHp, s.hp || p.maxHp)); e.hpGhost = p._hp; p.shield = s.shield || 0;
    const inv = {};
    for (const k in s.inv) {
        if (!WEAPONS[k]) continue;
        const o = s.inv[k]; inv[k] = { ammo: o.ammo < 0 ? Infinity : o.ammo, dual: !!o.dual };
        if (o.wd) inv[k].wd = o.wd;
    }
    // dos ranuras (izquierda / derecha): una partida guardada con más armas se recorta a la que llevabas + una más
    const ok = (k) => inv[k] && (k === 'PISTOL' || inv[k].ammo > 0);
    let cur = ok(s.cur) ? s.cur : null;
    let sl = (Array.isArray(s.sl) ? s.sl : []).filter(ok).slice(0, 2);
    if (cur && !sl.includes(cur)) sl = [cur, sl.find(k => k !== cur) || null];
    if (!sl.length) sl = LH.WORDER.filter(ok).slice(0, 2);
    if (!sl.length) { inv.PISTOL = { ammo: Infinity, dual: false }; sl = ['PISTOL']; }
    if (!cur || !sl.includes(cur)) cur = sl[0];
    while (sl.length < 2) sl.push(null);
    for (const k of Object.keys(inv)) if (!sl.includes(k)) delete inv[k];
    p.inv = inv; p.slots = sl;
    p.weapon = WEAPONS.PISTOL; p.ammo = Infinity; p.dual = false;
    LH.wLoad(p, cur, true);
    p.prevW = sl.find(k => k && k !== cur) || 'PISTOL';
    e.waveState = 'BREAK'; e.waveTimer = 2; e.queue = [];
    e.banner('PARTIDA RECUPERADA · ONDA ' + s.wave, C.green);
    try { e.updateUI(); } catch (x) {}
};
LH.partidaCargar = () => {
    const s = LH.partida(); if (!s || LH._cont) return false;
    LH._cont = true;
    LH.dailyRun = !!s.daily;
    engine.init();
    const t0 = performance.now(), iv = setInterval(() => {
        if (engine.state === 'PLAYING' && !LH.prep.busy) { clearInterval(iv); LH._cont = false; try { LH.partidaAplicar(s); } catch (x) { console.warn('[partida]', x); } }
        else if (performance.now() - t0 > 15000) { clearInterval(iv); LH._cont = false; }
    }, 40);
    return true;
};

LH.paintContinuar = () => {
    const b = $id('continueBtn'); if (!b) return;
    const s = LH.partida();
    b.classList.toggle('hidden', !s);
    const sp = b.querySelector('span'); if (sp && s) sp.innerHTML = 'CONTINUAR<small>ONDA ' + s.wave + ' · ' + s.score + ' PTS' + (s.daily ? ' · DIARIO' : '') + '</small>';
};

{
    const _sw = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () { LH.partidaGuardar(); return _sw.call(this); };   // punto de control
    const _fo = Menu.fillOver;
    Menu.fillOver = function (e) { LH.partidaBorrar(); return _fo.call(this, e); };               // has muerto: se acaba la partida guardada
    const _show = Menu.show;
    Menu.show = function (id) { _show.call(this, id); if (id === 'pMain') LH.paintContinuar(); };
    DOM.screens.addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (b && b.dataset.action === 'continue') { if (!LH.partidaCargar()) LH.toast('NO HAY PARTIDA GUARDADA'); }
    });
    LH.paintContinuar();
}
