// =====================================================================
//  MÚSICA — Neon Carnage  (v2: director adaptativo)
//
//  Seis temas (bytebeat / funcbeat) que se mezclan según cómo juegas:
//    happy  → menú y hasta que mates al primer enemigo. Alegre.
//    shock  → tras el primer enemigo. Tensión.
//    addict → entra poco a poco en las primeras oleadas. Techno hipnótico.
//    epic   → a partir de la oleada ~4. Tu bytebeat nuevo, grande y cinematográfico.
//    boss   → solo durante las oleadas de jefe. Rápido y agresivo.
//    abyss  → oleadas 9+. El más oscuro.
//
//  Cómo se consigue que el cambio sea gradual y suave:
//   1. Los cambios no ocurren "cuando sea": se programan para el siguiente
//      compás (o pulso, si es urgente) del tema que suena, y el tema nuevo
//      arranca desde su primer tiempo. Siempre entra "en el uno".
//   2. Fundido de potencia constante (varios segundos, cada tema tiene el suyo).
//   3. Estilo DJ: el tema que entra empieza apagado (filtro cerrado, sin graves)
//      y se abre; el que sale pierde primero los graves, así no chocan.
//   4. Los cambios de escena grandes (epic, boss, abyss) llevan un riser de
//      ruido y un golpe grave justo en el tiempo fuerte.
//   5. Todo lo demás reacciona sin saltos: el sonido se oscurece con el
//      progreso, se abre con el combo, se apaga entre oleadas y late cuando
//      queda poca vida. Al morir la música se apaga con un fundido.
//
//  Para cambiar un tema, edita su cuerpo en SRC_*. Para cambiar cuándo suena
//  cada uno, mira computeDesired() más abajo (los números son oleadas).
//  happy y epic son bytebeat (t = muestra entera); el resto, funcbeat (t = segundos).
// =====================================================================

// Cuerpos de fábrica: cada uno devuelve la función que genera el audio.
// Se envuelven en with(Math) para poder escribir sin "Math." (igual que Bytebeat Composer).
// (No uses nombres de variable que ya existan en Math, como E, max, min, exp…)

const SRC_HAPPY = `
var C, m, y, z, M, w, s, k, R;
return function (t) {
    return ((t /= 6) || (C = [[1.5873,4,4,4.7568,3.1748],[1.4983,5.3392,4.4896,3.5632,2.9964],[1.4983,5.3392,4.4896,3.7752,2.9964],[1,3.5632,4.7568,4,2.9964],[1.5873,4,4,4.7568,3.1478],[1.4983,5.3392,4.4896,3.5632,2.9964],[1,5.3392,4.4896,3.5632,2.9964],[1,5.0396,4,2.9964,2.9964]], m = 'ÿ@@ŀ@@Ĥ@@ÿ@@ê@Øê@ÿê@ØÀÀ@@@Ø@@êÿ@@ċ@ÿÿ@@@@Ĥ@@ċ@@ÿÿ@ċÿÿÿê@Ø@@êê@êÿÿÿê@@ØØ@ê@Ĥ@@ÿ@@ê@@ÿÿ@@@@@@@@õõõ')),
        y = 2 * t,
        z = c => (M = (m.charCodeAt(w = t / 800 % 96) - 64) * t / (2048 + c * 2),
            (C[s = int(t / 9600 % 8)].map(e => (32 > w && 1 << w & 0xC007307 || (32 <= w && 64 > w) && 1 << w & 1929842288 || 64 < w && 1 << w & 0xE70C400) && sin((y * e / (128 + c / 4) % 2 - 1) ** 9 * PI) / 2).reduce((a, b) => a + b) + sin((M % 2 - 1) ** 9 * PI + sin(M * PI * 2) / 2)) * (k = t / 4800 % 1) ** .5 + sin(k ** .2 * 200 + c / 4) * (1 - k) ** 6 + (R = () => random() - .5)() * sin(t * 6) * max(1 - t / 800 % 3 % 2, 0) ** 5 + (t / 4800 & 1 && sin(k ** .4 * 300 + R() * k ** 2 * 400 - c / 3) * (1 - k) ** 7) + R() * (t / 2400 & 1 && 1 - k) ** 2 * 1.2),
        [z(-1), z(1)];
};`;

const SRC_SHOCK = `
var l = 0, r = 0, p, P;
return function (t) {
    return (p = 2 ** (("$$$000,,,,,,,,''".charCodeAt(4.3 * t & 15) + 22) / 12),
        P = ((t * p % 1 > t / 2 % 1 * .6 + .2) - .5) / 2,
        l += r += (P - l - 3 * r) / (170 * cos(t / 5) + 200),
        l + sin(180 * (4.3 * t % 2 + .01) ** .3) / 4);
};`;

const SRC_ADDICT = `
var slow = 0, BPM = slow ? 125 : 165;
var A = 0, B = 0, C = 0, D = 0, b, e, KICK, HAT, CLAP, BAS, MEL, g, r;
var note = (a = 0, b = 0) => { return (x, d) => { return (a += b += (440 * 2 ** (x / 12) - b) / 20) / d; }; };
var _a = note(), _b = note();
return (t, s) => {
    b = t * BPM / 60;
    e = 60 / BPM;
    KICK = sin(cbrt(t % e) * 192);
    HAT = (random() - .5 + (t * 2.0833 * 2 ** 15 & 1 ? .25 : -.25) / 1.5) / exp(t % (e / 2)) ** 64 * (b * 2 & 1);
    CLAP = (A += B += (random() - .5 - A - B * 3) / 9) * (1 / exp(t % e) ** 36 * 3 % 1) * 8 * (b & 1);
    g = _a([6, 6, 6, 6, 2, 2, 2, 1][b >> 1 & 7], s) * PI / 8;
    r = _b([-6, 1, 6, -6, 1, 6, -6, 1, 6, -6, 1, 9, 8, 9, 4, -1, -10, -3, 2, -10, -3, 2, -10, -3, 2, -10, -3, 2, -11, -4, 1, 4][b * 2 & 31], s) * PI;
    BAS = (sin(g) ** 256 - sin(g + .1) ** 256) * 4 * (C += (cbrt(b % 1) ** 4 - C) / 8);
    MEL = sin(r + cos(r + 2 * 2 + sin(r))) * (D += ((1 / exp(b % .5) ** 4) - D) / 8);
    return (KICK + HAT + CLAP + BAS + MEL) / 4;
};`;


// ---------------------------------------------------------------------
//  TEMA 4 · EPIC  (tu bytebeat nuevo, a 44.1 kHz como floatbeat)
//  Es exactamente tu fórmula; solo he sacado a variables locales lo que
//  se recreaba en cada muestra (el array de 32 valores y el Array.from)
//  para que no gaste CPU ni genere basura en el móvil. El resultado es
//  idéntico. Q.n son las capas del acorde (16 normal, 8 en modo rendimiento).
// ---------------------------------------------------------------------
const SRC_EPIC = `
var X, Y, C, H, S;
var MK = [0, 3, 3, 3, 2, 3, 3, 5, 5, 2, 4, 3, 6, 4, 0, 0, 1, 3, 3, 3, 3, 2, 3, 3, 4, 4, 2, 3, 3, -3, -5, -12];
var mult = (t) => { var i = t >> 13 & 31; return i === 0 ? (t >> 11) % 4 | 5 : i === 14 ? t / 64 & 4 : i === 15 ? (t / 5 & 1) + 6 : MK[i]; };
X = (t, e) => { var s = sin(t * PI / 256); return sin(atan(sin(t * PI / 256 + s * e) / 4) * e * mult(t)) / (1 + e / 16); };
Y = (t, E, n) => {
    var d = 2 - E / 1.5, a = X(t, 0) / d;
    for (var b = 1; b < n; b++) a = -cbrt(1 - a) * -(1 - (X(t + b * E * 65, b) / d) ** 3);
    return (a - 1) * (1 + E) * 2;
};
return function (t) {
    t /= 5 / 3;
    C = (6417 >> (t >> 12 & 15) & 1) ? t / 4096 % 1 : 1;
    H = sin(-sin(t + random()) * 4 - t * 5 + random() * 2) * sin(t * 7 + random() * 4) ** 3;
    S = (-t >> 13 & 1 & t >> 14 & 1) ? (t / 8192 - 1 / 8192) % 1 : 1;
    return Y(t, atan(12 * (sin(t * PI / (8192 / +'42124228146212261212466222426241'[t >> 13 & 31]) - 1.2) + 1)), Q.n) / 2 * C ** 3 * S ** .5 * (t / 16384 % 1) ** .6 + cbrt(sin(cbrt(C / 8) * 125) * (1 - C ** .7) * 8) * (1 - C ** .2) ** 1.2 * 4 + H * +'22112112121112111'[t >> 12 & 15] * (1 - (t / 8192 % 1) ** .1) ** 3 * 18 / 1.5 + cbrt(sin(cbrt(S * 12 + .5) * 130) * (1 - S ** .5) * .9 + sin((t >> 1) % 13131 * (t >> 2) % 11111) * S ** .9 * (1 - S ** .5) * 3) * (1 - S ** 3) ** 3 * (1 - S ** .2) ** 2 * 12;
};`;

// ---------------------------------------------------------------------
//  TEMA 5 · BOSS  (funcbeat, 150 BPM, la menor frigio)
//  Bombo con barrido, bajo gruñón en semicorcheas, caja en 2 y 4,
//  hi-hats, acordes cortos y un riser de ruido en el último compás de cada 4.
// ---------------------------------------------------------------------
const SRC_BOSS = `
var TAU = 2 * PI, B = 60 / 150, S16 = B / 4, BAR = B * 4;
var hz = n => 55 * pow(2, n / 12);
var RIFF = [0, 0, 12, 0,  0, 1, 0, 12,  0, 0, 12, 0,  3, 1, 0, -2];
var ROOT = [0, 0, 1, -2];
var kick = (u, f0, f1, dec, len) => u < 0 ? 0 : sin(TAU * (f1 * u + (f0 - f1) * (1 - exp(-u * dec)) / dec)) * exp(-u * len);
var sw = (a, t) => 2 * ((a * t) % 1) - 1;
return function (t) {
    var bar = floor(t / BAR), x = t - bar * BAR, step = floor(x / S16) & 15, tb = x % B, ts = x % S16, bi = floor(x / B);
    var duck = 1 - 0.85 * exp(-tb * 9);
    var k = kick(tb, 170, 42, 32, 10) * 0.9;
    var gk = (bar & 1) && step >= 14 ? kick(x - 14 * S16, 170, 44, 32, 11) * 0.6 : 0;
    var f = hz(RIFF[step] + ROOT[bar & 3]);
    var gate = min(1, ts * 500) * min(1, (S16 - ts) * 400) * (0.35 + 0.65 * exp(-ts * 8));
    var bass = (tanh(3.5 * sw(f, t)) * 0.45 + sin(TAU * f * t) * 0.75) * gate * duck;
    var sn = (bi & 1) ? (random() - 0.5) * exp(-tb * 17) * 0.9 + sin(TAU * 190 * tb) * exp(-tb * 30) * 0.5 : 0;
    var hat = (random() - 0.5) * exp(-ts * 75) * ((step & 1) ? 0.18 : 0.3) + ((step & 3) === 2 ? (random() - 0.5) * exp(-ts * 16) * 0.22 : 0);
    var ss = step >= 13 ? 13 : step >= 10 ? 10 : step >= 6 ? 6 : step >= 3 ? 3 : -1;
    var stab = 0;
    if (ss >= 0) {
        var tx = x - ss * S16, f0 = 220 * pow(2, ROOT[bar & 3] / 12);
        stab = tanh(1.6 * (sw(f0, t) + sw(f0 * 1.0075, t) + sw(f0 * 1.4983, t) * 0.8 + sw(f0 * 2.01, t) * 0.6)) * exp(-tx * 13) * min(1, tx * 400) * 0.22;
    }
    var ru = (bar & 3) === 3 ? pow(x / BAR, 3) : 0;
    var riser = (random() - 0.5) * ru * 0.35;
    return tanh((k + gk + bass * 0.7 + sn * 0.6 + hat + stab + riser) * 1.1) * 0.9;
};`;

// ---------------------------------------------------------------------
//  TEMA 6 · ABYSS  (funcbeat, 128 BPM, mi frigio) — el más oscuro.
//  Bombo pesado, bajo que rueda entre los golpes con sidechain, metales
//  inarmónicos, palmas con cola larga y un drone disonante de fondo.
// ---------------------------------------------------------------------
const SRC_ABYSS = `
var TAU = 2 * PI, B = 60 / 128, S16 = B / 4, BAR = B * 4;
var hz = n => 41.2034 * pow(2, n / 12);
var ROOT = [0, 0, 1, 0, 0, 0, 3, 1];
var kick = (u, f0, f1, dec, len) => u < 0 ? 0 : sin(TAU * (f1 * u + (f0 - f1) * (1 - exp(-u * dec)) / dec)) * exp(-u * len);
return function (t) {
    var bar = floor(t / BAR), x = t - bar * BAR, step = floor(x / S16) & 15, tb = x % B, ts = x % S16, bi = floor(x / B);
    var duck = 1 - 0.92 * exp(-tb * 8);
    var k = tanh(kick(tb, 135, 36, 24, 7.5) * 2.2) * 0.9;
    var f = hz(ROOT[bar & 7]);
    var gate = (step & 3) ? pow(max(0, sin(PI * ts / S16)), 0.7) : 0;
    var s1 = sin(TAU * f * t);
    var rumble = (s1 + tanh(2.5 * s1) * 0.5 + sin(TAU * 2 * f * t) * 0.25) * gate * duck * 0.55;
    var tc = (step === 6 || step === 14 || ((bar & 1) && step === 11)) ? ts : -1;
    var clank = 0;
    if (tc >= 0) clank = (sin(TAU * 387 * tc) + 0.8 * sin(TAU * 601 * tc) + 0.6 * sin(TAU * 953 * tc) + 0.4 * sin(TAU * 1493 * tc)) * exp(-tc * 24) * 0.11 + (random() - 0.5) * exp(-tc * 55) * 0.3;
    var cl = (bi & 1) ? (random() - 0.5) * (exp(-tb * 11) * 0.55 + exp(-tb * 4) * 0.14) : 0;
    var hat = (step & 3) === 2 ? (random() - 0.5) * exp(-ts * 45) * 0.22 : 0;
    var lfo = 0.6 + 0.4 * sin(TAU * t / (BAR * 2));
    var pad = (sin(TAU * 82.41 * t) + sin(TAU * 82.75 * t) + 0.7 * sin(TAU * 123.47 * t) + 0.5 * sin(TAU * 174.61 * t + sin(TAU * 0.2 * t) * 2)) * 0.07 * lfo;
    var l = k + rumble + pad + clank + cl * 0.8 + hat * 0.5;
    var r = k + rumble + pad + clank * 0.6 + cl * 0.8 + hat;
    return [tanh(l * 1.1) * 0.9, tanh(r * 1.1) * 0.9];
};`;


