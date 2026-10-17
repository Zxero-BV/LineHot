# Mapa del proyecto (Linehot)

Cada archivo es independiente y se carga en el orden de `index.html`.
**Para pedir un cambio, envía solo el archivo que aparece en la tabla.**

| Quiero cambiar... | Archivo |
|---|---|
| Ajustes de sonido de la música (temas, fundidos, director) | `music_base.js` (temas) · `music_motor.js` (director y mezcla) |
| Tema de los minijefes (bytebeat) | `music_minijefes.js` |
| Colores, constantes, zoom, resize, colisiones | `core.js` |
| Efectos de sonido (disparos, golpes, explosión) | `sfx.js` |
| Motor de audio base (sonidos antiguos y tic de música) | `audio.js` |
| Teclado, ratón, joysticks táctiles | `input.js` |
| Jugador, enemigos, balas, pickups, partículas | `entities.js` |
| Bucle principal, daño, oleadas, colisiones, partidas | `engine.js` |
| Oleadas, puntuación, HUD del jefe | `upgrade.js` |
| Menús, pausa, ajustes, game over | `menus.js` |
| IA y patrones del jefe | `boss.js` |
| Controles y HUD en móvil | `mobile.js` |
| Paredes (laberintos), cámara, horizontal | `walls.js` |
| Arranque del juego y ajuste automático de calidad | `boot.js` |
| Comportamiento de los minijefes (círculos y cuadrados) | `minijefes.js` |
| Modos de calidad (Rendimiento, Equilibrado, Calidad) | `calidad.js` |
| Estilo base, HUD, menús | `base.css` |
| Diseño móvil y horizontal | `mobile.css` |
| Efectos visuales (CRT, aviso de rotación) | `fx.css` |

## Reglas
- **No cambies el orden de los `<script>` ni de los `<link>`** en `index.html`.
- Los archivos son "scripts clásicos": comparten variables globales. Si una función usa otra de un archivo distinto, ambos deben estar cargados y en orden.
- Para editar: envía el archivo completo solo si el cambio es grande; para cambios pequeños, indica la función y lo que debe cambiar.
