# Contributing to Mercado Ilha

Este documento describe cómo colaborar en el proyecto y cómo organizar el trabajo en fases.

## Flujo recomendado

1. Abre un issue o ticket para cada cambio importante.
2. Crea una rama nueva desde `main` con un nombre descriptivo:
   - `feature/stripe-integration`
   - `feature/admin-panel`
   - `fix/rls-policy`
3. Trabaja en la rama y haz commits pequeños y claros.
4. Cuando el trabajo esté listo, crea un pull request hacia `main`.

## Estructura de las fases

- `supabase/fase-1.sql`: esquema base y datos iniciales.
- `supabase/fase-2.sql`: interacciones, conversaciones y favoritos.
- `supabase/fase-3.sql`: pagos, promociones y auditoría.
- `supabase/fase-4.sql`: búsqueda full-text, tags y métricas.
- `supabase/fase-5.sql`: suscripciones, soporte y webhooks.

Cada fase debe ejecutarse en orden en el SQL Editor de Supabase, garantizando que las dependencias de tablas y funciones existan.

## Buenas prácticas

- Mantén el código del SQL legible y con comentarios claros.
- No mezcles varias fases grandes en un solo commit.
- Si se agrega una nueva fase, actualiza `README.md` y `CHANGELOG.md`.

## Convenciones de commit

Usa mensajes de commit simples y descriptivos, por ejemplo:
- `Add support tickets and webhook events schema`
- `Fix admin RLS policy for subscriptions`
- `Update README with GitHub repo info`

## Publicación en GitHub

- Siempre realiza un `git pull origin main` antes de crear nuevas ramas.
- Mantén la rama `main` limpia y estable.
- Empuja la rama y crea el PR en GitHub para revisión.
