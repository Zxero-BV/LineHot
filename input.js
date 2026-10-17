// GESTIÓN HÍBRIDA DE INPUTS (Táctil + PC)
const Input = {
    left: { active: false, id: null, base: {x:0, y:0}, vector: {x:0, y:0}, force: 0 },
    right: { active: false, id: null, base: {x:0, y:0}, vector: {x:0, y:0}, force: 0 },
    maxRadius: 56, deadZone: 8, lastTouch: 0,
    lastLeftTapTime: 0,
    lastDir: { x: 1, y: 0 }, 
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: window.innerWidth/2, y: window.innerHeight/2, active: false }
};
 
// Eventos de Teclado
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(key)) Input.keys.w = true;
    if (['s', 'arrowdown'].includes(key)) Input.keys.s = true;
    if (['a', 'arrowleft'].includes(key)) Input.keys.a = true;
    if (['d', 'arrowright'].includes(key)) Input.keys.d = true;
    
    if ((key === ' ' || key === 'shift') && engine && engine.player && engine.state === 'PLAYING') {
        e.preventDefault();
        engine.player.pulse();
    }
    if ((key === 'escape' || key === 'p') && engine) engine.togglePause();
});
 
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(key)) Input.keys.w = false;
    if (['s', 'arrowdown'].includes(key)) Input.keys.s = false;
    if (['a', 'arrowleft'].includes(key)) Input.keys.a = false;
    if (['d', 'arrowright'].includes(key)) Input.keys.d = false;
});
 
// Eventos de Ratón
window.addEventListener('mousemove', (e) => {
    if (Date.now() - Input.lastTouch < 700) return;
    Input.mouse.cx = e.clientX; Input.mouse.cy = e.clientY;
    
});
window.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('button, input, #screens')) return;
    if (Date.now() - Input.lastTouch < 700) return; 
    Input.mouse.active = true;
});
window.addEventListener('mouseup', () => {
    Input.mouse.active = false;
});
 
// Eventos Táctiles Originales
function handleTouch(e) {
    if (e.cancelable) e.preventDefault();
    Input.lastTouch = Date.now();
    const touches = e.changedTouches, half = window.innerWidth / 2;

    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];

        if (e.type === 'touchstart') {
            const stick = t.clientX < half ? Input.left : Input.right;
            if (!stick.active) {
                stick.active = true; stick.id = t.identifier;
                stick.base = { x: t.clientX, y: t.clientY };
                stick.force = 0; stick.vector = { x: 0, y: 0 };
            }
        } else if (e.type === 'touchmove') {
            const stick = Input.left.id === t.identifier ? Input.left : (Input.right.id === t.identifier ? Input.right : null);
            if (stick && stick.active) {
                let dx = t.clientX - stick.base.x, dy = t.clientY - stick.base.y;
                let d = Math.hypot(dx, dy);
                const R = Input.maxRadius;
                if (d > R) {                       // la base sigue al dedo: nunca hay que "volver" al centro
                    const k = (d - R) / d;
                    stick.base.x += dx * k; stick.base.y += dy * k;
                    dx = t.clientX - stick.base.x; dy = t.clientY - stick.base.y; d = R;
                }
                const dz = Input.deadZone;
                stick.force = d <= dz ? 0 : Math.min((d - dz) / (R - dz), 1);
                if (d > 0) stick.vector = { x: dx / d, y: dy / d };
            }
        } else {                                   // touchend / touchcancel
            for (const stick of [Input.left, Input.right]) {
                if (stick.id === t.identifier) { stick.active = false; stick.id = null; stick.force = 0; stick.vector = { x: 0, y: 0 }; }
            }
        }
    }
}
 
canvas.addEventListener('touchstart', handleTouch, {passive: false});
canvas.addEventListener('touchmove', handleTouch, {passive: false});
canvas.addEventListener('touchend', handleTouch, {passive: false});
canvas.addEventListener('touchcancel', handleTouch, {passive: false});
 
