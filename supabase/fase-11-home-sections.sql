-- ─────────────────────────────────────────────────────────────────────────────
-- fase-11-home-sections.sql
-- Tabla de secciones del home + FK en categorías + seed inicial
-- Ejecutar en Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla home_sections
create table if not exists public.home_sections (
  id              bigint generated always as identity primary key,
  title           text not null,
  sort_order      int not null default 0,
  is_featured_block boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. RLS en home_sections
alter table public.home_sections enable row level security;

create policy "Home sections public read"
  on public.home_sections for select using (true);

create policy "Home sections admin write"
  on public.home_sections for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- 3. FK en categories → home_sections
alter table public.categories
  add column if not exists home_section_id bigint
    references public.home_sections(id) on delete set null;

-- 4. Seed: 12 secciones (Destacadas + 11 temáticas)
insert into public.home_sections (title, sort_order, is_featured_block) values
  ('Destacadas',                  0,  true),
  ('Logística',                   1,  false),
  ('Serviços para sua casa',      2,  false),
  ('Educação e família',          3,  false),
  ('Cuidado Pessoal',             4,  false),
  ('Arte, esporte e lazer',       5,  false),
  ('Comércio local',              6,  false),
  ('Renove o que é seu',          7,  false),
  ('Compre seu veículo',          8,  false),
  ('Imóveis',                     9,  false),
  ('Construção e Reformas',       10, false),
  ('Profissionais certificados',  11, false);

-- 5. Asignar categorías a secciones (por slug)

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Destacadas')
  where slug in ('produtos','servicios-do-lar','delivery','alugueis','empregos-e-bicos');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Logística')
  where slug in ('transporte-de-mercaderia','encomendas','mobilidade-e-transportes');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Serviços para sua casa')
  where slug in ('internet','gas','agua-para-beber');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Educação e família')
  where slug in ('educacao','babas','doacoes');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Cuidado Pessoal')
  where slug in ('beleza','saude');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Arte, esporte e lazer')
  where slug in ('esportes','arte-e-cultura','experiencias-turisticas');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Comércio local')
  where slug in ('lojas','mercados','restaurantes-e-bares');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Renove o que é seu')
  where slug in ('consertos');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Compre seu veículo')
  where slug in ('veiculos');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Imóveis')
  where slug in ('casas','terrenos');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Construção e Reformas')
  where slug in ('construcao-e-reformas','bioconstrucao');

update public.categories
  set home_section_id = (select id from public.home_sections where title = 'Profissionais certificados')
  where slug in ('servicos-profissionais');
