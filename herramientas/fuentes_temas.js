module.exports = {
  happy: `
var C, m, y, z, M, w, s, k, R;
return function (t) {
    return ((t /= 6) || (C = [[1.5873,4,4,4.7568,3.1748],[1.4983,5.3392,4.4896,3.5632,2.9964],[1.4983,5.3392,4.4896,3.7752,2.9964],[1,3.5632,4.7568,4,2.9964],[1.5873,4,4,4.7568,3.1478],[1.4983,5.3392,4.4896,3.5632,2.9964],[1,5.3392,4.4896,3.5632,2.9964],[1,5.0396,4,2.9964,2.9964]], m = 'ÿ@@ŀ@@Ĥ@@ÿ@@ê@Øê@ÿê@ØÀÀ@@@Ø@@êÿ@@ċ@ÿÿ@@@@Ĥ@@ċ@@ÿÿ@ċÿÿÿê@Ø@@êê@êÿÿÿê@@ØØ@ê@Ĥ@@ÿ@@ê@@ÿÿ@@@@@@@@õõõ')),
        y = 2 * t,
        z = c => (M = (m.charCodeAt(w = t / 800 % 96) - 64) * t / (2048 + c * 2),
            (C[s = int(t / 9600 % 8)].map(e => (32 > w && 1 << w & 0xC007307 || (32 <= w && 64 > w) && 1 << w & 1929842288 || 64 < w && 1 << w & 0xE70C400) && sin((y * e / (128 + c / 4) % 2 - 1) ** 9 * PI) / 2).reduce((a, b) => a + b) + sin((M % 2 - 1) ** 9 * PI + sin(M * PI * 2) / 2)) * (k = t / 4800 % 1) ** .5 + sin(k ** .2 * 200 + c / 4) * (1 - k) ** 6 + (R = () => random() - .5)() * sin(t * 6) * max(1 - t / 800 % 3 % 2, 0) ** 5 + (t / 4800 & 1 && sin(k ** .4 * 300 + R() * k ** 2 * 400 - c / 3) * (1 - k) ** 7) + R() * (t / 2400 & 1 && 1 - k) ** 2 * 1.2),
        [z(-1), z(1)];
};`,
  shock: `
var l = 0, r = 0, p, P;
return function (t) {
    return (p = 2 ** (("$$$000,,,,,,,,''".charCodeAt(4.3 * t & 15) + 22) / 12),
        P = ((t * p % 1 > t / 2 % 1 * .6 + .2) - .5) / 2,
        l += r += (P - l - 3 * r) / (170 * cos(t / 5) + 200),
        l + sin(180 * (4.3 * t % 2 + .01) ** .3) / 4);
};`,
  addict: `
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
};`,
  epic: `
var X, Y, C, H, S;
var MK = [0, 3, 3, 3, 2, 3, 3, 5, 5, 2, 4, 3, 6, 4, 0, 0, 1, 3, 3, 3, 3, 2, 3, 3, 4, 4, 2, 3, 3, -3, -5, -12];
var mult = (t) => { var i = t >> 13 & 31; return i === 0 ? (t >> 11) % 4 | 5 : i === 14 ? t / 64 & 4 : i === 15 ? (t / 5 & 1) + 6 : MK[i]; };
X = (t, e) => { var u = t * PI / 256, s = sin(u); return sin(atan(sin(u + s * e) / 4) * e * mult(t)) / (1 + e / 16); };
Y = (t, E, n) => {
    var d = 2 - E / 1.5, a = X(t, 0) / d;
    for (var b = 1; b < n; b++) { var x = X(t + b * E * 65, b) / d; a = cbrt(1 - a) * (1 - x * x * x); }
    return (a - 1) * (1 + E) * 2;
};
return function (t) {
    t /= 5 / 3;
    C = (6417 >> (t >> 12 & 15) & 1) ? t / 4096 % 1 : 1;
    H = sin(-sin(t + random()) * 4 - t * 5 + random() * 2) * sin(t * 7 + random() * 4) ** 3;
    S = (-t >> 13 & 1 & t >> 14 & 1) ? (t / 8192 - 1 / 8192) % 1 : 1;
    return Y(t, atan(12 * (sin(t * PI / (8192 / +'42124228146212261212466222426241'[t >> 13 & 31]) - 1.2) + 1)), Q.n) / 2 * C ** 3 * S ** .5 * (t / 16384 % 1) ** .6 + cbrt(sin(cbrt(C / 8) * 125) * (1 - C ** .7) * 8) * (1 - C ** .2) ** 1.2 * 4 + H * +'22112112121112111'[t >> 12 & 15] * (1 - (t / 8192 % 1) ** .1) ** 3 * 18 / 1.5 + cbrt(sin(cbrt(S * 12 + .5) * 130) * (1 - S ** .5) * .9 + sin((t >> 1) % 13131 * (t >> 2) % 11111) * S ** .9 * (1 - S ** .5) * 3) * (1 - S ** 3) ** 3 * (1 - S ** .2) ** 2 * 12;
};`,
  boss: `
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
};`,
  // abyss v2.14: el abismo con ALMA. Mismo esqueleto oscuro (bombo pesado, bajo rodante, metales, drone), pero ahora con acordes de pad
  // (Em · F · G, mi frigio/menor), arpegio con eco estéreo y una melodía con vibrato que entra en el compás 5 y vuelve en la segunda vuelta.
  abyss: `
var TAU = 2 * PI, B = 60 / 128, S16 = B / 4, BAR = B * 4, LOOP = 16 * BAR;
var hz = n => 41.2034 * pow(2, n / 12);
var ROOT  = [0, 0, 1, 0, 0, 0, 3, 1];          // Em Em F Em Em Em G F
var THIRD = [3, 3, 4, 3, 3, 3, 4, 4];          // tercera menor (Em) o mayor (F, G)
var AP  = [0, 2, 3, 4, 3, 2, 4, 3, 0, 2, 3, 5, 4, 3, 2, 3];   // arpegio (índice de nota del acorde) - primera vuelta
var AP2 = [0, 3, 2, 4, 5, 4, 3, 2, 0, 3, 2, 4, 5, 3, 4, 2];   // variación en la segunda vuelta
var MEL = [[7, 10, 12, 10], [15, 12, 10, 7], [8, 12, 13, 12], [10, 7, 3, 7], [7, 12, 15, 19], [17, 15, 12, 10], [15, 19, 22, 19], [13, 12, 8, 12]];   // semitonos sobre Mi4
var kick = (u, f0, f1, dec, len) => u < 0 ? 0 : sin(TAU * (f1 * u + (f0 - f1) * (1 - exp(-u * dec)) / dec)) * exp(-u * len);
var arp = (tt) => {
    if (tt < 0) return 0;
    var bar = floor(tt / BAR), x = tt - bar * BAR, st = floor(x / S16) & 15, ts = x % S16, bi = bar & 7;
    var idx = (((bar >> 3) & 1) ? AP2 : AP)[st], th = THIRD[bi];
    var off = [0, th, 7, 12, 12 + th, 19][idx], f = hz(ROOT[bi] + off + 24);
    return (sin(TAU * f * tt) + 0.5 * sin(TAU * 2 * f * tt) + 0.25 * sin(TAU * 3 * f * tt)) * exp(-ts * 9) * min(1, ts * 400);
};
return function (t) {
    var bar = floor(t / BAR), x = t - bar * BAR, step = floor(x / S16) & 15, tb = x % B, ts = x % S16, bi = floor(x / B);
    var b8 = bar & 7, tl = t % LOOP;
    var duck = 1 - 0.92 * exp(-tb * 8), duckS = 0.5 + 0.5 * duck;
    var k = tanh(kick(tb, 135, 36, 24, 7.5) * 2.2) * 0.9;
    var f = hz(ROOT[b8]);
    var gate = (step & 3) ? pow(max(0, sin(PI * ts / S16)), 0.7) : 0;
    var s1 = sin(TAU * f * t);
    var rumble = (s1 + tanh(2.5 * s1) * 0.5 + sin(TAU * 2 * f * t) * 0.25) * gate * duck * 0.5;
    var tc = (step === 6 || step === 14 || ((bar & 1) && step === 11)) ? ts : -1;
    var clank = 0;
    if (tc >= 0) clank = (sin(TAU * 387 * tc) + 0.8 * sin(TAU * 601 * tc) + 0.6 * sin(TAU * 953 * tc) + 0.4 * sin(TAU * 1493 * tc)) * exp(-tc * 24) * 0.08 + (random() - 0.5) * exp(-tc * 55) * 0.25;
    var cl = (bi & 1) ? (random() - 0.5) * (exp(-tb * 11) * 0.55 + exp(-tb * 4) * 0.14) : 0;
    var hat = (step & 3) === 2 ? (random() - 0.5) * exp(-ts * 45) * 0.2 : 0;
    var lfo = 0.6 + 0.4 * sin(TAU * t / (BAR * 2));
    var drone = (sin(TAU * 82.41 * t) + sin(TAU * 82.75 * t) + 0.7 * sin(TAU * 123.47 * t) + 0.5 * sin(TAU * 174.61 * t + sin(TAU * 0.2 * t) * 2)) * 0.04 * lfo;
    // PAD: acorde de la armonía de cada compás, con swell de 2 compases y suavizado en los cambios
    var th = THIRD[b8], r = ROOT[b8], swell = 0.55 + 0.45 * sin(PI * ((t % (2 * BAR)) / (2 * BAR))), pad = 0;
    var pg = min(1, x * 6) * min(1, (BAR - x) * 6);
    for (var i = 0; i < 4; i++) {
        var pf = hz(r + [0, th, 7, 12][i] + 12);
        pad += sin(TAU * pf * t) + 0.7 * sin(TAU * pf * 1.005 * t) + 0.3 * sin(TAU * 2 * pf * t);
    }
    pad *= 0.03 * swell * pg * duckS;
    // ARPEGIO con eco distinto en cada canal (puntillo a la izquierda, negra a la derecha)
    var ag = 0.55 + 0.45 * (tl >= 4 * BAR ? 1 : 0);
    var a0 = arp(t) * 0.17 * ag * duckS;
    var aL = a0 + arp(t - 3 * S16) * 0.08 * ag, aR = a0 + arp(t - 4 * S16) * 0.09 * ag;
    // MELODÍA: entra en el compás 5 (con fundido de un compás) y sigue hasta el final del bucle
    var mg = tl >= 4 * BAR ? min(1, (tl - 4 * BAR) / BAR) : 0, mel = 0;
    if (mg > 0) {
        var q = floor(x / B) & 3, tq = x % B, mf = 329.63 * pow(2, MEL[b8][q] / 12);
        var ph = TAU * mf * t + 0.25 * sin(TAU * 5.5 * t) * min(1, tq * 2);
        mel = (sin(ph) + 0.5 * sin(2 * ph) + 0.33 * sin(3 * ph) + 0.2 * sin(4 * ph)) * min(1, tq * 40) * (0.55 + 0.45 * exp(-tq * 2.5)) * 0.1 * mg * (0.7 + 0.3 * duckS);
    }
    var base = k + rumble + drone + pad + clank + cl * 0.8 + mel;
    var l = base + hat * 0.5 + aL, rr = base + hat + aR + clank * -0.4;
    return [tanh(l * 1.1) * 0.9, tanh(rr * 1.1) * 0.9];
};`,

  mini: `
var l = 0;
return function (t) {
    if (t === 0) l = 0;

    // 1. MELODÍA Y SECUENCIADOR DE NOTAS
    let notes = '03202222222222270320222222233330';
    let p = t * 2 ** (notes[31 & t >> 13] / 12);
    let n = p * (1 + 2 * (1 & t >> 18)) ^ p >> 2;
    let m = (-cos(t * PI / 1024 / ['44882444'[7 & t >> 14], '4'][1 & t >> 18]) + 1);
    l += ((n & 255) - l) * (m ** 2 / 3);
    let sm = (l / 127 - 1) * 1.9;

    // 2. TEMPORIZACIÓN DEL RITMO
    let pl = 2 << 13;
    let pr = t % pl;
    let c = 3 & t >> 14;
    let kg = c == 0;

    // 3. BOMBO
    let k = tanh(cos(sqrt(pr) - (.00009 * pr * (1 + 1 / pr * 2)) + random() * 4 * (1 / pr * 100) ** 1.5) * (1 - pr / pl) ** 2) * kg;

    // 4. CANALES Y PERCUSIÓN
    let a = () => {
        let sg = c == 2;
        let s = tanh(6 * cos((5E6 + pr) * (1 - (1 / pr / 80) * 6) / 70) * ((1 - pr / pl) ** 10) + (random() - .5) * 1.5 * (1 - pr / pl)) / 2 * sg;
        let h = tanh((random() - .7) * (1 - pr / pl * 2 % 1) ** 5 * sin(cos(t / 8) * sin(t + sin(t / '4631'[3 & t >> 13]))) * (1 - pr / pl * 2 % 1));
        let cy = (random() - .5) * (1 - pr / pl) ** 5;
        let sc = kg | sg ? min(pr / pl * 2, 1) : 1;
        return tanh(1.5 * (s + k + (h * .7 + cy * .5) * sc ** .4 + tanh(sin(.5 + 1.2 * asin(sin(p / 512 * PI))) * m * .9 + sm) * .5 * sc ** 2));
    };

    return [a(), a()];
};`,
  // ---------------------------------------------------------------------------------------------
  //  TEMAS AÑADIDOS EN v2.12 (fórmulas de Dollchan). Son bytebeat «clásico» (salida 0..255) o con signo (-128..127):
  //  se envuelven para devolver [-1,1] como el resto. La expresión original va tal cual dentro del return.
  // ---------------------------------------------------------------------------------------------
  // incoming = «epic_boss_incoming» · bytebeat 44100 Hz · antes del jefe. Las capas entran poco a poco (arpegio → bajo → acordes → percusión).
  incoming: `
var q, T, y, p;
return function (t) {
    return ((q=x=>parseInt(x,36),T=1.4*t,y=4*T/3,p=t*2**(q(['79AEA9','79AHA9','39AEA9','269CA9'][3&y>>17][(T>>13)%6])/12),(p%256+p%255)/6+((127&t*2**(q('7732'[3&y>>17])/12)/8)+(y>>10)&128)/2*(y>524288)+(64&t*2**(q(['7AE','AEH','37A',['279','69C'][1&T>>17]][3&y>>17][(y>>11)%3])/12))/3*(y>1048576)+16*random()*'200020203320200020202030'[(T>>12)%24]*(y>2097152)) & 255) / 127.5 - 1;
};`,

  // misterio = «song_misterioso» · bytebeat 22050 Hz · pantalla de mejoras. La cadena original tiene 509 letras: se completa a 512 (32 compases) repitiendo el final ('-8/') para que el bucle cuadre.
  misterio: `
var p, S = 'B*918/916-918/91B*918/916-918/91>*;2:1;26/;2:1;2>*;2:1;26/;2:1;2A*;291;28/;291;2A*;291;28/;291;2B*=-;,=-91=-;,=-B*=-;,=-91=-;,=-E*>6=4>692>6=4>6E*>6=4>692>6=4>6D*<3:1<380<3:1<3D*<3:1<380<3:1<3D(=4<3=481=4<3=4D(=4<3=481=4<3=4B(:18/:16.:18/:1B(:18/:16.:18/:1B&;2:1;26/;2:1;2B&;2:1;26/;2:1;2@&;,9*;,8/;,9*;,@&;,9*;,8/;,9*;,@%=-;,=-91=-;,=-@%=-;,=-91=-;,=->*=-;,=-92=-;,=->*=-;,=-92=-;,=->,8/6-8/428/6-8/>,8/6-8/428/6-8/=-412/4192412141=-412/4192412141;-6341613/634163;-6341613/634163;,8/6-8/528/6-8/;,8/6-8/528/6-8/';
return function (t) {
    return (((p=t*2**(S.charCodeAt(t>>12)/12-4)),((1.48*p%256+1.47*p%256)/2*(-t>>4&255)>>9)+32*sin(10*cbrt(t%16384))+(12*random()*(~t>>6&255)>>6)*(t&16384)/16E3+32) & 255) / 127.5 - 1;
};`,

  // techno = «techno computer» · bytebeat con signo, estéreo, 44100 Hz · oleadas 7-9 y retornos en el tramo final.
  techno: `
var r, l, u, c, x, s, w, e, b, d;
return function (t) {
    var L = (r=t*.95,l=16384,u=8192,c=4096,x=j=>min(max((s=(a,b)=>(t*2**(parseInt(a,36)/12)/b*.247%64+(sin(t*PI/l/6)*16+32)&64)-32,w=r=>r>0&&(e=a=>s('18DGF864D6438B8D'[15&(21&r>>13)+(r>>15)],a)/2,e(1)+e(j))*(1-r/u%1*[.75,1][1&r>>19]),w(r)+w(r-(d=12288))/3+w(r-2*d)/4+w(r-3*d)/5+-(b=a=>s('DDDD9999BBBBDDGB'[15&r>>15],a),b(8)+b(4/j))*(r/l%2)*(1-r%u/1E4)+(64*random()-32)*(1-r/u%1)**4+150*sin(6*cbrt(r%l))*(1-r/l%1)**2*!(r&l)+((t*sin(t>>2)&32)-16)*(1-r/l/2%1)**3*!(~r&2*l)),-128),127)*(r/32768%1)**.25*(1-r/u%1*.5)**.5,[x(1.005),x(.995)]);
    return [L[0] / 128, L[1] / 128];
};`,
};
