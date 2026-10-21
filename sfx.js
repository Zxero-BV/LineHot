// =====================================================================
//  EFECTOS DE SONIDO — oscuros, frenéticos y saturados
//  Base: MI FRIGIO (E F G A B C D): la segunda menor (F) da tensión y el
//  tritono (E-Bb) da el toque siniestro. Mismo centro tonal que el tema
//  "abyss" (mi frigio) y tempo de 165 BPM (la rejilla de semicorcheas).
//  Técnicas: bajos de sierra desafinados una octava abajo + sub cuadrado,
//  envolventes de filtro con ataque rápido, saturación fuerte, FM metálico
//  con relación de tritono, y pinchazos que caen de tono.
//  Los sonidos críticos (explosión, golpe al jugador, pulso) nunca se descartan.
// =====================================================================

const SFX_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let SFX_LITE = false;                           // se activa solo si el audio se entrecorta (ver MusicEngine.noteResync)
const SFX_MAX_VOICES = SFX_TOUCH ? 14 : 24;     // cada voz son varios nodos: en móvil saturaban el hilo de audio

// Nivel de carga del audio: 0 = normal · 1 = el motor va apretado (sin reverb larga, menos capas) · 2 = se está cortando (modo ligero).
// Se sube antes de que se corte: si la música gasta más de ~45 % de su tiempo o hubo un corte hace menos de 6 s.
const sfxLevel = () => {
    if (SFX_LITE) return 2;
    const m = typeof audio !== 'undefined' && audio.music;
    if (!m) return 0;
    return (m.cpu > 0.45 || performance.now() - (m.lastResync || -1e9) < 6000) ? 1 : 0;
};
let _sfxVoices = 0;

const SFX_BPM = 165;
const SFX_STEP = 60 / SFX_BPM / 4;
const SFX_PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];   // E F G A B C D
const SFX_ROOT = 64;                            // E4
const sfxMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const sfxNote = (deg, oct = 0) => SFX_ROOT + SFX_PHRYGIAN[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
const SFX_TRITONE = 6;                          // E -> Bb: el intervalo "siniestro"

// Siguiente semicorchea de la rejilla, anclada al inicio de la música
const sfxGrid = (c, t) => {
    const t0 = (audio.music && audio.music.baseFrame) ? audio.music.baseFrame / c.sampleRate : 0;
    return t0 + Math.ceil((t - t0) / SFX_STEP - 1e-6) * SFX_STEP;
};

const sfxFilter = (c, type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
const sfxOsc = (c, type, f0, f1, t, d) => {
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && d > 0) o.frequency.exponentialRampToValueAtTime(f1, t + d);
    return o;
};
const sfxEnv = (g, t, peak, attack, decay) => {
    const a = Math.max(attack, 0.0005);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
};
const sfxSweep = (param, f0, f1, t, d) => { param.setValueAtTime(f0, t); param.exponentialRampToValueAtTime(f1, t + d); };
// Saturación fuerte y bitcrush opcional: lo "sucio" y oscuro
const _sfxCurves = new Map();                     // cada curva se calcula una sola vez (antes: 1024 tanh en cada sonido)
const sfxCurve = (k, levels = 0) => {
    const key = k + '|' + levels, hit = _sfxCurves.get(key);
    if (hit) return hit;
    const n = 1024, c = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        let y = Math.tanh(k * x) / norm;
        if (levels) y = Math.round(y * levels) / levels;
        c[i] = y;
    }
    _sfxCurves.set(key, c);
    return c;
};
// Envolvente y saturación al final de la cadena
const sfxDirty = (c, o, t, d, peak, k = 14, levels = 0) => {
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k, levels); sh.oversample = d > 0.3 ? '2x' : 'none';
    sfxEnv(g, t, peak, 0.001, d);
    o.connect(sh); sh.connect(g);
    return g;
};
// Bajo oscuro: dos sierras desafinadas una octava abajo + sub cuadrado, filtro que cae
const sfxDarkBass = (c, t, midi, d, peak, k = 18) => {
    const a = sfxOsc(c, 'sawtooth', sfxMidi(midi - 12) * 0.99, sfxMidi(midi - 12) * 0.8, t, d);
    const b = sfxOsc(c, 'sawtooth', sfxMidi(midi - 12) * 1.01, sfxMidi(midi - 12) * 0.8, t, d);
    const sub = sfxOsc(c, 'square', sfxMidi(midi - 24), sfxMidi(midi - 24) * 0.9, t, d);
    const mix = c.createGain(); mix.gain.value = 0.35;
    a.connect(mix); b.connect(mix); sub.connect(mix);
    const lp = sfxFilter(c, 'lowpass', 900, 4);
    sfxSweep(lp.frequency, 900, 90, t, d);
    mix.connect(lp);
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k); sh.oversample = d > 0.3 ? '2x' : 'none';   // el sobremuestreo solo compensa en sonidos largos
    sfxEnv(g, t, peak, 0.001, d);
    lp.connect(sh); sh.connect(g);
    [a, b, sub].forEach((o) => { o.start(t); o.stop(t + d + 0.03); });
    return g;
};
// Pinchazo: sierra + cuadrada desafinadas, filtro que cierra, saturación
const sfxStab = (c, t, f0, f1, d, peak, k = 16) => {
    const a = sfxOsc(c, 'sawtooth', f0, f1, t, d), b = sfxOsc(c, 'square', f0 * 1.007, f1 * 1.007, t, d);
    const mix = c.createGain(); mix.gain.value = 0.5;
    a.connect(mix); b.connect(mix);
    const lp = sfxFilter(c, 'lowpass', 3500, 3);
    sfxSweep(lp.frequency, 3500, 200, t, d);
    mix.connect(lp);
    const sh = c.createWaveShaper(), g = c.createGain();
    sh.curve = sfxCurve(k); sh.oversample = d > 0.3 ? '2x' : 'none';
    sfxEnv(g, t, peak, 0.001, d);
    lp.connect(sh); sh.connect(g);
    a.start(t); a.stop(t + d + 0.02); b.start(t); b.stop(t + d + 0.02);
    return g;
};
// Campana FM metálica: relación 1.414 (tritono) da un timbre inarmónico y siniestro
const sfxFMMetal = (c, f, idx, t, d, peak) => {
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.setValueAtTime(f, t); mod.frequency.setValueAtTime(f * 1.414, t);
    mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(0.01, t + d);
    mod.connect(mg); mg.connect(car.frequency);
    sfxEnv(g, t, peak, 0.001, d); car.connect(g);
    car.start(t); mod.start(t); car.stop(t + d + 0.05); mod.stop(t + d + 0.05);
    return g;
};

// ---------- infraestructura: ruido y salas ----------
AudioEngine.prototype._sfxInit = function () {
    if (this._sfx) return this._sfx;
    const c = this.ctx, sr = c.sampleRate;
    const noise = c.createBuffer(1, sr, sr), nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const makeIR = (sec, pow) => {
        const len = Math.floor(sr * sec), ir = c.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, pow);
        }
        return ir;
    };
    const dry = c.createGain(); dry.connect(this.master);
    const room = c.createConvolver(); room.buffer = makeIR(0.3, 3);
    const roomOut = c.createGain(); roomOut.gain.value = 0.3; room.connect(roomOut); roomOut.connect(this.master);
    const hall = c.createConvolver(); hall.buffer = makeIR(SFX_TOUCH ? 0.9 : 1.4, 2);   // la reverb larga es lo que más cuesta al hilo de audio
    const hallOut = c.createGain(); hallOut.gain.value = 0.4; hall.connect(hallOut); hallOut.connect(this.master);
    this._sfx = { noise, dry, room, hall };
    return this._sfx;
};

AudioEngine.prototype._sfxOut = function (node, roomAmt = 0, hallAmt = 0) {
    const f = this._sfxInit(), lv = sfxLevel();
    node.connect(f.dry);
    if (roomAmt > 0 && lv < 2) { const s = this.ctx.createGain(); s.gain.value = roomAmt; node.connect(s); s.connect(f.room); }
    if (hallAmt > 0 && lv < 1) { const s = this.ctx.createGain(); s.gain.value = hallAmt; node.connect(s); s.connect(f.hall); }
};

AudioEngine.prototype._sfxNoise = function (t, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._sfxInit().noise;
    s.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
    s.start(t, Math.random() * 0.5, dur);
    return s;
};

AudioEngine.prototype._sfxBand = function (t, dur, type, f0, f1, q, peak, attack, decay, room = 0, hall = 0) {
    const c = this.ctx, d = Math.max(dur, attack + decay + 0.02);
    const n = this._sfxNoise(t, d), f = sfxFilter(c, type, f0, q), g = c.createGain();
    if (f1) sfxSweep(f.frequency, f0, f1, t, d);
    sfxEnv(g, t, peak, attack, decay);
    n.connect(f); f.connect(g);
    this._sfxOut(g, room, hall);
};

AudioEngine.prototype._sfxVoice = function (dur, critical = false) {
    const lv = sfxLevel();
    if (!critical && _sfxVoices >= (lv === 2 ? 8 : lv === 1 ? Math.round(SFX_MAX_VOICES * 0.7) : SFX_MAX_VOICES)) return false;
    _sfxVoices++;
    setTimeout(() => { _sfxVoices--; }, dur * 1000 + 50);
    return true;
};

// ---------- armas ----------
// Pistola: crujido seco, bajo oscuro en E y pinchazo que cae
AudioEngine.prototype._sfxPistol = function (t) {
    if (!this._sfxVoice(0.15)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.01, 'bandpass', 2500, 800, 1.2, 0.8, 0.0005, 0.008, 0.05);
    this._sfxOut(sfxDarkBass(c, t, 40, 0.1, 0.9), 0.05);
    this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2)), sfxMidi(sfxNote(0, 1)), 0.05, 0.3, 14), 0.08);
};

// Escopeta: explosión sucia con sub profundo y metal FM en tritono
AudioEngine.prototype._sfxShotgun = function (t) {
    if (!this._sfxVoice(0.35)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.12, 'lowpass', 2500, 120, 0.7, 1.0, 0.0005, 0.1, 0.1);
    this._sfxOut(sfxDarkBass(c, t, 40, 0.35, 1.0, 20), 0.1);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(0, 1)), 1.5, t, 0.12, 0.2), 0.1);
    for (let i = 0; i < 3; i++) {                  // bomba: tres clics descendentes
        this._sfxBand(t + 0.36 + i * 0.03, 0.02, 'bandpass', 1400 - i * 300, null, 2, 0.4, 0.0005, 0.018, 0.1);
    }
};

// Ametralladora: tacs graves y agresivos alternando notas frigias (ritmo tenso)
AudioEngine.prototype._sfxMinigun = function (t) {
    if (!this._sfxVoice(0.05)) return;
    this._sfxMinigun.n = ((this._sfxMinigun.n || 0) + 1) % 4;
    const deg = [0, 1, 0, 3][this._sfxMinigun.n];
    const o = sfxOsc(this.ctx, 'square', sfxMidi(sfxNote(deg, 0)) * 1.5, sfxMidi(sfxNote(deg, 0)), t, 0.02);
    this._sfxOut(sfxDirty(this.ctx, o, t, 0.02, 0.25, 16, 8), 0.02);
    o.start(t); o.stop(t + 0.04);
    this._sfxBand(t, 0.006, 'highpass', 5000, null, 0.8, 0.35, 0.0005, 0.005);
};

// Katana: silbido oscuro y campana metálica en tritono
AudioEngine.prototype._sfxKatana = function (t) {
    if (!this._sfxVoice(0.2)) return;
    const c = this.ctx;
    this._sfxBand(t, 0.12, 'bandpass', 600, 5000, 1.5, 0.5, 0.005, 0.11, 0.2);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(4, 1)) * 1.0, 2, t + 0.03, 0.25, 0.2), 0.3);
};

// Railgun (oscuro y de cine): drone que sube en E, boom profundo, y un zumbido FM que se corta
AudioEngine.prototype._sfxRail = function (t) {
    if (!this._sfxVoice(1.0, true)) return;
    const c = this.ctx;
    this._sfxOut(sfxDarkBass(c, t - 0.3, 40, 0.3, 0.5, 10), 0.1, 0.3);
    this._sfxBand(t, 0.06, 'highpass', 2500, null, 0.7, 0.9, 0.0005, 0.05, 0.1, 0.2);
    this._sfxOut(sfxDarkBass(c, t, 28, 0.5, 1.0, 22), 0.1, 0.5);
    this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(0, 1)) * 2, 3, t, 0.4, 0.1), 0.2, 0.6);
};

AudioEngine.prototype.playShoot = function (w, isEnemy = false) {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime;
    if (isEnemy) {                                  // disparo enemigo: segunda menor, sucia y tensa
        if (!this._sfxVoice(0.12)) return;
        this._sfxOut(sfxStab(this.ctx, t, sfxMidi(sfxNote(2, 0)), sfxMidi(sfxNote(1, 0)), 0.09, 0.25, 16), 0.08);
        return;
    }
    if (w === 'KATANA') return this._sfxKatana(t);
    if (w === 'RAILGUN') return this._sfxRail(t);
    if (w === 'SHOTGUN') return this._sfxShotgun(t);
    if (w === 'MINIGUN') return this._sfxMinigun(t);
    return this._sfxPistol(t);
};

// ---------- impactos y eventos ----------
// Impacto sin muerte: golpe seco con la segunda menor (F)
AudioEngine.prototype.playTick = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.05)) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastTick || 0) < (sfxLevel() ? 0.08 : 0.04)) return;
    this._lastTick = t;
    this._sfxOut(sfxStab(this.ctx, t, sfxMidi(sfxNote(1, 1)), sfxMidi(sfxNote(1, 1)) * 0.97, 0.025, 0.22, 14), 0.02);
};

// Muerte: salpicadura y arpegio frigio sombrío que termina en tritono; el combo lo hace más tenso
AudioEngine.prototype.playHit = function (isPlayer = false) {
    if (!this.isPlaying) return;
    const c = this.ctx, t = c.currentTime;
    if (isPlayer) {                                 // te golpean: bajo brutal + tritono
        if (!this._sfxVoice(0.4, true)) return;
        this._sfxOut(sfxDarkBass(c, t, 40, 0.25, 1.0, 20), 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2)), sfxMidi(sfxNote(0, 2)), 0.15, 0.3, 18), 0.05);
        this._sfxOut(sfxStab(c, t, sfxMidi(sfxNote(0, 2) + SFX_TRITONE), sfxMidi(sfxNote(0, 2) + SFX_TRITONE), 0.15, 0.25, 18), 0.05);
        return;
    }
    const lv = sfxLevel();
    if (t - (this._lastKillSfx || 0) < (lv === 2 ? 0.09 : lv === 1 ? 0.07 : 0.045)) return;     // varias muertes casi a la vez suenan como una
    this._lastKillSfx = t;
    if (!this._sfxVoice(0.3)) return;
    this._sfxBand(t, 0.03, 'lowpass', 1200, 150, 0.8, 0.7, 0.0005, 0.03, 0.05);
    const combo = (typeof engine !== 'undefined' && engine) ? engine.combo : 0;
    const pattern = [0, 1, 3, 1];                   // E F A F: tensión frigia
    const t0 = sfxGrid(c, t + 0.005), oct = Math.min(Math.floor(combo / 4), 2);
    for (let i = 0; i < (lv === 2 ? 2 : lv === 1 ? 3 : 4); i++) {
        const deg = pattern[(i + combo) % 4];
        const f = sfxMidi(sfxNote(deg, oct));
        this._sfxOut(sfxStab(c, t0 + i * SFX_STEP, f, f * 0.99, SFX_STEP * 0.9, 0.22, 16), 0.1);
    }
};

AudioEngine.prototype.playExplosion = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(1.3, true)) return;
    const c = this.ctx, t = c.currentTime;
    this._sfxBand(t, 0.02, 'highpass', 3000, null, 0.7, 0.9, 0.0005, 0.015, 0.05);
    this._sfxOut(sfxDarkBass(c, t, 28, 1.0, 1.0, 20), 0.1, 0.5);
    // cluster en tritono: el "acorde" de la explosión
    [sfxMidi(SFX_ROOT - 24), sfxMidi(SFX_ROOT - 24 + SFX_TRITONE)].forEach((f) => this._sfxOut(sfxFMMetal(c, f, 2, t, 0.6, 0.12), 0.1, 0.4));
    for (let i = 0; i < 8; i++) {                    // escombros oscuros
        this._sfxBand(t + 0.02 + i * SFX_STEP * 0.5, 0.02, 'bandpass', 1200 + Math.random() * 1500, null, 1.5, 0.3, 0.001, 0.015, 0.05, 0.1);
    }
};

// Recoger objeto: campana grave y lenta que sube por la escala frigia (sin ser alegre)
AudioEngine.prototype.playPickup = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.4)) return;
    const c = this.ctx, t0 = sfxGrid(c, c.currentTime);
    [0, 1, 3, 5].forEach((deg, i) => this._sfxOut(sfxFMMetal(c, sfxMidi(sfxNote(deg, 0)), 1.2, t0 + i * SFX_STEP * 2, 0.35, 0.14), 0.15, 0.2));
};

// Pulso: barrido oscuro de E1 a E3 con golpe de sub
AudioEngine.prototype.playPulse = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.6, true)) return;
    const c = this.ctx, t = c.currentTime;
    this._sfxOut(sfxDarkBass(c, t, 28, 0.5, 1.0, 22), 0.1, 0.4);
    this._sfxBand(t, 0.4, 'bandpass', 200, 3000, 1.5, 0.4, 0.05, 0.35, 0.2, 0.3);
};

AudioEngine.prototype.playDash = function () {
    if (!this.isPlaying) return;
    if (!this._sfxVoice(0.1)) return;
    const t = this.ctx.currentTime;
    this._sfxBand(t, 0.1, 'bandpass', 700, 4500, 1.5, 0.35, 0.005, 0.09, 0.1);
};

// Impacto sin muerte: se engancha al final de hitEnemy de game.js
const _hitEnemyFx = GameEngine.prototype.hitEnemy;
GameEngine.prototype.hitEnemy = function (e, damage, fx, fy, isMelee = false) {
    const wasAlive = !e.dead;
    _hitEnemyFx.call(this, e, damage, fx, fy, isMelee);
    if (wasAlive && !e.dead) audio.playTick();
};
// Prepara ruido y reverberaciones al arrancar la música (si no, el primer disparo se atasca generándolos)
const _startMusicSfx = AudioEngine.prototype.startMusic;
AudioEngine.prototype.startMusic = function () { _startMusicSfx.call(this); this._sfxInit(); };
