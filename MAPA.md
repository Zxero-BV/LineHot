# Mapa del proyecto (LineHot 1.3)

> **Estructura unificada (v1.3):** el código está en solo 3 scripts: `nube.js` (Supabase y tu configuración), `motor.js` (núcleo del juego) y `extras.js` (todo lo añadido encima). Lo que antes eran archivos sueltos (`core.js`, `audio.js`, `mejoras3.js`…) ahora son **secciones** con una marca `// ########## [nombre.js] ##########`: en este documento, `` `nombre.js` `` significa «la sección con esa marca» (búscala con Ctrl+F). `motor.js` contiene core, audio, entities, engine, controles, menus, walls, jefes, sfx y arranque; `extras.js` contiene extras, mejoras, mejoras2…mejoras8 y carga (siempre la última).
> `index.html` carga `nube.js` y después `['motor.js', 'extras.js']`.

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
| Enemigo ESCUDERO, separación entre enemigos, sonidos de bloqueo | `mejoras3.js` (va después de `mejoras2.js`) |
| Multikill, sangre neón, jefe abatido | `mejoras4.js` (va después de `mejoras3.js`) |
| Jefe NULL SIGNAL (líneas de escaneo, saltos, ecos) | `mejoras5.js` (va después de `mejoras4.js`) |
| Fondo al ritmo (analizador de música: bombo + cajas, cuadrícula, anillos, focos, espectro radial, zoom, muros) | `mejoras6.js` (va después de `mejoras5.js`) |
| EN RITMO (bonus), objeto SOBRECARGA, mejoras CRÍTICOS y DETONACIÓN | `mejoras7.js` (va después de `mejoras6.js`) |
| RANGO y estadísticas del fin de partida, halo del jefe al compás | `mejoras8.js` (va después de `mejoras7.js`) |
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

## v0.6 (mejoras3.js)
- **ESCUDERO** (`makeEnemy(9)`, `kind:'shield'`, desde la oleada 6 sin jefe; 1, 1, 2, 2, 2, 3 por oleada): el escudo frontal (±72°) bloquea balas, láser y arco. Gira despacio (rodéalo). Katana, railgun, cohete y bomba atraviesan la guardia. El PULSO la rompe (aturdido 1.6 s). Embiste (aviso 0.6 s) y después queda 1.1 s con la guardia baja. +250 por baja. Logro FLANQUEADOR (15).
- **Separación entre enemigos** (`postUpdate`): ya no se apelotonan en una mancha; quien embiste no se desvía.
- **Sonido**: `playClang` (bala rebotando) y `playShieldBreak`.
- Consejo nuevo en CONTROLES > TRUCOS, `<link rel="icon">` (adiós al 404 del favicon), `sw.js` → `linehot-v7`.
- **Pruebas hechas**: bloqueo frontal/espalda/melee, pulso, ciclo de estados, separación, partida automática de las oleadas 5-6 con mejoras en 1280×720 y 740×360 táctil, sin errores.

## v0.7 (mejoras4.js)
- **MULTIKILL**: bajas con menos de 0.4 s entre sí → DOBLE/TRIPLE/CUÁDRUPLE/¡PENTAKILL!/¡MULTIKILL! (bonus 75·n², sacudida, anillo, sonido que sube de tono). Logro CARNICERO (5+).
- **SANGRE NEÓN**: con menos del 30 % de vida cada baja cura 3 HP.
- **JEFE ABATIDO**: cámara lenta 2.2 s, tres anillos de choque, anuncio y sonido propio.
- `sw.js` → `linehot-v8`. Pruebas: cadena de 5 bajas, curación, muerte de jefe sin errores.

## v0.8 (mejoras5.js) · jefe NULL SIGNAL
- Entra en `LH.BOSSES` como 2.º jefe (oleada 10): orden Warden, **Null Signal**, Reaper, Hydra, Cantor (los tiers de orbes/láser siguen la oleada).
- IA propia `LH.glitchAI` (`e.glitch`, `tier=1` → sin orbes ni láser giratorio). Ataques en rotación: ráfagas (3×3 balas), ESCANEO (líneas H/V con aviso de 1 s y haz que quema 22; 2/3/4 líneas según fase), SALTO (marca destino, intocable 0.25 s, reaparece con anillo de balas).
- Fase 2+: deja un ECO (`engine.echoes`) que dispara un abanico. Fase 3: más líneas, saltos más rápidos. Se apoya en `LH.bossTick` para las fases.
- Dibujo: monitor romboidal partido en canales rojo/cian con rebanadas desplazadas; sonido `playGlitch`.
- `sw.js` → `linehot-v9`. Pruebas: aparición en la oleada 10, líneas, salto, eco, fases 2 y 3, muerte, sin errores.

## v0.9 (mejoras6.js) · FONDO AL RITMO
- Ajustes > GRÁFICOS > FONDO AL RITMO (`Settings.beatBg`; por defecto activo en PC y apagado en móvil). Fila nueva en `index.html`.
- Un `AnalyserNode` colgado EN PARALELO de `audio.music.out` (solo música, el sonido no cambia) detecta el bombo (flujo de graves + media móvil, mín. 170 ms entre golpes) y `drawBackdrop` (envuelto) pinta: resplandor central, cuadrícula encendida, anillos por golpe y ecualizador de 32 barras.
- REDUCIR DESTELLOS = 30 % de intensidad y sin anillos; RENDIMIENTO = solo cuadrícula y anillos. Depuración: `LH.beat.n`, `LH.beat.v`.
- `sw.js` → `linehot-v10`. Pruebas: ~2.3 golpes/s detectados con el tema de la oleada 1 (165 BPM), interruptor y captura, sin errores.

## v1.0 (mejoras6.js ampliado + mejoras7.js)
- **Fondo al ritmo v2**: dos bandas (bombo = graves; caja/hats = medios-agudos). Bombo: resplandor, cuadrícula, anillos, *bombazo de cámara* (`Cam.punch`), muros iluminados (`drawWalls`), aro latiendo alrededor de la nave (`drawFx`). Caja: focos verticales que barren y franjas de luz arriba/abajo. Siempre: ecualizador inferior y **espectro radial** de 64 radios girando. El color sube con el combo (`LH.beatCols`: zona/rosa → rosa/amarillo ≥15 → amarillo/blanco ≥40). `beatUpdate` es idempotente por fotograma.
- **EN RITMO** (`mejoras7.js`): con FONDO AL RITMO activo, una baja dentro de 90 ms tras un bombo da bonus ♪ (30 × combo, máx. 10) y cuenta para el logro GROOVE (40).
- **Objeto SOBRECARGA** (`EXTRA_PK.OVERDRIVE`, «O» magenta, en `LH.EXTRA_DROPS`): 6,5 s a doble cadencia, chip en pantalla y aro punteado.
- **Mejoras nuevas** en `LH.UPS`: CRÍTICOS (8 %/nivel de daño ×2, 4 niveles) y DETONACIÓN (explosión al morir con cadena, profundidad máx. 4, 3 niveles).
- 3 consejos nuevos en TRUCOS. `sw.js` → `linehot-v11`.
- **Pruebas**: cadena de 10 enemigos con DETONACIÓN (7 bajas encadenadas), SOBRECARGA + chip, 5 bajas al ritmo, bombos y cajas detectados, capturas con combo 0 y 20, sin errores.

## v1.1 · Control de calidad (QA)
**Qué se revisó**: sintaxis de los 22 archivos JS; análisis estático (variables sin definir, redeclaraciones entre archivos, claves duplicadas) sobre el bundle en orden de carga; archivos de `index.html` / `sw.js` / manifiesto; ids del DOM; partidas automáticas (bot con ratón/teclado y con toques reales por CDP) en 1280×720, 740×360 táctil y 390×844 táctil, con y sin modo dios, modificadores (frenesí, horda, cristal), saltos de oleada hasta la 30, los 5 jefes (Warden, Null Signal, Reaper, Hydra, Cantor), todos los enemigos, objetos y armas, pausas, giros, pérdida de foco, cambios de calidad, reintentos; monitor de invariantes cada 100 ms (NaN, enemigos fuera de la arena, oleada atascada, nº de enemigos/balas/partículas, memoria); almacenamiento bloqueado; nube configurada pero caída (carga en 2 s, juega local); tamaños 320×240, 360×640, 1024×300, 2560×1440; flujo completo de menús, fin de partida, compartir y volver a jugar; rendimiento por efecto del fondo al ritmo; música (`audio.music.diag()`).
**Errores encontrados y corregidos**
1. *Enemigos expulsados de la arena* (`mejoras3.js`, separación entre enemigos): pegado a una esquina o borde, el empuje entre enemigos los sacaba de la pantalla y ya no se les podía disparar → la oleada no terminaba. Ahora un enemigo que entró en la arena no puede volver a salir (red de seguridad válida también contra el empuje del pulso).
2. *Balas perforantes atravesaban el escudo del ESCUDERO* (escopeta / PERFORANTES): ahora la bala bloqueada se elimina.
3. *Fondo al ritmo pesado en equipos lentos* (`mejoras6.js`): las luces suaves se pintan a 1/4 de resolución y todo el efecto escala con la calidad gráfica (`Q.level`, también la automática): nivel 0 todo · 1 sin espectro radial · 2 solo resplandor, cuadrícula y anillos · 3/RENDIMIENTO solo cuadrícula. Interruptores de depuración en `LH.beatF`.
4. *Robustez*: la explosión en cadena de DETONACIÓN decrementa su contador dentro de `finally`.
**Resultado**: 0 errores de página, 0 NaN, 0 atascos tras las correcciones; memoria estable (3-11 MB) en partidas de 5-7 minutos; la música sin cortes en un solo equipo (2 reenganches con 2 navegadores y dibujado por software en paralelo).
**Limitaciones conocidas**: el navegador de prueba dibuja por software, por eso los FPS de las pruebas (25-50 con efectos completos) no representan a un móvil o PC real; el audio no se pudo escuchar (solo se comprobó que se genera y se analiza). La nube (Supabase) se probó únicamente en modo caído porque las claves siguen siendo `PEGA_AQUI`.
`sw.js` → `linehot-v12`.

## v1.2 (mejoras8.js)
- **Fin de partida**: RANGO S/A/B/C/D (`LH.rankOf`: onda 5/10/15/20 = C/B/A/S; +1 escalón con combo ≥ 50 y +1 con 3+ jefes) y fila compacta con JEFES, MULTIKILL máx. y AL RITMO (solo si hay). Contadores por partida: `bossKills`, `mkMax`, `beatKills`.
- **Halo del jefe** que late con el bombo (FONDO AL RITMO, calidad ≤ 1, sin REDUCIR DESTELLOS).
- `sw.js` → `linehot-v13`. Pruebas: resumen en 1280×720 y 740×360 (todo cabe), soak de regresión sin errores.

## v1.3 · Unificación de archivos
- 20 archivos JS → 3 (`nube.js`, `motor.js`, `extras.js`) concatenando en el mismo orden de carga; se comprobó que el código ejecutable es idéntico (solo cambian comentarios y marcas de sección).
- `sw.js` → `linehot-v14` con `FILES` nuevo. `index.html`: `ARCHIVOS = ['motor.js', 'extras.js']`, meta descripción/Open Graph y versión visible en el menú.
- Nuevo `README.md` (estructura, ejecución local, Supabase, publicación en GitHub Pages/Vercel, guía de modificación).

## Curva de dificultad suave (v1.4)
- Enemigos nuevos más tarde: tirador w3, enjambre w4, cuadrado w7, kamikaze w6, divisor w7, círculo w8, francotirador w8, escudero w9, élites w6 (antes w2–w5).
- Menos enemigos (`3 + w + w/3` en vez de `4 + w + w/2`), vida de enemigos +10 %/oleada (antes +18 %), aparición más espaciada y menos enemigos a la vez.
- Daño más bajo (cuadrado/círculo 30, kamikaze 20, francotirador 22, tirador 12), más invulnerabilidad tras un golpe (0.6 s balas / 0.8 s contacto), +25 de vida al limpiar oleada y más corazones con poca vida.
- Jefe: hueco mayor en el anillo, patrones más espaciados, embestida avisada más tiempo. Mejora entre oleadas ya en la oleada 2.
- `sw.js`: `CACHE` = `linehot-v15`.

## Armas en pixel art y armas dobles (v1.5)
- `extras.js` → sección `[armas.js]`: sprites pixel art por arma (`LH.PIX`, 'a'/'A' = color del arma), dibujados en la mano del jugador y en el HUD (`<canvas id="weaponIcon">`, estilo al final de `estilos.css`).
- Dobles: recoger otra vez la misma arma (SHOTGUN, MINIGUN, KATANA, LASER, ARC; marcadas con `canDual`) o la nueva AKIMBO (2 pistolas, munición limitada). Disparan a la vez, gastan 1 de munición por andanada y la cadencia baja un 20 %. Katanas dobles: cortan delante y detrás. RAILGUN y ROCKET no son dobles.
- `motor.js` (HUD del jugador) llama a `LH.wLabel` y `LH.paintWeaponIcon`. `sw.js`: `CACHE` = `linehot-v16`.

## v1.4 · PIXEL ART v2 (`extras.js` → sección `[pixel.js]`, justo antes de `[carga.js]`)
- **Armas** (`LH.PIX`): las 8 armas redibujadas (hasta 24×12 px) con contorno, 4 tonos de metal/madera, brillos y detalles; el acento usa el color del arma (`a`/`A`/`q`). Se ven en la mano, en el HUD y en el suelo. Para editar una, cambia sus filas en `LH.PIX` (`.` = vacío).
- **Enemigos** (`LH.pixBody`, formas en `LH.SH`, detalles en `LH.DE`): drone, tanque, tirador, kamikaze (dardo), divisor (célula) y escudero se generan por código a resolución de píxel, con contorno neón, núcleo oscuro con tramado, anillo de luz interior y detalles. Sustituyen a `enemyBody`/`kindBody`/el dibujo del escudero; mismos tamaños, resplandor y caché `Spr` (sin coste extra por fotograma).
- **Armas en el suelo**: `Pickup.prototype.draw` envuelto; muestran su sprite con halo y balanceo.
- `sw.js` → `linehot-v17`.
