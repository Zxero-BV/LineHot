class GameEngine {
    constructor() {
        this.state = 'MENU';
        this.time = 0; this.hitStop = 0;
        this.reset();
    }
 
    reset() {
        this.player = new Player(width/2, height/2);
        this.bullets = []; this.enemies = []; this.particles = []; this.pickups = [];
        this.score = 0; this.combo = 0; this.comboTimer = 0; this.maxComboTimer = 3.5;
        this.shakeAmount = 0; this.time = 0; this.spawnTimer = 0; this.difficulty = 1;
        this.wave = 0; this.waveState = 'BREAK'; this.waveTimer = 1.5; this.queue = [];
        this.slashes = []; this.beams = []; this.ghosts = []; this.hpGhost = 100; this.bossHp = 1;
        this.rings = []; this.stains = [];
        
        this.generateObstacles();
        this.redrawBackground();
        this.updateUI();
    }
 
    generateObstacles() {
        this.obstacles = [];
        const numObstacles = Math.floor(Math.random() * 4) + 4; 
        for(let i=0; i<numObstacles; i++) {
            let w = Math.random() > 0.5 ? 40 : 150 + Math.random()*100;
            let h = w === 40 ? 150 + Math.random()*100 : 40;
            let x, y, distToCenter;
            let attempts = 0;
            do {
                x = Math.random() * Math.max(1, width - w - 100) + 50;
                y = Math.random() * Math.max(1, height - h - 100) + 50;
                distToCenter = dist(x+w/2, y+h/2, width/2, height/2);
                attempts++;
            } while(distToCenter < 200 && attempts < 50); 
            
            if (attempts < 50) this.obstacles.push(new Obstacle(x, y, w, h));
        }
    }
 
    redrawBackground() {
        bgCtx.fillStyle = C.bg;
        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.setTransform(renderK, 0, 0, renderK, 0, 0);
        bgCtx.strokeStyle = 'rgba(0, 243, 255, 0.05)'; bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        const gs = 80;
        for(let x = 0; x < width; x += gs) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, height); }
        for(let y = 0; y < height; y += gs) { bgCtx.moveTo(0, y); bgCtx.lineTo(width, y); }
        bgCtx.stroke();
    }
 
    init() {
        audio.resume(); audio.music.newRun(); audio.startMusic();
        this.reset();
        DOM.screens.classList.add('hidden');
        DOM.uiLayer.classList.remove('chromatic-glitch');
        this.state = 'PLAYING';
        
        try {
            enterImmersive();
        } catch(e) {}
    }
 
    addShake(amount) { if (Settings.shake) this.shakeAmount = Math.min(this.shakeAmount + amount, 50); }
    doHitStop(duration) { this.hitStop = Math.max(this.hitStop, duration); }
 
    spawnText(x, y, text, color) { this.particles.push(new Particle(x, y, color, text, 0, 0, 0, 'text')); }
    spawnParticle(x, y, color, amount, vx=0, vy=0, speed=200, type='normal') {
        const max = Settings.perf ? 350 : [800, 600, 450, 350][Q.level], n = Math.ceil(amount * (Settings.perf ? 0.4 : [1, 0.75, 0.6, 0.5][Q.level]));
        for(let i=0; i<n && this.particles.length<max; i++) this.particles.push(new Particle(x, y, color, speed, vx, vy, 5, type));
    }
 
    addScore(amount, x, y) {
        const multi = this.combo > 0 ? this.combo : 1;
        const total = amount * multi;
        this.score += total;
        this.combo++; this.comboTimer = this.maxComboTimer;
        
        if(x && y) { this.spawnText(x, y, '+' + total, C.white); if (this.combo % 5 === 0) this.spawnText(x, y - 26, 'COMBO x' + this.combo + '!', C.yellow); }
        this.addShake(Math.min(this.combo * 0.4, 6));
        audio.playHit(); audio.music.setCombo(this.combo); audio.music.onKill();
        
        if (this.combo > 10 && this.combo % 5 === 0) DOM.uiLayer.classList.add('chromatic-glitch');
        setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
 
        if (this.score > bestScore) {
            bestScore = this.score;
            localStorage.setItem('neonCarnageBest', bestScore);
            DOM.highScore.innerText = `HI: ${bestScore.toString().padStart(6, '0')}`;
        }
        this.updateUI();
    }
 
    updateUI() {
        DOM.score.innerText = this.score.toString().padStart(6, '0');
        if (this.combo > 1) {
            DOM.combo.innerHTML = `x${this.combo}<br>COMBO`; DOM.combo.classList.add('active');
        } else {
            DOM.combo.classList.remove('active');
        }
    }
 
    gameOver() {
        this.state = 'GAMEOVER';
        this.spawnParticle(this.player.x, this.player.y, C.cyan, 150, 0, 0, 1000);
        audio.playExplosion(); audio.stopMusic(); haptic([100, 50, 100, 50, 500]);
        this.addShake(80); this.doHitStop(0.5);
        DOM.uiLayer.classList.add('chromatic-glitch');
        DOM.canvas.style.transform = `rotate(0deg)`; 
 
        setTimeout(() => {
            if (this.state !== 'GAMEOVER') return;
            document.getElementById('overStats').innerHTML = `ONDA: <span class="highlight">${this.wave}</span><br>PUNTUACIÓN: <span class="highlight">${this.score}</span><br>COMBO MÁXIMO: <span class="highlight">${this.combo}</span>`;
            Menu.open('pOver', true);
            DOM.uiLayer.classList.remove('chromatic-glitch');
        }, 2000);
    }
 
    spawnLogic(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.difficulty = 1 + (this.time / 20); 
            let spawnRate = Math.max(0.15, 1.2 - (this.difficulty * 0.1));
            this.spawnTimer = spawnRate;
 
            let sx, sy;
            if (Math.random() > 0.5) { sx = Math.random() > 0.5 ? -30 : width + 30; sy = Math.random() * height; } 
            else { sx = Math.random() * width; sy = Math.random() > 0.5 ? -30 : height + 30; }
 
            const r = Math.random();
            let type = 0; 
            if (this.time > 15 && r < 0.25) type = 2; 
            if (this.time > 30 && r > 0.85) type = 1; 
 
            this.enemies.push(new Enemy(type, sx, sy, this.difficulty));
        }
    }
 
    hitEnemy(e, damage, forceX, forceY, isMelee = false) {
        e.hp -= damage;
        e.knockback.x = forceX; e.knockback.y = forceY;
        this.spawnParticle(e.x, e.y, e.color, isMelee ? 15 : 6, forceX*0.5, forceY*0.5, isMelee ? 400 : 200, 'blood');
        
        if (e.hp <= 0 && !e.dead) {
            e.dead = true; 
            this.spawnParticle(e.x, e.y, e.color, 40, 0, 0, 500, 'blood');
            this.addScore(e.type === 1 ? 500 : (e.type === 2 ? 200 : 100), e.x, e.y);
            
            if (e.type === 1) this.doHitStop(0.08); 
            else if (isMelee || this.combo % 10 === 0) this.doHitStop(0.04);
 
            if (Math.random() < 0.12 || (e.type === 1 && Math.random() < 0.8)) {
                const types = ['SHOTGUN', 'MINIGUN', 'KATANA', 'HEALTH'];
                this.pickups.push(new Pickup(e.x, e.y, types[Math.floor(Math.random()*types.length)]));
            }
        }
    }
 
    update(dt) {
        if (this.state === 'PAUSED') return;
        if (this.hitStop > 0) { this.hitStop -= dt; return; }
        if (this.state !== 'PLAYING') { this.updateArrays(dt, true); return; }
 
        this.time += dt;
        this.spawnLogic(dt);
 
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.updateUI(); audio.music.setCombo(0); }
        }
 
        this.player.update(dt);
        this.updateArrays(dt, false);
        this.checkCollisions();
 
        
         
    }
    
    updateArrays(dt, particlesOnly) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]; p.update(dt);
            if (p.life <= 0 && p.type !== 'blood') this.particles.splice(i, 1);
            else if (p.type === 'blood' && p.life <= 0) this.particles.splice(i,1); 
        }
        for (let i = this.stains.length - 1; i >= 0; i--) if ((this.stains[i].life -= dt) <= 0) this.stains.splice(i, 1);
        for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].life -= dt) <= 0) this.rings.splice(i, 1);
        if(particlesOnly) return;
 
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i]; b.update(dt);
            if (b.life <= 0 || b.x<0 || b.x>width || b.y<0 || b.y>height) this.bullets.splice(i, 1);
        }
 
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i]; p.update(dt);
            if (p.life <= 0) this.pickups.splice(i, 1);
        }
 
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.dead) { this.enemies.splice(i, 1); continue; }
            e.update(dt, this.player.x, this.player.y);
        }
    }
 
    checkCollisions() {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            if (dist(this.player.x, this.player.y, p.x, p.y) < this.player.radius + p.hit) {
                if (p.itemType === 'HEALTH') {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
                    this.spawnText(p.x, p.y, "+HP", C.green);
                } else {
                    this.player.equip(p.itemType, p.itemType === 'SHOTGUN' ? 25 : (p.itemType === 'KATANA' ? 50 : (p.itemType === 'RAILGUN' ? 8 : 150)));
                }
                audio.playPickup(); haptic(50);
                this.spawnParticle(p.x, p.y, p.color, 20, 0, 0, 400);
                this.pickups.splice(i, 1);
            }
        }
 
        for (let j = this.bullets.length - 1; j >= 0; j--) {
            const b = this.bullets[j];
            if (b.isEnemy && this.player.iframes <= 0) {
                if (dist(b.x, b.y, this.player.x, this.player.y) < this.player.radius + b.radius) {
                    this.player.hp -= b.damage; this.player.iframes = 0.4;
                    this.addShake(25); haptic(200);
                    DOM.uiLayer.classList.add('chromatic-glitch');
                    setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
                    this.spawnParticle(this.player.x, this.player.y, C.red, 30, b.vx*0.5, b.vy*0.5, 500, 'blood');
                    this.bullets.splice(j, 1);
                    if (this.player.hp <= 0) { this.gameOver(); return; }
                    continue;
                }
            }
        }
 
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
 
            if (!e.dead && this.player.iframes <= 0 && dist(this.player.x, this.player.y, e.x, e.y) < this.player.radius + e.radius - 2) {
                this.player.hp -= e.dmg; this.player.iframes = 0.6; 
                this.addShake(30); haptic(200);
                DOM.uiLayer.classList.add('chromatic-glitch');
                setTimeout(() => DOM.uiLayer.classList.remove('chromatic-glitch'), 200);
                this.spawnParticle(this.player.x, this.player.y, C.red, 25, 0, 0, 500, 'blood');
                
                e.knockback.x = (e.x - this.player.x) * 15;
                e.knockback.y = (e.y - this.player.y) * 15;
 
                if (this.player.hp <= 0) { this.gameOver(); return; }
            }
 
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (!b.isEnemy && !e.dead && !b.hit.has(e) && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
                    b.hit.add(e);
                    this.hitEnemy(e, b.damage * bulletFalloff(b), b.vx * 0.4, b.vy * 0.4); if (b.pierce-- > 0) continue;
                    this.bullets.splice(j, 1);
                }
            }
        }
    }
 
    drawJoysticks(ctx) {
        [Input.left, Input.right].forEach((stick, idx) => {
            if (stick.active) {
                const color = idx === 0 ? C.cyan : C.pink;
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // joysticks en px de pantalla, no del mundo
                ctx.globalAlpha = 0.2; ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(stick.base.x, stick.base.y, Input.maxRadius, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
 
                const headX = stick.base.x + stick.vector.x * (Input.maxRadius * stick.force);
                const headY = stick.base.y + stick.vector.y * (Input.maxRadius * stick.force);
                
                ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(headX, headY, 18, 0, Math.PI*2);
                ctx.fillStyle = C.white; ctx.fill();
                ctx.restore();
            }
        });
    }
 
    draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.drawBackdrop(ctx);
        ctx.setTransform(Cam.m[0] * renderK, Cam.m[1] * renderK, Cam.m[2] * renderK, Cam.m[3] * renderK, Cam.m[4], Cam.m[5]);
 
        ctx.save();
        if (this.shakeAmount > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            ctx.translate(dx, dy);
            this.shakeAmount *= 0.85;
            if (this.shakeAmount < 0.5) this.shakeAmount = 0;
        }
 
        this.drawWalls(ctx); this.drawStains(ctx); this.drawRings(ctx);
 
        this.pickups.forEach(p => p.draw(ctx));
        for (const p of this.particles) if (p.type === 'blood' || p.type === 'ghost') p.draw(ctx);
        this.drawFx(ctx); for (const b of this.bullets) b.draw(ctx);
        this.enemies.forEach(e => e.draw(ctx));
        
        if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
            if(this.player.hp > 0) { this.player.drawTrail(ctx); this.player.draw(ctx); }
        }
 
        for (const p of this.particles) if (p.type !== 'blood' && p.type !== 'ghost') p.draw(ctx);
        ctx.restore();
 
        if (this.state === 'PLAYING') this.drawJoysticks(ctx);
        
        if (this.hitStop > 0 && this.shakeAmount > 15 && !Settings.perf && Q.level === 0) {
            ctx.globalCompositeOperation = 'screen';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(canvas, -2 * dpr, 0);
            ctx.drawImage(canvas, 2 * dpr, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}
 
