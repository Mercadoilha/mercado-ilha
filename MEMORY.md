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
  → 10 categorías (3 por fila) → anuncios recientes → Fale conosco.
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

---

## PANEL DE ADMINISTRADOR

Ruta: `/admin` — protegida por rol `admin` en tabla `profiles`.
Acceso desde perfil: botón "⚙️ Painel de administração" visible solo para admins.

6 tabs implementados:
- **Dashboard:** contadores (anúncios activos, total, denúncias nuevas, usuarios, banners)
- **Anúncios:** lista todos, filtro por estado, botones Ativar / Ocultar / Bloquear / Deletar
- **Denúncias:** lista con borde de color por estado, "Ocultar anúncio + resolver" en 1 clic
- **Banners:** CRUD completo (crear con URL + link + posición, activar/pausar, eliminar)
- **Usuários:** búsqueda por nombre/WhatsApp, dar/quitar admin, bloquear/desbloquear
- **Categorias:** CRUD completo. Editar nombre, ícono (EmojiPicker), slug, tipo de ubicación,
  texto del botón de contacto, descripción (aparece bajo el ícono en la home), y orden
  (flechas ↑↓). Subcategorías: agregar, editar nombre, cambiar ícono, reordenar, eliminar.

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
| `/listings` | Listados + filtro por categoría y búsqueda |
| `/listings/[id]` | Detalle: galería fotos, precio, vendedor, WhatsApp, denuncia |
| `/publish` | Formulario publicar: fotos, categoría→subcategoría, localidad→subzona |
| `/profile` | Perfil editable (nombre+WhatsApp), mis anuncios, favoritos, cerrar sesión |
| `/signin` | Tabs: login y registro completo |
| `/store/[id]` | Tienda pública del vendedor con banner azul y sus anuncios |
| `/termos` | Página pública de Termos e Condições de Uso |
| `/admin` | Panel de administración (requiere rol admin) |
| `/api/admin` | Endpoint server-side con Supabase service role |

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
│   ├── HomeClient.tsx         ← cliente del home; usa BuscaAutocomplete
│   ├── InstallAppBanner.tsx   ← banner de instalación PWA (integrado en /signin)
│   ├── ListingCard.tsx        ← card horizontal con foto, precio, favorito
│   ├── RegisterSW.tsx         ← registra el service worker PWA
│   └── ShareIcon.tsx          ← ícono SVG de compartir, reutilizado en todo el sitio
├── lib/
│   ├── supabaseClient.ts    ← cliente Supabase (NEXT_PUBLIC vars, anon key)
│   ├── supabaseAdmin.ts     ← cliente Supabase service role (server-only)
│   ├── adminSettings.ts     ← fetch cacheado de admin_settings (WhatsApp admin)
│   ├── share.ts             ← función compartilhar() — Web Share API + fallback WhatsApp
│   └── whatsappUrl.ts       ← buildWaUrl() y openWhatsApp()
└── public/
    ├── manifest.json        ← PWA manifest
    ├── sw.js                ← service worker (cache-first assets, network-first HTML)
    ├── icon-192.png         ← ícono PWA 192×192
    ├── icon-512.png         ← ícono PWA 512×512
    └── apple-touch-icon.png ← ícono iOS 180×180
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

## CHECKLIST DE DEPLOY EN VERCEL

1. Conectar repo GitHub a Vercel (directorio raíz: `frontend`)
2. Agregar las 3 variables de entorno
3. En Supabase → Auth → habilitar **Email/Password**
4. En Supabase → Storage → crear bucket público **`listing-photos`**
5. En Supabase → SQL Editor → ejecutar `supabase/fase-1.sql` a `fase-5.sql`
   ⚠️ Si la DB ya existía antes del 2026-06-08: también ejecutar
   `ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;`
   (ya aplicado en producción, solo necesario para instancias anteriores)
6. En Supabase → Table Editor → tabla `admin_settings` → actualizar el número
   real de WhatsApp del admin (key = `admin_whatsapp`, campo `value.value`)
7. En Supabase → tabla `profiles` → asignar `role = 'admin'` al primer usuario

---

## PENDIENTES / IDEAS PARA PRÓXIMAS SESIONES

- Íconos PWA con el logo real (reemplazar los placeholders actuales)
- Republicar anuncio vencido con un clic desde el perfil
- Botón "Marcar como vendido" desde el perfil del vendedor
- Filtros adicionales en listados: precio, sub-zona
- Panel admin: gestión de localidades y sub-zonas
- Búsqueda autocomplete: extender cache a `sessionStorage` para persistir entre navegaciones

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
