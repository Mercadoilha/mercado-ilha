-- ============================================================
-- Fase Monetización — Tracking (pre-monetización)
-- ============================================================
-- Objetivo: recolectar las métricas de valor de la plataforma
-- ANTES de monetizar. No cambia nada visible para los usuarios.
--
-- Recolecta:
--   1) Vistas de anuncios  (arregla la función ya existente)
--   2) Clicks en botón WhatsApp  (tabla nueva)
--   3) Clicks en banners  (tabla nueva)
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) FIX: track_listing_view nunca funcionaba para visitantes
-- ------------------------------------------------------------
-- La función inserta en listing_statistics, que tiene RLS de
-- solo-admin. Un visitante normal fallaba silenciosamente.
-- security definer la ejecuta con permisos del dueño → funciona
-- para cualquiera, sin abrir la tabla a escritura pública.
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
  values (_listing_id, _profile_id, _visitor_ip, _visitor_device);

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
-- 2) Tabla: whatsapp_clicks
-- ------------------------------------------------------------
-- Cada click en un botón de WhatsApp = un lead real generado.
-- Es la métrica de valor #1 de la plataforma.
--   context: de dónde salió el click
--     'listing'    → botón "Contactar" en un anuncio (tiene listing_id)
--     'store'      → botón de contacto en la tienda del vendedor
--     'banner_cta' → "Fale conosco / Quero anunciar" del banner
--     'suggestion' → "Tenho uma sugestão" en la home
create table if not exists public.whatsapp_clicks (
  id          bigint generated always as identity primary key,
  listing_id  bigint references public.listings(id) on delete cascade,
  context     text   not null default 'listing',
  profile_id  uuid   references public.profiles(id),
  visitor_id  text,
  clicked_at  timestamptz not null default now()
);

create index if not exists idx_whatsapp_clicks_listing on public.whatsapp_clicks(listing_id);
create index if not exists idx_whatsapp_clicks_clicked_at on public.whatsapp_clicks(clicked_at);

alter table public.whatsapp_clicks enable row level security;

drop policy if exists "WA clicks admin read" on public.whatsapp_clicks;
create policy "WA clicks admin read"
  on public.whatsapp_clicks for select using (public.is_admin());

drop policy if exists "WA clicks admin delete" on public.whatsapp_clicks;
create policy "WA clicks admin delete"
  on public.whatsapp_clicks for delete using (public.is_admin());


-- ------------------------------------------------------------
-- 3) Tabla: banner_clicks
-- ------------------------------------------------------------
create table if not exists public.banner_clicks (
  id          bigint generated always as identity primary key,
  banner_id   bigint references public.banners(id) on delete cascade,
  position    text,
  visitor_id  text,
  clicked_at  timestamptz not null default now()
);

create index if not exists idx_banner_clicks_banner on public.banner_clicks(banner_id);
create index if not exists idx_banner_clicks_clicked_at on public.banner_clicks(clicked_at);

alter table public.banner_clicks enable row level security;

drop policy if exists "Banner clicks admin read" on public.banner_clicks;
create policy "Banner clicks admin read"
  on public.banner_clicks for select using (public.is_admin());

drop policy if exists "Banner clicks admin delete" on public.banner_clicks;
create policy "Banner clicks admin delete"
  on public.banner_clicks for delete using (public.is_admin());


-- ------------------------------------------------------------
-- 4) RPCs de inserción (security definer)
-- ------------------------------------------------------------
-- Las tablas NO tienen policy de insert público a propósito:
-- toda escritura entra por estas funciones controladas. Así
-- nadie puede leer ni borrar datos ajenos, solo registrar.
create or replace function public.track_whatsapp_click(
  _listing_id bigint,
  _context text,
  _visitor_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.whatsapp_clicks(listing_id, context, profile_id, visitor_id)
  values (_listing_id, coalesce(_context, 'listing'), auth.uid(), _visitor_id);
end;
$$;

grant execute on function public.track_whatsapp_click(bigint, text, text)
  to anon, authenticated;


create or replace function public.track_banner_click(
  _banner_id bigint,
  _position text,
  _visitor_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.banner_clicks(banner_id, position, visitor_id)
  values (_banner_id, _position, _visitor_id);
end;
$$;

grant execute on function public.track_banner_click(bigint, text, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- 5) RPC de resumen para el panel admin
-- ------------------------------------------------------------
-- Devuelve los totales en una sola llamada. Solo admin.
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
    'whatsapp_total',        (select count(*) from public.whatsapp_clicks),
    'whatsapp_listings',     (select count(*) from public.whatsapp_clicks where context = 'listing'),
    'whatsapp_last_7d',      (select count(*) from public.whatsapp_clicks where clicked_at > now() - interval '7 days'),
    'views_total',           (select coalesce(sum(views_count), 0) from public.listing_statistics),
    'views_last_7d',         (select count(*) from public.listing_views where visited_at > now() - interval '7 days'),
    'banner_total',          (select count(*) from public.banner_clicks),
    'banner_last_7d',        (select count(*) from public.banner_clicks where clicked_at > now() - interval '7 days')
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_tracking_summary() to authenticated;


-- ------------------------------------------------------------
-- 6) RPC: top anuncios por clicks de WhatsApp (admin)
-- ------------------------------------------------------------
create or replace function public.get_top_listings_by_whatsapp(_limit int default 10)
returns table (
  listing_id   bigint,
  title        text,
  wa_clicks    bigint,
  views        bigint
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
      l.id,
      l.title,
      (select count(*) from public.whatsapp_clicks wc where wc.listing_id = l.id) as wa_clicks,
      coalesce(ls.views_count, 0) as views
    from public.listings l
    left join public.listing_statistics ls on ls.listing_id = l.id
    where exists (select 1 from public.whatsapp_clicks wc where wc.listing_id = l.id)
    order by wa_clicks desc
    limit _limit;
end;
$$;

grant execute on function public.get_top_listings_by_whatsapp(int) to authenticated;


-- ------------------------------------------------------------
-- 7) RPC: métricas de MIS anuncios (probadita para el vendedor)
-- ------------------------------------------------------------
-- Cada vendedor ve las métricas básicas (vistas + contatos) de
-- SUS propios anuncios. No expone datos de terceros: filtra por
-- l.user_id = auth.uid(). La versión Pro futura suma tendencias,
-- desglose por día, etc. — esto es solo el "cuánto".
create or replace function public.get_my_listings_stats()
returns table (
  listing_id   bigint,
  views        bigint,
  wa_clicks    bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      l.id,
      coalesce(ls.views_count, 0) as views,
      (select count(*) from public.whatsapp_clicks wc where wc.listing_id = l.id) as wa_clicks
    from public.listings l
    left join public.listing_statistics ls on ls.listing_id = l.id
    where l.user_id = auth.uid();
end;
$$;

grant execute on function public.get_my_listings_stats() to authenticated;

-- ============================================================
-- FIN
-- ============================================================
