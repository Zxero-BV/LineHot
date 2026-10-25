// ########## [ranking.js] ##########
// =====================================================================
//  v2.3 — RANKING ONLINE (Supabase)
//
//  · Al morir, tu puntuación se envía sola al ranking MUNDIAL (o al del RETO DIARIO si jugaste el reto).
//    Solo cuenta tu mejor puntuación de cada tablero. Hace falta poner un nombre (3-14 caracteres) una vez.
//  · Ver el ranking: Menú → PROGRESO → RANKING (pestañas MUNDIAL / DIARIO y tu puesto).
//  · Todo pasa por las funciones SQL linehot_enviar / linehot_top (ver supabase.sql) vía Nube.rpc().
//  · Sin conexión: la puntuación queda pendiente y se envía en la próxima oportunidad.
//  Nota: la puntuación la calcula el navegador, así que un tramposo podría falsearla; el servidor solo
//  comprueba límites razonables y frecuencia. Para un ranking «a prueba de trampas» haría falta un servidor de partida.
//  Va justo después de partida.js y antes de carga.js.
// =====================================================================
LH.RK = { modo: 'global', tk: 0 };
LH.RK_PEND = 'linehotRkPend';
LH.rkActivo = () => { try { return typeof Nube !== 'undefined' && Nube.estado().activo; } catch (e) { return false; } };
LH.rkNombre = () => String(LH.load('linehotNombre', '') || '');
LH.rkNombreOk = (n) => /^[A-Za-z0-9_ .-]{3,14}$/.test(n);
LH.rkEsc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
LH.rkMsg = (err) => String((err && err.message) || err || 'error').slice(0, 90);

// Envía una partida {score, wave, combo, kills, daily, dia}. Devuelve {puesto, total, puntos, record}.
LH.rkEnviar = (r) => Nube.rpc('linehot_enviar', {
    p_nombre: LH.rkNombre(), p_puntos: r.score | 0, p_oleada: r.wave | 0, p_combo: r.combo | 0, p_kills: r.kills | 0,
    p_diario: !!r.daily, p_dia: r.dia || LH.dayKey()
});

// Pendientes (sin conexión o error): se guarda la mejor de cada tablero y se reintenta luego
LH.rkGuardarPend = (r) => {
    const pend = LH.load(LH.RK_PEND, {}), k = r.daily ? 'diario' : 'global', o = pend[k];
    if (!o || r.score > o.score || (r.daily && o.dia !== r.dia)) pend[k] = { score: r.score, wave: r.wave, combo: r.combo, kills: r.kills, daily: !!r.daily, dia: r.dia || LH.dayKey() };
    LH.save(LH.RK_PEND, pend);
};
LH.rkReintentar = async () => {                                  // envía lo pendiente de cada tablero; devuelve {global, diario, error}
    const res = {};
    if (!LH.rkActivo() || !LH.rkNombreOk(LH.rkNombre())) return res;
    const pend = LH.load(LH.RK_PEND, {}); let cambio = false;
    for (const k of ['global', 'diario']) {
        if (!pend[k]) continue;
        try { res[k] = await LH.rkEnviar(pend[k]); delete pend[k]; cambio = true; }
        catch (err) {
            const m = LH.rkMsg(err);
            if (/no v[aá]lid|fuera de rango|plausible|fecha/i.test(m)) { delete pend[k]; cambio = true; res.rechazo = m; }   // el servidor la rechaza: no tiene sentido reintentar
            else { res.error = m; break; }
        }
    }
    if (cambio) LH.save(LH.RK_PEND, pend);
    return res;
};

// ---------------------------------------------------------------- fin de partida
LH.rkOver = async () => {
    const box = $id('rankOver'), txt = $id('rankOverTxt'), form = $id('rankOverForm'); if (!box) return;
    const r = LH.last;
    if (!LH.rkActivo() || !r || r.score <= 0) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    LH.rkGuardarPend({ score: r.score, wave: r.wave, combo: r.combo, kills: r.kills, daily: r.daily, dia: LH.dayKey() });   // primero se anota; se borra al enviarse
    if (!LH.rkNombreOk(LH.rkNombre())) { form.classList.remove('hidden'); txt.textContent = 'PON TU NOMBRE PARA ENTRAR EN EL RANKING MUNDIAL'; return; }
    form.classList.add('hidden'); txt.textContent = 'ENVIANDO AL RANKING…';
    const res = await LH.rkReintentar(), j = res[r.daily ? 'diario' : 'global'];
    if (j) txt.textContent = (r.daily ? 'RETO DIARIO' : 'RANKING MUNDIAL') + ' · PUESTO ' + j.puesto + ' DE ' + j.total + (j.record ? '' : ' · (TU MEJOR: ' + j.puntos + ')');
    else if (res.rechazo) txt.textContent = 'EL SERVIDOR NO ACEPTÓ ESTA PUNTUACIÓN';
    else { txt.textContent = 'NO SE PUDO ENVIAR · SE REINTENTARÁ MÁS TARDE'; console.warn('[ranking]', res.error); }
};
{
    const _fo = Menu.fillOver;
    Menu.fillOver = function (e) { _fo.call(this, e); LH.rkOver(); };
}

// ---------------------------------------------------------------- nombre
LH.rkFijarNombre = (inputId) => {
    const el = $id(inputId); if (!el) return false;
    const n = el.value.replace(/[^A-Za-z0-9_ .-]/g, '').trim().slice(0, 14);
    if (!LH.rkNombreOk(n)) { LH.toast('NOMBRE: 3-14 LETRAS, NÚMEROS O . _ -'); return false; }
    LH.save('linehotNombre', n); el.value = n; LH.toast('NOMBRE GUARDADO · ' + n); return true;
};
for (const id of ['rkNameOver', 'rkNameTab']) {                   // escribir el nombre no debe mover ni pausar el juego
    const el = $id(id); if (!el) continue;
    for (const t of ['keydown', 'keyup']) el.addEventListener(t, (ev) => ev.stopPropagation());
}

// ---------------------------------------------------------------- pestaña RANKING (Progreso)
LH.rkCargar = async () => {
    const rows = $id('rankRows'), tk = ++LH.RK.tk; if (!rows) return;
    const nm = $id('rkNameTab'); if (nm && !nm.value) nm.value = LH.rkNombre();
    document.querySelectorAll('#rankHead [data-modo]').forEach(b => b.classList.toggle('on', b.dataset.modo === LH.RK.modo));
    if (!LH.rkActivo()) { rows.innerHTML = '<p class="hint">El ranking online necesita el guardado en la nube (Supabase) y conexión. Mira el README.</p>'; return; }
    rows.innerHTML = '<p class="hint">CARGANDO…</p>';
    try {
        await LH.rkReintentar();
        const j = await Nube.rpc('linehot_top', { p_diario: LH.RK.modo === 'diario', p_dia: LH.dayKey(), p_limite: 25 });
        if (tk !== LH.RK.tk) return;
        const fila = (t) => '<div class="row static' + (t.yo ? ' rk-me' : '') + '"><span class="rk">' + t.puesto + '</span><span class="row-label">' + LH.rkEsc(t.nombre) +
            '<small>ONDA ' + t.oleada + ' · COMBO ×' + t.combo + '</small></span><span class="val-pill">' + t.puntos + '</span></div>';
        let h = j.top.length ? j.top.map(fila).join('') : '<p class="hint">Todavía no hay puntuaciones' + (LH.RK.modo === 'diario' ? ' hoy' : '') + '. ¡Sé el primero!</p>';
        if (j.yo && !j.top.some(t => t.yo)) h += '<p class="hint">· · ·</p>' + fila(Object.assign({ yo: true }, j.yo));
        h += '<p class="hint">' + j.total + ' jugador' + (j.total === 1 ? '' : 'es') + ' en este ranking' + (LH.rkNombreOk(LH.rkNombre()) ? '' : ' · pon tu nombre arriba para entrar') + '</p>';
        rows.innerHTML = h;
    } catch (err) {
        if (tk === LH.RK.tk) rows.innerHTML = '<p class="hint">NO SE PUDO CARGAR EL RANKING<br><small>' + LH.rkEsc(LH.rkMsg(err)) + '</small></p>';
    }
};

DOM.screens.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const a = b.dataset.action;
    if (a === 'tab' && b.dataset.tab === 'rank') LH.rkCargar();
    else if (a === 'rkmodo') { LH.RK.modo = b.dataset.modo; LH.rkCargar(); }
    else if (a === 'rkname') { if (LH.rkFijarNombre('rkNameTab')) LH.rkCargar(); }
    else if (a === 'rkover') { if (LH.rkFijarNombre('rkNameOver')) LH.rkOver(); }
});
