# CLAUDE.md — Mercado Ilha

## Contexto rápido
Marketplace web para isla de Tinharé (Brasil). Reemplaza grupos de WhatsApp donde
el comercio local se pierde en el flujo del chat. Contacto comprador-vendedor vía
WhatsApp (botón con mensaje pre-armado por categoría). Sin chat interno.

## Archivos de referencia — leerlos SIEMPRE al iniciar sesión
- `MEMORY.md` — contexto completo del proyecto (decisiones, categorías, geografía,
  diseño). Fuente de verdad. Leerlo antes de cualquier acción.
- `PROMPT_CLAUDE_CODE.md` — prompt detallado con instrucciones técnicas completas
  y definición de cada fase. Consultarlo antes de construir cualquier fase.
- `GUIA_PASO_A_PASO.md` — guía para el dueño del proyecto (no técnico). No es
  para Claude Code, es para el usuario.
- `ORCHESTRADOR.md` — sistema multiagente de optimización y desarrollo.
  Leerlo cuando el usuario pida: optimizar rendimiento, analizar navegación,
  agregar features, arreglar queries, mejorar PWA, o cualquier tarea de código.
- `PROMPT_MAESTRO_PARA_CLAUDE_CODE.md` - prompt completo del Orchestrador con
  los 6 subagentes embebidos y sus skills. Cargarlo inmediatamente cuando se
  activa el ORCHESTRADOR.md.

## Stack
Next.js (App Router) + TypeScript + Tailwind CSS / Supabase (DB + Auth + Storage)
/ Vercel (hosting) / PWA instalable

## Estructura de carpetas esperada
mercado-ilha/
├── CLAUDE.md
├── MEMORY.md
├── PROMPT_CLAUDE_CODE.md
├── GUIA_PASO_A_PASO.md
├── app/              # Next.js App Router
├── components/
├── lib/              # Supabase client, helpers
├── public/           # Logo SVG, íconos PWA
└── supabase/         # Migrations, seed SQL

## Base de datos (Supabase)
Tablas principales: islands → localities → subzones / categories →
subcategories / users (con campo role: user|admin) / listings (anuncios) /
listing_photos / listing_service_zones / banners / reports / settings
RLS activo: lectura pública de anuncios activos; escritura solo del dueño; full
access para admin.

## Reglas clave del dominio
- Fotos: máx 6, comprimir/redimensionar EN EL NAVEGADOR antes de subir.
- Expiración: configurable por categoría (días o NULL = sin expiración).
- Ubicación: tipo FIJA (sub-zona única) | ZONAS_ATENCION (múltiple + "toda a ilha")
  según la categoría. Categorías 2-6 (servicios) usan ZONAS_ATENCION.
- Gastronomia (cat 7): campos extra → delivery (bool) + tabla precios por sub-zona.
- Construção (cat 3): botón "Pedir orçamento", mensaje WhatsApp distinto.
- "Outros" en sub-zonas: texto libre del usuario, NO crea sub-zona oficial.
- Todo administrable: categorías, sub-categorías, zonas, banners, mensajes WA,
  días de expiración → todo en DB, nada hardcodeado.

## Diseño
Paleta: #185FA5 (primario) / #EF9F27 (acento/botón publicar) /
#B5D4F4 #E6F1FB (fondos azul) / #9FE1CB #0F6E56 (verde-mar apoyo)
Logo: SVG — bolsa de compras grande con montículo de arena y faro
(blanco + franjas rojas + luz) adentro.
Layout anuncios: LISTA horizontal (miniatura 88px izq + info der). Sin grilla.
Interfaz: 100% portugués brasileño.

## Fases — estado actual
Fase 1 — DB Supabase (tablas, RLS, seed)          [ ] pendiente
Fase 2 — Autenticación (registro, login, roles)   [ ] pendiente
Fase 3 — Publicar y ver anuncios (home/lista/det) [ ] pendiente
Fase 4 — Búsqueda y filtros                       [ ] pendiente
Fase 5 — Cuenta y perfil-tienda vendedor          [ ] pendiente
Fase 6 — Panel admin completo                     [ ] pendiente
Fase 7 — Banners rotativos + PWA                  [ ] pendiente
Fase 8 — Pulido + deploy GitHub/Vercel            [ ] pendiente

Construir UNA fase por vez. Esperar OK del usuario antes de avanzar.

## Comportamiento esperado de Claude Code
1. Al iniciar sesión: leer MEMORY.md y este archivo.
2. Antes de codear cada fase: mostrar plan breve y esperar OK.
3. Cuando necesite llaves de Supabase u otra acción del usuario: pedirlas con
   instrucciones simples (el usuario no tiene experiencia técnica).
4. Si genera SQL para Supabase: indicar exactamente cómo correrlo en SQL Editor.
5. Hablar con el usuario en español. Código y UI en portugués brasileño.
6. Al terminar cada fase: listar qué probar y cómo verlo en localhost. 