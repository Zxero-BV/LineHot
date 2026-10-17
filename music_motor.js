// =====================================================================
//  MOTOR
// =====================================================================

// Cada tema: fuente, tipo, ritmo (para alinear las transiciones), volumen
// (trim, calibrado para que todos suenen parecido) y tiempos de fundido (s).
//   type 'byte' → t es una muestra entera a `rate` Hz
//   type 'func' → t es el tiempo en segundos
//   major      → al entrar suena un riser + impacto (cambio de "escena")
const MUSIC_TRACKS = {
    happy:  { src: SRC_HAPPY,  type: 'byte', rate: 8000,  beat: 0.6,        bar: 2.4,         trim: 0.90, fadeIn: 2.5, fadeOut: 3.5 },
    shock:  { src: SRC_SHOCK,  type: 'func',              beat: 0.93,       bar: 1.86,        trim: 0.70, fadeIn: 2.5, fadeOut: 5.0 },
    addict: { src: SRC_ADDICT, type: 'func',              beat: 60 / 165,   bar: 240 / 165,   trim: 1.10, fadeIn: 6.0, fadeOut: 7.0 },
    epic:   { src: SRC_EPIC,   type: 'byte', rate: 44100, beat: 0.6192,     bar: 2.4768,      trim: 0.50, clip: 1, heavy: true, fadeIn: 6.0, fadeOut: 7.0, major: true },
    boss:   { src: SRC_BOSS,   type: 'func',              beat: 0.4,        bar: 1.6,         trim: 1.05, fadeIn: 2.5, fadeOut: 5.0, major: true },
    abyss:  { src: SRC_ABYSS,  type: 'func',              beat: 60 / 128,   bar: 240 / 128,   trim: 0.58, fadeIn: 8.0, fadeOut: 8.0, major: true }
};
const MUSIC_ORDER = ['happy', 'shock', 'addict', 'epic', 'boss', 'abyss'];

// Frecuencia interna del motor. Cuanto más alta, más fiel (sobre todo al tema de minijefes a 48 kHz),
// pero más CPU: el coste crece en proporción. Por defecto 24 kHz en PC; 16 kHz en móvil o con
// modo rendimiento activado (se lee al cargar la página).
let MUSIC_SR = (() => {
    let perf = false;
    try { perf = !!JSON.parse(localStorage.getItem('neonCarnageSettings') || '{}').perf; } catch (e) {}
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return (touch || perf) ? 16000 : 24000;
})();
const MUSIC_FRAMES = 4096;    // fotogramas de salida por bloque (~90 ms)
const MUSIC_LOOKAHEAD = 0.4;  // segundos que se preparan por adelantado (colchón si el juego se atasca)
const MUSIC_BAND_HZ = 180;    // corte del "intercambio de graves" entre temas
const MUSIC_TWO_PI = Math.PI * 2;

const musClamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const musStep = (a, b, x) => { x = musClamp01((x - a) / (b - a)); return x * x * (3 - 2 * x); };

// Crea la función de un tema, con with(Math) y su estado propio.
// Q = ajustes de calidad compartidos (Q.n: capas del tema epic).
function makeGen(body, Q) {
    return new Function('int', 'Q', 'with (Math) {' + body + '}')(Math.trunc, Q);
}

class MusicEngine {
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.level = 0.6;
        this.out = ctx.createGain();
        this.out.gain.value = this.level;
        this.out.connect(dest);

        // Calidad: en pantallas táctiles (móviles) el tema epic se calcula con menos capas y
        // a media resolución; en PC, completo. Si el dispositivo va justo, baja solo.
        this.touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        this.Q = this.touch ? { n: 8, hold: true } : { n: 16, hold: false };
        this.gens = {};
        for (const k of MUSIC_ORDER) {
            this.gens[k] = Object.assign({
                id: k, fn: null, on: false, start: null, w: 0, ws: 0, target: 0, key: -1, cache: null,
                sL: 0, sR: 0, lL: 0, lR: 0, sa: 1, gl: 0, gh: 0, broken: false, xL: 0, xR: 0, dL: 0, dR: 0
            }, MUSIC_TRACKS[k]);
        }
        this.list = MUSIC_ORDER.map(k => this.gens[k]);
        this.active = [];

        this.running = false;
        this.fading = false;
        this.fadeEnd = 0;
        this.gen = 0;
        this.timer = 0;
        this.sources = new Set();
        this.baseFrame = 0;
        this.framesDone = 0;
        this.cpu = 0;
        this.slowChunks = 0;

        this.bandA = 1 - Math.exp(-MUSIC_TWO_PI * MUSIC_BAND_HZ / MUSIC_SR);
        this.n = 0;                                   // muestra global (a MUSIC_SR) ya generada
        this.frac = 0.999999;
        this.s0L = this.s0R = this.s1L = this.s1R = 0;
        this.oL = this.oR = 0;

        this.hardReset();
    }

    // ================= control desde el juego =================
    start() {
        const now = this.ctx.currentTime;
        if (this.running) {
            if (this.fading) {                        // se estaba apagando: vuelve suavemente
                this.fading = false;
                this.out.gain.cancelScheduledValues(now);
                this.out.gain.setValueAtTime(this.out.gain.value, now);
                this.out.gain.linearRampToValueAtTime(this.level, now + 0.4);
            }
            return;
        }
        this.running = true;
        this.fading = false;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(0.0001, now);
        this.out.gain.linearRampToValueAtTime(this.level, now + 0.5);
        this.baseFrame = Math.ceil((now + 0.08) * this.ctx.sampleRate);
        this.framesDone = 0;
        this.loop(++this.gen);
    }

    // Sin fundido: corta ya. Con fade (s): la música se "apaga" bajando volumen y cerrando el filtro.
    stop(fade = 0) {
        if (!this.running) return;
        if (fade <= 0) { this.finishStop(); return; }
        if (this.fading) return;
        const now = this.ctx.currentTime;
        this.fading = true;
        this.fadeEnd = now + fade + 0.1;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
        this.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    }

    finishStop() {
        this.running = false;
        this.fading = false;
        this.gen++;
        clearTimeout(this.timer);
        for (const s of this.sources) { try { s.stop(); s.disconnect(); } catch (e) {} }
        this.sources.clear();
        const now = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setValueAtTime(0.0001, now);
    }

    // Nueva partida o vuelta al menú. Si la música sigue sonando, vuelve al tema alegre con
    // una transición normal (sin cortes). Si estaba parada, empieza de cero.
    newRun() {
        if (this.fading) this.finishStop();
        if (!this.running) { this.hardReset(); return; }
        this.kills = 0; this.waveKills = 0; this.wave = 0; this.combo = 0;
        this.section = 'idle';
        this.urgent = true;
    }

    onKill() {
        this.kills++; this.waveKills++;
        if (this.kills === 1) this.urgent = true;     // primer enemigo: cambio de tema sin esperar al compás
    }
    setSection(name) {
        if (name === this.section) return;
        if (name === 'boss' || this.section === 'boss') this.urgent = true;
        this.section = name;
    }
    setWave(w) { this.wave = w; this.waveKills = 0; }
    setCombo(c) { this.combo = c; }
    setHealth(f) { this.hp = musClamp01(f); }
    setLevel(v) {
        this.level = v;
        if (this.running && !this.fading) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
    setQuality(lite) {
        const low = lite || this.touch;
        this.Q.n = low ? 8 : 16;
        this.Q.hold = low;
    }

    // Para depurar desde la consola:  audio.music.getState()
    getState() {
        const t = {};
        for (const g of this.list) if (g.on) t[g.id] = { w: +g.w.toFixed(2), target: +g.target.toFixed(2) };
        return { kills: this.kills, wave: this.wave, prog: +this.prog().toFixed(2), section: this.section, pending: !!this.pending, cpu: +this.cpu.toFixed(2), tracks: t };
    }

    // ================= director =================
    hardReset() {
        this.kills = 0; this.waveKills = 0; this.wave = 0; this.combo = 0;
        this.section = 'idle';
        this.hp = 1;
        this.energy = 0; this.calm = 0; this.bossF = 0; this.lowhp = 0; this.dark = 0;
        this.tone = 0; this.toneT = 0; this.drive = 1; this.driveT = 1; this.ga = 1;
        this.f1L = this.f1R = this.f2L = this.f2R = 0;
        this.pending = null; this.fx = null; this.urgent = false;
        this.nzPrev = 0; this.fxPh = 0;
        for (const g of this.list) {
            g.on = false; g.start = null; g.w = g.ws = g.target = 0;
            g.key = -1; g.cache = null; g.sL = g.sR = g.lL = g.lR = g.xL = g.xR = g.dL = g.dR = 0; g.broken = false;
        }
        const h = this.gens.happy;
        h.on = true; h.start = this.n; h.w = h.ws = h.target = 1;
        h.fn = makeGen(h.src, this.Q);
        this.refreshActive();
    }

    refreshActive() { this.active = this.list.filter(g => g.on); }

    // Progreso global: oleada actual + avance dentro de ella (0, 1, 2…). Sin oleadas, por kills.
    prog() {
        if (this.wave > 0) return (this.wave - 1) + Math.min(0.95, this.waveKills / (22 + 8 * this.wave));
        return this.kills / 30;
    }

    // Qué debe sonar ahora (presencia de cada tema entre 0 y 1).
    computeDesired() {
        const d = { happy: 0, shock: 0, addict: 0, epic: 0, boss: 0, abyss: 0 };
        if (this.section === 'boss') { d.boss = 1; return d; }
        if (this.kills === 0) { d.happy = 1; return d; }           // alegre hasta el primer enemigo
        const p = this.prog();
        d.shock  = 1 - musStep(1.0, 2.4, p);
        d.addict = musStep(0.3, 1.8, p) * (1 - musStep(5.0, 7.0, p));
        d.epic   = musStep(3.2, 4.8, p) * (1 - musStep(8.8, 10.8, p));
        d.abyss  = musStep(8.4, 10.4, p);
        return d;
    }

    refTrack() {
        let best = null;
        for (const g of this.active) {
            if (g.start !== null && this.n >= g.start && g.w > 0.05 && (!best || g.ws > best.ws)) best = g;
        }
        return best;
    }

    // Si lo que debe sonar cambió, programa el cambio para el próximo compás (o pulso, si es urgente)
    // del tema dominante. Así el tema nuevo entra siempre en un tiempo fuerte.
    checkSchedule() {
        if (this.pending) return;
        const des = this.computeDesired();
        let diff = false, major = false;
        for (const g of this.list) {
            const want = des[g.id];
            if (Math.abs(want - g.target) > 0.03) diff = true;
            if (want > 0.001 && !g.on && g.major) major = true;
        }
        if (!diff) return;
        const ref = this.refTrack();
        let at = this.n + 1;
        if (ref) {
            const unit = (this.urgent ? ref.beat : ref.bar) * MUSIC_SR;
            const lead = major ? 0.9 * MUSIC_SR : 0;          // los cambios de escena avisan con un riser
            const k = Math.ceil((this.n + lead - ref.start) / unit);
            at = ref.start + Math.round(k * unit);
            if (at <= this.n) at = this.n + 1;
        }
        this.urgent = false;
        this.pending = { at };
        if (major) this.fx = { from: this.n, hit: at };
    }

    commit(n) {
        const des = this.computeDesired();
        let major = false;
        for (const g of this.list) {
            const want = des[g.id];
            if (want > 0.001 && !g.on) {                      // entra un tema: arranca desde el principio, en el tiempo fuerte
                g.on = true; g.start = n; g.key = -1; g.cache = null; g.w = 0; g.ws = 0;
                g.sL = g.sR = g.lL = g.lR = g.xL = g.xR = g.dL = g.dR = 0; g.broken = false;
                g.fn = makeGen(g.src, this.Q);
                if (g.major) major = true;
            }
            g.target = want < 0.001 ? 0 : want;
        }
        if (major && !this.fx) this.fx = { from: n, hit: n };
        this.pending = null;
        this.refreshActive();
    }

    // Se llama una vez por bloque: suaviza los macros y mueve los pesos hacia sus objetivos.
    macros(dt) {
        const k = (tau) => 1 - Math.exp(-dt / tau);
        const energyT = musClamp01(this.combo / 18);
        this.energy += (energyT - this.energy) * k(energyT > this.energy ? 0.5 : 4);
        this.calm += ((this.section === 'calm' ? 1 : 0) - this.calm) * k(1);
        this.bossF += ((this.section === 'boss' ? 1 : 0) - this.bossF) * k(1.5);
        this.lowhp += (musClamp01((0.38 - this.hp) / 0.26) - this.lowhp) * k(0.6);
        this.dark += (musClamp01(this.prog() / 12) - this.dark) * k(3);

        // El sonido se oscurece con el progreso y en peligro; se abre con el combo.
        this.toneT = musClamp01(this.dark * 0.55 + this.calm * 0.22 + this.lowhp * 0.55 + this.bossF * 0.08 - this.energy * 0.3 + (this.fading ? 0.9 : 0));
        this.driveT = 1 + 1.4 * this.dark + 0.4 * this.bossF + 0.35 * this.energy;

        this.checkSchedule();

        for (const g of this.list) {
            if (!g.on) continue;
            if (g.w < g.target) g.w = Math.min(g.target, g.w + dt / g.fadeIn);
            else g.w = Math.max(g.target, g.w - dt / ((this.section === 'boss' || this.section === 'mini')
                ? Math.min(g.fadeOut, 1.4)   // al entrar a un jefe/minijefe los temas viejos se apagan rápido (evita 3-4 temas a la vez)
                : g.fadeOut));
        }
        let gone = false;
        for (const g of this.list) {
            if (g.on && g.target === 0 && g.w <= 0.002 && g.ws < 0.004) { g.on = false; g.start = null; g.w = g.ws = 0; gone = true; }
        }
        if (gone) this.refreshActive();
    }

    // ================= síntesis =================
    // Coeficientes que se refrescan cada 64 muestras (más barato que cada muestra).
    coefs() {
        this.tone += (this.toneT - this.tone) * 0.02;
        this.drive += (this.driveT - this.drive) * 0.02;
        const cut = 7000 * Math.pow(0.12, this.tone);
        this.ga = 1 - Math.exp(-MUSIC_TWO_PI * cut / MUSIC_SR);
        for (const g of this.active) {
            g.ws += (g.w - g.ws) * 0.12;
            g.gh = Math.sin(g.ws * Math.PI / 2);                              // agudos: potencia constante
            g.gl = Math.sin(musStep(0.3, 0.9, g.ws) * Math.PI / 2);           // graves: entran más tarde y salen antes
            g.sa = 1 - Math.exp(-MUSIC_TWO_PI * (350 * Math.pow(46, g.ws)) / MUSIC_SR);  // el tema "se abre" al entrar
        }
    }

    // Genera UNA muestra a MUSIC_SR en this.oL / this.oR
    sample() {
        const n = this.n++;
        if (this.pending && n >= this.pending.at) this.commit(n);
        if ((n & 63) === 0) this.coefs();

        let sl = 0, sr = 0;
        const act = this.active;
        for (let i = 0; i < act.length; i++) {
            const g = act[i];
            if (g.start === null || n < g.start) continue;
            const loc = n - g.start;
            let v, vl, vr;
            try {
                if (g.type === 'byte') {
                    const tt = Math.floor(loc * g.rate / MUSIC_SR);
                    if (tt !== g.key && !(g.heavy && this.Q.hold && (loc & 1))) { g.key = tt; g.cache = g.fn(tt); }
                    v = g.cache;
                } else {
                    v = g.fn(loc / MUSIC_SR, MUSIC_SR);
                }
            } catch (e) { g.broken = true; g.fn = () => 0; v = 0; }
            if (typeof v === 'number') { vl = vr = v; }
            else if (v) { vl = v[0]; vr = v.length > 1 ? v[1] : v[0]; }
            else { vl = vr = 0; }
            if (g.clip) {                                 // como en Bytebeat Composer: recorta a ±clip
                vl = vl > g.clip ? g.clip : vl < -g.clip ? -g.clip : vl;
                vr = vr > g.clip ? g.clip : vr < -g.clip ? -g.clip : vr;
            }
            if (!(vl > -6 && vl < 6)) vl = 0;             // descarta NaN / infinitos / valores locos
            if (!(vr > -6 && vr < 6)) vr = 0;
            // bloqueador de continua (quita el desfase que algunas fórmulas arrastran)
            const yl = vl - g.xL + 0.998 * g.dL, yr = vr - g.xR + 0.998 * g.dR;
            g.xL = vl; g.xR = vr; g.dL = yl; g.dR = yr; vl = yl; vr = yr;

            g.sL += g.sa * (vl - g.sL); g.sR += g.sa * (vr - g.sR);                // filtro que se abre
            g.lL += this.bandA * (g.sL - g.lL); g.lR += this.bandA * (g.sR - g.lR); // separa graves
            sl += (g.lL * g.gl + (g.sL - g.lL) * g.gh) * g.trim;
            sr += (g.lR * g.gl + (g.sR - g.lR) * g.gh) * g.trim;
        }

        // Riser antes de un cambio de escena + impacto en el tiempo fuerte
        const fx = this.fx;
        if (fx) {
            let v = 0;
            if (n < fx.hit) {
                const u = (n - fx.from) / Math.max(1, fx.hit - fx.from);
                const nz = Math.random() * 2 - 1;
                this.fxPh += MUSIC_TWO_PI * 180 * Math.pow(8, u) / MUSIC_SR;
                v = ((nz - this.nzPrev) * 0.5 + Math.sin(this.fxPh) * 0.35) * u * u * u * u * 0.22;
                this.nzPrev = nz;
            } else {
                const tau = (n - fx.hit) / MUSIC_SR;
                if (tau > 1.8) this.fx = null;
                else v = Math.sin(MUSIC_TWO_PI * (46 * tau + 40 * (1 - Math.exp(-tau * 11)) / 11)) * Math.exp(-tau * 3) * 0.6
                       + (Math.random() * 2 - 1) * Math.exp(-tau * 10) * 0.18;
            }
            sl += v; sr += v;
        }

        // Filtro global de 2 polos (oscurece) + saturación suave
        const a = this.ga;
        this.f1L += a * (sl - this.f1L); this.f2L += a * (this.f1L - this.f2L);
        this.f1R += a * (sr - this.f1R); this.f2R += a * (this.f1R - this.f2R);
        const dr = this.drive, comp = 0.9 / (1 + 0.15 * (dr - 1));
        let ol = Math.tanh(this.f2L * dr) * comp, or = Math.tanh(this.f2R * dr) * comp;

        // Latido cuando queda poca vida (no pasa por el filtro, siempre se oye)
        if (this.lowhp > 0.02) {
            const period = 0.95 - 0.35 * this.lowhp;
            const u = (n / MUSIC_SR) % period, u2 = u - 0.2;
            let hb = Math.sin(MUSIC_TWO_PI * 58 * u) * Math.exp(-u * 20) + 0.5 * Math.sin(MUSIC_TWO_PI * 95 * u) * Math.exp(-u * 26);
            if (u2 > 0) hb += 0.7 * (Math.sin(MUSIC_TWO_PI * 58 * u2) * Math.exp(-u2 * 20) + 0.5 * Math.sin(MUSIC_TWO_PI * 95 * u2) * Math.exp(-u2 * 26));
            hb *= 0.4 * this.lowhp;
            ol += hb; or += hb;
        }
        this.oL = ol > 1 ? 1 : ol < -1 ? -1 : ol;
        this.oR = or > 1 ? 1 : or < -1 ? -1 : or;
    }

    // Un bloque de audio a la frecuencia real del dispositivo (interpolando desde MUSIC_SR).
    // Al usar la misma frecuencia que el contexto y tiempos exactos, los bloques empalman sin clics.
    renderChunk(F, dur) {
        this.macros(dur);
        const buf = this.ctx.createBuffer(2, F, this.ctx.sampleRate);
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const step = MUSIC_SR / this.ctx.sampleRate;
        let s0L = this.s0L, s0R = this.s0R, s1L = this.s1L, s1R = this.s1R, frac = this.frac;
        for (let i = 0; i < F; i++) {
            frac += step;
            while (frac >= 1) {
                frac -= 1;
                s0L = s1L; s0R = s1R;
                this.sample();
                s1L = this.oL; s1R = this.oR;
            }
            L[i] = s0L + (s1L - s0L) * frac;
            R[i] = s0R + (s1R - s0R) * frac;
        }
        this.s0L = s0L; this.s0R = s0R; this.s1L = s1L; this.s1R = s1R; this.frac = frac;
        return buf;
    }

    // ================= programación en el contexto de audio =================
    loop(id) {
        if (id !== this.gen) return;
        const ctx = this.ctx, sr = ctx.sampleRate, F = MUSIC_FRAMES, dur = F / sr;
        for (let guard = 0; guard < 8; guard++) {
            const when = (this.baseFrame + this.framesDone) / sr;
            if (when > ctx.currentTime + MUSIC_LOOKAHEAD) break;
            if (when < ctx.currentTime + 0.01) {                 // nos quedamos cortos: reenganchar
                this.baseFrame = Math.ceil((ctx.currentTime + 0.06) * sr);
                this.framesDone = 0;
                continue;
            }
            const t0 = performance.now();
            const buf = this.renderChunk(F, dur);
            this.cpu += ((performance.now() - t0) / 1000 / dur - this.cpu) * 0.1;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(this.out);
            src.onended = () => { this.sources.delete(src); src.disconnect(); };
            this.sources.add(src);
            src.start(when);
            this.framesDone += F;
        }
        // Si el dispositivo va justo de CPU, aligera el tema epic (el más pesado)
        if (this.cpu > 0.6) {
            if (++this.slowChunks > 40) {
                this.slowChunks = 0;
                if (!this.Q.hold) this.Q.hold = true; else if (this.Q.n > 6) this.Q.n = 6;
            }
        } else this.slowChunks = 0;

        if (this.fading && ctx.currentTime >= this.fadeEnd) { this.finishStop(); return; }
        this.timer = setTimeout(() => this.loop(id), 30);
    }
}

