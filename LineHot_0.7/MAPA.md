# Mapa del proyecto (LineHot 0.3, agrupado por temas)

Scripts clásicos que comparten variables globales; se cargan en el orden de `index.html`. Dentro de cada archivo hay marcadores `// ########## [original.js] ##########`.

| Quiero cambiar... | Archivo |
|---|---|
| Colores, constantes, zoom, resize, colisiones | `core.js` |
| Música (temas, director, minijefes) y motor de audio base | `audio.js` (music_base · music_motor · music_minijefes · audio) |
| Efectos de sonido | `sfx.js` |
| Jugador, enemigos, balas, pickups, partículas | `entities.js` |
| Bucle principal, daño, oleadas, puntuación, HUD del jefe | `engine.js` (engine · upgrade) |
| Teclado, ratón, joysticks y HUD móvil | `controles.js` (input · mobile) |
| Menús, pausa, ajustes, game over | `menus.js` |
| Paredes (laberintos), cámara, horizontal | `walls.js` |
| Jefe y minijefes (IA y patrones) | `jefes.js` (boss · minijefes) |
| Arranque y modos de calidad | `arranque.js` (boot · calidad) |
| Mejoras, modificadores, enemigos/armas/objetos nuevos, fases de jefe, mando, tutorial, compartir | `extras.js` (todo cuelga del objeto `LH`; va antes de `carga.js`) |
| App instalable / sin conexión (PWA) | `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` |
| Pantalla de carga / precarga | `carga.js` (+ `#loader` en `index.html`, `carga.css` dentro de `estilos.css`) |
| Estilos, diseño móvil, efectos CRT | `estilos.css` (base · mobile · fx) |

## Reglas
- No cambies el orden de los `<script>` en `index.html`: varios archivos envuelven funciones de otros (p. ej. `walls` sobre `mobile`, `sfx` sobre `menus`).

## Cambios de audio (arreglo de cortes de música)
- `audio.js` → cruces entre temas: curva de graves simétrica + compensación de potencia (antes el volumen bajaba hasta un 35 % a mitad de cada cruce: fin de la oleada 2, oleada 3 y entrada de la 4).
- `audio.js` → el descanso entre oleadas (`'calm'`) conserva la música de la oleada anterior (antes, tras minijefes/jefes, volvía a entrar el tema épico con riser e impacto en pleno descanso).
- `audio.js` → colchón de música por adelantado 0.6 s → 1.0 s (1.8 s si el motor va justo).
- Depuración: en la consola del navegador, `audio.music.diag()` muestra si el motor usa Worker, cuántos cortes hubo y la carga de CPU de la música.

## Pantalla de carga (precarga)
- `carga.js` (va el último) envuelve `window.onload`: muestra `#loader`, calienta sprites, crea ruido/reverbs de efectos y espera a que el worker de música avise `ready`. Durante la carga se bloquean clics y teclas. Seguro: entra igualmente a los 15 s.
- `audio.js` → `MusicCore.dryRun()`: ensayo de render (lucha, jefe, descanso, cruces) tras `warm()`, sin degradar calidad, y termina con `hardReset()`. `MusicEngine.whenReady(cb, ms)` espera ese aviso.

## Menús v2
- `index.html` (`#screens`): pMain, pOptions (pestañas JUEGO/AUDIO/GRÁFICOS), pControls (PC/MÓVIL/TRUCOS), pPause (stats de la partida), pOver (stats + nuevo récord). Estilos al final de `estilos.css` (`menus.css`).
- `menus.js`: `Menu` (show/setTab/focus), `Stats` (partidas y mejor onda en localStorage `linehotStats`), `audio.playUI()` (sonidos de menú), botones con `data-confirm` (doble toque), navegación con teclado (↑↓/W S, Enter, Esc, ←→ en pestañas; clase `body.kbd`).
- `engine.js`: `maxCombo` y `kills` por partida; `gameOver` llama a `Menu.fillOver`.
- `arranque.js`: calidad gráfica como selector de 3 botones (`#qualitySeg`).

## Extras (rejugabilidad, sensación de juego, comodidad)
- **Mejoras entre oleadas:** `LH.UPS` (11 mejoras con niveles). Se ofrecen 3 al superar las oleadas 3, 5, 6, 9, 10… (`spawnLogic` → `upT` → `LH.openUpgrade`, estado `UPGRADE`). Estado de la partida en `engine.up`.
- **Modificadores:** `LH.MUTS` (cristal, frenesí, horda, sin pulso, un golpe); se eligen en el menú, se guardan en `linehotMods` y multiplican la puntuación (`engine.scoreMult`).
- **Enemigos nuevos:** `makeEnemy(6|7, …)` → kamikaze (`kind:'kami'`) y divisor (`kind:'split'`); se añaden a la cola en `startWave`.
- **Armas:** LASER y ROCKET (`WEAPONS` en core.js; disparo en `LH.fireLaser/fireRocket`). **Objetos:** `EXTRA_PK` (escudo, tiempo lento, imán, bomba) → `engine.applyPower`.
- **Daño recibido:** un único sitio, el setter de `Player.hp` (escudo, cristal, un golpe).
- **Jefes con fases:** `LH.bossTick` (fase 2 al 66 % y fase 3 al 33 % de vida).
- **Mando:** `LH.GP` (stick izq. mover, stick der./RT/RB disparar, A/LB/LT pulso, Start pausa, cruceta + A/B en menús, vibración).
- **Tutorial:** `LH.TUT` (4 pasos en la primera partida; opción `tutorial` en Ajustes). **Compartir:** `LH.share`.
- **PWA:** `sw.js` (red primero, copia local para jugar sin conexión). Si añades archivos nuevos, ponlos en `FILES` y sube `CACHE`.

## Pulido
- **Progreso** (`extras.js`, bloque "progreso"): 13 logros (`LH.ACH`, guardados en `linehotAch`), 5 mejores partidas (`linehotTop`), datos acumulados (`linehotProg`) y **reto diario** (2 modificadores fijos por día, `LH.dailyMods`; mejor del día en `linehotDaily`). Panel `pProg` en el menú.
- **Poca vida:** por debajo del 30 % se activa la viñeta roja (`#hurt`, clase `body.lowhp`).
- **Bomba:** también elimina las crías de los divisores. **Rendimiento:** el jefe se guarda en `engine.bossRef` y el dibujo de efectos ya no crea listas por fotograma.
- **Mando:** al abrir las mejoras el foco ya está en una tarjeta.
- **Pruebas hechas:** partida automática de 16 oleadas (3 jefes, minijefes, mejoras y objetos) sin errores, y comprobación de que ningún menú se sale de pantalla en móvil horizontal (740×360 y 640×320), móvil vertical y escritorio.
- `sw.js`: `CACHE` subido a `linehot-v2`.
