-- fase-26: Directorio de lojas (pantalla /lojas)
-- ------------------------------------------------------------
-- RPC get_stores: en UNA sola consulta (sin N+1) devuelve las tiendas para el
-- directorio público /lojas. Solo tiendas con al menos 1 anuncio activo.
--
-- Seguridad: security definer + search_path fijo. Expone SOLO datos públicos
-- (los mismos de profiles_public: id, full_name, avatar_url) — jamás whatsapp
-- ni role. whatsapp_clicks tiene RLS solo-admin: esta RPC expone únicamente el
-- CONTEO agregado por tienda (nunca filas, visitantes ni fechas).
--
-- Cómo correrlo: pegar todo este archivo en el SQL Editor de Supabase y ejecutar.

-- unaccent: búsqueda/orden insensibles a acentos ("Joao" encuentra "João").
-- En Supabase las extensiones viven en el schema `extensions`.
create extension if not exists unaccent with schema extensions;

create or replace function public.get_stores(
  p_search      text   default null,
  p_locality_id bigint default null,
  p_sort        text   default 'count',   -- 'count' (mais anúncios) | 'popular' (mais procuradas) | 'name' (A–Z)
  p_limit       int    default 20,
  p_offset      int    default 0
)
returns table (
  id           uuid,
  full_name    text,
  avatar_url   text,
  active_count bigint,
  locality_ids bigint[]  -- localities.id es bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with agg as (
    -- Un renglón por tienda: cantidad de anuncios activos + las localidades donde
    -- tiene anuncios activos (para las chips de lugares y el filtro por lugar).
    select
      l.user_id,
      count(*)                                                                   as active_count,
      array_agg(distinct l.locality_id) filter (where l.locality_id is not null) as locality_ids,
      bool_or(l.locality_id = p_locality_id)                                     as has_locality
    from public.listings l
    where l.status = 'active'
    group by l.user_id
  ),
  popular as (
    -- Contactos por WhatsApp de los últimos 30 días sobre los anuncios activos de
    -- cada tienda (métrica "mais procuradas"). Solo el conteo agregado sale de acá.
    select l.user_id, count(*) as pop
    from public.whatsapp_clicks wc
    join public.listings l on l.id = wc.listing_id
    where wc.clicked_at > now() - interval '30 days'
      and l.status = 'active'
    group by l.user_id
  )
  select
    p.id,
    p.full_name,
    p.avatar_url,
    a.active_count,
    coalesce(a.locality_ids, array[]::bigint[]) as locality_ids
  from agg a
  join public.profiles p on p.id = a.user_id and p.is_active = true
  left join popular pop on pop.user_id = a.user_id
  where (p_locality_id is null or a.has_locality)
    and (
      p_search is null
      or length(btrim(p_search)) = 0
      or unaccent(lower(p.full_name)) like '%' || unaccent(lower(btrim(p_search))) || '%'
    )
  order by
    -- 'popular': contactos desc; 'count'/'popular': anúncios desc (desempate);
    -- 'name': A–Z. Cada CASE que no corresponde al orden pedido es constante → no-op.
    (case when p_sort = 'popular' then coalesce(pop.pop, 0) else 0 end) desc,
    (case when p_sort = 'count'   then a.active_count      else 0 end) desc,
    (case when p_sort = 'popular' then a.active_count      else 0 end) desc,
    unaccent(lower(p.full_name)) asc
  limit  greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;

-- Directorio público (igual que el resto de la navegación).
grant execute on function public.get_stores(text, bigint, text, int, int) to anon;
grant execute on function public.get_stores(text, bigint, text, int, int) to authenticated;
