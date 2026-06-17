-- Fase 9 — Índices de rendimiento (latencia al escalar)
-- Correr en Supabase → SQL Editor. Todo es idempotente (if not exists),
-- no borra ni modifica datos, solo acelera consultas.
--
-- Índices ya existentes (fase-4.sql): status, location, category, search_vector.
-- favorites(profile_id) NO se agrega: el unique(profile_id, listing_id) ya crea
-- un índice btree con profile_id como columna líder.

-- Anuncios de un usuario (perfil, "meus anúncios") y refuerzo de RLS por dueño
create index if not exists listings_user_id_idx on public.listings(user_id);

-- Orden por más recientes (home, listas) — DESC coincide con el orden de consulta
create index if not exists listings_created_at_idx on public.listings(created_at desc);

-- Job de expiración (cron) y filtros por vencimiento
create index if not exists listings_expires_at_idx on public.listings(expires_at);

-- Búsqueda por título con ILIKE (%texto%) — requiere pg_trgm
create extension if not exists pg_trgm;
create index if not exists listings_title_trgm_idx
  on public.listings using gin (title gin_trgm_ops);
