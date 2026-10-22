
// ########## [boss.js] ##########

// ===================== JEFE Y DAÑO POR DISTANCIA (v2) =====================
// Balas del jugador: más daño de cerca, menos de lejos. Así acercarse compensa.
function bulletFalloff(b) {
    if (b.isEnemy) return 1;
    return clamp(1.5 - dist(b.x, b.y, b.ox, b.oy) / 600, 0.5, 1.4);
}

// IA del jefe: se acerca, guarda distancia, dispara patrones, marca una embestida y carga.
Enemy.prototype.bossAI = function (dt, px, py) {
    const b = this, rage = b.hp / b.maxHp < 0.5;
    b.t += dt; b.enraged = rage;
    b.fireCooldown -= dt;
    b.chargeCd = (b.chargeCd ?? 4) - dt;
    let vx = 0, vy = 0;

    if (b.rush > 0) {                                   // embestida en curso
        b.rush -= dt; vx = b.rushX; vy = b.rushY;
        if (b.rush <= 0) b.recover = 0.8;
    } else if (b.telegraph > 0) {                       // aviso: la línea punteada marca la dirección
        b.telegraph -= dt;
        if (b.telegraph <= 0) {
            const d = Math.max(dist(b.x, b.y, px, py), 1);
            b.rushX = (px - b.x) / d * 950; b.rushY = (py - b.y) / d * 950; b.rush = 0.4;
        }
    } else if (b.recover > 0) {                         // vulnerable un momento tras embestir
        b.recover -= dt;
    } else {                                            // combate a media distancia
        const d = dist(b.x, b.y, px, py), ang = Math.atan2(py - b.y, px - b.x);
        const sp = rage ? 130 : 90, along = d > 320 ? 1 : d < 200 ? -0.9 : 0.25;
        const side = Math.sin(b.t * 1.4) * 0.8;         // se mueve de lado a lado
        vx = Math.cos(ang) * sp * along - Math.sin(ang) * sp * side;
        vy = Math.sin(ang) * sp * along + Math.cos(ang) * sp * side;
        if (b.fireCooldown <= 0 && b.t > 1.5) engine.bossAttack(b);
        if (b.chargeCd <= 0) { b.telegraph = rage ? 0.6 : 0.9; b.chargeCd = rage ? 3 : 5; }
    }

    if (b.spiral) {                                     // espiral de 3 brazos
        b.spiral.timer -= dt;
        if (b.spiral.timer <= 0) {
            b.spiral.timer = 0.07;
            for (let k = 0; k < 3; k++) engine.bullets.push(new Bullet(b.x, b.y, b.spiral.a + k * TAU / 3, { speed: 260, color: C.pink, damage: 12, name: 'ENEMY_GUN' }, true));
            b.spiral.a += 0.2;
            if (--b.spiral.n <= 0) b.spiral = null;
        }
    }

    b.x = clamp(b.x + vx * dt, b.radius, width - b.radius);
    b.y = clamp(b.y + vy * dt, b.radius, height - b.radius);
    engine.obstacles.forEach(obs => {
        const res = rectCircleCollide(b.x, b.y, b.radius, obs.x, obs.y, obs.w, obs.h);
        if (res.hit) { b.x += res.nx * res.pen; b.y += res.ny * res.pen; }
    });
};

// Patrones del jefe, en rotación. Cada uno tiene una forma distinta de esquivarse.
Object.assign(GameEngine.prototype, {
    bossAttack(b) {
        const rage = b.enraged, pa = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        const mk = (a, s, dmg = 12) => this.bullets.push(new Bullet(b.x, b.y, a, { speed: s, color: C.pink, damage: dmg, name: 'ENEMY_GUN' }, true));
        const pick = (b.pat = ((b.pat ?? -1) + 1) % 4);

        if (pick === 0) {                               // anillo con hueco: hay que buscar la salida
            const n = rage ? 30 : 22, gap = Math.floor(Math.random() * n);
            for (let i = 0; i < n; i++) if (((i - gap + n) % n) >= 2) mk(i / n * TAU + b.t, rage ? 260 : 210);
            b.fireCooldown = rage ? 1.5 : 2.0;
        } else if (pick === 1) {                        // espiral (se procesa en bossAI)
            b.spiral = { n: rage ? 40 : 28, a: pa, timer: 0 };
            b.fireCooldown = 2.6;
        } else if (pick === 2) {                        // abanico dirigido al jugador
            const k = rage ? 3 : 2;
            for (let i = -k; i <= k; i++) mk(pa + i * 0.13, 480);
            b.fireCooldown = rage ? 1.0 : 1.4;
        } else {                                        // invoca enjambre (máximo 14 enemigos en pantalla)
            if (this.enemies.length < 14) {
                for (let i = 0; i < (rage ? 3 : 2); i++) {
                    const a = Math.random() * TAU;
                    this.enemies.push(new Enemy(0, b.x + Math.cos(a) * b.radius, b.y + Math.sin(a) * b.radius, 1.2));
                }
            }
            b.fireCooldown = 3.0;
        }
        audio.playShoot('ENEMY_GUN', true); this.addShake(8);
    }
});

// Línea punteada de aviso de embestida, dibujada en el espacio local del jefe
const _drawBigBase = Enemy.prototype.drawBig;
Enemy.prototype.drawBig = function (ctx) {
    if (this.boss && this.telegraph > 0 && engine.player) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = C.red; ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.telegraph * 40);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(engine.player.x - this.x, engine.player.y - this.y);
        ctx.stroke();
        ctx.restore();
    }
    _drawBigBase.call(this, ctx);
};


// ########## [minijefes.js] ##########
// =====================================================================
//  MINIJEFES (antes minijefes.js, va DESPUÉS de game.js)
// =====================================================================

// =====================================================================
//  MINIJEFES — Neon Carnage (v6)
//  Cargar DESPUÉS de game.js (sobrescribe métodos de sus clases).
//
//  CÍRCULOS (tipo 4, rojos, hexágono que gira):
//    move → se acercan girando · aim → se paran y apuntan con una línea de aviso
//    que se alarga (1.1 s para salir) · charge → embisten en esa dirección
//    · recover → quedan vulnerables un momento. Si chocan con una pared, frenan.
//
//  CUADRADOS (tipo 1, morados):
//    move → se acercan · crouch → se agachan y marcan en el suelo el círculo
//    donde caerán (0.6 s) · air → saltan hacia ese punto (0.9 s) mientras el
//    círculo de aviso se cierra · impacto → onda expansiva con daño en área
//    · stun → aturdidos un momento.
//
//  Enemigos normales: al tocar al jugador rebotan (no se quedan pegados).
//  Jugador: un poco más rápido para poder escapar.
// =====================================================================

const MINI_R = 78;                       // radio de impacto del cuadrado
const MINI_CHARGE_T = 0.55;

const miniTurn = (a, target, max) => a + clamp(Math.atan2(Math.sin(target - a), Math.cos(target - a)), -max, max);
const miniSet = (e, s) => { e.mstate = s; e.mt = 0; };
function miniBounds(e) {
    e.x = clamp(e.x, e.radius, width - e.radius);
    e.y = clamp(e.y, e.radius, height - e.radius);
}
function miniWalls(e) {                  // empuja fuera de las paredes; devuelve true si chocó
    let hit = false;
    for (const obs of engine.obstacles) {
        const res = rectCircleCollide(e.x, e.y, e.radius, obs.x, obs.y, obs.w, obs.h);
        if (res.hit) { e.x += res.nx * res.pen; e.y += res.ny * res.pen; hit = true; }
    }
    return hit;
}

// ---------- CÍRCULO ----------
function miniCircle(dt, px, py) {
    const e = this;
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    e.mstate = e.mstate || 'move';
    e.mt = (e.mt || 0) + dt;
    e.spin = (e.spin || 0) + dt * (e.mstate === 'charge' ? 14 : e.mstate === 'aim' ? 4 : 1.5);
    const ang = Math.atan2(py - e.y, px - e.x), d = dist(e.x, e.y, px, py);
    let vx = e.knockback.x, vy = e.knockback.y;

    if (e.mstate === 'move') {
        const sa = engine.steer(e, ang); vx += Math.cos(sa) * 75; vy += Math.sin(sa) * 75;
        e.chargeCd = (e.chargeCd ?? 1.8) - dt;
        if (e.chargeCd <= 0 && d < 560) { e.aimA = ang; miniSet(e, 'aim'); }
    } else if (e.mstate === 'aim') {                    // parado: la línea sigue al jugador despacio
        e.aimA = miniTurn(e.aimA, ang, dt * 2.2);
        if (e.mt >= 1.1) { e.dirX = Math.cos(e.aimA); e.dirY = Math.sin(e.aimA); miniSet(e, 'charge'); }
    } else if (e.mstate === 'charge') {
        vx += e.dirX * 640; vy += e.dirY * 640;
        if (e.mt >= MINI_CHARGE_T) miniSet(e, 'recover');
    } else if (e.mstate === 'recover') {
        if (e.mt >= 1.0) { e.chargeCd = 1.8 + Math.random() * 1.2; miniSet(e, 'move'); }
    }

    e.x += vx * dt; e.y += vy * dt;
    if (miniWalls(e) && e.mstate === 'charge') miniSet(e, 'recover');
    miniBounds(e);
}

// ---------- CUADRADO ----------
function miniSquare(dt, px, py) {
    const e = this;
    e.knockback.x *= 0.85; e.knockback.y *= 0.85;
    e.mstate = e.mstate || 'move';
    e.mt = (e.mt || 0) + dt;
    const ang = Math.atan2(py - e.y, px - e.x), d = dist(e.x, e.y, px, py);
    let vx = e.knockback.x, vy = e.knockback.y;

    if (e.mstate === 'move') {
        const sa = engine.steer(e, ang); vx += Math.cos(sa) * 85; vy += Math.sin(sa) * 85;
        e.jumpCd = (e.jumpCd ?? 1.2) - dt;
        if (e.jumpCd <= 0 && d < 620) {                  // fija el punto de caída en este instante
            e.sx = e.x; e.sy = e.y; e.tx = px; e.ty = py; e.z = 0;
            miniSet(e, 'crouch');
        }
    } else if (e.mstate === 'crouch') {
        if (e.mt >= 0.6) miniSet(e, 'air');
    } else if (e.mstate === 'air') {
        const k = clamp(e.mt / 0.9, 0, 1);
        e.x = e.sx + (e.tx - e.sx) * k;
        e.y = e.sy + (e.ty - e.sy) * k;
        e.z = Math.sin(Math.PI * k) * 130;               // arco de salto
        if (k >= 1) { e.z = 0; miniImpact(e); miniSet(e, 'stun'); }
    } else if (e.mstate === 'stun') {
        if (e.mt >= 0.8) { e.jumpCd = 1.4 + Math.random() * 1.2; miniSet(e, 'move'); }
    }

    if (e.mstate === 'move') {
        e.x += vx * dt; e.y += vy * dt;
        miniWalls(e); miniBounds(e);
    }
}

function miniImpact(e) {
    const p = engine.player;
    engine.spawnParticle(e.tx, e.ty, e.color, 45, 0, 0, 600, 'blood');
    engine.spawnParticle(e.tx, e.ty, C.white, 12, 0, 0, 350);
    engine.rings.push({ x: e.tx, y: e.ty, max: MINI_R * 1.2, life: 0.5, maxLife: 0.5, col: '#ff3333' });
    engine.addShake(38); haptic([60, 30, 120]); audio.playExplosion();
    if (engine.state === 'PLAYING' && p && p.iframes <= 0 && dist(e.tx, e.ty, p.x, p.y) < MINI_R + p.radius) {
        const n = Math.max(dist(e.tx, e.ty, p.x, p.y), 1);
        p.hp -= 25; p.iframes = 0.6;
        p.kx += (p.x - e.tx) / n * 420; p.ky += (p.y - e.ty) / n * 420;
        engine.addShake(30);
        engine.spawnParticle(p.x, p.y, C.red, 25, 0, 0, 500, 'blood');
        if (p.hp <= 0) engine.gameOver();
    }
}

// ---------- ENGANCHE: enemigos normales rebotan en vez de quedarse pegados ----------
function antiStick(e) {
    const p = engine.player;
    if (!p || e.boss) return;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), min = p.radius + e.radius;
    if (d < min && d > 0.01) {
        const k = (min - d) / d;
        e.x += dx * k * 0.35; e.y += dy * k * 0.35;      // separación suave
        e.knockback.x += dx / d * 60; e.knockback.y += dy / d * 60;   // rebote
    }
}

// ---------- ACTUALIZACIÓN ----------
const _enemyUpdate = Enemy.prototype.update;
Enemy.prototype.update = function (dt, px, py) {
    if (this.type === 4) return miniCircle.call(this, dt, px, py);
    if (this.type === 1) return miniSquare.call(this, dt, px, py);
    _enemyUpdate.call(this, dt, px, py);
    antiStick(this);
};

// ---------- DIBUJO ----------
function miniLanding(ctx, e) {
    const k = e.mstate === 'air' ? clamp(e.mt / 0.9, 0, 1) : clamp(e.mt / 0.6, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(engine.time * 16);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,51,51,${0.08 + 0.12 * pulse + 0.1 * k})`;
    ctx.strokeStyle = `rgba(255,51,51,${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(e.tx, e.ty, MINI_R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,230,0,0.9)'; ctx.lineWidth = 2;   // el anillo amarillo se cierra hasta el impacto
    ctx.beginPath(); ctx.arc(e.tx, e.ty, Math.max(2, MINI_R * (1 - k)), 0, TAU); ctx.stroke();
    ctx.restore();
}

function miniAim(ctx, e) {
    const k = clamp(e.mt / 1.1, 0, 1), L = 40 + 520 * k, pulse = 0.5 + 0.5 * Math.sin(engine.time * 18);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(e.x, e.y); ctx.rotate(e.aimA);
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = `rgba(255,51,51,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(e.radius, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,51,51,0.85)';
    ctx.beginPath(); ctx.moveTo(L + 14, 0); ctx.lineTo(L - 6, -10); ctx.lineTo(L - 6, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
}

function miniSpinDots(ctx, e) {                        // círculo: tres puntos orbitando (muestran lo rápido que gira)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = e.mstate === 'charge' ? C.white : e.color;
    for (let i = 0; i < 3; i++) {
        const a = e.spin + i * TAU / 3, r = e.radius + 12;
        ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 3.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
}

const _enemyDraw = Enemy.prototype.draw;
Enemy.prototype.draw = function (ctx) {
    if (this.type !== 1 && this.type !== 4) return _enemyDraw.call(this, ctx);
    const e = this;
    if (e.type === 1 && (e.mstate === 'crouch' || e.mstate === 'air')) miniLanding(ctx, e);
    if (e.type === 4 && e.mstate === 'aim') miniAim(ctx, e);

    const y0 = e.y, z = e.z || 0;
    e.y -= z;                                          // el cuadrado sube al saltar
    _enemyDraw.call(e, ctx);
    e.y = y0;

    if (e.type === 4) miniSpinDots(ctx, e);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(10 * textBoost())}px Orbitron`;
    ctx.fillStyle = C.yellow;
    ctx.fillText('MINIJEFE', e.x, e.y - z - e.radius - 26);
    ctx.restore();
};

// ---------- JUGADOR MÁS RÁPIDO ----------
// Antes el jugador era más lento que los enemigos en contacto y estos se quedaban pegados.
const _reset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function () {
    _reset.call(this);
    this.player.baseSpeed = 440;
};

// ---------- OLEADAS DE MINIJEFES ----------
const _startWaveMini = GameEngine.prototype.startWave;
GameEngine.prototype.startWave = function () {
    _startWaveMini.call(this);
    const w = this.wave;
    if (w % 5 !== 0 && w % 4 === 0) {                  // cada 4 oleadas (no de jefe): tema y minijefes extra
        audio.music.setSection('mini');
        const extra = 1 + Math.floor(w / 8);
        for (let i = 0; i < extra; i++) this.queue.splice(Math.floor(Math.random() * (this.queue.length + 1)), 0, { t: 4, n: 1, d: 1.4 });
        this.spawnText(width / 2, height * 0.45, 'MINIJEFES', C.yellow);
    }
    audio.music.call('setWaveSize', this.queue.reduce((a, q) => a + q.n, 0));
};


