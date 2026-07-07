-- Fase 19 — Búsqueda sin acentos ("pao" encuentra "Pão")
-- Cómo correrlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Es seguro correrlo con la app en producción: solo agrega columnas nuevas
-- que el código viejo no usa. Se puede correr más de una vez sin problema.

-- 1) Extensiones: unaccent (quita acentos) y pg_trgm (índices para ILIKE).
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- 2) unaccent() no puede usarse directo en columnas generadas porque no es
--    IMMUTABLE; este wrapper con diccionario fijo sí lo es.
create or replace function public.immutable_unaccent(txt text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, txt)
$$;

-- 3) Columnas normalizadas (minúsculas y sin acentos), mantenidas por Postgres.
alter table public.listings
  add column if not exists title_norm text
  generated always as (lower(public.immutable_unaccent(title))) stored;

alter table public.listings
  add column if not exists description_norm text
  generated always as (lower(public.immutable_unaccent(coalesce(description, '')))) stored;

alter table public.categories
  add column if not exists name_norm text
  generated always as (lower(public.immutable_unaccent(name))) stored;

alter table public.subcategories
  add column if not exists name_norm text
  generated always as (lower(public.immutable_unaccent(name))) stored;

-- 4) Índices trigram para que los ILIKE '%...%' sigan rápidos al crecer la tabla.
-- pg_trgm puede estar instalado en el schema public o extensions según el
-- proyecto; con el search_path cubriendo ambos, gin_trgm_ops resuelve igual.
set search_path = public, extensions;

create index if not exists idx_listings_title_norm_trgm
  on public.listings using gin (title_norm gin_trgm_ops);

create index if not exists idx_listings_description_norm_trgm
  on public.listings using gin (description_norm gin_trgm_ops);

-- Verificación rápida (debería devolver filas con title_norm sin acentos):
-- select title, title_norm from public.listings limit 5;
