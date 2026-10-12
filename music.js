// =====================================================================
//  MÚSICA — Neon Carnage
//  Tres temas (bytebeat/funcbeat) que se mezclan según tu progreso:
//    happy  → menú y antes de matar al primer enemigo. Alegre.
//    shock  → tras el primer enemigo. Cambia de golpe.
//    addict → se va imponiendo poco a poco. Hipnótica, tipo techno.
//  Mientras avanzas el sonido se oscurece (filtro que baja + más distorsión).
//  Los jefes oscurecen un poco más.
//
//  Para cambiar un tema, edita su cuerpo en SRC_HAPPY / SRC_SHOCK / SRC_ADDICT.
//  El tema "happy" es bytebeat: t es una muestra entera a 8 kHz.
//  Los otros dos son funcbeat: t es el tiempo en segundos.
// =====================================================================

// Cuerpos de fábrica: cada uno devuelve la función que genera el audio.
// Se envuelven en with(Math) para poder escribir sin "Math." (igual que Bytebeat Composer).

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

// Crea la función de un tema, con with(Math) y su estado propio.
function makeGen(body) {
    return new Function('int', 'with (Math) {' + body + '}')(Math.trunc);
}

const MUSIC_SR = 16000;     // frecuencia de salida de la música (16 kHz: menos CPU, sigue sonando bien)
const MUSIC_CHUNK = 4096;   // muestras por bloque (~0.19 s)

class MusicEngine {
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0.6;
        this.out.connect(dest);

        // Cada tema tiene: función, inicio local, peso actual y objetivo, caché (para happy)
        const mk = (src) => ({ fn: makeGen(src), start: null, w: 0, target: 0, cache: null, key: -1 });
        this.gens = { happy: mk(SRC_HAPPY), shock: mk(SRC_SHOCK), addict: mk(SRC_ADDICT) };
        this.gens.happy.w = this.gens.happy.target = 1;

        this.kills = 0;
        this.combo = 0;
        this.section = 'calm';
        this.dark = 0;
        this.darkTarget = 0;
        this.lpL = 0; this.lpR = 0;
        this.running = false;
        this.gen = 0;
        this.sample = 0;       // muestra global renderizada
        this.nextTime = 0;     // momento del contexto en que empieza el próximo bloque
    }

    // ---- control desde el juego ----
    start() {
        if (this.running) return;
        this.running = true;
        const g = ++this.gen;
        this.nextTime = this.ctx.currentTime + 0.08;
        this.loop(g);
    }

    stop() { this.running = false; this.gen++; }

    newRun() {                       // nueva partida: vuelve a empezar desde lo alegre
        this.kills = 0; this.combo = 0;
        for (const k in this.gens) this.gens[k].start = null;
    }

    onKill() { this.kills++; }
    setSection(name) { this.section = name; }
    setCombo(c) { this.combo = c; }

    // ---- lógica de progreso ----
    updateTargets() {
        const k = this.kills;
        this.gens.happy.target = k === 0 ? 1 : 0;                                    // primer enemigo: cambio
        this.gens.shock.target = k === 0 ? 0 : k <= 18 ? 1 : Math.max(0, 1 - (k - 18) / 40);
        this.gens.addict.target = Math.min(1, Math.max(0, (k - 3) / 30));          // poco a poco te engancha
        this.darkTarget = Math.min(1, k / 150 + (this.section === 'boss' ? 0.15 : 0)); // se oscurece
    }

    // ---- render de un bloque de audio ----
    renderChunk(dt) {
        this.updateTargets();
        const ease = Math.min(1, dt * 0.7);               // cambios suaves de ~1.5 s
        for (const k in this.gens) {
            const g = this.gens[k];
            g.w += (g.target - g.w) * ease;
            if (g.w < 0.002 && g.target === 0) g.w = 0;
        }
        this.dark += (this.darkTarget - this.dark) * ease;
        const alpha = 1 - Math.exp(-2 * Math.PI * (14000 * Math.pow(0.06, this.dark)) / MUSIC_SR);
        const drive = 1 + 2 * this.dark;

        const buf = this.ctx.createBuffer(2, MUSIC_CHUNK, MUSIC_SR);
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const active = Object.keys(this.gens).filter(k => this.gens[k].w > 0);

        for (let i = 0; i < MUSIC_CHUNK; i++) {
            const n = this.sample + i;
            let sl = 0, sr = 0;
            for (const k of active) {
                const g = this.gens[k];
                if (g.start === null) g.start = n;
                const loc = n - g.start;
                let vl, vr;
                if (k === 'happy') {
                    const t8 = Math.floor(loc * 8000 / MUSIC_SR);   // bytebeat a 8 kHz
                    if (t8 !== g.key) { g.key = t8; g.cache = g.fn(t8); }
                    vl = g.cache[0]; vr = g.cache[1];
                } else {
                    vl = vr = g.fn(loc / MUSIC_SR, MUSIC_SR);       // funcbeat: segundos
                }
                if (!isFinite(vl)) vl = 0;
                if (!isFinite(vr)) vr = 0;
                sl += g.w * vl; sr += g.w * vr;
            }
            this.lpL += alpha * (sl - this.lpL);     // filtro que oscurece
            this.lpR += alpha * (sr - this.lpR);
            L[i] = Math.tanh(this.lpL * drive) * 0.9;
            R[i] = Math.tanh(this.lpR * drive) * 0.9;
        }
        this.sample += MUSIC_CHUNK;
        return buf;
    }

    // ---- programación en el contexto de audio ----
    loop(g) {
        if (g !== this.gen) return;
        const dt = MUSIC_CHUNK / MUSIC_SR;
        if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
        while (this.nextTime < this.ctx.currentTime + 0.3) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.renderChunk(dt);
            src.connect(this.out);
            src.start(this.nextTime);
            this.nextTime += dt;
        }
        setTimeout(() => this.loop(g), 40);
    }
}