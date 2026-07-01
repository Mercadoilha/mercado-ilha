# MEMORY.md — Proyecto Mercado Ilha
# Usar este archivo al inicio de cada conversación nueva con Claude para retomar
# el contexto sin repetir todo desde cero.

---

## QUÉ ES EL PROYECTO

Marketplace web para la isla de Tinharé (Morro de São Paulo, Brasil). Resuelve que
todo el comercio local se hace por grupos de WhatsApp donde las publicaciones se
pierden. La app permite publicar anuncios permanentes, buscables y categorizados.
El contacto comprador-vendedor es por WhatsApp (botón directo con mensaje
pre-armado). Servicio gratuito al inicio. Nombre: **Mercado Ilha**.

---

## DECISIONES TÉCNICAS

- **Stack:** Next.js 14 (App Router) + TypeScript + CSS inline con variables CSS
  (sin Tailwind) + Supabase (DB, Auth, Storage) + Vercel (hosting).
- **Plataforma:** Web responsive mobile-first (max-width 480px) + PWA instalable.
- **Idioma de la interfaz:** Portugués brasileño.
- **Autenticación:** Email + contraseña (signUpWithPassword / signInWithPassword).
  Registro captura nombre, WhatsApp, email y contraseña. Registro también debe
  aceitar termos e salvar `terms_accepted_at` no perfil. Navegar y contactar é
  livre sem registro. Publicar requiere cuenta.
- **Contacto:** Botón WhatsApp con mensaje pre-armado por categoría. Sin chat
  interno.
- **Moderación:** Publicación instantánea. Admin puede ocultar/bloquear/eliminar.
  Usuarios pueden denunciar desde el detalle del anuncio.
- **Fotos:** Hasta 6 por anuncio. Se suben a Supabase Storage bucket
  `listing-photos`. Preview antes de subir. Sin compresión por ahora.
- **Expiración:** Configurable por categoría (días o sin expiración). Anuncios
  vencidos quedan en el panel del vendedor.
- **Perfil-tienda:** Cada vendedor tiene página pública `/store/[id]` con todos
  sus anuncios activos.
- **WhatsApp del admin:** Guardado en tabla `admin_settings` (key = `admin_whatsapp`).
  Nunca hardcodeado. Se lee con `frontend/lib/adminSettings.ts`.

---

## ESTRUCTURA GEOGRÁFICA (3 niveles, todo administrable)

- **Isla:** Tinharé (slug: `tinhare`)
- **Localidades:** Morro de São Paulo, Gamboa, Zimbo, Galeão
- **Sub-zonas:**
  - Morro de São Paulo: Vila Centro, Lagoa, Primeira Praia, Segunda Praia,
    Terceira Praia, Quarta Praia, Mangaba, Buraco, Outros
  - Gamboa: Nova Gamboa, Vila, Outros
  - Zimbo: Outros
  - Galeão: Outros
- **"Outros":** El usuario escribe referencia en texto libre. El admin la ve y
  puede crear sub-zona oficial cuando quiera.

---

## CATEGORÍAS (31 activas en Supabase, actualizado 2026-06-29)

Tabla `categories` tiene columna `description text` (nullable) y `home_section_id` (FK a
`home_sections`). Se gestiona desde el tab Categorias del admin.

**Cambios 2026-06-24:** eliminadas `Fotografía e social media`, `Copa do mundo 2026`,
`Supermercados`, `Beleza e bem-estar`. Creadas: `Internet`, `Água para beber`, `Beleza`,
`Lojas`, `Mercados`.

**Cambios 2026-06-26/29:** renombradas `Consertos`→`Consertos geral` (slug `consertos-geral`),
`Internet`→`Internet wifi` (slug `internet-wifi`), `Água para beber`→`Agua` (slug `agua`),
`Lojas`→`Lojas e barracas` (slug `lojas-e-barracas`). Creadas: `Bem-estar` (slug `bem-estar`,
separada de Beleza), `Electrónica` (slug `electronica`) y `Electrodomesticos` (slug
`electrodomesticos`) — ambas son servicios de reparación/assistência técnica, NO venta de
productos, agrupadas junto a `Consertos geral` en la sección home "Renove o que é seu".

| Categoría | Slug |
|-----------|------|
| Produtos | `produtos` |
| Serviços do lar | `servicios-do-lar` |
| Transporte de mercadoria | `transporte-de-mercadoria` |
| Encomendas | `encomendas` |
| Delivery | `delivery` |
| Gas | `gas` |
| Mobilidade e transportes | `mobilidade-e-transportes` |
| Aluguéis | `alugueis` |
| Educação | `educacao` |
| Babás | `babas` |
| Esportes | `esportes` |
| Arte e cultura | `arte-e-cultura` |
| Restaurantes e bares | `restaurantes-e-bares` |
| Terrenos | `terrenos` |
| Casas | `casas` |
| Consertos geral | `consertos-geral` |
| Electrónica | `electronica` |
| Electrodomesticos | `electrodomesticos` |
| Veículos | `veiculos` |
| Construção e Reformas | `construcao-e-reformas` |
| Bioconstrução | `bioconstrucao` |
| Saúde | `saude` |
| Doações | `doacoes` |
| Empregos e bicos | `empregos-e-bicos` |
| Serviços Profissionais | `servicos-profissionais` |
| Experiências turísticas | `experiencias-turisticas` |
| Internet wifi | `internet-wifi` |
| Agua | `agua` |
| Beleza | `beleza` |
| Bem-estar | `bem-estar` |
| Lojas e barracas | `lojas-e-barracas` |
| Mercados | `mercados` |

**Botón de contacto:** casi todas usan "Contatar". Excepciones: Produtos/Terrenos/Casas →
"Contatar vendedor"; Delivery → "Fazer pedido".

**Placeholders de publicar/editar:** textos-guía por categoría en
`frontend/lib/categoryPlaceholders.ts` (mapa por slug + `DEFAULT_PLACEHOLDERS` fallback).
Si se crea una categoría nueva en el admin, agregar su entrada ahí — el slug de la key DEBE
coincidir exactamente con el slug en DB, o cae al texto genérico sin avisar (pasó con 4
categorías renombradas el 2026-06-26/29; quedaron usando `DEFAULT_PLACEHOLDERS` hasta que se
detectó y corrigió). Ejemplos de precio en los placeholders usan "R$ X" (sin valores reales).

## SECCIONES DEL HOME (tabla home_sections, creada y ejecutada 2026-06-24)

Nueva tabla `home_sections` — `supabase/fase-11-home-sections.sql` ✅ ejecutado en Supabase.
Controla cómo se agrupan las categorías en el home. Categoría con `home_section_id = null`
no aparece.

- `is_featured_block = true` → Bloque 1 (botones rectangulares horizontales, lista)
- `is_featured_block = false` → Bloque 2 (secciones temáticas con grid 3 col, wrap)

| #ID | Sección | Tipo |
|-----|---------|------|
| 1 | Destacadas | featured |
| 2 | Logística | temática |
| 3 | Serviços para sua casa | temática |
| 4 | Educação e família | temática |
| 5 | Cuidado Pessoal | temática |
| 6 | Arte, esporte e lazer | temática |
| 7 | Comércio local | temática |
| 8 | Renove o que é seu | temática |
| 9 | Compre seu veículo | temática |
| 10 | Imóveis | temática |
| 11 | Construção e Reformas | temática |
| 12 | Profissionais certificados | temática |

**Admin:** tab Categorias → panel colapsable "Seções do home" para crear/renombrar/
reordenar secciones. Cada categoría muestra badge `#N` con su sección. El form de
edición (panel expandido) tiene selector de sección.

**Tipos de ubicación (fase-10):**
- `fija`: una localidad + **una** sub-zona (select único). `locality_id` + `subzone_id` en
  `listings`. Filtro por localidad.
- `zonas_de_atencion`: la prestadora se traslada → marca **varias** sub-zonas (checkboxes
  agrupados por localidad, con "Todas as subzonas de X" por localidad) **o** "Atendo em toda
  a ilha". Las sub-zonas se persisten en `listing_service_zones` (no en `subzone_id`).
  `covers_all_island=true` → sin filas en esa tabla; `locality_id` queda null (es nullable
  desde fase-10). Si elige zonas, `locality_id` guarda la localidad de la 1ª zona (representativa).
  El filtro por localidad incluye estos anuncios vía join a `listing_service_zones`.
  12 categorías son de este tipo (ver tabla §CATEGORÍAS). En **Delivery** las zonas
  representan a dónde entrega (su mecanismo `category_delivery_prices`/`delivery_data`
  existe en DB pero nunca se cableó a la UI).
- `sin_ubicacion`: sin campo de ubicación.

---

## DISEÑO Y MARCA

- **Paleta:** Azul principal `#185FA5`, azul mid `#1a6fbd`, azul claro `#B5D4F4`,
  azul xlight `#E6F1FB`, arena `#EF9F27`, arena light `#FAC775`,
  verde-mar `#9FE1CB`, verde oscuro `#0F6E56`.
- **Variables CSS:** definidas en `globals.css` como `--blue-main`, `--sand`, etc.
- **Layout anuncios:** LISTA vertical de cards horizontales (miniatura 80x80px
  izquierda + título, precio, descripción, favorito derecha). NO grilla.
- **Home:** header azul → búsqueda autocomplete (`BuscaAutocomplete`) → BannerRotativo
  → **Categorias Destacadas** (5 botones rectangulares, lista vertical) → **Secciones temáticas**
  (11 secciones con títulos, grid 3 col) → anuncios recientes → **Tabela de Marés** → Fale conosco.
- **Búsqueda autocomplete:** Componente `BuscaAutocomplete.tsx`. Debounce 300ms,
  AbortController para cancelar requests en vuelo, cache en memoria por query,
  consultas paralelas (listings + categories + subcategories), skeleton loading,
  navegación ↑↓ Enter Esc, ARIA completo. Sugerencias: máx 5 anuncios + máx 3 categorías.
- **Botón compartir:** Web Share API con fallback a WhatsApp. Ícono centralizado en
  `frontend/components/ShareIcon.tsx` (SVG inline). Presente en 4 lugares:
  - Header azul global (home y listados)
  - Detalle del anuncio `/listings/[id]` — botón outline azul "📤 Compartilhar anúncio"
    (visible siempre, también para el dueño; el botón de WhatsApp solo aparece para visitantes)
  - Tienda del vendedor `/store/[id]` — botón outline blanco "📤 Compartilhar loja"
  - Perfil propio `/profile` — botón outline azul "📤 Compartilhar minha loja"
    (URL generada: `window.location.origin + '/store/' + userId`)
- **Bottom nav fijo:** Início | Anúncios | ➕ (arena, circular) | 🍽️ Comida | Perfil/Entrar
- **Logo actual:** SVG en `/public/logo.svg` (ya implementado).
- **OG image:** `/icon-192.png` usado para preview compacto en WhatsApp (`og:image`).
- **Favoritos:** sección eliminada del perfil (`/profile`). Ya no existe en la UI.

---

## PUBLICIDAD (BANNERS)

- Admin gestiona banners desde `/admin` tab "Banners": URL imagen, link, posición
  (`home` / `listado`), activo/inactivo.
- Varios activos en misma posición = rotan automáticamente cada 4 segundos con
  dots de navegación.
- Sin banners activos = muestra placeholder "Seu negócio aqui! + Fale conosco".
- Número de WhatsApp del admin leído desde `admin_settings` en Supabase.
- **Layout del banner:** ancho completo (sin márgenes laterales ni superior),
  sin border-radius, sin etiqueta "PUBLICIDADE". Arranca pegado al header azul.
  Componente: `BannerRotativo.tsx` — commit `054c64a`.
- **Imágenes de banner:** hosteadas en `frontend/public/banners/`. URL base:
  `https://mercadoilha.vercel.app/banners/<archivo>.png`. El campo `image_url`
  en la tabla `banners` acepta esa URL directamente.
  - **Dimensión recomendada:** 1200×300px (ratio 4:1). Higgsfield genera 1584×672px
    (21:9) con `objectFit: cover` — diseñar contenido centrado verticalmente.
  - `banner-institucional.png` — imagen de lanzamiento generada con Higgsfield AI
    usando el logo de la app. Commit `9c3fa59`.
- **Skill para generar banners:** `/banner-institucional` —
  `.claude/skills/SKILL_BANNER_INSTITUCIONAL.md`. Genera imagen con Higgsfield AI,
  descarga, sube a `public/banners/`, hace push y retorna URL de Vercel.
  ⚠️ Siempre ejecutar `git config http.postBuffer 524288000` antes del push de imágenes.

---

## PANEL DE ADMINISTRADOR

Ruta: `/admin` — protegida por rol `admin` en tabla `profiles`.
Acceso desde perfil: botón "⚙️ Painel de administração" visible solo para admins.

8 tabs implementados (orden actual de la barra):
- **Dashboard:** contadores (anúncios activos, total, denúncias nuevas, usuarios, banners)
- **Categorias:** CRUD completo. Editar nombre, ícono (EmojiPicker), slug, tipo de ubicación,
  texto del botón de contacto, descripción (aparece bajo el ícono en la home), y orden
  (flechas ↑↓ que reasignan `sort_order` secuencial 0,1,2… a TODAS las categorías en cada
  movimiento — no solo swap de dos — para mantener la DB consistente con la página principal).
  Subcategorías: agregar, editar nombre, cambiar ícono, reordenar ↑↓, eliminar.
  ⚠️ Al crear subcategoría se requiere enviar campo `slug` (generado con `toSlug(nombre)`)
  además del nombre — sin él el insert falla. Ícono default al crear: 🌊. Fix en commit `054c64a`.
  **Visualización de subcategorías:** tanto en la página pública `/category/[slug]` como en el
  panel admin, las subcategorías muestran siempre una viñeta `•` azul (`#185FA5`) en lugar del
  ícono guardado en la DB. El campo `icon` en la DB sigue existiendo pero no se usa para mostrar.
  El icon picker del admin tiene un grupo "Esportes" con 🏄 🤿 💪 🎾 (commit `61ca6c4`) y un grupo "Cuidados infantis" con 🧸 👶 🍼 🎠 🎒 (commit `6a1c3f7`).
  **Error handling en reorden:** si el update a Supabase falla (ej. RLS), muestra un `alert`
  con el mensaje de error en lugar de fallar silenciosamente (commit `3e0c5ec`).
- **Usuários:** búsqueda por nombre/WhatsApp, dar/quitar admin, bloquear/desbloquear
- **Anúncios:** lista todos, filtro por estado, botones Ativar / Ocultar / Bloquear / Deletar
- **Banners:** CRUD completo (crear con URL + link + posición, activar/pausar, eliminar)
- **Config:** WhatsApp de contacto del admin + atalho personalizable de la barra inferior
- **Denúncias:** lista con borde de color por estado, "Ocultar anúncio + resolver" en 1 clic
- **📈 Métricas:** solo lectura — totales (vistas, clicks WA, clicks banner) + top anuncios por contactos WA

---

## PLAN DE CONSTRUCCIÓN POR FASES

| Fase | Qué incluye | Estado |
|------|-------------|--------|
| 1 | Base de datos Supabase (tablas, RLS, datos iniciales) | ✅ SQL en `supabase/fase-1.sql` a `fase-5.sql` |
| 2 | Autenticación (registro, login, roles) | ✅ Email+password, perfil con nombre y WhatsApp |
| 3 | Publicar y ver anuncios (formulario, home, listado, detalle) | ✅ Completo |
| 4 | Búsqueda y filtros | ✅ Por categoría (?category=slug) y texto (?q=texto) |
| 5 | Cuenta y perfil-tienda del vendedor | ✅ /profile + /store/[id] |
| 6 | Panel de administrador completo | ✅ /admin con 6 tabs |
| 7 | Banners rotativos + PWA instalable | ✅ BannerRotativo + manifest + SW + íconos |
| 8 | Pulido, GitHub, Vercel, lanzamiento | ✅ En producción. Repo: `Mercadoilha/mercado-ilha`. |
| — | Búsqueda autocomplete (post-lanzamiento) | ✅ `BuscaAutocomplete.tsx` — commit `ce58f37` |

---

## RUTAS IMPLEMENTADAS

| Ruta | Descripción |
|------|-------------|
| `/` | Home completa con diseño de marca |
| `/category/[slug]` | Subcategorías de una categoría. **Server Component** (no `"use client"`): fetch server-side con `getSupabaseAdmin()`, usa `redirect()` de Next.js. Sin spinner de carga. Si la categoría no tiene subcategorías activas, redirige directo a `/listings?category=slug` sin pantalla intermedia. |
| `/listings` | Listados + filtro por categoría y búsqueda |
| `/listings/[id]` | Detalle: galería fotos, precio, vendedor, WhatsApp, denuncia |
| `/publish` | Formulario publicar: fotos, categoría→subcategoría, localidad→subzona |
| `/profile` | Perfil editable (nombre+WhatsApp), mis anuncios, favoritos, cerrar sesión |
| `/signin` | Tabs: login y registro completo |
| `/store/[id]` | Tienda pública del vendedor con banner azul y sus anuncios |
| `/termos` | Página pública de Termos e Condições de Uso |
| `/admin` | Panel de administración (requiere rol admin) |
| `/forgot-password` | Recuperar contraseña: 1 paso, solo email. Llama `resetPasswordForEmail`. |
| `/reset-password` | Nueva contraseña desde link del email. Flujo PKCE: detecta `?code=XXXX` y llama `exchangeCodeForSession`. |
| `/listings/[id]/edit` | Editar anuncio (solo dueño). |
| `/admin` | Panel de administración (requiere rol admin) |
| `/api/admin` | Endpoint server-side con Supabase service role |
| `/api/mares` | Scrapea tabuademares.com, devuelve las 4 mareas del día. Cache 6h con `unstable_cache`. |
| `/api/revalidate` | Revalida la home (ISR) on-demand. POST, requiere Bearer token Supabase. Llamado desde `/publish` al publicar un anuncio. |

---

## ARCHIVOS CLAVE DEL FRONTEND

```
frontend/
├── app/
│   ├── globals.css          ← variables CSS de marca, clases utilitarias
│   ├── layout.tsx           ← layout raíz: BottomNav + RegisterSW + meta PWA
│   ├── page.tsx             ← home completa
│   ├── not-found.tsx        ← página 404 con diseño de marca
│   ├── signin/page.tsx      ← login + registro (tabs)
│   ├── termos/page.tsx      ← Termos e Condições de Uso pública
│   ├── profile/page.tsx     ← perfil editable + mis anuncios + favoritos
│   ├── listings/
│   │   ├── page.tsx         ← listados + filtros
│   │   └── [id]/page.tsx    ← detalle del anuncio
│   ├── store/[id]/page.tsx  ← tienda pública del vendedor
│   └── admin/page.tsx       ← panel de administración (6 tabs)
├── components/
│   ├── BottomNav.tsx          ← nav inferior session-aware
│   ├── BannerRotativo.tsx     ← banners de Supabase con auto-rotación
│   ├── BuscaAutocomplete.tsx  ← búsqueda predictiva del home (debounce+cache+ARIA)
│   ├── HomeClient.tsx         ← cliente del home; usa BuscaAutocomplete + MaresWidget
│   ├── MaresWidget.tsx        ← widget de marés del día (carga post-render, sin impacto en velocidad)
│   ├── InstallAppBanner.tsx   ← banner de instalación PWA (integrado en /signin)
│   ├── ListingCard.tsx        ← card horizontal con foto, precio, favorito
│   ├── RegisterSW.tsx         ← registra el service worker PWA
│   └── ShareIcon.tsx          ← ícono SVG de compartir, reutilizado en todo el sitio
├── lib/
│   ├── supabaseClient.ts    ← cliente Supabase (NEXT_PUBLIC vars, anon key)
│   ├── supabaseAdmin.ts     ← cliente Supabase service role (server-only).
│   │                           Acepta `opts?: { revalidate?: number }`.
│   │                           Sin opts → `cache:"no-store"` (siempre fresco; default para admin/API).
│   │                           Con `revalidate:N` → `next:{revalidate:N}` (permite ISR en páginas).
│   ├── adminSettings.ts     ← fetch cacheado de admin_settings (WhatsApp admin)
│   ├── share.ts             ← función compartilhar() — Web Share API + fallback WhatsApp
│   ├── whatsappUrl.ts       ← buildWaUrl() y openWhatsApp()
│   ├── tracking.ts          ← helpers fire-and-forget: trackListingView, trackWhatsappClick, trackBannerClick
│   └── visitorId.ts         ← UUID anónimo persistido en localStorage (visitantes no logueados)
└── public/
    ├── manifest.json        ← PWA manifest
    ├── sw.js                ← service worker (cache-first assets, network-first HTML)
    ├── icon-192.png         ← ícono PWA 192×192
    ├── icon-512.png         ← ícono PWA 512×512 (también usado como ref para Higgsfield)
    ├── apple-touch-icon.png ← ícono iOS 180×180
    └── banners/
        └── banner-institucional.png  ← banner de lanzamiento (1584×672px)
```

---

## VARIABLES DE ENTORNO REQUERIDAS

En `frontend/.env.local` (local) y en Vercel (producción):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← solo server-side, nunca al cliente
R2_ACCOUNT_ID=...                  ← Cloudflare R2 (fotos)
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
NEXT_PUBLIC_SITE_URL=https://mercadoilha.vercel.app
```
**Fotos:** se suben a **Cloudflare R2** (no Supabase Storage) via `/api/upload`.

---

## SEGURIDAD Y PRIVACIDAD (LGPD)

Aplicado en sesión 2026-06-09. Todos los fixes están en producción vía código;
la migración SQL debe ejecutarse manualmente en Supabase.

### Problema corregido: exposición masiva de datos personales
La política RLS original `"Profiles public read" using (true)` permitía que cualquier
visitante anónimo consultara todos los números de WhatsApp y roles de la tabla `profiles`
via la REST API de Supabase — violación directa de la LGPD.

### Cambios en la base de datos — `supabase/security-fix-profiles.sql`
⚠️ **Ejecutar en Supabase SQL Editor** si aún no se hizo.
- Eliminada la política `"Profiles public read" using (true)`
- Nueva política `"Profiles auth read"`: solo usuarios autenticados leen `profiles`
- Vista `public.profiles_public`: expone solo `id, full_name, avatar_url, created_at`
  (sin `whatsapp` ni `role`). Accesible públicamente (anon).
- Función RPC `get_seller_whatsapp(seller_id uuid)`: único punto de acceso al teléfono.
  Solo ejecutable por usuarios autenticados. Retorna `null` para anónimos.

### Cambios en el frontend
- `app/listings/[id]/page.tsx`: ya NO hace JOIN con `profiles(whatsapp)`. Carga el
  nombre del vendedor desde la vista `profiles_public`. El teléfono se obtiene via
  RPC solo cuando el usuario logueado hace click en "Contatar".
- `app/store/[id]/page.tsx`: fetch del vendedor apunta a `profiles_public` (no `profiles`).
  Botón de contacto también usa el RPC lazy.
- `app/api/upload/route.ts`: ahora exige sesión válida (token Bearer). Sin auth → 401.
- `app/api/admin/route.ts`: ahora exige sesión válida + rol admin.
- `app/publish/page.tsx` y `components/AvatarUpload.tsx`: envían `Authorization: Bearer <token>`
  en cada llamada a `/api/upload`.

---

## CHECKLIST DE DEPLOY EN VERCEL

1. Conectar repo GitHub a Vercel (directorio raíz: `frontend`)
2. Agregar las 3 variables de entorno
3. En Supabase → Auth → habilitar **Email/Password**
4. En Supabase → Storage → crear bucket público **`listing-photos`**
5. En Supabase → SQL Editor → ejecutar en orden:
   - `supabase/fase-1.sql` a `fase-5.sql`
   - `supabase/security-fix-profiles.sql` ← **obligatorio, cierra brecha LGPD**
   ⚠️ Si la DB ya existía antes del 2026-06-08: también ejecutar
   `ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;`
   (ya aplicado en producción, solo necesario para instancias anteriores)
   ⚠️ **Caché de Next.js 14:** `supabaseAdmin.ts` usa `cache: "no-store"` por defecto.
   Si se crea un nuevo cliente server-side, usar `getSupabaseAdmin()` sin opts para datos
   frescos (admin/API), o `getSupabaseAdmin({revalidate:N})` para páginas ISR. La home ya
   usa `revalidate:60` + `/api/revalidate` on-demand al publicar.
6. En Supabase → Table Editor → tabla `admin_settings` → actualizar el número
   real de WhatsApp del admin (key = `admin_whatsapp`, campo `value.value`)
7. En Supabase → tabla `profiles` → asignar `role = 'admin'` al primer usuario

---

## BUGS RESUELTOS — LECCIONES IMPORTANTES

### Recuperação de senha (2026-06-12)
- `resetPasswordForEmail` de Supabase envía tokens de **8 dígitos**, no 6. El setting "OTP length" del dashboard solo afecta `signInWithOtp`, no este flujo. → El campo de código en el frontend debe usar `maxLength={8}` y validar `code.length !== 8`.
- **No usar `redirectTo`** en `resetPasswordForEmail` salvo que la URL esté en Supabase → Authentication → URL Configuration → Redirect URLs. Si no está en la whitelist, Supabase devuelve error y el email nunca se envía.
- Flujo correcto: `resetPasswordForEmail(email)` sin redirectTo → `verifyOtp({ email, token, type: "recovery" })` → `updateUser({ password })`.
- Template del email (Supabase → Authentication → Emails → Reset Password) debe tener `{{ .Token }}` para que aparezca el código numérico.
- **Skill:** `.claude/skills/recuperacion de senha.md` — tiene el código completo y la configuración de Supabase.

---

## OPTIMIZACIONES DE RENDIMIENTO APLICADAS

| Componente | Problema | Fix aplicado | Fecha |
|------------|----------|--------------|-------|
| `app/category/[slug]/page.tsx` | Era `"use client"` → spinner visible + `window.location.href` hacía reload completo de página | Convertido a Server Component. Usa `getSupabaseAdmin()` server-side + `redirect()` de Next.js. Carga instantánea sin spinner. | 2026-06-09 |
| `app/profile/page.tsx` + `contexts/SessionContext.tsx` | Primer toque a Perfil mostraba spinner: chunk JS pesado (arrastraba editor de avatar completo) + fetch a Supabase arrancaba recién al montar la página | 1) `lib/profileCache.ts` (nuevo): cache en memoria con `prewarmProfile()` que dispara las queries en background al resolverse la sesión (mientras el usuario está en home). `getCachedProfile()` → render instantáneo sin spinner. `setCachedProfile()` mantiene cache sincronizado tras mutaciones. 2) `AvatarCropModal` pasa a `dynamic` (`next/dynamic`, `ssr:false`) → sale del chunk inicial, se baja solo al tocar "Trocar foto". | 2026-06-18 |
| `app/page.tsx` + `app/category/[slug]/page.tsx` | Latencia "primer toque": `force-dynamic` en home y categorías → SSR en cada request → primer visitante con función fría pagaba cold start Vercel + conexión + queries. El `cache:"no-store"` global en `supabaseAdmin.ts` también bloqueaba ISR. | 1) `supabaseAdmin.ts` acepta `opts.revalidate` opcional (default sigue `no-store`). 2) `page.tsx`: `revalidate=60` con `getSupabaseAdmin({revalidate:60})` → build marca `/` como `○ (Static)` con ISR. 3) `category/[slug]`: `revalidate=300`. 4) `app/api/revalidate/route.ts`: revalidación on-demand (POST, auth Supabase) → `publish/page.tsx` lo llama fire-and-forget al publicar, anuncio aparece en home al instante. Red de seguridad: ISR de 60s cubre expiración por cron. | 2026-06-18, commit `0113c44` |

**Patrón de referencia:** Páginas que solo renderizan datos estáticos (listas de links, etc.) deben ser Server Components. El patrón `"use client"` + `useEffect` + spinner es innecesario cuando no hay interactividad.

**Patrón prewarm + stale-while-revalidate:** Para rutas con datos personales (perfil, mis anuncios) que requieren autenticación y son Client Components: precalentar los datos en background al resolverse la sesión (`SessionContext`), servir desde cache en el primer render, revalidar silenciosamente en segundo plano. Sincronizar el cache tras cada mutación local. El editor de avatar (o cualquier modal pesado de uso raro) debe importarse con `next/dynamic` para no inflar el chunk de la ruta.

---

## TRACKING PRE-MONETIZACIÓN (2026-06-18, commit `57ce23d`)

Estrategia: **lanzar 100% gratis**. Solo se recolectan datos (lo irrecuperable hacia atrás);
features de cobro se posponen hasta tener tracción. Ver `comisiones.md` para el plan completo.

### DB — `supabase/fase-monetizacion-tracking.sql` (idempotente)
⚠️ **Pendiente: el usuario debe correrla en Supabase SQL Editor** (aún no ejecutada).
- Tablas `whatsapp_clicks`, `banner_clicks` (RLS: lectura/borrado solo admin; insert solo via RPC `security definer`)
- `track_listing_view` ahora es `security definer` — antes fallaba para visitantes (RLS de `listing_statistics` es solo-admin) y el frontend nunca la llamaba → vistas **nunca** se grababan
- RPCs: `track_whatsapp_click`, `track_banner_click`, `get_tracking_summary`, `get_top_listings_by_whatsapp`, `get_my_listings_stats`

### Frontend
- `lib/visitorId.ts` — UUID anónimo en localStorage para visitantes no logueados
- `lib/tracking.ts` — helpers fire-and-forget (no bloquean UI). Enchufados en:
  - Detalle anuncio `/listings/[id]`: vista al entrar + WA al contactar
  - Tienda `/store/[id]`: WA al contactar
  - `BannerRotativo`: click en imagen + CTA WhatsApp
  - Home: botón "Fale conosco"
- Admin: nueva pestaña **📈 Métricas** (solo lectura) — totales + top anuncios por contactos
- Perfil del vendedor (`/profile`): muestra 👁️ vistas + 💬 contatos por anuncio via RPC `get_my_listings_stats` (filtra por `auth.uid()`). Es enganche de retención → deseo del plan Pro futuro.
  - Debajo de la lista de anuncios hay dos banners informativos (en ese orden): 1) banner amarillo con aviso de validez 30 días + eliminación tras 15 días inactivo; 2) banner azul "O que significam os números?" que explica 👁️ Visualizações y 💬 Contatos — necesario porque en móvil los `title` HTML no funcionan al tocar.

### Panel Admin — 8 tabs (antes eran 7)
Dashboard | Categorias | Usuários | Anúncios | Banners | Config | Denúncias | **📈 Métricas**

---

## PENDIENTES / IDEAS PARA PRÓXIMAS SESIONES

- Íconos PWA con el logo real (reemplazar los placeholders actuales)
- Republicar anuncio vencido con un clic desde el perfil
- Botón "Marcar como vendido" desde el perfil del vendedor
- Filtros adicionales en listados: precio, sub-zona
- Panel admin: gestión de localidades y sub-zonas
- Búsqueda autocomplete: extender cache a `sessionStorage` para persistir entre navegaciones

---

## WIDGET DE MARÉS

- **Fuente de datos:** scraping de `https://tabuademares.com/br/bahia/morro-de-sao-paulo`
- **Dependencia:** `cheerio` (parser HTML server-side)
- **API route:** `frontend/app/api/mares/route.ts` — usa `unstable_cache` de Next.js, revalida cada 6 horas
- **Selector HTML:** `tr[onclick*="Day('YYYY-MM-D')"]` → `td.tabla_mareas_marea` → `.tabla_mareas_marea_hora` / `.tabla_mareas_marea_altura_numero` / `.tabla_mareas_marea_bajamar`
- **Componente:** `MaresWidget.tsx` — cliente, carga con `useEffect` después del render principal
- **Comportamiento:** si falla el scraping, el widget no aparece (la home nunca se rompe)
- **Posición en home:** entre "Anúncios recentes" y "Fale conosco"
- **Diseño:** fondo `#E6F1FB`, texto `#185FA5`, título "〰 Tabela de Marés" + fecha + grid 2 columnas con ↑↓ hora altura tipo + "fonte: tabuademares.com"

---

## CÓMO CORRER EL PROYECTO LOCALMENTE

```bash
cd frontend
npm run dev           # solo en esta Mac: http://localhost:3000
npm run dev -- -H 0.0.0.0   # accesible desde celular en misma red WiFi
```

IP local de la Mac: `192.168.10.9` (puede cambiar según la red)

Para ver desde el celular sin WiFi compartido usar localtunnel:
```bash
npx localtunnel --port 3000   # genera URL pública HTTPS temporal
```

---

## CÓMO USAR ESTE ARCHIVO EN UNA CONVERSACIÓN NUEVA

Al inicio del mensaje escribí:
> "Tengo un proyecto en curso. Te adjunto el contexto completo:"

y pegá el contenido de este archivo. Claude retoma desde donde estaban
sin necesidad de re-explicar todo.
