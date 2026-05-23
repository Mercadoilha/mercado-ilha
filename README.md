# Mercado Ilha

Repositorio de SQL para la plataforma "Mercado Ilha".

Este proyecto contiene el esquema de bases de datos y políticas de seguridad para un marketplace basado en Supabase.

## Estado actual
- Fases 1 a 5 creadas y documentadas.
- Repo inicializado localmente y subido a GitHub.
- URL del repositorio: https://github.com/Mercadoilha/mercado-ilha

## Fases
- `supabase/fase-1.sql`: esquema inicial con tablas, RLS y seed.
- `supabase/fase-2.sql`: interacción, conversaciones, favoritos y notificaciones.
- `supabase/fase-3.sql`: pagos, promociones, métricas y auditoría.
- `supabase/fase-4.sql`: búsqueda full-text, tags y métricas analíticas.
- `supabase/fase-5.sql`: planes de suscripción, soporte y webhooks.

## Instrucciones
1. Ejecutar los scripts en Supabase SQL Editor en orden: `fase-1.sql` a `fase-5.sql`.
2. Configurar RLS y autenticación en Supabase.
3. Refrescar vistas y métricas según sea necesario.
4. Mantener el repo sincronizado con GitHub.

## Siguientes pasos sugeridos
- Integrar pagos reales (Stripe/PayPal).
- Implementar webhooks y backend para soporte.
- Crear el frontend de administración y panel de métricas.
