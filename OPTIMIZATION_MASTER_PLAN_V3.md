# OPTIMIZATION_MASTER_PLAN_V3.md — Mercado Ilha

Tercera auditoría de velocidad, generada el **2026-07-10** sobre el código en producción
(`main`, HEAD `d13f015`, Next.js 14.2.35, build verificado hoy). Parte de la base de que
**los planes V1 (Fases 1-6) y V2 (Fases 1-4) están COMPLETOS y en producción** — este
documento NO repite nada de aquellos; los toma como línea de base y **no los deshace**.

**Este documento no modifica código.** Es el plan de ejecución tarea por tarea, escrito
para que cualquier modelo (Sonnet u Opus) pueda retomarlo sin contexto previo: cada tarea
es autocontenida, con archivo:línea real, qué medir y cómo verificar.

**Norte:** tras V1+V2 la app ya se siente rápida con poco tráfico. El objetivo del V3 es
distinto: **que esa fluidez profesional NO se degrade al crecer a 1000+ usuarios activos**.
Los cuellos de este plan son los que recién aparecen con volumen: crecimiento de la base de
datos, queries sin paginación, costo por fila de las políticas RLS, cupos del free tier
(Vercel Image Optimization / edge requests, Supabase DB/egress), INP bajo interacción en
gama media, y el arranque. La métrica sigue siendo la misma: *milisegundos entre el toque
y el contenido útil, en un Android de gama media con 4G de isla*.

---

## 0. Cómo usar este documento (protocolo de esfuerzo)

Cada tarea trae su **Ejecutor recomendado** (Sonnet / Opus 4.8 / Fable 5 con su `/effort`).
Regla heredada de V1/V2: Sonnet `high` (default) para lo mecánico y bien delimitado;
Opus/Fable con `xhigh` solo donde un error sutil es caro de revertir. Fable suele
necesitar un escalón menos de esfuerzo que Opus para la misma tarea.

| Fase | Sonnet/Opus | Fable 5 | ¿Avisar `/effort` alto? | ¿Zona delicada? |
|---|---|---|---|---|
| 0 — Foto inicial de consumo | Sonnet · `high` | `low` | No | No (sin código) |
| 1 — DB lista para volumen | Sonnet `high` (T1-T2); **Opus `xhigh`** (T3) | `medium` (T1-T2); **`high`** (T3) | **Sí** (T3) | **T3: reescribe RLS = seguridad/LGPD** |
| 2 — Paginación | **Opus `xhigh`** (T4); Sonnet `high` (T5-T6) | **`xhigh`** (T4); `low`-`medium` (T5-T6) | **Sí** (T4) | **T4: toca la máquina de caché/scroll de la ruta más usada** |
| 3 — INP bajo interacción | Opus `high` (T7); Sonnet `high` (T8-T9) | `medium` (T7); `low` (T8-T9) | No | No |
| 4 — Imágenes a escala | Sonnet · `high` | `medium` (T10); `low` (T11) | No | T11 requiere decisión del usuario |
| 5 — SW v7 (opcional) | **Opus `xhigh`** | **`xhigh`** | **Sí** | **SW global + revisita una decisión consciente del V2** |
| 6 — Guardarraíl mensual | Sonnet · `high` | `low` | No | No (proceso) |

**Ninguna tarea amerita `max`.** Si en T3, T4 o T12 aparece una ambigüedad arquitectónica
que este documento no resuelva, **frenar y preguntar al usuario** antes de improvisar.
Al cerrar cada fase: volver a `/effort auto` y avisar el esfuerzo de la siguiente.

---

## 1. Límites innegociables (heredados del pedido del usuario)

1. **Mantenimiento 100% gratis**: Vercel Hobby, Supabase Free, R2 free tier. Ninguna tarea
   puede requerir plan pago, dominio pago ni servicio nuevo con costo. Si una mejora obliga
   a elegir entre velocidad y gratuidad → **marcarla "requiere decisión del usuario" y
   seguir** (así están marcadas C1/C2 y T11 en este plan).
2. **No romper lo que funciona** (línea de base V1+V2): home y `/listings` ISR 60s,
   `/category/[slug]` SSG, shells `● SSG` de detalle/tienda, render optimista
   (`lib/listingPreview.ts`), `listingsCache`/`catalogCache`/`favoritesCache` +
   `sessionStorage`, SW v6 (race 500ms + Navigation Preload + seed de `/`), íconos
   maskable + startup images iOS, cortina azul 100% CSS, `minimumCacheTTL` 31 días,
   uploads paralelos, 1 foto por anuncio en listas, `prefixFilter` sin acentos,
   preconnects a Supabase/R2 (`app/layout.tsx:66-69`), región `gru1`. Solo se tocan para
   mejorarlos sin degradarlos.
3. **Verificación obligatoria al cerrar cada tarea**: `npm run build` sin que ninguna ruta
   pierda su condición (tabla de referencia en §2) + navegación real (Chromium local o
   dispositivo). "Ya está" no vale sin la prueba.
4. Idioma: hablar al usuario en español; código y UI en portugués brasileño. CSS con
   variables de marca, sin Tailwind. No agregar dependencias sin OK explícito del usuario.
5. Las tareas SQL se entregan como archivo en `supabase/` + instrucciones exactas para el
   SQL Editor (el usuario las corre; no hay acceso directo a la DB desde acá).

---

## 2. Contexto medido (línea de base, 2026-07-10)

### Build local (`npm run build`, 52 páginas, sin errores) — [MEDIDO]

| Ruta | Estado | First Load JS |
|---|---|---|
| `/` | ○ Static (ISR 60) | 175 kB |
| `/listings` | ○ Static (ISR 60) | 170 kB |
| `/listings/[id]` | ● SSG (shell) | 170 kB |
| `/listings/[id]/edit` | ƒ Dynamic (aceptado en V1-T15) | 169 kB |
| `/store/[id]` | ● SSG (shell) | 167 kB |
| `/category/[slug]` | ● SSG ×34 | 96.3 kB |
| `/profile` | ○ Static | 170 kB |
| `/publish` | ○ Static (ISR 300) | 168 kB |
| JS compartido | — | 87.5 kB |

### Producción (curl a `https://mercadoilha.vercel.app`, 2026-07-10) — [MEDIDO]

- `/` → `x-vercel-cache: STALE`, HTML 109 kB sin comprimir (~25 kB br). Edge sirviendo
  y revalidando atrás: correcto.
- `/listings` → `x-vercel-cache: STALE`. Correcto.
- `/listings/1` (primer hit de un id) → `x-vercel-cache: MISS`, `x-matched-path:
  /listings/[id]` → cada id NUEVO invoca una función una vez y queda cacheado en el edge.
  Con catálogo grande esto es 1 invocación por anuncio nuevo: aceptable, solo monitorear.
- Imagen optimizada (`/_next/image?...&w=384&q=75`): **14.3 kB** (original en R2:
  **120 kB**), `cache-control: public, max-age=31536000`, segunda request
  `x-vercel-cache: HIT` → el `minimumCacheTTL` del V2-T1 está funcionando: el navegador
  cachea 1 año y el edge sirve HIT.
- El `srcset` generado para las cards ofrece **9 anchos: 384–3840px**
  (`w=384,640,750,828,1080,1200,1920,2048,3840`) — la app tiene layout máx 480 CSS px;
  los anchos ≥1440 son espacio de variantes (y cupo de transformaciones) desperdiciable
  → T10.

### Lo que V1+V2 ya resolvieron — NO repetir ni deshacer

Ver §1 punto 2. Pendientes previos que NO son de este plan (no duplicar acá):
**V2-T14** (validación Speed Insights, agendada 2026-07-20) y **CLS 0.47 en
`/store/[id]`** (pendiente aparte en MEMORY §19; la Fase 0 lo re-mide de paso).

---

## 3. Modelo de carga a 1000+ usuarios y techos del free tier

**Supuestos del modelo** (explícitos para poder recalcular): 1000 usuarios activos/mes ≈
250–400 activos/día en la isla; 2–3 sesiones/día; ~6 páginas/sesión → **~100–200k page
views/mes**. Catálogo esperado: 500–2.000 anuncios activos, 2.000–8.000 fotos.

Cupos publicados a la fecha (2026-07) — **confirmarlos en los paneles al ejecutar la
Fase 0, cambian sin aviso**:

| Recurso | Cupo free | Consumo estimado a 1000+ | Riesgo |
|---|---|---|---|
| Supabase — tamaño DB | 500 MB | crece **~40–75 MB/mes solo `listing_views`** sin retención (ver hallazgo #1) | **ALTO — es el techo que sí se rompe solo** |
| Supabase — egress | 5 GB/mes | ~1.5–3 GB/mes (queries client-side de listas/detalle/búsqueda) | Medio — monitorear [HIPÓTESIS] |
| Supabase — compute | compartido (Nano) | picos de tarde-noche; el costo por fila de RLS multiplica CPU (hallazgo #3) | Medio |
| Vercel — Image Transformations | 5.000/mes | fotos nuevas × variantes (~2–6 c/u); con catálogo creciendo rápido puede excederse | Medio-alto [HIPÓTESIS — medir en panel] |
| Vercel — Edge Requests | 1M/mes | imágenes + RSC + prefetch ≈ 0.5–1.5M/mes | Medio [HIPÓTESIS — medir en panel] |
| Vercel — Fast Data Transfer | 100 GB/mes | imágenes ~14 kB c/u → ~15–30 GB/mes | Bajo |
| Vercel — invocaciones de función | cupo Hobby | ISR + on-demand SSG por id nuevo: bajo | Bajo |
| R2 — storage | 10 GB | ~120 kB/foto → caben ~80.000 fotos | Bajo |
| R2 — Class A/B | 1M / 10M por mes | misses del optimizador (TTL 31d) + uploads: mínimo | Bajo |
| R2 — dominio `pub-*.r2.dev` | rate-limited (no publicado) | protegido: el 99% pasa por el optimizador de Vercel con caché 31d | Bajo mientras no se sirva directo [HIPÓTESIS] |

**Lectura:** el único techo que se rompe *solo con el paso del tiempo* es el tamaño de la
DB de Supabase (tracking sin retención). Los demás dependen del volumen real → por eso la
Fase 0 (foto inicial) y la Fase 6 (chequeo mensual) son parte del plan, no adorno.

---

## 4. Resumen ejecutivo — los 12 hallazgos, por impacto

Etiquetas: **[MEDIDO]** verificado con medición hoy · **[CÓDIGO]** verificado leyendo el
código en producción (archivo:línea) · **[HIPÓTESIS]** estimación a confirmar con datos.

1. **[CÓDIGO] Las tablas de tracking crecen sin tope y revientan los 500 MB de Supabase
   solos.** `track_listing_view` guarda el user-agent COMPLETO por cada vista
   (`lib/tracking.ts:66`, `supabase/fase-monetizacion-tracking.sql:36-44`) en
   `listing_views`; ni esa tabla ni `search_queries`/`banner_clicks` tienen retención, y
   el cron diario solo purga anuncios (`app/api/cron/expire-listings/route.ts:198-256`,
   verificado: cero deletes de tracking). A ~3.000 vistas/día son ~40–75 MB/mes: la DB
   free se llena en meses aunque nadie haga nada mal. → T1.
2. **[CÓDIGO] `/listings` corta en 60 anuncios sin "cargar más".** El límite es fijo
   (`app/listings/ListingsClient.tsx:316` y `:335`, `lib/listingsApi.ts:30`,
   `app/listings/page.tsx:27`): con catálogo de escala, todo lo que quede después del
   puesto 60 de una vista es **invisible** (además de injusto con anuncios viejos válidos).
   Es la brecha funcional nº1 para crecer. → T4.
3. **[CÓDIGO] Las políticas RLS evalúan `auth.uid()`/`is_admin()` por fila y sin scoping
   de rol.** `supabase/fase-1.sql:264-269`: el SELECT de `listings` OR-ea tres políticas
   (`status='active'`, `user_id = auth.uid()`, `is_admin()`); `is_admin()`
   (`fase-1.sql:106-108`) hace un EXISTS sobre `profiles` y ninguna función está envuelta
   en `(select ...)` (patrón initplan que la propia guía de Supabase recomienda; reporta
   mejoras de hasta ~100× en tablas grandes), ni las políticas restringidas con
   `to authenticated`. Con cientos de filas hoy es invisible; con miles de filas
   escaneadas por query y decenas de queries/segundo es CPU del compute compartido. → T3.
4. **[CÓDIGO] No hay índice que calce con la query más caliente a escala.** Las listas
   piden `status='active' [AND category_id=X] ORDER BY created_at DESC LIMIT 60`; los
   índices existentes son sueltos: `status` (`fase-4.sql:9`), `created_at desc`
   (`fase-9-indices.sql:13`), `(category_id, subcategory_id)` (`fase-4.sql:11`),
   `(status, bumped_at desc)` (`fase-17:31-32` — este sí calza, pero solo para el home).
   Faltan los parciales `WHERE status='active'` sobre `created_at desc`,
   `(category_id, created_at desc)` y `(user_id, created_at desc)`. → T2.
5. **[CÓDIGO] Cada click en `/listings` serializa hasta ~200 kB de JSON a
   `sessionStorage`.** El listener de click en fase de captura persiste el scroll
   (`ListingsClient.tsx:422-431` → `saveScroll` → `persist()`,
   `lib/listingsCache.ts:136-139` y `:86-109`), y `persist()` re-serializa TODO el caché
   de resultados (tope 200 kB, `listingsCache.ts:39`) en el camino síncrono del tap. En
   gama media eso es trabajo de main thread dentro de la ventana de INP del gesto más
   frecuente (tocar una card). Con páginas acumuladas (T4) empeoraría. → T7.
6. **[CÓDIGO] Un toggle de favorito re-renderiza las 60 cards.** `toggleFavorite` depende
   de `favoriteIds` (`ListingsClient.tsx:460-488`) → cada toggle crea una función nueva
   que rompe el `memo` de TODAS las `ListingCard` (la prop `onToggleFavorite` cambia).
   Con 60 cards + imágenes es jank evitable en gama media. → T8.
7. **[CÓDIGO] La cortina azul de entrada se traga los taps de los primeros ~700 ms.**
   `#browser-splash` (`app/globals.css:88-105`) es `position:fixed; inset:0;
   z-index:9999` sin `pointer-events:none`: hasta que la animación termina en
   `visibility:hidden`, cualquier tap del arranque (en navegador y en Android PWA por
   `html.android-pwa`, `globals.css:114`) muere en el overlay. Un usuario apurado toca
   "Todos os anúncios" y no pasa nada. → T9.
8. **[MEDIDO] El `srcset` de las cards ofrece variantes hasta 3840px en una app de 480px.**
   Medido en el HTML de producción (§2): 9 anchos por foto, 4 de ellos (1200–3840)
   imposibles de necesitar con layout máx 480 CSS px y DPR ≤3. No hay `deviceSizes` en
   `frontend/next.config.mjs:3-17`. Cada ancho es cupo potencial de transformaciones
   (5.000/mes en Hobby) y HTML más gordo (9 URLs × ~150 chars × 60 cards ≈ 40-80 kB de
   srcset sin comprimir por página de lista). → T10.
9. **[CÓDIGO] `/store/[id]` trae TODOS los anuncios del vendedor sin límite.**
   `app/store/[id]/StoreClient.tsx:37-47`: la query no tiene `.limit()`. Un vendedor
   power-user con 100+ anuncios (el perfil exacto que aparece con escala) infla payload,
   parse y memoria en cada visita a su tienda. → T5.
10. **[CÓDIGO] `/listings` re-consulta Supabase en CADA mount aunque el caché tenga
    segundos de antigüedad.** El efecto de carga corre incondicional
    (`ListingsClient.tsx:223-247`): pinta el caché y siempre dispara `fetchPage`. Volver
    del detalle a los 10 s = query idéntica a la de hace 10 s. Con ISR de 60 s en la
    misma vista default, revalidar por debajo de 60 s no puede traer nada más fresco que
    lo que ya hay. A escala son decenas de miles de queries/mes gratis. → T6. Bonus en la
    misma zona: el label de subcategoría hace query propia por visita
    (`ListingsClient.tsx:207-211`).
11. **[HIPÓTESIS] El prefetch automático de las cards puede ser un costo relevante en 4G
    y en edge requests.** Cada `ListingCard` usa `next/link` sin prop `prefetch`
    (`components/ListingCard.tsx:51`) hacia `/listings/[id]` (ruta ● SSG) → en
    producción, cada card que entra al viewport prefetchea su payload RSC. Scrollear la
    lista completa ≈ hasta 60 requests extra por usuario. Es también lo que hace
    instantáneo el card→detalle, así que NO se toca sin medir. → medición en T0, decisión
    condicional en C3.
12. **[CÓDIGO] El caché de imágenes del SW guarda solo 60 entradas.**
    `frontend/public/sw.js:28` (`IMAGES_LIMIT = 60`): una sola pasada por `/listings`
    (60 cards) puede evacuar el caché entero → las vistas repetidas re-piden imágenes al
    edge que ya se habían bajado. Subirlo a ~150 son ~2–5 MB más de storage y menos
    requests repetidas (edge requests + latencia). → T12 (va con el bump v7 del SW).

**Verificado limpio (no perseguir):** no hay N+1 en el código — todas las listas usan
embeds de PostgREST con `limit(1)` en fotos (home `app/page.tsx:18-27`, listings
`lib/listingsApi.ts:10-11`, store, favorites, profile); el detalle consolida en 1 query
principal + 1 tanda paralela (`ListingDetailClient.tsx:89-139`); el home hace 4 queries
por revalidación ISR (no por visita). Más en §9.

---

## 5. Tabla de problemas

Prioridad: P0 = se rompe/degrada solo con la escala · P1 = alto · P2 = medio.
Dif./Riesgo: L/M/H.

| # | Prio | Impacto esperado | Dif. | Riesgo | Archivos | Tarea |
|---|---|---|---|---|---|---|
| 1 | P0 | La DB free no se llena sola; tracking útil se conserva | L | L | cron + SQL nuevo | T1 |
| 2 | P0 | Todo el catálogo navegable; primeras 60 cards igual de rápidas | M | **H** | `ListingsClient.tsx`, `listingsApi.ts`, `listingsCache.ts` | T4 |
| 3 | P0 | Queries de listas O(log n) con initplan; CPU de Supabase plana al crecer | M | **H** (seguridad) | SQL nuevo (RLS + índices) | T3 (+T2) |
| 4 | P1 | Índices que calzan → p95 de query estable con 10k+ filas | L | L | SQL nuevo | T2 |
| 5 | P1 | Tap en card sin serialización de 200 kB en el camino → INP protegido | M | M | `listingsCache.ts`, `ListingsClient.tsx` | T7 |
| 6 | P1 | Cupo de transformaciones ×2-3 más holgado; HTML de listas más chico | L | L | `next.config.mjs` | T10 |
| 7 | P1 | Tienda de vendedor grande abre igual de rápido que una chica | L | L | `StoreClient.tsx` | T5 |
| 8 | P1 | Decenas de miles de queries/mes menos a Supabase | L | L | `ListingsClient.tsx` | T6 |
| 9 | P2 | Toggle de favorito sin re-render de 60 cards | L | L | `ListingsClient.tsx` | T8 |
| 10 | P2 | El primer tap del arranque siempre responde | L | L | `globals.css` | T9 |
| 11 | P2 | Menos edge requests repetidas de imágenes | L | M (SW) | `sw.js` | T12 |
| 12 | P2 | Cupo de imágenes protegido si el catálogo explota | L | L | `next.config.mjs` | T11 (decisión) |

---

## 6. Roadmap por fases

Cada fase es independiente y deployable por sí sola. Regla transversal: al cerrar,
`npm run build` con la tabla de rutas igual a §2 + navegación real.

- **Fase 0 — Foto inicial de consumo y rendimiento** (T0). *Sonnet `high` / Fable `low`.*
  Sin código. Da los números que activan (o descartan) T11, C1, C2 y C3.
- **Fase 1 — DB lista para volumen** (T1, T2, T3). *T1-T2: Sonnet `high` / Fable
  `medium`. T3: **Opus `xhigh` / Fable `high`** — avisar antes: reescribe políticas RLS
  (seguridad/LGPD).* El único P0 que corre contra el reloj (T1) está acá.
- **Fase 2 — Profundidad de catálogo** (T4, T5, T6). *T4: **Opus/Fable `xhigh`** —
  avisar antes: toca la máquina de caché/scroll/ISR de la ruta más usada. T5-T6: Sonnet
  `high` / Fable `low`-`medium`.*
- **Fase 3 — INP bajo interacción** (T7, T8, T9). *T7: Opus `high` / Fable `medium`;
  T8-T9: Sonnet `high` / Fable `low`.*
- **Fase 4 — Imágenes a escala** (T10, T11). *Sonnet `high` / Fable `medium` (T10),
  `low` (T11). T11 solo si la Fase 0/6 muestra >70% del cupo — decisión del usuario.*
- **Fase 5 — SW v7** (T12, opcional T13). *Opus/Fable **`xhigh`** — avisar antes.* Se
  hace en fase propia porque el SW afecta a TODO; T13 además revisita una decisión
  consciente del V2 y requiere OK explícito del usuario.
- **Fase 6 — Guardarraíl mensual de límites** (T14). *Sonnet `high` / Fable `low`.*

Orden recomendado: 0 → 1 → 2 → 3 → 4 → (5) → 6. Solo dependencia real: T7 conviene
ANTES o JUNTO a T4 (para que la paginación no agrande el costo del `persist()` por click);
si se ejecuta T4 primero, T7 pasa a obligatoria en la misma sesión.

---

## 7. Backlog de ejecución

---

### T0 — Foto inicial de consumo (activa las decisiones del resto del plan)

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**. Sin código.

**Objetivo:** capturar la línea de base de consumo real ANTES de crecer, y los datos que
deciden T11/C1/C2/C3. Complementa (no reemplaza) la V2-T14 agendada para el 2026-07-20.

**Acciones (el usuario abre los paneles; guiarlo paso a paso):**
1. Vercel → Settings/Usage: anotar del ciclo actual **Edge Requests, Fast Data Transfer,
   Image Transformations, Image Cache Reads, Function Invocations, ISR Reads/Writes** y
   sus cupos vigentes (los cupos de §3 son los publicados a 2026-07; pueden haber
   cambiado).
2. Supabase → Settings/Usage y Database: **tamaño de DB (MB), egress del mes**, y filas de
   `listing_views`, `search_queries`, `whatsapp_clicks`, `banner_clicks`
   (`select count(*)` de cada una en el SQL Editor).
3. Speed Insights: p75 de LCP/INP/CLS por ruta (`/`, `/listings`, `/listings/[id]`,
   `/store/[id]`) — de paso queda la foto para V2-T14 y el CLS 0.47 pendiente.
4. Medir el prefetch de cards (dato para C3): en Chrome DevTools (producción), abrir
   `/listings`, filtrar Network por `_rsc`, scrollear hasta el fondo: anotar **cantidad y
   kB totales** de prefetches.
5. Registrar TODO en `MEMORY.md` §21 con fecha, junto con umbrales de alerta: **70% de
   cualquier cupo = activar la tarea condicional correspondiente** (T11, C1, C2, C3).

**Qué mide:** consumo absoluto y % de cupo por recurso; kB de prefetch por scroll completo.

**Criterios de aceptación:** tabla en MEMORY.md con los 4 bloques + umbrales anotados.

**Riesgos:** ninguno.

---

### T1 — Retención de datos de tracking (la DB free no debe llenarse sola)

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que `listing_views` (y las demás tablas de tracking) dejen de crecer sin
tope. Hoy: user-agent completo por vista (`lib/tracking.ts:66` envía
`navigator.userAgent`; `fase-monetizacion-tracking.sql:36-44` lo inserta tal cual) y
**cero retención** (verificado: el cron `app/api/cron/expire-listings/route.ts` solo
purga anuncios, líneas 198-256).

**Archivos:** `supabase/fase-20-retencion-tracking.sql` (nuevo),
`frontend/app/api/cron/expire-listings/route.ts` (agregar un paso),
`frontend/lib/tracking.ts:60-69` (opcional, recorte client-side).

**Cambios:**
1. SQL nuevo (idempotente, con instrucciones para el SQL Editor):
   - `create or replace` de `track_listing_view` truncando el device:
     `left(_visitor_device, 120)` (el UA completo no se usa en ningún reporte — los RPCs
     de `fase-monetizacion-tracking.sql:157-252` solo agregan conteos).
   - Función `prune_tracking()` `security definer` que borre:
     `listing_views` > **90 días** (el único consumidor de filas crudas es
     `views_last_7d` en `get_tracking_summary`, `fase-monetizacion-tracking.sql:175` —
     el total histórico vive agregado en `listing_statistics`, que NO se toca),
     `search_queries` > **180 días** (los RPCs de fase-16 miran ≤30 días por default),
     `banner_clicks` > **180 días**. **`whatsapp_clicks` NO se poda** (es LA métrica de
     monetización y sus filas son mínimas); si algún día pesa, decidir con el usuario.
2. En el cron diario (mismo `route.ts`, después del purge de listings): llamar
   `prune_tracking()` vía el cliente service-role ya existente y loguear filas borradas.
3. Opcional barato: en `lib/tracking.ts:66`, mandar `navigator.userAgent.slice(0, 120)`
   (defensa en profundidad; el truncado real vive en la RPC).

**Qué mide:** tamaño de DB (panel Supabase) y `count(*)` de cada tabla antes/después de
la primera corrida; el log del cron con filas podadas.

**Criterios de aceptación:** el cron corre en verde con el paso nuevo; las vistas y stats
del perfil (👁️/💬, RPC `get_my_listings_stats`) y las métricas del admin siguen mostrando
los mismos números de 7 días; `listing_statistics` intacta; SQL re-ejecutable sin error.

**Riesgos:** bajo. Borrado solo de filas viejas de tablas de log; nada visible de cara al
usuario. Cuidar el orden: probar `prune_tracking()` a mano en el SQL Editor antes de
engancharla al cron.

---

### T2 — Índices parciales para las queries calientes de listas

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`-`medium`**.

**Objetivo:** que las tres formas de la query más ejecutada de la app tengan un índice
que calce exacto, para que el p95 no se mueva cuando `listings` tenga 10k+ filas (hoy
dependen de índices sueltos: `fase-4.sql:9-11`, `fase-9-indices.sql:10-21`).

**Archivos:** `supabase/fase-21-indices-escala.sql` (nuevo).

**Cambios (idempotentes):**
```sql
-- Vista default de /listings y prewarm del home (status + orden):
create index if not exists listings_active_created_idx
  on public.listings (created_at desc) where status = 'active';
-- Vista por categoría (la 2ª más común):
create index if not exists listings_active_cat_created_idx
  on public.listings (category_id, created_at desc) where status = 'active';
-- Tienda del vendedor:
create index if not exists listings_active_user_created_idx
  on public.listings (user_id, created_at desc) where status = 'active';
```
Los parciales `WHERE status='active'` son chicos (solo filas vivas) y le dan al planner
exactamente el predicado de `lib/listingsApi.ts:22-31`, `ListingsClient.tsx:300-317` y
`StoreClient.tsx:39-46`.

**Qué mide:** en el SQL Editor, `explain analyze` de las tres queries reales (status
active + orden created_at desc + limit 60; con y sin `category_id`; por `user_id`)
antes/después: debe aparecer `Index Scan ... listings_active_*` en lugar de
Sort+Seq/Bitmap. Guardar los planes en el commit message o en MEMORY.

**Criterios de aceptación:** planes usando los índices nuevos; cero cambios de
comportamiento; `fase-21` re-ejecutable.

**Riesgos:** bajo (solo agrega índices; el costo de escritura extra es irrelevante a este
volumen). Nota: NO borrar los índices viejos en esta tarea — evaluarlo recién con datos
de uso reales (pg_stat_user_indexes) en una sesión futura.

---

### T3 — RLS con initplan y scoping por rol ⚠️ ZONA DELICADA (seguridad/LGPD)

**Ejecutor:** **Opus 4.8 · `/effort xhigh`** | **Fable · `high`**. *Avisar al usuario
antes de arrancar. Volver a `/effort auto` al terminar.*

**Objetivo:** que el costo de RLS por query no crezca linealmente con las filas. Hoy
(`supabase/fase-1.sql:264-269`) el SELECT de `listings` evalúa por fila candidata:
`status='active'` OR `user_id = auth.uid()` OR `is_admin()` — y `is_admin()`
(`fase-1.sql:106-108`) es un EXISTS sobre `profiles`. El patrón recomendado por Supabase
(envolver las funciones auth en `(select ...)` para que el planner las ejecute UNA vez
como InitPlan, y restringir políticas con `to authenticated`) está ausente en todo el
esquema (mismo patrón en `listing_photos`/`listing_service_zones`,
`fase-1.sql:272-281`, y `favorites`, `fase-2.sql:77-78`).

**Archivos:** `supabase/fase-22-rls-initplan.sql` (nuevo; `drop policy` + `create policy`
por cada política reescrita).

**Cambios (el ejecutor los escribe completos; esquema del patrón):**
1. Tablas de tráfico caliente primero y ÚNICAS de esta tarea: `listings`,
   `listing_photos`, `listing_service_zones`, `favorites`.
2. Patrón por política:
   - `"Listings owner read"`: `using (user_id = (select auth.uid()))` + **`to authenticated`**
     (los anónimos dejan de evaluar esta política por completo).
   - `"Listings admin read"`: `using ((select public.is_admin()))` + `to authenticated`.
   - `"Listings public read"` queda igual (`status='active'` es una comparación barata).
   - Mismo criterio en write policies (`Listings insert/update/delete`) y en los EXISTS
     de `listing_photos`/`listing_service_zones` (dentro del EXISTS, también
     `(select auth.uid())`).
3. NO tocar `profiles_public`, ni `get_seller_whatsapp`, ni ninguna política de tablas
   admin-only (tráfico marginal): mantener el diff mínimo.

**Qué mide:** `explain analyze` (como `anon` y como usuario logueado, usando el modo
"Impersonate role" del SQL Editor de Supabase o `set local role`) de la query default de
listas antes/después: las llamadas a `auth.uid()`/`is_admin()` deben aparecer como
**InitPlan** (una vez), no en el filtro por fila.

**Criterios de aceptación (matriz de seguridad COMPLETA, obligatoria):**
- Anónimo: ve solo anuncios `active` (en `/listings`, detalle, tienda); NO ve
  paused/expired/hidden/blocked; no puede escribir.
- Dueño logueado: ve sus propios anuncios en TODOS los estados en `/profile`
  (`app/profile/page.tsx:62`); puede editar/pausar/borrar solo lo suyo; favoritos propios
  operables.
- Admin: sigue viendo todo en `/admin` → Anúncios (todos los estados).
- Publicar con fotos y zonas de atención funciona (policies de `listing_photos` y
  `listing_service_zones` con el patrón nuevo).
- `npm run build` + smoke manual de esos flujos en producción local.

**Riesgos:** **alto en consecuencia, no en probabilidad**: una política mal reescrita
puede exponer anuncios no activos (LGPD/negocio) o romper la escritura del dueño. Por eso
`xhigh`, matriz completa y diff mínimo. Mitigación: el SQL entrega también el bloque de
ROLLBACK (recrear las políticas viejas) comentado al final del archivo.

---

### T4 — "Carregar mais": paginación keyset en `/listings` ⚠️ ZONA DELICADA

**Ejecutor:** **Opus 4.8 · `/effort xhigh`** | **Fable · `xhigh`**. *Avisar al usuario
antes de arrancar: toca la máquina de caché/scroll/seed ISR de la ruta más usada
(V1-T6, V2-T10/T11). Volver a `/effort auto` al terminar.*

**Objetivo:** que el catálogo completo sea navegable sin degradar NADA de la velocidad
actual de las primeras 60 cards. Hoy el corte es invisible para el usuario
(`ListingsClient.tsx:316` `limit(60)`, `:335` `slice(0, 60)`).

**Decisiones ya tomadas (no re-litigar durante la ejecución):**
- **Botón "Carregar mais anúncios"** al final de la grilla (patrón Mercado Livre), NO
  infinite-scroll automático: más simple, no dispara red sorpresa en 4G y no complica la
  restauración de scroll.
- **Keyset, no OFFSET**: cursor = `(created_at, id)` del último item mostrado; página
  siguiente = misma query + `.lt("created_at", cursor.created_at)` (con desempate por id
  si hay timestamps iguales: usar `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")`).
  OFFSET se degrada linealmente y se desincroniza cuando entran anuncios nuevos.
- El **orden por precio sigue siendo client-side sobre lo cargado** (V1-T3): al ordenar
  por precio se reordena lo acumulado; el botón sigue trayendo por `created_at` (dejar
  un comentario en el código: es el mismo criterio parcial que usa ML).
- La **búsqueda con texto** (`?q=`) NO pagina en esta tarea (el fallback relajado de
  `ListingsClient.tsx:342-357` re-rankea client-side y no tiene keyset natural): si una
  búsqueda devuelve 60, se muestra "Refine sua busca" en lugar del botón. Paginar
  búsqueda queda para cuando los datos (fase-16) muestren que hace falta.

**Archivos:** `frontend/app/listings/ListingsClient.tsx` (estado + `fetchPage` +
botón), `frontend/lib/listingsApi.ts` (helper de query con cursor),
`frontend/lib/listingsCache.ts` (la entrada guarda items acumulados + cursor + flag
`hasMore`), `frontend/app/listings/page.tsx` (sin cambios de servidor: sigue sirviendo
la página 1 por ISR — **PROHIBIDO leer searchParams en el server**, regla V2-T11).

**Cambios:**
1. `lib/listingsApi.ts`: `fetchListingsPage({ cursor?, catId?, ... })` reutilizando
   `LISTINGS_SELECT` y el `decorate()` actual; `PAGE_SIZE = 60` exportado.
2. Vistas por categoría (dos queries primary ∪ extras, `ListingsClient.tsx:319-340`):
   aplicar el mismo cursor a ambas, fusionar, deduplicar por id **también contra los ids
   ya acumulados**, ordenar, cortar a 60. `hasMore = (primRes.length + extraRes.length)
   >= 60` (heurística: si ambas trajeron menos que la página, no hay más).
3. Estado: `listings` pasa a ser acumulado; `hasMore` y `loadingMore` nuevos; el botón
   solo aparece si `hasMore && !searchQuery`. Cargar más NO muestra spinner de página:
   deja la grilla y agrega un bloque con skeleton/`Atualizando…` local en el botón.
4. `listingsCache`: la entrada guarda `{ data (acumulado), cursor, hasMore, ts }`;
   volver del detalle restaura el acumulado + scroll (máquina actual intacta). La
   **persistencia** a `sessionStorage` guarda SOLO la primera página de cada clave
   (el acumulado puede superar el tope de 200 kB de `listingsCache.ts:39`; el resto se
   re-pide con el botón — trade-off correcto).
5. El seed ISR (`initialDefault`) sigue siendo la página 1 de la vista default: solo
   agregar `cursor`/`hasMore` derivados (`hasMore = initialDefault.length === 60`).

**Qué mide:** (a) primera carga de `/listings` idéntica a hoy (Network: misma única
query, mismo HTML ISR); (b) tocar "Carregar mais" = exactamente 1 query (o 2 en vista
categoría) con `created_at.lt`; (c) publicar un anuncio nuevo mientras se pagina NO
duplica ni saltea items (keyset lo garantiza — verificarlo a mano); (d) detalle → back
restaura acumulado + scroll.

**Criterios de aceptación:** los 4 puntos medidos + matriz de V1-T6 (back/scroll/filtros)
en verde + `npm run build` con `/listings` todavía `○` (ISR 60) + sin warnings de
hidratación. Con >60 anuncios activos reales en la vista default, el puesto 61 es
alcanzable.

**Riesgos:** medio-alto: interacción fina con `initRef`/seed/caché/scroll. Si la
consistencia seed-vs-acumulado se pone ambigua, frenar y consultar. Hacer T7 antes o en
la misma sesión (el acumulado agranda lo que `persist()` serializa por click).

---

### T5 — Límite y "ver mais" en la tienda del vendedor

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** que `/store/[id]` no traiga N anuncios sin tope
(`StoreClient.tsx:37-47`, query sin `.limit()`).

**Archivos:** `frontend/app/store/[id]/StoreClient.tsx`.

**Cambios:** `.limit(30)` + botón "Ver mais anúncios" con keyset idéntico al patrón T4
(cursor `created_at`; acá no hay extras/fusión → 1 query por página, mucho más simple).
Si T4 ya está hecho, reutilizar el helper de `listingsApi` con `user_id`.

**Qué mide:** payload de la query de tienda (Network) con un vendedor de muchos anuncios:
antes N×~0.5 kB, después ≤30 filas por página.

**Criterios de aceptación:** tienda con ≤30 anuncios idéntica a hoy (sin botón); con más,
pagina; favoritos y WhatsApp intactos; build sin cambios.

**Riesgos:** bajo.

---

### T6 — Recorte de queries repetidas en `/listings`

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** eliminar dos fuentes de queries que a escala son decenas de miles/mes sin
aportar frescura:
1. La revalidación incondicional del mount (`ListingsClient.tsx:223-247`): el efecto
   siempre dispara `fetchPage` aunque la entrada de caché tenga segundos. La vista
   default además viene de ISR 60 s — revalidar antes de 60 s no puede traer nada más
   nuevo que el propio ISR.
2. El label de subcategoría (`ListingsClient.tsx:207-211`): query por visita para un
   nombre casi estático.

**Archivos:** `frontend/app/listings/ListingsClient.tsx`,
`frontend/lib/catalogCache.ts` (extender con subcategorías).

**Cambios:**
1. En el efecto de carga: si `entry` existe y `age < 60_000` (constante
   `REVALIDATE_SKIP_MS = 60_000`, comentada: alineada al ISR de la ruta), pintar del
   caché y **no** disparar `fetchPage`. Entre 60 s y SOFT_TTL: revalidar en silencio
   (comportamiento actual). El resto de los umbrales (`listingsCache.ts:27-28`) no cambia.
   Excepción obligatoria: tras publicar/editar/borrar un anuncio propio, el flujo
   existente ya invalida por navegación nueva — verificar que publicar → volver a
   /listings muestre el anuncio en ≤60 s igual que hoy (lo garantiza el ISR; el skip usa
   la MISMA ventana).
2. `catalogCache.ts`: `loadSubcategories()` (id → name) con el mismo patrón
   módulo+`sessionStorage`+TTL 5 min de `catalogCache.ts:10-69`; `ListingsClient` lo usa
   para el label.

**Qué mide:** Network al hacer detalle→back antes de 60 s: CERO queries de `listings` (hoy
1-2); visita con `subcategory_id` repetida: cero query de `subcategories`.

**Criterios de aceptación:** medición anterior + publicar un anuncio y verlo en /listings
en ≤60 s + "Atualizando…" sigue apareciendo pasado SOFT_TTL.

**Riesgos:** bajo. No tocar la clave del caché ni el seed (zona de T4); si T4 se ejecuta
en la misma época, coordinar el merge (mismo archivo).

---

### T7 — Sacar la serialización de `sessionStorage` del camino del click

**Ejecutor:** Opus · `high` | **Fable · `medium`**. (Sonnet `high` aceptable si T4 aún no
agrandó el acumulado.)

**Objetivo:** que tocar una card no pague la serialización de hasta ~200 kB de JSON en el
main thread. Hoy: click (fase captura) → `saveScroll` → `persist()` re-serializa TODO
(`ListingsClient.tsx:422-431`, `lib/listingsCache.ts:136-139` y `:86-109`); además cada
cambio de filtro persiste vía `saveFilterUi` (`ListingsClient.tsx:182-184`,
`listingsCache.ts:151-154`).

**Archivos:** `frontend/lib/listingsCache.ts` (el grueso),
`frontend/app/listings/ListingsClient.tsx` (solo si cambia alguna firma).

**Cambios:**
1. Partir la persistencia en DOS claves de `sessionStorage`:
   `mi_listings_meta_v2` (scrolls + filterUi: diminuta, se puede escribir sync en el
   click sin costo) y `mi_listings_results_v2` (resultados: grande).
2. Los resultados se persisten **fuera del camino de interacción**: marcar dirty y
   escribir en `requestIdleCallback` (fallback `setTimeout 500ms`) + flush garantizado en
   `visibilitychange === "hidden"` y `pagehide` (los dos, por iOS). `saveScroll`/`saveFilterUi`
   escriben solo la clave meta.
3. La hidratación (`hydrateOnce`, `listingsCache.ts:52-80`) lee ambas claves; migración:
   si existe `mi_listings_cache_v1`, ignorarla (TTL corto la vuelve irrelevante) y
   borrarla.

**Qué mide:** DevTools → Performance en un Android real o CPU 6×: duración del task del
click en una card antes/después (el `JSON.stringify` de ~200 kB debe desaparecer del
trace del click); INP p75 de `/listings` en Speed Insights a los 7 días.

**Criterios de aceptación:** detalle→back con scroll restaurado intacto (matriz V1-T6);
recargar con F5 sigue pintando sin spinner (V2-T10); el trace del click ya no contiene la
serialización; quota llena sigue degradando en silencio.

**Riesgos:** medio: el flush por `pagehide` debe correr ANTES de que el navegador congele
la página (usar el evento, no `beforeunload`); probar kill/reapertura del PWA.

---

### T8 — Toggle de favorito sin re-render de las 60 cards

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** que `onToggleFavorite` sea una referencia estable. Hoy
`useCallback(..., [session, favoriteIds])` (`ListingsClient.tsx:460-488`) se recrea en
cada toggle → la prop cambia para las 60 `ListingCard` y el `memo`
(`components/ListingCard.tsx:17`) no filtra nada.

**Archivos:** `frontend/app/listings/ListingsClient.tsx` (mismo patrón aplicable en
`StoreClient.tsx:85-97` si se quiere de yapa).

**Cambios:** leer `favoriteIds`/`session` desde refs dentro del callback (o pasar por
`setFavoriteIds(prev => ...)`) y dejar `useCallback` con deps estables (`[]` o
`[session?.user?.id]`). Nada más.

**Qué mide:** React DevTools Profiler: un toggle debe re-renderizar SOLO la card tocada
(hoy: todas).

**Criterios de aceptación:** profiler con 1 card re-renderizada; favoritar/desfavoritar
sigue reflejándose en detalle/tienda (caché compartido de `favoritesCache`).

**Riesgos:** bajo.

---

### T9 — La cortina azul no debe tragarse los primeros taps

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `low`**.

**Objetivo:** que durante los ~700 ms de la cortina de entrada
(`app/globals.css:88-105`, y en Android PWA vía `html.android-pwa`, `:114`) los taps
lleguen a la app. El overlay es decorativo (`aria-hidden`), pero al ser `fixed inset:0
z-index:9999` sin `pointer-events:none`, intercepta el primer gesto del usuario apurado.

**Archivos:** `frontend/app/globals.css:88-97`.

**Cambios:** agregar `pointer-events: none;` al bloque `#browser-splash`.

**Qué mide:** con throttling CPU (para que la cortina dure visible), tap inmediato en
"Todos os anúncios" durante la cortina: la navegación debe dispararse (hoy: se pierde).

**Criterios de aceptación:** el tap temprano navega; la cortina sigue viéndose y
desvaneciéndose igual; sin cambios en standalone iOS (donde no existe).

**Riesgos:** nulo.

---

### T10 — Acotar el espacio de variantes de imagen al layout real

**Ejecutor:** Sonnet · `high` | Opus · `high` | **Fable · `medium`**.

**Objetivo:** que el optimizador no ofrezca (ni pueda generar) variantes que ningún
dispositivo de la app va a pedir. Medido hoy (§2): srcset de cards con 9 anchos hasta
**3840px** en una app `max-width: 480px` (DPR máx real ≈3 → 1440px es el techo útil).
Menos variantes = menos cupo de transformaciones consumible, menos HTML por página de
lista y menos "misses" posibles.

**Archivos:** `frontend/next.config.mjs:3-17`; auditoría de `sizes` en
`components/ListingCard.tsx:89` (`(max-width: 520px) 50vw, 240px` — correcto),
`components/BannerRotativo.tsx:93-99` (`sizes="100vw"`) y la galería del detalle
(`app/listings/[id]/ListingDetailClient.tsx`, imagen activa con `fill`).

**Cambios:**
1. En `images`: `deviceSizes: [480, 640, 828, 1080, 1440]` (cubre 100vw hasta DPR 3) y
   `imageSizes: [64, 96, 128, 256, 384]` (miniaturas 52px del perfil y thumbnails).
   Comentar por qué: layout máx 480 CSS px.
2. Verificar que el lightbox sigue usando el original de R2 crudo (decisión V1-T2:
   zoom sin recompresión) — no pasa por el optimizador, no le afecta.

**Qué mide:** `curl -s https://mercadoilha.vercel.app/listings | grep -o 'w=[0-9]*' |
sort -u` antes/después: los anchos ≥1920 desaparecen; peso del HTML de `/listings`
(hoy ~109 kB sin comprimir) baja; en el panel de Vercel, la serie de Image
Transformations del mes siguiente (comparar con la foto de T0).

**Criterios de aceptación:** cards, banner, galería y avatares visualmente idénticos en
un móvil real (DPR 3); LCP del home/detalle sin regresión en Speed Insights; build sin
cambios de rutas.

**Riesgos:** bajo. Único cuidado: las URLs `/_next/image` viejas (con `w=384` etc.)
siguen siendo válidas mientras el ancho exista en la lista nueva — 384 se mantiene vía
`imageSizes`, así que los caches de SW/navegador no se invalidan en masa.

---

### T11 — (Condicional + decisión del usuario) `formats: ['image/webp']`

**Ejecutor:** Sonnet · `high` | **Fable · `low`**. **NO ejecutar sin dos cosas:** (a) la
Fase 0/6 muestra >70% del cupo de Image Transformations, y (b) OK explícito del usuario.

**Objetivo/trade-off (presentárselo al usuario en simple):** hoy `next.config.mjs:4`
sirve AVIF (mejor compresión) + WebP como fallback → cada variante puede transformarse
dos veces. Servir solo WebP **reduce a la mitad el peor caso de cupo** a cambio de fotos
~15-25% más pesadas en bytes (velocidad levemente peor en 4G — va CONTRA el pilar, por
eso es decisión, no default).

**Archivos:** `frontend/next.config.mjs:4`.

**Qué mide:** transformaciones/mes en el panel (antes/después) y peso medio de la primera
foto del detalle en Network.

**Criterios de aceptación:** decisión registrada en MEMORY.md con los números que la
justificaron; si no se activa, cerrar como no-op.

**Riesgos:** bajo y reversible en un commit.

---

### T12 — SW v7: caché de imágenes más profundo ⚠️ toca el Service Worker

**Ejecutor:** **Opus 4.8 · `/effort xhigh`** | **Fable · `xhigh`** (regla del proyecto:
todo cambio de SW es delicado — queda cacheado en los dispositivos). *Avisar al usuario.*

**Objetivo:** que navegar el catálogo repetidamente no re-pida al edge imágenes que el
dispositivo ya bajó. Hoy `IMAGES_LIMIT = 60` (`public/sw.js:28`): una pasada por
`/listings` (60 cards) puede evacuar el caché completo; la siguiente visita re-baja todo
(latencia en 4G + edge requests contra el cupo de 1M/mes).

**Archivos:** `frontend/public/sw.js` (`:18` versión, `:27-29` límites).

**Cambios:** `CACHE_VERSION = 'v7'`; `IMAGES_LIMIT = 150` (~2–5 MB extra de storage:
aceptable). NADA MÁS en esta tarea (si T13 se aprueba, va en el mismo bump). Estrategias
por tipo (`sw.js:246-304`) intactas.

**Qué mide:** Application → Cache Storage: `mi-images-v7` llega a >60 entradas tras
navegar dos vistas; Network: segunda visita a `/listings` con mayoría de imágenes
`(ServiceWorker)`; actualización v6→v7 borra los caches `mi-*-v6`.

**Criterios de aceptación:** matriz del SW heredada (V2-T6): Supabase jamás interceptado,
`/publish|/profile|/admin` nunca de caché, offline → `offline.html`, mareas
network-first. Storage total del sitio acotado.

**Riesgos:** medio por alcance (SW global), pero el diff es de 2 constantes. El bump de
versión + `updateViaCache: "none"` (`components/RegisterSW.tsx`) propagan rápido.

---

### T13 — (Opcional, requiere OK explícito) race corto también para payloads RSC públicos

**Ejecutor:** **Opus 4.8 · `/effort xhigh`** | **Fable · `xhigh`**. En el mismo bump v7
que T12 si se aprueba. **Revisita una decisión consciente del V2-T6** (RSC network-first
puro, `public/sw.js:270-273`): NO ejecutar sin plantearle al usuario el trade-off.

**Objetivo/trade-off:** hoy toda navegación client-side (home↔listings↔detalle) espera la
red para el payload RSC aunque el contenido visible ya esté pintado por los cachés de
datos. En 4G de isla eso es ~300–800 ms por transición donde la UI "vieja" ya era
correcta. Propuesta: para rutas públicas, aplicar el MISMO patrón del V2-T6 (race
red-vs-timeout ~800 ms con revalidación atrás) a los RSC. Costo: una navegación puede
mostrar contenido de hasta unos minutos de antigüedad hasta la revalidación — el ISR de
60 s ya tolera stale similar en la apertura.

**Archivos:** `frontend/public/sw.js:270-273` (+ helpers).

**Qué mide:** con throttling Slow 3G, transición home→listings antes/después (de "espera
red" a <800 ms); publicar un anuncio y navegar: aparece tras la revalidación siguiente.

**Criterios de aceptación:** rutas privadas SIEMPRE red; matriz completa del SW; decisión
y resultado documentados en MEMORY.md.

**Riesgos:** medio-alto (frescura percibida + SW global). Si el usuario duda, no hacerla:
el beneficio es incremental, no estructural.

---

### T14 — Guardarraíl mensual de límites y rendimiento

**Ejecutor:** Sonnet · `high` | **Fable · `low`**. Proceso, sin código.

**Objetivo:** que ningún techo del free tier sorprenda. Repetir la medición de T0 una vez
por mes (o al duplicarse los usuarios) y comparar contra los umbrales.

**Acciones:** checklist en MEMORY.md §19 (o archivo propio `LIMITES_FREE_TIER.md` si
crece): fecha, % de cada cupo, p75 por ruta, filas de tracking. Regla de disparo: >70% de
un cupo activa su tarea condicional (T11 imágenes; C1/C2 abajo; C3 prefetch). La primera
corrida coincide con V2-T14 (2026-07-20) — hacerlas juntas.

**Criterios de aceptación:** tabla mensual con al menos 2 cortes registrados.

---

## 8. Contingencias — requieren decisión del usuario (NO ejecutar de oficio)

- **C1 — Miniaturas pre-generadas en el upload** (si las Image Transformations superan el
  cupo pese a T10/T11): `sharp` pasa a `dependencies` y `/api/upload`
  (`app/api/upload/route.ts:48-63`) genera junto al original una variante fija
  (p. ej. `-w640.webp`) que las cards sirven directo desde R2 sin optimizador. Elimina
  casi todo el consumo de transformaciones y mueve ese tráfico a egress gratis de R2,
  PERO: el dominio `pub-*.r2.dev` es rate-limited (Cloudflare no publica el número —
  hipótesis a testear antes), se pierde AVIF/ajuste por DPR, y hay que decidir qué hacer
  con las miles de fotos ya subidas (¿solo fotos nuevas?). Es el plan B estructural, no
  un quick win.
- **C2 — Dominio propio + CDN de Cloudflare delante de R2**: resuelve C1 "bien" y
  abarata todo, pero **cuesta plata (dominio)** → prohibido por la regla de gratuidad
  salvo decisión explícita del usuario.
- **C3 — Capar el prefetch de cards** (si T0 mide un volumen de `_rsc` alto en 4G):
  `prefetch={false}` en las cards después del índice ~8 (`components/ListingCard.tsx:51`
  vía prop nueva). Trade-off real: el primer tap a una card lejana paga 1 RTT extra que
  hoy no paga (el render optimista lo disimula, pero el CTA de WhatsApp llega después).
  Solo con datos en la mano.

---

## 9. No-tareas — sospechosos verificados en esta auditoría (no perseguir)

- **N+1 en queries:** no existe. Todas las listas embeben fotos con `limit(1)` por
  PostgREST (`app/page.tsx:18-27`, `lib/listingsApi.ts:10-11`, `StoreClient.tsx:39-46`,
  `app/favorites/page.tsx:25`, `app/profile/page.tsx:62`); el detalle es 1 query + 1
  tanda paralela (`ListingDetailClient.tsx:89-139`). Los "N+1" clásicos de marketplace ya
  fueron resueltos en V1-T5/T10 y V2-T12/T13.
- **Egress de Supabase:** estimado en 1.5–3 GB/mes a 1000+ usuarios (bajo el cupo de 5).
  T6 lo baja más. Solo monitorear (T0/T14), no optimizar a ciegas.
- **`getSupabaseAdmin` en rutas ISR:** 1 tanda de queries por revalidación (60 s), no por
  visita — el edge absorbe el tráfico. Correcto, no tocar.
- **Prefetch de `next/link` en cards:** es lo que hace instantáneo card→detalle junto a
  `listingPreview`. NO apagarlo sin la medición de T0 (ver C3).
- **Home HTML 109 kB sin comprimir** (~25 kB br medidos): contenido real (10 cards + 31
  categorías server-renderizadas). El srcset se achica con T10; nada más que hacer.
- **JS compartido 87.5 kB:** sin grasa nueva desde V2 (el mayor bloque sigue siendo el
  cliente de Supabase). No fragmentar por fragmentar.
- **`/api/mares`:** `unstable_cache` 6 h + SW network-first — escala solo.
- **Cron de expiración:** 1 corrida/día con queries acotadas — escala solo (T1 le agrega
  la poda de tracking, nada más).
- **`pub-*.r2.dev` rate limit:** mientras el 99% del tráfico de imagen pase por el
  optimizador de Vercel (caché 31 días + browser 1 año, medido §2), el origen R2 recibe
  solo misses. Vigilar 429 recién si se ejecuta C1.
- **Conexiones a Supabase:** el cliente browser usa PostgREST (HTTP, pooler) y el server
  usa fetch — no hay conexiones Postgres directas que agotar desde la app.
- **`listings_status_bumped_idx`** (`fase-17:31-32`) ya cubre el home de destacados: no
  duplicarlo en T2.
- **Índices trigram para `categories.name_norm`/`subcategories.name_norm`** (fase-19 no
  los creó): innecesarios — son tablas de ~31 y ~100 filas.
- **`maximumScale: 1` / `userScalable: false`** (`layout.tsx:12-13`): decisión de UX
  tipo-app existente; no es de rendimiento, no tocarla en este plan.

---

## 10. Resumen de ejecución

| Fase | Tareas | Sonnet/Opus | Fable 5 | Riesgo | Qué protege/gana a escala |
|---|---|---|---|---|---|
| 0 | T0 | Sonnet `high` | `low` | Nulo | Números que activan T11/C1/C2/C3 |
| 1 | T1 T2 T3 | Sonnet `high`; **Opus `xhigh` (T3)** | `medium`; **`high` (T3)** | Medio (T3 seguridad) | La DB no se llena sola; queries planas al crecer |
| 2 | T4 T5 T6 | **Opus `xhigh` (T4)**; Sonnet `high` | **`xhigh` (T4)**; `low`-`medium` | Medio-alto (T4) | Catálogo completo navegable sin perder la velocidad actual |
| 3 | T7 T8 T9 | Opus `high` (T7); Sonnet `high` | `medium` (T7); `low` | Bajo-medio | INP protegido en gama media; primer tap del arranque vivo |
| 4 | T10 T11 | Sonnet `high` | `medium`/`low` | Bajo | Cupo de imágenes ×2-3 más holgado |
| 5 | T12 (T13 opc.) | **Opus `xhigh`** | **`xhigh`** | Medio (SW) | Menos edge requests; navegación repetida más suave |
| 6 | T14 | Sonnet `high` | `low` | Nulo | Ningún techo free tier sorprende |

**Próximo paso al retomar este plan: Fase 0 (T0)** — sin código, sin esfuerzo alto; deja
la foto de consumo que el resto del plan necesita. Después, **Fase 1**, avisando
`/effort xhigh` antes de T3.
