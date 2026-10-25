# LineHot

Shooter de arena en neón, frenético y sangriento, hecho con **HTML5 Canvas + JavaScript puro** (sin dependencias ni compilación).
Se juega en el navegador (PC, móvil, mando), se puede instalar como app (PWA) y funciona sin conexión.

## Qué incluye
- Oleadas con jefe cada 5 (Neon Warden, **Null Signal**, Synth Reaper, Chrome Hydra, Void Cantor), minijefes, francotiradores, kamikazes, divisores, **escuderos** y élites.
- Armas (pistola, escopeta, minigun, katana, railgun, láser, cohete, arco voltaico), objetos (escudo, tiempo lento, imán, bomba, sobrecarga) y mejoras entre oleadas.
- Modificadores de dificultad, **reto diario**, logros, mejores partidas y rango al terminar.
- **Fondo al ritmo**: el fondo, la cuadrícula y un ecualizador reaccionan a los golpes de la música (Ajustes → Gráficos).
- Pixel art con resplandor neón (armas, enemigos y objetos) y **música en MP3 en bucle** (carpeta `musica/`, 10 temas que se cruzan según oleada, combo y vida) y efectos de sonido generados en tiempo real con Web Audio.
- Móvil: joysticks, botón de pulso, sugerencia de jugar en horizontal. Mando: mapeo completo.
- Guardado opcional en la nube con **Supabase** (usuarios anónimos, sin registro): progreso, **partida en curso** y **ranking online**.

## Estructura
| Archivo | Qué es |
|---|---|
| `index.html` | Página, menús y carga ordenada de los scripts |
| `estilos.css` | Todos los estilos (base, móvil, efectos, menús) |
| `nube.js` | Guardado en Supabase y **tu configuración** (`NUBE_CONFIG`) |
| `motor.js` | Núcleo del juego: constantes, audio, entidades, bucle, controles, menús, paredes, jefes, efectos de sonido, arranque |
| `js/01-…14-*.js` | Todo lo añadido encima del motor, **dividido por temas** (antes un único `extras.js`): base y mejoras, enemigos, jefes, ritmo, armas, pixel art, animaciones, sistema, guardado de partida, ranking y pantalla de carga. Se cargan en orden numérico |
| `musica/*.mp3` | Los 7 temas musicales en bucle (happy, shock, addict, epic, boss, abyss, mini). Se decodifican una vez y se reproducen en bucle sin cortes |
| `herramientas/` | Solo para desarrollo (el juego no la carga): `render_musica.js` regenera los MP3 a partir de las fórmulas de `fuentes_temas.js` (necesita `node` y `ffmpeg`) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | App instalable y modo sin conexión |
| `supabase.sql` | Tablas, funciones y seguridad (RLS) para el guardado en la nube y el ranking online |
| `MAPA.md` | Mapa técnico detallado: dónde está cada cosa y notas de cada versión |

Dentro de `motor.js` y de cada archivo de `js/` cada sección empieza con una marca `// ########## [nombre.js] ##########` (usa Ctrl+F). El orden de las secciones importa: unas envuelven funciones de otras.

## Panel de administrador (pruebas)
F2 en PC o `?admin` en la dirección. **En móvil está oculto**: toca 7 veces el texto «LINEHOT v…» del menú principal y escribe el código (`ADMIN_PIN` en `js/13b-admin.js`, por defecto `2580`; también vale `?admin=CÓDIGO`). Invoca jefes y enemigos, salta de oleada, da armas/objetos/mejoras, invulnerabilidad, munición infinita y control del tiempo. Las partidas con el panel no cuentan para récords ni ranking. Detalles en `MAPA.md`.

## Probar en local
Necesita un servidor web (no funciona abriendo el archivo con doble clic):
```bash
python3 -m http.server 8000      # y abre http://localhost:8000
# o:  npx serve .
```

## Guardado en la nube (opcional)
1. Crea un proyecto en [Supabase](https://supabase.com) y activa **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
2. En **SQL Editor** pega y ejecuta `supabase.sql`.
3. En `nube.js` rellena `NUBE_CONFIG` con tu *Project URL* y la clave **anon / publishable** (nunca la `service_role`).

Sin configurar nada el juego funciona igual y guarda en el dispositivo (sin ranking online).

**Si ya tenías la nube configurada**, solo tienes que volver a ejecutar `supabase.sql` completo en el SQL Editor (se puede repetir sin romper nada): añade la tabla y las funciones del ranking.

## Publicar
- **GitHub Pages**: sube todos los archivos a la raíz del repositorio y activa *Settings → Pages → Deploy from a branch*.
- **Vercel / Netlify**: importa el repositorio; es un sitio estático (sin build, directorio raíz).
- Para un código QR, enlaza la URL pública (HTTPS).

## Al modificar el código
- Si cambias o añades archivos, sube el número de `CACHE` en `sw.js` (por ejemplo `linehot-v15`) y actualiza `FILES`; así los jugadores reciben la versión nueva.
- Si añades un archivo `.js`, inclúyelo en `ARCHIVOS` (en `index.html`) y en `FILES` (en `sw.js`). El orden importa: `js/14-carga.js` va siempre el último.
- v1.7: resolución dinámica y pantalla «PREPARANDO PARTIDA» al pulsar JUGAR (ver `MAPA.md`). Consola: `LH.fluz()` muestra Hz de la pantalla, FPS objetivo y % de resolución.
- Depuración en la consola del navegador: `audio.music.diag()` (estado de la música), `Nube.estado()` (nube), `LH.beat` (detección del ritmo).

## Controles
PC: `WASD` mover · ratón apuntar y disparar · `Espacio` pulso · `Esc` pausa.
Móvil: joystick izquierdo mover · derecho apuntar/disparar · botón `PULSO`.
Mando: stick izq. mover · stick der. / RT apuntar y disparar · A/LB/LT pulso · Start pausa.

## v1.9 · interfaz móvil
- Nueva capa `[movil2.css]` al final de `estilos.css`: marcos pixel art en todo el interfaz, hojas a altura completa en móvil, HUD táctil reordenado, botón de PULSO octogonal, carga y avisos en pixel art.
- `index.html`: tipografías con `<link>` (antes `@import`) y número de vida (`#hpNum`).
- `motor.js`: joysticks táctiles en pixel art (`drawJoysticks`) y número de vida en el HUD.
- `sw.js`: caché `linehot-v30`.

## v2.0 · dificultad más amigable, minijefes y jefe nuevos
- **Curva más suave** (`motor.js`/`extras.js`): menos enemigos por oleada, vida de enemigos +7 % por oleada (antes +10 %), tope de enemigos en pantalla más bajo, kamikazes/divisores/escuderos/francotiradores aparecen más tarde, +30 de vida al limpiar oleada (antes +25) y minijefes clásicos con más tiempo de aviso, recuperación y aturdimiento.
- **3 minijefes nuevos** (tipos 11-13, desde la oleada 6 en las pares que no son de jefe): **PRISMA** (3 líneas de aviso y ráfagas rápidas), **PULSAR** (6 orbes que giran y se sueltan) y **TEJEDOR** (embestidas que dejan chispas que queman).
- **Jefe nuevo ECLIPSE** (oleada 15): brasas, meteoros, gravedad con anillos con hueco y supernova con abertura. Se repite en la rotación.
- Código en la sección `[mejoras10.js]` de `extras.js`. Prueba rápida: en la consola, `LH.saltar(15)` salta a esa oleada. `sw.js`: caché `linehot-v31`.

## v2.1 · sistema de armas con inventario
- Recoger un arma ya no sustituye la que llevas: se **guarda** (una de cada tipo, con su munición). Solo se equipa sola la primera arma extra o si la actual se queda sin munición. Recoger una repetida suma munición (y las dobles siguen funcionando).
- Cambiar de arma: `1-9` (1 pistola · 2 escopeta · 3 minigun · 4 katana · 5 railgun · 6 láser · 7 cohete · 8 arco · 9 akimbo), `Q`/`E`, rueda del ratón, mando `X`/`Y`, o tocar el panel del arma / su número en móvil.
- Sin munición vuelves a la última arma usada (antes siempre a la pistola). Las armas del suelo duran 10 s más.
- Código en la sección `[armas2.js]` de `extras.js` (envuelve `Player.equip`); estilos `[armas2.css]` al final de `estilos.css`. `sw.js`: caché `linehot-v32`.

## v2.2 · rareza, calidad y modificadores de armas
- Cada arma del suelo nace con **rareza** (COMÚN gris · POCO COMÚN verde · RARO azul · ÉPICO morado · LEGENDARIO dorado) y **calidad** (0-100 %). La rareza da más daño, más munición y 0-3 **modificadores**: CRÍTICO, PERFORANTE, REBOTE, INCENDIARIO, GÉLIDO, VAMPÍRICO, CARGADOR+ y VELOZ. Las legendarias tienen nombre propio (TRUENO, SENTENCIA, TORMENTA…) y balas doradas.
- Cuanto más avanzas mejor es el botín. Jefes y minijefes sueltan armas **raras o mejores**, las élites **poco comunes**.
- Recoger un arma que ya tienes: si es mejor, **mejora tu arma** (y suma munición); si es peor, solo suma munición.
- Las armas del suelo brillan con su color (haz de luz si son épicas/legendarias); al acercarte ves calidad y modificadores. El panel del arma muestra rareza, calidad y modificadores, y los números de armas se colorean por rareza.
- Código en `[armas3.js]` de `extras.js`; estilos `[armas3.css]`. `sw.js`: caché `linehot-v33`.

## v2.3 · código por temas, guardado de partida y ranking online
- **`extras.js` dividido** en 11 archivos por tema dentro de `js/` (sin tocar el código: mismo contenido, mismo orden). Ver `MAPA.md`.
- **Guardado de partida** (`js/11-partida.js`): al empezar cada oleada se guarda un punto de control (onda, puntos, vida, mejoras, modificadores y todas tus armas con munición, rareza y modificadores). En el menú principal aparece **CONTINUAR · ONDA N**. Se sincroniza con la nube (puedes seguir en otro móvil). Si mueres, se borra; salir al menú no la borra. Lo que había en pantalla (enemigos, balas) no se guarda: al continuar empiezas la oleada siguiente con 2 s de calma.
- **Ranking online** (`js/13-ranking.js` + `supabase.sql`): al morir se envía tu puntuación (hace falta un nombre de 3-14 caracteres, se pide una vez). Tablero **MUNDIAL** y tablero del **RETO DE HOY**; cada jugador conserva su mejor puntuación. Se ve en **PROGRESO › RANKING** con tu puesto. Sin conexión queda pendiente y se envía después.
- La tabla del ranking no se toca desde el juego: solo se entra por las funciones `linehot_enviar` / `linehot_top`, que validan nombre, límites y frecuencia (1 envío cada 5 s por tablero).
- ⚠ La puntuación la calcula el navegador, así que un tramposo podría falsearla; el servidor solo rechaza valores imposibles. Para un ranking a prueba de trampas haría falta validar la partida en un servidor.
- Depuración: `Nube.rpc('linehot_top', {p_diario:false, p_limite:5})` en la consola; `LH.partida()` muestra la partida guardada. `sw.js`: caché `linehot-v34`.
