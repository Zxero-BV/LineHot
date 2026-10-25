// ########## [armas2.js] ##########
// =====================================================================
//  v2.4 — DOS RANURAS DE ARMA: IZQUIERDA Y DERECHA   (va justo antes de carga.js)
//
//  Antes: inventario de hasta 9 armas (una de cada tipo) que se recogían solas.
//  Ahora: como MÁXIMO DOS ARMAS, una en la ranura IZQUIERDA y otra en la DERECHA (las dos se ven en el HUD y la de reserva
//  se ve colgada a la espalda del protagonista). Empiezas con la pistola a la izquierda y la derecha vacía.
//   · Ranura libre  → el arma del suelo se recoge sola y pasa a tu mano.
//   · Ranuras llenas → el arma del suelo NO se recoge: acércate y pulsa  F  (móvil: botón CAMBIAR · mando: Y) para
//                      INTERCAMBIARLA por la que llevas en la mano. La tuya queda en el suelo con su munición, rareza y mods.
//   · Misma arma que ya llevas → suma munición (y las dobles siguen funcionando: escopeta, minigun, katana, láser, arco).
//   · Cambiar de mano:  1 (izquierda) · 2 (derecha) · Q / E · rueda del ratón · mando X · móvil: toca la ranura en el panel.
//   · Sin munición: esa ranura se vacía y pasas a la otra arma; si no te queda ninguna, vuelve la pistola (infinita).
//   · Las armas del suelo duran 10 s más antes de desaparecer.
// =====================================================================
LH.WORDER = ['PISTOL', 'SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'LASER', 'ROCKET', 'ARC', 'AKIMBO'];
LH.wCur = (p) => LH.wKey(p) || 'PISTOL';
LH.wInv = (p) => p.inv || (p.inv = {});
LH.wSl = (p) => {                                                  // [izquierda, derecha] (clave del arma o null)
    const s = p.slots;
    if (!s || s.length !== 2) p.slots = [(s && s[0]) || null, (s && s[1]) || null];
    return p.slots;
};
LH.wStash = (p) => {                                               // guarda munición/dobles del arma en mano (conserva wd) y la coloca en una ranura
    const inv = LH.wInv(p), k = LH.wCur(p), o = inv[k] || (inv[k] = {}), s = LH.wSl(p);
    o.ammo = p.ammo; o.dual = !!p.dual;
    if (!s.includes(k)) { const i = s.indexOf(null); if (i >= 0) s[i] = k; else { delete inv[s[0]]; s[0] = k; } }
};
LH.wHas = (p, k) => { const s = LH.wInv(p)[k]; return !!s && (k === 'PISTOL' || s.ammo > 0); };
LH.wFix = (p) => {                                                 // coherencia: ranuras ↔ inventario (máx. 2 armas)
    const s = LH.wSl(p), inv = LH.wInv(p);
    for (let i = 0; i < 2; i++) if (s[i] && !inv[s[i]]) s[i] = null;
    if (s[0] && s[0] === s[1]) s[1] = null;
    for (const k of Object.keys(inv)) if (!s.includes(k)) delete inv[k];
};
LH.wOwned = (p) => {                                               // armas disponibles, en el orden de las ranuras (izquierda, derecha)
    LH.wStash(p); LH.wFix(p);
    return LH.wSl(p).filter(k => k && LH.wHas(p, k));
};
LH.wLoad = (p, k, quiet) => {                                      // pone en la mano un arma de las ranuras
    const prev = LH.wCur(p), s = p.inv[k], W = WEAPONS[k];
    if (prev !== k) p.prevW = prev;
    p.weapon = W; p.ammo = s.ammo; p.dual = s.dual; p.fireCooldown = Math.max(p.fireCooldown, 0.12);
    if (!quiet) engine.spawnText(p.x, p.y - 30, (p.dual ? '2× ' : '') + W.name, W.color);
};
LH.wSwitch = (p, k) => {
    if (!engine || engine.state !== 'PLAYING' || p.hp <= 0) return;
    if (!LH.wOwned(p).includes(k) || k === LH.wCur(p)) return;
    LH.wStash(p); LH.wLoad(p, k);
};
LH.wCycle = (p, d) => {                                            // con dos ranuras, cambiar = pasar a la otra
    const own = LH.wOwned(p); if (own.length < 2) return;
    LH.wSwitch(p, own[(own.indexOf(LH.wCur(p)) + d + own.length) % own.length]);
};
LH.wSlotKey = (p, i) => { LH.wOwned(p); return LH.wSl(p)[i] || null; };
LH.wRunOut = (p) => {                                              // el arma en mano se quedó sin munición
    const G = engine, cur = LH.wCur(p), s = LH.wSl(p);
    if (cur === 'PISTOL') { p.ammo = Infinity; p.dual = false; return; }
    const i = s.indexOf(cur); delete LH.wInv(p)[cur]; if (i >= 0) s[i] = null;
    LH.wFix(p);
    const other = s.find(k => k && LH.wHas(p, k));
    if (other) LH.wLoad(p, other);
    else {                                                          // sin armas: vuelve la pistola a una ranura libre
        const j = s.indexOf(null); s[j >= 0 ? j : 0] = 'PISTOL'; LH.wInv(p).PISTOL = { ammo: Infinity, dual: false };
        LH.wLoad(p, 'PISTOL');
    }
    if (G.state === 'PLAYING') audio.playEmpty();
    G.spawnText(p.x, p.y - 52, 'SIN MUNICIÓN', C.red);
};
LH.wAmt = (k) => k === 'SHOTGUN' ? 25 : k === 'KATANA' ? 50 : k === 'RAILGUN' ? 8 : 150;     // munición de un arma nueva del suelo

{
    const _eq = Player.prototype.equip;
    Player.prototype.equip = function (key, amount) {
        const W = WEAPONS[key];
        if (!W || EXTRA_PK[key]) return _eq.call(this, key, amount);
        const G = engine, inv = LH.wInv(this), R = LH._restore; LH._restore = null;
        if (key === 'PISTOL') { LH.wRunOut(this); return; }       // «sin munición»

        LH.wStash(this); LH.wFix(this);
        const cur = LH.wCur(this), s = LH.wSl(this), had = LH.wHas(this, key);
        if (!had && !s.includes(null)) { const i = s.indexOf(cur); delete inv[cur]; s[i >= 0 ? i : 0] = null; }   // sin hueco (el suelo ya lo impide): sustituye a la activa
        if (had && cur !== key) {                                  // la misma que llevas en la otra mano: suma munición sin cambiar de arma
            LH.wLoad(this, key, true);
            const dual0 = this.dual, st = G.spawnText; G.spawnText = () => {};
            try { _eq.call(this, key, amount); } finally { G.spawnText = st; }
            LH.wStash(this);
            const dualNow = this.dual;
            LH.wLoad(this, cur, true);
            G.spawnText(this.x, this.y - 30, '+' + W.name, W.color);
            if (dualNow && !dual0 && W.canDual) G.spawnText(this.x, this.y - 52, '¡DOBLE ' + W.name + '!', W.color);
            return;
        }
        if (!had) this.prevW = cur;
        _eq.call(this, key, amount);                               // arma nueva (a la mano) o la misma que ya tenías en la mano (se suma)
        if (!had && R) { this.ammo = R.ammo; this.dual = !!R.dual; }   // arma soltada: recupera su munición exacta
        LH.wStash(this);
    };

    // armas del suelo: duran más
    const _pk = Pickup.prototype.update;
    Pickup.prototype.update = function (dt) {
        if (!this._lf) { this._lf = 1; if (WEAPONS[this.itemType]) { const D = LH.DROPS; this.life = D ? (this.minRar >= 1 ? D.vidaPremium : D.vida) : this.life + 10; } }   // v2.5: botín normal dura menos
        return _pk.call(this, dt);
    };
}

// ---------------------------------------------------------------- suelo: ¿puedo recogerla? ¿cuál tengo cerca? intercambiar
LH.wBlocked = (p, pk) => {                                         // arma nueva con las dos ranuras ocupadas → no se recoge sola
    const k = pk && pk.itemType;
    if (!p || !k || !WEAPONS[k] || EXTRA_PK[k]) return false;
    LH.wStash(p); LH.wFix(p);
    const s = LH.wSl(p);
    return !s.includes(k) && s[0] && s[1] ? true : false;
};
LH.wNear = (p) => {                                                // arma del suelo (bloqueada) al alcance para intercambiar
    const G = engine; if (!G || !p || !G.pickups) return null;
    let best = null, bd = 1e9;
    for (const pk of G.pickups) {
        if (!WEAPONS[pk.itemType] || EXTRA_PK[pk.itemType] || !LH.wBlocked(p, pk)) continue;
        const d = dist(p.x, p.y, pk.x, pk.y);
        if (d < p.radius + (pk.hit || 14) + 46 && d < bd) { bd = d; best = pk; }
    }
    return best;
};
LH.wSwapFloor = (p) => {                                           // F: la de tu mano se queda en el suelo y coges la del suelo
    const G = engine; if (!G || !p || G.state !== 'PLAYING' || p.hp <= 0) return false;
    const pk = LH.wNear(p); if (!pk) return false;
    LH.wStash(p);
    const cur = LH.wCur(p), s = LH.wSl(p), inv = LH.wInv(p), o = inv[cur];
    if (cur !== 'PISTOL' && o && o.ammo > 0) {                      // soltar la tuya con su munición, rareza y mods (la pistola no se suelta)
        const d = new Pickup(p.x, p.y, cur);
        d.wd = o.wd || null; d.ammoLeft = o.ammo; d.dualLeft = !!o.dual; d.life = 30; d._lf = 1; d._gv = 1; d._own = 1;
        G.pickups.push(d);
    }
    const i = s.indexOf(cur); delete inv[cur]; if (i >= 0) s[i] = null;
    const idx = G.pickups.indexOf(pk); if (idx >= 0) G.pickups.splice(idx, 1);
    if (pk.ammoLeft !== undefined) LH._restore = { ammo: pk.ammoLeft, dual: !!pk.dualLeft };
    p.equip(pk.itemType, LH.wAmt(pk.itemType), pk.wd);
    LH._restore = null;
    audio.playPickup(); haptic(50);
    G.spawnParticle(p.x, p.y, pk.color, 20, 0, 0, 400);
    return true;
};

// ---------------------------------------------------------------- controles
window.addEventListener('keydown', (e) => {
    const G = engine; if (!G || !G.player || G.state !== 'PLAYING' || e.repeat) return;
    if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2') { const w = LH.wSlotKey(G.player, +k - 1); if (w) LH.wSwitch(G.player, w); }
    else if (k === 'q') LH.wCycle(G.player, -1);
    else if (k === 'e') LH.wCycle(G.player, 1);
    else if (k === 'f') LH.wSwapFloor(G.player);
});
window.addEventListener('wheel', (e) => {
    const G = engine; if (!G || !G.player || G.state !== 'PLAYING' || (e.target.closest && e.target.closest('#screens'))) return;
    if (Math.abs(e.deltaY) > 4) LH.wCycle(G.player, e.deltaY > 0 ? 1 : -1);
}, { passive: true });

LH.wPadPrev = [false, false];
LH.wPad = (p) => {                                                // mando: X (cambiar de mano) · Y (intercambiar con el suelo; si no hay, cambia de mano)
    const gp = LH.GP && LH.GP.pad; if (!gp) return;
    const now = [!!(gp.buttons[2] && gp.buttons[2].pressed), !!(gp.buttons[3] && gp.buttons[3].pressed)];
    if (now[0] && !LH.wPadPrev[0]) LH.wCycle(p, 1);
    if (now[1] && !LH.wPadPrev[1] && !LH.wSwapFloor(p)) LH.wCycle(p, 1);
    LH.wPadPrev = now;
};
{
    const _pp = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _pp.call(this, dt);
        if (this.state === 'PLAYING' && this.player) { LH.wPad(this.player); LH.wHud(this.player); }
    };
}
{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const t = document.createElement('div'); t.className = 'tip';
        t.innerHTML = '<b>ARMAS · DOS MANOS</b>Llevas como máximo dos armas: izquierda y derecha (se ven en el panel). Cambia de mano con 1 / 2, Q / E o la rueda del ratón; con mando X; en móvil toca la ranura. Con las dos manos ocupadas, acércate a un arma del suelo y pulsa F (mando Y, móvil CAMBIAR) para intercambiarla por la que llevas: la tuya queda en el suelo con su munición. Sin munición, esa ranura se vacía y pasas a la otra arma.';
        pane.appendChild(t);
    }
}

// ########## [armas3.js] ##########
// =====================================================================
//  v2.2 — RAREZA, CALIDAD Y MODIFICADORES DE ARMAS   (va justo antes de carga.js, después de armas2.js)
//
//  Cada arma que cae al suelo nace con una RAREZA y una CALIDAD:
//   · RAREZA  COMÚN · POCO COMÚN · RARO · ÉPICO · LEGENDARIO  → más daño, más munición y de 0 a 3 modificadores.
//   · CALIDAD 0-100 %  → tirada dentro de la rareza (±6 % de daño). Dos escopetas épicas no son iguales.
//   · MODIFICADORES  CRÍTICO (daño ×2) · PERFORANTE · REBOTE · INCENDIARIO · GÉLIDO · VAMPÍRICO · CARGADOR+ · VELOZ
//   · LEGENDARIO  tiene nombre propio (TRUENO, SENTENCIA…) y balas doradas.
//  Cuanto más avanzas, mejor suelta el botín. Los jefes y minijefes sueltan armas RARAS o mejores, las élites POCO COMUNES.
//  Si recoges un arma que ya tienes y la nueva es mejor, TU ARMA SE MEJORA (y suma la munición); si es peor, solo suma munición.
//  Las del suelo muestran su aura de color (y un haz de luz si son épicas o legendarias); acércate para ver sus modificadores.
// =====================================================================
LH.RAR = [
    { n: 'COMÚN', c: '#cfd6ff', dm: 1.00, m: 0 }, { n: 'POCO COMÚN', c: '#5dff7a', dm: 1.10, m: 1 },
    { n: 'RARO', c: '#4da6ff', dm: 1.22, m: 1 }, { n: 'ÉPICO', c: '#c05cff', dm: 1.38, m: 2 },
    { n: 'LEGENDARIO', c: '#ffb000', dm: 1.60, m: 3 }
];
LH.MODS = {
    crit: { n: 'CRÍTICO', d: 'Prob. de daño ×2' }, pierce: { n: 'PERFORANTE', d: 'Atraviesa enemigos', b: 1 }, bounce: { n: 'REBOTE', d: 'Rebota en paredes', b: 1 },
    fire: { n: 'INCENDIARIO', d: 'Quema al golpear' }, frost: { n: 'GÉLIDO', d: 'Ralentiza' }, vamp: { n: 'VAMPÍRICO', d: 'Cura al matar' },
    clip: { n: 'CARGADOR+', d: 'Más munición' }, haste: { n: 'VELOZ', d: 'Dispara más rápido' }
};
LH.LEG = { PISTOL: 'COLMILLO', SHOTGUN: 'TRUENO', MINIGUN: 'TORMENTA', KATANA: 'AMANECER', RAILGUN: 'SENTENCIA', LASER: 'AURORA', ROCKET: 'COMETA', ARC: 'RELÁMPAGO', AKIMBO: 'GEMELAS' };

LH.rollRar = (min = 0) => {
    const L = Math.min(1, (engine ? engine.wave : 1) / 30);
    if (min >= 3) return Math.random() < 0.22 + 0.3 * L ? 4 : 3;
    const w = [60 - 30 * L, 26 + 4 * L, 10 + 14 * L, 3.5 + 12 * L, 0.5 + 5 * L];
    let x = Math.random() * w.reduce((a, b) => a + b, 0), r = 0;
    while (r < 4 && x >= w[r]) x -= w[r++];
    return Math.max(min, r);
};
LH.rollMods = (key, rar) => {
    const W = WEAPONS[key], bul = W.type === 'single' || W.type === 'spread';
    const pool = Object.keys(LH.MODS).filter(m => !LH.MODS[m].b || bul);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, LH.RAR[rar].m);
};
LH.wStats = (rar, q, mods) => {
    const st = { dm: LH.RAR[rar].dm * (0.94 + 0.12 * q), rate: 1, crit: 0, pierce: 0, bounce: 0, burn: 0, frost: 0, vamp: 0, clip: 1 + 0.1 * rar };
    for (const m of mods) {
        if (m === 'crit') st.crit = 0.12 + 0.05 * rar; else if (m === 'pierce') st.pierce = rar >= 3 ? 2 : 1;
        else if (m === 'bounce') st.bounce = rar >= 4 ? 2 : 1; else if (m === 'fire') st.burn = 1 + 0.6 * rar;
        else if (m === 'frost') st.frost = 1; else if (m === 'vamp') st.vamp = rar >= 3 ? 2 : 1;
        else if (m === 'clip') st.clip *= 1.3 + 0.05 * rar; else if (m === 'haste') st.rate = 0.88 - 0.03 * rar;
    }
    return st;
};
LH.wMake = (key, rar, q) => { q = q === undefined ? Math.random() : q; const mods = LH.rollMods(key, rar); return { rar, q, mods, st: LH.wStats(rar, q, mods) }; };
LH.wScore = (w) => w.rar * 100 + Math.round(w.q * 99);
LH.wData = (p, k) => { const e = p.inv && p.inv[k || LH.wCur(p)]; return e && e.wd || null; };
LH.wTitle = (key, wd) => (wd && wd.rar === 4 && LH.LEG[key]) || WEAPONS[key].name;

// ---------------------------------------------------------------- guardar la rareza en el inventario

{
    const _eq = Player.prototype.equip;
    Player.prototype.equip = function (key, amount, wd) {
        const W = WEAPONS[key];
        if (!W || EXTRA_PK[key] || key === 'PISTOL') return _eq.call(this, key, amount);
        const G = engine, inv = LH.wInv(this);
        wd = wd || LH.wMake(key, LH.rollRar());
        const old = LH.wHas(this, key) ? inv[key].wd : null;
        const keep = old && LH.wScore(old) >= LH.wScore(wd) ? old : wd, up = !!old && keep === wd;
        if (isFinite(amount)) amount = Math.round(amount * keep.st.clip);
        _eq.call(this, key, amount);
        (inv[key] || (inv[key] = {})).wd = keep;
        const R = LH.RAR[keep.rar];
        if (up) G.spawnText(this.x, this.y - 64, '¡MEJORADA! [' + R.n + ']', R.c);
        else if (!old && keep.rar > 0) G.spawnText(this.x, this.y - 64, '[' + R.n + '] CAL ' + Math.round(keep.q * 100) + '%', R.c);
        if (keep.rar >= 3 && !old && G.state === 'PLAYING') audio.playElite();
    };
}

// ---------------------------------------------------------------- efectos al disparar y al golpear
LH._ctx = null;
{
    const _sh = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        const wd0 = LH.wData(this), st = wd0 && wd0.st, key0 = LH.wCur(this);
        if (!st) return _sh.call(this);
        const G = engine, nb = G.bullets.length, nr = G.rockets ? G.rockets.length : 0;
        const ctx = (crit) => ({ dm: st.dm * (crit ? 2 : 1), burn: st.burn, frost: st.frost, vamp: st.vamp, crit });
        LH._ctx = ctx(st.crit && Math.random() < st.crit);            // golpes instantáneos (katana, railgun, láser)
        try { _sh.call(this); } finally { LH._ctx = null; }
        if (LH.wCur(this) !== key0) return;                            // se acabó la munición a media acción y volvió otra arma: nada que decorar
        const col = st.burn ? '#ff7a1a' : st.frost ? '#7df9ff' : wd0.rar === 4 ? '#ffd23f' : null;
        for (let i = nb; i < G.bullets.length; i++) {
            const b = G.bullets[i]; if (b.isEnemy) continue;
            b.qc = ctx(st.crit && Math.random() < st.crit); b.qc.b = 1;
            if (st.pierce) b.pierce = (b.pierce || 0) + st.pierce;
            if (st.bounce) b.bounce = (b.bounce || 0) + st.bounce;
            if (col) { b.color = col; b.gk = col + b.radius; }
        }
        if (G.rockets) for (let i = nr; i < G.rockets.length; i++) G.rockets[i].qc = ctx(st.crit && Math.random() < st.crit);
        if (this.fireCooldown > 0) this.fireCooldown *= st.rate;
    };
    const _bf = bulletFalloff;
    bulletFalloff = function (b) {                                    // se llama justo antes de golpear: deja listo el contexto de la bala
        if (b.qc) LH._ctx = b.qc; else if (LH._ctx && LH._ctx.b) LH._ctx = null;
        return _bf(b);
    };
    const _he = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const c = LH._ctx; if (c && c.b) LH._ctx = null;
        const alive = !en.dead;
        if (c) dmg *= c.dm;
        _he.call(this, en, dmg, fx, fy, melee);
        if (c && alive) {
            if (c.crit && this.time - (LH._ct || -9) > 0.12) { LH._ct = this.time; this.spawnText(en.x, en.y - en.radius - 10, '¡CRIT!', '#ffe14d'); }
            if (en.dead) {
                if (c.vamp && this.player && this.player.hp > 0) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + c.vamp); this.spawnParticle(this.player.x, this.player.y, C.green, 6, 0, -40, 160); }
            } else {
                if (c.burn) { en.burnT = 2.5; en.burnD = Math.max(en.burnD || 0, c.burn); }
                if (c.frost && !en.boss) en.frostT = 1.6;
            }
        }
    };
    const _pp = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _pp.call(this, dt);
        if (LH._ctx && LH._ctx.b) LH._ctx = null;
        if (this.state !== 'PLAYING' || this.hitStop > 0) return;
        for (const en of this.enemies) {
            if (en.dead) continue;
            if (en.burnT > 0) {                                       // quemadura: daño continuo sin cortar el empuje del enemigo
                en.burnT -= dt; en.hp -= en.burnD * dt;
                if ((en._bp = (en._bp || 0) - dt) <= 0) { en._bp = 0.18; this.spawnParticle(en.x + (Math.random() - 0.5) * en.radius, en.y + (Math.random() - 0.5) * en.radius, '#ff7a1a', 2, 0, -40, 220); }
                if (en.hp <= 0) this.hitEnemy(en, 0, 0, 0);
            }
            if (en.frostT > 0) {                                      // hielo: mitad de velocidad
                en.frostT -= dt; if (!en._sp0) en._sp0 = en.speed; en.speed = en._sp0 * 0.5;
                if (en.frostT <= 0) { en.speed = en._sp0; en._sp0 = 0; }
            }
        }
    };
}

// ---------------------------------------------------------------- armas del suelo y botín
{
    const _pu = Pickup.prototype.update;
    Pickup.prototype.update = function (dt) {
        if (!this.wd && WEAPONS[this.itemType] && this.itemType !== 'PISTOL') this.wd = LH.wMake(this.itemType, LH.rollRar(this.minRar || 0));
        return _pu.call(this, dt);
    };
    const _pd = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        _pd.call(this, ctx);
        const wd = this.wd; if (!wd || (this.life < 3 && Math.floor(this.life * 10) % 2 === 0)) return;
        const R = LH.RAR[wd.rar], G = engine, t = G.time, y = this.y + this.floatY;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (wd.rar >= 3) {                                            // haz de luz
            const g = ctx.createLinearGradient(0, y - 180, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, R.c);
            ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 5); ctx.fillStyle = g; ctx.fillRect(this.x - 7, y - 180, 14, 180);
        }
        ctx.strokeStyle = R.c; ctx.lineWidth = 2; ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 6);
        ctx.beginPath(); ctx.arc(this.x, y, 22 + wd.rar * 2 + 2 * Math.sin(t * 6), 0, TAU); ctx.stroke();
        if (wd.rar >= 2) { ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(this.x, y, 32 + wd.rar * 2, 0, TAU); ctx.stroke(); }
        ctx.restore();
        const near = G.player && dist(this.x, this.y, G.player.x, G.player.y) < 190;
        if (wd.rar >= 1 || near) {
            ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 ' + Math.round(9 * textBoost()) + 'px Orbitron';
            ctx.fillStyle = R.c; ctx.fillText(LH.wTitle(this.itemType, wd) + ' · ' + R.n, this.x, y - 32);
            if (near) {
                ctx.font = '600 ' + Math.round(8 * textBoost()) + 'px Orbitron'; ctx.fillStyle = '#fff';
                ctx.fillText('CAL ' + Math.round(wd.q * 100) + '%' + (wd.mods.length ? ' · ' + wd.mods.map(m => LH.MODS[m].n).join(' · ') : ''), this.x, y - 43);
            }
            ctx.restore();
        }
    };
    const _sw = GameEngine.prototype.startWave;
    GameEngine.prototype.startWave = function () {
        _sw.call(this);
        if (this.wave % 5 === 0) for (const p of this.pickups) if (!p.wd && WEAPONS[p.itemType]) p.minRar = 2;     // armas del jefe: raras o mejores
    };
    const _he2 = GameEngine.prototype.hitEnemy;
    GameEngine.prototype.hitEnemy = function (en, dmg, fx, fy, melee) {
        const alive = !en.dead;
        _he2.call(this, en, dmg, fx, fy, melee);
        if (!alive || !en.dead) return;
        const min = en.boss ? 3 : (en.mini || en.type === 4 || en.type === 1) ? 2 : en.elite ? 1 : 0;
        if (min && Math.random() < (en.boss ? 1 : en.elite ? 0.5 : 0.45)) {
            const pool = ['SHOTGUN', 'MINIGUN', 'KATANA', 'RAILGUN', 'ROCKET', 'LASER', 'ARC', 'AKIMBO'].filter(k => WEAPONS[k]);
            const pk = new Pickup(en.x + (Math.random() - 0.5) * 40, en.y + (Math.random() - 0.5) * 40, pool[Math.floor(Math.random() * pool.length)]);
            pk.minRar = min; this.pickups.push(pk);
        }
    };
}

// ---------------------------------------------------------------- HUD: arma en mano + las dos ranuras (izquierda / derecha)
LH.wLabel = (p) => (p.dual ? '2× ' : '') + LH.wTitle(LH.wCur(p), LH.wData(p));
LH.wHud = (p) => {
    const box = document.querySelector('.weapon-info'); if (!box) return;
    let bar = document.getElementById('wslots'), mods = document.getElementById('wmods');
    if (!bar) {
        mods = document.createElement('div'); mods.id = 'wmods'; box.appendChild(mods);
        bar = document.createElement('div'); bar.id = 'wslots'; box.appendChild(bar);
        for (const ev of ['mousedown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
        box.addEventListener('pointerdown', (e) => {
            const c = e.target.closest && e.target.closest('[data-w]');
            if (engine && engine.player) { if (c) LH.wSwitch(engine.player, c.dataset.w); else LH.wCycle(engine.player, 1); }
        });
    }
    LH.wOwned(p);
    const s = LH.wSl(p), cur = LH.wCur(p), wd = LH.wData(p);
    const near = LH.wNear(p); LH._near = near;                                   // arma del suelo que puedes intercambiar
    LH.wSwapBtn(!!near);
    const rc = (k) => { const d = LH.wData(p, k); return LH.RAR[d ? d.rar : 0].c; };
    const am = (k) => { const a = p.inv[k].ammo; return a === Infinity ? '∞' : a; };
    const sig = cur + '|' + (wd ? wd.rar + ':' + Math.round(wd.q * 100) + ':' + wd.mods.join('') : '-') + '|' + s.map(k => k ? k + ':' + am(k) + ':' + (LH.wData(p, k) ? LH.wData(p, k).rar : 0) + ':' + (p.inv[k].dual ? 2 : 1) : '-').join(',');
    if (bar._s === sig) return; bar._s = sig;
    const R = LH.RAR[wd ? wd.rar : 0];
    box.style.setProperty('--wc', R.c);
    const nm = document.getElementById('weaponName'); if (nm) nm.style.color = R.c;
    mods.innerHTML = wd && wd.rar > 0 ? '<b style="color:' + R.c + '">' + R.n + '</b> · CAL ' + Math.round(wd.q * 100) + '%' + (wd.mods.length ? '<br>' + wd.mods.map(m => LH.MODS[m].n).join(' · ') : '') : '';
    mods.style.display = mods.innerHTML ? '' : 'none';
    bar.style.display = '';
    bar.innerHTML = [0, 1].map(i => {
        const k = s[i], lab = i ? 'DER' : 'IZQ';
        if (!k || !p.inv[k]) return '<div class="wslot empty"><em>' + lab + '</em><u>—</u></div>';
        return '<div class="wslot' + (k === cur ? ' on' : '') + '" data-w="' + k + '" style="--c:' + rc(k) + '"><em>' + lab + '</em><canvas data-k="' + k + '"></canvas><i>' + (p.inv[k].dual ? '2×' : '') + am(k) + '</i></div>';
    }).join('');
    for (const cv of bar.querySelectorAll('canvas[data-k]')) {                  // icono pixel art de cada ranura (escala entera)
        const sp = LH.pixSprite(cv.dataset.k); if (!sp) continue;
        cv.width = sp.width; cv.height = sp.height; cv.style.width = sp.width * 2 + 'px';
        const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(sp, 0, 0);
    }
};
LH.wSwapBtn = (show) => {                                                       // botón CAMBIAR (solo táctil, solo con un arma del suelo cerca)
    let b = document.getElementById('swapBtn');
    if (!b) {
        b = document.createElement('button'); b.id = 'swapBtn'; b.className = 'swap-btn'; b.type = 'button'; b.innerHTML = '<span>CAMBIAR<br>ARMA</span>';
        const go = (e) => { e.preventDefault(); e.stopPropagation(); if (engine && engine.player) LH.wSwapFloor(engine.player); };
        b.addEventListener('pointerdown', go); b.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        (document.getElementById('uiLayer') || document.body).appendChild(b);
    }
    b.classList.toggle('on', show);
};

{
    const pane = document.querySelector('#pControls [data-pane="tips"]');
    if (pane) {
        const t = document.createElement('div'); t.className = 'tip';
        t.innerHTML = '<b>RAREZA Y CALIDAD</b>Las armas del suelo brillan según su rareza: gris COMÚN, verde POCO COMÚN, azul RARO, morado ÉPICO y dorado LEGENDARIO (con haz de luz). Acércate para ver su calidad y sus modificadores. Si recoges una que ya tienes y es mejor, tu arma se mejora. Jefes y minijefes sueltan armas raras o mejores.';
        pane.appendChild(t);
    }
}

// ---------------------------------------------------------------- aviso «[F] CAMBIAR» sobre el arma del suelo, imán desactivado y arma de reserva a la espalda
{
    const _pd2 = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        _pd2.call(this, ctx);
        if (LH._near !== this || !WEAPONS[this.itemType]) return;
        const G = engine, y = this.y + this.floatY, touch = document.body.classList.contains('touch');
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 ' + Math.round(10 * textBoost()) + 'px Orbitron';
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 8); ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
        ctx.fillText(touch ? 'TOCA CAMBIAR' : '[F] CAMBIAR', this.x, y + 40);
        ctx.restore();
    };
    const _pu2 = Pickup.prototype.update;
    Pickup.prototype.update = function (dt) {                                   // si no la puedes recoger, el imán no la arrastra hacia ti
        const x = this.x, y = this.y, r = _pu2.call(this, dt), p = engine && engine.player;
        if (p && WEAPONS[this.itemType] && LH.wBlocked(p, this)) { this.x = x; this.y = y; }
        return r;
    };
    const _hd = Player.prototype.draw;
    Player.prototype.draw = function (ctx) {                                    // el arma de la otra mano, colgada cruzada a la espalda
        const r = _hd.call(this, ctx);
        const s = this.slots, cur = LH.wCur(this);
        const other = s && (s[0] === cur ? s[1] : s[0]);
        if (other && other !== cur && this.inv && this.inv[other] && this.hp > 0) {
            const sp = LH.pixSprite(other);
            if (sp) {
                const sc = sp.width > 18 ? 1.5 : 2;
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
                ctx.translate(-10, 0); ctx.rotate(Math.PI / 2 + 0.45);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
                ctx.restore();
            }
        }
        return r;
    };
}

// =====================================================================
//  v2.5 — EQUILIBRIO DE ARMAS EN EL SUELO (regulador de botín)
//
//  PROBLEMA: salían demasiadas armas y se quedaban mucho tiempo. Cada kill podía soltar arma (10 %, y el tanque 80 % + 45 % extra),
//  más 60 % al limpiar la oleada, más élites y minijefes. Con ~40 enemigos por oleada había 4-6 armas a la vez y duraban 22 s (más aún
//  con las dos ranuras llenas, que no deja recogerlas).
//
//  SOLUCIÓN: cada arma NUEVA que aparece pasa por este regulador (las que sueltas tú con F no). Hay dos clases:
//   · PREMIUM (jefes, minijefes, tanques, élites con rareza, armas de inicio de jefe): casi siempre se quedan y duran lo de siempre (22 s).
//   · NORMAL (kills y fin de oleada): se aceptan solo si hay hueco en el suelo (tope), ha pasado la espera desde la última y sale la
//     probabilidad. Si no, desaparecen sin efectos. Duran 14 s. Con las dos ranuras llenas (no puedes recogerla) se aceptan la mitad.
//  La salud, escudos, imanes, etc. NO se tocan. Para ajustar el juego edita solo la tabla de abajo.
//  Consola:  LH.DROPS  (editable en vivo)  ·  LH.dropsInfo()  → armas en el suelo ahora
// =====================================================================
LH.DROPS = {
    maxSuelo: 2,            // armas normales a la vez en el suelo (sin contar las que sueltas tú)
    maxPremium: 1,          // huecos extra que solo ocupan las armas premium (tope total = maxSuelo + maxPremium)
    espera: 14,             // segundos mínimos entre dos armas normales aceptadas
    prob: 0.6,              // probabilidad de aceptar una normal cuando hay hueco y ya pasó la espera
    probBloqueada: 0.5,     // factor extra si ya tienes 2 armas y esta no se podría recoger sola
    vida: 14,               // segundos que dura una arma normal en el suelo (antes 22)
    vidaPremium: 22         // segundos que dura una premium (como antes)
};
LH.dropsInfo = () => {
    const G = engine; if (!G) return null;
    const l = G.pickups.filter(p => WEAPONS[p.itemType] && !EXTRA_PK[p.itemType]).map(p => p.itemType + (p.minRar >= 1 ? '★' : '') + ' ' + Math.max(0, p.life).toFixed(1) + 's');
    return { enSuelo: l, ...LH.DROPS };
};
{
    const isW = (p) => WEAPONS[p.itemType] && !EXTRA_PK[p.itemType] && p.itemType !== 'PISTOL';
    const _pp = GameEngine.prototype.postUpdate;
    GameEngine.prototype.postUpdate = function (dt) {
        _pp.call(this, dt);
        const D = LH.DROPS, P = this.pickups;
        if (!D || !P || this.state !== 'PLAYING' || (LH.prep && LH.prep.busy)) return;
        if (this._gvArr !== P) { this._gvArr = P; this._gvT = D.espera; }      // partida nueva: lista nueva → primera arma sin espera
        this._gvT += dt;
        let hayNuevas = false;
        for (let i = 0; i < P.length; i++) if (!P[i]._gv && isW(P[i])) { hayNuevas = true; break; }
        if (!hayNuevas) return;
        const vivas = () => P.filter(p => isW(p) && p._gv && !p._own && p.life > 0);
        const quitar = (p) => { p.life = 0; const k = P.indexOf(p); if (k >= 0) P.splice(k, 1); };   // life 0: así no sale el confeti de «recogido»
        for (const pk of P.slice()) {
            if (pk._gv || !isW(pk)) continue;
            pk._gv = 1;
            const prem = pk.minRar >= 1, cur = vivas().filter(p => p !== pk);
            if (prem) {
                if (cur.length >= D.maxSuelo + D.maxPremium) {                   // sin hueco: la premium echa a la normal más antigua (o se pierde si todas son premium)
                    const vieja = cur.filter(p => !(p.minRar >= 1)).sort((a, b) => a.life - b.life)[0];
                    if (vieja) quitar(vieja); else quitar(pk);
                }
                continue;
            }
            const normales = cur.filter(p => !(p.minRar >= 1)).length;
            let ok = normales < D.maxSuelo && this._gvT >= D.espera;
            if (ok) {
                let pr = D.prob; if (LH.wBlocked && this.player && LH.wBlocked(this.player, pk)) pr *= D.probBloqueada;
                ok = Math.random() < pr;
            }
            if (ok) this._gvT = 0; else quitar(pk);
        }
    };
}
