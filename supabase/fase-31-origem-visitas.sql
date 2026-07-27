-- ============================================================
-- Fase 31 — De onde vêm as visitas (marcador ?de=)
-- ============================================================
-- Objetivo: saber quantas pessoas entram no app pelos links que
-- saem dos grupos de WhatsApp. O Estúdio de Conteúdo já monta os
-- links com o marcador `?de=grupo`; até agora o app não guardava
-- essa informação, então não dava para medir nada.
--
-- Como funciona: só a PRIMEIRA tela de cada entrada carrega o
-- marcador (é a que veio do link). As telas seguintes ficam sem
-- marcador, então uma entrada nunca é contada duas vezes.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Columna nueva en app_visits
-- ------------------------------------------------------------
-- source → de dónde vino la visita ('grupo', 'instagram'...).
--          NULL = entrada directa o navegación interna.
alter table public.app_visits
  add column if not exists source text;

-- Índice parcial: la enorme mayoría de las filas tiene source NULL,
-- así el índice queda chico y solo sirve a las consultas de origen.
create index if not exists idx_app_visits_source
  on public.app_visits(source, visited_at desc)
  where source is not null;


-- ------------------------------------------------------------
-- 2) RPC de inserción CON origen (sobrecarga, no reemplazo)
-- ------------------------------------------------------------
-- ⚠️ La versión de 4 parámetros de fase-29 SIGUE VIVA a propósito:
-- producción y los previews comparten la misma base, y el código
-- que ya está desplegado la llama. Esta es una sobrecarga de 5
-- parámetros; _source NO lleva default para que una llamada de 4
-- argumentos resuelva sin ambigüedad a la función vieja.
create or replace function public.track_app_visit(
  _path       text,
  _visitor_id text,
  _session_id text,
  _is_pwa     boolean,
  _source     text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
begin
  if _path is null or length(_path) = 0 then
    return;
  end if;

  -- Higiene del marcador: minúsculas, corto y sin caracteres raros.
  -- Lo que no cumple se guarda como NULL (mejor sin dato que sucio).
  v_source := lower(nullif(trim(_source), ''));
  if v_source is not null and v_source !~ '^[a-z0-9_-]{1,24}$' then
    v_source := null;
  end if;

  insert into public.app_visits(path, visitor_id, session_id, is_pwa, is_logged, source)
  values (
    left(_path, 120),
    left(_visitor_id, 64),
    left(_session_id, 64),
    coalesce(_is_pwa, false),
    auth.uid() is not null,
    v_source
  );
end;
$$;

grant execute on function public.track_app_visit(text, text, text, boolean, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- 3) RPC: entradas por origen (para el panel admin)
-- ------------------------------------------------------------
-- Cuenta ENTRADAS (sessões), no pantallas: una persona que entra
-- por un link del grupo y navega 6 pantallas es UNA entrada.
-- El origen de la entrada es el marcador de su primera tela.
create or replace function public.get_visit_sources(_days int default 30)
returns table (
  source    text,
  sessions  bigint,
  visitors  bigint
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
    with sess as (
      select
        v.session_id,
        max(v.source)     as source,      -- solo la 1ª tela trae marcador
        max(v.visitor_id) as visitor_id
      from public.app_visits v
      where v.visited_at > now() - (greatest(_days, 1) * interval '1 day')
        and v.session_id is not null
      group by v.session_id
    )
    select
      s.source,
      count(*)                      as sessions,
      count(distinct s.visitor_id)  as visitors
    from sess s
    group by s.source
    -- ordinal, no el alias: 'sessions' también es columna de salida
    -- del RETURNS TABLE y plpgsql la tomaría como variable.
    order by 2 desc;
end;
$$;

grant execute on function public.get_visit_sources(int) to authenticated;

-- ============================================================
-- FIN
-- ============================================================
