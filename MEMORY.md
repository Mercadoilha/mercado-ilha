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
- **Logo:** SVG en `/public/logo.svg` (bolsa de compras con montículo de arena + faro).
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
- **Home (orden actual, commit `a715b8b`):** header azul → búsqueda autocomplete → BannerRotativo
  → 3 botones de acceso rápido, ahora bloques de color sólido sin ícono (Todos = azul principal,
  Categoria = azul xlight, Info útil = verde-mar; "Todos os anúncios" → `/listings`; los otros dos
  hacen scroll suave con `id="secao-categorias"`/`id="secao-info"`) → **Anúncios destacados**
  (ordenados por `bumped_at`) → **Categorias Destacadas** (Bloque 1) → **Secciones temáticas**
  (Bloque 2) → anuncios recientes → **Informação útil** (Tabela de Marés + horários de barcos) →
  Fale conosco.
- **Búsqueda autocomplete (`BuscaAutocomplete.tsx`):** debounce 300ms, AbortController, cache en
  memoria por query, consultas paralelas (listings+categories+subcategories), skeleton, navegación
  ↑↓ Enter Esc, ARIA. Sugerencias: máx 5 anuncios + máx 3 categorías (sin anuncios en el dropdown
  tras el rework — ver `project_buscador_rework`; midiendo búsquedas con fase-16 → revisar sinónimos).
- **Botón compartir:** Web Share API + fallback WhatsApp. Ícono en `ShareIcon.tsx`. En 4 lugares:
  header global, detalle del anuncio (outline azul, visible siempre), tienda (outline blanco),
  perfil propio (outline azul, URL `origin + '/store/' + userId`).
- **Bottom nav fijo:** Início | Anúncios | ➕ (arena, circular) | 🍽️ Comida | Perfil/Entrar.
- **OG image:** `/icon-192.png` para preview compacto en WhatsApp.
- **Favoritos:** sección eliminada del perfil. Ya no existe en la UI.

## 7. PUBLICIDAD (BANNERS)

- Admin gestiona banners desde `/admin` tab "Banners": URL imagen, link, posición
  (`home`/`listado`/`splash`), activo/inactivo.
- Varios activos en misma posición → rotan cada 4s con dots. Sin banners → placeholder "Seu
  negócio aqui! + Fale conosco".
- **Layout:** ancho completo, sin border-radius ni etiqueta "PUBLICIDADE", pegado al header.
  Componente `BannerRotativo.tsx`.
- **Imágenes:** en `frontend/public/banners/`, URL `https://mercadoilha.vercel.app/banners/<x>.png`
  (va directo en `image_url`). Dimensión recomendada 1200×300 (4:1); Higgsfield genera 1584×672
  (21:9) con `objectFit: cover` → diseñar contenido centrado verticalmente.
- **Skill `/banner-institucional`** (`.claude/skills/SKILL_BANNER_INSTITUCIONAL.md`): genera con
  Higgsfield, descarga, sube a `public/banners/`, push, retorna URL. ⚠️ correr
  `git config http.postBuffer 524288000` antes del push de imágenes.

## 8. PANEL DE ADMINISTRADOR (`/admin`, requiere `role=admin`)

Acceso desde perfil (botón "⚙️ Painel de administração", solo admins). **8 tabs:**
- **Dashboard** — contadores (anúncios activos/total, denúncias, usuarios, banners).
- **Categorias** — CRUD completo: nombre, ícono (EmojiPicker), slug, `location_type`, texto del
  botón, descripción, orden (flechas ↑↓ reasignan `sort_order` secuencial a TODAS). Subcategorías:
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
| `/profile` | Perfil editable (nombre+WhatsApp), mis anuncios con miniatura 52×52 (`next/image`, primeira foto por `sort_order`), 👁️/💬 stats, botón ⭐ Destacar. |
| `/store/[id]` | Tienda pública del vendedor (banner azul + sus anuncios). |
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
│   ├── SplashScreen.tsx   SplashSponsorSync.tsx  (splash PWA — ver §pendientes)
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
- **`next/dynamic`** para módulos pesados de uso raro (`AvatarCropModal`, PhotoUploader).
- **`next/image`** (AVIF/WebP, remotePatterns) para fotos.
- Widgets secundarios (marés, barcos) cargan post-render y nunca rompen la home si fallan.
- Verificado en su momento (evitar falsos positivos): `adminSettings` ya cachea a nivel módulo;
  `favorites` ya tiene unique index; MV `active_listings_summary` no la consume nadie;
  `SessionContext.getSession()` lee de local storage (no red). Ver `feedback_verificar_diagnostico`.

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
  `status='active'`; **cooldown 1h**; setea `bumped_at=now()`, renueva `expires_at=+30d`, limpia
  `deletion_warning_sent_at`.
- **Frontend:** home ordena destacados por `bumped_at` desc (sube en ≤60s por ISR); perfil con botón
  dorado ⭐ (deshabilitado en cooldown, muestra `⭐ Nmin`); `bumped_at` en los `select` de perfil y
  `profileCache`.
- **Futuro:** gatear el cobro **dentro** de la RPC (único punto de entrada); el orden no cambia.
- Detalle: memoria `project_destacar_anuncio`.

## 16. WIDGETS DE INFORMAÇÃO ÚTIL

- **Marés (`MaresWidget.tsx`):** scraping de `tabuademares.com/br/bahia/morro-de-sao-paulo` con
  `cheerio` server-side. API `app/api/mares/route.ts` con `unstable_cache` (revalida 6h). Carga con
  `useEffect` post-render; si falla, no aparece (la home no se rompe). Fondo `#E6F1FB`, grid 2 col.
- **Barcos (`BarcosWidget.tsx`):** datos **hardcodeados** (referencia estática, no administrable).
  Sentido único Morro → Valença: Lancha rápida (12 horarios 07:00–18:00) + Barco convencional (24).
  Mismo estilo que MaresWidget. **Pendiente:** horarios de vuelta (Valença → Morro).

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
  `fix_back_navigation`.
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

## 19. PENDIENTES / IDEAS

- **`OPTIMIZATION_MASTER_PLAN.md`:** Fases 1-2 **EN PRODUCCIÓN** (push a `main` → deploy Vercel,
  `5ef6493`; código en `fd32be8` y `de86814`). **Fase 3 completada** (detalle instantáneo,
  T9-T11 — commit `76dc20f`; **falta desplegar**). Quedan Fase 4 (reescritura del Service Worker
  + página offline — Opus 4.8, `xhigh`), Fase 5 (uploads en paralelo, **edit server-side + shell
  estático de `/listings/[id]/edit`, aún ƒ**, store con SessionContext, splash sponsor liviano —
  Sonnet), Fase 6 (Web Vitals reales — Sonnet).
- **Correr en Supabase:** `fase-monetizacion-tracking.sql` (tracking), `fase-11-delivery-zonas.sql`.
  (Confirmadas ✅: fase-9, 10, 12, 13, 14, 17.)
- **Splash PWA + slot patrocinador:** confirmado EN PRODUCCIÓN (commits `1beb9f1`, `99b1c8d`).
  Logo real + slot "Oferecido por" vía banners position `splash`. Código en
  `SplashScreen.tsx`/`SplashSponsorSync.tsx`. **Falta correr** `supabase/fase-splash-sponsor.sql`
  para habilitar la posición `splash` en la DB.
- Íconos PWA con el logo real (reemplazar placeholders).
- Republicar anuncio vencido con 1 clic desde el perfil.
- Botón "Marcar como vendido".
- Filtros adicionales en listados: precio, sub-zona.
- Panel admin: gestión de localidades y sub-zonas.
- WhatsApp de Maria Agustina: confirmar si tiene número en metadata; si no, que lo cargue.
- Buscador: extender cache a `sessionStorage`; revisar sinónimos tras 15 días de medición
  (`SIGUIENTES_PASOS_BUSCADOR.md`).

## 20. CORRER LOCALMENTE

```bash
cd frontend
npm run dev                  # http://localhost:3000
npm run dev -- -H 0.0.0.0    # accesible desde celular en misma WiFi (IP Mac ~192.168.10.9)
npx localtunnel --port 3000  # URL pública HTTPS temporal (sin WiFi compartido)
```
Deploy: repo GitHub conectado a Vercel (root `frontend`), región `gru1`. Auth Email/Password
habilitado en Supabase; `admin_settings.admin_whatsapp` con el número real; primer usuario con
`role=admin`.

## 21. CHANGELOG DE SESIONES

Registro cronológico de cierres de sesión (más reciente arriba). Detalle estructural de cada
feature va en su sección numerada correspondiente; acá solo un resumen con fecha y commit.

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
  (un 404 preexistente de un avatar roto en R2, ajeno a esta fase). Commit: `76dc20f`. **Falta
  desplegar a producción.**
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
