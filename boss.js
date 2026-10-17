
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
