-- ============================================================
-- Fase 30 — Métricas reales (reset + anti-duplicados)
-- ============================================================
-- Problema detectado el 2026-07-24: los contadores del panel
-- mostraban números altísimos que no correspondían al tráfico real.
-- Causas (verificadas con los datos):
--   1) El contador venía acumulando desde el 2026-06-18 e incluía
--      TODAS las pruebas de desarrollo (pocos aparatos, muchos clicks).
--   2) Ningún tracking deduplicaba: cada toque contaba, incluso el
--      mismo aparato tocando el mismo botón cinco veces seguidas.
--   3) "Clicks WhatsApp (total)" mezclaba contactos a vendedores con
--      los botones "Fale conosco" que escriben al admin.
--
-- Esta migración:
--   A) Pone en CERO los contadores (se conservan las búsquedas, que
--      son material de análisis del buscador, no una métrica del panel).
--   B) Excluye del conteo al admin (sus propias pruebas ya no suman).
--   C) Deduplica: mismo aparato + mismo botón dentro de 30 minutos = 1.
--   D) Separa en el panel los contactos a vendedores de los "Fale conosco".
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
--   OJO: el paso A borra los datos de tracking a propósito.
-- ============================================================


-- ------------------------------------------------------------
-- A) Reset a cero
-- ------------------------------------------------------------
-- No se toca search_queries (fase-16): esos términos sirven para
-- descubrir búsquedas sin resultados y no se muestran como métrica.
truncate table public.whatsapp_clicks;
truncate table public.banner_clicks;
truncate table public.listing_views;
truncate table public.app_visits;

-- listing_statistics guarda el acumulado histórico de vistas por
-- anuncio (es lo que ve el vendedor en "meus anúncios"). Se pone en
-- cero sin borrar filas: favorites_count y demás quedan intactos.
update public.listing_statistics
   set views_count = 0,
       updated_at  = now()
 where views_count <> 0;


-- ------------------------------------------------------------
-- B) listing_views: id anónimo de aparato + cerrar el insert público
-- ------------------------------------------------------------
-- Hasta ahora la tabla no guardaba visitor_id, así que era imposible
-- saber si dos vistas eran de la misma persona. Es el mismo id
-- aleatorio de localStorage que ya usan los otros trackings: no
-- identifica a nadie, solo permite no contar dos veces.
alter table public.listing_views
  add column if not exists visitor_id text;

create index if not exists idx_listing_views_dedup
  on public.listing_views(visitor_id, listing_id, visited_at desc);

-- Resto de fase-2: cualquiera podía insertar vistas directamente,
-- saltándose la RPC (y por lo tanto el anti-duplicado). Toda escritura
-- entra por track_listing_view, igual que el resto del tracking.
drop policy if exists "Listing views public insert" on public.listing_views;


-- ------------------------------------------------------------
-- C) Índices para el anti-duplicado
-- ------------------------------------------------------------
create index if not exists idx_whatsapp_clicks_dedup
  on public.whatsapp_clicks(visitor_id, listing_id, clicked_at desc);

create index if not exists idx_banner_clicks_dedup
  on public.banner_clicks(visitor_id, banner_id, clicked_at desc);


-- ------------------------------------------------------------
-- D) track_whatsapp_click — sin admin, sin duplicados
-- ------------------------------------------------------------
create or replace function public.track_whatsapp_click(
  _listing_id bigint,
  _context    text,
  _visitor_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context text := coalesce(_context, 'listing');
begin
  -- Las pruebas del admin no son tráfico real.
  if public.is_admin() then
    return;
  end if;

  -- Mismo aparato + mismo botón dentro de 30 minutos = un solo contacto.
  -- Pasa mucho en celular: el usuario toca varias veces porque WhatsApp
  -- tarda en abrir. Sin visitor_id no se puede deduplicar → se inserta.
  if _visitor_id is not null and exists (
    select 1 from public.whatsapp_clicks wc
     where wc.visitor_id = _visitor_id
       and wc.context    = v_context
       and coalesce(wc.listing_id, -1) = coalesce(_listing_id, -1)
       and wc.clicked_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.whatsapp_clicks(listing_id, context, profile_id, visitor_id)
  values (_listing_id, v_context, auth.uid(), _visitor_id);
end;
$$;

grant execute on function public.track_whatsapp_click(bigint, text, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- E) track_banner_click — sin admin, sin duplicados
-- ------------------------------------------------------------
create or replace function public.track_banner_click(
  _banner_id  bigint,
  _position   text,
  _visitor_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return;
  end if;

  if _visitor_id is not null and exists (
    select 1 from public.banner_clicks bc
     where bc.visitor_id = _visitor_id
       and bc.banner_id  = _banner_id
       and bc.clicked_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.banner_clicks(banner_id, position, visitor_id)
  values (_banner_id, _position, _visitor_id);
end;
$$;

grant execute on function public.track_banner_click(bigint, text, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- F) track_listing_view — sin admin, sin duplicados
-- ------------------------------------------------------------
-- Se reemplaza la versión de 4 parámetros por una de 5 (el quinto con
-- DEFAULT) en lugar de crear una sobrecarga: así no queda ambigüedad
-- para PostgREST y el frontend viejo sigue funcionando hasta el deploy.
drop function if exists public.track_listing_view(bigint, uuid, text, text);

create or replace function public.track_listing_view(
  _listing_id     bigint,
  _profile_id     uuid,
  _visitor_ip     text,
  _visitor_device text,
  _visitor_id     text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return;
  end if;

  -- Una visita por aparato y anuncio cada 30 minutos: recargar o volver
  -- atrás y entrar de nuevo ya no infla las visualizaciones.
  if _visitor_id is not null and exists (
    select 1 from public.listing_views lv
     where lv.visitor_id = _visitor_id
       and lv.listing_id = _listing_id
       and lv.visited_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.listing_views(listing_id, profile_id, visitor_ip, visitor_device, visitor_id)
  values (_listing_id, _profile_id, _visitor_ip, left(_visitor_device, 120), _visitor_id);

  insert into public.listing_statistics(listing_id, views_count)
  values (_listing_id, 1)
  on conflict (listing_id) do update
    set views_count = public.listing_statistics.views_count + 1,
        updated_at  = now();
end;
$$;

grant execute on function public.track_listing_view(bigint, uuid, text, text, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- G) track_app_visit — sin admin
-- ------------------------------------------------------------
-- Acá NO se deduplica por tiempo: abrir varias pantallas es navegación
-- legítima y es justamente lo que la métrica quiere medir. El cliente
-- ya evita repetir la misma ruta consecutiva (VisitTracker).
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

  if public.is_admin() then
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
-- H) get_tracking_summary — separar vendedores de "Fale conosco"
-- ------------------------------------------------------------
-- vendedores = contacto real entre usuarios (anuncio o loja).
-- admin      = botones que escriben al dueño del sitio:
--              'banner_cta' ("Quer anunciar aqui?") y
--              'suggestion' ("Sugestões ou problemas?").
create or replace function public.get_tracking_summary()
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
    'whatsapp_total',         (select count(*) from public.whatsapp_clicks),
    'whatsapp_listings',      (select count(*) from public.whatsapp_clicks where context = 'listing'),
    'whatsapp_last_7d',       (select count(*) from public.whatsapp_clicks where clicked_at > now() - interval '7 days'),

    'wa_sellers_total',       (select count(*) from public.whatsapp_clicks
                                 where context in ('listing', 'store')),
    'wa_sellers_7d',          (select count(*) from public.whatsapp_clicks
                                 where context in ('listing', 'store')
                                   and clicked_at > now() - interval '7 days'),
    'wa_admin_total',         (select count(*) from public.whatsapp_clicks
                                 where context in ('banner_cta', 'suggestion')),
    'wa_admin_7d',            (select count(*) from public.whatsapp_clicks
                                 where context in ('banner_cta', 'suggestion')
                                   and clicked_at > now() - interval '7 days'),

    'views_total',            (select coalesce(sum(views_count), 0) from public.listing_statistics),
    'views_last_7d',          (select count(*) from public.listing_views
                                 where visited_at > now() - interval '7 days'),
    'banner_total',           (select count(*) from public.banner_clicks),
    'banner_last_7d',         (select count(*) from public.banner_clicks
                                 where clicked_at > now() - interval '7 days'),

    'tracking_reset_at',      timestamptz '2026-07-24 00:00:00-03'
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_tracking_summary() to authenticated;

-- ============================================================
-- FIN
-- ============================================================
