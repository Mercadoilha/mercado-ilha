# Prompt para Opus — Fix parpadeo de imágenes + demoras en detalle y perfil

Antes de empezar: leé CLAUDE.md, MEMORY.md y manual_fable5.md del proyecto. Aplicá el
método de trabajo (verificar antes de creer, causa raíz, checklist de cierre). Mostrá un
plan breve y esperá OK antes de cambios no triviales. Respetá el pilar de velocidad:
ninguno de estos fixes debe agregar latencia a ninguna pantalla.

El dueño reportó tres síntomas que aparecieron tras la tanda de cambios reciente
(optimización V3 + rediseño de navegación 3d80e9b + contorno dorado 05aba05):

1. Al abrir la app, las imágenes del inicio "parpadean".
2. Al abrir un anuncio, la descripción tarda mucho en aparecer.
3. En el perfil, "algo de los anuncios propios" tarda mucho en llegar.

**El diagnóstico de abajo ya fue verificado contra el código y con mediciones en
producción** (la query completa del detalle responde en ~250 ms desde el servidor;
el feed de 60 anuncios en ~200-550 ms → la base de datos NO es el problema; todo lo
que sigue es del lado del cliente). Igual: re-verificá cada punto contra el código
actual antes de tocar, como manda manual_fable5.md.

---

## Problema 1 — Parpadeo de imágenes al abrir la app (inicio)

Dos causas confirmadas, ambas regresiones del rediseño de navegación (3d80e9b):

### 1a. Se perdió el `priority` de las primeras cards

El HomeClient viejo pasaba `priority={i < 4}` a las primeras 4 cards (fix de LCP de la
Fase 1 del plan V1, commit fd32be8). El componente compartido nuevo
`frontend/components/ListingsFeed.tsx` **no pasa `priority` a ninguna card** (verificá:
`grep priority frontend/components/ListingsFeed.tsx` no devuelve nada). Sin `priority`,
`next/image` marca todas las imágenes `loading="lazy"`: al abrir la app los tiles
aparecen vacíos y las fotos van "cayendo" después de la hidratación → parpadeo.

**Fix:** en el `.map()` de `sortedListings` (≈ línea 603), agregar el índice y pasar
`priority={i < 4}` a `ListingCard`. `ListingCard` ya acepta y cablea la prop a
`next/image` (línea 109 de `frontend/components/ListingCard.tsx`) — no hay que tocar
la card. Esto beneficia al inicio y también a /listings (ambos usan ListingsFeed).
No subir de 4: `priority` genera preload y más de ~4 preloads compite con el resto
de la carga.

### 1b. El indicador "Atualizando…" empuja el grid (layout shift en cada apertura)

En `ListingsFeed.tsx` (≈ línea 580), cuando el feed revalida con datos en pantalla se
inserta un `<div>` con "Atualizando…" **entre la fila Ordenar/Filtrar y el grid**, y se
quita al terminar. Como el caché casi siempre tiene más de 60 s al abrir la app
(REVALIDATE_SKIP_MS), esto pasa en casi todas las aperturas: el grid entero salta hacia
abajo y vuelve a subir → las imágenes "parpadean". Notar que la fila Ordenar/Filtrar
tiene `minHeight: 52` justamente para no causar saltos — el mismo cuidado le faltó al
indicador.

**Fix:** que "Atualizando…" no ocupe altura nueva. Opción recomendada: moverlo ADENTRO
de la fila Ordenar/Filtrar existente (tiene `justifyContent: "flex-end"` y
`minHeight: 52`): renderizarlo como primer hijo con `marginRight: "auto"`, mismo estilo
sutil (fontSize 0.72rem, color muted). Así aparece/desaparece sin mover un solo pixel
del grid. Cualquier alternativa vale mientras el grid NO se desplace (p. ej. overlay
absoluto), pero NO reservar una franja vacía permanente arriba del grid.

### Nota sobre la tercera causa (no accionable)

Cuando llega la revalidación, el orden puede cambiar (orden por `bumped_at`: si alguien
destacó un anuncio, sube al tope). Ese reacomodo es contenido fresco legítimo y NO hay
que "arreglarlo" (no congelar el feed, no saltear la revalidación). Con 1a y 1b
resueltos deja de percibirse como parpadeo.

---

## Problema 2 — La descripción del anuncio tarda en aparecer

**Causa (verificada):** la query completa del detalle es rápida (~250 ms medida en
producción), pero arranca TARDE. La cadena al tocar una card es serial:

    tap → payload RSC de /listings/[id] (network-first en el SW, no se cachea)
        → monta ListingDetailClient → recién ahí dispara la query de Supabase
        → llega la descripción

En el 4G de la isla son 2-3 viajes de red encadenados → 1.5-2.5 s de esqueleto. El
render optimista (T9) ya pinta título/precio/primera foto al instante desde
`lib/listingPreview.ts`; lo que falta es que los datos completos AVANCEN EN PARALELO
con la navegación en vez de esperarla.

**Fix — prefetch del detalle al tocar la card** (mismo espíritu que `prewarmProfile`,
patrón ya aprobado en el proyecto):

1. Extraer el select de la query completa del detalle
   (`ListingDetailClient.tsx` ≈ líneas 89-101) a una constante exportada compartida
   (p. ej. `LISTING_DETAIL_SELECT` en `frontend/lib/listingsApi.ts`), para que el
   prefetch y el detalle usen EXACTAMENTE la misma query (cero drift, mismo patrón que
   `LISTINGS_SELECT`).
2. Crear un módulo chico (p. ej. `frontend/lib/listingDetailPrefetch.ts`): un
   `Map<number, { promise, ts }>` con tope (~10 entradas) y TTL corto (~30 s), con
   `prefetchListingDetail(id)` (fire-and-forget, deduplicado) y
   `takeListingDetailPrefetch(id)` que devuelve la promesa si existe y está fresca.
3. En `ListingCard.tsx`, dentro del `onClick` del Link (donde ya se llama
   `setListingPreview`), llamar también `prefetchListingDetail(listing.id)`. Lanzar un
   fetch async es barato — pero cuidado con la lección de T7 (V3): NADA síncrono pesado
   en el camino del click.
4. En `ListingDetailClient.load()`: consumir la promesa prefetcheada si existe; si no
   hay o falló, ejecutar la query como hoy (fallback intacto). El resto del flujo
   (tracking de vista, queries secundarias de vendedor/subzona/zonas, teléfono) no
   cambia.

Con esto la query de datos viaja en paralelo con la navegación: al montar el detalle,
la respuesta ya llegó o está por llegar → la descripción (y las fotos 2..N) aparecen
al toque. Al poner el prefetch en `ListingCard` queda cubierto el inicio, /listings,
la loja del vendedor y favoritos (todos usan la misma card).

**NO hacer:** volver a meter `description` en `LISTINGS_SELECT` (engordaría el payload
de las listas; se recortó a propósito en el plan V2). El prefetch da el mismo resultado
sin costo de payload.

---

## Problema 3 — En el perfil, los anuncios propios "tardan en llegar"

**Causa (verificada):** `prewarmProfile` en `frontend/lib/profileCache.ts` precalienta
el perfil al abrir la app, pero su select quedó desactualizado: las miniaturas de foto
en "Meus anúncios" se agregaron el 2026-07-06 (commit e7e47b3) y el prewarm **no trae
`listing_photos` ni `categories(is_product)`**. Resultado: al entrar al perfil se pinta
al instante desde el caché… pero sin fotos (placeholder 🛍️) y sin botón "Vendido", y
todo eso "llega tarde" cuando responde la query completa de la página.

**Fix:** alinear el select del prewarm con el de la página
(`frontend/app/profile/page.tsx` ≈ líneas 84-88). El prewarm debe pedir:

    id, title, price, price_text, status, created_at, expires_at, bumped_at,
    categories(is_product), listing_photos(photo_url, sort_order)

con `.order("sort_order", { referencedTable: "listing_photos" })` y
`.limit(1, { referencedTable: "listing_photos" })` — igual que la página (1 foto por
anuncio: costo extra despreciable).

**Opcional (solo si no complica):** los contadores 👁️/💬 también llegan tarde (el RPC
`get_my_listings_stats` corre recién al entrar a la página; los números saltan de 0 al
valor real). Se puede sumar el RPC al prewarm y cachear el `statsMap` en
`CachedProfile`. Es UNA llamada liviana más por apertura de app de usuario logueado;
si se decide que no vale la pena, dejarlo como está y decirlo en el cierre.

---

## Límites innegociables

- NO tocar: el service worker (`public/sw.js`), `next.config.mjs` (imágenes), las
  políticas RLS, la paginación keyset, ni la lógica de revalidación/TTL de
  `listingsCache.ts`.
- NO agregar queries a la carga inicial de ninguna pantalla (el prefetch del detalle
  solo se dispara con un tap del usuario; el prewarm del perfil ya existía, solo se
  alinea su select — la excepción opcional es el RPC de stats, que es decisión
  explícita del punto 3).
- NO deshacer optimizaciones de V1/V2/V3 (payloads recortados, ISR, SWR, T7).
- Cambios de UI: ninguno visible salvo la reubicación sutil de "Atualizando…".

## Checklist de cierre (obligatorio)

1. `npm run build` sin errores; las rutas mantienen su tipo (`/` y `/listings` siguen
   ISR/estáticas como antes; `/listings/[id]` sigue siendo shell estático).
2. Inicio: las 4 primeras imágenes cargan de inmediato (ver `fetchpriority="high"` /
   preload en el HTML); "Atualizando…" aparece y desaparece SIN mover el grid (probar
   con caché >3 min de viejo para forzar el indicador).
3. Detalle: navegando desde una card, la descripción aparece de inmediato o casi (en
   dev tools, verificar que la query a Supabase parte ANTES del payload RSC de la
   navegación, no después). Deep link / F5 al detalle sigue funcionando (sin preview ni
   prefetch → spinner → datos, como hoy).
4. Perfil: entrando con la app ya abierta (prewarm hecho), las miniaturas se ven al
   instante, sin pop-in posterior.
5. Favoritos, loja del vendedor y /listings: sin regresiones al abrir un anuncio desde
   ahí (usan la misma card → mismo prefetch).
6. Probar la navegación real (localhost) antes de dar por cerrado, y listar qué probar
   en producción para el dueño en lenguaje simple.
