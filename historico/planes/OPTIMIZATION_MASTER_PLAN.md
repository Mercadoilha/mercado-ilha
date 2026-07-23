# OPTIMIZATION_MASTER_PLAN.md — Mercado Ilha

Auditoría de velocidad de navegación y fluidez percibida. Generada el 2026-07-06 sobre el
código en producción (`main`, Next.js 14.2.35, build verificado). **Este documento no
modifica código**: es el plan de ejecución tarea por tarea. Cada tarea indica el **modelo
recomendado (Sonnet u Opus) y su nivel de esfuerzo** — regla general: Sonnet con esfuerzo
default (`high`) para lo mecánico y bien delimitado; Opus 4.8 para lo que toca caché,
navegación o Service Worker; `/effort xhigh` solo donde un error sutil es caro de revertir
(T6 y T12). El default de ambos modelos ya es `high`, así que solo hay que tocar `/effort`
en esas dos tareas (y volver con `/effort auto` al terminar).

**Norte:** la app debe sentirse instantánea en un Android de gama media con 4G. La métrica
que importa no es Lighthouse sino: *¿cuántos milisegundos pasan entre el toque del usuario
y ver contenido útil en pantalla?* Hoy la respuesta varía brutalmente por ruta: el home
(ISR) abre casi instantáneo; `/listings` y el detalle de anuncio — **las dos superficies
más usadas de un marketplace** — muestran spinner y esperan 2–3 viajes de red antes de
pintar nada.

---

## Contexto medido (build de producción, 2026-07-06)

| Dato | Valor | Lectura |
|---|---|---|
| JS compartido (First Load) | 87.4 kB | Razonable; Supabase client es el mayor componente. No es el problema. |
| Home `/` | ○ Static (ISR 60s), 172 kB | Bien resuelto. |
| `/category/[slug]` | ● SSG ×34, 96 kB | Bien resuelto. |
| `/listings` | ○ Static, 167 kB | Shell estático pero **datos 100% client-side con waterfall**. |
| `/listings/[id]` | **ƒ Dynamic**, 169 kB | Cada navegación invoca una función Vercel para un shell que es puro cliente, y luego el cliente hace 3 tandas de queries. |
| `/store/[id]`, `/listings/[id]/edit` | **ƒ Dynamic** | Mismo problema: lambda para servir HTML sin datos. |
| Imágenes con `priority` | **0 en todo el código** | Banner del home, primeras cards y foto del detalle cargan lazy → LCP tardío. |
| Foto principal del detalle | `<img>` crudo | JPEG hasta 1200px directo de R2, sin AVIF/WebP, sin resize. Es la imagen más pesada de la app. |
| Service Worker | 1 caché, cache-first para todo lo no-HTML | Congela `/api/mares` y payloads RSC; crecimiento sin tope. |

**Lo que ya está bien — no tocar:** home ISR 60s + revalidate on-demand, `/category/[slug]`
SSG, `/publish` con datos server-side ISR, prewarm + cache del perfil, `next/dynamic` en
AvatarCropModal y heic2any, `ListingCard` con `memo`, región `gru1`, índices SQL (fase-9/17),
`adminSettings` con caché de módulo, tabs del admin con `display:none`, widgets del home
post-render. Cualquier tarea de este plan debe preservar estos patrones.

---

## 1. Resumen ejecutivo — los 15 problemas por impacto

1. **`/listings` es 100% client-side con waterfall de 2–3 queries secuenciales** (categoría
   por slug → categorías secundarias → anuncios) y **se carga DOS veces para usuarios
   logueados** (el efecto depende de `session`, que resuelve async después del mount).
   Es la pantalla de navegación principal y siempre abre con spinner.
2. **Volver del detalle a la lista destruye todo el estado**: la página remonta, re-fetchea
   las mismas queries y pierde la posición de scroll. El patrón "ver anuncio → volver →
   seguir scrolleando" (el gesto nº1 de un marketplace) paga spinner completo cada vez.
3. **El detalle `/listings/[id]` es ruta ƒ (lambda por navegación) + 3 tandas de queries
   client-side**: RSC desde la función Vercel → query principal → seller/subzonas/zonas →
   teléfono (RPC). El botón de WhatsApp — el CTA que monetiza — aparece al final de la cadena.
4. **La foto principal del detalle usa `<img>` sin optimizar**: baja el JPEG original de R2
   (hasta 1200px, típicamente 150–500 KB) sin AVIF/WebP, sin resize al viewport, sin
   `priority`. Es el LCP de la pantalla más importante y la mayor descarga de la app.
5. **Service Worker con estrategia incorrecta**: sirve cache-first todo lo que no es
   `text/html`. Consecuencias: `/api/mares` queda congelado para siempre (las mareas nunca
   se actualizan hasta bump de versión del SW), los payloads RSC de navegación quedan
   congelados (en el PWA, navegar entre rutas puede mostrar anuncios viejos ignorando el
   ISR de 60s), y el caché único crece sin tope (fotos de anuncios se acumulan para siempre).
6. **Ninguna imagen LCP tiene `priority`**: el banner rotativo (arriba del fold en el home)
   y las primeras 4 cards de destacados cargan lazy → el home estático pinta rápido pero
   las imágenes llegan tarde.
7. **Cambiar orden/filtro en `/listings` borra los resultados y muestra spinner**: cada tap
   en "Menor preço" o una zona re-fetchea todo y deja la pantalla vacía. El reordenamiento
   por precio/fecha podría ser instantáneo (client-side sobre los ≤60 items ya cargados).
8. **Payload inflado en todas las listas**: se traen TODAS las fotos de cada anuncio (hasta
   6 filas × 60 anuncios) cuando solo se usa la primera; el join de `subzones` en home y
   listas no se usa en la card. Más bytes, más tiempo de parse, más memoria.
9. **`/store/[id]` y `/listings/[id]/edit` son ƒ Dynamic sin necesidad**: shells puro
   cliente que pagan un round-trip a lambda (con posible cold start) en cada navegación.
10. **`/listings/[id]/edit` carga categorías/localidades/subzonas client-side** en cascada,
    cuando `/publish` ya resuelve exactamente esos datos server-side con ISR.
11. **Datos casi-estáticos re-consultados una y otra vez**: localidades, categorías y
    favoritos se piden en cada visita a `/listings` sin caché de sesión; el autocomplete
    tiene caché en memoria pero muere con cada recarga.
12. **Publicar sube fotos en serie** (comprimir → upload → insert, foto por foto) y luego
    espera 1.5s fijos antes de redirigir. Con 4 fotos en 4G el "Publicando..." se siente eterno.
13. **`/store/[id]` duplica el manejo de sesión** (listener propio en vez de `useSession`)
    y hace `getSession()` en waterfall antes del `Promise.all` de datos.
14. **`SplashSponsorSync` puede descargar el banner original completo** (el actual pesa
    2.1 MB) para cachearlo como data-URL; si pesa >400 KB guarda la URL remota y el splash
    queda dependiendo de una descarga de 2 MB en el arranque.
15. **El PWA no aprovecha la navegación repetida**: precache mínimo, sin página offline,
    sin stale-while-revalidate para HTML — la promesa de "abre instantáneo como app nativa"
    solo se cumple a medias.

---

## 2. Tabla de problemas

Prioridad: P0 = crítico para la percepción, P1 = alto, P2 = medio. Impacto: sobre la
velocidad percibida en mobile real. Dificultad/Riesgo: L=baja, M=media, H=alta.

| # | Prioridad | Impacto esperado | Dificultad | Riesgo | Archivos afectados | Causa raíz | Solución recomendada |
|---|---|---|---|---|---|---|---|
| 1 | P0 | Muy alto — la lista pasa de "spinner + ~600–1200ms" a pintar en 1 RTT (o 0 con caché) | M | M | `app/listings/page.tsx` | Resolución de categoría por slug y de categorías secundarias en queries secuenciales previas a la principal; efecto re-ejecuta todo cuando `session` resuelve | Paralelizar la resolución (categoría+extras+anuncios sin filtro de categoría no dependen entre sí solo si se reestructura; como mínimo: categoría y extras en paralelo, y cachear el mapa slug→id de categorías en módulo/sessionStorage). Separar la query de favoritos a un efecto propio dependiente de sesión para que la lista NO se recargue al resolver la sesión |
| 2 | P0 | Muy alto — "volver" instantáneo con scroll preservado, el gesto más repetido | M | M | `app/listings/page.tsx` | Estado en `useState` local: el unmount al navegar borra resultados y scroll | Caché de resultados en módulo (Map por clave de filtros: categoría+q+subcat+orden+condición+zona) con render inmediato de datos cacheados + revalidación en segundo plano; restaurar posición de scroll al volver |
| 3 | P0 | Muy alto — CTA WhatsApp y contenido del detalle visibles ~2 RTT antes | M | M | `app/listings/[id]/page.tsx` | Página client con 3 tandas de queries; ruta ƒ agrega RTT a lambda antes de cualquier pixel | Render optimista: pintar título/precio/primera foto con los datos que ya tiene la card de origen (pasados vía sessionStorage/history state) mientras llega la query completa; incluir `profiles_public` como parte del `Promise.all` inicial (no en segunda tanda); shell estático (ver #9) |
| 4 | P0 | Muy alto — LCP del detalle baja de ~150–500 KB JPEG a ~15–60 KB AVIF dimensionado | L | L | `app/listings/[id]/page.tsx` | Galería principal y lightbox usan `<img>` crudo contra R2 | `next/image` con `priority` en la foto activa de la galería (sizes = ancho de viewport, max 480px), thumbnails ya usan next/image; en el lightbox mantener original si se quiere zoom sin pérdida |
| 5 | P0 | Alto — datos frescos en PWA + storage acotado; corrige bug real de mareas congeladas y navegaciones con datos viejos | M | M | `public/sw.js`, `components/RegisterSW.tsx` | Un solo caché con cache-first para todo lo no-`text/html` (el check por header `accept` no cubre fetch de API ni payloads RSC) | Reescribir SW con caches separados y estrategias por tipo: network-first (o network-only) para `/api/*` y requests RSC (`?_rsc`/header), stale-while-revalidate para `/_next/image` e imágenes R2 con límite de entradas (LRU simple), cache-first solo `/_next/static` e íconos; bump de versión |
| 6 | P0 | Alto — LCP del home ~0.5–1.5s antes en 4G | L | L | `components/BannerRotativo.tsx`, `components/ListingCard.tsx`, `components/HomeClient.tsx` | Ninguna imagen tiene `priority`; todo lazy por defecto | `priority` en la imagen del banner activo y en las primeras ~4 cards de destacados (prop `priority` opcional en ListingCard que el home pasa por índice) |
| 7 | P1 | Alto — filtros/orden se sienten instantáneos | L | L | `app/listings/page.tsx` | Todo cambio de filtro dispara `setLoading(true)` + refetch, borrando contenido | Ordenar client-side (precio/fecha sobre los items cargados, sin red); para filtros que sí requieren red, mantener los resultados anteriores visibles con indicador sutil (patrón stale-while-revalidate visual) |
| 8 | P1 | Medio-alto — payload de listas ~3–6× menor, menos parse/memoria | L | L | `app/page.tsx`, `app/listings/page.tsx`, `app/store/[id]/page.tsx`, `app/favorites/page.tsx` | Join `listing_photos(...)` sin límite trae hasta 6 fotos por anuncio; join `subzones` sin uso en cards | Limitar el embed a 1 foto ordenada por `sort_order` (supabase-js soporta order+limit en tabla foránea); quitar `subzones` del select donde la card no lo usa |
| 9 | P1 | Medio-alto — elimina RTT a lambda (y cold starts) al abrir detalle/tienda/editar | L | M | `app/listings/[id]/page.tsx`, `app/store/[id]/page.tsx`, `app/listings/[id]/edit/page.tsx` | Rutas con segmento dinámico sin `generateStaticParams` → Next las sirve on-demand desde función | Forzar shell estático (generateStaticParams vacío + dynamicParams, o `dynamic = "force-static"`): el HTML es idéntico para todo id porque los datos son client-side. Verificar en build que pasen a ○/● |
| 10 | P1 | Medio — editar abre con formulario ya poblado de opciones | L | L | `app/listings/[id]/edit/page.tsx`, `app/publish/page.tsx` | La página de edición re-fetchea client-side los mismos datos estáticos que publish ya trae server-side | Replicar el patrón de `/publish`: Server Component padre con ISR 300 que pasa categorías/localidades/subzonas como props al form de edición |
| 11 | P1 | Medio — menos requests repetidas en cada navegación | L | L | `app/listings/page.tsx`, `components/BuscaAutocomplete.tsx`, nueva lib de caché ligera | Sin caché de sesión para datos casi-estáticos | Caché de módulo + espejo en `sessionStorage` para: categorías (slug→id,name,icon), localidades, favoritos del usuario (Set con invalidación al toggle); extender el caché del autocomplete a sessionStorage (pendiente ya anotado en MEMORY) |
| 12 | P2 | Medio — publicar con 4 fotos baja de ~8–15s a ~3–5s en 4G | L | L | `app/publish/PublishForm.tsx`, `app/listings/[id]/edit/page.tsx` | Loop `for` secuencial comprimir→upload→insert; redirect con `setTimeout` fijo de 1.5s | Comprimir y subir las fotos en paralelo (`Promise.all`, manteniendo `sort_order` por índice); insertar `listing_photos` en un solo insert múltiple; redirigir apenas termina |
| 13 | P2 | Bajo-medio — 1 RTT menos y menos código duplicado en tienda | L | L | `app/store/[id]/page.tsx` | Listener de sesión propio + `getSession()` secuencial antes del fetch de datos | Usar `useSession()` del contexto; disparar el `Promise.all` de datos sin esperar la sesión y resolver favoritos aparte cuando la sesión esté |
| 14 | P2 | Bajo-medio — arranque del PWA sin descarga sorpresa de 2 MB | L | L | `components/SplashSponsorSync.tsx`, `public/banners/` | Descarga el original para data-URL; fallback >400 KB guarda URL remota | Pedir la imagen vía `/_next/image` (URL del optimizador con width chico) antes de convertir a data-URL; documentar tamaño recomendado del asset de splash. Además comprimir `banner-institucional.png` (2.1 MB) en el repo |
| 15 | P2 | Medio en PWA instalado — apertura repetida y offline dignos | M | M | `public/sw.js`, nueva `app/offline/page.tsx` | Precache mínimo, sin fallback offline | En la reescritura del SW (#5): precache de shell + íconos + logo, página offline de marca como fallback de navegación |

---

## 3. Roadmap por fases

Cada fase es independiente, deployable por sí sola y ordenada por (impacto ÷ riesgo).
Regla transversal de verificación para TODAS las fases: `npm run build` debe mantener
`/` y `/publish` en ○/ISR y `/category/[slug]` en ●; probar navegación real en mobile
(o DevTools con throttling "Fast 4G" + CPU 4×) antes de dar por cerrada la fase.

### Fase 1 — Quick wins de percepción (riesgo bajo, 1 sesión)
**Ejecutor: Sonnet · esfuerzo default (`high`).**
Tareas: **T1** (priority en LCP del home), **T2** (next/image + priority en galería del
detalle), **T3** (orden client-side + filtros sin borrar contenido), **T4** (fix doble
carga por sesión en /listings), **T5** (payload de listas: 1 foto por anuncio).
Resultado esperado: home e imágenes notablemente más rápidos, filtros instantáneos,
50% menos de carga inicial en /listings para usuarios logueados, sin tocar arquitectura.

### Fase 2 — Navegación instantánea en /listings (el corazón del problema)
**Ejecutor: Opus 4.8 · `xhigh` para T6, default (`high`) para T7 y T8.**
Tareas: **T6** (caché de resultados por filtros + restauración de scroll), **T7**
(waterfall: paralelizar/cachear resolución de categoría y extras), **T8** (caché de sesión
para categorías/localidades/favoritos). Resultado: entrar a /listings con datos ya vistos
pinta en 0 RTT; volver desde el detalle es instantáneo con scroll preservado.

### Fase 3 — Detalle de anuncio instantáneo
**Ejecutor: Opus 4.8 · esfuerzo default (`high`).**
Tareas: **T9** (render optimista con datos de la card), **T10** (consolidar tandas de
queries del detalle), **T11** (shells estáticos para /listings/[id], /store/[id],
/listings/[id]/edit). Resultado: tocar una card pinta contenido en <100ms percibidos;
el CTA de WhatsApp aparece 2 RTT antes.

### Fase 4 — Service Worker correcto (riesgo controlado, probar bien en PWA real)
**Ejecutor: Opus 4.8 · `xhigh` (T13 va en la misma sesión y hereda el nivel).**
Tareas: **T12** (reescritura del SW: estrategias por tipo + caches con límite + fix
mareas/RSC congelados), **T13** (página offline + precache de shell). Se hace en fase
propia porque el SW afecta a TODO y requiere verificación en dispositivo instalado
(incluye bump de versión y prueba de actualización limpia).

### Fase 5 — Flujos de escritura y rutas secundarias
**Ejecutor: Sonnet · esfuerzo default (`high`).**
Tareas: **T14** (uploads de fotos en paralelo en publish/edit + redirect inmediato),
**T15** (edit con datos estáticos server-side), **T16** (store con SessionContext),
**T17** (splash sponsor sin descarga pesada + asset optimizado).
Resultado: publicar/editar se sienten ágiles; tienda y splash pulidos.

### Fase 6 — Medición y guardarraíles (opcional pero recomendado)
**Ejecutor: Sonnet · esfuerzo default (`high`).**
Tareas: **T18** (reporte de Web Vitals reales — LCP/INP de usuarios en producción,
p. ej. vía Vercel Speed Insights ya disponible en el plan actual, para validar las fases
anteriores con datos de la isla: gama media + 4G).

---

## 4. Backlog de ejecución (Sonnet / Opus según tarea)

Convenciones para TODAS las tareas: hablar al usuario en español, código/UI en portugués
brasileño, CSS solo con variables de marca (sin Tailwind), respetar el pilar de velocidad
(CLAUDE.md), y al cerrar: `npm run build` verificando que las rutas estáticas/ISR no se
degraden + prueba de navegación real. No introducir dependencias nuevas salvo que la tarea
lo indique.

Cada tarea trae su **Ejecutor recomendado** (modelo · esfuerzo). El default de Sonnet y de
Opus 4.8 ya es `high`: solo hace falta correr `/effort xhigh` antes de T6 y T12, y
`/effort auto` al terminarlas.

---

### T1 — Prioridad de carga para las imágenes LCP del home

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que el banner y las primeras cards de "Anúncios destacados" carguen con
prioridad alta y el LCP del home baje en conexiones móviles.

**Archivos afectados:** `components/BannerRotativo.tsx`, `components/ListingCard.tsx`,
`components/HomeClient.tsx`.

**Cambios necesarios:** agregar la marca de prioridad de `next/image` a la imagen del
banner activo; agregar a `ListingCard` una prop opcional de prioridad y pasarla desde el
home solo para las primeras ~4 cards (índice < 4); el resto de los usos de `ListingCard`
(listados, tienda) no cambia.

**Dependencias:** ninguna.

**Criterios de aceptación:** en el HTML servido del home, la imagen del banner y las
primeras cards salen con `fetchpriority="high"`/sin `loading="lazy"`; las cards restantes
siguen lazy; sin cambios visuales; build sin degradar `○ /`.

**Riesgos:** marcar demasiadas imágenes como prioritarias compite por ancho de banda —
limitar a banner + 4 cards.

**Impacto esperado:** LCP del home 0.5–1.5s antes en 4G; percepción de "la página ya está".

---

### T2 — Galería del detalle con next/image y prioridad

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que la foto principal del anuncio (el LCP del detalle y la descarga más
pesada de la app) llegue optimizada (AVIF/WebP, dimensionada a viewport) y con prioridad.

**Archivos afectados:** `app/listings/[id]/page.tsx`.

**Cambios necesarios:** reemplazar el `<img>` de la foto principal de la galería por
`next/image` (fill dentro del contenedor existente o width/height explícitos, sizes acorde
al max-width 480px de la app) con prioridad en la foto visible; mantener el
`objectFit: contain` y el tap para abrir lightbox; en el lightbox se puede mantener el
original de R2 (zoom sin recompresión) — documentar esa decisión en comentario breve;
los thumbnails de la tira inferior del lightbox (hoy `<img>`) pasan a `next/image`.

**Dependencias:** ninguna (los `remotePatterns` de R2 ya están en `next.config.mjs`).

**Criterios de aceptación:** en la pestaña Network, la foto principal llega vía
`/_next/image` en AVIF/WebP con ancho ≤ ~960px (480 CSS px × DPR 2); navegación entre
fotos de la galería sigue fluida; lightbox y zoom intactos.

**Riesgos:** `objectFit: contain` con `fill` exige contenedor con posición y altura
correctas (ya existe: el contenedor actual define min/max-height); fotos HEIC ya vienen
normalizadas a JPEG al subir.

**Impacto esperado:** la pantalla más importante baja su peso de imagen ~5–10×; el LCP
del detalle mejora de forma dramática en 4G.

---

### T3 — Filtros y orden instantáneos en /listings

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que cambiar orden, condición o zona nunca deje la pantalla vacía, y que
reordenar no toque la red.

**Archivos afectados:** `app/listings/page.tsx`.

**Cambios necesarios:** (a) el cambio de `sortBy` deja de estar en las dependencias del
efecto de carga: se ordena client-side sobre los resultados ya cargados (precio asc/desc
con nulls al final, recientes por `created_at`); (b) para los filtros que sí requieren red
(condición, zona, categoría, búsqueda), no llamar `setLoading(true)` cuando ya hay
resultados en pantalla: mantener la lista anterior visible con un indicador discreto de
actualización y reemplazarla cuando llegan los datos; el spinner completo queda solo para
el primer render sin datos.

**Dependencias:** se potencia con T6 (caché por filtros) pero no la requiere.

**Criterios de aceptación:** tocar "Menor preço"/"Maior preço"/"Recentes" reordena sin
request de red y sin parpadeo; cambiar zona/condición mantiene el contenido previo visible
hasta que llega el nuevo; el tracking de búsquedas (`trackSearch`) sigue registrando una
vez por término.

**Riesgos:** el orden client-side sobre 60 items debe replicar el criterio SQL (nulls
last) para que no "salte" el orden al recargar; cuidado con no romper el límite de 60.

**Impacto esperado:** los controles más tocados de la pantalla de navegación responden
al instante.

---

### T4 — Eliminar la doble carga de /listings al resolver la sesión

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que la lista se cargue UNA vez para usuarios logueados (hoy: una con
sesión null y otra cuando el SessionContext resuelve).

**Archivos afectados:** `app/listings/page.tsx`.

**Cambios necesarios:** separar responsabilidades: el efecto que carga anuncios no debe
depender de `session` (la query de listings es pública); mover la carga de favoritos a un
efecto propio que dependa de la sesión (y que solo pinte corazones cuando llegue). Aplicar
el mismo criterio en `/store/[id]` si se hace T16 antes.

**Dependencias:** ninguna; hacerla antes o junto con T6 (simplifica su clave de caché).

**Criterios de aceptación:** con usuario logueado, entrar a /listings dispara una sola
query de anuncios (verificable en Network); los favoritos aparecen sin recargar la lista;
usuarios anónimos sin cambios.

**Riesgos:** bajo; cuidar que `toggleFavorite` siga funcionando cuando la sesión llega
después que la lista.

**Impacto esperado:** ~50% menos de trabajo de red/render en la entrada más común a la
pantalla para usuarios con cuenta.

---

### T5 — Reducir el payload de las listas a 1 foto por anuncio

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que las queries de listas dejen de traer hasta 6 fotos por anuncio y joins
sin uso.

**Archivos afectados:** `app/page.tsx` (home), `app/listings/page.tsx`,
`app/store/[id]/page.tsx`, `app/favorites/page.tsx`, `app/profile/page.tsx` y
`lib/profileCache.ts` (si aplica el mismo embed).

**Cambios necesarios:** en los selects con embed de `listing_photos`, ordenar por
`sort_order` y limitar a 1 en la tabla foránea (supabase-js soporta order/limit por
foreignTable); quitar el join de `subzones` de los selects cuyas cards no lo muestran
(home y /listings hoy solo muestran localidad); ajustar `ListingCard` si asume array
completo (ya toma la primera tras ordenar — seguirá funcionando con 1).

**Dependencias:** ninguna.

**Criterios de aceptación:** la respuesta de la query de /listings contiene exactamente
1 foto por anuncio (verificable en Network); las miniaturas mostradas siguen siendo la
primera foto por `sort_order`; home/tienda/favoritos/perfil sin cambios visuales.

**Riesgos:** verificar la sintaxis de order+limit en foreignTable con la versión instalada
de supabase-js; si algún flujo usa la segunda foto (no se encontró ninguno), ajustarlo.

**Impacto esperado:** payload de listas 3–6× menor → parse más rápido y menos memoria en
gama media.

---

### T6 — Caché de resultados y restauración de scroll en /listings

**Ejecutor recomendado:** Opus 4.8 · **`/effort xhigh`** (estado stale, scroll y back
navigation tienen trampas sutiles; volver a `/effort auto` al terminar).

**Objetivo:** que volver a /listings (desde el detalle o re-entrando con los mismos
filtros) pinte al instante lo ya visto y restaure la posición de scroll, revalidando en
segundo plano.

**Archivos afectados:** `app/listings/page.tsx` (posible helper nuevo en `lib/`).

**Cambios necesarios:** caché a nivel módulo (Map) keyed por la combinación de filtros
(categoría, q, subcategoría, condición, zona) → { resultados, timestamp }; al montar con
una clave cacheada: render inmediato sin spinner + refetch silencioso que actualiza si
cambió; guardar scroll (por clave) al navegar al detalle y restaurarlo al volver; TTL
corto (2–5 min) para no mostrar cosas muy viejas; el patrón de referencia es
`lib/profileCache.ts` (prewarm + stale-while-revalidate ya aprobado en este proyecto).

**Dependencias:** T4 (una sola carga) simplifica; T3 comparte el "no vaciar la pantalla".

**Criterios de aceptación:** flujo detalle → back: lista y scroll aparecen al instante sin
spinner (verificar con throttling 4G); los datos se revalidan en segundo plano (un anuncio
recién pausado desaparece tras la revalidación); memoria acotada (limitar el Map a ~10
claves, LRU simple).

**Riesgos:** estado stale visible unos ms (aceptable y estándar); interacción con
`router.back()` ya usado por el botón volver del detalle (fix previo documentado en
MEMORY §18) — probar ambos caminos (back del header y back del gesto/navegador).

**Impacto esperado:** el gesto más frecuente del marketplace pasa de "spinner + reload"
a instantáneo. Es, junto con T9, el mayor salto de percepción de todo el plan.

---

### T7 — Desarmar el waterfall de /listings

**Ejecutor recomendado:** Opus 4.8 · esfuerzo default (`high`).

**Objetivo:** reducir los viajes de red secuenciales previos a la query principal
(hoy: categoría por slug → extras → anuncios = 3 RTT encadenados cuando hay categoría).

**Archivos afectados:** `app/listings/page.tsx` (helper de caché de categorías en `lib/`).

**Cambios necesarios:** (a) cachear el catálogo de categorías (slug → id, name, icon) en
módulo + `sessionStorage` con TTL (es casi estático; el admin ya revalida el home al
editarlo) — con eso la resolución slug→id es síncrona en visitas repetidas; (b) disparar
en paralelo la query de `listing_extra_categories` y la de anuncios por categoría
principal, y fusionar resultados en el cliente (dos queries concurrentes en vez de
encadenadas), manteniendo el `or` actual como está cuando no hay extras; (c) localidades
al mismo caché de sesión (hoy ya se evita re-fetch dentro del mount, pero no entre visitas).

**Dependencias:** conviene después de T4/T6 (la clave de caché ya definida).

**Criterios de aceptación:** primera visita con categoría: máx 2 RTT concurrentes (antes
3 secuenciales); visitas siguientes: 1 RTT (categoría resuelta de caché); resultados
idénticos a los actuales para principal+secundarias (probar con un anuncio multi-categoría
real); slug inválido sigue mostrando vacío.

**Riesgos:** la fusión client-side de "principal ∪ extras" debe deduplicar por id y
respetar el orden elegido; mantener el límite 60.

**Impacto esperado:** ~200–600ms menos por entrada con categoría en 4G (RTT isla-São
Paulo incluido).

---

### T8 — Caché de sesión para favoritos

**Ejecutor recomendado:** Opus 4.8 · esfuerzo default (`high`). (Aceptable Sonnet si se
hace después de T4 y T6, con esos patrones ya asentados.)

**Objetivo:** dejar de re-consultar los favoritos del usuario en cada visita a
/listings y /store.

**Archivos afectados:** `app/listings/page.tsx`, `app/store/[id]/page.tsx`, helper nuevo
en `lib/` (espejo de `profileCache.ts`).

**Cambios necesarios:** módulo con Set de ids favoritos por usuario, cargado una vez por
sesión de navegación y actualizado localmente en cada toggle (las mutaciones ya actualizan
el estado local — solo falta que sobrevivan a la navegación); las páginas leen del caché
primero y revalidan en segundo plano.

**Dependencias:** T4 (efecto de favoritos separado).

**Criterios de aceptación:** navegar entre /listings, detalle y tienda no repite la query
de favoritos (Network); un toggle en una pantalla se refleja al volver a otra; logout
limpia el caché.

**Riesgos:** bajo; invalidar en `onAuthStateChange` (patrón ya existente en
SessionContext/prewarmProfile).

**Impacto esperado:** 1 query menos por navegación para usuarios logueados; corazones
pintados al instante.

---

### T9 — Render optimista del detalle con los datos de la card

**Ejecutor recomendado:** Opus 4.8 · esfuerzo default (`high`).

**Objetivo:** que al tocar una card, el detalle pinte título, precio y primera foto
**inmediatamente** (datos que la lista ya tiene), mientras la query completa llega por atrás.

**Archivos afectados:** `components/ListingCard.tsx` (origen), `app/listings/[id]/page.tsx`
(destino), helper pequeño en `lib/` para el traspaso.

**Cambios necesarios:** al navegar desde una card, dejar los datos mínimos del anuncio
(id, título, precio, price_text, primera foto, localidad) disponibles para el detalle
(sessionStorage o Map de módulo — mismo origen de navegación garantizado); el detalle, si
encuentra esos datos para el id, renderiza el layout completo con ellos (foto con
`next/image` priority de T2, título, precio, skeleton en descripción/vendedor) en vez del
spinner de página entera; cuando llega la query principal, se completa el resto sin saltos
bruscos (reservar alturas de los bloques que faltan). Si no hay datos (deep link, refresh),
comportamiento actual con skeleton en lugar de spinner.

**Dependencias:** T2 (imagen optimizada); combinar con T10.

**Criterios de aceptación:** tocar una card muestra contenido real en <100ms percibidos
(la foto ya está en caché del navegador porque la card la mostró); sin layout shift grosero
cuando llegan los datos completos (medir CLS en DevTools); deep links sin regresión.

**Riesgos:** desincronización si el anuncio cambió entre lista y detalle (la query completa
corrige en <1s — aceptable); disciplina con las alturas reservadas para no generar CLS.

**Impacto esperado:** la transición card→detalle se siente instantánea, estilo
Instagram/Mercado Libre. Junto con T6, el mayor salto de percepción del plan.

---

### T10 — Consolidar las tandas de queries del detalle

**Ejecutor recomendado:** Opus 4.8 · esfuerzo default (`high`), en la misma sesión que T9.

**Objetivo:** que el vendedor y el botón de WhatsApp no esperen a una segunda tanda de
queries tras la principal.

**Archivos afectados:** `app/listings/[id]/page.tsx`.

**Cambios necesarios:** disparar en paralelo con la query principal todo lo que solo
depende del id del anuncio: la fila de favorito (hoy en efecto aparte) puede unirse al
mismo lote; la de vendedor (`profiles_public`) hoy espera al resultado principal para
conocer `user_id` — resolver incluyéndola como embed en la query principal si la relación
lo permite contra la vista `profiles_public`, o lanzándola apenas se conoce `user_id` sin
esperar al render; el RPC del teléfono se mantiene lazy por sesión (regla LGPD) pero debe
dispararse apenas hay `user_id`+sesión en vez de esperar a que `seller` esté seteado.

**Dependencias:** T9 (misma zona de código); hacerlas juntas.

**Criterios de aceptación:** cascada de Network del detalle: máx 2 niveles (principal ‖
favorito → vendedor+teléfono en paralelo inmediato); el botón de WhatsApp con `<a>` nativo
y teléfono pre-cargado sigue intacto (regla anti popup-blocker de MEMORY §18); anuncios
`zonas_de_atencion` muestran sus zonas igual que hoy.

**Riesgos:** el embed contra una vista puede no tener FK — en ese caso mantener query
aparte pero adelantada; no tocar la semántica del RPC `get_seller_whatsapp`.

**Impacto esperado:** CTA de contacto visible 1–2 RTT antes (~300–800ms en 4G).

---

### T11 — Shells estáticos para las rutas dinámicas puro-cliente

**Ejecutor recomendado:** Opus 4.8 · esfuerzo default (`high`).

**Objetivo:** eliminar la invocación de función Vercel (y sus cold starts) al navegar a
`/listings/[id]`, `/store/[id]` y `/listings/[id]/edit`, cuyo HTML no depende del id.

**Archivos afectados:** `app/listings/[id]/page.tsx`, `app/store/[id]/page.tsx`,
`app/listings/[id]/edit/page.tsx` (el edit puede requerir ajuste si se hace T15 — en ese
caso T15 manda y esta tarea solo cubre detalle y tienda).

**Cambios necesarios:** forzar el pre-render estático del shell (las páginas son client
components que leen el id con `useParams`, así que el HTML es idéntico para cualquier id):
`generateStaticParams` vacío con `dynamicParams` habilitado, o `dynamic = "force-static"`
según lo que el build acepte mejor en Next 14.2. Verificar contra la nota de MIGRATION_NEXT16.md
si hay planes de migración que afecten la elección.

**Dependencias:** ninguna técnica; ideal tras T9/T10 para que el shell estático ya sirva
el skeleton bueno.

**Criterios de aceptación:** `npm run build` muestra esas rutas como ○/● (ya no ƒ);
navegar a un anuncio no invoca función (verificable en los logs de Vercel tras deploy);
`useParams` sigue entregando el id; back/forward sin regresiones.

**Riesgos:** medio: comprobar que ninguna de las tres páginas lea headers/cookies en
server (no lo hacen — son "use client" completas); probar deep links fríos tras deploy.

**Impacto esperado:** elimina un RTT servidor (decenas de ms cálidos, >1s en cold start)
de la navegación más frecuente.

---

### T12 — Reescritura del Service Worker (estrategias por tipo + fix de datos congelados)

**Ejecutor recomendado:** Opus 4.8 · **`/effort xhigh`** (la tarea más delicada del plan:
un SW roto queda cacheado en los dispositivos y es difícil de revertir; volver a
`/effort auto` al terminar).

**Objetivo:** corregir los dos bugs de frescura (mareas y payloads RSC congelados) y
acotar el almacenamiento, manteniendo apertura rápida del PWA.

**Archivos afectados:** `public/sw.js` (y bump de versión de caché).

**Cambios necesarios:** reescribir el fetch handler con estrategias explícitas por tipo
de request: (1) Supabase: no interceptar (ya está); (2) `/api/*` y requests RSC de Next
(query `_rsc` o header correspondiente): network-first con fallback a caché solo para
soporte offline, nunca cache-first; (3) navegaciones HTML: network-first con fallback a
caché y a la página offline (T13); (4) `/_next/static/*` (inmutable con hash): cache-first;
(5) `/_next/image` e imágenes R2: stale-while-revalidate en un caché propio con límite de
entradas (LRU simple: al superar N, borrar las más viejas); caches separados por tipo
(STATIC/PAGES/IMAGES/DATA) y limpieza de versiones viejas en activate (patrón ya descrito
en ORCHESTRADOR.md Agent-5). Subir versión de caché.

**Dependencias:** ninguna; T13 va en el mismo cambio o inmediatamente después.

**Criterios de aceptación:** las mareas del home se actualizan al día siguiente sin
reinstalar el PWA; navegar en el PWA muestra anuncios frescos (ISR 60s efectivo — publicar
un anuncio de prueba y verlo aparecer navegando, sin recargar); el storage del sitio se
mantiene acotado tras navegar muchos anuncios (Application → Storage); la actualización
del SW de v4 a la nueva versión limpia los caches viejos.

**Riesgos:** medio-alto por alcance global: probar en PWA instalado real (Android) el
ciclo instalar → navegar → actualizar SW; mantener la regla de MEMORY/ORCHESTRADOR de
nunca cachear auth de Supabase ni `/publish`, `/profile`, `/admin`.

**Impacto esperado:** corrige staleness real que hoy contradice el ISR, y hace que la
apertura repetida del PWA sea rápida sin acumular basura.

---

### T13 — Página offline y precache del shell

**Ejecutor recomendado:** Opus 4.8 · en la misma sesión que T12 (hereda `xhigh`); si se
hace suelta, esfuerzo default (`high`).

**Objetivo:** que el PWA abra con algo digno sin conexión (realidad frecuente en la isla)
en vez de error del navegador.

**Archivos afectados:** nueva `app/offline/page.tsx`, `public/sw.js` (precache list).

**Cambios necesarios:** página offline estática con la marca (logo, mensaje en pt-BR,
botón reintentar); agregarla al precache junto con logo e íconos; usarla como fallback
del handler de navegación cuando red y caché fallan.

**Dependencias:** T12 (misma reescritura del SW).

**Criterios de aceptación:** modo avión + abrir el PWA → página offline de marca; rutas
ya visitadas siguen mostrando su HTML cacheado; al volver la conexión todo se normaliza.

**Riesgos:** bajo.

**Impacto esperado:** confiabilidad percibida (parte de "se siente como app nativa").

---

### T14 — Subida de fotos en paralelo y redirect inmediato al publicar/editar

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que publicar con fotos tarde lo que tarda la foto más lenta, no la suma de
todas, y que el éxito redirija sin espera artificial.

**Archivos afectados:** `app/publish/PublishForm.tsx`, `app/listings/[id]/edit/page.tsx`.

**Cambios necesarios:** comprimir y subir todas las fotos concurrentemente conservando el
`sort_order` por índice original; insertar todas las filas de `listing_photos` en un único
insert; mantener la tolerancia a fallos por foto (una falla no aborta las demás); reducir
o eliminar el `setTimeout` fijo de 1.5s del éxito (redirigir apenas la publicación quedó
consistente, dejando el mensaje de éxito como toast/estado en la página destino si hace
falta feedback).

**Dependencias:** ninguna.

**Criterios de aceptación:** publicar con 4 fotos en throttling 4G baja a
aproximadamente el tiempo de la foto más pesada + 1 RTT; las fotos quedan en el orden
elegido; si una foto falla, el anuncio queda publicado con las restantes (comportamiento
actual preservado); `/api/revalidate` sigue disparándose.

**Riesgos:** R2/`/api/upload` recibe 4 requests concurrentes — verificar que la función
lo tolere (son uploads independientes; bajo); orden garantizado por índice, no por orden
de llegada.

**Impacto esperado:** el flujo de escritura más importante deja de sentirse colgado.

---

### T15 — Edit con datos estáticos resueltos en el servidor

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`) — replica un patrón ya
probado en el repo (split de publish).

**Objetivo:** que `/listings/[id]/edit` abra con los desplegables ya poblados, como
`/publish`.

**Archivos afectados:** `app/listings/[id]/edit/page.tsx` (split en Server Component
padre + form cliente, patrón exacto de `app/publish/page.tsx` + `PublishForm.tsx`).

**Cambios necesarios:** extraer el formulario a un componente cliente que reciba
categorías/localidades/subzonas por props; el padre las trae con `getSupabaseAdmin({
revalidate: 300 })`; la carga del anuncio a editar y el guard de dueño siguen client-side.

**Dependencias:** coordinar con T11 (con este split la ruta queda ƒ o ISR según se
configure — decidir en la tarea: ISR 300 del shell es suficiente).

**Criterios de aceptación:** abrir editar muestra el form con opciones al instante (sin
cascada de 3 queries en Network); editar y guardar funciona igual (incluidas categorías
secundarias y zonas); build sin errores.

**Riesgos:** bajo; es replicar un patrón ya probado en el propio repo (split de publish,
memoria `project_latencia_2026_07_01`).

**Impacto esperado:** editar pasa de ~3 RTT encadenados a 0 para los datos estáticos.

---

### T16 — /store/[id] con SessionContext y queries sin waterfall

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** quitar el manejo de sesión duplicado de la tienda y adelantar el fetch de
datos.

**Archivos afectados:** `app/store/[id]/page.tsx`.

**Cambios necesarios:** usar `useSession()` en lugar del listener propio; disparar
vendedor+anuncios sin esperar `getSession()` (no dependen de la sesión) y resolver
favoritos en efecto propio cuando haya sesión (mismo criterio que T4); integrar el caché
de favoritos de T8.

**Dependencias:** T4/T8 definen el patrón.

**Criterios de aceptación:** la tienda pinta con 1 tanda de queries concurrentes;
favoritos y botón de WhatsApp intactos; sin listener de auth duplicado.

**Riesgos:** bajo.

**Impacto esperado:** ~1 RTT menos al abrir tiendas; menos código.

---

### T17 — Splash sponsor sin descarga pesada + assets optimizados

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** que la sincronización del patrocinador del splash nunca descargue el asset
original pesado, y sanear el banner de 2.1 MB del repo.

**Archivos afectados:** `components/SplashSponsorSync.tsx`,
`public/banners/banner-institucional.png`, documentación de la skill de banners
(`.claude/skills/SKILL_BANNER_INSTITUCIONAL.md`) si define tamaños.

**Cambios necesarios:** en `SplashSponsorSync`, pedir la imagen a través del optimizador
de Next (`/_next/image` con un ancho pequeño, ~340px, acorde al `max-width: 170px` del
slot) antes de convertir a data-URL — así el data-URL queda chico y el fallback de URL
remota deja de apuntar al original; recomprimir `banner-institucional.png` a un tamaño
razonable (<300 KB) sin cambiar su URL; anotar en la doc el tamaño máximo recomendado para
assets de banner/splash.

**Dependencias:** ninguna.

**Criterios de aceptación:** con un banner de splash activo, el arranque del PWA no
descarga >400 KB por el sponsor (Network); el logo del sponsor se ve nítido en el splash;
el banner del home sigue viéndose igual.

**Riesgos:** bajo; la URL del optimizador debe ser absoluta al dominio de producción para
funcionar desde el contexto del splash (verificar en PWA instalado).

**Impacto esperado:** arranque del PWA sin descargas sorpresa; repo más liviano.

---

### T18 — Web Vitals reales de producción (guardarraíl del pilar de velocidad)

**Ejecutor recomendado:** Sonnet · esfuerzo default (`high`).

**Objetivo:** medir LCP/INP/CLS de los usuarios reales de la isla para validar las fases
anteriores y detectar regresiones futuras.

**Archivos afectados:** decisión de herramienta primero: si se usa Vercel Speed Insights,
`app/layout.tsx` + dependencia oficial; si no, `app/layout.tsx` con el hook nativo de Next
(`useReportWebVitals`) enviando a un endpoint propio liviano.

**Cambios necesarios:** habilitar la recolección con muestreo por defecto; nada de
dashboards propios: consumir el panel de Vercel o logs simples.

**Dependencias:** ideal al final de la Fase 1 para capturar el antes/después del resto.

**Criterios de aceptación:** datos de vitals visibles para producción segmentables por
ruta; overhead de JS agregado < 2 kB; ninguna ruta pierde su condición estática/ISR.

**Riesgos:** bajo; es el único ítem que puede agregar una dependencia — pedir OK al
usuario antes de instalarla.

**Impacto esperado:** deja de optimizarse a ciegas; el pilar de velocidad gana un
guardarraíl permanente.

---

## Orden de ejecución sugerido (resumen)

| Fase | Tareas | Ejecutor (modelo · esfuerzo) | Independiente | Riesgo | Ganancia percibida |
|---|---|---|---|---|---|
| 1 | T1, T2, T3, T4, T5 | Sonnet · high (default) | Sí | Bajo | Alta e inmediata |
| 2 | T6, T7, T8 | Opus 4.8 · **xhigh en T6**, high en T7–T8 | Sí | Medio | La más alta del plan (junto a Fase 3) |
| 3 | T9, T10, T11 | Opus 4.8 · high (default) | Sí | Medio | Card→detalle instantáneo |
| 4 | T12, T13 | Opus 4.8 · **xhigh** | Sí | Medio-alto (probar en PWA real) | Frescura + PWA sólido |
| 5 | T14, T15, T16, T17 | Sonnet · high (default) | Sí | Bajo | Flujos de escritura ágiles |
| 6 | T18 | Sonnet · high (default) | Sí | Bajo | Medición permanente |
