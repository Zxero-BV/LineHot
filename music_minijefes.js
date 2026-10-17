// =====================================================================
//  TEMA DE MINIJEFES (antes music_mini.js, va DESPUÉS de la música base)
// =====================================================================

// =====================================================================
//  TEMA "MINIJEFES" — bytebeat (t = muestra entera)
//  Se usa en las oleadas con minijefes (cada 4 oleadas, salvo las de jefe).
//  Cargar DESPUÉS de music.js y ANTES de game.js.
// =====================================================================

// El filtro "l" conserva su valor entre muestras (como en el bytebeat original).
// Se reinicia solo en t = 0.
const SRC_MINI = `
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
};`;

const MINI_RATE = 48000;   // Floatbeat a 48000 Hz (estéreo), como en la captura de Bytebeat Composer

// Registro del tema en el director (usa las constantes de music.js)
MUSIC_TRACKS.mini = {
    src: SRC_MINI, type: 'byte', rate: MINI_RATE,
    beat: 8192 / 48000, bar: 4 * 8192 / 48000,   // la melodía avanza cada 8192 muestras (~0.17 s a 48 kHz)
    trim: 1.0, fadeIn: 2.5, fadeOut: 4.0, major: true
};
MUSIC_ORDER.push('mini');

// El director pasa a 'mini' en las oleadas de minijefes: suena solo este tema.
const _computeDesiredBase = MusicEngine.prototype.computeDesired;
MusicEngine.prototype.computeDesired = function () {
    const d = _computeDesiredBase.call(this);
    if (this.section === 'mini') { for (const k in d) d[k] = 0; d.mini = 1; }
    else d.mini = 0;
    return d;
};

// Modo "raw": mientras suena solo este tema, se desactivan el filtro que oscurece,
// la saturación y la separación de graves, para escuchar la fórmula tal cual.
const _coefsBase = MusicEngine.prototype.coefs;
MusicEngine.prototype.coefs = function () {
    _coefsBase.call(this);
    const mini = this.gens.mini;
    const raw = this.section === 'mini' && mini && mini.on && this.active.length === 1;
    if (!raw) return;
    this.ga = 1;
    this.drive = 1;
    mini.sa = 1;
    mini.gl = mini.gh;
};