# Histórico — Mercado Ilha

Archivos que **ya cumplieron su función**. Se guardan como registro, pero **no son
fuente de verdad**: la fuente de verdad es `MEMORY.md` en la raíz del proyecto.
Nada de acá debe usarse para tomar decisiones sobre el estado actual de la app.

Ordenado el 2026-07-22.

## `planes/`
Auditorías de velocidad, todas ejecutadas y en producción.

- `OPTIMIZATION_MASTER_PLAN.md` — V1, Fases 1-6 completas.
- `OPTIMIZATION_MASTER_PLAN_V2.md` — V2, Fases 1-4 completas.
- `OPTIMIZATION_MASTER_PLAN_V3.md` — V3, Fases 1-5 (T1-T10, T12) desplegadas.
  Quedan T11 y las contingencias C1-C3, que **solo se activan si la app llega al 70%
  de algún cupo** de Supabase o Vercel. Si eso pasa, recuperar este archivo.

## `prompts/`
Prompts de trabajo ya ejecutados; lo que describen está en producción.

- `PROMPT_INSTALAR_APP.md` — flujo "Instalar App".
- `PROMPT_FIXES_ANDROID.md` — fixes de instalación en Android.
- `PROMPT_FIX_PARPADEO_Y_DEMORAS.md` — parpadeo y demoras post-V3.
- `PROMPT_LOJAS_FAVORITOS.md` — directorio de lojas + favoritos.
- `PROMPT_REDISENO_NAVEGACION.md` — rediseño de navegación estilo Mercado Livre.
- `PROMPT_CLAUDE_CODE.md` — registro del build inicial (Fases 1-8).
- `PROMPT_MAESTRO_PARA_CLAUDE_CODE.md` — reemplazado por `ORCHESTRADOR.md`.
- `FABLE_5_PROMPTING.md` — reemplazado por `manual_fable5.md`.

## `docs-iniciales/`
Documentos de mayo 2026, cuando el repo era solo SQL. Describen un proyecto que ya
no existe (sin frontend, sin app).

- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`

## `assets-sin-uso/`
Imágenes que ya no referencia ningún archivo de la app.

- `coco.svg`, `mercado-ilha-icone.svg`, `mercado-ilha-logo.svg` — logos previos al
  rediseño; los vigentes son `logo.svg`, `logo-dark.svg`, `logo-entrada.svg`, `Icono.svg`.
- `banners/` — los 4 banners originales. Hoy los banners se cargan desde `/admin`
  y viven en Cloudflare R2, no en el proyecto.
