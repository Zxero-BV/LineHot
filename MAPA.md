# Mapa del proyecto (LineHot 2.16)

> ## v2.16 · panel de arma con armas largas y panel de admin oculto en móvil
> - **Bug del railgun:** el estado «RECARGANDO / LISTO» y los modificadores del arma ensanchaban el panel y lo sacaban de la pantalla. En móvil el texto es corto (`8 ..` recargando / `8 OK` listo; `motor.js`) y el panel tiene ancho máximo con texto que se ajusta (`estilos.css`, final).
> - **Panel de admin en móvil:** ya no hay pestaña «ADM» ni el gesto de 5 toques en la esquina. Se desbloquea tocando 7 veces el texto «LINEHOT v…» del menú principal y escribiendo el código `ADMIN_PIN` (arriba de `js/13b-admin.js`, por defecto `2580`; cámbialo). También vale `?admin=CÓDIGO`. El desbloqueo dura solo la sesión de la pestaña. En PC sigue F2 / `?admin`.
> - `sw.js` → `linehot-v48`; `index.html` carga con `?v=2.16`.


> ## v2.15 · interfaz móvil (solo `estilos.css`, capa `[movil3.css]` al final)
> - **Menús que no se cortan:** `#screens` usaba `justify-content:center`, que en pantallas bajas dejaba la parte superior inalcanzable; ahora el panel se centra con `margin:auto` y se puede desplazar hasta arriba.
> - **360×640 / iPhone SE en vertical:** el menú principal (título en una línea, huecos más pequeños) y las pantallas de pausa y fin de partida caben enteros.
> - **Horizontal pequeño (≤720 px, p. ej. 640×360):** la columna izquierda se encoge (`minmax(0,1fr)`) y los botones de la derecha ya no se salen de la pantalla (antes «CONTROLES» y «MODIFICADORES» se cortaban).
> - **HUD vertical sin solapes:** el aviso del tutorial y la barra de jefe bajan debajo del panel de arma (antes lo pisaban); el panel de arma es más compacto. En horizontal el aviso no invade el panel de arma.
> - Toques: `touch-action: manipulation`, sin resaltado ni selección de texto, botones ≥ 44 px.
> - `sw.js` → `linehot-v47`; `index.html` carga con `?v=2.15`.


> ## v2.14 · música: pantalla de mejoras, cruces y abyss nuevo
> - **Pantalla de mejoras:** ya no cambia de tema. El que sonaba en la oleada sigue, más bajo (−60 % de volumen) y amortiguado (filtro ~1,3 kHz), con entrada/salida suaves (`MusicEngine.menuF`, `setMenu()`). El tema `misterio` se quitó del juego (su fórmula sigue en `herramientas/fuentes_temas.js`, sin MP3).
> - **Cruces más suaves:** de un tema épico a otro (incoming → minijefes, etc.) ya no suena riser ni golpe; los minijefes entran con un cruce de 3,5-4 s.
> - **`abyss` rehecho** (`fuentes_temas.js`): mismo esqueleto oscuro (128 BPM, 16 compases) pero con pad de acordes Em·F·G, arpegio con eco estéreo y una melodía con vibrato que entra en el compás 5.
> - `sw.js` → `linehot-v46`; `index.html` carga con `?v=2.14`.


> ## v2.12 · 3 temas nuevos de música (fórmulas de Dollchan)
> Ahora hay **10 temas** en `musica/`. Los nuevos se renderizaron desde sus fórmulas (`herramientas/fuentes_temas.js`) igual que los demás:
> | Tema | Fórmula original | Cuándo suena |
> |---|---|---|
> | `incoming` | epic_boss_incoming (bytebeat 44100 Hz, mono) | La oleada anterior a un jefe (9, 14, 19…; sección `'pre'`, también su descanso) **y los jefes de las oleadas 10, 20, 30…** (continúa sin cortes y a plena capa; si entra directo al jefe salta la intro). Las capas entran poco a poco (arpegio → bajo → acordes → percusión: **intro de 16 compases que suena una vez**, luego bucle de 12). |
> | ~~`misterio`~~ | song_misterioso | Quitado en v2.14 (la pantalla de mejoras ahora baja el volumen del tema en curso). |
> | `techno` | techno computer (bytebeat con signo, estéreo, 44100 Hz) | Oleada 7, y de vez en cuando en el tramo final (17, 26-27, 37…). |
> - `motor.js`: `MUSIC_TRACKS` / `MUSIC_ORDER` con los 3 temas nuevos, `computeDesired()` con el techno, la sección `'pre'` y el modo menú; `introBars` en `MUSIC_TRACKS` (compases que suenan una sola vez antes del bucle); `startWave` marca `'pre'`.
> - `render_musica.js` acepta ids (`node herramientas/render_musica.js incoming techno`) para renderizar solo esos sin tocar los demás MP3; soporta `intro` y `mono`.
> - Frecuencias de muestreo **supuestas** (la fórmula original no las indica): incoming 44100, misterio 22050, techno 44100. Si en Dollchan suena distinto, cambia `rate` en `T` de `render_musica.js` (y `seg`/`bar` si procede) y vuelve a renderizar ese tema.
> - `sw.js` → `linehot-v45`. v2.13: `index.html` carga los scripts con `?v=2.13` (el navegador no reutiliza un `motor.js` viejo; **sube ese número cuando cambies archivos**) y `sw.js` ya sirve sin conexión aunque la URL lleve `?v=`.
> - `incoming` también suena en la oleada siguiente a los jefes 10, 20, 30… (11, 21, 31…).


> ## v2.11 · panel de administrador (`js/13b-admin.js`)
> Herramienta de pruebas: invocar jefes y enemigos, ir a cualquier oleada, armas con rareza, objetos, mejoras, modificadores, invulnerabilidad, munición infinita, velocidad del tiempo, etc.
> - **Abrir:** F2 (o `` ` ``) en PC · 5 toques rápidos en la esquina superior izquierda en móvil · `?admin` en la URL. Después queda una pestaña «ADM» en el borde izquierdo (`localStorage.linehotAdmin`). Consola: `LH.adm`.
> - **Modo pruebas:** en cuanto usas el panel, la partida no guarda punto de control, no borra tu partida guardada al morir, no sube al ranking y se restauran récords, mejores partidas, reto diario, logros y progreso (`LH.adm.runUsed`).
> - **Ganchos:** envuelve `Player.hp` (invulnerable), `GameEngine.update` (tiempo, munición, pulso), `spawnLogic` (detener oleadas) y `Enemy.update` (enemigos quietos). Va después de `13-ranking.js` y antes de `14-carga.js`.
> - Para publicar sin el panel: quita `js/13b-admin.js` de `ARCHIVOS` (`index.html`) y de `FILES` (`sw.js`).
> - Si añades un jefe nuevo, aparece solo en el panel si lo metes en `LH.BOSSES`.

> ## v2.10 · música en MP3 en bucle
> La música ya no se calcula en tiempo real (bytebeat en Worker + AudioWorklet, ~1.100 líneas en `motor.js`): ahora son **7 MP3 en `musica/`** que se decodifican una vez y se reproducen en bucle con WebAudio (CPU casi nula, sin entrecortes).
> - Sección nueva `[music_mp3.js]` en `motor.js` (reemplaza `music_base`, `music_motor` y `music_minijefes`). La clase `MusicEngine` mantiene la misma API para el resto del juego (`audio.music.setSection/setWave/setCombo/setHealth/onKill/newRun/start/stop/whenReady/out/baseFrame…`).
> - El director adaptativo es el mismo (`computeDesired()`: cuándo suena cada tema), con cruces de potencia constante en el siguiente compás, filtro que oscurece con el progreso/peligro, riser + impacto en los cambios de escena y latido con poca vida (ahora con osciladores).
> - `MUSIC_TRACKS` guarda por tema el archivo, `n` (muestras del bucle a 44,1 kHz) y `bars` (compases). Si cambias un MP3 por otro, ajusta esos dos números.
> - Los bucles son sin costura (el final está mezclado con el principio) y el código corrige solo el relleno del MP3 si un navegador no lo recorta.
> - En móvil los temas se cargan por delante de donde vas y se sueltan los que llevan rato sin sonar (menos memoria).
> - `sw.js`: los MP3 van en la lista de archivos y se sirven primero desde la copia local (si los cambias, sube `CACHE`).
> - `herramientas/render_musica.js` (+ `fuentes_temas.js` con las fórmulas originales) regenera los MP3. Los ajustes de calidad de música (frecuencia interna) ya no hacen nada.

> ## v2.3 · `extras.js` dividido en la carpeta `js/`
> `extras.js` (5.100 líneas) ya no existe: se partió **sin cambiar ni una línea** en archivos consecutivos por tema (la suma de todos es idéntica al original, y se cargan en el mismo orden). Donde más abajo ponga `extras.js`, busca la marca `// ########## [nombre.js] ##########` en estos archivos:
>
> | Archivo | Marcas que contiene | Qué hay |
> |---|---|---|
> | `js/01-base.js` | `[extras.js]` | LH, mejoras entre oleadas, modificadores, mando, tutorial, logros, mejores partidas, reto diario |
> | `js/02-enemigos.js` | `[mejoras.js]` `[mejoras2.js]` `[mejoras3.js]` `[mejoras4.js]` | navegación, sangre, francotirador, élites, arco voltaico, escudero, multikill |
> | `js/03-jefe-null-signal.js` | `[mejoras5.js]` | jefe NULL SIGNAL |
> | `js/04-ritmo-y-rangos.js` | `[mejoras6.js]` `[mejoras7.js]` `[mejoras8.js]` | fondo al ritmo, sobrecarga, críticos, rango y estadísticas del final |
> | `js/05-armas.js` | `[armas.js]` | armas y munición base |
> | `js/06-pixel-art.js` | `[pixel.js]` `[pixel3.js]` | sprites pixel art |
> | `js/07-animaciones.js` | `[animaciones.js]` `[mejoras9.js]` `[animaciones2.js]` | animaciones del héroe, enemigos y efectos |
> | `js/08-sistema.js` | `[seguridad.js]` `[perfil.js]` `[fluidez.js]` | seguridad, perfil, resolución dinámica y pantalla «PREPARANDO PARTIDA» |
> | `js/09-jefes-y-minijefes.js` | `[mejoras10.js]` | minijefes PRISMA/PULSAR/TEJEDOR y jefe ECLIPSE |
> | `js/10-armas-inventario.js` | `[armas2.js]` `[armas3.js]` | inventario de armas, rareza, calidad y modificadores |
> | `js/11-partida.js` | `[partida.js]` | **nuevo**: guardado de partida / CONTINUAR |
> | `js/12-dificultad.js` | `[dificultad.js]` | **nuevo (v2.4)**: topes por tipo de enemigo y curva de vida desde la oleada 11 (`LH.DIF`, `LH.difTabla()`) |
> | `js/13-ranking.js` | `[ranking.js]` | ranking online |
> | `js/13b-admin.js` | `[admin.js]` | **nuevo (v2.11)**: panel de administrador / pruebas |
| `js/14-carga.js` | `[carga.js]` | pantalla de carga (siempre el último) |
>
> **Reglas:** el orden numérico es el orden de ejecución y **importa** (unos archivos envuelven funciones de otros). Los nombres de los archivos nuevos deben mantener el orden; `14-carga.js` va siempre al final. Si añades un archivo, ponlo en `ARCHIVOS` (`index.html`) y en `FILES` (`sw.js`).

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

## Arreglo: música que se corta y barra de ritmo que desaparece
- `motor.js` (calidad auto): `autoQuality` exige 3 s seguidos por debajo de 40 FPS (antes 2 s a 45), no actúa los primeros 6 s de una partida ni con la pestaña oculta, y `init()` restaura la calidad del modo elegido en cada partida (antes la bajada se arrastraba al reintentar y con ella desaparecía el ecualizador).
- `extras.js` (mejoras6): el ecualizador se dibuja también en nivel 2; el analizador usa `maxDecibels = -12` y umbrales con tope, porque los graves se saturaban en 1.0 y el bombo no se detectaba (la barra se quedaba pegada).
- `motor.js` (MusicEngine): margen de arranque 0.25 s (antes 0.08 s provocaba un corte al empezar) y `watchClock()`, que detecta cuando el hilo de audio del navegador se queda sin tiempo (demasiados efectos) y aligera efectos + sube el colchón.
- `sw.js`: `CACHE` = `linehot-v18`.

## Pixel art (paredes, HUD, nave, efectos)
- `motor.js` · `buildWallCache`: paredes con azulejos de 10×10 píxeles (1 px = 5 u.) ampliados sin suavizado. Zona 0 ladrillo, zona 1 placas de metal con remaches, zona 2 cristal. Borde de neón de 2 px con luz arriba/izquierda, sombra proyectada y halo punteado (sin `shadowBlur`, así es además más barato).
- `motor.js` · `pixDot()` (partículas y manchas = cuadrados en rejilla de 3 u.), `drawRings` (ondas = anillo de cuadrados) y nave del jugador rasterizada a 2 u. por píxel (`Player.pix`).
- `estilos.css` (bloque final «PIXEL ART · HUD»): fuente Press Start 2P para cifras y etiquetas cortas, barras segmentadas con esquinas recortadas, panel de arma con marco del color del arma, botones/cuadros con marco de 2 px y bisel, sombras duras en vez de resplandores.
- `extras.js` · `LH.paintWeaponIcon`: icono del arma a escala entera (2× o 3×) y color del marco (`--wc`).
- `sw.js`: `CACHE` = `linehot-v19`.

## PIXEL ART v3 · protagonista, enemigos, jefes, balas y objetos (`extras.js` → sección `[pixel3.js]`, antes de `[carga.js]`)
- **Protagonista** (`LH.heroGrid`, `LH.drawHero`): héroe cenital (mochila con luz, casco con visera, hombreras, botas y manos que sujetan el arma) en una rejilla de 24×22 px. Animación de zancada al moverse (3 fotogramas) y luz de la mochila parpadeando. Gira dentro de la rejilla de arte (32 ángulos, vecino más cercano) y se amplía a escala entera. Con armas dobles los brazos se abren. Sombra de píxeles. Hueco en `motor.js` (`Player.draw`): `LH.drawHero`.
- **Enemigos** (`LH.SPR`): drone, tanque, tirador, enjambre, kamikaze, divisor, francotirador y escudero dibujados a mano (cada fila es texto; `half` = se espeja en x, `top` = se espeja en y, `both` = ambos). Claves: `k` contorno, `d m c l h` rampa del color del enemigo, `w r y o g G` colores fijos, `E` ojo (parpadea), `x` solo fotograma A, `z/Z` solo fotograma B (llamas). Aura de píxeles con tramado en lugar de resplandor. `LH.eFrame` da el fotograma (4 por segundo). Ganchos: `Enemy.draw` (motor.js, ids con fotograma), enjambre como sprite, kamikaze/divisor y francotirador (extras.js).
- **Jefes y minijefes** (`LH.bigGrid`, `LH.drawBig`): coraza poligonal (jefe 8 lados, minijefe 6) con placas, remaches y borde de luz; jaula interior (cuadrado/triángulo) que gira en sentido contrario; núcleo que late hecho de cuadrados. La luz es fija (se calcula tras girar); 12 pasos por vuelta. Gancho en `Enemy.prototype.drawBig` (motor.js). El jefe «glitch» sigue en vectorial.
- **Balas** (`GameEngine.prototype.drawBullets`): proyectiles cuadrados en rejilla de 3 u. con estela de 3 píxeles y núcleo blanco.
- **Objetos**: corazón, escudo, reloj de arena, imán y bomba como iconos pixel art flotando sobre su halo (`ICON` en `Pickup.prototype.draw`).
- `sw.js` → `CACHE` = `linehot-v20`.

## v1.5 · Pantalla de carga en 2 fases (`extras.js` → `[carga.js]`)
- **Fase 1/2 · gráficos y sonido**: motor, efectos y **precarga de entidades** (`LH.preloadTasks`): 384 posturas del héroe (`LH.heroRot`), enemigos de cada color (`LH.eArt`), jefes y minijefes en sus 12 giros (`LH.bigArt`), armas y objetos. Antes se generaban al aparecer, en plena partida. Si la precarga tarda más de 2,5 s (equipo justo) el colchón de música sube a 1,6 s.
- **Fase 2/2 · música**: la barra vuelve a 0 y espera al worker (que se calienta en paralelo desde el inicio). Seguro: entra igualmente a los 30 s.
- Depuración: al terminar la carga, la consola muestra `[carga] precarga {preloadMs, tareas}` y `audio.music.diag()`. También `LH.boot`.
- `sw.js` → `linehot-v21`.

## v1.5.1 · El protagonista sigue al ratón siempre
- `motor.js` → `Player.prototype.update`: sin disparar, `angle` apunta al ratón (si no hay toque reciente ni mando activo). Antes solo giraba con el botón pulsado. `sw.js` → `linehot-v22`.

## v1.6 · Advertencia de epilepsia, modo anti-epilepsia y audio estable (`extras.js` → `[seguridad.js]`)
- **Advertencia** (`#pEpi` en `index.html`): sale la primera vez (clave `linehotEpiVisto`) con dos botones: ACTIVAR MODO ANTI-EPILEPSIA / ENTIENDO, CONTINUAR. Aviso fijo también en el menú principal.
- **MODO ANTI-EPILEPSIA** (`Settings.epi`, Ajustes > Juego): fuerza `calm`, sin sacudida, sin fondo al ritmo y sin balanceo + clase `body.epi` (CSS sin parpadeos). Al desactivarlo se restauran los valores anteriores (`Settings.epiPrev`).
- **AUDIO ESTABLE** (`Settings.audioSafe`, Ajustes > Audio, por defecto sí; recargar para aplicar): `AudioContext` con `latencyHint: 'playback'` (motor.js, `AudioEngine`). `audio.music.diag()` ahora incluye latencias, atascos de audio y estado del contexto.
- `sw.js` → `linehot-v23`.

## v1.7 · Fondo de menú en pixel art y animaciones del protagonista (`extras.js` → `[animaciones.js]`)
- **Fondo de menú** (`MB`, canvas `.mb-pix` dentro de `.menu-bg`): escena de 144 px de alto escalada sin suavizar: cielo con estrellas, sol retro con franjas, dos capas de ciudad neón con parallax, suelo en perspectiva y, delante, el protagonista corriendo y disparando a drones/tanques/kamikazes/divisores que llegan y explotan en píxeles. Solo se dibuja con el menú visible (30 FPS), y no en modo RENDIMIENTO. Con REDUCIR DESTELLOS / ANTI-EPILEPSIA: sin parpadeo de estrellas/antenas/fogonazo y movimiento a la mitad. Estilos al final de `estilos.css`.
- **Protagonista** (`LH.drawHero` reescrito, fotogramas en `LH.heroGrid`): respira al estar quieto (frame 3), retrocede al disparar (frame 4), aparición con línea de escaneo, tinte rojo 0,18 s al recibir daño (`LH.heroTint`), LED rojo + chispas/humo con poca vida, polvo al correr (`LH.heroFx`). La precarga genera ahora 960 variantes (5 fotogramas × 3 LED).
- `sw.js` → `linehot-v24`.

## v1.8 · Ritmo vivo, enemigos nuevos, sinergias, skins, bestiario y muerte en píxeles (`extras.js` → `[mejoras9.js]`)
- **Bug de barras/halo/luces al ritmo**: (1) `autoQuality` solo bajaba y apagaba los efectos en oleadas altas → ahora los efectos al ritmo tienen tope de nivel 2 (`drawBackdrop`) y la calidad **sube de nuevo** tras 10 s a ≥57 FPS (espera creciente si oscila); (2) al pausar se suspendía el audio → ahora la música sigue a 40 % (`LH.duck`) y el fondo se redibuja a 30 FPS en `pPause` (CSS más claro, sin escena de pixel art).
- **Enemigos** `flank` (tipo 10, desde onda 6: orbita, avisa con línea amarilla y embiste) y `medic` (tipo 11, desde onda 9: cura un 15 % a los cercanos cada 2,6 s). Sprites en `LH.SPR`, IA en `LH.flankAI`/`LH.medicAI`, aparecen vía `startWave`.
- **Sinergias** (`LH.synergy`, desde `LH.onKill`): SED DE SANGRE (vampirismo+críticos), FUEGO CRUZADO (potencia 2+ y cadencia 2+), SOBRECARGA (pulso rápido+onda expansiva). Logro SINERGIA.
- **Skins** (`LH.SKINS`, giran el tono del traje en `LH.skinCv`; se eligen en Progreso › SKINS; se guardan en `linehotSkin`) y **Bestiario** (`LH.BEST`, Progreso › BESTIARIO, con bajas por tipo). Logros nuevos: ESQUIVADOR, SIN MÉDICOS, SINERGIA, NATURALISTA.
- **Muerte**: el protagonista se rompe en sus píxeles + onda de choque cuadrada (`LH.shatter`). El fondo del menú ahora tiene ecualizador, sol y horizonte al ritmo.
- `sw.js` → `linehot-v25`.

## Animaciones v2 (`animaciones2.js`, sección de `extras.js`, antes de `seguridad.js`)
- Todo cuelga de `LH.A`; cada gancho está protegido (si falla 3 veces se apaga solo en `LH.A.off`). Para desactivar una parte a mano: `LH.A.off.enemy = true` (también `hero`, `bullets`, `fx`, `draw`, `core`, `pickup`, `death`).
- **Héroe**: `LH.heroGrid2/heroRot2` (pies que siguen la dirección real del paso, mochila, respiración, poses de pulso/estocada/golpe), `A.heroStep` (ciclo de andar por distancia recorrida), `A.heroPose`.
- **Armas**: tabla `A.WP` (retroceso, corredera, fogonazo por arma), `A.drawWeapon`, casquillos (`A.shellFx`), calentamiento del minigun, carga del railgun, sacar el arma.
- **Enemigos**: `A.drawEnemy` (aparición, balanceo por tipo, aplastamiento al golpe, aviso del tirador), `A.onDeath` (trozos de su propio sprite + silueta + chispa), `LH.eFrame` según velocidad.
- **Balas / objetos / texto / efectos**: `A.drawBullets`, `A.wallSpark`, rebote y confeti de objetos, `A.drawTexts` (pop), katana (`A.drawSlashes`), cohete y explosión (`A.fball`), onda del pulso.
- HUD: clases `hudCombo*`, `hudHit*`, `hudEq*` al final de `estilos.css`. `sw.js` → `linehot-v26`.


## Música con AudioWorklet (v1.4)
- `motor.js` → sección `music_motor` (`musicWorkerMain`, `musicWorkletMain`, `MusicEngine`): el Worker sintetiza y envía los bloques DIRECTAMENTE al AudioWorklet (`lh-music`) por un `MessageChannel`, y se rellena según lo que el worklet consume. El hilo del juego ya no programa bloques, así que un fotograma lento no corta la música.
- Si el navegador no soporta AudioWorklet (o tarda más de 4 s en cargarlo), se usa el sistema anterior (bloques programados con `setTimeout`), sin cambios.
- Depuración: `audio.music.diag()` ahora incluye `via` (`'worklet'` o `'bloques'`). Con worklet, `cortes` solo cuenta vaciados reales de la cola.
- La pantalla de carga espera también a que el worklet esté listo (máx. 4 s).

## Medidor de rendimiento
- `extras.js` → sección `perfil.js`: en la consola, `LH.prof(8)` y juega 8 s; muestra una tabla con los ms por fotograma de update, fondo al ritmo, paredes, partículas, enemigos, etc. Los ganchos se retiran al terminar.

## v1.7 · Fluidez: 60 FPS en CALIDAD sin quitar efectos (`motor.js` + `extras.js` → `[fluidez.js]`, antes de `[carga.js]`)
- **Ritmo de fotogramas según la pantalla** (`motor.js` → `loop`, `_trackHz`): antes el limitador (margen fijo de 14,7 ms) hacía que en 75/90/144 Hz salieran 37/45/48 FPS. Ahora mide la frecuencia real (percentil 20 de los intervalos de `requestAnimationFrame`) y dibuja cada N refrescos: 60 Hz → todos · 75/90 Hz → todos · 120 Hz → 1 de cada 2 · 144 Hz → 1 de cada 2 (72) · 240 Hz → 1 de cada 4. Depuración: `LH.fluz()`.
- **Resolución dinámica** (`LH.dyn`, `LH.setDyn`): si los FPS caen por debajo del 88 % del objetivo durante 1,5 s, baja los PÍXELS del lienzo (100 → 86 → 74 → 64 %, nunca por debajo de ~0,75 px/px CSS). No toca resplandor, partículas, CRT ni fondo al ritmo. Sube de nuevo tras 12 s estables (espera creciente si oscila). Solo si ya está al mínimo actúa la calidad automática de siempre (bajar efectos), como último recurso.
- **Sprites a escala fija** (`sprK`, `dprBase`, `dynScale` en `motor.js`): los sprites con resplandor se dibujan una vez a la resolución completa del modo y NO se rehacen al cambiar de paso; `renderK` (lienzo) sí cambia. La sangre del suelo (`decalCtx`) se reescala en vez de borrarse.
- **Pantalla «PREPARANDO PARTIDA»** (`LH.prepRun`, envuelve `GameEngine.prototype.init`, `#playLoader`): al pulsar JUGAR / REINTENTAR / RETO DIARIO precalienta gráficos, dibuja una escena cargada (enemigos, balas, partículas, anillos) para calibrar la resolución inicial (máx. 2 bajadas / ~2 s), comprueba que la música está lista y arranca. Dura ~1 s en equipos rápidos. El paso de resolución se recuerda por dispositivo, tamaño y modo (`localStorage.linehotDyn`). Mientras dura se bloquean teclas y clics.
- **Pruebas**: simulación de `requestAnimationFrame` a 60/75/90/120/144/165/240 Hz; secuencias de FPS simuladas para el controlador (baja, se mantiene, sube); JUGAR con doble clic y Esc durante la carga; partida → morir → REINTENTAR; cambio de resolución con manchas de sangre (se conservan); móvil horizontal 740×360 táctil; 0 errores de página. El navegador de prueba dibuja por software, así que los FPS absolutos no equivalen a un móvil real.
- `sw.js` → `linehot-v28`.

## v1.8 · Audio en oleadas altas: música «bajo el agua» y efectos apagados (`motor.js`)
**Causas encontradas** (reproducidas con el núcleo de música fuera del juego):
1. **Filtro que oscurece** (`MusicCore.coefs`): el corte bajaba con el progreso (`dark = oleada/12`) y la poca vida hasta ~1,4 kHz (840 Hz en el peor caso) con la oleada ≥13: sonido «bajo el agua». Ahora `corte = 3000 + 4000·0,1^tono` (nunca por debajo de ~3,4 kHz; en la oleada 13 pasa de 2,6 kHz a 4,4 kHz, y con poca vida de 1,4 a 3,7 kHz). Sigue oscureciéndose, pero se oye.
2. **Saturación acumulada** (`macros`): `driveT` llegaba a x3,15 y aplastaba la dinámica. Ahora `1 + 0,95·dark + 0,3·jefe + 0,25·energía` (máx. ~2,5).
3. **Degradación de la música sin vuelta atrás** (`MusicCore.degrade`): si el CPU iba justo (móvil caliente, otra app) bajaba de calidad (capas, frecuencia interna a 12 kHz, repetición de muestras) y no se recuperaba hasta recargar la página. Ahora cada paso hecho en partida se apunta en `degStack` y `improve()` lo deshace tras ~25 s con el CPU tranquilo (<22 %); si vuelve a fallar justo después, la espera se duplica (máx. 300 s).
4. **Modo ligero de efectos permanente** (`SFX_LITE`): tras 2 «atascos» de audio en 10 s se activaba para siempre (sin reverb, 8 voces: efectos «comprimidos» que se pierden). Ahora se desactiva tras 30 s sin cortes (la espera se duplica si recae enseguida, máx. 240 s) y el colchón de música vuelve a su valor.
5. **Falsos atascos** (`MusicEngine.watchClock`): se medía en intervalos de 30-40 ms, pero el reloj de audio avanza a saltos del tamaño del búfer (40-90 ms con `latencyHint: 'playback'`) y eso activaba el modo ligero sin motivo. Ahora se mide en ventanas de ~1 s y solo cuenta si se pierden >140 ms.
6. **Compresor general** (`AudioEngine`): umbral -12 dB, razón 15:1, release 0,1 s (casi un limitador que «bombeaba» con explosiones + música). Ahora -9 dB, 5:1, rodilla 18, ataque 6 ms, release 0,18 s.
7. **Voces críticas sin tope** (`_sfxVoice`): explosiones, pulso y golpes nunca se descartaban; en cadena saturaban el hilo de audio y todo dejaba de sonar. Ahora hay un tope duro (voces máx. + 12, o + 6 en táctil) y las explosiones casi simultáneas se funden en una.
8. **Audio suspendido** (`watchClock`): si el navegador suspende el `AudioContext` en plena partida, se reanuda solo (cada 1,5 s mientras la pestaña esté visible).
- Depuración: `audio.music.diag()` (cortes, atascos, colchón), `SFX_LITE`, `audio.music.getState()`.
- **Pruebas**: núcleo de música a oleadas 2-20 con distinta vida/combo (sin NaN ni temas rotos; cortes medidos antes/después); degradación simulada de 6 pasos que se recupera sola tras ~155 s de audio tranquilo; estrés de efectos (explosiones, muertes, disparos, pulso cada 120 ms) sin errores y con el tope de voces respetado; partida y reintento sin errores. El navegador de prueba no tiene altavoces: la música no se pudo escuchar, solo medir.
- `sw.js` → `linehot-v29`.

## v2.0 (mejoras10.js, dentro de extras.js, justo antes de carga.js)
- Minijefes nuevos: `makeEnemy(11|12|13)` → `Enemy` tipo 0 con `e.mini`, IA en `LH.miniNewAI`, dibujo en `LH.miniNewDraw`. Aparición en `startWave` (oleadas pares ≥6 que no son de jefe; en las de minijefes clásicos sustituye a uno). Chispas del Tejedor: `engine.pools`.
- Jefe ECLIPSE: `LH.BOSSES.splice(2,0,…)`, IA `LH.eclipseAI` (brasas · meteoros `b.met` · gravedad · supernova `engine.novas`), dibujo en `drawBig` y `drawFx`.
- Dificultad: constantes de `startWave`/`spawnLogic` (motor.js) y tiempos de `miniCircle`/`miniSquare`.


## v2.4 · Dos ranuras de arma y curva de dificultad (`js/10-armas-inventario.js`, `js/12-dificultad.js`)
- **Armas**: máximo 2 (ranura izquierda / derecha, `p.slots`). Ranura libre → se recoge sola; ambas llenas → el arma del suelo se queda (`LH.wBlocked`, comprobado en `checkCollisions` de `motor.js`) y se intercambia con **F** (móvil: botón `#swapBtn`, mando: Y) con `LH.wSwapFloor`; la soltada conserva munición/rareza (`ammoLeft`, `wd`). Teclas 1/2, Q/E, rueda. Sin munición: `LH.wRunOut`. Guardado: `sl` en `11-partida.js`.
- **Dificultad**: oleadas 1-10 intactas; desde la 11 topes por tipo (`LH.DIF.tope`), vida ×0.035/oleada tras la 12, máx. 15 vivos (`spawnLogic` en `motor.js` usa `LH.DIF`).
- **Bug**: el MÉDICO era id 11 y chocaba con el minijefe PRISMA; ahora id 14 (`07-animaciones.js`). Arreglado un fallo en `Player.shoot` al gastarse la munición a media acción.
- `sw.js` → `linehot-v35`.

## v2.5 · Equilibrio de armas en el suelo (`js/10-armas-inventario.js`, final del archivo)
- Regulador de botín `LH.DROPS`: las armas nuevas (kills, fin de oleada) solo se aceptan si hay hueco (`maxSuelo` 2), pasó la espera (`espera` 14 s) y sale la probabilidad (`prob` 0.6; ×0.5 si tienes las 2 ranuras llenas). Si no, desaparecen sin efectos.
- Premium (`minRar >= 1`: jefes, minijefes, tanques, armas de inicio de jefe): casi siempre se quedan; con el suelo lleno echan a la normal más antigua. Duran 22 s; las normales 14 s (antes 22).
- Las armas que sueltas con F llevan `_gv`/`_own` y no pasan por el regulador. Salud, escudos, imanes, etc. no se tocan.
- Consola: `LH.DROPS` (editable en vivo) y `LH.dropsInfo()`.

## v2.6 · Jefes con mecánica propia (`js/12b-jefes-unicos.js`, tras 12-dificultad.js)
- Mismo patrón que NULL SIGNAL/ECLIPSE: `makeEnemy` marca el jefe por `bossName`; `bossAI` añade su lógica sobre los patrones base; un único `hitEnemy` aplica las reglas de daño; el dibujo va en `drawFx` (espacio del mundo).
- **NEON WARDEN** (`e.warden`): escudo frontal rotatorio (`WARC` medio arco, `WSPD` giro por fase) que bloquea balas/rayos; se abre 1.9 s tras cada embestida y 2.4 s con el PULSO. Katana, railgun, cohete y bomba pasan.
- **SYNTH REAPER** (`e.reaper`, estados `rs`: hunt → mirror → scythe → tired): espejo (aviso 0.9 s, refleja disparos), guadaña de 2-3 hojas (`LH.rayEnd`: las paredes la frenan) y 2.3 s AGOTADO (×1.7 de daño).
- **CHROME HYDRA** (`e.hydra`): cabezas = `Enemy` reales con `hhead` (3, 4 en fase 3). Con cabezas vivas el cuello recibe ×0.16; sin ninguna, ×1.5 hasta que regeneran (11/9/8 s). Vida del núcleo ×0.85. Las cabezas no sueltan botín.
- **VOID CANTOR** (`e.cantor`): compás de 1.3/1.1/0.9 s; con el anillo sobre él (±14 % del compás) el daño es ×2.4, fuera ×0.4. Cada 2 compases suelta un anillo de notas con hueco.
- Rotación de jefes: oleada 5 Warden · 10 Null Signal · 15 Eclipse · 20 Reaper · 25 Hydra · 30 Cantor (y vuelta a empezar).
- Pruebas: partida automática (jugador invulnerable) contra los cuatro con registro de eventos; todas las mecánicas se disparan y no hay errores en consola. `LH.saltar(20)` para probar uno directamente.

## v2.7 · Tempo y dificultad (`js/12-dificultad.js`)
- **Arranque**: oleadas 1-3 con enemigos extra (`LH.DIF.inicio`): 6 / 7 / 9 en vez de 3 / 4 / 5 (la 3 trae el primer tirador).
- **Ritmo desde la 13**: pausa entre apariciones hasta ×0.8 (antes ×1.0 fijo) → las oleadas altas duran ~20 % menos (la 29: 52 s → 42 s de apariciones). Enemigos a la vez: 15 → 16 (oleada 15), 17 (21), 18 (27).
- **Velocidad** (`LH.DIF.vel`): enemigos normales ×1.00 hasta la 6, +1.2 % por oleada, tope ×1.28 (no afecta a jefes, minijefes, enjambres ni cabezas de Hydra).
- **Vida**: tras la oleada 12 sube +0.05 por oleada (antes 0.035): ×2.69 en la 29 (antes ×2.44).
- Consola: `LH.difTabla()` (curva) y `LH.DIF` (editable en vivo). `sw.js` → `linehot-v38`.

## v2.8 · Oleadas más cortas desde la 11 (`js/12-dificultad.js`)
- Problema: tras el jefe 10 las oleadas pasaban de 36 a 50-71 enemigos (~32-38 s solo de apariciones) y los jefes duran poco en comparación: se hacía largo y repetitivo antes de llegar al siguiente jefe.
- Topes por tipo recortados (drones 10+, tanques 1+, tiradores 2, enjambres 2, divisores/francotiradores/escuderos/médicos 1 al principio y 2 más tarde), minijefes totales 2 (3 desde la 24), apariciones hasta ×0.7 y vida +0.035/oleada.
- Resultado (oleada 11 / 14 / 19 / 24 / 29): 36 / 37 / 40 / 46 / 49 enemigos (antes 50 / 53 / 59 / 66 / 68) y ~21-24 s de apariciones (antes 31-36 s). Las oleadas 1-10 y los jefes no cambian.
- Indicador del menú: v2.8. `sw.js` → `linehot-v39`.

## v2.9 · Precarga de oleadas en la pantalla de carga (`js/14-carga.js`)
- Medido (Chromium headless, partida con modo dios hasta la oleada 34): el coste de `update`/`draw` es plano (~0.6-0.9 ms / ~1.6-2.6 ms) y la memoria no crece (~8 MB, ninguna lista se acumula), es decir, no hay fuga. Lo que sí pasaba: ~50 sprites (kamikaze, divisor, francotirador, escudero, flanqueador, médico, destellos de golpe y halos de balas) se creaban por primera vez EN plena oleada, y cuando `Spr.sync` vaciaba la caché (p. ej. al bajar la calidad sola por FPS bajos) se volvían a crear de golpe.
- `LH.warmWaves()` dibuja cada tipo de enemigo (andar 0/1 y destello) de las oleadas `LH.WARM_WAVES` en un lienzo oculto usando `LH.A.edraw`, más los halos de las balas. La pantalla de carga lo ejecuta en tareas (OLEADA n, BALAS Y EFECTOS) y, tras la carga, `warmSprites` lo repite cada vez que se vacía la caché.
- Resultado: 0 sprites nuevos durante las oleadas 1-40 en la prueba (antes ~50). `sw.js` → `linehot-v40`; indicador del menú v2.9.
