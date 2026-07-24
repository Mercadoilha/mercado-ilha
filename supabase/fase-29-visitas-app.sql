-- ============================================================
-- Fase 29 — Visitas del app (audiencia)
-- ============================================================
-- Objetivo: saber CUÁNTA GENTE USA LA APP, no solo qué hace con
-- los anuncios. Hoy se mide engagement (vistas de anuncios, clicks
-- de WhatsApp, banners, búsquedas) pero no hay ninguna medida de
-- audiencia: visitas por día, personas distintas, si vuelven, qué
-- pantallas se usan, cuántos entran desde la app instalada.
--
-- Recolecta una fila por pantalla abierta (navegación incluida).
-- Nada personal: el visitor_id es un id aleatorio de localStorage
-- (mismo que ya usan los otros trackings) y el session_id vive en
-- sessionStorage. No se guarda IP ni user-agent.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Tabla: app_visits
-- ------------------------------------------------------------
-- path      → ruta normalizada por el cliente ('/', '/listings',
--             '/listings/:id', '/category/pousadas'...). Los ids
--             numéricos se colapsan a :id para que el ranking de
--             pantallas sea legible; el slug de categoría SÍ se
--             guarda (sirve para ver qué categoría se visita más).
-- visitor_id→ persona (localStorage, estable entre sesiones)
-- session_id→ visita (sessionStorage, muere al cerrar la pestaña)
-- is_pwa    → true si entró desde la app instalada (standalone)
-- is_logged → true si tenía sesión iniciada
create table if not exists public.app_visits (
  id          bigint generated always as identity primary key,
  path        text        not null,
  visitor_id  text,
  session_id  text,
  is_pwa      boolean     not null default false,
  is_logged   boolean     not null default false,
  visited_at  timestamptz not null default now()
);

create index if not exists idx_app_visits_visited_at on public.app_visits(visited_at desc);
create index if not exists idx_app_visits_visitor    on public.app_visits(visitor_id, visited_at desc);
create index if not exists idx_app_visits_path       on public.app_visits(path, visited_at desc);

alter table public.app_visits enable row level security;

-- Igual que whatsapp_clicks / banner_clicks: NO hay policy de insert
-- público. Toda escritura entra por la RPC security definer de abajo,
-- así nadie puede leer, editar ni borrar el log desde el cliente.
drop policy if exists "App visits admin read" on public.app_visits;
create policy "App visits admin read"
  on public.app_visits for select using (public.is_admin());

drop policy if exists "App visits admin delete" on public.app_visits;
create policy "App visits admin delete"
  on public.app_visits for delete using (public.is_admin());


-- ------------------------------------------------------------
-- 2) RPC de inserción (security definer)
-- ------------------------------------------------------------
create or replace function public.track_app_visit(
  _path       text,
  _visitor_id text,
  _session_id text,
  _is_pwa     boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _path is null or length(_path) = 0 then
    return;
  end if;

  insert into public.app_visits(path, visitor_id, session_id, is_pwa, is_logged)
  values (
    left(_path, 120),
    left(_visitor_id, 64),
    left(_session_id, 64),
    coalesce(_is_pwa, false),
    auth.uid() is not null
  );
end;
$$;

grant execute on function public.track_app_visit(text, text, text, boolean)
  to anon, authenticated;


-- ------------------------------------------------------------
-- 3) RPC de resumen para el panel admin
-- ------------------------------------------------------------
-- Todo en una sola llamada. Solo admin.
--   visitas    = pantallas abiertas
--   pessoas    = visitor_id distintos
--   sessões    = session_id distintos (una "entrada" al app)
--   recorrentes= personas de los últimos 7 días que YA habían
--                entrado antes de esos 7 días (fidelidad real)
create or replace function public.get_visits_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select json_build_object(
    'visits_today',    (select count(*) from public.app_visits
                          where visited_at >= date_trunc('day', now())),
    'visits_7d',       (select count(*) from public.app_visits
                          where visited_at > now() - interval '7 days'),
    'visits_30d',      (select count(*) from public.app_visits
                          where visited_at > now() - interval '30 days'),

    'visitors_today',  (select count(distinct visitor_id) from public.app_visits
                          where visited_at >= date_trunc('day', now())),
    'visitors_7d',     (select count(distinct visitor_id) from public.app_visits
                          where visited_at > now() - interval '7 days'),
    'visitors_30d',    (select count(distinct visitor_id) from public.app_visits
                          where visited_at > now() - interval '30 days'),

    'sessions_7d',     (select count(distinct session_id) from public.app_visits
                          where visited_at > now() - interval '7 days'),

    'returning_7d',    (select count(distinct v.visitor_id)
                        from public.app_visits v
                        where v.visited_at > now() - interval '7 days'
                          and v.visitor_id is not null
                          and exists (
                            select 1 from public.app_visits p
                            where p.visitor_id = v.visitor_id
                              and p.visited_at <= now() - interval '7 days'
                          )),

    'pwa_visits_7d',   (select count(*) from public.app_visits
                          where visited_at > now() - interval '7 days' and is_pwa),
    'logged_visits_7d',(select count(*) from public.app_visits
                          where visited_at > now() - interval '7 days' and is_logged),

    'first_visit_at',  (select min(visited_at) from public.app_visits)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_visits_summary() to authenticated;


-- ------------------------------------------------------------
-- 4) RPC: serie diaria (para el gráfico de barras)
-- ------------------------------------------------------------
-- Rellena con ceros los días sin visitas, así el gráfico no miente.
create or replace function public.get_visits_daily(_days int default 14)
returns table (
  day       date,
  visits    bigint,
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
    select
      d.day::date,
      coalesce(count(v.id), 0)                    as visits,
      coalesce(count(distinct v.visitor_id), 0)   as visitors
    from generate_series(
           date_trunc('day', now()) - ((greatest(_days, 1) - 1) * interval '1 day'),
           date_trunc('day', now()),
           interval '1 day'
         ) as d(day)
    left join public.app_visits v
      on v.visited_at >= d.day
     and v.visited_at <  d.day + interval '1 day'
    group by d.day
    order by d.day;
end;
$$;

grant execute on function public.get_visits_daily(int) to authenticated;


-- ------------------------------------------------------------
-- 5) RPC: pantallas más visitadas
-- ------------------------------------------------------------
create or replace function public.get_top_pages(_days int default 7, _limit int default 10)
returns table (
  path      text,
  visits    bigint,
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
    select
      v.path,
      count(*)                        as visits,
      count(distinct v.visitor_id)    as visitors
    from public.app_visits v
    where v.visited_at > now() - (greatest(_days, 1) * interval '1 day')
    group by v.path
    -- ordinal, no el alias: 'visits' también es una columna de salida
    -- del RETURNS TABLE y plpgsql la tomaría como variable.
    order by 2 desc
    limit greatest(_limit, 1);
end;
$$;

grant execute on function public.get_top_pages(int, int) to authenticated;


-- ------------------------------------------------------------
-- 6) Retención: sumar app_visits a la poda del cron
-- ------------------------------------------------------------
-- Reemplaza prune_tracking() de fase-20 conservando TODO lo que ya
-- hacía y agregando app_visits (> 180 días). Es la tabla que más
-- rápido crece: una fila por pantalla abierta.
create or replace function public.prune_tracking()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_views   bigint;
  v_search  bigint;
  v_banner  bigint;
  v_visits  bigint;
begin
  with d as (
    delete from public.listing_views
    where visited_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into v_views from d;

  with d as (
    delete from public.search_queries
    where created_at < now() - interval '180 days'
    returning 1
  )
  select count(*) into v_search from d;

  with d as (
    delete from public.banner_clicks
    where clicked_at < now() - interval '180 days'
    returning 1
  )
  select count(*) into v_banner from d;

  with d as (
    delete from public.app_visits
    where visited_at < now() - interval '180 days'
    returning 1
  )
  select count(*) into v_visits from d;

  return json_build_object(
    'listing_views_deleted',  v_views,
    'search_queries_deleted', v_search,
    'banner_clicks_deleted',  v_banner,
    'app_visits_deleted',     v_visits
  );
end;
$$;

revoke all on function public.prune_tracking() from public, anon, authenticated;

-- ============================================================
-- FIN
-- ============================================================
