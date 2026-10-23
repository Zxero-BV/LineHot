# LineHot

Shooter de arena en neón, frenético y sangriento, hecho con **HTML5 Canvas + JavaScript puro** (sin dependencias ni compilación).
Se juega en el navegador (PC, móvil, mando), se puede instalar como app (PWA) y funciona sin conexión.

## Qué incluye
- Oleadas con jefe cada 5 (Neon Warden, **Null Signal**, Synth Reaper, Chrome Hydra, Void Cantor), minijefes, francotiradores, kamikazes, divisores, **escuderos** y élites.
- Armas (pistola, escopeta, minigun, katana, railgun, láser, cohete, arco voltaico), objetos (escudo, tiempo lento, imán, bomba, sobrecarga) y mejoras entre oleadas.
- Modificadores de dificultad, **reto diario**, logros, mejores partidas y rango al terminar.
- **Fondo al ritmo**: el fondo, la cuadrícula y un ecualizador reaccionan a los golpes de la música (Ajustes → Gráficos).
- Pixel art con resplandor neón (armas, enemigos y objetos) y música y efectos generados en tiempo real (Web Audio, sin archivos de audio).
- Móvil: joysticks, botón de pulso, sugerencia de jugar en horizontal. Mando: mapeo completo.
- Guardado opcional en la nube con **Supabase** (usuarios anónimos, sin registro).

## Estructura
| Archivo | Qué es |
|---|---|
| `index.html` | Página, menús y carga ordenada de los scripts |
| `estilos.css` | Todos los estilos (base, móvil, efectos, menús) |
| `nube.js` | Guardado en Supabase y **tu configuración** (`NUBE_CONFIG`) |
| `motor.js` | Núcleo del juego: constantes, audio, entidades, bucle, controles, menús, paredes, jefes, efectos de sonido, arranque |
| `extras.js` | Todo lo añadido encima del motor: mejoras, enemigos nuevos, jefe Null Signal, fondo al ritmo, logros, pantalla de carga… |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | App instalable y modo sin conexión |
| `supabase.sql` | Tabla y seguridad (RLS) para el guardado en la nube |
| `MAPA.md` | Mapa técnico detallado: dónde está cada cosa y notas de cada versión |

Dentro de `motor.js` y `extras.js` cada sección empieza con una marca `// ########## [nombre.js] ##########` (usa Ctrl+F). El orden de las secciones importa: unas envuelven funciones de otras.

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

Sin configurar nada el juego funciona igual y guarda en el dispositivo.

## Publicar
- **GitHub Pages**: sube todos los archivos a la raíz del repositorio y activa *Settings → Pages → Deploy from a branch*.
- **Vercel / Netlify**: importa el repositorio; es un sitio estático (sin build, directorio raíz).
- Para un código QR, enlaza la URL pública (HTTPS).

## Al modificar el código
- Si cambias o añades archivos, sube el número de `CACHE` en `sw.js` (por ejemplo `linehot-v15`) y actualiza `FILES`; así los jugadores reciben la versión nueva.
- Si añades un archivo `.js`, inclúyelo en `ARCHIVOS` (en `index.html`) y en `FILES` (en `sw.js`).
- Depuración en la consola del navegador: `audio.music.diag()` (estado de la música), `Nube.estado()` (nube), `LH.beat` (detección del ritmo).

## Controles
PC: `WASD` mover · ratón apuntar y disparar · `Espacio` pulso · `Esc` pausa.
Móvil: joystick izquierdo mover · derecho apuntar/disparar · botón `PULSO`.
Mando: stick izq. mover · stick der. / RT apuntar y disparar · A/LB/LT pulso · Start pausa.
