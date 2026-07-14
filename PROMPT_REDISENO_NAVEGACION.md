# Prompt para Opus — Rediseño de navegación estilo Mercado Livre

Antes de empezar: leé `CLAUDE.md`, `MEMORY.md` y `manual_fable5.md` del proyecto. Aplicá el
método de trabajo (verificar antes de creer, causa raíz, checklist de cierre). Mostrá un
plan breve y esperá OK antes de arrancar. Respetá el **pilar de velocidad** en cada paso:
ninguna ruta puede perder su condición `○ Static`/ISR y ninguna interacción puede sentirse
más lenta que hoy.

El dueño quiere reorganizar la app al estilo Mercado Livre: el inicio pasa a ser la lista
de todos los anuncios, las categorías y la información útil se mudan a pantallas propias
accesibles desde la barra inferior, y los filtros/orden pasan a botones desplegables.
Todas las decisiones de producto de abajo **ya están tomadas por el dueño** — no
re-preguntarlas. Si aparece un problema técnico real que obligue a cambiar algo de esto,
frenar y preguntar en lenguaje simple.

---

## Reforma 1 — El inicio (`/`) pasa a ser el feed de todos los anuncios

**Estructura de la nueva pantalla, de arriba a abajo:**

1. Header azul actual: logo + botón "Compartilhar" + barra de búsqueda (`BuscaAutocomplete`).
   Se mantiene tal cual.
2. `BannerRotativo` position `home`. Se mantiene tal cual.
3. Fila con dos botones: **"Ordenar"** y **"Filtrar"** (Reformas 2 y 3).
4. Grid de **todos los anuncios activos** (`.listing-grid`, `ListingCard` con corazón de
   favoritos igual que en `/listings`), paginado con botón **"Ver mais anúncios"**.
5. `InstallInvitePopup` se mantiene en el inicio.

**Desaparecen del inicio:** los 3 botones de acceso rápido (Todos / Categoria / Info útil),
la sección "Anúncios destacados" como bloque separado, los bloques de categorías
(Bloque 1 y Bloque 2), la sección "Informação útil" (marés + barcos), la franja
`InstallSigninStrip` y la tarjeta "Fale conosco". Las categorías se mudan a `/categorias`
(Reforma 5); los widgets, la franja de instalar y Fale conosco se mudan a `/informacao`
(Reforma 6). Decisión del dueño: el inicio queda solo con búsqueda, banner y anuncios.

**Orden del feed (default):** `bumped_at desc, id desc` — es decir, fecha de publicación
o de destaque, lo más nuevo arriba. Datos verificados en el código/DB:
- `listings.bumped_at` existe (fase-17), `not null default now()` → un anuncio recién
  publicado entra automáticamente arriba del feed, y "Destacar" (⭐ del perfil, RPC
  `bump_listing`) lo re-sube. No hay que tocar el flujo de publicar.
- Ya existe el índice `(status, bumped_at desc)` (fase-17). Verificá con un EXPLAIN (o
  razonamiento sobre el plan) que alcanza para el keyset por `(bumped_at, id)`; si hiciera
  falta otro índice, generá `supabase/fase-26-feed-inicio.sql` idempotente con
  instrucciones claras para el SQL Editor (el dueño no es técnico).

**Paginación:** mismo patrón keyset de `/listings` (`lib/listingsApi.ts`:
`cursorFromLast`/`applyKeysetCursor`, `PAGE_SIZE`), pero con cursor por
`(bumped_at, id)` en vez de `(created_at, id)`. Generalizar los helpers, no duplicarlos.

**Arquitectura obligatoria (pilar de velocidad):**
- `app/page.tsx` sigue siendo Server Component con `revalidate = 60` que trae la primera
  página del feed (con `LISTINGS_SELECT`), los banners, el WhatsApp del admin y la
  cantidad de destacados (Reforma 4), y se los pasa a un client component. Mismo patrón
  T11 ya probado en `/listings`: las cards de la primera página viajan en el primer HTML
  (fallback del Suspense con el mismo markup, sin layout shift al hidratar).
- Caché de sesión + restauración de scroll: reusar `lib/listingsCache.ts` con una clave
  propia del feed del inicio (que no colisione con las claves de `/listings`). Volver del
  detalle al inicio debe pintar la lista al instante con el scroll restaurado, igual que
  hoy en `/listings`.
- **No duplicar las ~800 líneas de `ListingsClient.tsx`.** El feed del inicio y `/listings`
  comparten casi toda la maquinaria (caché, scroll, favoritos, paginación, orden
  client-side, filtros). Extraé la lógica compartida (hooks/componentes en `lib/` o
  `components/`) o generalizá `ListingsClient` para aceptar modo de orden y los ids
  destacados. Decidí la estructura más limpia leyendo el código real; el criterio es
  cero drift entre las dos pantallas.
- El prewarm del listado default de `/listings` que hoy hace `HomeClient` en idle queda
  obsoleto (esa entrada prominente ya no existe): eliminalo, verificando que nada más
  dependa de él.

## Reforma 2 — Botón "Ordenar" (desplegable)

Reemplaza la fila de pills de orden actual (tanto en el inicio como en `/listings`).

- Botón píldora "Ordenar" (con caret ▾). Al tocarlo se abre una **hoja que sube desde
  abajo** (bottom sheet), mismo patrón visual y de animación que `ShareAppModal.tsx`
  (overlay oscuro, hoja blanca con grabber, `.share-sheet-rise` de `globals.css:254`,
  cierre por tap afuera / X / Escape). Cargarla con `next/dynamic` para que no pese en la
  carga inicial.
- Opciones (radio, se aplica y cierra al tocar una):
  1. **Mais recentes** — orden default (en el inicio: `bumped_at`; en `/listings`:
     `created_at`, como hoy).
  2. **Menor preço**
  3. **Maior preço**
- **Regla explícita del dueño:** en ambos órdenes por precio, los anuncios **sin precio
  van primeros**. Ojo: el `useMemo` actual de `ListingsClient` pone los nulls al FINAL —
  hay que invertir esa regla.
- El orden sigue siendo 100% client-side (sin red), como hoy.
- El botón muestra la opción activa cuando no es la default (ej. "Ordenar: Menor preço").

## Reforma 3 — Botón "Filtrar" (hoja con zonas y sub-zonas)

Reemplaza la fila de pills de zona actual. Hoy solo se filtra por localidad (una sola);
pasa a ser **multi-selección de localidades y sub-zonas con casillas**.

- Misma hoja desde abajo que Ordenar (patrón `ShareAppModal`), con:
  - Las 4 localidades como grupos, cada una con checkbox propio ("toda la localidad") y
    sus sub-zonas anidadas con checkbox individual (las sub-zonas "Outros" aparecen como
    una opción más — son sub-zonas oficiales en DB).
  - Sección **"Condição"** (Todos / Novo / Seminovo / Usado) SOLO cuando la vista es la
    categoría `produtos` (hoy esa fila de pills existe en `/listings?category=produtos`;
    se muda adentro de la hoja).
  - Botones **"Limpar"** y **"Aplicar"**. Aplicar cierra la hoja y dispara la consulta.
- El botón "Filtrar" muestra un contador de filtros activos (ej. "Filtrar (3)").
- El catálogo de sub-zonas se carga recién al abrir la hoja por primera vez (query a
  `subzones` o extensión de `lib/catalogCache.ts`, que hoy no las cachea) — nunca en el
  camino crítico de la página.
- **Lógica de filtrado** (extiende el `zoneOr` actual de `ListingsClient`, que ya maneja
  el caso de una localidad): un anuncio entra si cumple alguna de:
  - `locality_id` en las localidades marcadas enteras;
  - `subzone_id` en las sub-zonas marcadas;
  - `covers_all_island = true` (siempre entra, atiende toda la ilha);
  - tiene filas en `listing_service_zones` cuya sub-zona esté marcada o pertenezca a una
    localidad marcada entera (reusar el patrón actual: query previa a
    `listing_service_zones` para juntar ids, después `id.in.(...)`).
- El estado de filtros se persiste con `saveFilterUi`/caché por clave como hoy (volver del
  detalle no pierde la selección). La clave del caché de resultados debe incorporar la
  nueva selección multi-zona.

## Reforma 4 — Recuadro dorado para los destacados del inicio

- Los **primeros N anuncios del feed default del inicio** (orden `bumped_at`) llevan un
  contorno **dorado, fino y elegante** que los distingue del resto. N es configurable
  desde `/admin` → tab Config (nueva key `featured_count` en `admin_settings`, default 10
  si no existe — el tab la crea/actualiza al guardar, sin SQL manual).
- Implementación: el server (`app/page.tsx`) marca los ids de los primeros N del feed
  default y esa marca viaja con cada anuncio (prop en `ListingCard`). Así, si el usuario
  reordena por precio o aplica filtros, **el contorno acompaña al anuncio** donde quede.
  En las páginas siguientes de "Ver mais" no se marcan nuevos destacados. Cuando un
  anuncio sale del top N (porque publicaron/destacaron otros), pierde el contorno de
  forma natural en el próximo render (ISR 60s) — exactamente el comportamiento que pidió
  el dueño.
- Diseño: borde fino (1.5–2px) en un dorado sobrio que combine con la paleta (la marca ya
  usa `--sand #EF9F27`; buscá un dorado más fino/elegante, no chillón; puede llevar un
  brillo muy sutil). ⚠️ Las cards del `.listing-grid` van edge-to-edge sin borde propio,
  separadas por líneas divisorias: el contorno debe dibujarse **sin mover el layout**
  (ej. `box-shadow` inset o `outline` con offset negativo), sin romper las líneas
  divisorias ni desalinear las filas. Sin etiqueta de texto: solo el recuadro.

## Reforma 5 — Pantalla `/categorias` (nueva)

- Entrada: pestaña "Categorias" de la barra inferior (Reforma 7).
- Estructura: header azul con título "Categorias" y la barra de búsqueda
  (`BuscaAutocomplete`) → `BannerRotativo` position `home` → **Categorias Destacadas**
  (Bloque 1) → **secciones temáticas** (Bloque 2), tal como existen hoy en el inicio.
  Termina donde hoy empieza "Informação útil".
- Mover el markup/lógica de los dos bloques desde `HomeClient.tsx` a un componente
  compartido (ej. `components/CategoriesBlocks.tsx`) — no duplicar. Conservar
  `LONG_NAME_SLUGS`, `categoryHref()` (con y sin subcategorías) y los estilos actuales.
- Server Component con ISR (revalidate 60, mismo patrón del inicio). ⚠️ El admin llama
  `/api/revalidate` al editar categorías para refrescar la home: extendé esa revalidación
  para que cubra también `/categorias` (si no, el admin vería categorías viejas hasta el
  próximo ciclo).

## Reforma 6 — Pantalla `/informacao` (nueva)

- Entrada: pestaña "Informação" de la barra inferior.
- Estructura: header azul con título "Informação útil" → `MaresWidget` + `BarcosWidget`
  (cargan post-render como hoy; si fallan, la página no se rompe) → `InstallSigninStrip`
  → tarjeta "Fale conosco" (WhatsApp del admin, con su tracking actual). Decisión del
  dueño: la franja de instalar y Fale conosco viven acá ahora, no en el inicio.
- Ruta estática (`○`); los widgets no deben convertirla en dinámica.

## Reforma 7 — Barra inferior nueva (`BottomNav.tsx`)

Queda **igual para todos**, con o sin sesión (decisión del dueño):

| Posición | Hoy | Nueva |
|---|---|---|
| 1 | 🏠 Início (`/`) | 🏠 Início (`/`) — sin cambio |
| 2 | 🔍 Anúncios (`/listings`) | Categorias (`/categorias`) |
| 3 | ➕ Publicar | ➕ Publicar — sin cambio |
| 4 | ❤️ Favoritos (con sesión) / atajo Comida (sin sesión) | Informação (`/informacao`) |
| 5 | 👤 Perfil / 🔑 Entrar | 👤 Perfil / 🔑 Entrar — sin cambio |

- Elegí íconos coherentes con los actuales para Categorias e Informação (emoji, mismo
  tamaño y estados activos que hoy).
- El atajo configurable "Comida" (`navCustom1`) desaparece de la barra. Retirá también el
  campo del tab Config del admin que lo edita (quedaría sin efecto y confundiría al
  dueño); dejá `getAdminSettings` limpio de lo que ya no se use.
- `/favorites` sigue existiendo; su acceso pasa al perfil (Reforma 8).

## Reforma 8 — Favoritos desde el perfil

En `/profile` (zona del botón "Compartilhar minha loja", ~línea 380–405 de
`app/profile/page.tsx`): pasar a **dos botones lado a lado** con el mismo estilo outline
azul actual — "Compartilhar minha loja" y "❤️ Favoritos" (link a `/favorites`). Grid de
2 columnas, misma altura; cuidar que los textos no desborden en 360px de ancho.

## Reforma 9 — Pantalla de resultados de búsqueda

En `/listings?q=...`:
- El header pasa a ser: **flecha para volver + la barra de búsqueda** con el término
  buscado ya escrito y editable (hoy el header muestra el término como título).
  `BuscaAutocomplete` necesita aceptar un valor inicial; buscar de nuevo desde ahí
  reemplaza los resultados en la misma pantalla.
- **Eliminar el chip naranja** 🔍 con el término buscado (el `badge badge-sand` de
  "Filtros activos" en `ListingsClient.tsx`) — pedido explícito del dueño.
- Los botones Ordenar/Filtrar siguen disponibles en los resultados.
- Las vistas por categoría (`/listings?category=...`) mantienen su header actual con
  título; solo cambian sus filas de pills por los botones Ordenar/Filtrar (Reformas 2-3).

---

## Requisitos transversales

1. **Velocidad (no negociable):** `npm run build` al cerrar cada reforma — `/` sigue ISR,
   `/listings` sigue `○ Static`, `/categorias` e `/informacao` nacen estáticas/ISR,
   ninguna ruta existente se degrada a `ƒ`. Las hojas (Ordenar/Filtrar/…) se cargan con
   `next/dynamic`. Cero waterfalls nuevos (`Promise.all` donde haya fetches hermanos).
   Nada de saltos de layout: la fila de botones y el grid reservan su altura.
2. **UI en portugués brasileño**; código con el estilo del proyecto (CSS inline con
   variables, sin Tailwind, mobile-first 480px).
3. **SQL:** si algo requiere correr SQL (índice nuevo, etc.), entregar archivo
   `supabase/fase-XX-*.sql` idempotente + instrucciones paso a paso para el SQL Editor de
   Supabase, en lenguaje simple.
4. **Verificación end-to-end antes de cerrar** (checklist de `manual_fable5.md`):
   - Abrir el inicio: banner + búsqueda + feed con los N destacados en dorado arriba.
   - Ordenar por menor/maior preço: sin precio primeros; el dorado acompaña a los
     destacados en su nueva posición.
   - Filtrar por 2 localidades + 1 sub-zona suelta: resultados correctos (incluye
     anuncios "toda a ilha" y los de zonas de atención que matcheen); contador en el
     botón; volver del detalle conserva filtros y scroll.
   - "Ver mais" pagina sin repetir ni saltear anuncios (keyset por bump).
   - Buscar algo, editar el término en la barra de resultados y re-buscar; sin chip
     naranja.
   - Las 5 pestañas de la barra navegan bien con y sin sesión; Favoritos accesible desde
     el perfil.
   - `/categorias` muestra los dos bloques; editar una categoría en `/admin` se refleja.
   - `/informacao` muestra marés, barcos, franja instalar y Fale conosco.
   - Cambiar `featured_count` en `/admin` → Config cambia la cantidad de dorados.
5. **Al terminar:** síntesis breve NO técnica para el dueño (qué cambió y qué probar,
   sin nombres de archivos ni funciones), y dejar los cambios sin deployar hasta su OK.
