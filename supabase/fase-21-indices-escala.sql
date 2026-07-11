-- ============================================================
-- Fase 21 — Índices parciales para escala (plan V3, T2)
-- ============================================================
-- Objetivo: que las 3 formas de la query más ejecutada de la app
-- (listar anuncios activos ordenados por más recientes) calcen con
-- un índice EXACTO, para que el p95 no se degrade cuando listings
-- tenga 10k+ filas. Hoy dependen de índices sueltos (fase-4, fase-9)
-- que el planner combina con Sort/Bitmap.
--
-- Son índices PARCIALES (where status='active'): solo indexan las
-- filas vivas (las que se listan), así son chicos y baratos de
-- mantener. Le dan al planner el predicado exacto de:
--   lib/listingsApi.ts        (vista default de /listings + prewarm home)
--   ListingsClient.tsx        (vista por categoría)
--   StoreClient.tsx           (tienda del vendedor)
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
--   Solo AGREGA índices: no borra ni modifica datos ni comportamiento.
--
-- NOTA: NO se borran los índices viejos (fase-4/fase-9) en esta tarea.
-- Evaluar cuáles quedan sin uso recién con datos reales
-- (pg_stat_user_indexes) en una sesión futura.
-- ============================================================

-- Vista default de /listings y prewarm del home (status + orden por fecha):
create index if not exists listings_active_created_idx
  on public.listings (created_at desc)
  where status = 'active';

-- Vista por categoría (la 2ª más común):
create index if not exists listings_active_cat_created_idx
  on public.listings (category_id, created_at desc)
  where status = 'active';

-- Tienda del vendedor (/store/[id]):
create index if not exists listings_active_user_created_idx
  on public.listings (user_id, created_at desc)
  where status = 'active';

-- ============================================================
-- Verificación (opcional, correr aparte para comparar planes):
--   explain analyze
--   select id from public.listings
--   where status = 'active'
--   order by created_at desc limit 60;
-- Debe aparecer "Index Scan ... listings_active_created_idx"
-- (o el _cat_ / _user_ según la variante con where extra).
-- ============================================================
-- FIN
-- ============================================================
