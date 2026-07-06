# CLAUDE.md — Mercado Ilha

## Contexto rápido
Marketplace web para la isla de Tinharé (Morro de São Paulo, Brasil). Reemplaza los
grupos de WhatsApp donde el comercio local se pierde en el flujo del chat. Contacto
comprador-vendedor vía WhatsApp (botón con mensaje pre-armado por categoría). Sin chat
interno. En producción (`Mercadoilha/mercado-ilha`). Servicio gratuito al inicio.

## ⚡ PILAR TRANSVERSAL — VELOCIDAD DE NAVEGACIÓN
Regla que atraviesa **toda** tarea, sin excepción: ninguna acción debe degradar la
velocidad de navegación dentro de la página. El objetivo permanente es que la app
**navegue de forma ágil y se sienta veloz** para el usuario.

- Antes de aplicar cualquier cambio, evaluar su impacto en el rendimiento percibido
  (carga inicial, transición entre rutas, primer toque). Si un cambio agrega latencia,
  buscar la alternativa que mantenga o mejore la fluidez.
- Preferir siempre los patrones ya probados en este proyecto: Server Components para
  páginas de solo-lectura, ISR/revalidate en vez de `force-dynamic`, `next/image`,
  `Promise.all` (sin waterfalls), prewarm + stale-while-revalidate para datos con auth,
  `next/dynamic` para módulos pesados de uso raro, prefetch de rutas probables.
- Cargar lo secundario (widgets, editores, modales) después del render principal, nunca
  bloqueando la ruta.
- Verificar el impacto: `npm run build` (que la ruta siga `○ Static`/ISR cuando corresponde)
  y probar la navegación real antes de dar por terminada la tarea.

## Archivos de referencia — leerlos SIEMPRE al iniciar sesión
- `MEMORY.md` — **fuente de verdad**: contexto completo, decisiones, categorías,
  geografía, diseño, rutas, optimizaciones. Leerlo antes de cualquier acción.
- `ORCHESTRADOR.md` — sistema multiagente de optimización/desarrollo (coordinador +
  6 subagentes con sus skills embebidas). Cargarlo cuando el usuario pida: optimizar
  rendimiento, analizar navegación, agregar features, arreglar queries, mejorar PWA, o
  cualquier tarea de código pesada.
- `GUIA_PASO_A_PASO.md` — guía para el dueño (no técnico). No es para Claude.
- `PROMPT_CLAUDE_CODE.md` — **registro histórico** del build inicial (Fases 1-8, ya
  completadas). Sus datos son del arranque y NO reflejan el estado actual; consultar
  solo por contexto, nunca como fuente de verdad.

## Stack
Next.js 14 (App Router) + TypeScript + CSS inline con variables CSS (**sin Tailwind**) +
Supabase (DB + Auth) + Cloudflare R2 (fotos) + Vercel (hosting, región `gru1`). PWA
instalable. Mobile-first (max-width 480px). Interfaz 100% portugués brasileño.

## Base de datos (Supabase)
Tablas: islands → localities → subzones / categories → subcategories / home_sections /
profiles (campo `role: user|admin`) / listings / listing_photos / listing_service_zones /
banners / reports / admin_settings + tracking (whatsapp_clicks, banner_clicks, listing_statistics).
RLS activo: lectura pública de anuncios activos; escritura solo del dueño; full access admin;
teléfono del vendedor solo vía RPC `get_seller_whatsapp` (requiere sesión). Detalle en MEMORY.md.

## Reglas clave del dominio
- Fotos: máx 6 por anuncio, subidas a Cloudflare R2 vía `/api/upload` (con auth Bearer).
- Expiración: 30 días por defecto (o `categories.expires_in_days` si no es null); ver
  regla completa del cron en MEMORY.md.
- Ubicación por categoría (`location_type`, leído en vivo de DB): `fija` (una sub-zona) |
  `zonas_de_atencion` (varias sub-zonas + "toda a ilha") | `sin_ubicacion`.
- Botón de contacto y mensaje WhatsApp: configurables por categoría (ej. "Pedir orçamento").
- "Outros" en sub-zonas: texto libre del usuario, NO crea sub-zona oficial.
- **Todo administrable desde `/admin`, nada hardcodeado**: categorías, subcategorías,
  secciones del home, zonas, banners, mensajes WA, WhatsApp del admin, días de expiración.
  (Excepción documentada: widgets de referencia estática como marés/barcos van hardcodeados.)

## Diseño
Paleta: `#185FA5` primario / `#EF9F27` acento (botón publicar) / `#B5D4F4` `#E6F1FB` fondos
azul / `#9FE1CB` `#0F6E56` verde-mar apoyo. Variables CSS en `globals.css`.
Logo: SVG en `/public/logo.svg` (bolsa de compras con montículo de arena y faro adentro).
Cards de anuncios: grid 2 columnas estilo Mercado Livre, imagen `contain` (ver MEMORY.md).

## Estado del proyecto
Fases 1-8 **completadas y en producción** (DB+RLS, auth, publicar/ver, búsqueda+filtros,
perfil-tienda, panel admin 8 tabs, banners+PWA, deploy). Post-lanzamiento: buscador
autocomplete, widgets marés/barcos, fix LGPD, tracking pre-monetización, multi-categoría,
destacar anúncio (bump), rediseño de cards. El trabajo actual es de features y optimización,
no de construcción de fases. Backlog y pendientes: ver MEMORY.md §PENDIENTES.

## Comportamiento esperado de Claude Code
1. Al iniciar sesión: leer MEMORY.md y este archivo.
2. Antes de un cambio no trivial: mostrar plan breve y esperar OK.
3. Respetar el **pilar de velocidad** (arriba) en cada tarea.
4. Cuando necesite acción del usuario (llaves, correr SQL): pedirla con instrucciones
   simples y claras (el usuario no tiene experiencia técnica).
5. Si genera SQL para Supabase: indicar exactamente cómo correrlo en el SQL Editor.
6. Hablar con el usuario en español. Código y UI en portugués brasileño.
7. Al terminar: listar qué probar y cómo verlo (localhost o producción).
