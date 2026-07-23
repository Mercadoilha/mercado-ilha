# OPTIMIZATION_MASTER_PLAN_V2.md — Mercado Ilha

Segunda auditoría de velocidad, generada el **2026-07-07** sobre el código en producción
(`main`, HEAD `892b0dd`, Next.js 14.2.35, build verificado hoy). Parte de la base de que
**el `OPTIMIZATION_MASTER_PLAN.md` (V1, Fases 1-6) ya está ejecutado y en producción** —
este documento NO repite nada de aquel plan; lo toma como línea de base.

**Este documento no modifica código.** Es el plan de ejecución tarea por tarea, escrito
para que cualquier modelo pueda retomarlo sin contexto previo: cada tarea es
autocontenida, con archivo/línea, qué medir y cómo verificar.

**Norte:** que la app se sienta con la fluidez de Mercado Livre o Instagram. La métrica
no es Lighthouse sino *los milisegundos entre el toque del usuario y ver contenido útil*,
medidos en un Android de gama media con 4G. Tras el V1, las superficies internas
(/listings con caché, detalle optimista) ya responden bien en navegación repetida; los
huecos que quedan son **la entrada a la app** (pantalla blanca al abrir, sin splash
nativo digno), **la primera visita fría a /listings**, y un puñado de RTTs evitables.

---

## 0. Cómo usar este documento (protocolo de esfuerzo)

Cada tarea trae su **Ejecutor recomendado** en tres variantes: Sonnet, Opus 4.8 y
**Fable 5** (con su `/effort` respectivo). Fable es más capaz, por eso su nivel de
esfuerzo recomendado suele ser un escalón más bajo que el de Opus para la misma tarea.

**Esfuerzo por fase (para avisar al usuario ANTES de arrancar cada fase, sin releer todo):**

| Fase | Sonnet/Opus | Fable 5 | ¿Requiere aviso de `/effort` alto? |
|---|---|---|---|
| 1 — Quick wins | Sonnet · `high` (default) | `medium` | No |
| 2 — Entrada/arranque | Opus · **`xhigh`** en T6/T9; Sonnet `high` en T7/T8 | **`xhigh`** en T6/T9; `medium` en T7/T8 | **Sí** (T6 toca el Service Worker) |
| 3 — /listings instantáneo | Opus · **`xhigh`** | `high` en T10, **`xhigh`** en T11 | **Sí** (T11 toca la arquitectura de la ruta) |
| 4 — Pulido de payload | Sonnet · `high` | `low`–`medium` | No |
| 5 — Validación con datos reales | Sonnet · `high` | `low` | No |

**Ninguna tarea de este plan amerita `max`.** Si al ejecutar T6 o T11 apareciera una
decisión arquitectónica ambigua y cara de revertir que este documento no resuelva,
**frenar y avisar al usuario** antes de seguir (recién ahí considerar `max`).

Al terminar cada fase: volver a `/effort auto` (o el default) y avisar el esfuerzo de la
fase siguiente usando la tabla de arriba.

---

## 1. Límites innegociables (heredados del pedido del usuario)

1. **Mantenimiento 100% gratis**: Vercel Hobby, Supabase free, R2 free tier. Ninguna
   tarea puede requerir plan pago, servicio nuevo con costo, dominio pago, ni cron/función
   que empuje fuera del free tier. Si una mejora obliga a elegir entre velocidad y
   gratuidad → **parar y preguntar**.
2. **No romper lo que funciona**: home ISR 60s + revalidate on-demand, `/category/[slug]`
   SSG, shells estáticos de detalle/tienda (T11 del V1), prewarm del perfil,
   `listingsCache`/`catalogCache`/`favoritesCache`/`listingPreview`, SW v5 con estrategias
   por tipo, uploads paralelos, `next/image`, índices SQL, región `gru1`. Solo se tocan
   para mejorarlos sin degradarlos.
3. **Verificación obligatoria al cerrar cada tarea**: `npm run build` sin que ninguna ruta
   pierda su condición `○ Static`/`● SSG`/ISR (tabla de referencia abajo) + navegación
   real (Chromium/Playwright local o dispositivo). "Ya está" no vale sin la prueba.
4. Idioma: hablar al usuario en español; código y UI en portugués brasileño. CSS con
   variables de marca, sin Tailwind. No agregar dependencias sin OK explícito del usuario.

---

## 2. Contexto medido (línea de base, 2026-07-07)

### Build local (`npm run build`, 52 páginas, sin errores)

| Ruta | Estado | First Load JS |
|---|---|---|
| `/` | ○ Static (ISR 60s) | 173 kB |
| `/listings` | ○ Static | 169 kB |
| `/listings/[id]` | ● SSG (shell) | 169 kB |
| `/listings/[id]/edit` | ƒ Dynamic (ISR de datos en el server, aceptado en V1-T15) | 167 kB |
| `/store/[id]` | ● SSG (shell) | 167 kB |
| `/category/[slug]` | ● SSG ×34 | 96.3 kB |
| `/profile` | ○ Static | 170 kB |
| `/publish` | ○ Static (ISR 300) | 167 kB |
| JS compartido | — | 87.4 kB |

### Producción (curl a `https://mercadoilha.vercel.app`, red de escritorio — referencia, no isla)

- `/` → TTFB **180–400 ms**, `x-vercel-cache: STALE` (ISR sirviendo desde edge y
  revalidando atrás — comportamiento correcto), HTML 108 kB sin comprimir (~20-25 kB br).
- `/listings` → `x-vercel-cache: PRERENDER` (shell estático desde edge).

**Lectura:** el servidor NO es el problema de la entrada lenta. La pantalla blanca vive
en el dispositivo: (a) el SW hace network-first en TODA navegación — cada apertura del
PWA espera la red completa aunque tenga el HTML cacheado (en 4G de isla eso es fácilmente
1–3 s de blanco); (b) los íconos del PWA son placeholders y el manifest no tiene íconos
`maskable` — el splash nativo de Android (lo que hace que Mercado Livre "aparezca al
instante" al tocar el ícono: fondo + ícono los pinta el SO antes de cargar nada) existe
pero se ve genérico; (c) en iOS no hay `apple-touch-startup-image` → blanco puro hasta el
primer paint; (d) el splash CSS propio recién pinta cuando llegó el HTML.

### Assets del arranque (inventario)

- `public/icon-192.png` (7.8 kB), `icon-512.png` (26 kB), `apple-touch-icon.png` (7 kB) —
  **placeholders** (pendiente conocido en MEMORY §19), sin variante `maskable`.
- `public/logo.svg` 27 kB (precacheado por el SW; lo usa el splash CSS).
- `public/offline.html` 2.2 kB. `public/banners/banner-institucional.png` 256 kB (ya
  recomprimido en V1-T17).
- `manifest.json`: `background_color`/`theme_color` `#185FA5` ✅, shortcuts a `/publish`
  y `/listings` ✅, íconos sin `purpose: "maskable"` ❌.

### Lo que el V1 ya resolvió — NO repetir ni deshacer

`priority` en imágenes LCP; galería del detalle con `next/image`; orden/filtros
client-side sin vaciar pantalla; 1 foto por anuncio en listas; caché de resultados +
scroll en /listings (`lib/listingsCache.ts`); catálogo/localidades en
`lib/catalogCache.ts`; favoritos en `lib/favoritesCache.ts`; render optimista del detalle
(`lib/listingPreview.ts`); queries del detalle consolidadas; shells estáticos; SW v5 con
caches separados y estrategias por tipo + `offline.html`; uploads paralelos; edit con
datos server-side; store sin waterfall; splash sponsor liviano; Vercel Speed Insights.

---

## 3. Resumen ejecutivo — los 12 hallazgos nuevos, por impacto

1. **Abrir la app espera la red completa aunque el HTML esté cacheado.** El SW
   (`public/sw.js:138-160`) hace network-first en toda navegación: en 4G con RTT alto,
   cada apertura del PWA (y cada visita repetida en navegador con SW activo) paga TTFB +
   descarga antes de pintar un solo píxel. Es la causa principal de la pantalla blanca
   de entrada. → T6.
2. **El splash nativo de Android muestra un ícono placeholder.** El SO ya pinta fondo
   azul + ícono al tocar el ícono del PWA (eso ES el "splash instantáneo estilo Mercado
   Livre"), pero con íconos genéricos y sin `maskable` el efecto marca se pierde. → T7.
3. **iOS abre el PWA en blanco.** Sin `apple-touch-startup-image`, Safari standalone
   muestra blanco puro hasta el primer paint. → T8.
4. **La primera visita fría a `/listings` sigue mostrando spinner** (sin caché de sesión
   no hay nada que pintar hasta 1-2 RTT). El home puede pre-calentar el listado default
   en idle, y el listado default puede venir server-renderizado en el HTML. → T2 y T11.
5. **El caché de /listings caduca a los 3 min y vuelve al spinner** aunque tenga datos
   perfectamente mostrables (`lib/listingsCache.ts:11`). → T4.
6. **El caché de /listings muere con cada recarga / kill del PWA** (Map de módulo, sin
   espejo en `sessionStorage`). → T10.
7. **Cada detalle consulta favoritos con una query propia** (`ListingDetailClient.tsx:261-270`)
   cuando `favoritesCache` ya tiene el Set completo del usuario. 1 RTT evitable por
   anuncio visto. → T3.
8. **Las imágenes optimizadas se re-optimizan cada 60 s** (`minimumCacheTTL` default).
   Las fotos de R2 son inmutables (uuid+timestamp en el path, verificado en
   `app/api/upload/route.ts:49`): subir el TTL abarata y acelera cargas repetidas y cuida
   el free tier de Image Optimization de Vercel. → T1.
9. **El caché del autocomplete muere con cada recarga** (`BuscaAutocomplete.tsx:18`, Map
   en memoria; pendiente ya anotado en MEMORY §19). → T5.
10. **El splash CSS retiene 600 ms mínimos** (`SplashScreen.tsx:134`) — cuando T6 haga la
    apertura realmente rápida, ese mínimo pasa a ser latencia artificial. → T9.
11. **La query principal del detalle trae `*` + `listing_photos(*)`**
    (`ListingDetailClient.tsx:88-98`): columnas y campos de fotos que la pantalla no usa.
    → T12.
12. **`/favorites` sigue trayendo hasta 6 fotos por anuncio** (embed a 2 niveles,
    `app/favorites/page.tsx:26`; quedó fuera del V1-T5 por sintaxis no verificada). → T13.

---

## 4. Tabla de problemas

Prioridad: P0 = crítico para la percepción · P1 = alto · P2 = medio.
Dificultad/Riesgo: L = baja · M = media · H = alta.

| # | Prio | Impacto esperado | Dif. | Riesgo | Archivos | Tarea |
|---|---|---|---|---|---|---|
| 1 | P0 | Apertura del PWA/navegador repetida pinta desde caché en <500 ms (hoy 1–3 s de blanco en 4G) | M | **H** (SW global) | `public/sw.js` | T6 |
| 2 | P0 | Splash nativo Android con marca real al tocar el ícono | L | L | íconos + `manifest.json` | T7 |
| 3 | P0 | iOS: azul con logo en vez de blanco al abrir | L | L | `app/layout.tsx`, `public/splash/` | T8 |
| 4 | P0 | Home→listings sin spinner ni RTT (prewarm en idle) | L | L | `HomeClient.tsx`, `lib/` | T2 |
| 5 | P1 | Entrada directa a /listings pinta cards en el primer HTML | M | M | `app/listings/page.tsx` (split) | T11 |
| 6 | P1 | Volver a /listings tras >3 min sin spinner | L | L | `lib/listingsCache.ts` | T4 |
| 7 | P1 | /listings instantáneo tras recarga o kill del PWA | M | M | `lib/listingsCache.ts` | T10 |
| 8 | P1 | 1 RTT menos por cada detalle visto (logueados) | L | L | `ListingDetailClient.tsx` | T3 |
| 9 | P1 | Imágenes repetidas servidas de caché CDN por semanas; menos transformaciones (free tier) | L | L | `next.config.mjs` | T1 |
| 10 | P2 | Sugerencias del buscador instantáneas entre sesiones | L | L | `BuscaAutocomplete.tsx` | T5 |
| 11 | P2 | 250 ms menos de splash artificial en aperturas rápidas | L | L | `SplashScreen.tsx` | T9 |
| 12 | P2 | Payload del detalle y de /favorites menor | L | L | `ListingDetailClient.tsx`, `favorites/page.tsx` | T12, T13 |

---

## 5. Roadmap por fases

Cada fase es independiente y deployable por sí sola. Regla transversal: al cerrar,
`npm run build` con la tabla de rutas igual a la línea de base (§2) + navegación real.

- **Fase 1 — Quick wins sin riesgo** (T1, T2, T3, T4, T5). *Sonnet `high` / Fable `medium`.*
- **Fase 2 — Entrada instantánea** (T6, T7, T8, T9). *T6/T9: Opus o Fable **`xhigh`** —
  avisar al usuario antes. T7/T8: Sonnet `high` / Fable `medium`.* Es la fase que ataca
  el problema señalado por el usuario (pantalla blanca + splash).
- **Fase 3 — /listings instantáneo desde cualquier entrada** (T10, T11). *Opus **`xhigh`** /
  Fable: T10 `high`, T11 **`xhigh`** — avisar al usuario antes.*
- **Fase 4 — Pulido de payload** (T12, T13). *Sonnet `high` / Fable `low`–`medium`.*
- **Fase 5 — Validación con datos reales** (T14). *Sonnet `high` / Fable `low`.*

---

## 6. Backlog de ejecución

---

### T1 — `minimumCacheTTL` para las imágenes optimizadas

**Ejecutor:** Sonnet · `high` (default) | Opus · `high` | **Fable · `low`**.

**Objetivo:** que las variantes optimizadas de `/_next/image` se cacheen semanas en el
CDN de Vercel en vez de re-optimizarse cada 60 s (default). Acelera toda carga repetida
de fotos y reduce el consumo de Image Optimization del plan Hobby (guardarraíl de
gratuidad).

**Archivos:** `frontend/next.config.mjs:3-10` (bloque `images`).

**Cambios:** agregar `minimumCacheTTL: 2678400` (31 días) dentro de `images`. Es seguro
porque las fotos de anuncios tienen path inmutable (`randomUUID()-Date.now()`, ver
`app/api/upload/route.ts:49`). **Única excepción:** los banners en `public/banners/` se
reemplazan in-place con el mismo nombre — documentar en
`.claude/skills/SKILL_BANNER_INSTITUCIONAL.md` que a partir de ahora los archivos de
banner deben versionarse en el nombre (`banner-institucional-v2.png`) para no servir la
versión vieja por un mes.

**Qué medir:** antes/después con
`curl -sI "https://mercadoilha.vercel.app/_next/image?url=<foto>&w=384&q=75"` → el
header `cache-control` debe pasar de `s-maxage=60` a `s-maxage=2678400`, y la segunda
request debe dar `x-vercel-cache: HIT`.

**Criterios de aceptación:** build sin cambios de rutas; fotos de anuncios idénticas;
doc de la skill de banners actualizada.

**Riesgos:** bajo. Solo el caso banner-in-place (mitigado con el versionado).

---

### T2 — Prewarm del listado default desde el home

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que tocar "Todos os anúncios" (home) o la pestaña "Anúncios" (BottomNav)
pinte la lista al instante, sin spinner ni RTT: el home pre-calienta en idle la query
default de `/listings` dentro del mismo caché que esa página ya lee.

**Archivos:** `frontend/app/listings/page.tsx:165-244` (query actual),
`frontend/components/HomeClient.tsx` (agregar un `useEffect` de prewarm),
`frontend/lib/listingsCache.ts` (o un helper nuevo `lib/listingsApi.ts`).

**Cambios:**
1. Extraer a `lib/` la parte reutilizable de la query default de `/listings`: el string
   de select (`app/listings/page.tsx:167`) y una función `fetchDefaultListings()` que
   replique EXACTAMENTE `decorate(...)` sin filtros (status active, 1 foto por anuncio,
   orden `created_at desc`, límite 60 — líneas 209-218 y 241-243). La página debe
   importar el mismo select desde ahí (una sola fuente, cero drift).
2. Exportar la clave default del caché como constante: con la lógica actual
   (`page.tsx:65,75`) es `"||||"` (baseKey `"||"` + `|cond|zona` vacíos). No hardcodear
   el string en dos lugares: `export const DEFAULT_LISTINGS_KEY`.
3. En `HomeClient` (`components/HomeClient.tsx:46`), un `useEffect` que en
   `requestIdleCallback` (fallback `setTimeout` 2000 ms) verifique
   `getListingsCache(DEFAULT_LISTINGS_KEY)` y, si no hay entrada fresca, ejecute
   `fetchDefaultListings()` y haga `setListingsCache(DEFAULT_LISTINGS_KEY, data)`.
   Nunca antes del render principal del home (pilar de velocidad).

**Qué medir:** en Network (modo dev de producción local), entrar al home → esperar 2 s →
tocar "Todos os anúncios": la lista debe pintar sin spinner y sin query de `listings`
bloqueante (solo la revalidación en segundo plano del stale-while-revalidate existente).

**Criterios de aceptación:** 0 spinner en home→listings con prewarm hecho; usuarios que
entran directo a /listings sin pasar por el home no cambian; el prewarm es 1 sola query
extra por visita al home (aceptable en Supabase free); build sin cambios.

**Riesgos:** bajo. Cuidar que la clave y el select sean EXACTAMENTE los mismos que usa
la página (por eso la extracción a `lib/`).

---

### T3 — El detalle lee favoritos del caché de sesión

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** eliminar la query individual a `favorites` que hace cada apertura de
detalle para usuarios logueados; `lib/favoritesCache.ts` ya mantiene el Set completo.

**Archivos:** `frontend/app/listings/[id]/ListingDetailClient.tsx:261-270` (efecto de
favorito) y `:272-289` (`toggleFavorite`).

**Cambios:** reemplazar el `select ... maybeSingle()` por el patrón ya usado en
`/listings` y `/store` (`app/listings/page.tsx:321-329`): `getCachedFavorites(uid)` →
si hay caché, `setIsFavorite(cached.has(listingId))`; si no, `loadFavorites(uid)` (una
sola vez por sesión, sirve para todos los detalles siguientes). En `toggleFavorite`,
además del estado local, llamar `addFavorite`/`removeFavorite` para que el cambio se vea
al volver a la lista.

**Qué medir:** Network al abrir un detalle con sesión y caché caliente: debe desaparecer
la request `favorites?select=id&...listing_id=eq.N`.

**Criterios de aceptación:** corazón correcto en el header del detalle; toggle en el
detalle se refleja en /listings y /store sin re-fetch; anónimos sin cambios; deep link
con sesión sigue funcionando (carga el Set completo 1 vez).

**Riesgos:** bajo.

---

### T4 — Ventana stale más generosa en el caché de /listings

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que volver a /listings después de 3+ minutos no regrese al spinner: datos
de hasta ~30 min son perfectamente mostrables mientras se revalida atrás (ya existe el
indicador sutil "Atualizando…").

**Archivos:** `frontend/lib/listingsCache.ts:10-11` y
`frontend/app/listings/page.tsx:78-87` (snapshot inicial) y `:146-162` (efecto de carga).

**Cambios:** dos umbrales en vez de uno: `SOFT_TTL = 3 min` (se muestra sin indicador,
comportamiento actual) y `HARD_TTL = 30 min` (entre 3 y 30 min: se pinta el caché SIN
spinner + `refreshing=true` → "Atualizando…" + revalidación inmediata). Más viejo que
`HARD_TTL`: spinner como hoy. Ajustar los dos puntos donde se evalúa
`Date.now() - entry.ts < LISTINGS_RESULTS_TTL` (líneas 81 y 151).

**Qué medir:** simular con TTLs cortos en dev (p. ej. soft 10 s / hard 60 s): volver a
la lista a los 30 s debe pintar al instante con "Atualizando…" y actualizarse sola.

**Criterios de aceptación:** sin spinner en el rango soft–hard; scroll restaurado sigue
funcionando (el snapshot `initRef` debe considerar la entrada stale como válida para
restaurar scroll); un anuncio pausado desaparece tras la revalidación.

**Riesgos:** bajo-medio: cuidar la interacción con `initRef` (`page.tsx:78-87`) — la
restauración de scroll hoy solo corre si hubo entrada "fresca"; con este cambio debe
correr también con entrada stale-mostrable.

---

### T5 — Caché del autocomplete en `sessionStorage`

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** que las sugerencias de búsqueda repetidas sean instantáneas también tras
recargar o reabrir el PWA (hoy el caché es un Map en memoria:
`components/BuscaAutocomplete.tsx:18`, escrito en `:177`, leído en `:51`). Pendiente ya
anotado en MEMORY §19.

**Archivos:** `frontend/components/BuscaAutocomplete.tsx`.

**Cambios:** espejar el Map en `sessionStorage` con el mismo patrón que
`lib/catalogCache.ts:17-37` (clave `mi_busca_cache_v1`, TTL 10 min, tope ~50 queries,
try/catch en lectura y escritura). Hidratar el Map perezosamente en el primer miss.

**Qué medir:** buscar "bici", recargar la página, volver a tipear "bici": las
sugerencias deben aparecer sin requests a Supabase (Network).

**Criterios de aceptación:** debounce (300 ms, `:232`) y navegación por teclado intactos;
errores de storage silenciosos; el tracking de búsquedas (`trackSearch`) no se duplica.

**Riesgos:** bajo.

---

### T6 — SW v6: apertura instantánea desde caché con revalidación (la tarea clave del plan)

**Ejecutor:** Opus 4.8 · **`/effort xhigh`** | **Fable · `xhigh`**. *(Avisar al usuario
antes de arrancar: es la tarea más delicada — un SW roto queda cacheado en los
dispositivos. Volver a `/effort auto` al terminar.)*

**Objetivo:** eliminar la pantalla blanca de apertura. Hoy toda navegación es
network-first (`public/sw.js:138-160`): el PWA espera TTFB + descarga en cada apertura
aunque tenga el HTML en caché. La estrategia nueva: **si hay copia cacheada, la red
compite contra un timeout corto (~500 ms); si la red no llegó a tiempo, se sirve el caché
al instante y la red sigue en segundo plano actualizando el caché para la próxima
apertura.** En conexión buena no cambia nada (gana la red, contenido fresco); en 4G de
isla, la app abre al toque con el contenido de la última visita — exactamente el
comportamiento Instagram/Mercado Livre.

**Archivos:** `frontend/public/sw.js` (versión en `:7`, install `:31-40`, activate
`:42-53`, `handleNavigation` `:138-160`, dispatcher `:162-220`).

**Cambios:**
1. **Bump `CACHE_VERSION` a `v6`** (obligatorio).
2. **Navigation Preload:** en `activate`, `self.registration.navigationPreload?.enable()`;
   en el handler de navegación usar `event.preloadResponse` como fuente de red (la
   request parte en paralelo al boot del SW → más chances de que la red fresca gane el
   race).
3. **`handleNavigation` nuevo** (solo rutas NO privadas; las privadas `/publish`,
   `/profile`, `/admin` siguen network-only sin caché, regla intocable):
   - Buscar caché de la URL. Sin caché → comportamiento actual (network → offline.html).
   - Con caché → `Promise.race([red, timeout 500 ms])`. Si gana la red y es ok: servirla
     y actualizar el caché. Si gana el timeout: servir el caché YA y `event.waitUntil`
     de la red para refrescar el caché. Si la red falla: caché → offline.html.
4. **Seed del arranque:** en `install`, precachear el documento `/` en `PAGES_CACHE`
   (`cache.add('/')`, best-effort); en `activate`, re-fetchear `/` para refrescar el
   seed. Así la PRIMERA apertura standalone tras instalar ya tiene algo que pintar.
5. **RSC intactos:** los payloads RSC (`sw.js:185-189`) siguen network-first puro — la
   navegación interna in-app debe seguir respetando el ISR de 60 s (decisión consciente:
   el race aplica solo a documentos HTML de apertura, no a la navegación client-side).
6. Comentario en el header del SW documentando la decisión de frescura: al abrir, el
   usuario puede ver el home de su última visita durante unos segundos si la red está
   lenta; la próxima apertura ya trae el contenido refrescado. Con ISR de 60 s en el
   server, la tolerancia a stale ya es parte del diseño.

**Qué medir (antes/después, build de producción local `npm run build && npm start` +
Chromium):**
- DevTools → Network throttling "Slow 3G": recargar `/` con SW activo. Antes: blanco
  hasta que llega la red (varios segundos). Después: contenido pintado en <700 ms.
- Sin throttling: la recarga debe servir contenido fresco (gana la red) — verificar
  publicando un cambio y recargando.
- Application → Service Workers: la actualización v5→v6 borra los caches `mi-*-v5`.
- Modo avión: `/` cacheada abre; ruta no visitada → `offline.html`; `/profile` →
  `offline.html` (nunca caché).
- `/api/mares` sigue network-first; Supabase nunca interceptado (regresión crítica).

**Criterios de aceptación:** todos los puntos de medición anteriores + `npm run build`
sin cambios de rutas + los flujos de publicar/editar/perfil funcionan con SW activo.

**Riesgos:** alto por alcance (todo pasa por el SW). Mitigaciones: bump de versión +
`updateViaCache: "none"` ya activo (`components/RegisterSW.tsx:11`) propagan el fix
rápido si algo sale mal; probar la matriz completa antes de push; hoy casi no hay
usuarios activos (ventana ideal para tocar el SW, igual que en la Fase 4 del V1).

---

### T7 — Íconos PWA reales + `maskable` (el splash nativo de Android)

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que al tocar el ícono del PWA en Android, el splash que el SO pinta al
instante (fondo `background_color` + ícono del manifest — así logra Mercado Livre su
apertura "inmediata") muestre la marca real y no un placeholder recortado.

**Archivos:** `frontend/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
(reemplazar contenido), nuevos `icon-maskable-192.png` / `icon-maskable-512.png`,
`frontend/public/manifest.json:12-16`, `frontend/app/layout.tsx:33-41` (si cambian
nombres). Fuente vectorial disponible: `public/Icono.svg` (12 kB) y `public/logo.svg`.

**Cambios:**
1. Generar íconos reales desde el SVG (con `sharp`, ya presente en devDependencies, o
   `sips` — script one-off, no entra al bundle): 192/512 `purpose: any` y 192/512
   `purpose: maskable` (logo al ~60-65% del canvas sobre fondo `#185FA5`, respetando la
   zona segura circular de Android).
2. `manifest.json`: array `icons` con las 4 entradas + `purpose`. Mantener los nombres
   existentes para `any` (el SW los precachea — `sw.js:22-29` — y el bump de versión de
   T6, misma fase, refresca).
3. `apple-touch-icon.png` (180×180) con el arte real.
4. **Mostrar el resultado al usuario para OK visual antes de commitear** (es marca, no
   solo código).

**Qué medir:** instalar el PWA en un Android real (o el simulador de instalación de
Chrome DevTools → Application → Manifest, que previsualiza el maskable): al abrir, el
splash del SO debe mostrar el ícono real, sin recortes raros.

**Criterios de aceptación:** Manifest sin warnings en DevTools; ícono nítido en launcher
y splash; ningún cambio de rutas en build.

**Riesgos:** bajo. Es el pendiente "Íconos PWA con el logo real" de MEMORY §19, ahora
con propósito de velocidad percibida.

---

### T8 — Startup images para iOS (adiós al blanco al abrir en iPhone)

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que el PWA instalado en iPhone abra con una pantalla azul de marca en vez
de blanco (iOS no usa `background_color` del manifest; requiere
`apple-touch-startup-image`). Es el caveat iOS anotado en MEMORY §19.

**Archivos:** `frontend/app/layout.tsx:54-60` (head), nueva carpeta
`frontend/public/splash/` con los PNG.

**Cambios:**
1. Generar 6-8 PNG (fondo `#185FA5`, logo centrado, mismo arte del splash CSS) para las
   resoluciones de iPhone vigentes (SE/8: 750×1334@2x; X/11 Pro/12 mini: 1125×2436@3x;
   XR/11: 828×1792@2x; 12/13/14: 1170×2532@3x; 14/15/16 Plus y Pro Max: 1284×2778@3x y
   1290×2796@3x — verificar lista actual al ejecutar). Peso objetivo <60 kB c/u.
2. En el `<head>` del layout, un `<link rel="apple-touch-startup-image" href=... media=
   "(device-width: ...) and (device-height: ...) and (-webkit-device-pixel-ratio: ...)
   and (orientation: portrait)">` por tamaño. Son tags estáticos: cero costo de runtime.

**Qué medir:** en el iPhone del usuario: eliminar el PWA, reinstalarlo desde Safari,
abrirlo — debe aparecer azul con logo al instante en vez de blanco.

**Criterios de aceptación:** apertura iOS con marca; en Android/desktop los tags se
ignoran (sin efecto); build sin cambios; peso agregado solo en `/public`.

**Riesgos:** bajo — el matching de media queries de Apple es quisquilloso: si un tamaño
no matchea, iOS simplemente cae al blanco actual (nunca peor que hoy). Probar en el
dispositivo real del usuario.

---

### T9 — Recalibrar el mínimo del splash CSS (600 ms → ~350 ms)

**Ejecutor:** en la misma sesión que T6 (hereda **`xhigh`**); suelto: Sonnet · `high` /
**Fable · `low`**.

**Objetivo:** cuando T6 haga que la apertura cacheada sea casi instantánea, el retén
mínimo de 600 ms del splash CSS (`components/SplashScreen.tsx:134`) pasa a ser el nuevo
piso artificial de la apertura del PWA. Bajarlo a ~350 ms (suficiente para que la
animación del logo se insinúe sin flash).

**Archivos:** `frontend/components/SplashScreen.tsx:127-141`.

**Cambios:** `600` → `350` en el cálculo de `wait` (y actualizar el comentario). No
tocar el failsafe de 3.5 s ni la lógica standalone (el fix de hidratación de MEMORY §18
es intocable: no remover nodos del DOM).

**Qué medir:** abrir el PWA (o simular standalone con DevTools → Rendering → Emulate CSS
`display-mode: standalone`) con red rápida: el splash debe durar ~350-400 ms y
desvanecerse sin flash blanco.

**Criterios de aceptación:** sin errores de hidratación en consola (regresión conocida);
la animación no se corta abruptamente (OK subjetivo del usuario).

**Riesgos:** bajo.

---

### T10 — Persistir el caché de /listings en `sessionStorage`

**Ejecutor:** Opus 4.8 · **`xhigh`** | **Fable · `high`**.

**Objetivo:** que /listings pinte al instante también tras una recarga completa o
cuando el SO mata el PWA y lo reabre (hoy `lib/listingsCache.ts` vive en un Map de
módulo que se pierde). Combinado con T6 (HTML desde caché) da la reapertura completa
instantánea: shell + datos.

**Archivos:** `frontend/lib/listingsCache.ts` (todo el archivo, 57 líneas).

**Cambios:**
1. Al escribir (`setListingsCache`, `saveScroll`, `saveFilterUi`), espejar en
   `sessionStorage` (clave `mi_listings_cache_v1`) con try/catch — patrón de
   `catalogCache.ts:30-37`.
2. Hidratar el Map desde `sessionStorage` de forma perezosa en el primer `get*` (una
   sola vez por carga).
3. Acotar lo persistido: solo las últimas ~4 claves (LRU ya existente) y tope de
   serialización ~200 kB (si excede, persistir solo la clave default). Los timestamps
   viajan con las entradas: los TTL de T4 aplican igual.
4. Los datos son públicos (query anónima de listings) — no hay problema de privacidad en
   persistirlos; no persistir NADA derivado de la sesión del usuario.

**Qué medir:** abrir /listings, recargar con F5 (o matar y reabrir el PWA): la lista
debe pintar sin spinner (Network: solo la revalidación en segundo plano).

**Criterios de aceptación:** recarga sin spinner dentro de la ventana de TTL; quota de
storage excedida degrada silenciosamente al comportamiento actual; el flujo
detalle→back→scroll intacto (probar con Playwright como en V1-T6); build sin cambios.

**Riesgos:** medio: serialización de entradas grandes, interacción con la restauración
de scroll y con el snapshot `initRef` de `page.tsx:78-87`. Por eso no es tarea `medium`.

---

### T11 — Listado default server-renderizado (entrada directa a /listings sin spinner)

**Ejecutor:** Opus 4.8 · **`xhigh`** | **Fable · `xhigh`**. *(Avisar al usuario antes:
toca la arquitectura de la ruta más usada.)*

**Objetivo:** que entrar directo a `/listings` (shortcut del PWA, pestaña del BottomNav
en primera visita, link compartido) muestre las cards **en el primer HTML**, sin esperar
a que el JS hidrate y consulte Supabase. Es el mismo patrón del home (`app/page.tsx`):
server component con ISR que pasa datos al cliente.

**Archivos:** `frontend/app/listings/page.tsx` (split en server wrapper + client),
reutiliza el select/fetch extraído en T2.

**Cambios:**
1. `page.tsx` pasa a Server Component con `export const revalidate = 60` que ejecuta la
   query default (mismo select de T2, `getSupabaseAdmin({ revalidate: 60 })`, 60 items) y
   renderiza `<ListingsClient initialDefault={data} />`. **PROHIBIDO leer `searchParams`
   en el server** — eso convertiría la ruta en ƒ Dynamic; el cliente sigue leyéndolos con
   `useSearchParams` bajo `Suspense` (estructura actual, `page.tsx:48-54`).
2. El componente actual (`ListingsContent` + su wrapper `Suspense`) se muda a
   `ListingsClient.tsx` (client). En el snapshot inicial (`initRef`, líneas 78-87): si
   `cacheKey === DEFAULT_LISTINGS_KEY` y no hay caché de sesión más fresco que el
   `initialDefault`, sembrar el estado con `initialDefault` (y `setListingsCache`) — el
   HTML server-renderizado y el primer render del cliente quedan consistentes (sin
   mismatch de hidratación).
3. Con filtros en la URL, `initialDefault` se ignora (el flujo actual de caché/fetch
   manda).

**Qué medir:**
- `npm run build`: `/listings` debe quedar `○` con `revalidate 60` (ISR) — si aparece
  `ƒ`, la tarea está mal hecha: abortar y revisar el punto 1.
- `curl -s https://localhost:3000/listings | grep <título de un anuncio>`: el HTML debe
  contener las cards (antes: HTML vacío con spinner).
- Entrada directa a `/listings` con JS lento (CPU 6× en DevTools): contenido visible
  antes de la hidratación.

**Criterios de aceptación:** los tres puntos de medición + filtros/orden/scroll/back
intactos (matriz de pruebas de V1-T6 con Playwright) + publicar un anuncio lo muestra en
/listings en ≤60 s + sin warnings de hidratación en consola.

**Riesgos:** medio-alto: interacción fina con `initRef`, el caché de sesión y la
hidratación; crecimiento del HTML de /listings (~+40-80 kB — aceptable: son las cards
reales, es contenido, no overhead). Si durante la ejecución la consistencia
servidor/cliente se pone ambigua (p. ej. flicker por reemplazo de seed), frenar y
consultar al usuario antes de inventar una solución cara de revertir.

---

### T12 — Select explícito en la query principal del detalle

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** reducir el payload del detalle: hoy trae `*` de `listings` +
`listing_photos(*)` (`app/listings/[id]/ListingDetailClient.tsx:88-98`) — columnas que
la pantalla no usa viajan en cada apertura.

**Archivos:** `frontend/app/listings/[id]/ListingDetailClient.tsx:88-98`.

**Cambios:** reemplazar `*` por la lista explícita de columnas usadas en el archivo
(auditar con grep de `listing.` y `full.`: id, user_id, title, description, price,
price_text, condition, status, location_type, covers_all_island, locality_id,
subzone_id, other_location_text, category_id, subcategory_id, created_at) y
`listing_photos(*)` por `listing_photos(id, photo_url, sort_order)`. Verificar dos veces
antes de recortar: una columna faltante rompe silenciosamente (undefined).

**Qué medir:** tamaño de la respuesta de la query del detalle en Network, antes/después.

**Criterios de aceptación:** todos los bloques del detalle renderizan igual (galería,
badges, precio, descripción, ubicación por los 3 `location_type`, vendedor, WhatsApp,
dueño→editar, denuncia); `tsc --noEmit` limpio.

**Riesgos:** bajo con la auditoría de usos hecha a conciencia.

---

### T13 — 1 foto por anuncio también en /favorites

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** cerrar el resto del V1-T5: `/favorites` aún trae hasta 6 fotos por anuncio
porque el embed es a dos niveles (`favorites → listings → listing_photos`) y la sintaxis
de order+limit anidada quedó sin verificar.

**Archivos:** `frontend/app/favorites/page.tsx:24-33`.

**Cambios:** probar la sintaxis de PostgREST/supabase-js v2 para tabla foránea anidada:
`.order("sort_order", { referencedTable: "listings.listing_photos" })` +
`.limit(1, { referencedTable: "listings.listing_photos" })`. Si la versión instalada la
acepta (probar en dev contra la DB real), aplicar; si no, documentar el intento en el
código y cerrar como no-op (pantalla de bajo tráfico, riesgo no justificado).

**Qué medir:** respuesta de la query de favoritos en Network: 1 foto por anuncio.

**Criterios de aceptación:** la miniatura sigue siendo la primera foto por `sort_order`;
si la sintaxis no funciona, cero cambios de comportamiento.

**Riesgos:** bajo (con la validación previa en dev).

---

### T14 — Validación con Web Vitals reales (cierre del plan)

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** confirmar con datos de usuarios reales (Vercel Speed Insights, ya
instalado en V1-T18 y gratis en Hobby) que las fases 1-3 movieron la aguja, y dejar
umbrales de regresión documentados.

**Archivos:** ninguno (proceso), más una entrada en `MEMORY.md` §21.

**Cambios/acciones:** con ≥7 días de producción tras la Fase 3: en el panel de Vercel →
Speed Insights, anotar p75 de LCP/INP/CLS por ruta (`/`, `/listings`, `/listings/[id]`)
y compararlos con los valores previos a este plan (capturarlos ANTES de ejecutar la
Fase 1 — primera acción de la Fase 1: anotar la foto inicial en MEMORY.md). Umbrales
del pilar de velocidad: LCP p75 < 2.5 s e INP p75 < 200 ms en `/listings` y detalle; si
alguno se excede, abrir tarea nueva con el dato.

**Criterios de aceptación:** tabla antes/después en MEMORY.md; umbrales documentados.

**Riesgos:** ninguno.

---

## 7. No-tareas — sospechosos verificados en esta auditoría (no perseguir)

- **TTFB del servidor:** `/` responde en 180-400 ms desde el edge con `x-vercel-cache:
  STALE/HIT` — el backend NO es el cuello de botella de la entrada. No tocar ISR/región.
- **`font-family: Inter`** (`globals.css:3`): Inter no se carga como webfont — cae a la
  system font. Eso es BUENO para velocidad; **no agregar** `next/font` ni webfonts (sería
  una descarga nueva en el camino crítico).
- **JS compartido 87.4 kB:** el mayor componente es el cliente de Supabase; no hay grasa
  evidente. No fragmentar por fragmentar.
- **HTML del home 108 kB sin comprimir** (~20-25 kB brotli reales): razonable para una
  página con 10 cards + 31 categorías server-renderizadas.
- **`pub-*.r2.dev`** es un dominio de desarrollo de Cloudflare (rate-limited). El
  optimizador de Vercel lo protege (y T1 reduce aún más los hits). La solución de fondo
  (dominio propio + CDN de Cloudflare) requiere comprar un dominio → **prohibida por la
  regla de gratuidad**; solo vigilar 429s si el tráfico crece.
- **Lightbox con el original de R2** (`ListingDetailClient.tsx:818`): decisión consciente
  del V1-T2 (zoom sin recompresión). Mantener.
- **Doble descarga de la 1ª foto** (card a ~50vw, detalle a ~100vw → `next/image` pide
  otro tamaño): trade-off correcto de nitidez; no igualar los `sizes`.
- **`getSession()` de Supabase** lee de localStorage, no de red (verificado en V1).
- **`/listings/[id]/edit` sigue `ƒ Dynamic`:** aceptado en V1-T15 (los datos estáticos
  ya viajan server-side); no re-litigar.

---

## 8. Resumen de ejecución

| Fase | Tareas | Sonnet/Opus | Fable 5 | Riesgo | Ganancia percibida |
|---|---|---|---|---|---|
| 1 | T1 T2 T3 T4 T5 | Sonnet · `high` | `medium` (T1/T3/T5 bastan con `low`) | Bajo | Alta e inmediata: home→listings sin spinner, imágenes de caché, 1 RTT menos por detalle |
| 2 | T6 T7 T8 T9 | Opus · **`xhigh`** (T6/T9), Sonnet `high` (T7/T8) | **`xhigh`** (T6/T9), `medium` (T7/T8) | Medio-alto (SW) | **La entrada de la app: de blanco 1-3 s a marca instantánea + contenido <700 ms** |
| 3 | T10 T11 | Opus · **`xhigh`** | `high` (T10), **`xhigh`** (T11) | Medio | /listings instantáneo desde CUALQUIER entrada, incluso recarga fría |
| 4 | T12 T13 | Sonnet · `high` | `low` | Bajo | Payloads menores en detalle y favoritos |
| 5 | T14 | Sonnet · `high` | `low` | Nulo | Guardarraíl permanente con datos reales |

**Próximo paso al retomar este plan: Fase 1 — no requiere esfuerzo alto.**
Con Sonnet u Opus: `/effort high` (el default). Con Fable: `/effort medium` alcanza
(T2 y T4 son lo más fino de la fase; si se ejecuta la fase entera en una sola sesión,
`medium` es el nivel correcto). Recordatorio operativo de la Fase 1: antes de tocar
código, capturar la foto inicial de Speed Insights (ver T14).
