-- FASE 4 — Supabase SQL para Mercado Ilha
-- Ejecutar este script en Supabase SQL Editor para añadir búsqueda,
-- optimización y vistas analíticas del marketplace.

-- 1) Índices y búsqueda full-text
alter table public.listings add column if not exists search_vector tsvector;

create index if not exists listings_search_vector_idx on public.listings using gin(search_vector);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_location_idx on public.listings(location_type, island_id, locality_id, subzone_id);
create index if not exists listings_category_idx on public.listings(category_id, subcategory_id);

create or replace function public.listings_search_vector_trigger() returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B');
  return new;
end;
$$;

DROP TRIGGER IF EXISTS set_search_vector_listings ON public.listings;
create trigger set_search_vector_listings
  before insert or update on public.listings
  for each row execute function public.listings_search_vector_trigger();

-- 2) Materialized views para panel y analítica
create materialized view if not exists public.active_listings_summary as
select
  l.id,
  l.title,
  l.category_id,
  l.subcategory_id,
  l.island_id,
  l.locality_id,
  l.subzone_id,
  l.status,
  l.price,
  l.has_delivery,
  l.created_at,
  l.updated_at,
  coalesce(ls.views_count, 0) as views_count,
  coalesce(ls.favorites_count, 0) as favorites_count,
  coalesce(ls.conversations_count, 0) as conversations_count,
  coalesce(ls.messages_count, 0) as messages_count
from public.listings l
left join public.listing_statistics ls on ls.listing_id = l.id
where l.status = 'active';

create index if not exists active_listings_summary_category_idx on public.active_listings_summary(category_id);
create index if not exists active_listings_summary_status_idx on public.active_listings_summary(status);

create or replace function public.refresh_active_listings_summary() returns void language plpgsql as $$
begin
  refresh materialized view public.active_listings_summary;
end;
$$;

-- 3) Tablas auxiliares de etiquetas y favoritos avanzados
create table if not exists public.tags (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_tags (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id, tag_id)
);

alter table public.tags enable row level security;
create policy "Tags public read" on public.tags for select using (true);
create policy "Tags admin write" on public.tags for all using (public.is_admin());

alter table public.listing_tags enable row level security;
create policy "Listing tags public read" on public.listing_tags for select using (true);
create policy "Listing tags manage" on public.listing_tags for all using (public.is_admin());

-- 4) Tablas de insights empresariales
create table if not exists public.marketplace_metrics (
  id bigint generated always as identity primary key,
  date date not null,
  total_listings int not null default 0,
  active_listings int not null default 0,
  total_users int not null default 0,
  total_payments int not null default 0,
  total_revenue numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(date)
);

alter table public.marketplace_metrics enable row level security;
create policy "Marketplace metrics admin read" on public.marketplace_metrics for select using (public.is_admin());
create policy "Marketplace metrics admin write" on public.marketplace_metrics for all using (public.is_admin());

-- 5) Funciones de actualización periódica
create or replace function public.refresh_marketplace_metrics() returns void language plpgsql as $$
begin
  insert into public.marketplace_metrics (date, total_listings, active_listings, total_users, total_payments, total_revenue)
  select
    current_date,
    (select count(*) from public.listings),
    (select count(*) from public.listings where status = 'active'),
    (select count(*) from public.profiles),
    (select count(*) from public.payments where status = 'completed'),
    (select coalesce(sum(amount),0) from public.payments where status = 'completed')
  on conflict (date) do update
  set
    total_listings = excluded.total_listings,
    active_listings = excluded.active_listings,
    total_users = excluded.total_users,
    total_payments = excluded.total_payments,
    total_revenue = excluded.total_revenue,
    created_at = now();
end;
$$;

-- 6) Notas
-- Esta fase agrega búsqueda por texto, tags, métricas de negocio y una vista materializada.
-- Para mantener la vista actualizada, ejecuta `select public.refresh_active_listings_summary();`
-- y `select public.refresh_marketplace_metrics();` desde un job programado en Supabase.
