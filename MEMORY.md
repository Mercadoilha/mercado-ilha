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

## CATEGORÍAS (10, todas en Supabase)

Tabla `categories` tiene columna `description text` (nullable) — se muestra debajo del
ícono en la home. Se gestiona desde el tab Categorias del admin.

| # | Categoría | Slug | Ubicación | Botón | Expiración |
|---|-----------|------|-----------|-------|------------|
| 1 | Produtos | `produtos` | Fija | Contatar vendedor | 20 días |
| 2 | Serviços do lar | `servicos-do-lar` | Zonas de atención | Contatar | Sin expiración |
| 3 | Construção | `construcao` | Zonas de atención | Pedir orçamento | Sin expiración |
| 4 | Beleza e bem-estar | `beleza-e-bem-estar` | Zonas de atención | Contatar | Sin expiración |
| 5 | Translados | `translados` | Zonas de atención | Contatar | Sin expiración |
| 6 | Envios | `envios` | Zonas de atención | Contatar | Sin expiración |
| 7 | Gastronomia | `gastronomia` | Fija + delivery | Fazer pedido | Sin expiración |
| 8 | Terrenos | `terrenos` | Fija | Contatar vendedor | 60 días |
| 9 | Casas | `casas` | Fija | Contatar vendedor | 60 días |
| 10 | Aluguéis | `alugueis` | Fija | Contatar | 60 días |

**Tipos de ubicación:**
- `fija`: selector de una sub-zona. Filtro por sub-zona.
- `zonas_de_atencion`: el prestador marca sub-zonas donde trabaja + checkbox
  "Atendo em toda a ilha".
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
  → 10 categorías (3 por fila) → anuncios recientes → **Tabela de Marés** → Fale conosco.
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

7 tabs implementados (orden actual de la barra):
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
  El icon picker del admin tiene un grupo "Esportes" con 🏄 🤿 💪 🎾 (agregado en commit `61ca6c4`).
  **Error handling en reorden:** si el update a Supabase falla (ej. RLS), muestra un `alert`
  con el mensaje de error en lugar de fallar silenciosamente (commit `3e0c5ec`).
- **Usuários:** búsqueda por nombre/WhatsApp, dar/quitar admin, bloquear/desbloquear
- **Anúncios:** lista todos, filtro por estado, botones Ativar / Ocultar / Bloquear / Deletar
- **Banners:** CRUD completo (crear con URL + link + posición, activar/pausar, eliminar)
- **Config:** WhatsApp de contacto del admin + atalho personalizable de la barra inferior
- **Denúncias:** lista con borde de color por estado, "Ocultar anúncio + resolver" en 1 clic

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
| `/api/admin` | Endpoint server-side con Supabase service role |
| `/api/mares` | Scrapea tabuademares.com, devuelve las 4 mareas del día. Cache 6h con `unstable_cache`. |

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
│   ├── supabaseAdmin.ts     ← cliente Supabase service role (server-only). USA cache:"no-store"
│   │                           en el fetch global para que Next.js 14 no cachee las queries
│   │                           y la página principal siempre refleje cambios del admin en tiempo real.
│   ├── adminSettings.ts     ← fetch cacheado de admin_settings (WhatsApp admin)
│   ├── share.ts             ← función compartilhar() — Web Share API + fallback WhatsApp
│   └── whatsappUrl.ts       ← buildWaUrl() y openWhatsApp()
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
```

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
   ⚠️ **Caché de Next.js 14:** el cliente admin (`supabaseAdmin.ts`) usa `cache: "no-store"`
   en el fetch global — si se crea un nuevo cliente Supabase server-side, siempre incluir
   esa opción o los cambios del admin no se reflejan en la página hasta que expira el caché.
6. En Supabase → Table Editor → tabla `admin_settings` → actualizar el número
   real de WhatsApp del admin (key = `admin_whatsapp`, campo `value.value`)
7. En Supabase → tabla `profiles` → asignar `role = 'admin'` al primer usuario

---

## OPTIMIZACIONES DE RENDIMIENTO APLICADAS

| Componente | Problema | Fix aplicado | Fecha |
|------------|----------|--------------|-------|
| `app/category/[slug]/page.tsx` | Era `"use client"` → spinner visible + `window.location.href` hacía reload completo de página | Convertido a Server Component. Usa `getSupabaseAdmin()` server-side + `redirect()` de Next.js. Carga instantánea sin spinner. | 2026-06-09 |

**Patrón de referencia:** Páginas que solo renderizan datos estáticos (listas de links, etc.) deben ser Server Components. El patrón `"use client"` + `useEffect` + spinner es innecesario cuando no hay interactividad.

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
