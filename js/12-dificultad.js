// ########## [dificultad.js] ##########
// =====================================================================
//  v2.8 — oleadas 11+ más cortas y con menos relleno para llegar antes a los jefes: topes por tipo recortados, apariciones más rápidas
//         y vida +0.035/oleada (ver MAPA.md). Todo lo de abajo es la curva v2.4 con esos números ajustados.
//  v2.4 — CURVA DE DIFICULTAD DESDE LA OLEADA 11-13 (va justo antes del ranking y de la carga)
//
//  PROBLEMA: a partir de la oleada ~13 las oleadas eran muy difíciles Y muy largas. Causas medidas (oleada 16 / 24):
//   · Cada capa de enemigos (base, kamikaze, francotirador, escudero, flanqueador, médico, minijefes…) crecía por su cuenta y todas
//     se sumaban: 77 / 109 enemigos por oleada (la 9 tenía 36). Más de 40 eran enjambres que cuestan segundos de esquivar y matar.
//   · La vida de los enemigos seguía subiendo en línea recta (×2.1 en la 16, ×3.1 en la 30) y hasta 17 a la vez en pantalla.
//   · BUG: el MÉDICO (id 11) chocaba con el minijefe PRISMA (id 11): en vez de médicos salían 1-3 PRISMAS tanques por oleada.
//     Ahora el médico es el id 14 (js/07-animaciones.js) y sale de verdad (cura, pero es pequeño).
//
//  SOLUCIÓN: las oleadas 1-10 NO se tocan. Desde la 11 cada tipo de enemigo tiene un TOPE por oleada (tabla LH.DIF.tope), la vida
//  crece más despacio después de la 12 y hay menos enemigos a la vez. La dificultad sigue subiendo, pero escalonada y sin explotar.
//  Para ajustar el juego edita solo la tabla de abajo (los topes son «enemigos de ese tipo en una oleada»).
//  Consola:  LH.difTabla()  muestra la curva (oleada, enemigos, vida, simultáneos).
// =====================================================================
LH.DIF = {
    desde: 11,                                          // primera oleada afectada (las anteriores quedan como estaban)
    hpDesde: 12, hpA: 0.07, hpB: 0.035,                 // vida ×(1 + 0.07·oleada) hasta la 12; después +0.035 por oleada (v2.8: enemigos menos esponja; v2.7: 0.05)
    maxVivos: (w) => 7 + Math.min(Math.floor(w * 1.2), w > 12 ? 8 : 10) + (w > 12 ? Math.min(3, Math.floor((w - 9) / 6)) : 0),   // a la vez en pantalla: 15 en la 13, 16 desde la 15, 17 desde la 21, 18 desde la 27 (v2.6)
    espera: (w) => Math.max(w > 12 ? 0.7 : 0.8, 1.3 - w * 0.025),           // pausa entre apariciones: baja hasta ×0.7 en la 24 (v2.8; v2.7: ×0.8)
    // tope de cada tipo de enemigo en una oleada normal (las de jefe, cada 5, no cambian)
    tope: {                                             // v2.8: oleadas 11+ ~28 % más cortas (36-52 enemigos en vez de 50-71): más variedad, menos relleno
        0: (w) => 10 + Math.floor((w - 11) / 5),        // drones
        1: (w) => 1 + Math.floor((w - 11) / 8),         // tanques
        2: (w) => 2,                                    // tiradores
        3: (w) => 2,                                    // grupos de enjambre (6-8 cada uno)
        4: (w) => w >= 24 ? 3 : (w >= 16 ? 2 : 1),      // minijefes clásicos (círculo / cuadrado)
        6: (w) => 2 + Math.floor((w - 11) / 10),        // kamikazes
        7: (w) => w >= 20 ? 2 : 1,                      // divisores
        8: (w) => w >= 21 ? 2 : 1,                      // francotiradores
        9: (w) => w >= 16 ? 2 : 1,                      // escuderos
        10: (w) => 2 + Math.floor((w - 11) / 10),       // flanqueadores
        14: (w) => w >= 25 ? 2 : 1                      // médicos (curan: alargaban la oleada)
    },
    minijefes: (w) => w >= 24 ? 3 : 2,                  // tope TOTAL de minijefes (clásicos + PRISMA/PULSAR/TEJEDOR) en una oleada
    // v2.6 · TEMPO: más ritmo para que no se haga largo. Velocidad de los enemigos normales (no jefes, minijefes ni enjambres):
    // ×1.00 hasta la 6, +1.2 % por oleada, tope ×1.28 (el jugador va a 380 y un dron a 220 → 282 en la 30)
    vel: (w) => 1 + Math.min(0.28, Math.max(0, w - 6) * 0.012),
    // arranque con más ritmo: enemigos EXTRA en las oleadas 1-3 (antes 3, 4 y 5 drones: casi no pasaba nada). [tipo, cuántos]
    inicio: { 1: [[0, 3]], 2: [[0, 3]], 3: [[0, 3], [2, 1]] }
};
LH.difHp = (w) => w <= LH.DIF.hpDesde ? 1 + w * LH.DIF.hpA : 1 + LH.DIF.hpDesde * LH.DIF.hpA + (w - LH.DIF.hpDesde) * LH.DIF.hpB;

// recorta la cola de enemigos de una oleada (quita al azar los que sobran de cada tipo)
LH.difRecortar = (w, q) => {
    const D = LH.DIF; if (w < D.desde || w % 5 === 0 || !q || !q.length) return 0;
    let quitados = 0;
    const quita = (idx, n) => {                                     // idx = posiciones (en q) de los candidatos; quita n
        idx.sort(() => Math.random() - 0.5);
        const del = idx.slice(0, n).sort((a, b) => b - a);
        for (const i of del) { q.splice(i, 1); quitados++; }
    };
    for (const t of Object.keys(D.tope)) {
        const tope = Math.max(0, D.tope[t](w)), idx = [];
        q.forEach((s, i) => { if (s.t === +t) idx.push(i); });
        if (idx.length > tope) quita(idx, idx.length - tope);
    }
    const mini = []; q.forEach((s, i) => { if (s.t === 4 || (s.t >= 11 && s.t <= 13)) mini.push(i); });
    if (mini.length > D.minijefes(w)) quita(mini, mini.length - D.minijefes(w));
    return quitados;
};
{
    const _sw = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        _sw.call(this);
        try {
            let cambio = LH.difRecortar(this.wave, this.queue);
            const ex = LH.DIF.inicio[this.wave];
            if (ex && this.wave % 5 !== 0) {                                  // oleadas 1-3: enemigos extra
                for (const [t, c] of ex) for (let i = 0; i < c; i++) this.queue.push({ t, n: 1, d: t === 0 ? 0.7 : 1.0 });
                this.queue.sort(() => Math.random() - 0.5); cambio = true;
            }
            if (cambio) audio.music.call('setWaveSize', this.queue.reduce((a, x) => a + x.n, 0));
        } catch (e) { console.warn('[dificultad]', e); }
    };
}
// tabla de la curva (depuración): LH.difTabla() / LH.difTabla(40)
LH.difTabla = (hasta) => {
    const filas = [], G = engine;
    for (let w = 1; w <= (hasta || 30); w++) {
        if (w % 5 === 0) { filas.push({ oleada: w, enemigos: 4, tipo: 'JEFE' }); continue; }
        const q = [], push = (t, n, c) => { for (let i = 0; i < c; i++) q.push({ t, n }); };
        push(0, 1, 3 + Math.floor(w * 0.85) + Math.floor(w / 4));
        if (w >= 4) push(2, 1, Math.min(3, Math.floor((w - 1) / 3))); if (w >= 4) push(3, 7, Math.ceil((w - 2) / 4));
        if (w >= 8) push(1, 1, Math.floor((w - 5) / 3)); if (w >= 9) push(4, 1, Math.floor((w - 4) / 5));
        if (w >= 7) push(6, 1, Math.min(4, Math.floor((w - 4) / 3))); if (w >= 9) push(7, 1, Math.min(3, Math.floor((w - 5) / 3)));
        if (w >= 10) push(8, 1, Math.min(2, Math.floor((w - 6) / 3))); if (w >= 9) push(9, 1, Math.min(3, Math.floor((w - 6) / 3)));
        if (w % 4 === 0) push(4, 1, 1 + Math.floor(w / 12));
        if (w >= 6) push(10, 1, Math.min(5, 1 + Math.floor((w - 6) / 3))); if (w >= 9) push(14, 1, Math.min(3, 1 + Math.floor((w - 9) / 4)));
        if (w >= 6 && w % 2 === 0) push(13, 1, w >= 20 ? 2 : 1);
        const antes = q.reduce((a, x) => a + x.n, 0); LH.difRecortar(w, q);
        const ahora = q.reduce((a, x) => a + x.n, 0);
        filas.push({ oleada: w, enemigos: ahora, antes, vida: +LH.difHp(w).toFixed(2), vidaAntes: +(1 + w * 0.07).toFixed(2), vivos: LH.DIF.maxVivos(w) });
    }
    console.table(filas); return filas;
};

// v2.6 · velocidad de los enemigos normales según la oleada (los jefes, minijefes, enjambres y cabezas de Hydra no cambian)
{
    const _mk = makeEnemy;
    makeEnemy = function (t, x, y, hp) {
        const e = _mk(t, x, y, hp);
        if (e && !e.boss && !e.mini && !e.hhead && t !== 3 && engine && engine.wave > 6 && e.speed > 0) e.speed *= LH.DIF.vel(engine.wave);
        return e;
    };
}
