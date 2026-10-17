
// ===================== v5 · CALIDAD ADAPTABLE =====================
// Si los FPS caen de forma sostenida, el juego baja solo resolución, brillo y partículas (sin tocar la jugabilidad).
function setQuality(l) { Q.level = l; Q.glow = [1, 0.6, 0.3, 0][l]; document.body.dataset.q = l; }
let _slow = 0;
function autoQuality(fps) {
    if (!Settings.autoQ || Settings.perf || !engine || engine.state !== 'PLAYING' || Q.level >= 3) { _slow = 0; return; }
    _slow = fps < 45 ? _slow + 1 : 0;
    if (_slow >= 4) { _slow = 0; setQuality(Q.level + 1); resize(); }
}
const _applySettings = applySettings;
applySettings = function () { if (!Settings.autoQ || Settings.perf) setQuality(0); _applySettings(); };
// ==================================================================

window.onload = function() {
    resize();
    engine = new GameEngine();
    setupMenu();
    setupTouchUI();
    applySettings();
    Menu.show('pMain');
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
};
