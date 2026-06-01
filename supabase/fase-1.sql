-- FASE 1 — Supabase SQL para Mercado Ilha
-- Ejecutar este script en Supabase SQL Editor para crear las tablas,
-- relaciones, políticas RLS y datos iniciales del proyecto.

-- 1) Funciones auxiliares
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Tablas principales
create table if not exists public.islands (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.localities (
  id bigint generated always as identity primary key,
  island_id bigint not null references public.islands(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(island_id, slug)
);

create table if not exists public.subzones (
  id bigint generated always as identity primary key,
  locality_id bigint not null references public.localities(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(locality_id, slug)
);

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  expires_in_days int,
  whatsapp_message text,
  contact_button_text text not null,
  location_type text not null check (location_type in ('fija','zonas_de_atencion','sin_ubicacion')),
  has_delivery boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, slug)
);

create table if not exists public.category_delivery_prices (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id) on delete cascade,
  subzone_id bigint not null references public.subzones(id) on delete cascade,
  price numeric(10,2) not null,
  unique(category_id, subzone_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  whatsapp text not null,
  role text not null default 'user' check (role in ('user','admin')),
  avatar_url text,
  is_active boolean not null default true,
  terms_accepted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean stable language sql as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table if not exists public.listings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id bigint not null references public.categories(id),
  subcategory_id bigint not null references public.subcategories(id),
  island_id bigint not null references public.islands(id),
  locality_id bigint not null references public.localities(id),
  subzone_id bigint,
  other_location_text text,
  title text not null,
  description text not null,
  price numeric(12,2),
  price_text text,
  condition text,
  status text not null default 'active' check (status in ('active','paused','sold','expired','hidden','blocked')),
  contact_button_text text not null,
  whatsapp_message text,
  has_delivery boolean not null default false,
  delivery_available boolean not null default false,
  delivery_data jsonb,
  location_type text not null check (location_type in ('fija','zonas_de_atencion','sin_ubicacion')),
  covers_all_island boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.listing_photos (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  photo_url text not null,
  storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_service_zones (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  subzone_id bigint not null references public.subzones(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id, subzone_id)
);

create table if not exists public.banners (
  id bigint generated always as identity primary key,
  title text,
  image_url text not null,
  link_url text,
  position text not null check (position in ('home','listado')),
  sort_order int not null default 0,
  active boolean not null default true,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  reporter_profile_id uuid references public.profiles(id),
  reporter_name text,
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  id bigint generated always as identity primary key,
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Triggers para mantener updated_at
DROP TRIGGER IF EXISTS set_updated_at_islands ON public.islands;
create trigger set_updated_at_islands
  before update on public.islands
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_localities ON public.localities;
create trigger set_updated_at_localities
  before update on public.localities
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_subzones ON public.subzones;
create trigger set_updated_at_subzones
  before update on public.subzones
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_categories ON public.categories;
create trigger set_updated_at_categories
  before update on public.categories
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_subcategories ON public.subcategories;
create trigger set_updated_at_subcategories
  before update on public.subcategories
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_listings ON public.listings;
create trigger set_updated_at_listings
  before update on public.listings
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_banners ON public.banners;
create trigger set_updated_at_banners
  before update on public.banners
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_reports ON public.reports;
create trigger set_updated_at_reports
  before update on public.reports
  for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_admin_settings ON public.admin_settings;
create trigger set_updated_at_admin_settings
  before update on public.admin_settings
  for each row execute function public.set_updated_at();

-- 4) RLS y políticas
alter table public.profiles enable row level security;
create policy "Profiles public read" on public.profiles for select using (true);
create policy "Profiles owner update" on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy "Profiles owner delete" on public.profiles for delete using (auth.uid() = id or public.is_admin());
create policy "Profiles owner insert" on public.profiles for insert with check (auth.uid() = id);

alter table public.islands enable row level security;
create policy "Islands public read" on public.islands for select using (is_active);
create policy "Islands admin write" on public.islands for all using (public.is_admin());

alter table public.localities enable row level security;
create policy "Localities public read" on public.localities for select using (is_active);
create policy "Localities admin write" on public.localities for all using (public.is_admin());

alter table public.subzones enable row level security;
create policy "Subzones public read" on public.subzones for select using (is_active);
create policy "Subzones admin write" on public.subzones for all using (public.is_admin());

alter table public.categories enable row level security;
create policy "Categories public read" on public.categories for select using (is_active);
create policy "Categories admin write" on public.categories for all using (public.is_admin());

alter table public.subcategories enable row level security;
create policy "Subcategories public read" on public.subcategories for select using (is_active);
create policy "Subcategories admin write" on public.subcategories for all using (public.is_admin());

alter table public.category_delivery_prices enable row level security;
create policy "Delivery prices public read" on public.category_delivery_prices for select using (true);
create policy "Delivery prices admin write" on public.category_delivery_prices for all using (public.is_admin());

alter table public.listings enable row level security;
create policy "Listings public read" on public.listings for select using (status = 'active');
create policy "Listings owner read" on public.listings for select using (user_id = auth.uid());
create policy "Listings admin read" on public.listings for select using (public.is_admin());
create policy "Listings insert" on public.listings for insert with check (auth.uid() = user_id);
create policy "Listings update" on public.listings for update using (user_id = auth.uid() or public.is_admin());
create policy "Listings delete" on public.listings for delete using (user_id = auth.uid() or public.is_admin());

alter table public.listing_photos enable row level security;
create policy "Listing photos public read" on public.listing_photos for select using (true);
create policy "Listing photos owner write" on public.listing_photos for all using (
  exists (select 1 from public.listings l where l.id = public.listing_photos.listing_id and (l.user_id = auth.uid() or public.is_admin()))
);

alter table public.listing_service_zones enable row level security;
create policy "Listing service zones public read" on public.listing_service_zones for select using (true);
create policy "Listing service zones owner write" on public.listing_service_zones for all using (
  exists (select 1 from public.listings l where l.id = public.listing_service_zones.listing_id and (l.user_id = auth.uid() or public.is_admin()))
);

alter table public.banners enable row level security;
create policy "Banners public read" on public.banners for select using (active and (valid_from is null or valid_from <= now()) and (valid_until is null or valid_until >= now()));
create policy "Banners admin write" on public.banners for all using (public.is_admin());

alter table public.reports enable row level security;
create policy "Reports admin read" on public.reports for select using (public.is_admin());
create policy "Reports insert" on public.reports for insert with check (auth.uid() is not null);
create policy "Reports admin update" on public.reports for update using (public.is_admin());
create policy "Reports admin delete" on public.reports for delete using (public.is_admin());

alter table public.admin_settings enable row level security;
create policy "Admin settings public read" on public.admin_settings for select using (true);
create policy "Admin settings admin write" on public.admin_settings for all using (public.is_admin());

-- 5) Datos iniciales
insert into public.islands (name, slug, sort_order) values
  ('Tinharé', 'tinhare', 0)
  on conflict (slug) do nothing;

with island as (
  select id from public.islands where slug = 'tinhare'
)
insert into public.localities (island_id, name, slug, sort_order) values
  ((select id from island), 'Morro de São Paulo', 'morro-de-sao-paulo', 0),
  ((select id from island), 'Gamboa', 'gamboa', 1),
  ((select id from island), 'Zimbo', 'zimbo', 2),
  ((select id from island), 'Galeão', 'galeao', 3)
  on conflict (island_id, slug) do nothing;

with morro as (
  select l.id from public.localities l join public.islands i on l.island_id = i.id where i.slug = 'tinhare' and l.slug = 'morro-de-sao-paulo'
)
insert into public.subzones (locality_id, name, slug, sort_order) values
  ((select id from morro), 'Vila Centro', 'vila-centro', 0),
  ((select id from morro), 'Lagoa', 'lagoa', 1),
  ((select id from morro), 'Primeira Praia', 'primeira-praia', 2),
  ((select id from morro), 'Segunda Praia', 'segunda-praia', 3),
  ((select id from morro), 'Terceira Praia', 'terceira-praia', 4),
  ((select id from morro), 'Quarta Praia', 'quarta-praia', 5),
  ((select id from morro), 'Mangaba', 'mangaba', 6),
  ((select id from morro), 'Buraco', 'buraco', 7),
  ((select id from morro), 'Outros', 'outros', 8)
  on conflict (locality_id, slug) do nothing;

with gamboa as (
  select l.id from public.localities l join public.islands i on l.island_id = i.id where i.slug = 'tinhare' and l.slug = 'gamboa'
)
insert into public.subzones (locality_id, name, slug, sort_order) values
  ((select id from gamboa), 'Nova Gamboa', 'nova-gamboa', 0),
  ((select id from gamboa), 'Vila', 'vila', 1),
  ((select id from gamboa), 'Outros', 'outros', 2)
  on conflict (locality_id, slug) do nothing;

with zimbo as (
  select l.id from public.localities l join public.islands i on l.island_id = i.id where i.slug = 'tinhare' and l.slug = 'zimbo'
)
insert into public.subzones (locality_id, name, slug, sort_order) values
  ((select id from zimbo), 'Outros', 'outros', 0)
  on conflict (locality_id, slug) do nothing;

with galeao as (
  select l.id from public.localities l join public.islands i on l.island_id = i.id where i.slug = 'tinhare' and l.slug = 'galeao'
)
insert into public.subzones (locality_id, name, slug, sort_order) values
  ((select id from galeao), 'Outros', 'outros', 0)
  on conflict (locality_id, slug) do nothing;

insert into public.categories (name, slug, icon, sort_order, expires_in_days, whatsapp_message, contact_button_text, location_type, has_delivery) values
  ('Produtos', 'produtos', 'box', 0, 20, 'Olá! Vi seu anúncio de produtos e quero saber mais.', 'Contatar vendedor', 'fija', false),
  ('Serviços do lar', 'servicos-do-lar', 'home', 1, null, 'Olá! Vi seu anúncio de serviços do lar e gostaria de mais informações.', 'Contatar', 'zonas_de_atencion', false),
  ('Construção', 'construcao', 'tools', 2, null, 'Olá! Vi seu anúncio de construção: [título]. Gostaria de pedir um orçamento.', 'Pedir orçamento', 'zonas_de_atencion', false),
  ('Beleza e bem-estar', 'beleza-e-bem-estar', 'heart', 3, null, 'Olá! Vi seu anúncio de beleza e bem-estar e gostaria de mais informações.', 'Contatar', 'zonas_de_atencion', false),
  ('Translados', 'translados', 'car', 4, null, 'Olá! Vi seu anúncio de translado e gostaria de saber disponibilidade.', 'Contatar', 'zonas_de_atencion', false),
  ('Envios', 'envios', 'package', 5, null, 'Olá! Vi seu anúncio de envios e preciso de um orçamento.', 'Contatar', 'zonas_de_atencion', false),
  ('Gastronomia', 'gastronomia', 'food', 6, null, 'Olá! Vi seu anúncio de gastronomia e quero fazer um pedido.', 'Fazer pedido', 'fija', true),
  ('Terrenos', 'terrenos', 'land', 7, 60, 'Olá! Vi seu anúncio de terrenos e quero más información.', 'Contatar vendedor', 'fija', false),
  ('Casas', 'casas', 'house', 8, 60, 'Olá! Vi seu anúncio de casas e quero saber mais.', 'Contatar vendedor', 'fija', false),
  ('Aluguéis', 'alugueis', 'rent', 9, 60, 'Olá! Vi seu anúncio de aluguéis e quero mais detalles.', 'Contatar', 'fija', false)
  on conflict (slug) do nothing;

insert into public.subcategories (category_id, name, slug, sort_order) values
  ((select id from public.categories where slug = 'produtos'), 'Eletrônicos', 'eletronicos', 0),
  ((select id from public.categories where slug = 'produtos'), 'Móveis', 'moveis', 1),
  ((select id from public.categories where slug = 'produtos'), 'Eletrodomésticos', 'eletrodomesticos', 2),
  ((select id from public.categories where slug = 'produtos'), 'Roupas', 'roupas', 3),
  ((select id from public.categories where slug = 'produtos'), 'Esportes', 'esportes', 4),
  ((select id from public.categories where slug = 'produtos'), 'Alimentos', 'alimentos', 5),
  ((select id from public.categories where slug = 'produtos'), 'Outros', 'outros', 6),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Eletricista', 'eletricista', 0),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Encanador', 'encanador', 1),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Pintura', 'pintura', 2),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Jardinagem', 'jardinagem', 3),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Limpeza', 'limpeza', 4),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Ar-condicionado/Refrigeração', 'ar-condicionado-refrigeracao', 5),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Marcenaria/Reparos', 'marcenaria-reparos', 6),
  ((select id from public.categories where slug = 'servicos-do-lar'), 'Outros', 'outros', 7),
  ((select id from public.categories where slug = 'construcao'), 'Pedreiro', 'pedreiro', 0),
  ((select id from public.categories where slug = 'construcao'), 'Mestre de obras', 'mestre-de-obras', 1),
  ((select id from public.categories where slug = 'construcao'), 'Empreiteiro', 'empreiteiro', 2),
  ((select id from public.categories where slug = 'construcao'), 'Gesso/Drywall', 'gesso-drywall', 3),
  ((select id from public.categories where slug = 'construcao'), 'Telhado', 'telhado', 4),
  ((select id from public.categories where slug = 'construcao'), 'Outros', 'outros', 5),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Cabeleireiro', 'cabeleireiro', 0),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Manicure/Pedicure', 'manicure-pedicure', 1),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Massagem', 'massagem', 2),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Estética', 'estetica', 3),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Depilação', 'depilacao', 4),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Terapias', 'terapias', 5),
  ((select id from public.categories where slug = 'beleza-e-bem-estar'), 'Outros', 'outros', 6),
  ((select id from public.categories where slug = 'translados'), 'Aeroporto/Lancha', 'aeroporto-lancha', 0),
  ((select id from public.categories where slug = 'translados'), 'Passeios', 'passeios', 1),
  ((select id from public.categories where slug = 'translados'), 'Buggy/Quadriciclo', 'buggy-quadriciclo', 2),
  ((select id from public.categories where slug = 'translados'), 'Táxi', 'taxi', 3),
  ((select id from public.categories where slug = 'translados'), 'Outros', 'outros', 4),
  ((select id from public.categories where slug = 'envios'), 'Motoboy', 'motoboy', 0),
  ((select id from public.categories where slug = 'envios'), 'Frete/Carga', 'frete-carga', 1),
  ((select id from public.categories where slug = 'envios'), 'Entregas', 'entregas', 2),
  ((select id from public.categories where slug = 'envios'), 'Outros', 'outros', 3),
  ((select id from public.categories where slug = 'gastronomia'), 'Restaurante', 'restaurante', 0),
  ((select id from public.categories where slug = 'gastronomia'), 'Lanches', 'lanches', 1),
  ((select id from public.categories where slug = 'gastronomia'), 'Doces/Sobremesas', 'doces-sobremesas', 2),
  ((select id from public.categories where slug = 'gastronomia'), 'Bebidas', 'bebidas', 3),
  ((select id from public.categories where slug = 'gastronomia'), 'Caseiro/Marmita', 'caseiro-marmita', 4),
  ((select id from public.categories where slug = 'gastronomia'), 'Outros', 'outros', 5),
  ((select id from public.categories where slug = 'terrenos'), 'À venda', 'a-venda', 0),
  ((select id from public.categories where slug = 'terrenos'), 'Outros', 'outros', 1),
  ((select id from public.categories where slug = 'casas'), 'À venda', 'a-venda', 0),
  ((select id from public.categories where slug = 'casas'), 'Outros', 'outros', 1),
  ((select id from public.categories where slug = 'alugueis'), 'Temporada/Turismo', 'temporada-turismo', 0),
  ((select id from public.categories where slug = 'alugueis'), 'Longa duração', 'longa-duracao', 1),
  ((select id from public.categories where slug = 'alugueis'), 'Comercial', 'comercial', 2),
  ((select id from public.categories where slug = 'alugueis'), 'Outros', 'outros', 3)
  on conflict do nothing;

insert into public.admin_settings (key, value) values
  ('admin_whatsapp', jsonb_build_object('label','Administrador','value','+55 71 99999-9999'))
  on conflict (key) do nothing;

