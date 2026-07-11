-- ============================================================
-- Fase 20 — Retención de datos de tracking (plan V3, T1)
-- ============================================================
-- Objetivo: que las tablas de log NO crezcan sin tope y llenen
-- la base free de Supabase con el tiempo. Hoy:
--   - track_listing_view guarda el user-agent COMPLETO por vista
--     (no se usa en ningún reporte; los RPCs solo cuentan filas).
--   - CERO retención: el cron solo purga anuncios, nunca el log.
--
-- Este SQL:
--   1) Recorta el device a 120 chars al insertar la vista.
--   2) Agrega prune_tracking(): borra filas viejas de las tablas
--      de log. La engancha el cron diario (route.ts).
--
-- Qué NO toca:
--   - listing_statistics (agregado histórico de vistas) — INTACTA.
--   - whatsapp_clicks — es LA métrica de monetización, NO se poda.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
--   Recomendado: correr manualmente 'select public.prune_tracking();'
--   una vez para verificar el JSON de filas borradas antes de que
--   lo llame el cron.
-- ============================================================


-- ------------------------------------------------------------
-- 1) track_listing_view: recortar el device a 120 chars
-- ------------------------------------------------------------
-- El user-agent completo (puede ser 200-400 chars) no lo consume
-- ningún reporte: get_tracking_summary y get_my_listings_stats
-- solo cuentan filas. 120 chars alcanza de sobra si algún día se
-- quiere segmentar por navegador. Todo lo demás queda idéntico.
create or replace function public.track_listing_view(
  _listing_id bigint,
  _profile_id uuid,
  _visitor_ip text,
  _visitor_device text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.listing_views(listing_id, profile_id, visitor_ip, visitor_device)
  values (_listing_id, _profile_id, _visitor_ip, left(_visitor_device, 120));

  insert into public.listing_statistics(listing_id, views_count)
  values (_listing_id, 1)
  on conflict (listing_id) do update
    set views_count = public.listing_statistics.views_count + 1,
        updated_at = now();
end;
$$;

grant execute on function public.track_listing_view(bigint, uuid, text, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- 2) prune_tracking(): poda de filas viejas
-- ------------------------------------------------------------
-- Devuelve un JSON con cuántas filas borró de cada tabla (para
-- loguearlo en el cron). Ventanas de retención:
--   listing_views   > 90 días  (el único consumidor de filas crudas
--                                es views_last_7d en get_tracking_summary;
--                                el total histórico vive en listing_statistics)
--   search_queries  > 180 días (los RPCs de fase-16 miran <=30 días)
--   banner_clicks   > 180 días
-- whatsapp_clicks NO se poda (métrica de monetización, filas mínimas).
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

  return json_build_object(
    'listing_views_deleted',  v_views,
    'search_queries_deleted', v_search,
    'banner_clicks_deleted',  v_banner
  );
end;
$$;

-- Solo la llama el cron con la service-role key (bypassa RLS). No se
-- otorga a anon/authenticated: nadie desde el cliente puede dispararla.
revoke all on function public.prune_tracking() from public, anon, authenticated;

-- ============================================================
-- FIN
-- ============================================================
