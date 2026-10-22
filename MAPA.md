# Mapa del proyecto (LineHot 0.5, agrupado por temas)

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
| Guardado en la nube (Supabase): claves, sincronización, sesión anónima | `nube.js` (va primero; SQL en `supabase.sql`) |
| Navegación de enemigos, sangre persistente, francotirador, graze, láser del jefe, cuenta atrás, reducir destellos | `mejoras.js` (va después de `extras.js`) |
| Élites, ARCO VOLTAICO, ricochet/adrenalina, orbes del jefe, esquirlas, sonido panoramizado, volumen de efectos, latido | `mejoras2.js` (va después de `mejoras.js`) |
| Estilos, diseño móvil, efectos CRT | `estilos.css` (base · mobile · fx · mejoras.css al final) |

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

## Nube (Supabase)
- `nube.js` sustituye `window.localStorage` por una copia en memoria que se sincroniza con la tabla `linehot_datos` (clave/valor por usuario anónimo). Solo se sincronizan claves que empiezan por `neonCarnage` o `linehot`.
- `index.html` carga `nube.js`, espera a la nube (máx. `ESPERA_MS`) y entonces inyecta el resto de scripts en el mismo orden de siempre y lanza `load` a mano.
- `sw.js` ya no cachea peticiones a otros dominios (Supabase).
- Configuración: `NUBE_CONFIG` al inicio de `nube.js`. SQL: `supabase.sql`. Depuración: `Nube.estado()` en la consola.

## Pulido (nube y móvil horizontal)
- `nube.js` → un solo temporizador de subida (como mucho cada `GUARDAR_MS`): antes se reiniciaba con cada cambio y durante una partida no llegaba a subir. `Nube.vincular('cloudStatus')` pinta el estado (guardado / sincronizando / sin conexión / no se pudo subir); oculto si la nube no está configurada.
- `index.html` → `<p id="cloudStatus">` en el menú principal. `estilos.css` (final) → etiquetas largas (MODIFICADORES, CONTROLES) ya no se recortan en móvil horizontal, pestañas más altas para el dedo y estilo del indicador.

## v0.4 (mejoras.js y retoques)
- **Paredes** (`walls.js`): nuevas piezas grandes (U, cruz, T larga, escalera, barra 7…), arenas casi siempre simétricas, más densidad, límite de longitud de pared (`maxRun`), color por zona (verde → azul → violeta cada 5 oleadas, `WALL_PAL`). Al girar el móvil la arena conserva su oleada (`layoutWave`).
- **Enemigos rodean paredes** (`mejoras.js` · `flowGet/steer/hasLOS`): BFS desde la celda del jugador; cada enemigo va directo si ve al jugador y, si no, sigue la ruta (salto al punto más lejano visible). Usado por enemigos normales, tiradores, divisores, kamikazes (persecución) y minijefes. Antes se quedaban pegados a la pared para siempre.
- **Subpasos** (`engine.js` `loop`): con tirones, el juego se calcula en pasos de ≤ 0.034 s (nada atraviesa paredes).
- **Sangre persistente** (`addDecal/splat`): lienzo aparte, se desvanece al empezar la oleada siguiente; no se dibuja en modo RENDIMIENTO.
- **Fogonazo y casquillos**, **cámara lenta** al limpiar la oleada (1.4 s en jefe), **anuncios de combo** (10/20/35/50/75/100), **anillos de color** (`ring.col`).
- **Rozar balas (graze)**: +15 puntos, alarga el combo, recarga 0.25 s el pulso. Logros ROZADURA y CONTRA EL FRANCOTIRADOR.
- **Francotirador** (`makeEnemy(8)`, `kind:'sniper'`, desde la oleada 4): apunta con línea roja, se fija a los 0.85 s y dispara a 1.25 s. Nunca sale de la arena.
- **Jefes con nombre y color** (`LH.BOSSES`); desde el 2.º jefe, en fase 2+, **láser giratorio** (`LH.sweepTick`; 2 rayos desde el 3.º).
- **HUD**: barra de tiempo del combo, enemigos restantes bajo la oleada, nombre del jefe.
- **Bonificación SIN DAÑO** al superar una oleada sin golpes.
- **Reto diario**: las arenas usan semilla del día (`LH.hashStr`).
- **Comodidad**: cuenta atrás 3-2-1 al reanudar (estado `COUNT`), pantalla siempre encendida (`LH.wake`), **REDUCIR DESTELLOS** (`Settings.calm`, `body.calm`), pausa al perder el foco, `meta` duplicadas limpiadas.
- **PWA**: `sw.js` v5 guarda también la tipografía (Google Fonts) para jugar sin conexión.
- **Estado del juego nuevo**: `COUNT` (cuenta atrás). Si añades código que mira `engine.state === 'PLAYING'`, ten en cuenta que durante la cuenta atrás el mundo está quieto.
- **Pruebas hechas**: partida automática (modo dios) hasta la oleada 11 con jefes de nivel 1 y 2, minijefes, francotiradores y láser sin errores; 40 arenas × francotirador (siempre muere); enemigo tras pared larga (llega al jugador); menús, reto diario, pausa/cuenta atrás y blur; móvil horizontal 740×360.

## v0.5 (mejoras2.js)
- **Élites**: desde la oleada 3, hasta un 12 % de los enemigos (tipos 0, 2, 6, 7, 8) nacen con aro dorado, 2.5× de vida y +10 % de velocidad; dan +300 y sueltan siempre un objeto (`LH.makeElite`). Logro CAZAÉLITES.
- **Arma ARCO VOLTAICO** (`WEAPONS.ARC`, `LH.fireArc`): rayo en cadena (cono ±30°, 440 px; salta a otros 3 + nivel de PERFORANTES, 170 px, 80 % de daño por salto, respetando paredes). 110 municiones; está en `DROP_POOL`.
- **Mejoras nuevas**: RICOCHET (las balas rebotan en paredes, `Bullet.bounce`) y ADRENALINA (cada baja recarga 0.3 s el pulso por nivel).
- **Jefes de nivel 3+** (oleada 15+): orbes orbitales que queman y se pueden destruir (`LH.orbTick`, reaparecen a los 7 s).
- **Diseño**: esquirlas de cristal al morir (`shards`), la cuadrícula del fondo se tiñe con la zona y late con las bajas y sacudidas (`_gp`), marcas pulsantes en los últimos 2 enemigos de la oleada.
- **Sonido**: panorámica estéreo (`audio._px`, `LH.panned`) para disparos enemigos, bajas y francotirador; latido con menos del 30 % de vida; presentación del jefe; aviso de élite; clic al quedarse sin munición; sonido del arco; **slider EFECTOS** (`Settings.sfx`, `audio.sfxGain`) en Ajustes > Audio.
- `sw.js` → `linehot-v6`.
- **Pruebas hechas**: partida automática (modo dios, arco voltaico, ricochet y adrenalina) de la oleada 14 a la 17 con jefes de nivel 3 y láser sin errores; menús, slider de efectos, pausa/cuenta atrás y reto diario.
