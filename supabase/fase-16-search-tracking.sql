-- ============================================================
-- Fase 16 — Tracking de búsquedas (medir antes de sinónimos)
-- ============================================================
-- Objetivo: registrar QUÉ busca la gente y cuántos resultados
-- obtuvo, para descubrir con datos reales:
--   1) Búsquedas que dan 0 resultados  → candidatas a sinónimos
--   2) Búsquedas más frecuentes         → qué interesa a la gente
--
-- No cambia nada visible para el usuario. Fire-and-forget desde
-- el frontend; si falla, la búsqueda funciona igual.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Tabla: search_queries
-- ------------------------------------------------------------
-- Una fila por búsqueda de texto ejecutada (parámetro ?q=).
--   term          → lo que escribió la persona (tal cual, recortado)
--   term_norm     → normalizado (minúsculas, sin espacios de sobra)
--                   para poder agrupar "Geladeira" y "geladeira "
--   results_count → cuántos anuncios devolvió (0 = miss)
create table if not exists public.search_queries (
  id            bigint generated always as identity primary key,
  term          text   not null,
  term_norm     text   not null,
  results_count int    not null default 0,
  profile_id    uuid   references public.profiles(id),
  visitor_id    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_search_queries_norm       on public.search_queries(term_norm);
create index if not exists idx_search_queries_created_at  on public.search_queries(created_at);
create index if not exists idx_search_queries_misses      on public.search_queries(results_count) where results_count = 0;

alter table public.search_queries enable row level security;

-- Sin policy de insert público: toda escritura entra por la RPC de abajo.
drop policy if exists "Search queries admin read" on public.search_queries;
create policy "Search queries admin read"
  on public.search_queries for select using (public.is_admin());

drop policy if exists "Search queries admin delete" on public.search_queries;
create policy "Search queries admin delete"
  on public.search_queries for delete using (public.is_admin());


-- ------------------------------------------------------------
-- 2) RPC de inserción (security definer)
-- ------------------------------------------------------------
-- Normaliza el término del lado del servidor. Ignora términos
-- vacíos o de 1 sola letra (ruido).
create or replace function public.track_search(
  _term text,
  _results_count int,
  _visitor_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _norm text;
begin
  _norm := lower(btrim(regexp_replace(coalesce(_term, ''), '\s+', ' ', 'g')));
  if length(_norm) < 2 then
    return;
  end if;

  insert into public.search_queries(term, term_norm, results_count, profile_id, visitor_id)
  values (btrim(_term), _norm, greatest(coalesce(_results_count, 0), 0), auth.uid(), _visitor_id);
end;
$$;

grant execute on function public.track_search(text, int, text) to anon, authenticated;


-- ------------------------------------------------------------
-- 3) RPC: búsquedas SIN resultados (admin)
-- ------------------------------------------------------------
-- Agrupa por término normalizado las búsquedas que dieron 0
-- resultados, más repetidas primero. Es la lista de trabajo para
-- cargar sinónimos.
create or replace function public.get_search_misses(
  _limit int default 50,
  _days int default 30
)
returns table (
  term        text,
  times       bigint,
  visitors    bigint,
  last_at     timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select
      sq.term_norm as term,
      count(*)                          as times,
      count(distinct sq.visitor_id)     as visitors,
      max(sq.created_at)                as last_at
    from public.search_queries sq
    where sq.results_count = 0
      and sq.created_at > now() - (_days || ' days')::interval
    group by sq.term_norm
    order by times desc, last_at desc
    limit _limit;
end;
$$;

grant execute on function public.get_search_misses(int, int) to authenticated;


-- ------------------------------------------------------------
-- 4) RPC: búsquedas MÁS frecuentes (admin)
-- ------------------------------------------------------------
-- Todas las búsquedas agrupadas, con cuántas dieron resultados.
-- Sirve para ver qué se busca más y qué % encuentra algo.
create or replace function public.get_top_searches(
  _limit int default 50,
  _days int default 30
)
returns table (
  term          text,
  times         bigint,
  visitors      bigint,
  avg_results   numeric,
  miss_rate     numeric,
  last_at       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select
      sq.term_norm as term,
      count(*)                                                          as times,
      count(distinct sq.visitor_id)                                    as visitors,
      round(avg(sq.results_count), 1)                                  as avg_results,
      round(100.0 * count(*) filter (where sq.results_count = 0) / count(*), 0) as miss_rate,
      max(sq.created_at)                                               as last_at
    from public.search_queries sq
    where sq.created_at > now() - (_days || ' days')::interval
    group by sq.term_norm
    order by times desc, last_at desc
    limit _limit;
end;
$$;

grant execute on function public.get_top_searches(int, int) to authenticated;

-- ============================================================
-- FIN
-- ============================================================
