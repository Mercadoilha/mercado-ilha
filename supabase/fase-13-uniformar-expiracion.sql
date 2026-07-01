-- Fase 13: terminar de aplicar la "expiración uniforme 30 días" (commit c3836d7).
-- La migración de fase-1.sql ya documenta expires_in_days = null para todas las
-- categorías, pero el UPDATE nunca se corrió contra la base real: Produtos,
-- Terrenos, Casas y Aluguéis seguían con valores viejos (20/60/60/60 días).
-- Esto causó que el anuncio de Diego (categoría Produtos) expirara a los 20 días
-- en vez de 30.

update public.categories
  set expires_in_days = null
  where slug in ('produtos', 'terrenos', 'casas', 'alugueis');
