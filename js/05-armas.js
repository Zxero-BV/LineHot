// ########## [armas.js] ##########
// ---------------------------------------------------------------- ARMAS EN PIXEL ART + ARMAS DOBLES
// · Cada arma tiene un sprite pixel art (se ve en tu mano y en el HUD). 'a'/'A' = color del arma.
// · Armas dobles: recoge OTRA VEZ la misma arma (escopeta, minigun, katana, láser, arco) o la nueva AKIMBO (2 pistolas).
//   Disparan a la vez (munición: 1 por andanada, cadencia −20 %). Katanas dobles: cortan por delante Y por detrás.
WEAPONS.AKIMBO = { name: 'AKIMBO', fireRate: 0.15, spread: 0.07, speed: 1200, color: '#ff9f1c', damage: 1, type: 'single', recoil: 5, g: 'D', dual: true };
DROP_POOL.push('AKIMBO');
for (const k of ['SHOTGUN', 'MINIGUN', 'KATANA', 'LASER', 'ARC']) WEAPONS[k].canDual = true;
LH.PIX = {
    PISTOL: ['..............', '.kkkkkkkkkkk..', '.kwwwwwwwwwwk.', '.kggggggggAak.', '.kkkkkkgkkkkk.', '.....kdgk.....', '.....kdgk.....', '......kk......'],
    AKIMBO: ['..............', '.kkkkkkkkkkk..', '.kwwwwwwwwwwk.', '.kggggggggAak.', '.kkkkkkgkkkkk.', '.....kdgk.....', '.....kdgk.....', '......kk......'],
    SHOTGUN: ['....................', '..kkkkkkkkkkkkkkkk..', '.kbbbkkwwwwwwwwwwwwk', '.kbbbbkggggggggggaak', 'kbbbbbkkkkkkkkkkkkk.', '.kbbbk.kdddk........', '..kbk...kkk.........'],
    MINIGUN: ['....................', '.......kkkkkkkkkkkk.', '..kkkk.kgggggggggAak', '.kdddkkkwwwwwwwwwwak', '.kdaakkkgggggggggAak', '.kdddk.kkkkkkkkkkkk.', '..kdk..kdk..........', '..kdk...kk..........'],
    KATANA: ['....................', '.........k..........', '.kbkbkbkkAkkkkkkkkkk.', '.kbbbbbbaAwwwwwwwwwwk', '.kbkbkbkkAkgggggggkk.', '.........k...kkkkk...'],
    RAILGUN: ['......................', '..kkkkkkkkkkkkkkkkkkk.', '.kddkAkAkAkAkAkwwwwwwk', '.kddkaAaAaAaAaAggggggAk'.slice(0, 22), '.kkkkkkkkkkkkkkkkkkkk.', '..kdk.kdk.............', '..kdk..kk.............'],
    LASER: ['................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kggddddddgAAak.', '.kkkkkkkkkkkaak.', '....kdgk..kkk...', '....kdgk........', '.....kk.........'],
    ROCKET: ['......................', '.....kkkkkkkkkkkkkoo..', '..kkkkgggggggggggkroor', '.kdddkwwwwwwwwwwwkrooy'.slice(0, 22), '.kdaakggggggggggkkroor'.slice(0, 22), '..kdkkkkkkkkkkkkkkoo..', '..kdk.................', '...kk.................'],
    ARC: ['..............', '..aa......aa..', '.aAAa.kk.aAAa.', '..aakkkkkkaa..', '...kwwwwwwk...', '...kgAAAAgk...', '...kkkkkkkk...', '....kdddk.....', '....kdddk.....', '.....kkk......']
};
LH.pixCache = {};
LH.pixSprite = (key) => {                                  // devuelve un canvas 1 px = 1 pixel del sprite
    const w = WEAPONS[key]; if (!w) return null;
    const base = key === 'AKIMBO' ? 'PISTOL' : key, rows = LH.PIX[key] || LH.PIX[base], ck = key + w.color;
    if (LH.pixCache[ck]) return LH.pixCache[ck];
    const W = Math.max(...rows.map(r => r.length)), cv = document.createElement('canvas'); cv.width = W; cv.height = rows.length;
    const c = cv.getContext('2d'), pal = { k: '#120d1f', w: '#e9edff', g: '#8b91ab', d: '#4b4f69', b: '#8a5230', a: w.color, A: '#ffffff', o: '#ff9a3c', r: '#ff3355', y: '#ffe600' };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; c.fillStyle = ch === 'A' ? LH.mix(w.color) : pal[ch]; c.fillRect(x, y, 1, 1); } });
    return (LH.pixCache[ck] = cv);
};
LH.mix = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v + (255 - v) * 0.55); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
// arma en la mano (se dibuja sobre la nave, mirando hacia donde apuntas)
{
    const _p_draw = Player.prototype.draw;
    Player.prototype.draw = function (ctx) {
        _p_draw.call(this, ctx);
        const sp = LH.pixSprite(Object.keys(WEAPONS).find(k => WEAPONS[k] === this.weapon));
        if (!sp) return;
        const S = 2, kick = ((this.flashT || 0) - engine.time) > 0 ? -2 : 0, ang = this.angle, left = Math.cos(ang) < 0;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(ang); if (left) ctx.scale(1, -1);
        if (this.weapon.type === 'melee' && this.katanaSwingTime > 0) ctx.rotate(-1.1 + (1 - this.katanaSwingTime / 0.2) * 2.2);
        ctx.imageSmoothingEnabled = false;
        const ys = this.dual ? [-9, 9] : [0];
        for (const oy of ys) ctx.drawImage(sp, -4 + kick, oy - sp.height * S / 2, sp.width * S, sp.height * S);
        if (this.dual && this.weapon.type === 'melee') { ctx.rotate(Math.PI); ctx.drawImage(sp, -4, -sp.height * S / 2, sp.width * S, sp.height * S); }
        ctx.restore();
    };
}
// equipar: misma arma otra vez = dobles; AKIMBO = dobles de serie
{
    const _p_equip = Player.prototype.equip;
    Player.prototype.equip = function (key, amount) {
        const W = WEAPONS[key];
        if (!W || EXTRA_PK[key]) return _p_equip.call(this, key, amount);
        if (key === 'AKIMBO' && amount !== Infinity) amount = 120;
        const same = this.weapon === W && W.canDual && isFinite(this.ammo) && isFinite(amount), prev = this.ammo;
        const r = _p_equip.call(this, key, amount);
        if (same) {
            this.ammo = Math.min(prev + this.ammo, Math.round(this.ammo * 2.2));
            if (!this.dual) engine.spawnText(this.x, this.y - 52, '¡DOBLE ' + W.name + '!', W.color);
            this.dual = true;
        } else this.dual = !!W.dual;
        return r;
    };
    const _p_shoot = Player.prototype.shoot;
    Player.prototype.shoot = function () {
        if (!this.dual || this.ammo <= 0 || this.weapon.type === 'rail' || this.weapon.type === 'rocket') return _p_shoot.call(this);
        const x0 = this.x, y0 = this.y, a0 = this.angle, w = this.weapon, melee = w.type === 'melee', fin = isFinite(this.ammo);
        const nx = -Math.sin(a0) * 9, ny = Math.cos(a0) * 9;
        if (!melee) { this.x = x0 + nx; this.y = y0 + ny; }
        _p_shoot.call(this);
        if (this.weapon !== w) { this.x = x0; this.y = y0; this.angle = a0; return; }   // se acabó la munición a media andanada
        if (!melee) { this.x = x0 - nx; this.y = y0 - ny; } else this.angle = a0 + Math.PI;
        if (fin) this.ammo += 1;                                  // las dos armas gastan solo 1 de munición por andanada
        _p_shoot.call(this);
        this.x = x0; this.y = y0; this.angle = a0;
        this.fireCooldown *= 1.2;
    };
}
// HUD: icono pixel art + nombre (con ×2 si son dobles)
LH.wKey = (p) => Object.keys(WEAPONS).find(k => WEAPONS[k] === p.weapon);
LH.wLabel = (p) => (p.dual ? '2× ' : '') + p.weapon.name;
LH.paintWeaponIcon = (p) => {
    const cv = document.getElementById('weaponIcon'); if (!cv) return;
    const key = LH.wKey(p) + (p.dual ? '2' : '');
    if (cv._k === key) return; cv._k = key;
    const sp = LH.pixSprite(LH.wKey(p)); if (!sp) return;
    const n = p.dual ? 2 : 1, gap = 2, c = cv.getContext('2d');
    cv.width = sp.width; cv.height = sp.height * n + gap * (n - 1);
    c.imageSmoothingEnabled = false; c.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < n; i++) c.drawImage(sp, 0, i * (sp.height + gap));
    const sc = (document.body.classList.contains('touch') || sp.width > 20) ? 2 : 3;      // escala ENTERA: todos los píxeles del mismo tamaño
    cv.style.width = sp.width * sc + 'px'; cv.style.filter = 'none';
    const box = cv.closest('.weapon-info'); if (box) box.style.setProperty('--wc', p.weapon.color);   // marco del panel con el color del arma
};

