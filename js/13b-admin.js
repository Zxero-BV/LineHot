// ########## [admin.js] ##########
// =====================================================================
//  v2.11 — PANEL DE ADMINISTRADOR (herramienta de pruebas)
//
//  Cómo abrirlo:   · PC: tecla F2 (o la tecla ` )          · Móvil: 5 toques rápidos en la esquina superior izquierda
//                  · o añade ?admin a la dirección (…/index.html?admin)
//  Una vez activado queda una pestañita «ADM» en el borde izquierdo (se guarda en localStorage). Para quitarla: pestaña AJUSTES → DESACTIVAR.
//  Consola:        LH.adm.toggle()  ·  LH.adm.boss('ECLIPSE', 20)  ·  LH.adm.go(25)
//
//  Qué hace (todo con botones, pensado también para móvil):
//   · JEFES      Invoca cualquier jefe con la fuerza (oleada) que elijas · deja al jefe con el 75 / 50 / 25 / 5 % para ver sus fases.
//   · ENEMIGOS   Invoca cualquier enemigo o minijefe (×1, ×5, ×10), con o sin élite.
//   · JUGADOR    Invulnerable, munición infinita, pulso sin espera, enemigos quietos, detener oleadas, velocidad del tiempo (⏸ … ×2).
//   · ARMAS      Cualquier arma con la rareza que quieras (y dobles) · objetos (escudo, bomba, imán…).
//   · OLEADAS    Ir directo a una oleada, saltar, terminar, borrar enemigos / balas, abrir la elección de mejoras.
//   · EXTRAS     Mejoras (+1 / MAX) y modificadores de partida · música (temas por sección) · iniciar partida de pruebas.
//
//  Una partida en la que uses el panel queda marcada como «MODO PRUEBAS»: NO se guarda como punto de control, NO borra tu partida
//  guardada, NO sube al ranking y NO cambia récords, mejores partidas, logros ni progreso (se restauran al terminar).
//  Para publicar el juego sin el panel basta con quitar 'js/13b-admin.js' de ARCHIVOS (index.html) y de FILES (sw.js).
//  Va después de 13-ranking.js (envuelve funciones suyas) y antes de 14-carga.js.
// =====================================================================
(() => {
    const KEY = 'linehotAdmin';
    const A = LH.adm = {
        open: false, tab: 'boss', lv: 10, n: 1, elite: false, rar: -1, dual: false, ts: 1,
        god: false, ammo: false, pulse: false, noAI: false, hold: false,
        runUsed: false, snap: null
    };
    const G = () => engine;
    const store = (v) => { try { v === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch (e) {} };
    const enabled = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
    const playing = () => !!(engine && engine.player && engine.state === 'PLAYING');
    const need = () => { if (playing()) { A.mark(); return true; } LH.toast('PRIMERO EMPIEZA UNA PARTIDA'); return false; };
    const hpFor = (w) => (LH.difHp ? LH.difHp(w) : 1 + w * 0.07);

    // ------------------------------------------------------------ partida de pruebas: nada cuenta
    A.mark = () => {
        if (A.runUsed) return;
        A.runUsed = true;
        try {
            A.snap = {
                top: JSON.stringify(LH.top), daily: JSON.stringify(LH.daily), prog: JSON.stringify(LH.prog),
                best: localStorage.getItem('neonCarnageBest'), bestVar: bestScore
            };
        } catch (e) { A.snap = null; }
        LH.toast('MODO PRUEBAS · ESTA PARTIDA NO CUENTA');
        head();
    };
    const _guardar = LH.partidaGuardar;
    LH.partidaGuardar = function () { if (A.runUsed) return; return _guardar.apply(this, arguments); };
    const _borrar = LH.partidaBorrar;
    LH.partidaBorrar = function () { if (A.runUsed) return; return _borrar.apply(this, arguments); };       // morir en pruebas no borra tu partida guardada
    const _unlock = LH.unlock;
    LH.unlock = function () { if (A.runUsed) return; return _unlock.apply(this, arguments); };
    const _rkOver = LH.rkOver;
    LH.rkOver = function () {
        if (A.runUsed) { const b = $id('rankOver'); if (b) b.classList.add('hidden'); return; }
        return _rkOver.apply(this, arguments);
    };
    const _fillOver = Menu.fillOver;
    Menu.fillOver = function (e) {
        _fillOver.call(this, e);
        if (!A.runUsed || !A.snap) return;
        try {                                                         // deshace récords, mejores partidas y progreso de esta partida
            LH.top = JSON.parse(A.snap.top); LH.daily = JSON.parse(A.snap.daily); LH.prog = JSON.parse(A.snap.prog);
            LH.save('linehotTop', LH.top); LH.save('linehotDaily', LH.daily); LH.save('linehotProg', LH.prog);
            LH.rank = 0; bestScore = A.snap.bestVar;
            if (A.snap.best === null) localStorage.removeItem('neonCarnageBest'); else localStorage.setItem('neonCarnageBest', A.snap.best);
        } catch (x) {}
    };
    const _reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function () { _reset.call(this); A.runUsed = false; A.snap = null; head(); };

    // ------------------------------------------------------------ ganchos del motor
    const hpd = Object.getOwnPropertyDescriptor(Player.prototype, 'hp');
    Object.defineProperty(Player.prototype, 'hp', {
        configurable: true, get: hpd.get,
        set(v) { if (A.god && this._hp !== undefined && v < this._hp) return; hpd.set.call(this, v); }
    });
    const _update = GameEngine.prototype.update;
    GameEngine.prototype.update = function (dt) {
        if (A.ts !== 1) dt *= A.ts;
        _update.call(this, dt);
        const p = this.player;
        if (!p || this.state !== 'PLAYING') return;
        if (A.god) { p._hp = p.maxHp; if ((p.shield || 0) < 1) p.shield = 1; }
        if (A.pulse) p.pulseCooldown = 0;
        if (A.ammo && p.weapon !== WEAPONS.PISTOL && isFinite(p.ammo) && p.ammo < 9000) p.ammo = 9999;
    };
    const _spawnLogic = GameEngine.prototype.spawnLogic;
    GameEngine.prototype.spawnLogic = function (dt) { if (A.hold) return; return _spawnLogic.call(this, dt); };
    const _eUpdate = Enemy.prototype.update;
    Enemy.prototype.update = function (dt, px, py) { if (A.noAI) return; return _eUpdate.call(this, dt, px, py); };

    // ------------------------------------------------------------ acciones
    const spot = () => {
        const p = G().player; let s;
        for (let i = 0; i < 25; i++) { s = G().freeSpot(); if (dist(s.x, s.y, p.x, p.y) > 230) break; }
        return s;
    };
    A.boss = (name, lv) => {
        if (!need()) return;
        const g = G(), entry = LH.BOSSES.find(b => b[0] === name); if (!entry) return;
        lv = Math.max(1, lv | 0 || A.lv);
        const w0 = g.wave, bn0 = LH.bossName;
        g.wave = lv; LH.bossName = () => entry;                         // makeEnemy elige nombre, color y nivel con la oleada
        let e;
        try { e = makeEnemy(5, width / 2, Math.max(110, height * 0.2), hpFor(lv)); } finally { g.wave = w0; LH.bossName = bn0; }
        g.enemies.push(e);
        audio.music.setSection('boss');
        g.banner(name, entry[1]);
    };
    A.bossHp = (pct) => {
        if (!need()) return;
        let n = 0;
        for (const e of G().enemies) if (e.boss && !e.dead) { e.hp = Math.max(1, e.maxHp * pct); n++; }
        if (!n) LH.toast('NO HAY NINGÚN JEFE');
    };
    A.spawn = (t, n) => {
        if (!need()) return;
        const g = G(), lv = Math.max(1, A.lv);
        for (let i = 0; i < n; i++) {
            const s = spot(), e = makeEnemy(t, s.x, s.y, hpFor(lv));
            if (A.elite && !e.boss && LH.makeElite) LH.makeElite(e);
            g.enemies.push(e);
        }
    };
    A.go = (n) => {
        if (!need()) return;
        n = n | 0; if (n < 1) return;
        const g = G();
        g.enemies.length = 0; g.bullets = g.bullets.filter(b => !b.isEnemy); g.queue = [];
        A.hold = false; g.wave = n - 1; g.startWave();
        paint();
    };
    A.killAll = () => { if (!need()) return; for (const e of G().enemies.slice()) if (!e.dead) G().hitEnemy(e, 1e9, 0, 0, false); };
    A.give = (key) => {
        if (!need()) return;
        const p = G().player, W = WEAPONS[key]; if (!W) return;
        if (key === 'PISTOL') { LH.wSwitch(p, 'PISTOL'); return; }
        const wd = LH.wMake(key, A.rar < 0 ? LH.rollRar(0) : A.rar);
        p.equip(key, LH.wAmt(key), wd);
        if (A.dual && W.canDual) p.equip(key, LH.wAmt(key), wd);       // la misma arma otra vez = dobles
        try { LH.wStash(p); } catch (e) {}
    };
    A.item = (key) => { if (!need()) return; const p = G().player; G().pickups.push(new Pickup(p.x + 26, p.y, key)); };
    A.up = (id, all) => {
        if (!need()) return;
        const g = G(), u = LH.UPS.find(x => x.id === id); if (!u) return;
        g.up = g.up || {};
        do { if (LH.lvl(id) < u.max) LH.applyUp(id); else break; } while (all);
    };
    A.mut = (id) => {
        if (!need()) return;
        const g = G(); g.mut = g.mut || {}; g.mut[id] = !g.mut[id];
        g.scoreMult = LH.modMult(g.mut);
        if (id === 'nopulse') document.body.classList.toggle('nopulse', !!g.mut[id]);
    };
    A.start = () => {
        if (playing()) { LH.toast('YA ESTÁS EN UNA PARTIDA'); return; }
        if (!engine || (engine.state !== 'MENU' && engine.state !== 'GAMEOVER')) { LH.toast('SAL AL MENÚ PRINCIPAL PRIMERO'); return; }
        LH.dailyRun = false; engine.init();
        let n = 0;
        const t = setInterval(() => {
            if (playing()) { clearInterval(t); A.hold = true; A.mark(); paint(); }
            else if (++n > 60) clearInterval(t);
        }, 100);
    };

    // ------------------------------------------------------------ interfaz
    const css = document.createElement('style');
    css.textContent = `
#adm{position:fixed;z-index:450;right:calc(8px + env(safe-area-inset-right,0px));top:calc(8px + env(safe-area-inset-top,0px));width:min(330px,calc(100vw - 16px));
 max-height:calc(100% - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;background:rgba(8,4,18,.94);
 border:2px solid #00f3ff;box-shadow:0 0 0 2px #000,0 0 18px rgba(0,243,255,.35);font:11px/1.35 'Courier New',monospace;color:#d8f8ff;
 -webkit-user-select:none;user-select:none;touch-action:pan-y;text-shadow:none}
#adm.hide,#admBtn.hide{display:none}
@media (orientation:portrait) and (max-width:700px){#adm{left:calc(8px + env(safe-area-inset-left,0px));right:calc(8px + env(safe-area-inset-right,0px));top:auto;
 bottom:calc(8px + env(safe-area-inset-bottom,0px));width:auto;max-height:52%}}
#adm .ah{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #1d6a73}
#adm .ah b{color:#00f3ff;letter-spacing:1px;font-size:12px}
#adm .ai{flex:1;min-width:0;color:#8fd6e0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#adm .ai.test{color:#ffb000}
#adm .at{display:flex;overflow-x:auto;border-bottom:1px solid #1d6a73;flex:none}
#adm .at button{flex:none;padding:7px 9px;background:none;border:0;border-bottom:2px solid transparent;color:#8fd6e0;font:inherit;cursor:pointer}
#adm .at button.on{color:#fff;border-bottom-color:#00f3ff;background:rgba(0,243,255,.08)}
#adm .ac{padding:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;flex:1}
#adm h4{margin:8px 0 4px;font-size:10px;color:#ff4fb0;letter-spacing:1px;font-weight:400}
#adm h4:first-child{margin-top:0}
#adm .ag{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}
#adm .ag.c3{grid-template-columns:repeat(3,1fr)}
#adm .ag.c4{grid-template-columns:repeat(4,1fr)}
#adm .ab{min-height:32px;padding:4px 5px;background:#14102a;border:1px solid #3a3a6a;color:#d8f8ff;font:inherit;cursor:pointer;touch-action:manipulation}
#adm .ab:active{background:#2a2060}
#adm .ab.on{background:#00f3ff;color:#001418;border-color:#00f3ff}
#adm .ab.bad{border-color:#ff3355;color:#ff9db0}
#adm .ar{display:flex;align-items:center;gap:6px;margin:5px 0}
#adm .ar span{flex:1;color:#8fd6e0}
#adm .ar b{min-width:34px;text-align:right;color:#fff;font-weight:400}
#adm input[type=number]{width:70px;padding:5px;background:#0d0a1c;border:1px solid #3a3a6a;color:#fff;font:inherit;-webkit-user-select:text;user-select:text}
#adm .hint{margin:6px 0 0;color:#6b8f96;font-size:10px}
#admBtn{position:fixed;z-index:449;left:0;top:50%;transform:translateY(-50%);padding:10px 3px;background:rgba(8,4,18,.7);border:1px solid #00f3ff;border-left:0;
 color:#00f3ff;font:9px 'Courier New',monospace;letter-spacing:1px;writing-mode:vertical-rl;opacity:.55;cursor:pointer}
#admBtn:hover,#admBtn:active{opacity:1}`;
    document.head.appendChild(css);

    const panel = document.createElement('div'); panel.id = 'adm'; panel.className = 'hide'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Panel de administrador');
    const tab = document.createElement('button'); tab.id = 'admBtn'; tab.className = 'hide'; tab.textContent = 'ADM'; tab.setAttribute('aria-label', 'Abrir panel de administrador');
    document.body.appendChild(panel); document.body.appendChild(tab);

    const TABS = [['boss', 'JEFES'], ['en', 'ENEMIGOS'], ['pl', 'JUGADOR'], ['wp', 'ARMAS'], ['wv', 'OLEADAS'], ['ex', 'EXTRAS']];
    const bt = (act, val, label, on, cls) => `<button class="ab${on ? ' on' : ''}${cls ? ' ' + cls : ''}" data-a="${act}"${val === undefined ? '' : ` data-v="${val}"`}>${label}</button>`;
    const ENEM = [[0, 'BÁSICO'], [1, 'PÚRPURA'], [2, 'AMARILLO'], [3, 'ENJAMBRE'], [6, 'KAMIKAZE'], [7, 'DIVISOR'], [8, 'FRANCOTIRADOR'], [9, 'ESCUDERO'], [10, 'FLANQUEADOR'], [14, 'MÉDICO'], [4, 'MINIJEFE'], [11, 'PRISMA'], [12, 'PULSAR'], [13, 'TEJEDOR']];
    const ITEMS = [['HEALTH', 'VIDA'], ['SHIELD', 'ESCUDO'], ['SLOW', 'TIEMPO LENTO'], ['MAGNET', 'IMÁN'], ['NUKE', 'BOMBA'], ['OVERDRIVE', 'SOBRECARGA']];
    const RARS = [[-1, 'AL AZAR'], [0, 'COMÚN'], [1, 'POCO COM.'], [2, 'RARO'], [3, 'ÉPICO'], [4, 'LEGEND.']];
    const lvRow = () => `<div class="ar"><span>Nivel (oleada) de vida y fuerza</span><input type="number" id="admLv" min="1" max="200" value="${A.lv}" inputmode="numeric"></div>`;

    const views = {
        boss: () => `<h4>INVOCAR JEFE</h4>${lvRow()}<div class="ag">${LH.BOSSES.map(b => `<button class="ab" data-a="boss" data-v="${b[0]}" style="border-color:${b[1]};color:${b[1]}">${b[0]}</button>`).join('')}</div>
            <h4>VIDA DEL JEFE (para ver sus fases)</h4><div class="ag c4">${[0.75, 0.5, 0.25, 0.05].map(v => bt('bhp', v, Math.round(v * 100) + '%')).join('')}</div>
            <p class="hint">El nivel decide la vida y el tier (oleada 5 = tier 1, 10 = tier 2…). Los jefes aparecen arriba, en el centro.</p>`,
        en: () => `<h4>CANTIDAD</h4><div class="ag c3">${[1, 5, 10].map(v => bt('n', v, '×' + v, A.n === v)).join('')}</div>
            ${lvRow()}<div class="ar"><span>Aparecen como ÉLITE</span>${bt('elite', undefined, A.elite ? 'SÍ' : 'NO', A.elite)}</div>
            <h4>ENEMIGOS</h4><div class="ag">${ENEM.map(([t, n]) => bt('en', t, n)).join('')}</div>`,
        pl: () => `<h4>PRUEBAS</h4><div class="ag">${[['god', 'INVULNERABLE'], ['ammo', 'MUNICIÓN ∞'], ['pulse', 'PULSO SIN ESPERA'], ['noAI', 'ENEMIGOS QUIETOS'], ['hold', 'DETENER OLEADAS']].map(([k, n]) => bt('tog', k, n, A[k])).join('')}</div>
            <h4>VELOCIDAD DEL TIEMPO</h4><div class="ag c3">${[[0.0001, '⏸'], [0.1, '×0.1'], [0.25, '×0.25'], [0.5, '×0.5'], [1, '×1'], [2, '×2']].map(([v, n]) => bt('ts', v, n, A.ts === v)).join('')}</div>
            <h4>JUGADOR</h4><div class="ag">${bt('heal', undefined, 'CURAR')}${bt('maxhp', undefined, '+50 VIDA MÁX.')}${bt('shield', undefined, '+1 ESCUDO')}${bt('score', undefined, '+10000 PUNTOS')}</div>`,
        wp: () => `<h4>RAREZA</h4><div class="ag c3">${RARS.map(([v, n]) => bt('rar', v, n, A.rar === v)).join('')}</div>
            <div class="ar"><span>Dobles (si el arma lo permite)</span>${bt('dual', undefined, A.dual ? 'SÍ' : 'NO', A.dual)}</div>
            <h4>ARMAS</h4><div class="ag">${Object.keys(WEAPONS).map(k => bt('wp', k, WEAPONS[k].name)).join('')}</div>
            <div class="ar"><span></span>${bt('refill', undefined, 'RECARGAR MUNICIÓN')}</div>
            <h4>OBJETOS (aparecen a tu lado)</h4><div class="ag c3">${ITEMS.filter(([k]) => k === 'HEALTH' || EXTRA_PK[k]).map(([k, n]) => bt('item', k, n)).join('')}</div>`,
        wv: () => `<h4>IR A UNA OLEADA</h4><div class="ar"><span>Oleada</span><input type="number" id="admGo" min="1" max="500" value="${Math.max(1, (engine && engine.wave) || 1)}" inputmode="numeric">${bt('go', '', 'IR')}</div>
            <div class="ag c4">${[5, 10, 15, 20, 25, 30, 40, 50].map(v => bt('go', v, v)).join('')}</div>
            <p class="hint">Ir a una oleada la activa (quita DETENER OLEADAS). Las de múltiplo de 5 traen jefe.</p>
            <h4>CONTROL</h4><div class="ag">${bt('next', undefined, 'SIGUIENTE OLEADA')}${bt('endw', undefined, 'TERMINAR OLEADA')}${bt('killall', undefined, 'MATAR A TODOS')}${bt('clearE', undefined, 'BORRAR ENEMIGOS')}${bt('clearB', undefined, 'BORRAR BALAS')}${bt('openup', undefined, 'ELEGIR MEJORA')}</div>`,
        ex: () => `<h4>PARTIDA</h4><div class="ag">${bt('start', undefined, 'INICIAR PARTIDA DE PRUEBAS')}${bt('sec', 'calm', 'MÚSICA: CALMA')}</div>
            <h4>MEJORAS (nivel actual)</h4>${LH.UPS.map(u => `<div class="ar"><span>${u.name}</span><b>${engine && engine.up ? LH.lvl(u.id) : 0}/${u.max}</b>${bt('up', u.id, '+1')}${bt('upmax', u.id, 'MAX')}</div>`).join('')}
            <h4>MODIFICADORES</h4><div class="ag">${LH.MUTS.map(m => bt('mut', m.id, m.name, !!(engine && engine.mut && engine.mut[m.id]))).join('')}</div>
            <h4>MÚSICA (sección)</h4><div class="ag c4">${['fight', 'boss', 'mini', 'calm'].map(s => bt('sec', s, s.toUpperCase())).join('')}</div>
            <h4>PANEL</h4><div class="ag">${bt('off', undefined, 'DESACTIVAR PANEL', false, 'bad')}${bt('close', undefined, 'CERRAR')}</div>
            <p class="hint">Reabrir: F2 · 5 toques en la esquina superior izquierda · ?admin</p>`
    };

    function info() {
        const g = engine; if (!g || !g.player) return 'SIN PARTIDA';
        const b = g.enemies && g.enemies.find(e => e.boss && !e.dead);
        return 'ONDA ' + g.wave + ' · ENE ' + g.enemies.length + ' · BALAS ' + g.bullets.length +
            (b ? ' · ' + (b.bossName || 'JEFE') + ' ' + Math.round(b.hp / b.maxHp * 100) + '%' + (b.phase ? ' F' + b.phase : '') : '') + (A.ts !== 1 ? ' · ×' + A.ts : '');
    }
    function head() {
        const el = panel.querySelector('.ai'); if (!el) return;
        el.textContent = (A.runUsed ? 'MODO PRUEBAS · ' : '') + info();
        el.classList.toggle('test', A.runUsed);
    }
    function paint() {
        const keep = panel.querySelector('.ac'), top = keep ? keep.scrollTop : 0;
        panel.innerHTML = `<div class="ah"><b>ADMIN</b><span class="ai"></span>${bt('close', undefined, '✕')}</div>` +
            `<div class="at">${TABS.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${A.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>` +
            `<div class="ac">${views[A.tab]()}</div>`;
        panel.querySelector('.ac').scrollTop = top;
        head();
    }
    A.show = (v) => {
        A.open = v === undefined ? !A.open : !!v;
        if (A.open) { store('1'); paint(); }
        panel.classList.toggle('hide', !A.open);
        tab.classList.toggle('hide', A.open || !enabled());
    };
    A.toggle = () => A.show();
    A.disable = () => { A.show(false); store(null); tab.classList.add('hide'); LH.toast('PANEL DESACTIVADO'); };

    const readNum = (id, d) => { const el = $id(id), v = el ? parseInt(el.value, 10) : NaN; return v >= 1 ? v : d; };
    const ACT = {
        tab: (v) => { A.tab = v; paint(); },
        close: () => A.show(false),
        off: () => A.disable(),
        boss: (v) => { A.lv = readNum('admLv', A.lv); A.boss(v, A.lv); },
        bhp: (v) => A.bossHp(+v),
        n: (v) => { A.n = +v; paint(); },
        elite: () => { A.elite = !A.elite; paint(); },
        en: (v) => { A.lv = readNum('admLv', A.lv); A.spawn(+v, A.n); },
        tog: (v) => { A[v] = !A[v]; if (A[v] && v !== 'hold' && playing()) A.mark(); paint(); },
        ts: (v) => { A.ts = +v; if (A.ts !== 1 && playing()) A.mark(); paint(); },
        heal: () => { if (need()) G().player.hp = G().player.maxHp; },
        maxhp: () => { if (need()) { const p = G().player; p.maxHp += 50; p.hp = p.maxHp; } },
        shield: () => { if (need()) { const p = G().player; p.shield = (p.shield || 0) + 1; } },
        score: () => { if (need()) G().score += 10000; },
        rar: (v) => { A.rar = +v; paint(); },
        dual: () => { A.dual = !A.dual; paint(); },
        wp: (v) => A.give(v),
        refill: () => { if (need()) { const p = G().player; if (isFinite(p.ammo)) { p.ammo = Math.max(p.ammo, LH.wAmt(LH.wCur(p)) * 2); try { LH.wStash(p); } catch (e) {} } } },
        item: (v) => A.item(v),
        go: (v) => A.go(v === '' || v === undefined ? readNum('admGo', 1) : +v),
        next: () => A.go((engine ? engine.wave : 0) + 1),
        endw: () => { if (!need()) return; A.hold = false; G().queue = []; A.killAll(); paint(); },
        killall: () => A.killAll(),
        clearE: () => { if (need()) G().enemies.length = 0; },
        clearB: () => { if (need()) G().bullets = G().bullets.filter(b => !b.isEnemy); },
        openup: () => { if (need()) LH.openUpgrade(); },
        up: (v) => { A.up(v, false); paint(); },
        upmax: (v) => { A.up(v, true); paint(); },
        mut: (v) => { A.mut(v); paint(); },
        sec: (v) => { try { audio.music.setSection(v); } catch (e) {} },
        start: () => A.start()
    };
    panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b || !ACT[b.dataset.a]) return;
        try { ACT[b.dataset.a](b.dataset.v); } catch (x) { console.warn('[admin]', x); LH.toast('ERROR · MIRA LA CONSOLA'); }
    });
    // el juego no debe disparar, mover ni pausar mientras usas el panel
    for (const t of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown']) {
        panel.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
        tab.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    }
    for (const t of ['keydown', 'keyup']) panel.addEventListener(t, (e) => e.stopPropagation());
    panel.addEventListener('input', (e) => { if (e.target.id === 'admLv') A.lv = readNum('admLv', A.lv); });
    tab.addEventListener('click', () => A.show(true));

    // ------------------------------------------------------------ cómo se abre
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2' || (e.key === '`' && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)))) { e.preventDefault(); A.show(); }
    });
    let taps = [];
    window.addEventListener('pointerdown', (e) => {                       // móvil: 5 toques rápidos en la esquina superior izquierda
        if (e.clientX > 70 || e.clientY > 70) return;
        const t = performance.now(); taps = taps.filter(x => t - x < 1800); taps.push(t);
        if (taps.length >= 5) { taps = []; A.show(true); }
    }, true);
    if (/[?&]admin\b/.test(location.search)) store('1');
    if (enabled()) tab.classList.remove('hide');
    setInterval(() => { if (A.open) head(); }, 250);
    if (/[?&]admin\b/.test(location.search)) setTimeout(() => A.show(true), 400);
})();
