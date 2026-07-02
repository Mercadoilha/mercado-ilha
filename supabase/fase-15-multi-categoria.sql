-- FASE 15 — Un anuncio en varias categorías/subcategorías (sin republicar)
-- Ejecutar en Supabase SQL Editor.
--
-- Contexto: hasta ahora un anúncio pertenece a UNA sola categoría/subcategoría
-- (listings.category_id / listings.subcategory_id). Esa categoría PRINCIPAL define el
-- comportamiento del aviso (botón, mensaje de WhatsApp, tipo de ubicación, expiración).
--
-- Esta tabla agrega categorías SECUNDARIAS al anuncio SOLO para descubrimiento: hacen que
-- el aviso también aparezca en esos filtros de categoría/subcategoría, sin alterar en nada
-- su comportamiento. La categoría principal sigue mandando. Máximo 4 secundarias por
-- anuncio (se valida en la app; en DB solo limitamos a una entrada por categoría).

-- 1) Tabla intermedia. Mismo patrón que listing_service_zones (fase-1.sql).
create table if not exists public.listing_extra_categories (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  subcategory_id bigint references public.subcategories(id) on delete cascade, -- null si la categoría no tiene subcategorías
  created_at timestamptz not null default now(),
  unique(listing_id, category_id)  -- una sola entrada por categoría (evita duplicados)
);

-- 2) Índices para el filtro de listados y el borrado en cascada por anuncio.
create index if not exists ix_lec_category on public.listing_extra_categories(category_id, subcategory_id);
create index if not exists ix_lec_listing  on public.listing_extra_categories(listing_id);

-- 3) RLS: lectura pública (los tags de categoría no son sensibles), escritura solo del
--    dueño del anuncio o admin. Mirror de "Listing service zones" (fase-1.sql).
alter table public.listing_extra_categories enable row level security;
create policy "Listing extra categories public read" on public.listing_extra_categories for select using (true);
create policy "Listing extra categories owner write" on public.listing_extra_categories for all using (
  exists (select 1 from public.listings l where l.id = public.listing_extra_categories.listing_id and (l.user_id = auth.uid() or public.is_admin()))
);

-- Verificación rápida (opcional):
-- select l.title, c.name as categoria_extra, s.name as subcategoria_extra
-- from public.listing_extra_categories lec
-- join public.listings l on l.id = lec.listing_id
-- join public.categories c on c.id = lec.category_id
-- left join public.subcategories s on s.id = lec.subcategory_id;
