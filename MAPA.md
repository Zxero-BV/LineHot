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
| Estilos, diseño móvil, efectos CRT | `estilos.css` (base · mobile · fx) |

## Reglas
- No cambies el orden de los `<script>` en `index.html`: varios archivos envuelven funciones de otros (p. ej. `walls` sobre `mobile`, `sfx` sobre `menus`).

## Cambios de audio (arreglo de cortes de música)
- `audio.js` → cruces entre temas: curva de graves simétrica + compensación de potencia (antes el volumen bajaba hasta un 35 % a mitad de cada cruce: fin de la oleada 2, oleada 3 y entrada de la 4).
- `audio.js` → el descanso entre oleadas (`'calm'`) conserva la música de la oleada anterior (antes, tras minijefes/jefes, volvía a entrar el tema épico con riser e impacto en pleno descanso).
- `audio.js` → colchón de música por adelantado 0.6 s → 1.0 s (1.8 s si el motor va justo).
- Depuración: en la consola del navegador, `audio.music.diag()` muestra si el motor usa Worker, cuántos cortes hubo y la carga de CPU de la música.
