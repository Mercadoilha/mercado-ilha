# PROMPT — Favoritos en el home + Directorio de Lojas

> **Cómo usar**: abrir una sesión nueva de Claude Code (Opus) en la raíz del proyecto y
> pegar: *"Lee PROMPT_LOJAS_FAVORITOS.md y ejecutalo paso a paso"*.

---

## Contexto obligatorio antes de empezar

1. Leer `MEMORY.md` y `CLAUDE.md` (raíz del proyecto) y `manual_fable5.md`. Respetar
   el **pilar de velocidad de navegación**: nada de lo que se agregue puede hacer más
   lenta la carga del home ni la transición entre pantallas.
2. El usuario **no es técnico**: comunicarse en español simple, sin nombres de archivos
   ni funciones. Si hace falta correr SQL en Supabase, darle instrucciones exactas y
   simples para el SQL Editor.
3. UI siempre en **portugués brasileño**. Mobile-first (max-width 480px). Paleta:
   `#185FA5` primario, `#EF9F27` acento, variables CSS en `globals.css`.
4. Antes de tocar código: mostrar un plan breve y esperar OK del usuario.

---

## Objetivo general

1. **Mover el botón Favoritos**: sacarlo de su lugar actual (pantalla de perfil) y
   ponerlo en el **home**, en la misma fila donde hoy están "Ordenar" y "Filtrar"
   (esos dos quedan donde están).
2. **Agregar en esa misma fila un botón "Lojas"** que abre una pantalla nueva con el
   listado de todas las tiendas (lojas) de los usuarios, ordenadas por cantidad de
   anuncios activos (de mayor a menor).
3. Dentro de esa pantalla nueva: **barra de búsqueda** por nombre de tienda **con
   sugerencias mientras se escribe** (mismo comportamiento que la barra de búsqueda
   de productos del home), botón **Filtrar** por lugar y botón **Ordenar** (por
   cantidad de productos o alfabético).

---

## Mapa del código (verificar antes de creer — puede haber cambiado)

- Botón Favoritos actual: `frontend/app/profile/page.tsx` (~línea 413). Está en una
  grilla de 3 botones: "Minha loja / Compartilhar / Favoritos".
- Fila Ordenar/Filtrar del home: la renderiza `frontend/components/ListingsFeed.tsx`
  (~línea 560, fila de pills alineadas a la derecha, estilo `pillBtn`).
  ⚠️ **`ListingsFeed` es compartido**: lo usan el home (`HomeClient.tsx`, namespace
  `"home:"`), las páginas de categoría y `/listings`. Los botones nuevos
  (Favoritos y Lojas) deben aparecer **solo en el home**, no en las demás pantallas.
- Página de tienda existente: `/store/[id]` (`frontend/app/store/[id]/` — shell
  estático + client). Los datos públicos del vendedor salen de la **vista
  `profiles_public`** (`id, full_name, avatar_url, created_at`) — creada en
  `supabase/security-fix-profiles.sql`. La tabla `profiles` NO es de lectura pública.
- Página de favoritos existente: `/favorites` (`frontend/app/favorites/page.tsx`).
  Requiere sesión; mantener su comportamiento actual para usuarios no logueados.
- Autocomplete del buscador de productos: `frontend/components/BuscaAutocomplete.tsx`
  (dropdown de sugerencias mientras se escribe, normalización sin acentos con
  `lib/searchNorm` — `fold`/`foldWords` —, caché en memoria + sessionStorage, debounce,
  AbortSignal). Es el **patrón de referencia** para las sugerencias del buscador de
  lojas del Paso 3.
- Botões de acesso rápido del home: hoy son 3 (Todos / Categoria / Info útil) —
  buscarlos en `HomeClient.tsx`/componentes del home (MEMORY.md §6, commit a715b8b).
- Último SQL numerado: `fase-25`. El SQL nuevo de esta tarea es **`fase-26`**.

---

## PASO 1 — Mover el botón Favoritos al home

1. En `frontend/app/profile/page.tsx`: quitar el botón "❤️ Favoritos" de la grilla de
   3 botones y dejar la grilla en **2 columnas** ("Minha loja" y "Compartilhar" lado a
   lado, mismo estilo actual).
2. En la fila Ordenar/Filtrar del home agregar el pill **"❤️ Favoritos"** que navega a
   `/favorites`.
   - Implementación sugerida: prop opcional en `ListingsFeed` (ej. `homeExtras` o un
     slot `leftActions`) que el home activa y las demás páginas no. No duplicar la fila.
   - Layout de la fila en el home: pills nuevos a la **izquierda** ("Lojas" y
     "Favoritos"), "Ordenar" y "Filtrar" a la **derecha** (cambiar el
     `justify-content` de `flex-end` a `space-between` solo cuando hay extras).
     Mismo estilo visual `pillBtn` para los 4. Deben entrar los 4 en 480px sin que
     el texto se corte; si hace falta, achicar padding/fuente de los pills.
   - La fila ya reserva altura (`minHeight: 52`) para evitar saltos de layout:
     conservar eso.
3. Usuario sin sesión que toca Favoritos: debe pasar lo mismo que hoy al entrar a
   `/favorites` sin sesión (no romper ni dejar pantalla vacía sin mensaje).
4. **Contador en el pill Favoritos** para usuarios logueados (ej. "❤️ 3"):
   - Leer la cantidad de la fuente de favoritos que ya existe (caché/estado client-side);
     **jamás** una consulta extra que bloquee o retrase el render del home.
   - Si no hay sesión o el dato aún no llegó: mostrar el pill sin número
     ("❤️ Favoritos"). El número aparece cuando está disponible, sin salto de layout
     notorio.

## PASO 2 — SQL: directorio de lojas (fase-26)

Crear `supabase/fase-26-lojas-directory.sql` con una **RPC `get_stores`** (o vista +
RPC) que devuelva, en **una sola consulta** (sin N+1), las tiendas para el directorio:

- Campos por tienda: `id`, `full_name`, `avatar_url`, cantidad de **anuncios activos**
  (`listings.status = 'active'` — verificar el nombre real del status en la DB/MEMORY.md),
  y las **localidades** donde tiene anuncios activos (para el filtro por lugar).
- Solo tiendas con **al menos 1 anuncio activo** (una tienda vacía es un callejón sin
  salida para el comprador).
- Parámetros: búsqueda por nombre (insensible a mayúsculas y acentos — `ilike` +
  `unaccent` si la extensión está disponible; si no, `ilike` solo), filtro por
  `locality_id` (opcional), orden (`'count'` desc | `'name'` asc | `'popular'`) y
  paginación (`limit`/`offset`, página de ~20).
- **Orden `'popular'` (mais procuradas)**: cantidad de contactos por WhatsApp que
  recibieron los anuncios de la tienda en los **últimos 30 días** (tabla
  `whatsapp_clicks`, join por `listing_id` → `listings.user_id`; ventana de 30 días
  para que el ranking refleje la actividad actual y las tiendas nuevas tengan chance).
  Desempate: cantidad de anuncios activos. Calcularlo dentro de la misma consulta de
  la RPC (agregado, sin N+1; apoyarse en el índice existente de `clicked_at`).
  ⚠️ `whatsapp_clicks` tiene RLS solo-admin: la RPC (security definer) debe exponer
  únicamente el **conteo agregado** por tienda — jamás filas, visitantes ni fechas.
- Seguridad: la RPC debe exponer **solo datos públicos** (los mismos de
  `profiles_public`; jamás `whatsapp` ni `role`). `security definer` con
  `set search_path = public`, y `grant execute` a `anon` y `authenticated`
  (el directorio es público, igual que el resto de la navegación).
- Al terminar, darle al usuario el SQL con instrucciones simples para pegarlo en el
  SQL Editor de Supabase, y **verificar** después que la RPC responde.

## PASO 3 — Pantalla nueva `/lojas`

1. Crear la ruta `frontend/app/lojas/` siguiendo el patrón de `/store/[id]`:
   **shell estático** + componente cliente que trae los datos (o Server Component con
   ISR si encaja mejor — decidir con el pilar de velocidad en mano y verificar en el
   build que la ruta quede `○ Static`/ISR, nunca `ƒ` dynamic).
2. Contenido:
   - Header con botón **← voltar** (patrón `router.back()` ya usado en el proyecto)
     y título tipo **"Lojas da ilha"**.
   - **Barra de busca** arriba: placeholder tipo `Buscar loja pelo nome…`, filtra
     llamando a la RPC (con debounce ~300ms para no disparar una consulta por tecla).
   - **Sugerencias mientras se escribe** (igual que el buscador de productos del home):
     al tipear se abre un dropdown con los nombres de tiendas que coinciden, para que
     quien no recuerda el nombre exacto lo encuentre igual.
     - Seguir el patrón de `BuscaAutocomplete.tsx`: normalización sin acentos
       (`lib/searchNorm`), debounce, caché de sugerencias repetidas, cancelación de
       consultas viejas (AbortSignal). Adaptarlo, no duplicar lógica que se pueda
       compartir.
     - Tocar una sugerencia navega **directo a esa loja** (`/store/[id]`).
     - Enter / botón buscar (sin elegir sugerencia) filtra la lista de abajo con el
       texto escrito.
     - Máximo ~6 sugerencias, dropdown que no tape toda la pantalla, cerrar al tocar
       afuera — mismo comportamiento que ya tiene el buscador de productos.
   - Fila de pills **"Ordenar ▾"** y **"Filtrar ▾"**, mismo estilo y mismos
     componentes de hoja (`OrdenarSheet`/`FiltrarSheet`/`BottomSheet`) que ya existen —
     reutilizar el patrón, no inventar uno nuevo.
     - **Ordenar**: "Mais anúncios" (default) | "Mais procuradas" | "Nome (A–Z)".
       "Mais procuradas" usa el orden `'popular'` de la RPC (contactos por WhatsApp
       de los últimos 30 días).
     - **Filtrar**: por lugar (localidades; una tienda aparece si tiene al menos un
       anuncio activo en el lugar elegido). Reutilizar la fuente de localidades que ya
       usa la hoja Filtrar del feed.
   - **Lista de tiendas**: cards de ancho completo (avatar redondo — o placeholder 🏪
     si no tiene foto —, nombre, y "X anúncios" / "1 anúncio"). Toda la card navega a
     `/store/[id]`. Usar `next/image` para los avatares.
   - **Lugares en cada card**: chips chicos con las localidades donde la tienda tiene
     anuncios activos (la RPC del Paso 2 ya devuelve ese dato — no hacer consultas
     extra por card). Si son muchas, mostrar 2-3 y "+N". Estilo discreto, que no
     compita con el nombre.
   - Paginación con botón **"Ver mais"** (mismo patrón del feed del home).
   - Estado vacío amigable (ej. "Nenhuma loja encontrada 🔦") para búsquedas sin
     resultado.
3. **Botón "🏪 Lojas" en el home**: en la fila del Paso 1, a la izquierda, navegando a
   `/lojas`. Prefetch de la ruta si es barato (patrón ya usado en el proyecto).
4. **"Lojas" también en los botões de acesso rápido del home**: hoy son 3
   (Todos / Categoria / Info útil); agregar "Lojas" como cuarto, navegando a `/lojas`.
   Mismo estilo que los existentes; verificar que los 4 entren bien en 480px sin
   cortar texto (achicar padding/fuente si hace falta, como ya se hizo con otros
   textos largos del home).

## PASO 4 — Verificación (obligatoria antes de dar por terminado)

1. `npm run build` en `frontend/`: sin errores; el home sigue `○ Static`/ISR y la ruta
   nueva `/lojas` también.
2. Probar navegación real (`npm run dev` o preview):
   - Home: se ven los 4 pills en un teléfono (480px); Ordenar/Filtrar siguen
     funcionando igual; el home no carga más lento.
   - Favoritos ya NO está en el perfil; SÍ está en el home y abre `/favorites`.
   - `/listings` y las páginas de categoría NO muestran los botones nuevos.
   - `/lojas`: orden por cantidad de anuncios; buscar por nombre funciona (con y sin
     acentos); **las sugerencias aparecen al tipear y tocar una lleva a esa loja**;
     filtro por lugar funciona; orden A–Z funciona; orden "Mais procuradas" ordena
     por contactos (comparar contra los datos reales de la pestaña de tracking de
     `/admin`); "Ver mais" pagina; tocar una tienda abre su loja; las cards muestran
     los lugares de cada tienda.
   - Botões de acesso rápido: los 4 (con "Lojas") se ven bien en 480px y "Lojas"
     abre `/lojas`.
   - Pill Favoritos: logueado con favoritos muestra el número; sin sesión se ve
     normal y el home no carga más lento.
   - La RPC no expone WhatsApp ni datos privados (mirar la respuesta de red).
3. Cerrar con el checklist de `manual_fable5.md`.
4. Al terminar: decirle al usuario en 2-3 líneas simples qué se hizo y cómo probarlo.
   **No hacer commit/push sin que el usuario lo pida** (él suele cerrar con `/memory`).

---

## Mejoras ya incluidas en este prompt (aprobadas por el usuario el 2026-07-15 — no preguntar de nuevo)

- Solo aparecen tiendas con al menos 1 anuncio activo.
- Cada card muestra la cantidad de anuncios (refuerza el orden y da contexto).
- Búsqueda insensible a acentos (en la isla se escribe "Joao" y "João").
- **Sugerencias de nombres mientras se escribe**, como el buscador de productos (Paso 3).
- **Orden "Mais procuradas"** (contactos por WhatsApp de los últimos 30 días, dato que
  la app ya registra — Paso 2 y Paso 3).
- Paginación de a ~20 para que la pantalla abra rápido aunque haya cientos de tiendas.
- Debounce en la búsqueda (no consultar la DB en cada tecla).
- **Chips de lugares en cada card** de tienda (Paso 3).
- **"Lojas" en los botões de acesso rápido** del home, como cuarto botón (Paso 3).
- **Contador en el pill Favoritos** para logueados, sin costo de latencia (Paso 1).

> Nota: si al ver el resultado el usuario quiere sacar alguna de estas mejoras, se
> revierte esa parte sin discutir — están aprobadas de antemano, no blindadas.
