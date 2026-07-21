# MEMORY.md — Mercado Ilha (fuente de verdad)

Contexto durable del proyecto. Leer al inicio de cada sesión. Para el registro
cronológico de cambios ver la memoria `project_state.md`.

---

## 1. QUÉ ES

Marketplace web para la isla de Tinharé (Morro de São Paulo, Brasil). Reemplaza los
grupos de WhatsApp donde las publicaciones se pierden: permite anuncios permanentes,
buscables y categorizados. El contacto comprador-vendedor es por WhatsApp (botón con
mensaje pre-armado por categoría; sin chat interno). Navegar y contactar es libre;
publicar requiere cuenta. Gratuito al inicio. En producción: `Mercadoilha/mercado-ilha`.

## 2. STACK Y DECISIONES TÉCNICAS

- **Stack:** Next.js 14 (App Router) + TypeScript + CSS inline con variables CSS
  (**sin Tailwind**) + Supabase (DB, Auth) + Cloudflare R2 (fotos) + Vercel.
- **Vercel región `gru1` (São Paulo)** fijada en `frontend/vercel.json` — Supabase está en
  `sa-east-1` (São Paulo); antes corría en `iad1` (EE.UU.) → viaje cruzado en cada request.
  Fue el cambio de latencia de mayor impacto (2026-06-16, commit `6a2737a`).
- **Plataforma:** web responsive mobile-first (max-width 480px) + PWA instalable.
- **Idioma UI:** portugués brasileño. Se habla al usuario en español.
- **Auth:** email + contraseña. Registro captura nombre, WhatsApp, email, contraseña y
  aceptación de términos (`terms_accepted_at`). Flujo PKCE (links de recovery llegan con
  `?code=XXXX`, no hash fragment).
- **Fotos:** hasta 6 por anuncio, subidas a **Cloudflare R2** vía `/api/upload` (exige
  token Bearer). Preview antes de subir.
- **Moderación:** publicación instantánea. Admin puede ocultar/bloquear/eliminar. Usuarios
  denuncian desde el detalle.
- **Perfil-tienda:** cada vendedor tiene página pública `/store/[id]` con sus anuncios activos.
- **WhatsApp del admin:** en tabla `admin_settings` (key `admin_whatsapp`), nunca hardcodeado.
  Se lee con `frontend/lib/adminSettings.ts` (cache a nivel módulo).

## 3. GEOGRAFÍA (3 niveles, todo administrable)

- **Isla:** Tinharé (`tinhare`). Modelo soporta varias islas.
- **Localidades:** Morro de São Paulo, Gamboa, Zimbo, Galeão.
- **Sub-zonas:**
  - Morro de São Paulo: Vila Centro, Lagoa, Primeira Praia, Segunda Praia, Terceira Praia,
    Quarta Praia, Mangaba, Buraco, Outros.
  - Gamboa: Nova Gamboa, Vila, Outros. — Zimbo: Outros. — Galeão: Outros.
- **"Outros":** el usuario escribe referencia en texto libre; NO crea sub-zona oficial. El
  admin la ve y puede oficializarla cuando quiera.

**Tipos de ubicación (`location_type`, leído en vivo de DB, fase-10):**
- `fija`: una localidad + **una** sub-zona (`locality_id` + `subzone_id`). El cliente va al negocio.
- `zonas_de_atencion`: la prestadora se traslada → marca **varias** sub-zonas (checkboxes por
  localidad + "Todas as subzonas de X") **o** "Atendo em toda a ilha". Se persiste en
  `listing_service_zones` (no en `subzone_id`). `covers_all_island=true` → sin filas + `locality_id`
  null (nullable desde fase-10); si elige zonas, `locality_id` = localidad de la 1ª zona. El filtro
  por localidad incluye estos anuncios vía join. 12 categorías son de este tipo. En **Delivery** las
  zonas = a dónde entrega (`category_delivery_prices`/`delivery_data` existen en DB pero nunca se
  cablearon a la UI).
- `sin_ubicacion`: sin campo de ubicación.
- Criterio para clasificar: *¿quién se traslada?* prestadora→cliente = `zonas_de_atencion`;
  cliente→negocio / cosa fija = `fija`.

## 4. CATEGORÍAS (31 activas, actualizado 2026-06-29)

Tabla `categories`: columnas `description text` (nullable, aparece bajo el ícono en home),
`home_section_id` (FK), `location_type`, `expires_in_days`, texto del botón de contacto, orden.
Se gestiona desde el tab Categorias del admin. **Fuente de verdad = DB en vivo + esta tabla, NO
`fase-1.sql`** (que es seed viejo de 10 cat y no se re-ejecuta). Ver `reference_categorias_fuente_de_verdad`.

| Categoría | Slug | | Categoría | Slug |
|---|---|---|---|---|
| Produtos | `produtos` | | Consertos geral | `consertos-geral` |
| Serviços do lar | `servicios-do-lar` | | Electrónica | `electronica` |
| Transporte de mercadoria | `transporte-de-mercadoria` | | Electrodomesticos | `electrodomesticos` |
| Encomendas | `encomendas` | | Veículos | `veiculos` |
| Delivery | `delivery` | | Construção e Reformas | `construcao-e-reformas` |
| Gas | `gas` | | Bioconstrução | `bioconstrucao` |
| Mobilidade e transportes | `mobilidade-e-transportes` | | Saúde | `saude` |
| Aluguéis | `alugueis` | | Doações | `doacoes` |
| Educação | `educacao` | | Empregos e bicos | `empregos-e-bicos` |
| Babás | `babas` | | Serviços Profissionais | `servicos-profissionais` |
| Esportes | `esportes` | | Experiências turísticas | `experiencias-turisticas` |
| Arte e cultura | `arte-e-cultura` | | Internet wifi | `internet-wifi` |
| Restaurantes e bares | `restaurantes-e-bares` | | Agua | `agua` |
| Terrenos | `terrenos` | | Beleza | `beleza` |
| Casas | `casas` | | Bem-estar | `bem-estar` |
| | | | Lojas e barracas | `lojas-e-barracas` |
| | | | Mercados | `mercados` |

- **Botón de contacto:** casi todas "Contatar". Excepciones: Produtos/Terrenos/Casas →
  "Contatar vendedor"; Delivery → "Fazer pedido".
- **Electrónica/Electrodomesticos/Consertos geral** son servicios de reparación (NO venta),
  agrupados en la sección home "Renove o que é seu".
- **Placeholders publicar/editar:** `frontend/lib/categoryPlaceholders.ts` (mapa por slug +
  `DEFAULT_PLACEHOLDERS` fallback). Al crear categoría nueva en admin, agregar su entrada — el
  slug de la key DEBE coincidir EXACTO con el de DB, o cae al genérico sin avisar. Precios de
  ejemplo usan "R$ X" (sin valores reales).

**Multi-categoría (fase-15):** un anuncio en varias categorías/subcategorías sin republicar:
1 principal + hasta 4 secundarias (tabla `listing_extra_categories`). Doc: `MULTI_CATEGORIA.md`
y memoria `project_multi_categoria`.

**Produto vendável (`categories.is_product`, fase-18, corrida 2026-07-07):** columna boolean,
default `false` para todas. Se activa por categoría desde `/admin` → tab Categorias → editar
categoría → checkbox "Produto vendável" (badge verde "produto" en la fila cuando está activo).
Controla si el anuncio de esa categoría muestra el botón "Vendido" en `/profile` (ver §8 y §15).

## 5. SECCIONES DEL HOME (tabla `home_sections`, fase-11 ✅)

Controla cómo se agrupan las categorías en el home. `home_section_id = null` → no aparece.
- `is_featured_block = true` → **Bloque 1** (botones rectangulares horizontales, lista).
- `is_featured_block = false` → **Bloque 2** (secciones temáticas, grid).

Secciones: 1 Destacadas (featured) · 2 Logística · 3 Serviços para sua casa · 4 Educação e
família · 5 Cuidado Pessoal · 6 Arte, esporte e lazer · 7 Comércio local · 8 Renove o que é
seu · 9 Compre seu veículo · 10 Imóveis · 11 Construção e Reformas · 12 Profissionais certificados.

**Admin:** tab Categorias → panel colapsable "Seções do home" (crear/renombrar/reordenar).
Cada categoría muestra badge `#N` y selector de sección en su form. Fuente de tamaños:
0.75rem default; bioconstrucao/electrodomesticos 0.72rem (LONG_NAME_SLUGS en `HomeClient.tsx`).

## 6. DISEÑO Y MARCA

- **Paleta:** azul principal `#185FA5`, azul mid `#1a6fbd`, azul claro `#B5D4F4`, azul xlight
  `#E6F1FB`, arena `#EF9F27`, arena light `#FAC775`, verde-mar `#9FE1CB`, verde oscuro `#0F6E56`.
  Variables CSS en `globals.css` (`--blue-main`, `--sand`, etc.).
- **Logo — rediseño "Equilíbrio clássico" (2026-07-18):** wordmark vectorizado (paths, no texto
  vivo — generado con fontTools desde Arial Rounded Bold, ya que esa fuente no existe en
  Android/Windows) en 3 archivos idénticos en el ícono, distintos en color de "Mercado ilha":
  `public/logo.svg` (blanco, sobre azul — header + cortina de entrada), `public/logo-dark.svg` y
  `public/logo-entrada.svg` (azul oscuro `#123f66`, sobre fondo claro — login/Instalar/popup/
  e-mails, idénticos entre sí). "Tinharé" siempre **naranja `#ef9f27`**, centrado bajo "Mercado
  ilha" (viewBox `0 0 540 148`, ambos con intrinsic size `width="540" height="148"` para que el
  `<img>` no quede sin dimensiones al cargar). Ícono = bolsa de compras con montículo de arena +
  faro adentro. Reemplaza el wordmark simple negro de 2026-07-10. Emails de
  `api/upload/route.ts` y `api/cron/expire-listings/route.ts` (×2) pasaron a `logo-dark.svg`
  (con `logo.svg` blanco quedaban invisibles sobre fondo blanco). **Splash nativo iOS actualizado
  (commit `c5d8d6b`, 2026-07-18):** las 8 `public/splash/apple-splash-*.png` (referenciadas por
  `apple-touch-startup-image` en `layout.tsx`) tenían el wordmark viejo (estáticas, sin script de
  generación en el repo); regeneradas con sharp desde `logo.svg`, fondo `#185FA5`, logo centrado
  al 58% del ancho de pantalla (misma proporción/posición que las anteriores). El ícono cuadrado
  (`icon-192/512`, `apple-touch-icon`, maskable) NO se tocó: sale de `Icono.svg` (solo la bolsa,
  sin texto) vía `generate-icons.js`, no tiene wordmark y no le afecta el rediseño. **Pendiente:**
  confirmar con el usuario mayúscula/minúscula en "ilha".
- **Cards de anuncios (actualizado 2026-07-06):** grid 2 columnas edge-to-edge (clase compartida
  `.listing-grid` en `globals.css`, usada en home/listings/store) — el `<article>` de
  `ListingCard.tsx` NO tiene borde ni sombra propios; la separación la dan líneas divisorias del
  grid: línea vertical entre columnas (técnica: `border-right` en TODAS las celdas para que ambas
  columnas midan lo mismo, con `border-right-color: transparent` en la columna derecha para que
  solo se vea la del medio — evita el desfasaje de 1px que daba un `border-right` solo en una
  columna) + línea horizontal (`border-bottom`) entre filas. NO hay línea entre la imagen y el
  texto (se sacó a pedido del usuario). Imagen `objectFit: contain` en contenedor cuadrado
  (`aspectRatio 1/1`), contenedores de imagen siempre iguales (mismo ancho de columna); el bloque
  de texto se estira por fila via CSS Grid `align-items: stretch` (nativo, sin `minHeight`).
  Texto del contenido (título, precio, localidad, badge) centrado (`textAlign: center`). Precio
  con nota opcional. Ubicación en la card = solo localidad/zona (sin ícono 📍). Miniaturas vía
  `next/image` (AVIF/WebP). Ver memorias `project_listing_card_style` y
  `reference_miniaturas_fotos`.
- **Home (orden actual, `HomeClient.tsx`):** header azul (`SearchHeader`: logo + Compartilhar +
  búsqueda autocomplete) → `BannerRotativo` → **fila de acciones** (`ListingsFeed` con `homeExtras`):
  a la izquierda **Lojas** (→`/lojas`) y **Favoritos** (→`/favorites`, etiqueta fija, sin contador);
  a la derecha **Ordenar** y **Filtrar** → **feed de anúncios** (orden `bumped_at`; los primeros N
  llevan contorno dorado = destacados, N = `featured_count`) → `InstallInvitePopup`.
  **Ya NO existen los 3 botones de acceso rápido** (Todos/Categoria/Info útil, commit `a715b8b`):
  fueron eliminados en un rediseño posterior. Los bloques **Categorias Destacadas** (Bloque 1) y
  **Secciones temáticas** (Bloque 2) viven ahora en `/categorias` (`CategoriesBlocks`); la
  **Informação útil** (Tabela de Marés + horários de barcos) en `/informacao` (`InformacaoClient`).
- **Búsqueda autocomplete (`BuscaAutocomplete.tsx`):** debounce 300ms, AbortController, cache en
  memoria por query, consultas paralelas (listings+categories+subcategories), skeleton, navegación
  ↑↓ Enter Esc, ARIA. Sugerencias: máx 5 anuncios + máx 3 categorías (sin anuncios en el dropdown
  tras el rework — ver `project_buscador_rework`; midiendo búsquedas con fase-16 → revisar sinónimos).
  **Sin acentos + completar barra (2026-07-07, fase-19, commit `c132a18`):** columnas generadas
  `title_norm`/`description_norm`/`name_norm` (minúsculas + `unaccent`, `fase-19-busca-sem-acentos.sql`,
  corrida por el usuario) en `listings`/`categories`/`subcategories`, con índices GIN trigram; "pao"
  ahora encuentra "Pão". Búsqueda multi-palabra por AND sobre esas columnas (`lib/searchNorm.ts` en
  frontend, `fold()`/`foldWords()`), tanto en el autocomplete como en `/listings`. Tocar una
  sugerencia de **término** ya no navega: completa la barra (con espacio final, ícono ↖) para
  que el usuario agregue más texto antes de tocar Buscar; sugerencias de **categoría/subcategoría**
  siguen navegando directo. Enter con una sugerencia resaltada por teclado sí busca/navega directo.
  **Ajustes (2026-07-08, commit `80181f1`):** el filtro pasó de substring (`%pa%`, coincidía en
  cualquier parte del texto — "pa" traía casi todos los anuncios por el "para" de una descripción)
  a **inicio de palabra** (`prefixFilter()` en `searchNorm.ts`: `col.ilike.w*` OR `col.ilike.* w*`).
  Palabras de 1–2 letras (`MIN_WORD_DESC=3`) buscan solo en el título, no en la descripción, para
  evitar coincidencias ruidosas. Aplica en el autocomplete y en `/listings` (incluido el fallback
  "sin resultado con todas las palabras → relajar a OR", que muestra "resultados parecidos" cuando
  ninguna publicación tiene TODAS las palabras, ordenado por cantidad de coincidencias — ver
  `relaxedSearch` en `listings/page.tsx`). También: panel de sugerencias separado 8px de la barra
  (antes quedaba pegado, esquinas rectas) y `RegisterSW.tsx` ya no registra el service worker en
  desarrollo (`process.env.NODE_ENV !== "production"` corta el registro) — en dev cacheaba
  `/_next/static` cache-first y servía JS viejo tras cada cambio, sin relación con el build real.
  **Seguir escribiendo tras elegir una sugerencia (2026-07-16):** el primer toque
  sobre una sugerencia de **término** SIEMPRE completa la barra, aunque el término sea idéntico a
  lo escrito (antes ese caso buscaba directo y cortaba el tipeo de la segunda palabra: escribir
  "iphone" y tocar la sugerencia se iba a resultados en vez de dejar "iphone " para agregar "13").
  Queda el cursor al final, después del espacio (`caretToEndRef` + `setSelectionRange` en un
  `useEffect` sobre `query`: corre cuando el DOM ya tiene el valor nuevo; el input nunca pierde el
  foco porque los ítems cancelan el `pointerdown`, así que en móvil el teclado sigue abierto). El
  **segundo** toque sobre ese mismo término ya elegido (`isChosenTerm()`: la barra termina en
  espacio y `fold(norm(query)) === fold(norm(label))`, se ve entero en negrita) sí busca — y ese
  ítem ya no muestra el ↖, porque tocarlo no completa. El espacio final nunca entra en la
  búsqueda: `goFreeText()` hace `trim()` antes de armar la URL y `foldWords()` descarta vacíos.
  También: el listbox resetea `activeIdx` en `onMouseLeave` — en desktop, pasar el mouse por
  encima de la lista camino al botón Buscar dejaba una sugerencia resaltada y `handleSubmit`
  buscaba **esa** en vez de lo escrito (en móvil no pasaba: cancelar el `pointerdown` suprime los
  eventos de mouse de compatibilidad).
- **Botón compartir:** Web Share API + fallback WhatsApp. Ícono en `ShareIcon.tsx`. En 4 lugares:
  header global, detalle del anuncio (outline azul, visible siempre), tienda (outline blanco),
  perfil propio (outline azul, URL `origin + '/store/' + userId`).
- **Bottom nav fijo (`BottomNav.tsx`):** 🏠 Início | 🗂️ Categorias | ➕ (arena, circular) |
  ℹ️ Informação | 👤 Perfil / 🔑 Entrar. Altura `--nav-height: 72px` (subió de 64px el
  2026-07-16) + `paddingBottom: 8` en el `<nav>` → los ítems se centran en el espacio de
  arriba y no quedan pegados al borde inferior del teléfono. `--nav-height` la consumen
  también `body { padding-bottom }` y `.page-body { min-height }` en `globals.css`: cambiarla
  ahí ajusta todo el clearance solo.
- **OG image:** `/icon-192.png` para preview compacto en WhatsApp.
- **Favoritos:** sección eliminada del perfil. Ya no existe en la UI.
- **Botones que "pasaban desapercibidos" (2026-07-07):** en `/listings/[id]`, "Ver loja" pasó de
  link de texto a píldora sólida azul (`--blue-main`, fondo, blanco); "Editar anúncio" (dueño) pasó
  de azul a arena (`--sand`) con sombra. Sin emojis de lápiz (se sacaron a pedido del usuario) ni
  el 📍 antes de la localidad en `/favorites`.
- **Botón "Ver loja" más grande (2026-07-16):** misma píldora azul, pero `fontSize` 0.8→0.92rem
  y `padding` 0.45/0.9rem→0.6/1.1rem (`ListingDetailClient.tsx`).
- **Pill "Lojas" del home con el mismo estilo que "Ver loja" (2026-07-16):** en `ListingsFeed.tsx`
  pasó de píldora outline (gris, mismo look que Ordenar/Filtrar) a píldora sólida azul con texto
  blanco (`storePillLink`, calcada del estilo de "Ver loja →"), manteniendo el texto "Lojas".
  "❤️ Favoritos" al lado sigue con el estilo outline de siempre (`pillLink`).
- **Banner do perfil edge-to-edge, igual ao de `/store/[id]` (2026-07-16):** em `/profile`,
  o bloco com foto/nome/email/WhatsApp deixou de ser um card com margem e passou a ocupar
  toda a largura da tela (mesmo degradê `linear-gradient(135deg, var(--blue-main) 0%,
  var(--blue-mid) 100%)`, sem borda arredondada nem padding lateral do wrapper — banner e
  wrapper com padding-1rem do resto do conteúdo ficaram como dois blocos separados em
  `app/profile/page.tsx`). Todo o conteúdo interno adaptado a branco/tons claros: nome e
  email em branco, botão "Editar" outline branco, aviso de "falta WhatsApp" de vermelho a
  `--sand-light` (o vermelho se perdia sobre o azul), formulário de edição (labels, ajuda,
  botão Salvar branco sólido com texto azul) e `AvatarUpload.tsx` (borda do círculo, botão
  "Trocar foto" e mensagens em tons claros). **Foto de perfil aumentada de 80→104px**
  (`AvatarUpload.tsx`) para preencher o espaço extra do banner sem card ao redor; a foto do
  vendedor em `/store/[id]` também aumentou um pouco, 72→84px (`StoreClient.tsx`). Botões
  "Ver minha loja" (sem emoji 🏪, antes "Minha loja") e "Compartilhar" passaram de outline
  azul a **fundo branco sólido com texto azul** (`outlineBlueBtn` em `app/profile/page.tsx`).
- **Miniaturas de anúncios ampliadas 20% (2026-07-16):** a pedido do usuário, as fotos dos
  anúncios em `/favorites` (72→**86px**, `sizes="86px"`) e em "Meus anúncios" do perfil
  (52→**62px**, `sizes="62px"`) cresceram 20%; o emoji de fallback 🛍️ acompanhou
  (1.75→2.1rem e 1.4→1.7rem). `sizes` sempre junto com o `width/height` — se ficar no valor
  antigo, `next/image` serve um arquivo menor que o box e a foto sai borrada.
- **Espaçamento loja = espaçamento entre anúncios (2026-07-16):** em `/store/[id]`, o grid
  de anúncios tem um pequeno respiro acima (`padding: "0.25rem 0 1rem"` em `StoreClient.tsx`
  — metade do espaço original de 0.5rem, ajustado a pedido do usuário após ficarem colados
  demais ao banner numa primeira versão sem espaço nenhum).

## 7. PUBLICIDAD (BANNERS)

- Admin gestiona banners desde `/admin` tab "Banners": URL imagen, link, posición
  (`home`/`listado`), activo/inactivo. (La posición `splash` existió hasta 2026-07-08:
  se eliminó junto con el splash propio de la app — ver §13/§19. La DB aún acepta el valor
  `splash` por la migración `fase-splash-sponsor.sql`, pero el admin ya no lo ofrece y
  ningún código lo lee.)
- Varios activos en misma posición → rotan cada 4s con dots. Sin banners → placeholder "Seu
  negócio aqui! + Fale conosco".
- **Orden de aparición (2026-07-20):** el primer banner que se ve al entrar a la página es el de
  menor `sort_order`. Desde `/admin` tab "Banners" ahora hay flechas ↑↓ (`moveBanner`, mismo
  patrón que categorías/subcategorías) para reordenar la lista completa (mezcla banners `home` y
  `listado`, pero cada posición igual respeta su orden relativo al filtrar por `.eq("position",…)`).
  Antes solo se podía agregar (al final), pausar o borrar — no había forma de cambiar el orden.
- ⚠️ **Posición `listado` sin usar todavía:** el admin permite crear un banner con posición
  `listado`, pero ningún componente actual llama a `BannerRotativo` con `position="listado"` en
  la página de listados (`/listings`, `ListingsClient.tsx`) — solo se renderiza en el home
  (`HomeClient.tsx`, `CategoriasClient.tsx`). Si se carga un banner con esa posición hoy, no se
  ve en ningún lado. Pendiente: si el usuario quiere banners también en `/listings`, hay que
  agregar el fetch + `<BannerRotativo position="listado">` ahí.
- **Layout:** ancho completo, sin border-radius ni etiqueta "PUBLICIDADE", pegado al header.
  Componente `BannerRotativo.tsx`.
- **Imágenes:** en `frontend/public/banners/`, URL `https://mercadoilha.vercel.app/banners/<x>.png`
  (va directo en `image_url`). Dimensión recomendada 1200×300 (4:1); Higgsfield genera 1584×672
  (21:9) con `objectFit: cover` → diseñar contenido centrado verticalmente.
- **Skill `/banner-institucional`** (`.claude/skills/SKILL_BANNER_INSTITUCIONAL.md`): genera con
  Higgsfield, descarga, sube a `public/banners/`, push, retorna URL. ⚠️ correr
  `git config http.postBuffer 524288000` antes del push de imágenes.
- ⚠️ **Desde 2026-07-08** (`minimumCacheTTL` 31 días, ver §13): al reemplazar un banner existente
  **versionar el nombre del archivo** (`banner-institucional-v2.png`), nunca sobrescribir el mismo
  nombre — si no, `/_next/image` puede seguir sirviendo la versión vieja hasta un mes.

## 8. PANEL DE ADMINISTRADOR (`/admin`, requiere `role=admin`)

Acceso desde perfil (botón "⚙️ Painel de administração", solo admins). **8 tabs:**
- **Dashboard** — contadores (anúncios activos/total, denúncias, usuarios, banners).
- **Categorias** — CRUD completo: nombre, ícono (EmojiPicker), slug, `location_type`, texto del
  botón, descripción, orden (flechas ↑↓ reasignan `sort_order` secuencial a TODAS), checkbox
  "Produto vendável" (`is_product`, fase-18, ver §4 y §15). Subcategorías:
  agregar/editar/reordenar/eliminar (⚠️ al crear requiere enviar `slug = toSlug(nombre)`; ícono
  default 🌊). En público y admin las subcategorías muestran viñeta `•` azul, no el ícono guardado.
  IconPicker con grupos Esportes / Cuidados infantis / Eletrodomésticos & Conserto. Reorden con
  error handling (alert si falla el update). Panel colapsable "Seções do home".
- **Usuários** — buscar por nombre/WhatsApp, dar/quitar admin, bloquear/desbloquear, eliminar
  (DELETE `/api/admin`).
- **Anúncios** — lista todos, filtro por estado, Ativar/Ocultar/Bloquear/Deletar.
- **Banners** — CRUD (URL + link + posición, activar/pausar, eliminar).
- **Config** — WhatsApp del admin + atalho personalizable de la barra inferior.
- **Denúncias** — lista con borde de color por estado, "Ocultar anúncio + resolver" en 1 clic.
- **📈 Métricas** — solo lectura: totales (vistas, clicks WA, clicks banner) + top anuncios por WA.

**Optimizaciones admin (2026-06-25, commit `30b4d37`):** rol cacheado en `sessionStorage` por
userId; tabs con `display:none` (montan 1 vez, cambio instantáneo sin re-fetch); guardar
categoría/subcategoría con UI optimista (revierte si falla).

## 9. RUTAS

| Ruta | Descripción |
|---|---|
| `/` | Home. `revalidate = 60` (ISR, `○ Static`). Anúncios destacados por `bumped_at`. |
| `/category/[slug]` | **Server Component**: fetch con `getSupabaseAdmin()`, `redirect()`. Sin subcategorías → redirige directo a `/listings?category=slug`. `revalidate=300` + `generateStaticParams` (pre-render de las 29 páginas). |
| `/listings` | Listados + filtro por categoría (`?category=slug`) y texto (`?q=`). Client-side. |
| `/listings/[id]` | Detalle: galería, precio, vendedor, WhatsApp (RPC lazy), denuncia. Botón editar para dueño. |
| `/listings/[id]/edit` | Editar anuncio (solo dueño). |
| `/publish` | Formulario: fotos, categoría→subcategoría, ubicación según tipo. Llama `/api/revalidate` al publicar. |
| `/profile` | Perfil editable (nombre+WhatsApp), mis anuncios con miniatura 62×62 (`next/image`, primeira foto por `sort_order`), 👁️/💬 stats, botón ⭐ Destacar. 2 botones (Minha loja / Compartilhar) en fila arriba de la lista — Favoritos se mudó al home (ver §20). |
| `/store/[id]` | Tienda pública del vendedor (banner azul + sus anuncios). Botón ← usa `router.back()` (no vuelve fijo a `/listings`). |
| `/lojas` | Directorio público de tiendas (buscar, filtrar por lugar, ordenar). Ver §20. `○ Static`. |
| `/signin` | Tabs login + registro. Tras 3 logins fallidos → card "Criar nova senha". |
| `/forgot-password` | 1 paso, solo email. `resetPasswordForEmail`. |
| `/reset-password` | Nueva contraseña desde link. PKCE: `?code` → `exchangeCodeForSession`. |
| `/termos` | Termos e Condições de Uso (pública). |
| `/admin` | Panel admin (requiere rol admin). |
| `/api/admin` | Server-side con service role (stats dashboard + DELETE usuario). Exige sesión + rol. |
| `/api/upload`, `/api/delete-file` | Subir/eliminar fotos en R2. Exigen token Bearer. |
| `/api/mares` | Scrapea tabuademares.com, 4 mareas del día. `unstable_cache` 6h. |
| `/api/revalidate` | Revalida la home (ISR) on-demand. POST, Bearer token Supabase. |
| `/api/cron/expire-listings` | Vercel Cron 10:00 UTC — ver §Expiración. |

## 10. ARCHIVOS CLAVE DEL FRONTEND

```
frontend/
├── app/
│   ├── globals.css              variables CSS de marca, @keyframes
│   ├── layout.tsx               BottomNav + RegisterSW + meta PWA
│   ├── page.tsx                 home (ISR revalidate 60)
│   ├── not-found.tsx            404 con marca
│   ├── signin/ termos/ profile/ publish/ store/[id]/ admin/ forgot-password/ reset-password/
│   ├── category/[slug]/page.tsx Server Component
│   ├── listings/page.tsx  listings/[id]/page.tsx  listings/[id]/edit/page.tsx
│   └── api/  admin/ upload/ delete-file/ mares/ revalidate/ cron/expire-listings/
├── components/
│   ├── BottomNav.tsx (session-aware)   BannerRotativo.tsx   BuscaAutocomplete.tsx
│   ├── HomeClient.tsx   MaresWidget.tsx   BarcosWidget.tsx   InstallAppBanner.tsx
│   ├── ListingCard.tsx   RegisterSW.tsx   ShareIcon.tsx   AvatarUpload/AvatarCropModal
├── lib/
│   ├── supabaseClient.ts (anon)   supabaseAdmin.ts (service role, server-only)
│   ├── adminSettings.ts   share.ts   whatsappUrl.ts   tracking.ts   visitorId.ts
│   ├── profileCache.ts   categoryPlaceholders.ts
│   └── contexts/SessionContext.tsx
└── public/  manifest.json  sw.js  icon-192/512.png  apple-touch-icon.png  logo.svg  banners/
```

**`supabaseAdmin.ts`:** `getSupabaseAdmin(opts?: { revalidate?: number })`. Sin opts →
`cache:"no-store"` (siempre fresco; default admin/API). Con `revalidate:N` → `next:{revalidate:N}`
(habilita ISR en páginas). El `no-store` global era lo que bloqueaba el ISR de la home.

## 11. VARIABLES DE ENTORNO

En `frontend/.env.local` y en Vercel:
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        ← solo server-side, nunca al cliente
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   ← Cloudflare R2 (fotos)
NEXT_PUBLIC_SITE_URL=https://mercadoilha.vercel.app
```

## 12. SEGURIDAD Y PRIVACIDAD (LGPD) — 2026-06-09

Problema corregido: la RLS original `"Profiles public read" using (true)` exponía todos los
WhatsApp y roles a cualquier anónimo. Fix en `supabase/security-fix-profiles.sql`:
- Eliminada esa política; nueva `"Profiles auth read"` (solo autenticados leen `profiles`).
- Vista `public.profiles_public`: solo `id, full_name, avatar_url, created_at` (sin `whatsapp`/`role`),
  accesible por anon. `listings/[id]` y `store/[id]` leen de esta vista.
- RPC `get_seller_whatsapp(seller_id)` `security definer`: único acceso al teléfono, solo
  autenticados; null para anónimos. El teléfono se pide lazy al hacer click en "Contatar".
- `/api/upload` y `/api/admin` exigen sesión (Bearer); admin además rol.
- `profiles` tiene columnas `secret_question`/`secret_answer` sin uso (implementación revertida, sin migración pendiente).

## 13. OPTIMIZACIONES DE RENDIMIENTO (patrones de referencia)

⚡ **Pilar transversal:** ver CLAUDE.md. Ninguna tarea debe degradar la velocidad de navegación.

- **Server Components** para páginas de solo-lectura (`category/[slug]`): sin `"use client"`+spinner.
- **ISR en vez de `force-dynamic`** (home `revalidate=60`, category `300`) + revalidación on-demand
  (`/api/revalidate` fire-and-forget al publicar) → home estática desde edge, cold-start eliminado.
- **`Promise.all`** (sin waterfalls) en profile, publish, listings/[id].
- **Índices SQL** (`fase-9-indices.sql` ✅): `user_id`, `created_at desc`, `expires_at`, trigram
  (`pg_trgm`) sobre `title`. Índice `listings_status_bumped_idx` (fase-17).
- **Prewarm + stale-while-revalidate** para datos con auth (perfil): `lib/profileCache.ts` con
  `prewarmProfile()` disparado al resolverse la sesión en `SessionContext`; `getCachedProfile()`
  render instantáneo; `setCachedProfile()` sincroniza tras mutaciones.
- **Caché de sesión + prefetch al tocar para `/favorites` (2026-07-16):** mismo patrón que el
  perfil, pero sin costo en el arranque. `lib/favoritesCache.ts` (que ya tenía el Set de ids)
  pasó a ser dueño también de la **lista completa**: `getCachedFavoritesList()` (render
  instantáneo), `loadFavoritesList()` (revalida por detrás, dedupe de vuelos, y de paso alinea
  el Set de ids que sale gratis de las mismas filas) y `prefetchFavoritesList()` disparado en
  `onPointerDown` del pill "❤️ Favoritos" (`ListingsFeed.tsx`) → la query viaja en paralelo con
  la navegación en vez de arrancar recién al montar. **Por qué acá el prefetch va en el tap y no
  en el arranque de sesión** (como el perfil): agregar una 4ª query al `SessionContext` le cobra
  el costo a todos los usuarios, incluso a los que nunca abren favoritos. El tap no cuesta nada
  hasta que hay intención. Dos detalles que hacen falta: `loadFavoritesList()` devuelve `null`
  ante error (el llamador conserva lo que muestra, no vacía la pantalla) y `mutationEpoch`
  descarta la respuesta de una query que salió **antes** de un toggle (ver §18).
- **Descripción del detalle viaja con el feed en vez de esperar la query cliente
  (2026-07-18):** el fix del 2026-07-16 (prefetch en `onPointerDown` + prewarm de sesión, ver
  §18) **no alcanzó** — el usuario confirmó que la primera vez que abre un anuncio en el día
  la descripción seguía tardando varios segundos, porque toda mitigación seguía dependiendo
  de una query cliente que paga el arranque en frío (conexión + refresh de token). Fix
  estructural: `description` se sumó a `LISTINGS_SELECT` (hereda `LISTINGS_SELECT_BUMP`) y a
  `STORE_SELECT` (`StoreClient.tsx`) → llega server-rendered vía ISR junto con el resto de la
  card, sin ninguna query cliente de por medio. `ListingPreview` (`lib/listingPreview.ts`)
  ganó el campo `description`; `ListingCard` la siembra en `setListingPreview` (pointerdown y
  click); `ListingDetailClient.tsx` la pinta apenas existe en el preview, ya no gateada por
  `fullyLoaded` (el mensaje "sem descrição" sigue reservado a cuando `fullyLoaded` confirma
  que de verdad no hay, para no mostrarlo de un preview viejo en caché sin la columna).
  Favoritos y perfil no usan `ListingCard` → sus selects no se tocaron. Verificado: build OK
  (`/` sigue `○ Static`, `/listings/[id]` sigue `●` SSG), home servido en runtime con las
  descripciones embebidas (~73KB HTML crudo / ~11KB gzip, aceptable). Ver §18, §22.
- **Prewarm del catálogo de categorías en `/categorias` (2026-07-20):** al abrir una categoría
  SIN subcategorías, `/listings?category=` necesita resolver el slug contra el catálogo
  (`lib/catalogCache.ts`) antes de poder pedir los anuncios — sin caché tibio eso son dos
  viajes de red en serie (catálogo → anuncios) solo la primera vez de la sesión.
  `CategoriasClient.tsx` ahora precalienta `loadCategories()` en idle (mismo patrón que el
  prewarm de `/listings` en `HomeClient.tsx`, más arriba) apenas se pinta la pantalla de
  categorías, así el catálogo ya está en caché de sesión cuando el usuario toca una categoría.
  No bloquea el render ni cambia nada visible.
- **`next/dynamic`** para módulos pesados de uso raro (`AvatarCropModal`, PhotoUploader).
- **`next/image`** (AVIF/WebP, remotePatterns) para fotos.
- Widgets secundarios (marés, barcos) cargan post-render y nunca rompen la home si fallan.
- Verificado en su momento (evitar falsos positivos): `adminSettings` ya cachea a nivel módulo;
  `favorites` ya tiene unique index; MV `active_listings_summary` no la consume nadie;
  `SessionContext.getSession()` lee de local storage (no red). Ver `feedback_verificar_diagnostico`.
- **`OPTIMIZATION_MASTER_PLAN_V2.md`** (raíz, creado 2026-07-07): segunda auditoría de velocidad
  sobre el V1 ya en producción. **Fase 1 (T1-T5) EN PRODUCCIÓN** desde 2026-07-08 (commit ver §22):
  - `next.config.mjs`: `images.minimumCacheTTL = 2678400` (31 días) — fotos de anuncios tienen path
    inmutable (uuid+timestamp), seguro cachear semanas; excepción banners, ver §7.
  - `lib/listingsApi.ts` (nuevo): `LISTINGS_SELECT` + `DEFAULT_LISTINGS_KEY` ("||||") +
    `fetchDefaultListings()` — fuente única del select default de `/listings`, importada tanto por
    `app/listings/page.tsx` como por el prewarm del home (cero drift).
  - `HomeClient.tsx`: prewarm en idle (`requestIdleCallback`/fallback 2s) del listado default de
    `/listings` hacia `listingsCache` — tocar "Todos os anúncios" desde el home pinta sin spinner.
  - `ListingDetailClient.tsx`: el estado de favorito ya no hace query propia; lee/escribe
    `lib/favoritesCache.ts` (mismo Set que `/listings` y `/store`) — 1 RTT menos por detalle visto.
  - `lib/listingsCache.ts`: dos umbrales en vez de uno — `LISTINGS_SOFT_TTL` 3 min (fresco, sin
    indicador) y `LISTINGS_HARD_TTL` 30 min (se muestra igual, con "Atualizando…" de fondo). Antes
    volvía a spinner pasados los 3 min.
  - `BuscaAutocomplete.tsx`: caché de sugerencias espejado en `sessionStorage`
    (`mi_busca_cache_v1`, TTL 10 min, tope 50 queries) — sobrevive a recargar/reabrir el PWA.
  - Verificado: `npm run build` (52 páginas, todas las rutas iguales a la línea de base, ninguna
    pasó a dinámica) + smoke test de `/` y `/listings` en runtime.
  - **Hallazgo nuevo detectado con Speed Insights (no estaba en la auditoría V2 original): CLS
    0.47 (Poor) en mobile**, ver `ERRORES_PENDIENTES.md` — pendiente investigar, probablemente en
    `/store/[id]`.
  - **Fase 2 (T6-T9) EN PRODUCCIÓN** desde 2026-07-08 (commit ver §22) — la entrada de la app:
    - `public/sw.js` → **v6**: la navegación deja de ser network-first puro. Con documento
      cacheado, la red compite contra un timeout de 500ms (`NAV_TIMEOUT_MS`); si no llega a
      tiempo se sirve el caché al instante y la red sigue refrescándolo de fondo
      (`handleNavigation` + `fetchNavigation`). + Navigation Preload
      (`registration.navigationPreload.enable()` en `activate`) + seed del documento `/` en
      install/activate (primera apertura standalone ya tiene algo que pintar). Reglas intocables
      preservadas: Supabase nunca interceptado, `/publish|/profile|/admin` siempre red (nunca
      caché), RSC sigue network-first puro (el race es SOLO para documentos HTML de apertura).
      Verificado con Chrome headless por CDP (sin agregar Playwright): versionado v5→v6 OK,
      offline con `/` cacheada abre desde caché, ruta no visitada → `offline.html`, `/profile`
      offline → `offline.html` (nunca caché), y con latencia simulada de 3000ms la apertura de
      `/` resolvió en ~946ms (el race funciona).
    - `SplashScreen.tsx`: mínimo del splash CSS 600ms → **350ms**. (Superado: el 2026-07-08,
      apenas desplegada la Fase 2, el splash propio se ELIMINÓ por completo — quedaban dos
      pantallas azules encadenadas. Ver §19 "Splash propio + slot patrocinador: ELIMINADO".)
    - Íconos regenerados desde `Icono.svg` (nítidos): `icon-512/192.png` (variante `any`, casi a
      sangre) + **nuevos** `icon-maskable-512/192.png` (bolsa al 62% del lienzo, zona segura
      circular de Android) + `apple-touch-icon.png`. `manifest.json` con `purpose: "any"/"maskable"`
      en los 4 íconos PWA. Aprobados visualmente por el usuario antes del deploy (artefacto con
      los 13 assets a tamaño real).
    - `app/layout.tsx`: 8 `<link rel="apple-touch-startup-image">` (PNGs en `public/splash/`,
      logo.svg centrado sobre `#185FA5`, generados con `sharp`) cubriendo las resoluciones de
      iPhone vigentes — antes iOS abría el PWA en blanco puro.
  - **Fase 3 (T10-T11) EN PRODUCCIÓN** desde 2026-07-08 (commit ver §22) — `/listings` instantáneo
    desde cualquier entrada:
    - `lib/listingsCache.ts` (T10): el `Map` de resultados/scroll/filtros se espeja en
      `sessionStorage` (`mi_listings_cache_v1`), hidratado una vez de forma perezosa. Persiste solo
      las últimas 4 claves y hasta ~200 kB (si excede, solo la vista default); quota llena degrada
      en silencio. Recargar (F5) `/listings` ya no vuelve al spinner.
    - `app/listings/page.tsx` (T11): pasó de client a **Server Component con `revalidate = 60`**
      (mismo patrón ISR que el home) que trae el listado default (60 anuncios activos, `LISTINGS_SELECT`)
      y lo pasa como `initialDefault`. La parte interactiva se mudó a `app/listings/ListingsClient.tsx`
      (client). Las cards del primer HTML se renderizan en el *fallback* del `Suspense` (mismo
      `initialDefault`, mismo markup que la vista real) y `initRef` siembra el estado con ese
      listado solo en la vista default (sin filtros en la URL) y solo si no hay caché de sesión más
      fresco — sin mismatch de hidratación. **No se lee `searchParams` en el server** (rompería el
      ISR). Verificado: `npm run build` con `/listings` sigue `○ Static` (no pasó a `ƒ`); HTML
      prerenderizado con 10 `<article>`/`<a href="/listings/N">` reales (antes: 0, solo spinner);
      runtime (`next start`) sirviendo las mismas cards con `x-nextjs-cache: STALE` +
      `Cache-Control: s-maxage=60, stale-while-revalidate`.
  - **Fase 4 (T12-T13) EN PRODUCCIÓN** desde 2026-07-08 (commit ver §22) — payloads más chicos:
    - `app/listings/[id]/ListingDetailClient.tsx` (T12): la query del detalle ya no pide `*` +
      `listing_photos(*)`. Ahora lista columnas explícitas (auditadas por uso real con grep de
      `full.`/`listing.`, más un margen seguro de escalares baratos: `id, status, category_id,
      subcategory_id, locality_id, created_at`) y `listing_photos(id, photo_url, sort_order)`.
      Cero cambios visibles; menos bytes por apertura del detalle.
    - `app/favorites/page.tsx` (T13): trae **1 foto por anuncio** (la primera por `sort_order`),
      cerrando el resto del V1-T5. Sintaxis anidada de dos niveles
      `.order("sort_order", { referencedTable: "listings.listing_photos" })` +
      `.limit(1, { referencedTable: "listings.listing_photos" })`. **Verificada contra la DB real**
      antes de aplicar: (1) PostgREST acepta el path punteado sin error; (2) probado sobre una
      relación pública de dos niveles que el `limit` recorta el nivel más profundo (9→1). Antes
      `/favorites` traía hasta 6 fotos por favorito.
    - Verificado: `npm run build` = 52 páginas, `/favorites` y `/listings` siguen `○ Static`,
      detalle `● SSG` — ninguna ruta se degradó; type-check limpio.
  - **Cortina azul al abrir desde el navegador — EN PRODUCCIÓN** desde 2026-07-08 (commit ver
    §22, fuera del plan V2 formal, pedida aparte por el usuario). Implementación **100% CSS, sin
    JS** (decisión tras revisión: la 1ª versión usaba un `<script>` inline y era frágil — ver
    §18). `app/layout.tsx`: `<div id="browser-splash" aria-hidden>` con el logo, primer hijo de
    `<body>`. `globals.css`: `#browser-splash` cubre la pantalla (`position:fixed; inset:0;
    z-index:9999`, fondo `--blue-main`) y se desvanece SOLA con
    `animation: browser-splash-out 700ms ease-out forwards` (keyframe: opaca hasta 45%, luego
    `opacity:0; visibility:hidden`). Al ser CSS puro **no puede quedar trabada tapando la app**
    (el fill-mode forwards deja `visibility:hidden` → no bloquea toques). Dos `@media` la ocultan
    con `display:none`: `(display-mode: standalone)` → el PWA instalado NUNCA la ve (conserva su
    splash nativo del OS, sin el "doble salto" histórico); `(prefers-reduced-motion: reduce)` →
    respeta la preferencia de menos movimiento. Solo aparece en la carga real (hard load); el
    RootLayout no se remonta en la navegación interna → NO reaparece entre rutas (cero impacto en
    velocidad de navegación). Verificado: HTML compilado sin script, CSS compilado con la
    animación + ambos `@media`; `npm run build` 52 páginas sin rutas degradadas.
  - Plan V2 completo salvo la **Fase 5 (T14)**: validación con Web Vitals reales (Speed Insights),
    sin código — el usuario pidió retomarlo el **20 de julio de 2026** y comparar contra la foto
    inicial. Esfuerzo bajo.
- **Fix parpadeo + demoras post-V3 (2026-07-15)** — diagnóstico verificado con mediciones (detalle
  ~250ms, feed 60 anuncios ~200-550ms desde el servidor: la DB nunca fue el problema, todo era
  client-side). Prompt completo en `PROMPT_FIX_PARPADEO_Y_DEMORAS.md`. Tres fixes:
  - **Parpadeo de imágenes al abrir el home:** `ListingsFeed.tsx` (compartido por home/`/listings`/
    categorías, nuevo del rediseño de navegación `3d80e9b`) había perdido el `priority={i<4}` que
    el `HomeClient` viejo pasaba a las primeras cards — quedaban todas `lazy` y las fotos "caían"
    tras la hidratación. Restaurado en el `.map()` de `sortedListings`. Además el indicador
    "Atualizando…" se insertaba como bloque nuevo arriba del grid en casi cada apertura (caché >60s
    de vieja) empujando todo hacia abajo y de vuelta — ahora es un overlay absoluto centrado
    DENTRO de la fila Ordenar/Filtrar (que ya reservaba altura con `minHeight:52`), cero layout shift.
  - **Descripción del detalle lenta:** la cadena era serial (tap → payload RSC → mount → recién ahí
    la query a Supabase). Nuevo `lib/listingDetailPrefetch.ts` (Map tope 10, TTL 30s,
    fire-and-forget deduplicado): `ListingCard` dispara `prefetchListingDetail(id)` en el mismo
    `onClick` donde ya guarda el preview optimista, así la query completa viaja EN PARALELO con la
    navegación. `ListingDetailClient.load()` consume esa promesa si existe (`LISTING_DETAIL_SELECT`,
    select único compartido en `lib/listingsApi.ts` — cero drift); sin prefetch (deep link/F5) cae
    al fallback normal, sin cambios.
  - **Perfil con datos que "llegaban tarde":** `prewarmProfile` (`lib/profileCache.ts`) tenía el
    select desactualizado desde que se agregaron las miniaturas a "Meus anúncios" (2026-06-30,
    commit `e7e47b3`) — no traía `listing_photos` ni `categories(is_product)`, así que el perfil
    pintaba del caché sin fotos (🛍️) ni botón "Vendido" hasta que respondía la query completa de la
    página. Alineado el select + se sumó el prewarm del RPC `get_my_listings_stats` (contadores
    👁️/💬 también instantáneos). `CachedProfile` ahora incluye `statsMap`.
  - Verificado: `npm run build` sin errores, ninguna ruta cambió de tipo (`/`, `/listings` ISR;
    `/listings/[id]`, `/profile` estáticas); smoke test en `next start` confirmando
    `fetchPriority="high"` + preload en las primeras 4 imágenes del home y 0 apariciones del bloque
    viejo de "Atualizando…" en el HTML estático.

## 14. TRACKING PRE-MONETIZACIÓN (2026-06-18, commit `57ce23d`)

Estrategia: **lanzar 100% gratis**, solo recolectar datos (lo irrecuperable). Features de cobro
se posponen hasta tener tracción. Plan completo en `comisiones.md`.
- **DB `supabase/fase-monetizacion-tracking.sql`** (idempotente) — ⚠️ **pendiente de correr**:
  tablas `whatsapp_clicks`, `banner_clicks` (insert solo vía RPC `security definer`);
  `track_listing_view` pasó a `security definer` (antes fallaba para visitantes → las vistas nunca
  se grababan). RPCs: `track_whatsapp_click`, `track_banner_click`, `get_tracking_summary`,
  `get_top_listings_by_whatsapp`, `get_my_listings_stats`.
- **Frontend:** `lib/visitorId.ts` (UUID anónimo en localStorage), `lib/tracking.ts` (helpers
  fire-and-forget). Enchufado en: detalle (vista + WA), tienda (WA), BannerRotativo (imagen + CTA),
  home ("Fale conosco").
- **Perfil del vendedor:** 👁️ vistas + 💬 contatos por anuncio (RPC `get_my_listings_stats`, filtra
  por `auth.uid()`) — enganche de retención hacia un plan Pro futuro. Dos banners informativos bajo
  la lista: amarillo (validez 30d + eliminación tras 15d inactivo) y azul ("O que significam os
  números?", necesario porque en móvil los `title` HTML no funcionan al tocar).

## 15. DESTACAR ANÚNCIO / BUMP (2026-07-05, commit `4368069`, en producción)

Desde el perfil, el usuario empuja un anuncio propio al tope de "Anúncios destacados" (simula el
re-postar del grupo de WhatsApp). **Gratis por ahora; será pago más adelante.**
- **DB `fase-17-destacar-anuncio.sql`** (✅ ejecutada): columna `listings.bumped_at timestamptz`
  (backfill = `created_at`; `created_at` NO se toca → sigue veraz para "publicado há X dias"). Índice
  `listings_status_bumped_idx`. RPC `bump_listing(_listing_id)` `security definer`: solo dueño +
  `status='active'`; **cooldown 15min** (reducido desde 1h el 2026-07-16, SQL re-ejecutada ✅); setea
  `bumped_at=now()`, renueva `expires_at=+30d`, limpia `deletion_warning_sent_at`.
- **Frontend:** home ordena destacados por `bumped_at` desc (sube en ≤60s por ISR); perfil con botón
  dorado ⭐ (deshabilitado en cooldown, muestra `⭐ Nmin`); `bumped_at` en los `select` de perfil y
  `profileCache`.

## 15.2 CONTORNO DOURADO VIAJA POR TODAS AS TELAS (2026-07-13, en producción)

El contorno dorado que marca los "Anúncios destacados" (los primeros `featured_count`
anuncios por `bumped_at` desc, ver §15) antes solo se veía en el **inicio**. Ahora acompaña
al mismo anuncio en **todas** las pantallas donde aparece (categorías, resultados de
búsqueda, tienda del vendedor, favoritos), sin costo de velocidad.
- `ListingCard.tsx`: el dibujo del contorno ya existía (prop `featured`, `span` absoluto con
  `border`/`boxShadow`, sin mover el layout) pero solo el inicio (`app/page.tsx`) le pasaba
  los ids destacados a `ListingsFeed`.
- **`frontend/lib/featuredCache.ts`** (nuevo): calcula el mismo conjunto que el inicio (top
  `featured_count` anuncios activos por `bumped_at` desc) y lo guarda en caché de sesión
  (módulo + `sessionStorage`, TTL 60s alineado al `revalidate=60` del inicio). Patrón
  stale-while-revalidate idéntico al de `catalogCache.ts`/`favoritesCache.ts`: no bloquea el
  render, el dorado aparece cuando resuelve.
- **`ListingsFeed.tsx`** (usado por `/listings`, categorías y búsqueda): si `featuredIds` no
  viene del servidor (solo el inicio lo provee), lo carga de `featuredCache`.
- **`StoreClient.tsx`** (`/store/[id]`): mismo patrón, pasa `featured` a cada `ListingCard`.
- **`favorites/page.tsx`**: no usa `ListingCard` (fila propia) — se agregó el mismo estilo de
  borde+brillo inline, condicionado a que el anuncio siga activo.
- Nota: `featuredCache.ts` ya existía en el repo desde antes (commit `fd90011`, sin uso) —
  esta sesión lo conectó en los 3 lugares que faltaban.

## 15.1 BOTÃO "VENDIDO" (2026-07-07, fase-18, en producción)

Solo para anuncios de categorías marcadas `is_product=true` en `/admin` (ver §4, §8). En
`/profile`, junto a Pausar/Destacar, aparece botón "Vendido" (sin emoji, verde `#0F6E56`) cuando
`categories.is_product && status !== 'blocked' && status !== 'sold'`. Al tocarlo abre un modal
propio (no `confirm()` nativo) con 3 pasos: confirmación ("Parabéns pela venda!" + advertencia de
que es permanente) → procesando (spinner) → éxito ("Muito bem!"). Al confirmar **elimina el
anuncio por completo** (fotos en R2 + fila en `listings`), mismo circuito que el botón 🗑
(`performDelete()` en `frontend/app/profile/page.tsx`, factorizada para ambos flujos). No es un
cambio de estado a `sold` — es borrado permanente con UX de logro, tal como lo pidió el usuario.
Query de `/profile` trae `categories(is_product)` embebido en el `select` de `listings`.
- **Futuro:** gatear el cobro **dentro** de la RPC (único punto de entrada); el orden no cambia.
- Detalle: memoria `project_destacar_anuncio`.

## 16. WIDGETS DE INFORMAÇÃO ÚTIL

- **Marés (`MaresWidget.tsx`):** scraping de `tabuademares.com/br/bahia/morro-de-sao-paulo` con
  `cheerio` server-side. API `app/api/mares/route.ts` con `unstable_cache` (revalida 6h). Carga con
  `useEffect` post-render; si falla, no aparece (la home no se rompe). Fondo `#E6F1FB`, grid 2 col.
- **Barcos (`BarcosWidget.tsx`):** datos **hardcodeados** (referencia estática, no administrable).
  Selector de sentido (botones "Morro → Valença" / "Valença → Morro", estado `useState` local,
  default "ida"): cada sentido con su Lancha rápida y Barco convencional propios. Morro→Valença:
  12 + 24 horarios (07:00–18:00). Valença→Morro: 10 + 17 horarios (06:00–18:20). Mismo estilo que
  MaresWidget. Leyenda fija: "O translado passa pelo atracadouro."

## 17. EXPIRACIÓN DE ANUNCIOS (regla fija)

Cron diario `app/api/cron/expire-listings/route.ts` (Vercel Cron, 10:00 UTC):
- **30 días activo** (o `categories.expires_in_days` si no es null) → `status=expired` + email de
  aviso (15 días de gracia). `expires_in_days` SÍ se lee al publicar (`publish/page.tsx`,
  `category?.expires_in_days ?? 30`).
- **Día 14 expirado** → email "se elimina mañana" (fase-12, usa `deletion_warning_sent_at` para no duplicar).
- **Día 15 expirado** → borrado permanente (sin email).
- Reactivar desde `/profile` ("Ativar") → `expires_at = +30 días` fijo + resetea `deletion_warning_sent_at`.
- `fase-13-uniformar-expiracion.sql` (✅) puso produtos/terrenos/casas/alugueis en `expires_in_days=null`
  (antes 20/60 → causaban expiraciones inesperadas). No hay config de expiración desde el admin aún.

## 18. BUGS RESUELTOS — LECCIONES

- **`/favorites` lenta: la pantalla que quedó fuera de todas las optimizaciones (2026-07-16):**
  latencia al entrar reportada por el usuario. **No era la red ni la query**: era la única
  pantalla con datos-con-auth sin caché **ni** prefetch, mientras todo a su alrededor sí los
  tenía (`/profile` prewarmeada en `SessionContext`, `/lojas` con `prefetch` en el `<Link>`,
  las cards con `prefetchListingDetail` en `onPointerDown`). Consultaba de cero en **cada**
  entrada, con spinner bloqueante y en serie (tap → payload RSC → mount → query). Fix: caché de
  sesión + SWR + prefetch en el tap (ver §13). **Lección:** cuando una sola pantalla "se siente
  lenta" y las demás no, sospechar primero de qué patrón del proyecto le falta antes de tocar la
  query — las optimizaciones se aplicaron pantalla por pantalla y es fácil que una quede afuera.
- **Caché local + respuesta tardía = el favorito borrado revive (2026-07-16, detectado en
  revisión ANTES de deploy):** al cachear la lista de favoritos, una query que salió **antes** de
  un toggle vuelve con datos ya viejos y, al escribir el caché, resucita el favorito recién
  sacado (o pierde el recién agregado). Fix: `mutationEpoch` en `favoritesCache.ts` — se captura
  la marca antes de la query y, si cambió al volver, la respuesta se descarta (el toggle local ya
  dejó el caché correcto). **Regla: todo caché con escritura optimista necesita una marca de
  generación que invalide las respuestas en vuelo.** `addFavorite` además anula la lista (no se
  puede fabricar la fila: falta el anuncio embebido) y `removeFavorite` filtra la fila (queda
  completa y válida, sin refetch).
- **Cortina de entrada con JS por defecto-visible = riesgo de brick (2026-07-08, detectado en
  revisión ANTES de deploy):** la 1ª versión de la cortina azul mostraba el overlay por defecto
  (`opacity:1`) y lo escondía con un `<script>` inline. Si el JS no corría, el overlay quedaba
  fijo tapando toda la app. Además el doble `requestAnimationFrame` la escondía en ~32ms
  (imperceptible) y mutar el nodo antes de la hidratación arriesgaba mismatch de React. **Regla:
  un overlay de carga debe poder desaparecer SIN JS.** Fix: reescrita 100% CSS (`animation ...
  forwards` que termina en `visibility:hidden`). Ver §13.
- **Registro (email como nombre, 2026-06-30):** RLS bloqueaba el INSERT a `profiles` en `signUp()`
  (sin sesión con email confirmation). Fix: trigger `AFTER INSERT ON auth.users` `SECURITY DEFINER`
  (`fase-14-trigger-new-user.sql`) que lee `raw_user_meta_data`. `profile/page.tsx` usa
  `user_metadata.full_name` como fallback. Ver `project_registration_fix`.
- **Recuperação de senha:** `resetPasswordForEmail` envía tokens de **8 dígitos** (`maxLength={8}`).
  NO usar `redirectTo` salvo que la URL esté en Supabase → Redirect URLs. Template del email requiere
  `{{ .Token }}`. En `/reset-password`, tras `exchangeCodeForSession` el SDK dispara `SIGNED_IN` (no
  `PASSWORD_RECOVERY`) → mostrar el form directo, no esperar el evento (evita timeout; commit `63b5b0a`).
  Tras 3 logins fallidos: card "Criar nova senha" → `/forgot-password?email=`. Error genérico "Email
  ou senha incorretos" a propósito (evita enumeración). Ver `fix_recuperacion_senha_signin`, skill
  `.claude/skills/recuperacion de senha.md`.
- **Botones WhatsApp en mobile:** `window.open()` bloqueado → usar `<a>` nativo + pre-fetch del
  teléfono. La función `get_seller_whatsapp` faltaba en DB (SQL no ejecutado). Ver `fix_whatsapp_mobile`.
- **Categorías viejas en home tras editar:** el ISR servía cache viejo → `deleteCat`/`toggleCat`/
  `addCategory`/`saveEditCat` llaman `revalidateHome()` (POST fire-and-forget a `/api/revalidate`).
- **Volver desde detalle:** usar `router.back()` (no Link hardcodeado) para preservar filtros. Ver
  `fix_back_navigation`. Mismo patrón aplicado 2026-07-13: `/store/[id]` (estaba fijo a
  `/listings`, ahora usa `router.back()` y respeta de dónde vino el usuario), `/category/[slug]`
  (estaba fijo a `/`, ahora vuelve a `/categorias`) y `/favorites` (estaba fijo a `/`, ahora
  `router.back()` en ambos headers → vuelve al perfil desde donde se entra).
- **Confirmar antes de corregir datos:** divergencias DB-vs-doc pueden ser intencionales; preguntar
  antes de un UPDATE. Ver `feedback_confirmar_antes_de_corregir_datos`.
- **Login mostraba "senha incorreta" por error de red (2026-07-05):** tras reinstalar el PWA, el
  primer intento de login podía fallar por timeout/red inestable (service worker instalándose,
  primer fetch en frío) y `signin/page.tsx` mostraba igual el mensaje de contraseña incorrecta,
  porque `handleLogin` no distinguía el tipo de error de Supabase. Fix: solo se cuenta como
  credencial inválida si `authErr.message` incluye "invalid login credentials"; cualquier otro
  error muestra "Erro de conexão" y no suma al contador que dispara el flujo de recuperación.
- **Hidratación en `SplashScreen` (2026-07-06):** el script inline hacía
  `el.parentNode.removeChild(el)` para esconder el splash fuera del PWA instalado — pero eso pasa
  ANTES de que React hidrate, y React sigue esperando encontrar ese `<div>` (lo renderiza
  `SplashScreen`, un Server Component dentro de `layout.tsx`). Pasaba en TODA carga en navegador
  normal (no solo PWA), porque `!standalone` es el caso común. Fix: no tocar el DOM en ese caso —
  el CSS ya esconde `#mi-splash` por defecto (`display:none`, solo pasa a `flex` en
  `@media (display-mode: standalone/fullscreen)`). También se sacó el `removeChild` final tras el
  fade-out en el caso PWA (se deja el nodo oculto por clase, nunca se remueve) y se agregó
  `suppressHydrationWarning` en `#mi-splash`/`#mi-sponsor` como refuerzo. Verificado con Playwright
  en local: sin mensajes de "hydration" en consola en `/` ni `/listings`.
- **Búsqueda "pa" traía casi todos los anuncios (2026-07-08):** el filtro fase-19 usaba
  substring (`%w%`) sobre `title_norm`/`description_norm`, que coincide en cualquier parte del
  texto — "pa" matcheaba el "para" dentro de descripciones no relacionadas. Fix: `prefixFilter()`
  en `searchNorm.ts` exige inicio de palabra; palabras de 1–2 letras solo buscan en el título. Ver
  §6, commit `80181f1`.
- **Cambios no se veían en `localhost:3000` (2026-07-08):** `RegisterSW.tsx` registraba el service
  worker también en desarrollo; como los chunks de `/_next/static` en dev no tienen hash de
  contenido estable, el SW los servía cache-first y el navegador mostraba JS de un build viejo pese
  a que el código fuente ya estaba actualizado. Fix: registro del SW gateado a
  `NODE_ENV === "production"`. Commit `80181f1`.
- **Las RPC (POST) no tienen el reintento automático que sí tienen las queries (GET)
  (2026-07-16):** un usuario reportó que `/lojas` no cargaba al primer toque del botón y sí al
  segundo. La RPC estaba sana (medida contra producción: ~180ms, devolviendo filas) — el
  problema era del lado del cliente. `postgrest-js` trae reintento propio, pero solo para
  métodos idempotentes (`RETRYABLE_METHODS = ["GET","HEAD","OPTIONS"]`, y
  `if (!RETRYABLE_METHODS.includes(method)) throw fetchError`). Como todas las demás pantallas
  usan `.select()` (GET), se recuperan solas de un microcorte de red **sin que nadie lo note**;
  `/lojas` es la única que se alimenta de una RPC (POST) → 0 reintentos, y cualquier tropiezo de
  red (o la renovación del token en la primera entrada del día, ver el prewarm de sesión más
  arriba) llegaba a la pantalla como error duro. Agravante: el error no tenía botón de reintento,
  así que la única salida era volver a tocar. Fix: reintento acotado dentro de `fetchStores`
  (`lib/lojasApi.ts`) solo para fallos transitorios (`status === 0` = capa de red, `>= 500`,
  `57014` = statement timeout) — un error real de la base se propaga en el acto porque no se cura
  solo — y cartel con botón "Tentar novamente" en `LojasClient.tsx`. Ojo con el abort: una
  consulta cancelada (cambiar orden/filtro, salir de la pantalla) **también** cae como
  `status: 0`, así que hay que chequear `signal?.aborted` antes de reintentar o se re-disparan
  consultas viejas. **Regla: al agregar una pantalla que se alimente de una RPC, el reintento hay
  que ponerlo a mano — no viene gratis como en las queries normales.** Verificado con Playwright
  interceptando la RPC: con 1 y 2 cortes de red la lista carga igual (el usuario nunca ve el
  error), con caída total aparece el cartel y el botón trae las lojas; cambiar el orden dispara
  exactamente 1 consulta (sin reintentos espurios por el abort).
- **Un prefetch/prewarm en el cliente acorta el arranque en frío, no lo elimina (2026-07-18):**
  el fix del 2026-07-16 para la descripción lenta "primera vez del día" (prefetch en
  `onPointerDown` + query de precalentado en `SessionContext`) seguía dependiendo de una query
  cliente que corre después de tocar el anuncio — la ventana que gana es real pero acotada, y
  el usuario reportó que el síntoma volvió al probarlo a la mañana siguiente. **Regla:** si un
  dato puede viajar server-rendered (ISR) en vez de necesitar una query cliente, preferir
  moverlo ahí antes que optimizar la query cliente — elimina la clase de problema en vez de
  acortarla. Fix aplicado: `description` ahora viaja en `LISTINGS_SELECT`/`STORE_SELECT` y se
  pinta desde el preview de la card, sin esperar ninguna query. Ver §13.
- **Un rediseño de componente puede resucitar bugs ya arreglados (2026-07-15):** el rediseño de
  navegación (commit `3d80e9b`) reemplazó el `HomeClient` viejo por `ListingsFeed.tsx` compartido,
  y en el camino se perdió silenciosamente el `priority={i<4}` de las primeras cards (fix de LCP
  de la Fase 1 del plan V1) — nadie lo notó porque el build sigue pasando igual, el síntoma es
  visual (parpadeo) y solo aparece en la app real. **Regla:** al reemplazar/unificar un componente
  que ya tenía optimizaciones de rendimiento, auditar explícitamente qué props/comportamientos del
  componente viejo NO llegaron al nuevo — el build y el type-check no detectan esta clase de
  regresión. Ver fix completo en §13.

## 19. PENDIENTES / IDEAS

- **`OPTIMIZATION_MASTER_PLAN.md`:** Fases 1-5 **EN PRODUCCIÓN** (Fases 1-2: push a `main` → deploy
  Vercel, `5ef6493`, código en `fd32be8` y `de86814`; Fase 3: detalle instantáneo T9-T11, push a
  `main` → deploy Vercel, `f202fed`, código en `76dc20f`; Fase 4: SW reescrito v5 + offline, T12-T13,
  push a `main` → deploy Vercel, `e319409`, código en `cc02242` — desplegada 2026-07-07 sin probar en
  Android real, decisión consciente al no haber usuarios activos aún; verificado sí con Playwright/
  Chromium en local + build de producción manual del usuario, ver detalle en `project_state.md`;
  Fase 5: uploads en paralelo + edit server-side + store con SessionContext + splash sponsor
  liviano, T14-T17, push a `main` → deploy Vercel, `4f53c12` — desplegada 2026-07-07, verificada con
  `tsc --noEmit` tras cada tarea + `npm run build` final sin errores. Probado a mano en producción
  2026-07-07: publish/edit con fotos reales ✅, `/store/[id]` ✅. (El slot del splash con banner
  activo nunca llegó a probarse: el splash propio se eliminó el 2026-07-08, ver abajo.)
  Fase 6: T18 Web Vitals reales de producción vía `@vercel/speed-insights` (`<SpeedInsights />` en
  `layout.tsx`, gratis en plan Hobby, habilitado por el usuario en el panel de Vercel), push a `main`
  → deploy Vercel, `a7b72bf` — desplegada 2026-07-07. **`OPTIMIZATION_MASTER_PLAN.md` completo
  (Fases 1-6), no quedan fases pendientes del plan.**
- (Confirmadas ✅: fase-9, 10, 11-delivery-zonas, 12, 13, 14, 17, 18-produto-vendavel,
  monetizacion-tracking, splash-sponsor — corridas por el usuario 2026-07-07.)
- **Splash propio + slot patrocinador: ELIMINADO 2026-07-08** (decisión del usuario). Tras la
  Fase 2 del plan V2 (splash nativo del OS, T7/T8) el splash propio quedó redundante: el usuario
  veía DOS pantallas azules con el logo en posiciones distintas al abrir el PWA. Se borraron
  `SplashScreen.tsx` y `SplashSponsorSync.tsx`, se quitó la opción "Splash" del admin de banners,
  y se movió a `globals.css` la única pieza que se conserva: `html { background: var(--blue-main) }`
  en `display-mode: standalone/fullscreen` (seguro anti-flash-blanco). Beneficio extra: −350ms de
  espera artificial por apertura. **Si el usuario vende un patrocinador de apertura**: el splash
  nativo del OS no puede mostrar contenido dinámico → habrá que RECREAR una mini-cortina
  "Oferecido por" (el usuario lo sabe y lo pedirá en su momento; la posición `splash` sigue
  aceptada en la DB, referencia histórica en commits `1beb9f1`/`99b1c8d`).
- (Confirmada ✅ Íconos PWA con el logo real + variante `maskable`: T7 de
  `OPTIMIZATION_MASTER_PLAN_V2.md` Fase 2, en producción 2026-07-08 — ver §13.)
- Republicar anuncio vencido con 1 clic desde el perfil.
- Filtros adicionales en listados: precio, sub-zona.
- Panel admin: gestión de localidades y sub-zonas.
- WhatsApp de Maria Agustina: confirmar si tiene número en metadata; si no, que lo cargue.
- Buscador: revisar sinónimos tras 15 días de medición (`SIGUIENTES_PASOS_BUSCADOR.md`).
- (Confirmada ✅ fase-19-busca-sem-acentos: corrida por el usuario 2026-07-07 — ver §6.)
- (Confirmada ✅ cache de sugerencias del buscador en `sessionStorage`: T5 de
  `OPTIMIZATION_MASTER_PLAN_V2.md` Fase 1, en producción 2026-07-08 — ver §13.)
- **CLS 0.47 (Poor) en mobile**, detectado en Speed Insights el 2026-07-08 (foto tomada por el
  usuario ANTES del deploy de la Fase 1 del plan V2) — no estaba en la auditoría original.
  Ruta con peor score: `/store/[id]` ("Needs Improvement", 52). Pendiente: investigar qué elemento
  salta el layout (candidatos: banner rotativo, imágenes sin dimensiones reservadas, fuentes) y
  corregirlo en una fase futura del plan V2.
- **`OPTIMIZATION_MASTER_PLAN_V2.md`:** Fases 1 (T1-T5), 2 (T6-T9), **3 (T10-T11) y 4 (T12-T13)
  en producción** desde 2026-07-08 — detalle técnico en §13. Queda solo la **Fase 5 (T14):
  validación con Web Vitals reales** (Speed Insights), que **no toca código**. El usuario pidió
  específicamente retomarlo el **20 de julio de 2026** (le avisó a Claude, pero los recordatorios
  automáticos no sobreviven tantos días — así que si se abre sesión cerca de esa fecha, avisar
  y comparar p75 de LCP/INP/CLS por ruta contra la foto inicial (guardada en §13). Recordar de
  paso el hallazgo del **CLS 0.47 en `/store/[id]`** (pendiente aparte, ver arriba en §19).
- (Resuelta ✅ splash azul al abrir desde el navegador: implementada 2026-07-08, ver §13/§22.)
- (Resuelta ✅ cache 1 día de los íconos de instalación (`apple-touch-icon.png` etc.) en
  `frontend/next.config.mjs`: iba pendiente de una sesión anterior, se empaquetó y subió junto
  con el commit `3d881f9` del 2026-07-20 — descripción con formato.)
- (Confirmada ✅ fase-26-lojas-directory.sql: corrida por el usuario — RPC `get_stores` en
  producción, ver §20.)

## 20. DIRETÓRIO DE LOJAS (`/lojas`) + FAVORITOS NO HOME (2026-07-15)

Prompt de ejecución: `PROMPT_LOJAS_FAVORITOS.md` (mejoras pre-aprobadas por el usuario, no
volver a preguntarlas si se retoma esta feature).

- **Favoritos se mudó del perfil al home:** el pill "❤️ Favoritos" vive ahora en la
  fila Ordenar/Filtrar del feed, activado por la nueva prop `homeExtras` de `ListingsFeed.tsx`
  (`justifyContent: space-between`, pills nuevos a la izquierda). Solo el home la activa —
  `/listings` y las páginas de categoría no la ven (siguen con `flex-end`, sin extras). En
  `/profile` la grilla quedó en 2 columnas (Minha loja / Compartilhar).
  **2026-07-16:** el pill llevaba contador (`❤️ N` cuando el usuario tenía favoritos) y pasó a
  etiqueta fija "❤️ Favoritos" siempre, a pedido del usuario. El estado `favoriteIds` sigue
  vivo en `ListingsFeed.tsx`: alimenta los corazones de cada card, solo dejó de pintar el número.
  **2026-07-16 (velocidad):** el pill sumó `prefetch` en el `<Link>` (como el de "Lojas") y
  `prefetchFavoritesList(session.user.id)` en `onPointerDown` → al entrar, la lista ya viajó.
  Ver §13 y la lección en §18.
- **Nuevo pill "🏪 Lojas"** en la misma fila → `/lojas`.
- **`/lojas`** (`frontend/app/lojas/page.tsx` + `LojasClient.tsx`, ruta `○ Static`): buscador
  con sugerencias mientras se escribe (mismo patrón que `BuscaAutocomplete.tsx`: debounce,
  `searchNorm` sin acentos, AbortSignal), filtro por localidad, orden (Mais anúncios / Mais
  procuradas / Nome A-Z) vía `OrdenarSheet`/`FiltrarSheet` reutilizados, paginación "Ver mais".
  Solo lista tiendas con ≥1 anuncio activo; cada card muestra avatar, nombre, cantidad de
  anuncios y chips de localidades donde tiene anuncios activos.
- **Fuente de datos:** `frontend/lib/lojasApi.ts` (`fetchStores`) → RPC `get_stores`
  (`supabase/fase-26-lojas-directory.sql`, **corrida por el usuario ✅**, ver §19). Una sola
  consulta (sin N+1): id/nombre/avatar/conteo de anuncios
  activos/localidades. Orden "Mais procuradas" = contactos por WhatsApp de los últimos 30 días
  (agregado sobre `whatsapp_clicks`, que tiene RLS solo-admin — la RPC expone únicamente el
  conteo, `security definer`, `set search_path = public`, `grant execute` a `anon` +
  `authenticated`). Solo expone datos públicos, los mismos que `profiles_public` (jamás
  `whatsapp` ni `role`).
- **Reintento propio (2026-07-16):** por ser RPC (POST) no hereda el reintento
  automático de postgrest-js, que solo cubre GET/HEAD/OPTIONS. `fetchStores` reintenta a mano los
  fallos transitorios (2 reintentos, 400ms/1200ms; `status === 0` / `>= 500` / `57014`) sin tocar
  el camino feliz, y `LojasClient.tsx` muestra cartel + botón "Tentar novamente" si aun así falla.
  No reintentar cuando `signal?.aborted` (el abort también da `status: 0`). Ver la lección en §18.

## 21. CORRER LOCALMENTE

```bash
cd frontend
npm run dev                  # http://localhost:3000
npm run dev -- -H 0.0.0.0    # accesible desde celular en misma WiFi (IP Mac ~192.168.10.9)
npx localtunnel --port 3000  # URL pública HTTPS temporal (sin WiFi compartido)
```
Deploy: repo GitHub conectado a Vercel (root `frontend`), región `gru1`. Auth Email/Password
habilitado en Supabase; `admin_settings.admin_whatsapp` con el número real; primer usuario con
`role=admin`.

## 22. CHANGELOG DE SESIONES

Registro cronológico de cierres de sesión (más reciente arriba). Detalle estructural de cada
feature va en su sección numerada correspondiente; acá solo un resumen con fecha y commit.

- **2026-07-20** — **Desplegado** (commit `4aab594`, push a `main`). **Reordenar banners +
  fix avatar quebrado.** (1) `/admin` tab "Banners": flechas ↑↓ para reordenar (`moveBanner`,
  actualiza `sort_order` de todos vía `Promise.all`, mismo patrón que categorías) — pedido del
  usuario al notar que siempre arrancaba con el mismo banner al entrar a la página. Detalle en §7.
  (2) Fix de una sesión anterior sin commitear: en `AvatarUpload.tsx` la key del avatar en R2 pasó
  a incluir `profiles/{userId}/…` (antes solo `profiles/{uuid}.ext`) para que `/api/delete-file`
  pueda validar dueño por el path de la key en vez de comparar contra `profiles.avatar_url` (que
  puede quedar desactualizado justo después de subir uno nuevo); además el `UPDATE` de
  `avatar_url` en la tabla ahora corre ANTES de borrar el archivo viejo en R2, para no dejar el
  campo apuntando a un archivo ya eliminado si el update fallara. También se agregó fallback
  `onError` (ícono 👤/🏪 en vez de imagen rota) en los avatares de `/listings/[id]`, `/store/[id]`,
  `/lojas` y `AvatarUpload` — relacionado con el 404 de avatar roto en R2 que ya se había detectado
  como preexistente el 2026-07-06 (ver §22 más abajo, Fase 3). Verificado: `npm run build` OK, sin
  cambios de rutas estáticas/ISR.
- **2026-07-20** — **Desplegado** (commit `20ab1f0`, push a `main`). **Prewarm del catálogo de
  categorías + fix barra de Safari.** (1) `CategoriasClient.tsx`: precalienta en idle el catálogo
  de categorías (`loadCategories()`) al pintar `/categorias`, para que la primera categoría SIN
  subcategorías que se toca en la sesión abra con un solo viaje de red en vez de dos (antes tenía
  que resolver el slug antes de poder pedir los anuncios). Sin cambios visibles. Detalle en §13.
  (2) `app/layout.tsx`: fix de un bug conocido de Safari mobile (solo navegador, no PWA
  instalado) donde la barra de Safari queda expandida tapando parte del banner azul del topo en
  la carga inicial — se fuerza un scroll de 1px al terminar de cargar (`scrollTo(0,1)`, solo si
  `scrollY===0` y no está en modo standalone) para que Safari recalcule su chrome sin que se
  note. Verificado: `npm run build` OK, ninguna ruta pasó a dinámica (`/categorias` sigue
  `○ Static`).
- **2026-07-18** — **Desplegado** (commit `c5d8d6b`, push a `main`). **Fix splash nativo iPhone**:
  las 8 imágenes `apple-splash-*.png` todavía tenían el wordmark viejo (se generan por fuera del
  repo, quedaron desactualizadas al aplicar el rediseño de logo); regeneradas con el logo nuevo.
  Detalle en §6.
- **2026-07-18** — **Desplegado** (commit `2285c3b`, push a `main`). **Rediseño de logo "Equilíbrio clássico"**
  (wordmark vectorizado, "Tinharé" naranja centrado bajo "Mercado ilha") + **horários de barcos
  volta Valença→Morro** (selector de sentido en `BarcosWidget.tsx`) + **fix e-mails con
  `logo.svg` blanco invisible** → pasaron a `logo-dark.svg` (`api/upload/route.ts`,
  `api/cron/expire-listings/route.ts`). Detalle del logo en §6, barcos en §16.
- **2026-07-18** — **Desplegado** (commit `2285c3b`, push a `main`). **Fix definitivo:
  descripción lenta la primera vez del día.** El fix del 2026-07-16 (prefetch + prewarm) no
  alcanzaba: seguía dependiendo de una query cliente. Ahora `description` viaja server-rendered
  con el feed (`LISTINGS_SELECT`/`STORE_SELECT`) y se pinta desde el preview de la card al
  instante, sin esperar ninguna query. Archivos: `lib/listingsApi.ts`, `lib/listingPreview.ts`,
  `components/ListingCard.tsx`, `app/listings/[id]/ListingDetailClient.tsx`,
  `app/store/[id]/StoreClient.tsx`. Verificado: `npm run build` OK, `/` `○ Static`,
  `/listings/[id]` `●` SSG. Ver §13 y §18.
- **2026-07-16** — **Desplegado** (commit `8d9277d`, push a `main`). **Latencia al entrar a
  `/favorites` + miniaturas 20% más grandes.** La demora no era la red ni la query: `/favorites`
  era la única pantalla con datos-con-auth **sin caché ni prefetch** (el perfil se prewarmea en
  `SessionContext`, `/lojas` tiene `prefetch`, las cards prefetchean el detalle en el tap), así
  que consultaba de cero en cada entrada con spinner bloqueante. Fix: `lib/favoritesCache.ts`
  ahora también es dueño de la lista completa (caché de sesión + stale-while-revalidate) y el
  pill "❤️ Favoritos" dispara `prefetchFavoritesList()` en `onPointerDown` + `prefetch` en el
  `<Link>` → entrada repetida sin espera, entrada fría con la query en paralelo a la navegación.
  **Sin costo nuevo en el arranque** (no se agregó query al `SessionContext`). En la revisión
  apareció y se cerró un bug de caché: una respuesta en vuelo podía revivir un favorito recién
  borrado → guarda `mutationEpoch`. Miniaturas +20%: `/favorites` 72→86px y "Meus anúncios"
  62px (era 52). Verificado: `tsc --noEmit` limpio, `npm run build` 56 páginas, `/favorites`,
  `/` y `/profile` siguen `○ Static`. Ver §13 (patrón), §18 (2 lecciones), §6 y §20.
- **2026-07-16** — **Desplegado** (commit `f56f4d8`, push a `main`). Segunda vuelta sobre el
  perfil/loja de la misma sesión: banner del perfil pasó de card con margen a **edge-to-edge**
  (igual que el de la loja); fotos de perfil agrandadas (perfil 80→104px, loja 72→84px);
  botón "Minha loja" → "Ver minha loja" sin emoji; botones "Ver minha loja"/"Compartilhar"
  de outline a fondo blanco sólido con texto azul; espaciado entre banner y anuncios de la
  loja ajustado a 0.25rem (mitad del original). Ver §6.
- **2026-07-16** — **Desplegado** (commit `d60e8c2`, push a `main`). Card de datos del
  perfil pasó a fondo azul (mismo degradado del banner de la loja) con todo su contenido
  adaptado a tonos claros; espaciado de `/store/[id]` ajustado para que los anuncios queden
  pegados al banner igual que entre sí. Ver §6.
- **2026-07-16** — **Desplegado** (commit `6f0df5c`, push a `main`). Varios ajustes
  acumulados de esta sesión y de sesiones previas, todos subidos juntos en un mismo commit:
  - **Botón "Ver loja" más grande** en `/listings/[id]` y **pill "Lojas" del home con el
    mismo estilo sólido azul** que "Ver loja" (antes outline gris), texto sin cambios. Ver §6.
  - Fix descripción lenta la primera vez del día (prefetch en `onPointerDown` + prewarm de
    sesión). Ver §18 y `project_fix_parpadeo_demoras` (memoria).
  - **Fix `/lojas` no cargaba al primer toque** (reportado por un usuario real): la RPC
    `get_stores` viaja por POST y postgrest-js solo reintenta GET/HEAD/OPTIONS → era la única
    pantalla sin red de contención ante un tropiezo de red. `fetchStores` ahora reintenta lo
    transitorio (2 reintentos, 400ms/1200ms) y la pantalla ganó cartel + botón "Tentar
    novamente". Ver §18 y §20.
  - Pill "❤️ Favoritos" del home sin contador (siempre texto fijo). Ver §20.
  - Barra inferior más alta y despegada del borde (`--nav-height` 64→72px). Ver §6.
  - Cooldown de "Destacar" bajado de 1h a 15min (RPC + textos del perfil). Ver §15.
  - Fix bucle de navegación atrás editar↔detalle + flujos de volver en publicar
    (`lib/safeBack.ts` nuevo). Ver §18.
  - **Buscador: elegir una sugerencia ya no corta el tipeo** (`BuscaAutocomplete.tsx`) — el
    primer toque sobre un término siempre completa la barra y deja el cursor tras el espacio
    (teclado abierto); el segundo toque sobre ese término ya elegido busca. El espacio final no
    entra en la búsqueda. De paso: el hover ya no secuestra el botón Buscar en desktop. Ver §6.
  - **Instalar App en iPhone: quitado el logo grande del encabezado** (`InstalarClient.tsx`,
    solo para `platform === "ios"`; Android y desktop conservan el logo) — el usuario lo vio
    ocupando demasiado espacio arriba; el resto del contenido (título, texto, video) sube para
    ocupar ese lugar.
  - Build ✅ (`tsc --noEmit` sin errores) tras cada cambio; sin verificación manual en
    dispositivo real todavía.
- **2026-07-15** — **Dos entregas en un mismo cierre: fix parpadeo/demoras + directorio de Lojas.**
  **Desplegado** (commit `bfdb783`, push a `main`).
  - **Fix parpadeo + demoras post-V3** (sesión Opus, diagnóstico verificado con mediciones):
    prioridad de imagen restaurada en las primeras 4 cards del home, "Atualizando…" ya no
    empuja el grid, prefetch de la query completa del detalle al tocar una card, prewarm del
    perfil alineado con miniaturas + stats. Detalle técnico: §13; lección de la regresión: §18.
  - **Directorio de Lojas (`/lojas`) + Favoritos movido al home** (sesión previa, prompt
    `PROMPT_LOJAS_FAVORITOS.md`): pills "🏪 Lojas"/"❤️ Favoritos" en la fila Ordenar/Filtrar del
    home, RPC `get_stores` (fase-26, SQL corrido ✅). Detalle completo: §20.
- **2026-07-13** — **El contorno dorado de "destacados" ahora viaja por todas las pantallas.**
  **Desplegado** (commit `05aba05`, push a `main`).
  - Antes solo se veía en el inicio. Se agregó `frontend/lib/featuredCache.ts` (caché de
    sesión del mismo conjunto de ids destacados, TTL 60s) conectado en `ListingsFeed.tsx`
    (categorías/búsqueda), `StoreClient.tsx` (tienda del vendedor) y `favorites/page.tsx`
    (estilo inline, mismo look). Detalle: §15.2.
- **2026-07-13** — **Fix botón volver en Favoritos + botões "Falar com o vendedor" e
  "Compartilhar loja" lado a lado na loja.** **Desplegado** (commit `fd90011`, push a `main`).
  - `/favorites` (`page.tsx`): el botón ← estaba hardcodeado a `<Link href="/">`, siempre volvía
    a inicio. Cambiado a `router.back()` (mismo patrón que `fix_back_navigation`, §18), en los dos
    headers (logueado y no-logueado). Ahora al entrar desde el perfil vuelve al perfil.
  - `/store/[id]` (`StoreClient.tsx`): los botones "Falar com o vendedor" y "Compartilhar loja"
    pasaron de apilados (columna) a **lado a lado** (fila). Cada uno `flex:1 1 0` (igual ancho),
    `alignItems:stretch` (igual altura), `fontSize 0.8rem`, `lineHeight 1.15`, `textAlign center`
    y `minWidth:0` para que el texto se acomode en 2 líneas parejas si la fuente del sistema es
    más ancha (Roboto Android vs SF iPhone). Contenedor `maxWidth 380` centrado.
- **2026-07-13** — **Botón "Minha loja" en perfil + fix de 2 botones volver (loja y categoría
  con subcategorías).** **Desplegado** (commit `9ad8b4a`, push a `main`).
  - `/profile`: se agregó un 3er botón "Minha loja" (link a `/store/[id]` propio) junto a
    "Compartilhar" y "Favoritos" — los tres ahora en una fila de 3 columnas.
  - `/store/[id]` (`StoreClient.tsx`): el botón ← estaba hardcodeado a `<Link href="/listings">`,
    por lo que siempre volvía a todos los anúncios sin importar de dónde venía el usuario (ej.
    desde `/profile`). Cambiado a `router.back()`, mismo patrón que `fix_back_navigation`. Ver §18.
  - `/category/[slug]` (categoría con subcategorías, ej. Produtos): el botón ← estaba hardcodeado
    a `<Link href="/">`, por lo que siempre volvía a inicio en vez de a `/categorias`. Corregido
    a `href="/categorias"`. Ver §18.
- **2026-07-11** — **Fix: el botón "Instalar App" en Android no disparaba el prompt.**
  **Desplegado** (commit `9878ae4`, push a `main`).
  - Causa raíz: el evento `beforeinstallprompt` (Chrome/Android) se dispara UNA sola vez y
    muy temprano en la carga del documento, y NO se vuelve a disparar en las navegaciones
    client-side de Next. Cada componente (`InstalarClient.tsx`, `InstallCtaButton.tsx`) lo
    escuchaba en su propio `useEffect` → al llegar a `/instalar` por navegación interna el
    evento ya había pasado y el botón quedaba gris/inerte ("no funciona").
  - Fix: captura global y temprana. Un script inline síncrono en el `<head>`
    (`app/layout.tsx`) guarda el evento en `window.__deferredInstallPrompt` antes de que
    React monte y emite `bip-ready`. Nuevo `lib/installPrompt.ts` (`getInstallPrompt` /
    `onInstallPromptChange` / `triggerInstall`) es la interfaz única; ambos botones leen de
    ahí en vez de tener su propio listener. Así el prompt sobrevive a la navegación interna.
  - iPhone SIN cambios: en iOS la instalación es manual por Safari (video de pasos), no usa
    `beforeinstallprompt`. Revisado y OK.
  - Para testear en Android: si la app YA está instalada, Chrome no vuelve a ofrecer
    instalarla (comportamiento normal) → desinstalar primero. Build OK, `/instalar` sigue
    `○ Static`.
- **2026-07-11** — **OPTIMIZATION_MASTER_PLAN_V3: Fases 1 a 5 (T1-T10, T12) desplegadas.**
  **Desplegado** (commit `8ba77ad`, push a `main`). T13 evaluada y descartada
  por decisión del usuario ("ya funciona super bien", beneficio incremental vs. riesgo de
  frescura — el propio plan recomendaba no hacerla ante la duda). T11 no se ejecutó:
  condicional a que la Fase 0/6 muestre >70% del cupo de Image Transformations, no se dio.
  T14 (guardarraíl mensual, sin código) queda agendada para 2026-07-20.
  - **Fase 1 — DB lista para volumen** (`supabase/fase-20-retencion-tracking.sql`,
    `fase-21-indices-escala.sql`, `fase-22-rls-initplan.sql`, ya corridos por el usuario en
    sesión previa): retención de tracking (`prune_tracking()` enganchada al cron de
    `expire-listings`, purga `listing_views` >90d / `search_queries` y `banner_clicks`
    >180d; `whatsapp_clicks` NO se poda), índices parciales `WHERE status='active'` para
    las 3 formas de la query caliente de listas, y políticas RLS reescritas con
    `(select auth.uid())`/`(select is_admin())` + `to authenticated` en `listings`,
    `listing_photos`, `listing_service_zones`, `favorites` (menos costo por fila, matriz de
    seguridad verificada: anónimo solo ve `active`, dueño ve todo lo propio, admin ve todo).
  - **Fase 2 — Profundidad de catálogo**: paginación keyset (`created_at`+`id` como
    cursor, NO offset) en `/listings` con botón "Carregar mais anúncios"
    (`ListingsClient.tsx`, `listingsApi.ts`); mismo patrón con `.limit(30)` + "Ver mais" en
    `/store/[id]`; recorte de queries repetidas (skip de revalidación si el caché tiene
    <60s, alineado al ISR; cache de nombres de subcategoría en `catalogCache.ts`).
  - **Fase 3 — INP bajo interacción**: la persistencia de `sessionStorage` en
    `listingsCache.ts` se partió en clave `meta` (scroll/filtros, escritura sync barata) y
    clave `results` (grande, se escribe en `requestIdleCallback`/`pagehide`/
    `visibilitychange`, fuera del camino del click); `onToggleFavorite` con referencia
    estable (ya no re-renderiza las 60 cards por cada toggle); `pointer-events: none` en la
    cortina azul de entrada (`#browser-splash`, `globals.css`) para que los taps tempranos
    no se pierdan.
  - **Fase 4 — Imágenes a escala**: `deviceSizes`/`imageSizes` de `next.config.mjs`
    acotados al layout real (máx 480px CSS, DPR 3 → 1440px techo útil), sacando variantes
    ≥1920px que ningún dispositivo pedía. T11 (servir solo WebP) NO se activó (condicional
    no cumplida).
  - **Fase 5 — SW v7**: `CACHE_VERSION` v6→v7, `IMAGES_LIMIT` 60→150 (una sola pasada por
    `/listings` ya no desaloja el caché de imágenes entero); propaga a dispositivos ya
    instalados vía `updateViaCache: "none"` (`RegisterSW.tsx`) sin necesidad de reinstalar.
  - Cada fase verificada con `npm run build` (rutas se mantienen `○`/ISR) antes de
    acumular la siguiente; deploy único al final de las 5 fases (decisión del usuario:
    acumular en vez de desplegar fase por fase).
- **2026-07-11** — **Unificado el botón "Instalar App" del home y del perfil con el de la
  pantalla "Entrar".** **Desplegado** (commit `8ba77ad`, push a `main`).
  - Antes: `/` y `/profile` mostraban `InstallAppCard` (tarjeta desplegable con instrucciones
    paso a paso). `/signin` mostraba `InstallSigninStrip` (franja azul "Instale o Mercado Ilha" +
    botón naranja "Instalar App" vía `InstallCtaButton`, que ya resolvía Android con prompt nativo
    e iPhone/otros llevando a `/instalar`).
  - Ahora los tres usan **el mismo componente `InstallSigninStrip`**: visual y funcionamiento
    100% idénticos en las tres pantallas (decisión del usuario: no quería variantes distintas).
  - `HomeClient.tsx`: la franja quedó en el mismo lugar donde estaba la tarjeta vieja (después de
    "Informação útil", antes de "Fale conosco") — el usuario eligió **no** moverla arriba de todo.
  - `app/profile/page.tsx`: la franja se movió **arriba de todo, antes del header azul** ("Meu
    perfil" y también en el estado "no logueado"), igual ubicación relativa que en `/signin`.
  - `InstallAppCard.tsx` **eliminado** (quedó sin ningún uso tras el cambio). `InstallInstructions.tsx`
    se conserva porque lo sigue usando `/instalar` (`InstalarClient.tsx`).
  - Verificado con `npm run build` (`/` y `/profile` siguen `○ Static`) y con screenshots
    Playwright/Chromium de las tres rutas en local, comparando visualmente la franja.
- **2026-07-10** — **Video de instalación (iPhone/Safari) reeditado + arreglos del flujo de
  instalación.** **Desplegado** (commit `ec9769f`, push a `main`).
  - `public/videos/instalar-safari.mp4` reemplazado por una reedición hecha con ffmpeg desde el
    crudo procesado: **intro de 1s** (primer cuadro congelado para que el espectador se ubique),
    **datos personales difuminados** (la fila de contactos de la hoja de compartir), y las marcas
    de "dónde tocar" ahora con la **forma del botón** — pill en "Adicionar", recuadro redondeado
    en las filas "Compartir" y "Adicionar à Tela de Início"; los toques sobre botones redondos
    (3 puntitos, "Ver mais") siguen circulares. Técnica: el círculo naranja pulsante estaba
    quemado en el video → se borró con un "plate" limpio (cuadro del valle del pulso, UI estática)
    y se redibujó el contorno correcto como overlay PNG pulsante. Crudos en
    `Mercado Ilha Info/Videos instalacion iphone/` (fuera del repo).
  - **`public/logo-dark.svg` nuevo**: wordmark "Mercado Ilha"/"Tinharé" en negro (`#1a1a1a`),
    ícono de la bolsa intacto (los 2 blancos del ícono se conservan; los 18 del texto → negro).
    Para fondos claros: usado en el popup (`InstallInvitePopup.tsx`) y en `/instalar`
    (`InstalarClient.tsx`) — el texto blanco era invisible sobre blanco (afectaba iOS **y Android**;
    la pantalla que se abre en Chrome es la misma `/instalar`). El home (`HomeClient.tsx`) y la
    cortina de carga (`app/layout.tsx`) siguen con `logo.svg` blanco sobre azul.
  - **Popup de invitación** (`InstallInvitePopup.tsx`): ahora aparece **máximo 1 vez por día**
    (localStorage `install_popup_last_shown_at`, 24 h). Antes aparecía en cada apertura.
  - `InstallInstructions.tsx`: **quitado** el texto "É preciso estar no Safari…" que iba encima
    del video. Build OK, `/instalar` sigue `○ Static` (4.33 kB).
- **2026-07-10** — `OPTIMIZATION_MASTER_PLAN_V3.md` creado (sin código, auditoría del código en
  producción para escalar a 1000+ usuarios manteniendo el mantenimiento 100% gratis) y **Fase 0
  (T0, foto inicial de consumo) completada** — datos aportados por el usuario desde los paneles:
  - **Vercel Usage (plan Hobby, ciclo actual)**: Fast Data Transfer 388.54MB/100GB (0.4%), Fast
    Origin Transfer 72.31MB/10GB (0.7%), Edge Requests 30K/1M (3%), ISR Reads 6K/1M (0.6%), ISR
    Writes 2.3K/200K (1.2%), Function Invocations 7.5K/1M (0.75%), Image Transformations
    177/5K (3.5%), Image Cache Reads 773/300K (0.3%), Image Cache Writes 1.5K/100K (1.5%),
    Speed Insights Data Points 281/10K (2.8%). **Ninguno cerca del umbral de alerta (70%).**
  - **Supabase (plan free)**: DB size 0.03GB/500MB (6%), Egress 0.033GB/5GB (0.7%), 8 MAU.
    Filas de tracking: `listing_views` 209, `search_queries` 29, `whatsapp_clicks` 83,
    `banner_clicks` 15 — chico hoy, pero **crece sin retención** (confirmado en el código, T1
    del plan V3 lo resuelve).
  - **Speed Insights (mobile, 24h, activado hace poco → solo `/` tiene muestras)**: RES 97
    (Great), FCP 2.04s, LCP 2.11s, INP 104ms, **CLS 0** (vs. 0.47 "Poor" medido el 2026-07-08
    antes del plan V2 — parece resuelto, a confirmar con más muestras), FID 37ms, TTFB 0.25s,
    41 visitas. `/listings`, `/listings/[id]`, `/store/[id]` **pendientes de medir** (sin
    tráfico suficiente aún en la ventana de 24h) — retomar junto con la Fase 5 del plan V2
    (T14) agendada para el 2026-07-20.
  - Prefetch de cards (`_rsc`, dato para la Contingencia C3 del plan V3): **salteado** por
    decisión del usuario, no bloqueante.
  - **Umbral de alerta fijado: 70% de cualquier cupo** → dispara T11/C1/C2/C3 del plan V3.
    Con los números de hoy, nada se activa. Próximo paso del plan V3: **Fase 1 (T1-T3)**.
- **2026-07-08** — **Cortina azul al abrir desde el navegador**, **desplegado** (commit
  `a95098c`, push a `main`). Pedida por el usuario tras cerrar (por ahora) el plan V2.
  Div + script inline en `app/layout.tsx` + CSS en `globals.css` con `@media (display-mode:
  standalone)` para que el PWA instalado no la vea (conserva su splash nativo). Detalle técnico
  en §13. Se agendó retomar la Fase 5 (T14, medición real) el 20 de julio de 2026.
- **2026-07-08** — `OPTIMIZATION_MASTER_PLAN_V2.md` **Fase 4 (T12-T13)**, **desplegado** (commit
  `03d8dd6`, push a `main`). T12: la query del detalle (`listings/[id]/ListingDetailClient.tsx`)
  dejó de traer `*` + `listing_photos(*)`; ahora pide columnas explícitas (las auditadas por uso
  real, más un margen seguro de escalares) y `listing_photos(id, photo_url, sort_order)` → payload
  del detalle más chico sin cambiar nada en pantalla. T13: `/favorites` ahora trae **1 foto por
  anuncio** (la primera por `sort_order`) usando la sintaxis anidada de dos niveles
  `referencedTable: "listings.listing_photos"` con `.order`+`.limit(1)` — **verificada contra la
  DB real** antes de aplicar (probado que el `limit` punteado recorta el nivel más profundo:
  9→1). Antes traía hasta 6 fotos por favorito. Build: 52 páginas, `/favorites` y `/listings`
  siguen `○ Static`, detalle `● SSG` — ninguna ruta se degradó. Con esto, el plan V2 solo deja
  pendiente la Fase 5 (T14, validación con datos reales, sin código). Commit: `03d8dd6`.
- **2026-07-08** — `OPTIMIZATION_MASTER_PLAN_V2.md` **Fase 3 (T10-T11)**, **desplegado** (commit
  ver hash abajo, push a `main`). T10: caché de `/listings` espejado en `sessionStorage` — recargar
  ya no vuelve al spinner. T11: `app/listings/page.tsx` pasó a Server Component con ISR (60s) que
  renderiza el listado default y lo pasa a `ListingsClient.tsx` (nuevo) — entrar directo a
  `/listings` pinta las cards en el primer HTML, sin esperar hidratación. Verificado: build con
  `/listings` sigue `○ Static` (no `ƒ`), HTML prerenderizado con 10 cards reales, runtime con
  headers ISR correctos. Detalle técnico completo en §13. Con esto, el plan V2 solo deja pendientes
  las Fases 4-5 (bajo esfuerzo). Commit: `53ee2cc`.
- **2026-07-08** — **Splash propio eliminado** (commit `2596e5a`, push a `main`).
  Tras el deploy de la Fase 2, el usuario reportó DOS pantallas azules encadenadas al abrir el
  PWA (splash nativo del OS + splash propio, logos en posiciones distintas). Decisión del
  usuario: quedarse solo con la nativa y limpiar el código del splash patrocinado. Borrados
  `SplashScreen.tsx` y `SplashSponsorSync.tsx`; opción "Splash" quitada del admin de banners;
  `html` azul en standalone movido a `globals.css` (anti-flash). −350ms por apertura. Si se
  vende un patrocinador de apertura, la cortina "Oferecido por" se RECREA (detalle en §19).
  Build verificado: 52 páginas, rutas sin cambios de estado.
- **2026-07-08** — `OPTIMIZATION_MASTER_PLAN_V2.md` Fase 2 (T6-T9), **desplegado** (commit
  `ea078b1`, push a `main`). SW v6 (race red-vs-timeout 500ms + Navigation Preload +
  seed de `/`) para eliminar la pantalla blanca de apertura; splash CSS 600→350ms; íconos reales
  regenerados + variantes `maskable` nuevas (Android); 8 startup images para iOS (antes abría en
  blanco). Verificado con Chrome headless por CDP (sin agregar dependencias): versionado v5→v6,
  matriz offline completa, y race probado con latencia simulada de 3000ms (abrió en ~946ms).
  Assets de marca aprobados visualmente por el usuario antes del deploy. Próximo: Fase 3
  (T10-T11) — avisar `/effort xhigh` antes de arrancar (T11 toca la arquitectura de `/listings`).
- **2026-07-08** — `OPTIMIZATION_MASTER_PLAN_V2.md` Fase 1 (T1-T5), **desplegado** (commit
  `d647c96`, push a `main`). `minimumCacheTTL` 31 días en imágenes; prewarm del
  listado default de `/listings` desde el home (`lib/listingsApi.ts` nuevo); detalle reutiliza
  `favoritesCache` en vez de query propia; `listingsCache` con TTL soft(3min)/hard(30min); caché
  del buscador espejado en `sessionStorage`. Build verificado (52 páginas, rutas intactas).
  Speed Insights ANTES del deploy (mobile, 24h): RES 75, FCP 2.12s, LCP 2.12s, INP 80ms,
  **CLS 0.47 (Poor)**, FID 27ms, TTFB 0.71s — ver §13 y §19 (CLS es hallazgo nuevo, pendiente).
  Próximo: Fase 2 del plan (T6-T9, SW v6 + splash) — avisar `/effort xhigh` antes de arrancar.
- **2026-07-08** — Buscador: fix de falsos positivos (substring → inicio de palabra) + fix de SW
  cacheando dev, **desplegado** (commit `80181f1`, push a `main`). "pa" ya no traía casi todos los
  anuncios; `RegisterSW.tsx` ya no registra el service worker fuera de producción. Detalle en §6 y
  §18. Sin SQL pendiente (usa las columnas `*_norm` de fase-19, ya corrida).
- **2026-07-07** — Buscador: sin acentos + sugestão completa a barra, **desplegado** (commit
  `c132a18`, push a `main`). Fase-19 SQL (`fase-19-busca-sem-acentos.sql`, columnas generadas
  `*_norm` + índices trigram) corrida por el usuario en Supabase antes del deploy. Detalle
  completo en §6.
- **2026-07-07** — 4 ajustes de UX pedidos por el usuario, **desplegado** (commit `50d4549`,
  push a `main`). (1) `/favorites`: sacado el 📍 antes de la localidad. (2)
  `/listings/[id]`: "Ver loja" ahora es píldora sólida azul (antes link de texto que pasaba
  desapercibido); "Editar anúncio" (dueño) pasó a color arena con sombra; se sacaron los emojis de
  lápiz de ambos ("Este é o seu anúncio" y "Editar anúncio") a pedido explícito del usuario. (3)
  Nuevo campo `categories.is_product` (fase-18, SQL corrida por el usuario) + checkbox "Produto
  vendável" en `/admin` → Categorias, default `false` en todas — el usuario decide qué categorías
  activar. (4) Botón "Vendido" en `/profile` (sin emoji, a pedido del usuario) para anuncios de
  categorías `is_product=true`: modal propio de 3 pasos (confirmación con advertencia → procesando
  → éxito) que termina en **borrado permanente** del anuncio (fotos R2 + fila), reusando la lógica
  del botón 🗑 vía `performDelete()` factorizada. Detalle completo en §15.1. Verificado con `tsc
  --noEmit` + `npm run build` (52 páginas, ninguna ruta perdió su condición estática/ISR).
- **2026-07-07** — `OPTIMIZATION_MASTER_PLAN.md` → **Fase 6 completada y desplegada, plan cerrado**
  (T18 Web Vitals reales de producción; Sonnet · `high`). Se instaló `@vercel/speed-insights` (único
  paquete nuevo del plan, con OK explícito del usuario antes de agregarlo) y se montó
  `<SpeedInsights />` en `frontend/app/layout.tsx` dentro de `<body>`, después del `SessionProvider`.
  Mide LCP/INP/CLS reales de usuarios de la isla (gama media + 4G), segmentable por ruta desde el
  panel de Vercel — sin dashboard propio, tal como pedía el plan. El beacon de recolección es POST y
  el SW (`sw.js`) solo intercepta GET, así que nunca lo cachea ni lo bloquea. Gratis en el plan
  **Hobby** (confirmado por el usuario con capture de pantalla del modal de Vercel: "Monthly Fee:
  Free on Hobby" y "Fee per 10k Data Points: Free on Hobby"; en Hobby no hay cobro por excedente, solo
  se pausa la recolección hasta el próximo ciclo — el usuario vería el uso en el panel de
  Speed Insights / Settings → Usage, o un aviso por email). Verificado con `tsc --noEmit` + `npm run
  build` (52 páginas, ninguna ruta perdió su condición estática/ISR). Commit `a7b72bf`, push a `main`,
  deploy Vercel — el usuario habilitó Speed Insights en el panel de Vercel antes del push. **Con esto
  el `OPTIMIZATION_MASTER_PLAN.md` queda completo (Fases 1-6), no quedan fases del plan pendientes.**
- **2026-07-07** — `OPTIMIZATION_MASTER_PLAN.md` → **Fase 5 completada y desplegada** (uploads
  paralelos + edit server-side + store sin waterfall + splash liviano, T14-T17; Sonnet · `high`).
  (T14) **Uploads de fotos en paralelo** en `publish/PublishForm.tsx` y
  `listings/[id]/edit/EditListingForm.tsx`: el `for` serial (comprimir→subir→insertar una foto a la
  vez) pasó a `Promise.all(photos.map(...))` — el tiempo total pasa a ser el de la foto más lenta, no
  la suma; cada foto devuelve `{listing_id, photo_url, storage_path, sort_order: i}` o `null` si falla
  (se preserva el orden por el índice original, no por orden de llegada), un solo `insert` en lote
  filtrando los `null`. Se sacó el `setTimeout` artificial de 1.5s antes del redirect (ahora inmediato
  tras `setSuccess(true)`). (T15) **`/listings/[id]/edit` dividida** igual que `/publish`: `page.tsx`
  pasó a Server Component async (`revalidate=300`) que trae categorías/localidades/subzonas con
  `getSupabaseAdmin` y las pasa como props a un nuevo `EditListingForm.tsx` (client) — los desplegables
  quedan listos al instante, sin fetch propio. La carga del anúncio a editar y el guard de dueño (`
  user_id !== session.user.id`) siguen client-side en `EditListingForm`. La ruta queda `ƒ Dynamic`
  igual (el plan lo permite: lo que importa es que los datos estáticos ya no bloquean con fetch
  propio). (T16) **`/store/[id]` sin waterfall de sesión**: `StoreClient.tsx` reemplazó su propio
  listener de `supabase.auth.getSession()`/`onAuthStateChange` por `useSession()` del
  `SessionContext` global; la consulta de vendedor+anúncios (`Promise.all` de `profiles_public` +
  `listings`) se dispara de inmediato sin esperar la sesión (no depende de ella); favoritos se
  resuelven en un efecto propio keyed en `session`, reusando el caché de T8 (`getCachedFavorites`/
  `loadFavorites`). (T17) **Splash sponsor liviano**: `SplashSponsorSync.tsx` pide la imagen del
  banner vía el optimizador de Next (`/_next/image?url=...&w=384&q=75`, con
  `NEXT_PUBLIC_SITE_URL` de fallback) antes de convertirla a data-URL para el caché de
  `localStorage` — el PWA ya no descarga el original completo al abrir; si el blob pasa 400KB el
  fallback ahora también apunta a la URL ya optimizada, no al original pesado. Además se
  recomprimió el asset `public/banners/banner-institucional.png` (2.1MB → 250KB con
  `sips -Z 600`, mismo nombre de archivo, mismo formato PNG) y se documentó el límite de 300KB en
  `SKILL_BANNER_INSTITUCIONAL.md`. Verificado con `tsc --noEmit` tras cada tarea + `npm run build`
  final: 52 páginas, sin errores de tipos. Commits: `e436b1f` (T14), `d41a18c` (T15), `d845171`
  (T16), `4f53c12` (T17) — push a `main`, deploy Vercel. **Pendiente**: probar a mano en el
  navegador publish/edit con fotos reales, `/store/[id]` y el splash con un banner `position=splash`
  activo (no se hizo verificación manual en browser en esta sesión, solo build/tipos).
- **2026-07-06** — `OPTIMIZATION_MASTER_PLAN.md` → **Fase 4 completada** (Service Worker correcto +
  offline, T12-T13; Opus 4.8 · `xhigh`). (T12) **Reescritura del SW** (`public/sw.js`, `v4`→`v5`):
  se reemplazó el cache-first-para-todo (que congelaba `/api/mares` y los payloads RSC, y crecía sin
  tope) por estrategias explícitas por tipo de request con caches separados **STATIC/PAGES/IMAGES/DATA**
  y `trimCache` (LRU por orden de inserción): Supabase y `/api/*` (salvo `/api/mares`) y `/api/auth`
  **no se interceptan**; `/api/mares` **network-first** (las mareas vuelven a actualizarse sin
  reinstalar el PWA); **payloads RSC** (`?_rsc`/header `RSC`) **network-first, nunca cache-first** (el
  ISR de 60s vuelve a ser efectivo dentro del PWA — deja de mostrar anuncios viejos al navegar);
  `/_next/static` cache-first (hash inmutable); `/_next/image`+fotos R2 stale-while-revalidate con
  tope (IMAGES 60); navegación HTML network-first → cache → `/offline.html`; rutas privadas
  (`/publish`, `/profile`, `/admin`) network-only, **nunca desde caché**; `activate` limpia versiones
  viejas. (T13) **Página offline de marca**: `public/offline.html` — **HTML estático puro, sin JS ni
  hidratación de Next** (primero se hizo como `app/offline/page.tsx` pero offline crasheaba con
  ChunkLoadError al intentar hidratar; un `.html` suelto no depende de chunks → funciona en modo
  avión); precache del shell (offline.html, manifest, logo, íconos). `RegisterSW.tsx`:
  `updateViaCache: "none"` para propagar rápido el bump de versión. Verificado con `npm run build`
  (rutas estáticas/ISR intactas) y navegación real con Chromium: el SW activa y borra los caches `v4`,
  `/api/mares` network-first, imágenes cacheadas con tope, y el modo avión muestra la página offline de
  marca sin crash; online sin errores de consola. Commit: `cc02242`.
- **2026-07-07** — Fase 4 **desplegada a producción** (push `main`→Vercel, `e319409`). Antes del
  push: build de producción local (`npm run build && npm start`) probado a mano por el usuario en
  su compu (Chrome DevTools → Application → Service Workers, toggle offline) y desde el celular vía
  IP local en la misma wifi — offline mostró la página de marca sin crash, navegación normal sin
  cambios perceptibles. No se probó en un PWA instalado real en Android (el usuario no tiene uno a
  mano); decisión consciente de desplegar igual porque el proyecto aún no tiene usuarios activos, así
  que el riesgo de un SW roto cacheado en dispositivos reales es nulo por ahora. Si en el futuro se
  detecta algo raro en el PWA instalado (splash, offline, mareas viejas), revisar primero `sw.js`.
- **2026-07-06** — `OPTIMIZATION_MASTER_PLAN.md` → **Fase 3 completada** (detalle de anuncio
  instantáneo, T9-T11; Opus 4.8). (T9) **Render optimista**: nuevo `lib/listingPreview.ts` (Map
  de módulo, cap 30) donde la card guarda al hacer click los datos que ya tiene (título, precio,
  price_text, condición, 1ª foto, localidad); el detalle los usa como estado inicial y pinta el
  layout completo al instante — **sin spinner de página** — mientras llega la query completa
  (descripción y vendedor se muestran como skeleton con altura reservada para no generar CLS).
  Deep link / refresh sin preview mantienen el comportamiento actual (spinner). `isOwner` pasó a
  exigir `user_id` conocido para no marcar "dueño" durante el render optimista. (T10) **Queries
  consolidadas**: el RPC del teléfono (`get_seller_whatsapp`) se dispara apenas se conoce
  `user_id` + sesión (antes esperaba a que cargara `profiles_public`), y el botón de WhatsApp
  aparece apenas se sabe que no es el dueño — cascada del detalle en máx 2 niveles (principal ‖
  favorito → vendedor+teléfono+zonas en paralelo). Flag `phoneLoaded` evita el falso "vendedor
  sem número" mientras el teléfono carga. Regla anti popup-blocker (`<a>` nativo con teléfono
  pre-cargado) intacta. (T11) **Shells estáticos**: `/listings/[id]` y `/store/[id]` pasaron de
  `ƒ` (función serverless por navegación) a `● SSG` — `page.tsx` es ahora un Server Component
  wrapper (`generateStaticParams` vacío + `dynamicParams`) que renderiza el componente cliente
  (`ListingDetailClient.tsx` / `StoreClient.tsx`, renombrados). Se borraron los `loading.tsx`
  (spinner de página) que competían con el render optimista. `/listings/[id]/edit` sigue `ƒ`
  (diferido a la Fase 5/T15, que lo hará ISR con datos server-side). Verificado: `npm run build`
  mantiene `/` `○`, `/category/[slug]` `●`, `/listings` `○` y ahora `/listings/[id]` `●` +
  `/store/[id]` `●`; navegación real con Chromium confirma título+foto instantáneos al tocar la
  card (0 ms, sin spinner), deep link y back sin regresión, tienda estática OK — 0 errores de app
  (un 404 preexistente de un avatar roto en R2, ajeno a esta fase). Commit: `76dc20f`.
  **Llevada a PRODUCCIÓN el 2026-07-06** (push a `main`, HEAD `f202fed` → deploy automático de
  Vercel).
- **2026-07-06** — `OPTIMIZATION_MASTER_PLAN.md` → **Fase 2 completada** (navegación instantánea
  en `/listings`, T6-T8; ejecutada con Opus 4.8 · `xhigh`). Tres helpers nuevos en `lib/`:
  (T6) `listingsCache.ts` — caché de resultados por clave de filtros (categoría|q|subcat|condición|zona;
  el orden NO entra en la clave por ser client-side) con stale-while-revalidate, LRU (máx 10
  claves) y TTL 3 min: volver del detalle pinta la lista al instante (sin spinner) y revalida en
  2º plano. Restauración de scroll: la posición se graba en la **fase de captura del click**
  (antes del scroll-to-top del App Router, que si no pisaba el valor con 0) y se **reafirma** tras
  el remount en un loop `requestAnimationFrame` de 500 ms cancelable por interacción del usuario
  (wheel/touch/tecla) — necesario porque el reset de Next tiene timing variable. El estado de
  filtros (sort/condición/zona) se persiste por `baseKey` de URL para sobrevivir al remount que
  hace la navegación (los `useState` se pierden). Los efectos de reset de zona/condición se
  reestructuraron para NO dispararse en el primer mount (comparación con ref del valor previo),
  así no borran la selección restaurada. (T7) `catalogCache.ts` — catálogo de categorías
  (slug→id,name,icon) y localidades en módulo + `sessionStorage` con TTL 5 min: en visitas
  repetidas el slug se resuelve **sin RTT** (verificado: `categories?`=0 en la 2ª visita). Además
  se desarmó el waterfall de categoría: las queries de categoría **principal** y **secundaria**
  (`listing_extra_categories!inner`, filtrando el padre por la categoría) se disparan en
  **paralelo** y se fusionan/deduplican en el cliente (antes: extras → principal encadenadas);
  localidades salieron del `Promise.all` de la lista a un efecto propio no bloqueante. (T8)
  `favoritesCache.ts` — Set de favoritos por usuario cargado 1 sola vez por sesión (los toggles lo
  actualizan localmente, sobreviven al cambio de pantalla); usado en `/listings` y `/store/[id]`;
  se limpia al hacer logout. Verificado: `npm run build` mantiene `/` `○`, `/category/[slug]` `●`,
  `/listings` `○` (168 kB); navegación real con Chromium headless confirma back instantáneo con
  scroll restaurado (471→471 estable), orden sin request de red, extras inner-join sin errores,
  catálogo cacheado y filtros sin vaciar la pantalla — 0 errores de consola, 0 respuestas ≥400.
  Quedan pendientes las Fases 3-6 (ver §19). Commit: `de86814`. **Fases 1 y 2 llevadas a
  PRODUCCIÓN** el 2026-07-06 (push a `main`, HEAD `5ef6493` → deploy automático de Vercel).
- **2026-07-06** — `OPTIMIZATION_MASTER_PLAN.md` (auditoría de velocidad de navegación, 15
  problemas priorizados en 6 fases) → **Fase 1 completada** (quick wins de percepción, T1-T5):
  (T1) `priority` de `next/image` en el banner del home y en las primeras 4 cards de destacados
  (`ListingCard` ganó prop `priority`); (T2) galería del detalle (`listings/[id]`) migrada de
  `<img>` crudo a `next/image` con `priority` en la foto activa (contenedor pasó de altura auto a
  `height: clamp(200px, 65vh, 600px)` para poder usar `fill`); thumbnails del lightbox también a
  `next/image` — el `<img>` grande del lightbox se mantiene crudo a propósito (zoom sin
  recompresión); (T3) orden (`Menor/Maior preço`) en `/listings` pasó a ser 100% client-side
  (`useMemo`, sin request, nulls siempre al final) y los filtros que sí requieren red (zona,
  condición) ya no vacían la pantalla — mantienen la lista anterior visible con un indicador
  sutil "Atualizando…" en vez del spinner completo; (T4) el fetch de favoritos se separó a un
  `useEffect` propio dependiente solo de la sesión → se eliminó la doble carga de `/listings`
  para usuarios logueados (antes el efecto principal dependía de `session`); (T5) las queries de
  listas (home, `/listings`, `/store/[id]`, `/profile`) ahora piden 1 sola foto por anuncio vía
  `.order(...).limit(1, { referencedTable: "listing_photos" })` en vez de traer hasta 6, y se
  sacó el join de `subzones` que ningún card usa (quedó afuera `/favorites` por tener el embed a
  dos niveles de profundidad — `listings.listing_photos` —, sintaxis no verificada, riesgo/beneficio
  bajo por ser una pantalla de bajo tráfico). Verificado: `npm run build` mantiene `/` y
  `/listings` en `○ Static` y `/category/[slug]` en `● SSG`; navegación real con Playwright
  headless (orden sin request, filtro sin limpiar pantalla, detalle sin errores de consola).
  Quedan pendientes las Fases 2-6 del plan (ver §19). Commit: `fd32be8`.
- **2026-07-06** — Splash del PWA: bajado el mínimo visible de 1.1s a 600ms en
  `SplashScreen.tsx` (script inline, cálculo de `wait`). Motivo: en cargas rápidas cacheadas la
  espera de 1100ms agregaba ~700ms de latencia artificial tapando una app ya lista; ahora el
  splash es prácticamente puro relleno del delay de arranque. Recordatorio: el splash SOLO
  aparece en recargas completas del PWA standalone (SO reabriendo el WebView), nunca en la
  navegación interna (`layout.tsx` persiste). Commit: `c4e4cd9`.
- **2026-07-06** — En `/profile`, cada card de "Meus anúncios" ahora muestra una miniatura de
  52×52px (primeira foto por `sort_order`, `next/image` con `sizes="52px"` y `objectFit: contain`,
  placeholder 🛍️ si no tem foto) para que o usuário distinga mais fácil qual anúncio é qual —
  mesmo padrão já usado em `/favorites`. Query de `listings` agregó join `listing_photos(photo_url,sort_order)`.
  Build verificado: `/profile` segue `○ Static`. Commit: `e7e47b3`.
- **2026-07-06** — Fix del error de hidratación de React en `SplashScreen` detectado en la sesión
  anterior (ver entrada de abajo): el script inline removía `#mi-splash` del DOM antes de que React
  hidrate. Ver detalle en §18. Commit: `47bcbbf`.
- **2026-07-06** — Cierre de la refactorización de `.listing-grid` (`globals.css` +
  `ListingCard.tsx`): se corrigió un desfasaje de 1px entre las columnas de imagen (causado por
  `border-right` en una sola columna + `box-sizing: border-box`) usando `border-right` en ambas
  columnas con `border-right-color: transparent` en la derecha; se restauraron las líneas
  horizontales entre filas (`border-bottom`, se habían sacado por error y el usuario pidió
  devolverlas); se quitó definitivamente la línea entre imagen y texto dentro de cada card; y se
  centró el texto del contenido (título/precio/localidad/badge) con `textAlign: center`. Verificado
  con Playwright en local (medidas de ancho/alto de columnas y filas, capturas de pantalla) — sin
  desfasajes, filas parejas. Detectado (no resuelto, a pedido del usuario para otra sesión): error
  de hidratación de React en `SplashScreen` visible en `npm run dev` al navegar a `/listings`.
  Commit: `2ccaa51`.
- **2026-07-05** — Fix login: `signin/page.tsx` distinguía mal los errores de Supabase y mostraba
  "senha incorreta" también ante fallos de red (típico en el primer login tras reinstalar el PWA).
  Ahora solo cuenta como credencial inválida el mensaje "invalid login credentials"; otros errores
  muestran "Erro de conexão". Junto con esto se desplegó trabajo pendiente de una sesión previa:
  pulido visual de cards (borde + sombra sutil, gap 0.2rem) y de los 3 botones de acceso rápido del
  home (bloques de color sólido en vez de ícono+texto), y reestructuración de docs — `ORCHESTRADOR.md`
  como fuente única del sistema multiagente, `CLAUDE.md` con el pilar de velocidad de navegación,
  `PROMPT_CLAUDE_CODE.md`/`PROMPT_MAESTRO_PARA_CLAUDE_CODE.md` marcados como históricos. Skill
  `/memory` creada (`.claude/skills/memory/SKILL.md`): cierra sesión actualizando este archivo y
  desplegando a producción (commit + push a `main`). Commit: `2ccaa51`.
