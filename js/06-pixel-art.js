// ########## [pixel.js] ##########
// ---------------------------------------------------------------- PIXEL ART v2 (armas, enemigos y objetos)
// · Armas: sprites de hasta 24×12 con contorno, 4 tonos de metal/madera, brillos y detalles. 'a' 'A' 'q' = acento del arma.
// · Enemigos: se generan por código a resolución de píxel (≈2.4 px de mundo por píxel): contorno neón, núcleo oscuro
//   teñido con 3 bandas + tramado, anillo interior de luz y detalles. Mismo resplandor y mismos tamaños que antes.
// · Objetos: las armas del suelo se ven con su pixel art. Todo se cachea en Spr (cero coste extra por fotograma).
Object.assign(LH.PIX, {
    PISTOL: ['....k..........k...', '...kkkkkkkkkkkkkkk.', '..khhhhwwwwwwwwwwk.', '..kwwwwwwwwwwggggk.', '..kggddwwwwggAAAak.', '..kkkkkkkkkkkkkkkk.', '..kdddsssdk........', '..kkkkkdsk.........', '......kbbBk........', '......kbBBk........', '......kkkkk........'],
    SHOTGUN: ['.......kkkkkkkkkkkkkkkkk', 'kkkkkkkkhhhhhhhhhhhhhhak', 'kbbbbbbkwwwwwwwwwwwwwAak', 'kbhbbbBkggggggggggggaaak', 'kbbbBBBkkkkkkkkkkkkkkkk.', 'kbbBBBkkdddsskBBBBk.....', '.kBBBkk.kkkkkkBBBBk.....', '..kkk.........kkkk......'],
    MINIGUN: ['......kkkkkkkkkkkkkkkk', '.kkkk.khhwwwwwwwwwwwak', 'kdddskkkwgwgwgwgwgwAak', 'kdAAdkkkgdgdgdgdgdgaak', 'kdaadkkkwgwgwgwgwgwAak', 'kdddskkkkkkkkkkkkkkkk.', '.kdskk.kddk...........', '..kdk..kddk...........', '...kk...kk............'],
    KATANA: ['....................', '..........kk..........', '.kbkbkbkkkAAkkkkkkkkkkk', '.kBbBbBkAaAhhhhhhhwwwwwk', '.kbkbkbkkaAwwwwwwggggggk', '..........kkkkkkkkkkkkk.'],
    RAILGUN: ['.......................', '..kkkkkkkkkkkkkkkkkkkkk', '.khhhkAkAkAkAkAkwwwwwwwk', 'kddAdkaAaAaAaAaAggggggAk', 'kddddkkkkkkkkkkkkkkkkkk.', '.kdsk.kddk.............', '..kdk..kk..............'],
    LASER: ['................', '...kkkkkkkkkkk..', '..khhhhhhhhhhhkk', '..kwwwwwwwwwwwwAk', '..kggAAAAAAAggak', '..kkkkkkkkkkkkkk', '.....kdgk.kk....', '.....kdgk.......', '......kk........'],
    ROCKET: ['.....................', '.....kkkkkkkkkkkkkoo.', '..kkkkhhhhhhhhhhhkroor', '.kdddkwwwwwwwwwwwkrooyk', '.kdAakggggggggggkkroor.', '..kdkkkkkkkkkkkkkkoo..', '..kdk.kddk............', '...kk..kk.............'],
    ARC: ['.............kkkkkkkkkk.', '.kkkkkkkkkkkkaAAAAAAAAak', 'khhwwwwwwwwwwkkkkkkkkkk.', 'kwwAAAAAAAwwwwwAaAaAaAa.', 'kggAhhhhAgggggkkkkkkkkk.', 'kkkkkkkkkkkkkaAAAAAAAAak', '.kdddsk......kkkkkkkkkk.', '.kdddsk.................', '..kkkk..................']
});
LH.PIX.AKIMBO = LH.PIX.PISTOL;
LH.pixCache = {};
LH.shade = (hex, k) => {                                    // k<1 oscurece, k>1 aclara
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
LH.pixSprite = (key) => {
    const w = WEAPONS[key]; if (!w) return null;
    const rows = LH.PIX[key]; if (!rows) return null;
    const ck = key + w.color; if (LH.pixCache[ck]) return LH.pixCache[ck];
    const W = Math.max(...rows.map(r => r.length)), cv = document.createElement('canvas'); cv.width = W; cv.height = rows.length;
    const c = cv.getContext('2d'), pal = {
        k: '#0a0614', h: '#ffffff', w: '#dfe6ff', g: '#8f97b8', d: '#555b7c', s: '#2b2f4a', b: '#a8652f', B: '#5c3519',
        a: w.color, A: LH.shade(w.color, 1.6), q: LH.shade(w.color, 0.5), o: '#ff9a3c', r: '#ff3355', y: '#ffe600'
    };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.') { c.fillStyle = pal[ch] || '#f0f'; c.fillRect(x, y, 1, 1); } } });
    return (LH.pixCache[ck] = cv);
};
LH.pxRGB = {};
LH.rgb = (col) => {
    if (LH.pxRGB[col]) return LH.pxRGB[col];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return (LH.pxRGB[col] = [d[0], d[1], d[2]]);
};
LH.tone = (a, k) => { const f = (v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))); return `rgb(${f(a[0])},${f(a[1])},${f(a[2])})`; };
// Genera un cuerpo pixel art n×n. shape(u,v) <= 1 dentro; deco(u,v) devuelve una clave de color o null.
LH.pixBody = (n, color, flash, shape, deco) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), a = LH.rgb(color);
    const P = { w: '#ffffff', r: '#ff2d3d', y: '#ffe600', o: '#ff9a3c', D: '#07020d', m: '#a7aed0', L: LH.tone(a, 1.55) };
    const inn = (x, y) => x >= 0 && y >= 0 && x < n && y < n && shape((x + .5) / n * 2 - 1, (y + .5) / n * 2 - 1) <= 1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (!inn(x, y)) continue;
        const u = (x + .5) / n * 2 - 1, v = (y + .5) / n * 2 - 1, edge = !inn(x - 1, y) || !inn(x + 1, y) || !inn(x, y - 1) || !inn(x, y + 1);
        const rim = !inn(x - 2, y) || !inn(x + 2, y) || !inn(x, y - 2) || !inn(x, y + 2), d = deco(u, v);
        let col;
        if (flash) col = d && d !== 'D' ? '#ffffff' : (edge ? '#ffffff' : '#cfd6ff');
        else if (d) col = P[d];
        else if (edge) col = LH.tone(a, 1.2);
        else if (rim) col = LH.tone(a, 0.6);
        else { const l = -u * 0.55 - v * 0.75 + (((x + y) & 1) ? 0.07 : -0.07); col = LH.tone(a, l > 0.8 ? 0.5 : l > 0.3 ? 0.36 : l > -0.2 ? 0.24 : 0.13); }
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return cv;
};
LH.pixDraw = (c, r, color, flash, shape, deco) => {
    const S = r * 2.2, n = Math.max(12, Math.min(34, Math.round(S / 2.4)));
    c.imageSmoothingEnabled = false; c.shadowBlur = 16; c.shadowColor = color;
    c.drawImage(LH.pixBody(n, color, flash, shape, deco), -S / 2, -S / 2, S, S);
};
const ab = Math.abs, hyp = Math.hypot;
LH.SH = {
    drone: (u, v) => hyp(u, v),
    tank: (u, v) => Math.pow(u ** 4 + v ** 4, 0.25),
    diamond: (u, v) => ab(u) + ab(v),
    dart: (u, v) => { if (u < -0.8 || u > 1 || (u < -0.45 && ab(v) < 0.18)) return 2; return ab(v) / Math.max(0.001, 0.9 * (1.08 - u) / 1.88); },
    blob: (u, v) => Math.min(hyp((u - 0.4) / 0.62, v / 0.78), hyp((u + 0.4) / 0.62, v / 0.78)),
    shield: (u, v) => (ab(u) > 1 ? 2 : ab(v) / (u < 0.55 ? 1 : 1 - (u - 0.55) * 0.67))
};
LH.DE = {
    drone: (u, v) => ab(v + 0.02) < 0.22 && ab(u) < 0.7 ? (ab(u) < 0.2 ? 'r' : 'D') : (ab(u) > 0.55 && ab(u) < 0.75 && ab(v - 0.52) < 0.13 ? 'L' : null),
    tank: (u, v) => ab(u) < 0.12 && ab(v) < 0.12 ? 'w' : (ab(u) < 0.3 && ab(v) < 0.3 ? 'L' : (ab(u) > 0.55 && ab(u) < 0.76 && ab(v) > 0.55 && ab(v) < 0.76 ? 'm' : (ab(u) < 0.06 && ab(v) > 0.4 ? 'D' : null))),
    diamond: (u, v) => hyp(u, v) < 0.1 ? 'w' : hyp(u, v) < 0.24 ? 'r' : (u > 0.24 && u < 0.92 && ab(v) < 0.12 ? (u > 0.74 ? 'r' : 'm') : null),
    dart: (u, v) => ab(v) < 0.13 && u > -0.05 && u < 0.4 ? (ab(v) < 0.06 ? 'r' : 'w') : (u < -0.6 && ab(v) < 0.5 ? (u < -0.72 ? 'y' : 'o') : (u < -0.05 && u > -0.55 && Math.floor((u + ab(v) * 1.2) * 5) % 2 === 0 ? 'L' : null)),
    blob: (u, v) => { const d1 = hyp(u - 0.4, v), d2 = hyp(u + 0.4, v); return d1 < 0.09 || d2 < 0.09 ? 'w' : (d1 < 0.22 || d2 < 0.22 ? 'L' : (ab(u) < 0.07 && ab(v) > 0.32 ? 'D' : null)); },
    shield: (u, v) => u > 0.5 && u < 0.7 && ab(v) < 0.55 ? 'L' : ((ab(u + 0.6) < 0.06 || ab(u + 0.2) < 0.06) && ab(v) < 0.62 ? 'D' : null)
};
enemyBody = function (c, t, r, color, flash) { const k = t === 1 ? 'tank' : t === 2 ? 'diamond' : 'drone'; LH.pixDraw(c, r, color, flash, LH.SH[k], LH.DE[k]); };
kindBody = function (c, kind, r, color, flash) { const k = kind === 'kami' ? 'dart' : 'blob'; LH.pixDraw(c, r, color, flash, LH.SH[k], LH.DE[k]); };
LH.pixShield = (c, r, flash) => LH.pixDraw(c, r, SHIELD_COL, flash, LH.SH.shield, LH.DE.shield);
// armas en el suelo: se ven con su pixel art, flotando y con un ligero balanceo
{
    const _pk = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        const t = this.itemType, sp = WEAPONS[t] && !EXTRA_PK[t] ? LH.pixSprite(t) : null;
        if (!sp) return _pk.call(this, ctx);
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
        const k = this.boost, y = this.y + this.floatY, S = 1.7 * k, h = Spr.halo(this.color);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(h.cv, this.x - h.w * k * 0.7, y - h.h * k * 0.7, h.w * k * 1.4, h.h * k * 1.4);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(this.x, y); ctx.rotate(Math.sin(engine.time * 3) * 0.18 - 0.2); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sp, -sp.width * S / 2, -sp.height * S / 2, sp.width * S, sp.height * S); ctx.restore();
    };
}

// ########## [pixel3.js] ##########
// ---------------------------------------------------------------- PIXEL ART v3 (protagonista, enemigos, jefes, balas, objetos)
// · Protagonista: héroe cenital (mochila, casco con visera, manos que sujetan el arma) dibujado en una rejilla de 24×22 píxeles,
//   con animación de zancada al moverse. Gira EN la rejilla de arte (32 ángulos, vecino más cercano) y se amplía a escala entera.
// · Enemigos: sprites dibujados a mano de 2 fotogramas (parpadeo de ojos, llamas, patas). Rampa de 5 tonos del color del enemigo,
//   contorno oscuro y aura de píxeles (tramado) en vez de resplandor borroso.
// · Jefes y minijefes: coraza poligonal generada píxel a píxel con luz fija (placas, remaches, jaula interior que gira en contra).
// · Balas: proyectiles cuadrados con estela de 3 píxeles. Objetos (corazón, escudo, reloj, imán, bomba): iconos pixel art.
// Sustituye por ganchos (LH.drawHero, LH.drawBig, LH.eFrame…) llamados desde motor.js; si no existen, se usa el dibujo antiguo.
LH.PX = true;
LH.now = () => (engine ? engine.time : 0);
LH.SPR = {"drone": ["half", ["....kkkk", "..kkcccl", ".kcllhhh", ".kcllhhl", "kkcllllm", "kGkcmmmd", "kgGkddkk", "kgGkkrww", "kgGkkrrE", "kgGkddkk", "kGkcmmmd", "kkcllllm", ".kcllmmm", "..kkcddd", "...kkkkk", "....zZzZ"]], "tank": ["half", ["kkkkkkkkkk", "kcccccccck", "kclllllllc", "kclkkkkkkk", "kclkmmmmmm", "kclkmcccll", "kclkmclhhh", "kclkmclhww", "kclkmclhwk", "kclkmcllll", "kclkmcllll", "kclkmclhwk", "kclkmclhww", "kclkmclhhh", "kclkmcccll", "kclkmmmmmm", "kclkkkkkkk", "kclllllllc", "kcdddddddk", "kkkkkkkkkk"]], "diamond": ["half", [".......k", "......kc", ".....kcl", "....kclm", "...kclmd", "..kclmdk", ".kclmkrr", "kclmkrww", "kclmkrwE", ".kclmkrr", "..kclmdk", "...kclmd", "....kclm", ".....kcl", "......kc", ".......k"]], "swarm": ["half", ["..kk", ".kcc", "kcll", "kchw", "kcll", ".kcm", ".xk.", "x..x"]], "split": ["half", ["....kkkkkk", "..kkcccclc", ".kcllllhhh", "kcllhhhhwk", "kclhhwwkrr", "kclhwkkrww", "kcllhkkrwE", "kcllllkrrk", "kcmmllhhhc", ".kdmmcllhh", "..kddmmccl", "...kkdddmm", ".....kkkkk"]], "kami": ["top", ["...........kk.......", "..........kccl......", ".....kkkkkkcllk.....", "....kcllllllhhhlk...", ".zZkclhhhhhhhwwwwlk.", "zZzkkkkmmmmcllwrrrk.", "zZzZkdddddmmmcccckk."]], "sniper": ["top", ["...kkkkkk..........", "..kkllllkk.........", ".kllhhhhllk........", "kcllhwwwhllk.......", "kcllhwrrwhllkkkkkkkkk", "kclllhwwhlllkwwwwwwwk", "kcmmmllllllmkgggggggG", "kcdmmmmmmmmdkkkkkkkkk"]], "shield": ["top", [".........kkkk", ".......kkcccc", ".....kkcllllh", "....kclllhhhh", "...kcllhhwwww", "..kclmmhwwkk", "..kcmdmhwkgg", ".kcmddmhwkGg", ".kcmdkkhwkGg", ".kcdkmmmhkkk"]], "heart": ["half", ["..kkk.", ".kcllk", "kcllhh", "kclhhw", "kcllhh", ".kcllh", "..kcml", "...kcm", "....kk"]], "pshield": ["half", ["kkkkkk", "kcccll", "kclllh", "kcllhh", "kcllhw", "kcllhw", "kcmllh", ".kcmll", "..kcml", "...kcc", "....kk"]], "hourglass": ["both", ["kkkkkk", "kcllhh", "kkclhh", ".kcmlh", "..kcyy", "...kyy"]], "magnet": ["half", ["kkkkk.", "krrrk.", "kwwwk.", "kcllk.", "kcllk.", "kcllk.", "kcllkk", "kcmlll", ".kcmlh", "..kccl", "...kkk"]], "bomb": ["half", ["......y", ".....oo", "....koo", "..kkkkc", ".kccllh", "kcllhhh", "kclhwhh", "kcllhhh", "kcmlllh", "kcmmlll", ".kcmmll", "..kkddd"]]};
const _px_tone = (a, k) => LH.tone(a, k);
LH.expand = (name) => {                                   // rejilla completa (array de filas) a partir de la mitad guardada
    const [mode, rows0] = LH.SPR[name], w = Math.max(...rows0.map(r => r.length)), rows = rows0.map(r => r.padEnd(w, '.'));
    if (mode === 'half') return rows.map(r => r + r.split('').reverse().join(''));
    if (mode === 'top') return rows.concat(rows.slice().reverse());
    const h = rows.map(r => r + r.split('').reverse().join('')); return h.concat(h.slice().reverse());
};
LH.eCache = {};
LH.eArt = (name, frame, color, flash) => {                // canvas con 2 px de margen para el aura
    const ck = name + '|' + frame + '|' + color + '|' + (flash ? 1 : 0); if (LH.eCache[ck]) return LH.eCache[ck];
    const rows = LH.expand(name), w = rows[0].length, h = rows.length, P = 2, a = LH.rgb(color);
    const pal = { k: '#0a0614', d: _px_tone(a, 0.28), m: _px_tone(a, 0.5), c: color, l: _px_tone(a, 1.45), h: _px_tone(a, 1.9), w: '#ffffff', r: '#ff2d3d', y: '#ffe600', o: '#ff9a3c', g: '#8f97b8', G: '#4b5170', E: frame ? '#0a0614' : '#ff2d3d', z: '#ffe600', Z: '#ff9a3c' };
    const cv = document.createElement('canvas'); cv.width = w + P * 2; cv.height = h + P * 2; const c = cv.getContext('2d');
    const solid = (x, y) => { const ch = rows[y] && rows[y][x]; if (!ch || ch === '.') return false; if (frame ? ch === 'x' : (ch === 'z' || ch === 'Z')) return false; return true; };
    for (let y = -P; y < h + P; y++) for (let x = -P; x < w + P; x++) {
        if (solid(x, y)) {
            const ch = rows[y][x]; let col = ch === 'x' ? pal.o : pal[ch];
            if (flash && ch !== 'k') col = (ch === 'h' || ch === 'l') ? '#ffffff' : '#dfe6ff';
            c.fillStyle = col || '#f0f'; c.fillRect(x + P, y + P, 1, 1);
        } else {
            let d = 9; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (solid(x + i, y + j)) d = Math.min(d, Math.abs(i) + Math.abs(j));
            if (d === 1 && ((x + y) & 1) === 0 || d === 2 && (x & 1) === 0 && (y & 1) === 0) { c.fillStyle = color; c.globalAlpha = d === 1 ? 0.45 : 0.28; c.fillRect(x + P, y + P, 1, 1); c.globalAlpha = 1; }
        }
    }
    return (LH.eCache[ck] = cv);
};
LH.eDraw = (c, name, fr, color, flash, r) => {
    const a = LH.eArt(name, fr, color, flash), rows = LH.SPR[name][1], iw = Math.max(...rows.map(q => q.length)) * (LH.SPR[name][0] === 'half' || LH.SPR[name][0] === 'both' ? 2 : 1), ih = rows.length * (LH.SPR[name][0] === 'top' || LH.SPR[name][0] === 'both' ? 2 : 1);
    const S = Math.max(1.6, Math.min(3.4, 2.2 * r / Math.max(iw, ih)));
    c.imageSmoothingEnabled = false; c.drawImage(a, -a.width * S / 2, -a.height * S / 2, a.width * S, a.height * S);
};
enemyBody = function (c, t, r, color, flash, fr) { LH.eDraw(c, ['drone', 'tank', 'diamond', 'swarm'][t] || 'drone', fr | 0, color, flash, r); };
kindBody = function (c, kind, r, color, flash, fr) { LH.eDraw(c, kind === 'kami' ? 'kami' : 'split', fr | 0, color, flash, r); };
LH.sniperBody = (c, r, flash, fr) => LH.eDraw(c, 'sniper', fr | 0, SNIPE_COL, flash, r);
LH.pixShield = (c, r, flash) => LH.eDraw(c, 'shield', 0, SHIELD_COL, flash, r);
ENEMY_SPR[3] = ['e3n', 'e3f'];
LH.eFrame = (e) => { if (e._ph === undefined) e._ph = Math.random() * 2; return Math.floor(LH.now() * 4 + e._ph) & 1; };

// ---------------------------------------------------------------- PROTAGONISTA
LH.heroGrid = (frame, dual, blink) => {
    const W = 24, H = 22, g = Array.from({ length: H }, () => Array(W).fill(null));
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const ell = (ex, ey, rx, ry, fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + .5 - ex) / rx, v = (y + .5 - ey) / ry; if (u * u + v * v <= 1) fn(x, y, u, v); } };
    const br = frame === 3 ? 1 : 0, rc = frame === 4 ? 1 : 0, st = [0, 3, -3, 0, 0][frame];
    rect(8 + st, 3, 5, 3, '#0d1530'); rect(11 + st, 3, 2, 3, '#00b8cc');          // botas (zancada)
    rect(8 - st, 18, 5, 3, '#0d1530'); rect(11 - st, 18, 2, 3, '#00b8cc');
    rect(1, 7, 5, 8, '#4b5170'); rect(1, 7, 5, 2, '#8b91ab'); rect(1, 13, 5, 2, '#2d3250');   // mochila
    set(2, 10, blink === 2 ? '#ff2d3d' : blink ? '#ffffff' : '#00f3ff'); set(2, 11, blink === 2 ? '#a01028' : blink ? '#00f3ff' : '#087782'); set(3, 10, '#2d3250'); set(3, 11, '#2d3250');
    ell(9.5, 10.5, 6, 8.4, (x, y, u, v) => { const l = -u * .45 - v * .85; set(x, y, l > .6 ? '#4a9be0' : l > .15 ? '#2b7fc0' : l > -.35 ? '#1d5f9c' : '#124a78'); });
    rect(7, 2, 6, 2, '#00d9ee'); rect(8, 2, 3, 1, '#9ffcff'); rect(7, 18, 6, 2, '#0098ad'); rect(8, 18, 3, 1, '#00d9ee');   // hombreras
    rect(6, 10, 4, 2, '#5ffbff'); rect(6, 10, 1, 2, '#ffffff');                     // cresta de la mochila al casco
    ell(12.5, 10.5, 5.7, 5.7, (x, y) => { if (g[y][x]) set(x, y, '#0b1a3a'); });
    ell(12.5, 10.5, 4.7, 4.7, (x, y, u, v) => { const l = -u * .4 - v * .85; set(x, y, l > .55 ? '#7d9fe0' : l > .05 ? '#566fba' : l > -.4 ? '#3a4f93' : '#26356b'); });
    for (let y = 7; y < 15; y++) for (let x = 14; x < 19; x++) { const u = (x + .5 - 12.5) / 4.7, v = (y + .5 - 10.5) / 4.7; if (u * u + v * v <= 1 && u > 0.38 && Math.abs(v) < 0.78) set(x, y, '#00f3ff'); }
    set(16, 8 + br, '#ffffff'); set(16, 9 + br, '#c8ffff'); set(15, 8 + br, '#8afaff'); if (rc) { set(15, 9, '#ffffff'); set(15, 10, '#c8ffff'); set(16, 10, '#ffffff'); }             // brillo de la visera
    rect(10, 9, 4, 3, '#3a4f93'); rect(11, 10, 3, 1, '#5ffbff');                     // placa del casco
    const body = g.map(r => r.map(c => !!c));
    const line = (x0, y0, x1, y1, c, c2) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; set(x, y, c); set(x, y + 1, c2); } };
    const hands = (dual ? [[18, 5], [18, 15]] : [[17, 8], [17, 12]]).map(([a, b]) => [a + br - rc, b]);
    line(11, 4, hands[0][0] - 1, hands[0][1], '#2b7fc0', '#1d5f9c'); line(11, 17, hands[1][0] - 1, hands[1][1] + 1, '#1d5f9c', '#124a78');
    for (const [hx, hy] of hands) { rect(hx, hy, 2, 2, '#5ffbff'); set(hx, hy, '#ffffff'); }
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) { const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b] && g[y + b][x + a]); if (nb) out[y][x] = '#02080f'; }
    return out;
};;
LH.heroCache = {};
LH.heroRot = (q, frame, dual, blink) => {
    const ck = [q, frame, dual, blink].join('|'); if (LH.heroCache[ck]) return LH.heroCache[ck];
    const g = LH.heroGrid(frame, dual, blink), art = document.createElement('canvas'); art.width = 24; art.height = 22;
    const a = art.getContext('2d'); g.forEach((row, y) => row.forEach((col, x) => { if (col) { a.fillStyle = col; a.fillRect(x, y, 1, 1); } }));
    const n = 36, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.translate(n / 2, n / 2); c.rotate(q / 32 * TAU); c.drawImage(art, -10, -11);
    return (LH.heroCache[ck] = cv);
};
LH.drawHero = (ctx, p) => {
    ctx.rotate(-p.angle);                                      // el sprite ya viene girado en la rejilla de arte
    const t = LH.now(), moving = Math.hypot(p.vx || 0, p.vy || 0) > 40, frame = moving ? [0, 1, 0, 2][Math.floor(t * 10) & 3] : 0, blink = Math.floor(t * 2) & 1;
    const q = Math.round((((p.angle % TAU) + TAU) % TAU) / TAU * 32) % 32, cv = LH.heroRot(q, frame, p.dual ? 1 : 0, blink);
    const tr = ctx.getTransform(), k = Math.hypot(tr.a, tr.b) || 1, S = Math.max(1, Math.round(2 * k)) / k;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.34)';                       // sombra en píxeles
    for (let j = -3; j <= 3; j++) { const hw = Math.round(Math.sqrt(1 - (j / 3.6) ** 2) * 6); ctx.fillRect(-hw * 2 + 4, j * 2 + 10, hw * 4, 2); }
    ctx.restore();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, -cv.width * S / 2, -cv.height * S / 2, cv.width * S, cv.height * S);
};

// ---------------------------------------------------------------- JEFES Y MINIJEFES
LH.bigCache = {};
LH.bigGrid = (boss, which, step, col, flash) => {
    const outer = which === 'o', N = outer ? (boss ? 8 : 6) : (boss ? 4 : 3), n = outer ? (boss ? 50 : 36) : (boss ? 30 : 22);
    const sector = TAU / N, rot = step / 12 * sector, Rmax = n / 2 - 1.5, a = LH.rgb(col), K = '#0a0614', g = [];
    for (let y = 0; y < n; y++) {
        const row = []; g.push(row);
        for (let x = 0; x < n; x++) {
            const u = x + 0.5 - n / 2, v = y + 0.5 - n / 2, rho = Math.hypot(u, v), ang = Math.atan2(v, u);
            const aa = ((((ang - rot) % sector) + sector) % sector) - sector / 2, Rp = Rmax * Math.cos(Math.PI / N) / Math.cos(aa), light = (-u * 0.5 - v * 0.85) / (n / 2), edgeA = Math.abs(Math.abs(aa) - sector / 2);
            let c = null;
            if (outer) {
                if (rho <= Rp) {
                    const de = Rp - rho;
                    if (rho < Rp * 0.56) c = rho > Rp * 0.56 - 1.3 ? _px_tone(a, 1.5) : (((x + y) & 1) ? '#08030f' : '#0c0618');
                    else if (de < 1.1) c = K;
                    else if (de < 2.3) c = light > 0 ? _px_tone(a, 1.4) : col;
                    else if (edgeA < 0.05) c = K;
                    else if (edgeA > 0.1 && edgeA < 0.2 && Math.abs(rho / Rp - 0.8) < 0.06) c = '#ffffff';
                    else { const l = light + (((x + y) & 1) ? 0.06 : -0.06); c = _px_tone(a, l > 0.35 ? 0.62 : l > 0 ? 0.46 : l > -0.3 ? 0.32 : 0.2); }
                }
            } else if (Math.abs(Rp - rho) < 1.3) c = (rho > Rp * 0.95 && edgeA < 0.22) ? '#ffffff' : (light > 0 ? _px_tone(a, 1.8) : _px_tone(a, 1.25));
            if (c && flash && c !== K) c = '#ffffff';
            row.push(c);
        }
    }
    return g;
};
LH.bigArt = (boss, which, step, col, flash) => {
    const ck = [boss ? 1 : 0, which, step, col, flash ? 1 : 0].join('|'); if (LH.bigCache[ck]) return LH.bigCache[ck];
    const g = LH.bigGrid(boss, which, step, col, flash), cv = document.createElement('canvas'); cv.width = cv.height = g.length; const c = cv.getContext('2d');
    g.forEach((row, y) => row.forEach((col2, x) => { if (col2) { c.fillStyle = col2; c.fillRect(x, y, 1, 1); } }));
    return (LH.bigCache[ck] = cv);
};
LH.drawBig = (ctx, e) => {
    const r = e.radius, t = LH.now(), boss = !!e.boss, col = e.color, N = boss ? 8 : 6, Ni = boss ? 4 : 3, so = boss ? 0.6 : 1.2, si = boss ? -1.2 : -2.4;
    if (!boss) { ctx.fillStyle = C.red; ctx.fillRect(-r, -r - 14, r * 2 * (e.hp / e.maxHp), 5); }
    const st = (ang, N2) => { const s = TAU / N2; return Math.floor((((ang % s) + s) % s) / s * 12) % 12; };
    const fl = !!e._fl, o = LH.bigArt(boss, 'o', st(t * so, N), col, fl), i = LH.bigArt(boss, 'i', st(t * si, Ni), col, fl);
    const So = r / (o.width / 2 - 1.5), Si = r * 0.55 / (i.width / 2 - 1.5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o, -o.width * So / 2, -o.height * So / 2, o.width * So, o.height * So);
    ctx.drawImage(i, -i.width * Si / 2, -i.height * Si / 2, i.width * Si, i.height * Si);
    const pr = r * 0.3, u = Math.max(3, pr * 2 / 7);                       // núcleo que late (círculo de cuadrados)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * (6 + (1 - e.hp / e.maxHp) * 14));
    for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) if (j * j + k * k <= 9) ctx.fillRect(Math.round((k * u - u / 2) / 2) * 2, Math.round((j * u - u / 2) / 2) * 2, u, u);
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(-u, -u, u * 2, u * 2);
};

// ---------------------------------------------------------------- BALAS
GameEngine.prototype.drawBullets = function (ctx) {
    const B = this.bullets; if (!B.length) return;
    const U = 3; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < B.length; i++) {
        const b = B[i], s = Math.max(U, Math.round(b.radius * 1.6 / U) * U), col = b.color, dx = b.tx - b.x, dy = b.ty - b.y;
        ctx.fillStyle = col;
        for (let k = 3; k >= 1; k--) {                                   // estela: 3 cuadrados que menguan
            const f = k / 3.4, ss = Math.max(U, s - k * U * 0.5 | 0), sz = Math.max(U, Math.round(ss / U) * U);
            ctx.globalAlpha = 0.5 - k * 0.12; ctx.fillRect(Math.round((b.x + dx * f - sz / 2) / U) * U, Math.round((b.y + dy * f - sz / 2) / U) * U, sz, sz);
        }
        ctx.globalAlpha = 0.9; ctx.fillRect(Math.round((b.x - s / 2) / U) * U, Math.round((b.y - s / 2) / U) * U, s, s);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; const c = Math.max(U, s - U * 2); ctx.fillRect(Math.round((b.x - c / 2) / U) * U, Math.round((b.y - c / 2) / U) * U, c, c);
    }
    ctx.restore();
};

// ---------------------------------------------------------------- OBJETOS (corazón, escudo, reloj de arena, imán, bomba)
{
    const ICON = { HEALTH: 'heart', SHIELD: 'pshield', SLOW: 'hourglass', MAGNET: 'magnet', NUKE: 'bomb' };
    const _pk2 = Pickup.prototype.draw;
    Pickup.prototype.draw = function (ctx) {
        const nm = ICON[this.itemType]; if (!nm) return _pk2.call(this, ctx);
        if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
        const k = this.boost, y = this.y + this.floatY, h = Spr.halo(this.color), a = LH.eArt(nm, 0, this.color, false), S = 1.9 * k;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(h.cv, this.x - h.w * k * 0.6, y - h.h * k * 0.6, h.w * k * 1.2, h.h * k * 1.2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
        const bob = Math.round(Math.sin(LH.now() * 5) * 1.5);
        ctx.drawImage(a, Math.round(this.x - a.width * S / 2), Math.round(y - a.height * S / 2) + bob, a.width * S, a.height * S);
    };
}
{
    const _px_warm = warmSprites;
    warmSprites = function () {
        _px_warm();
        try { for (const n of Object.keys(LH.SPR)) for (const f of [0, 1]) for (const fl of [0, 1]) LH.eArt(n, f, n === 'sniper' ? SNIPE_COL : n === 'shield' ? SHIELD_COL : '#ff007f', fl); } catch (e) {}
    };
}

