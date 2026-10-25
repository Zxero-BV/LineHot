// =====================================================================
//  render_musica.js — herramienta de desarrollo (NO la carga el juego)
//  Genera los MP3 en bucle de la carpeta musica/ a partir de las fórmulas
//  originales (herramientas/fuentes_temas.js).
//  Uso:  node herramientas/render_musica.js                 (renderiza TODOS los temas; necesita ffmpeg)
//        node herramientas/render_musica.js incoming techno  (solo esos; los demás MP3 y su meta no se tocan)
// =====================================================================
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = require('./fuentes_temas.js');
const OUT_SR = 44100;
const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'musica');
fs.mkdirSync(DIR, { recursive: true });

const MATH_NAMES = Object.getOwnPropertyNames(Math).filter(k => /^[A-Za-z_$][\w$]*$/.test(k)).join(',');
const makeGen = (body, Q) => new Function('int', 'Q', 'const {' + MATH_NAMES + '} = Math; return (function () {' + body + '\n})();')(Math.trunc, Q);

// seg = duración del bucle (s). Debe caer en un número entero de compases / periodos de la fórmula.
const T = {
    happy:  { type: 'byte', rate: 8000,  trim: 0.90, bar: 2.4,        beat: 0.6,       seg: 57.6 },                 // 24 compases (periodo exacto de la fórmula)
    shock:  { type: 'func',              trim: 0.70, bar: 1.86,       beat: 0.93,      seg: 128 / 4.3 },            // 8 vueltas de la secuencia de 16 notas
    addict: { type: 'func',              trim: 1.10, bar: 240 / 165,  beat: 60 / 165,  seg: 64 * 60 / 165 },       // 16 compases
    epic:   { type: 'byte', rate: 44100, trim: 0.50, bar: 2.4768,     beat: 0.6192,    seg: 2 * 262144 * 0.6 / 44100 * 1 / 0.6 * 0.6 / 0.6, clip: 1 },   // 2 periodos (se corrige abajo)
    boss:   { type: 'func',              trim: 1.05, bar: 1.6,        beat: 0.4,       seg: 25.6 },                 // 16 compases
    abyss:  { type: 'func',              trim: 0.58, bar: 240 / 128,  beat: 60 / 128,  seg: 30 },                   // 16 compases
    mini:   { type: 'byte', rate: 48000, trim: 1.0,  bar: 4 * 8192 / 48000, beat: 8192 / 48000, seg: 2 * 524288 / 48000 },  // 2 periodos
    // ---- v2.12 (fórmulas de Dollchan). intro = segundos que suenan UNA vez antes del bucle · mono = MP3 de un solo canal (la fórmula es mono: mitad de peso y de memoria)
    // incoming: 1 sección (compás) = 131072 y-unidades = 70217,14 muestras. Intro = 16 secciones (arpegio → +bajo → +acordes), bucle = 12 secciones (3 ciclos: el patrón de acordes tarda 3 en repetirse) con todas las capas.
    incoming: { type: 'byte', rate: 44100, trim: 1.0, mono: true, bar: 70217.14 / 44100, beat: 70217.14 / 44100 / 4, intro: 1123474 / 44100, seg: 842606 / 44100 },
    // (misterio — «song_misterioso» — ya no se usa en el juego: su fórmula sigue en fuentes_temas.js; para renderizarlo añade aquí { type:'byte', rate:22050, mono:true, bar:65536/22050, beat:16384/22050, seg:512*4096/22050 })
    // techno: r = t·0,95 → 16 compases de 65536 r = 1048576 r = 1103764 muestras (25,03 s)
    techno: { type: 'byte', rate: 44100, trim: 1.0, bar: 65536 / 0.95 / 44100, beat: 16384 / 0.95 / 44100, seg: 1048576 / 0.95 / 44100 }
};
// epic: t' = t * 0.6 ; el patrón de 32 pasos de 8192 dura 262144 t' = 436906.67 muestras → 2 periodos
T.epic.seg = 2 * (262144 / 0.6) / 44100;

function render(id) {
    const d = T[id], I = Math.round((d.intro || 0) * OUT_SR), N = I + Math.round(d.seg * OUT_SR), X = Math.round(0.14 * OUT_SR);   // I = intro (suena una vez) · X = solape para unir final con principio del bucle
    const total = N + X;
    const fn = makeGen(SRC[id], { n: 16, hold: false });
    const L = new Float32Array(total), R = new Float32Array(total);
    let key = -1, cl = 0, cr = 0, xl = 0, xr = 0, dl = 0, dr = 0;
    for (let i = 0; i < total; i++) {
        let v;
        if (d.type === 'byte') {
            const tt = Math.floor(i * d.rate / OUT_SR);
            if (tt !== key) { key = tt; const r = fn(tt); cl = typeof r === 'number' ? r : (r ? r[0] : 0); cr = typeof r === 'number' ? r : (r ? (r.length > 1 ? r[1] : r[0]) : 0); }
        } else {
            const r = fn(i / OUT_SR, OUT_SR);
            cl = typeof r === 'number' ? r : (r ? r[0] : 0); cr = typeof r === 'number' ? r : (r ? (r.length > 1 ? r[1] : r[0]) : 0);
        }
        let vl = cl, vr = cr;
        if (d.clip) { vl = Math.max(-d.clip, Math.min(d.clip, vl)); vr = Math.max(-d.clip, Math.min(d.clip, vr)); }
        if (!(vl > -6 && vl < 6)) vl = 0; if (!(vr > -6 && vr < 6)) vr = 0;
        const yl = vl - xl + 0.998 * dl, yr = vr - xr + 0.998 * dr;      // bloqueador de continua (igual que el motor antiguo)
        xl = vl; xr = vr; dl = yl; dr = yr;
        L[i] = yl * d.trim; R[i] = yr * d.trim;
    }
    // --- bucle sin costura: el principio se mezcla con la continuación natural del final
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < X; i++) { num += L[I + i] * L[N + i]; da += L[I + i] * L[I + i]; db += L[N + i] * L[N + i]; }
    const corr = num / Math.sqrt(da * db + 1e-12);
    const outL = new Float32Array(N), outR = new Float32Array(N);
    for (let i = 0; i < N; i++) { outL[i] = L[i]; outR[i] = R[i]; }
    for (let i = 0; i < X; i++) {
        const x = i / X;                                           // 0 → suena la cola, 1 → suena el principio
        const gt = corr > 0.7 ? 1 - x : Math.cos(x * Math.PI / 2), gh = corr > 0.7 ? x : Math.sin(x * Math.PI / 2);
        outL[I + i] = L[I + i] * gh + L[N + i] * gt; outR[I + i] = R[I + i] * gh + R[N + i] * gt;
    }
    return { L: outL, R: outR, N, I, corr };
}

const IDS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(T);
for (const id of IDS) if (!T[id]) { console.error('Tema desconocido:', id); process.exit(1); }
const META = path.join(__dirname, 'musica_meta.json');
const meta = (process.argv.slice(2).length && fs.existsSync(META)) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
const rendered = {};
for (const id of IDS) {
    const t0 = Date.now();
    const r = render(id); rendered[id] = r;
    let s = 0; for (let i = 0; i < r.N; i++) s += (r.L[i] * r.L[i] + r.R[i] * r.R[i]) / 2;
    r.rms = Math.sqrt(s / r.N);
    console.log(id.padEnd(7), (r.N / OUT_SR).toFixed(2) + ' s', 'rms', r.rms.toFixed(3), 'corr', r.corr.toFixed(2), (Date.now() - t0) + ' ms');
}
// Nivelar todos al mismo volumen medio (en el juego cada tema ya no recibe ganancia propia) y limitar picos suavemente
const OBJETIVO = 0.19;
for (const id of IDS) {
    const r = rendered[id], g = OBJETIVO / Math.max(r.rms, 1e-6), mono = !!T[id].mono;
    let pk = 0;
    const buf = Buffer.alloc(r.N * (mono ? 4 : 8));
    for (let i = 0; i < r.N; i++) {
        // limitador suave: lineal hasta ~0.7 y curva tanh por encima (sin recortar de golpe)
        const f = (x) => { x *= g; const a = Math.abs(x); const y = a < 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28); return x < 0 ? -y : y; };
        const l = f(r.L[i]), rr = f(r.R[i]);
        pk = Math.max(pk, Math.abs(l), Math.abs(rr));
        if (mono) buf.writeFloatLE(l, i * 4); else { buf.writeFloatLE(l, i * 8); buf.writeFloatLE(rr, i * 8 + 4); }
    }
    const raw = path.join(DIR, id + '.f32'), mp3 = path.join(DIR, id + '.mp3');
    fs.writeFileSync(raw, buf);
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(OUT_SR), '-ac', mono ? '1' : '2', '-i', raw,
        '-c:a', 'libmp3lame', '-b:a', mono ? '80k' : '112k', '-joint_stereo', '1', '-id3v2_version', '0', '-write_id3v1', '0', mp3]);
    fs.unlinkSync(raw);
    meta[id] = { n: r.N, bar: T[id].bar, beat: T[id].beat, pico: +pk.toFixed(3), kb: Math.round(fs.statSync(mp3).size / 1024) };
    if (r.I) meta[id].intro = r.I;
    if (mono) meta[id].mono = true;
    console.log(id.padEnd(7), 'pico', pk.toFixed(2), meta[id].kb + ' KB');
}
fs.writeFileSync(META, JSON.stringify(meta, null, 1));
console.log('Total KB:', Object.values(meta).reduce((a, m) => a + m.kb, 0));
