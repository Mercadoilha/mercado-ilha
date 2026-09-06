-- ============================================================
-- Fase 32 — Mercado Agroecológico (módulo e-commerce)
-- ============================================================
-- Base de datos del módulo "Mercado Agroecológico": catálogo de
-- productos de la Feira Agroecológica da Gamboa, carrito con
-- cantidades y envío del pedido/orçamento por WhatsApp.
--
-- Datos cargados desde las 3 listas de precios (28/08).
--
-- IDEA CENTRAL — cómo se vende cada cosa:
--   Un PRODUTO (ej. "Mel de abelha") tiene una o varias VARIANTES,
--   y la variante es la que tiene precio y forma de venta:
--     · por peso  → aipim, abóbora (R$/kg, permite 0,5 kg)
--     · por unidade → manga, milho, mamão (1, 2, 3…)
--     · por pacote fechado → dúzia (12), placa (30 ovos), maço,
--       3 unid., 500g, 200ml, 5ml… (se compra entero)
--   Así el carrito siempre sabe si puede pedir 0,5 o solo enteros,
--   qué escribir al lado del precio y cuánto suma cada renglón.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada
--   (los precios se actualizan, no se duplican).
-- ============================================================


-- ------------------------------------------------------------
-- 1) FEIRAS / PRODUTORES
-- ------------------------------------------------------------
create table if not exists public.market_vendors (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  name           text not null,
  tagline        text,                 -- "Alimentos naturais, frutas e produtos do Kilombo"
  description    text,
  logo_url       text,
  whatsapp       text,                 -- destino del pedido (formato 55DDDNUMERO)
  pickup_place   text,                 -- "Praia da Argila — Casa Gêmeos Viva"
  delivery_day   text,                 -- "Todas as sextas-feiras"
  deadline_text  text,                 -- "Pedidos até quarta-feira, às 17h"
  footer_note    text,                 -- aviso de sazonalidade / origem
  owner_id       uuid references public.profiles(id) on delete set null,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 2) SEÇÕES DO CATÁLOGO
-- ------------------------------------------------------------
create table if not exists public.market_categories (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  emoji       text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3) PRODUTOS
-- ------------------------------------------------------------
create table if not exists public.market_products (
  id            bigint generated always as identity primary key,
  vendor_id     bigint not null references public.market_vendors(id) on delete cascade,
  category_id   bigint not null references public.market_categories(id) on delete restrict,
  slug          text not null unique,
  name          text not null,
  description   text,
  photo_url     text,
  is_active     boolean not null default true,
  is_seasonal   boolean not null default false,  -- sazonal: consultar disponibilidade
  is_alcoholic  boolean not null default false,  -- bebidas: aviso +18
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_market_products_vendor  on public.market_products(vendor_id) where is_active;
create index if not exists idx_market_products_cat     on public.market_products(category_id, sort_order) where is_active;


-- ------------------------------------------------------------
-- 4) VARIANTES = forma de venda + preço  ⭐ el corazón del módulo
-- ------------------------------------------------------------
create table if not exists public.market_product_variants (
  id             bigint generated always as identity primary key,
  product_id     bigint not null references public.market_products(id) on delete cascade,

  -- Cómo se muestra la opción dentro del producto ("500g", "dúzia",
  -- "Maracujá", "Eucalipto"). Si el producto tiene una sola forma de
  -- venta, se repite el unit_label.
  label          text not null,

  -- 'peso'    → precio por kg, admite decimales (0,5 kg)
  -- 'unidade' → se cuenta de a uno (manga, coco, milho)
  -- 'pacote'  → paquete cerrado (dúzia, placa, maço, 500g, 200ml, 3 unid.)
  sale_mode      text not null default 'pacote'
                 check (sale_mode in ('peso','unidade','pacote')),

  unit_label     text not null,          -- lo que se lee junto al precio: "kg", "dúzia", "maço", "unid.", "500g"
  units_per_pack numeric(10,3),          -- 12 na dúzia, 30 na placa, 3 no "3 unid." (informativo)
  net_weight_g   numeric(10,2),          -- peso/volumen del pacote, cuando aplica (500 = 500g/500ml)

  price          numeric(10,2) not null check (price >= 0),

  -- Reglas del selector de cantidad del carrito
  step           numeric(10,3) not null default 1   check (step > 0),      -- 0.5 para kg, 1 para el resto
  min_qty        numeric(10,3) not null default 1   check (min_qty > 0),
  max_qty        numeric(10,3),                                            -- null = sin tope

  note           text,                   -- "pouca quantidade", "sob encomenda"
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (product_id, label)
);

create index if not exists idx_market_variants_product on public.market_product_variants(product_id, sort_order) where is_active;

-- Coherencia: si se vende por peso el paso es fraccionario; si se
-- vende por unidade/pacote las cantidades son enteras.
alter table public.market_product_variants
  drop constraint if exists market_variants_step_coerente;
alter table public.market_product_variants
  add constraint market_variants_step_coerente check (
    sale_mode = 'peso'
    or (step = trunc(step) and min_qty = trunc(min_qty))
  );


-- ------------------------------------------------------------
-- 5) PEDIDOS (carrinho enviado por WhatsApp)
-- ------------------------------------------------------------
create table if not exists public.market_orders (
  id                bigint generated always as identity primary key,
  vendor_id         bigint not null references public.market_vendors(id) on delete restrict,
  user_id           uuid references public.profiles(id) on delete set null,
  customer_name     text not null,
  customer_whatsapp text,
  customer_note     text,               -- observações / endereço de retirada
  total             numeric(10,2) not null default 0,
  status            text not null default 'novo'
                    check (status in ('novo','confirmado','entregue','cancelado')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_market_orders_vendor on public.market_orders(vendor_id, created_at desc);
create index if not exists idx_market_orders_user   on public.market_orders(user_id, created_at desc);

-- Los items guardan FOTO FIJA del nombre y del precio del momento:
-- si mañana cambia la lista, el pedido viejo sigue siendo fiel.
create table if not exists public.market_order_items (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.market_orders(id) on delete cascade,
  variant_id    bigint references public.market_product_variants(id) on delete set null,
  product_name  text not null,
  variant_label text not null,
  unit_label    text not null,
  unit_price    numeric(10,2) not null,
  quantity      numeric(10,3) not null check (quantity > 0),
  line_total    numeric(10,2) not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_market_order_items_order on public.market_order_items(order_id);


-- ------------------------------------------------------------
-- 6) updated_at automático
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'market_vendors','market_categories','market_products',
    'market_product_variants','market_orders'
  ] loop
    execute format('drop trigger if exists set_updated_at_%1$s on public.%1$s', t);
    execute format(
      'create trigger set_updated_at_%1$s before update on public.%1$s
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 7) RLS — leitura pública, escrita só admin
-- ------------------------------------------------------------
alter table public.market_vendors           enable row level security;
alter table public.market_categories        enable row level security;
alter table public.market_products          enable row level security;
alter table public.market_product_variants  enable row level security;
alter table public.market_orders            enable row level security;
alter table public.market_order_items       enable row level security;

drop policy if exists "Market vendors public read"  on public.market_vendors;
drop policy if exists "Market vendors admin write"  on public.market_vendors;
create policy "Market vendors public read" on public.market_vendors for select using (is_active or public.is_admin());
create policy "Market vendors admin write" on public.market_vendors for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Market categories public read" on public.market_categories;
drop policy if exists "Market categories admin write" on public.market_categories;
create policy "Market categories public read" on public.market_categories for select using (is_active or public.is_admin());
create policy "Market categories admin write" on public.market_categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Market products public read" on public.market_products;
drop policy if exists "Market products admin write" on public.market_products;
create policy "Market products public read" on public.market_products for select using (is_active or public.is_admin());
create policy "Market products admin write" on public.market_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Market variants public read" on public.market_product_variants;
drop policy if exists "Market variants admin write" on public.market_product_variants;
create policy "Market variants public read" on public.market_product_variants for select using (is_active or public.is_admin());
create policy "Market variants admin write" on public.market_product_variants for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: cada quien ve los suyos; el dueño de la feira ve los de su
-- feira; el admin ve todo. La INSERCIÓN va solo por la RPC (los precios
-- se calculan en el servidor, nunca se confía en el navegador).
drop policy if exists "Market orders own read"    on public.market_orders;
drop policy if exists "Market orders admin write" on public.market_orders;
create policy "Market orders own read" on public.market_orders for select using (
  user_id = (select auth.uid())
  or public.is_admin()
  or exists (select 1 from public.market_vendors v
             where v.id = market_orders.vendor_id and v.owner_id = (select auth.uid()))
);
create policy "Market orders admin write" on public.market_orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Market order items own read"    on public.market_order_items;
drop policy if exists "Market order items admin write" on public.market_order_items;
create policy "Market order items own read" on public.market_order_items for select using (
  exists (
    select 1 from public.market_orders o
    where o.id = market_order_items.order_id
      and (o.user_id = (select auth.uid())
           or public.is_admin()
           or exists (select 1 from public.market_vendors v
                      where v.id = o.vendor_id and v.owner_id = (select auth.uid())))
  )
);
create policy "Market order items admin write" on public.market_order_items for all using (public.is_admin()) with check (public.is_admin());


-- ------------------------------------------------------------
-- 8) RPC — catálogo completo en UNA sola consulta (sin N+1)
-- ------------------------------------------------------------
-- Devuelve seções → produtos → variantes ya anidados y ordenados.
-- La pantalla del módulo hace una sola llamada y pinta todo.
create or replace function public.get_market_catalog(p_vendor_slug text default 'feira-agroecologica-gamboa')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select * from public.market_vendors
    where slug = p_vendor_slug and is_active
    limit 1
  ),
  prods as (
    select
      p.category_id,
      p.sort_order as p_sort,
      p.name       as p_name,
      jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name', p.name,
        'description', p.description,
        'photo_url', p.photo_url,
        'is_seasonal', p.is_seasonal,
        'is_alcoholic', p.is_alcoholic,
        'sort_order', p.sort_order,
        'variants', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', pv.id,
              'label', pv.label,
              'sale_mode', pv.sale_mode,
              'unit_label', pv.unit_label,
              'units_per_pack', pv.units_per_pack,
              'net_weight_g', pv.net_weight_g,
              'price', pv.price,
              'step', pv.step,
              'min_qty', pv.min_qty,
              'max_qty', pv.max_qty,
              'note', pv.note
            ) order by pv.sort_order, pv.id
          )
          from public.market_product_variants pv
          where pv.product_id = p.id and pv.is_active
        ), '[]'::jsonb)
      ) as prod
    from public.market_products p
    join v on v.id = p.vendor_id
    where p.is_active
  )
  select jsonb_build_object(
    'vendor', to_jsonb(v) - 'owner_id',
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'slug', c.slug,
          'name', c.name,
          'emoji', c.emoji,
          'products', (
            select jsonb_agg(pr.prod order by pr.p_sort, pr.p_name)
            from prods pr where pr.category_id = c.id
          )
        ) order by c.sort_order, c.id
      )
      from public.market_categories c
      where c.is_active
        and exists (select 1 from prods pr where pr.category_id = c.id)
    ), '[]'::jsonb)
  )
  from v;
$$;

revoke all on function public.get_market_catalog(text) from public;
grant execute on function public.get_market_catalog(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 9) RPC — registrar o pedido (preços calculados no servidor)
-- ------------------------------------------------------------
-- p_items: [{"variant_id": 12, "quantity": 2}, ...]
-- Devuelve el pedido con sus renglones ya valorizados, listo para
-- armar el texto del WhatsApp. Nunca toma el precio del navegador.
create or replace function public.create_market_order(
  p_vendor_id         bigint,
  p_items             jsonb,
  p_customer_name     text,
  p_customer_whatsapp text default null,
  p_customer_note     text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_total    numeric(10,2);
  v_count    int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Informe o nome de quem faz o pedido';
  end if;
  if not exists (select 1 from public.market_vendors where id = p_vendor_id and is_active) then
    raise exception 'Feira não encontrada';
  end if;

  insert into public.market_orders (vendor_id, user_id, customer_name, customer_whatsapp, customer_note)
  values (p_vendor_id, auth.uid(), trim(p_customer_name), p_customer_whatsapp, p_customer_note)
  returning id into v_order_id;

  with pedido as (
    select
      (i->>'variant_id')::bigint as variant_id,
      (i->>'quantity')::numeric  as quantity
    from jsonb_array_elements(p_items) i
  )
  insert into public.market_order_items
    (order_id, variant_id, product_name, variant_label, unit_label, unit_price, quantity, line_total)
  select
    v_order_id,
    pv.id,
    pr.name,
    pv.label,
    pv.unit_label,
    pv.price,
    ped.quantity,
    round(pv.price * ped.quantity, 2)
  from pedido ped
  join public.market_product_variants pv on pv.id = ped.variant_id and pv.is_active
  join public.market_products pr on pr.id = pv.product_id and pr.is_active and pr.vendor_id = p_vendor_id
  where ped.quantity >= pv.min_qty
    and (pv.max_qty is null or ped.quantity <= pv.max_qty)
    -- la cantidad tiene que ser múltiplo del paso (1, 1.5, 2… o 0.5, 1, 1.5)
    and mod(ped.quantity::numeric, pv.step) = 0;

  select count(*), coalesce(sum(line_total), 0)
    into v_count, v_total
  from public.market_order_items where order_id = v_order_id;

  if v_count = 0 then
    raise exception 'Nenhum item válido no pedido';
  end if;

  update public.market_orders set total = v_total where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'product_name', product_name,
        'variant_label', variant_label,
        'unit_label', unit_label,
        'unit_price', unit_price,
        'quantity', quantity,
        'line_total', line_total
      ) order by id)
      from public.market_order_items where order_id = v_order_id
    )
  );
end;
$$;

revoke all on function public.create_market_order(bigint, jsonb, text, text, text) from public;
grant execute on function public.create_market_order(bigint, jsonb, text, text, text) to authenticated;


-- ============================================================
-- 10) CARGA DOS DADOS — Feira Agroecológica da Gamboa (28/08)
-- ============================================================

insert into public.market_vendors
  (slug, name, tagline, description, whatsapp, pickup_place, delivery_day, deadline_text, footer_note, sort_order)
values (
  'feira-agroecologica-gamboa',
  'Feira Agroecológica da Gamboa',
  'Alimentos naturais, frutas, hortaliças e produtos do Kilombo Tenondé',
  'Feira de alimentos agroecológicos da Gamboa. Faça seu pedido pelo app e retire na feira.',
  '+56945619025',  -- ⚠️ número de PRUEBAS por ahora (cambiar por el da feira antes de abrir ao público).
                   -- Número de outro país: SEMPRE com '+' e o código, senão o app assume Brasil e adiciona 55.
  'Praia da Argila — Casa Gêmeos Viva',
  'Todas as sextas-feiras',
  'Pedidos até quarta-feira, às 17h',   -- a feira é na sexta; o pedido fecha na quarta
  'Todos os produtos vêm de sistemas agroflorestais e hortoflorestais da agricultura familiar da região de Valença. Alguns itens são sazonais e possuem pouca quantidade — consulte a disponibilidade antes de finalizar.',
  1
)
on conflict (slug) do update set
  name          = excluded.name,
  tagline       = excluded.tagline,
  whatsapp      = excluded.whatsapp,
  description   = excluded.description,
  pickup_place  = excluded.pickup_place,
  delivery_day  = excluded.delivery_day,
  deadline_text = excluded.deadline_text,
  footer_note   = excluded.footer_note;

insert into public.market_categories (slug, name, emoji, sort_order) values
  ('frutas-in-natura',          'Frutas in natura',              '🍌', 1),
  ('hortalicas',                'Hortaliças e temperos verdes',  '🥬', 2),
  ('proteinas-carboidratos',    'Proteínas & carboidratos',      '🥚', 3),
  ('temperos-especiarias',      'Temperos e especiarias',        '🌶️', 4),
  ('polpas',                    'Polpas de fruta natural',       '🧃', 5),
  ('mel-derivados',             'Mel & derivados',               '🍯', 6),
  ('desidratados-doces',        'Desidratados, doces e pastas',  '🍫', 7),
  ('oleos-essenciais',          'Óleos essenciais',              '🌿', 8),
  ('tinturas',                  'Tinturas',                      '💧', 9),
  ('bebidas-artesanais',        'Bebidas artesanais',            '🍹', 10)
on conflict (slug) do update set
  name = excluded.name, emoji = excluded.emoji, sort_order = excluded.sort_order;


-- Helpers de carga (se eliminan al final del script)
create or replace function public.__market_seed_product(
  p_cat text, p_slug text, p_name text, p_desc text, p_sort int,
  p_seasonal boolean default false, p_alcoholic boolean default false
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into public.market_products (vendor_id, category_id, slug, name, description, sort_order, is_seasonal, is_alcoholic)
  select v.id, c.id, p_slug, p_name, p_desc, p_sort, p_seasonal, p_alcoholic
  from public.market_vendors v, public.market_categories c
  where v.slug = 'feira-agroecologica-gamboa' and c.slug = p_cat
  on conflict (slug) do update set
    category_id  = excluded.category_id,
    name         = excluded.name,
    description  = excluded.description,
    sort_order   = excluded.sort_order,
    is_seasonal  = excluded.is_seasonal,
    is_alcoholic = excluded.is_alcoholic,
    is_active    = true
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.__market_seed_variant(
  p_product_slug text, p_label text, p_sale_mode text, p_unit_label text,
  p_price numeric, p_sort int,
  p_units_per_pack numeric default null, p_net_g numeric default null,
  p_step numeric default 1, p_min numeric default 1, p_note text default null
) returns void language sql as $$
  insert into public.market_product_variants
    (product_id, label, sale_mode, unit_label, units_per_pack, net_weight_g, price, step, min_qty, note, sort_order)
  select p.id, p_label, p_sale_mode, p_unit_label, p_units_per_pack, p_net_g, p_price, p_step, p_min, p_note, p_sort
  from public.market_products p where p.slug = p_product_slug
  on conflict (product_id, label) do update set
    sale_mode      = excluded.sale_mode,
    unit_label     = excluded.unit_label,
    units_per_pack = excluded.units_per_pack,
    net_weight_g   = excluded.net_weight_g,
    price          = excluded.price,
    step           = excluded.step,
    min_qty        = excluded.min_qty,
    note           = excluded.note,
    sort_order     = excluded.sort_order,
    is_active      = true;
$$;


do $$
declare
  polpa_desc text := 'Sem adição de água e sem conservantes; frutas cultivadas de forma agroecológica.';
begin

-- ---------- FRUTAS IN NATURA ----------
perform public.__market_seed_product('frutas-in-natura','cana-descascada','Cana descascada',null,1);
perform public.__market_seed_variant('cana-descascada','500g','pacote','500g',8.00,1, p_net_g=>500);

perform public.__market_seed_product('frutas-in-natura','cupuacu-fruto','Cupuaçu (fruto)',null,2,true);
perform public.__market_seed_variant('cupuacu-fruto','Unidade','unidade','unid.',10.00,1);

perform public.__market_seed_product('frutas-in-natura','mamao-fruto','Mamão (fruto)',null,3);
perform public.__market_seed_variant('mamao-fruto','Unidade','unidade','unid.',7.00,1);

perform public.__market_seed_product('frutas-in-natura','manga','Manga',null,4,true);
perform public.__market_seed_variant('manga','Unidade','unidade','unid.',3.00,1);

perform public.__market_seed_product('frutas-in-natura','banana-prata','Banana prata',null,5);
perform public.__market_seed_variant('banana-prata','Dúzia','pacote','dúzia',6.00,1, p_units_per_pack=>12);

perform public.__market_seed_product('frutas-in-natura','banana-terra','Banana da terra',null,6);
perform public.__market_seed_variant('banana-terra','Dúzia','pacote','dúzia',9.00,1, p_units_per_pack=>12);

perform public.__market_seed_product('frutas-in-natura','coco-seco','Coco seco',null,7);
perform public.__market_seed_variant('coco-seco','Unidade','unidade','unid.',4.00,1);

perform public.__market_seed_product('frutas-in-natura','coco-ralado','Coco ralado',null,8);
perform public.__market_seed_variant('coco-ralado','500g','pacote','500g',15.00,1, p_net_g=>500);

perform public.__market_seed_product('frutas-in-natura','coco-seco-cubos','Coco seco cortado em cubos',null,9);
perform public.__market_seed_variant('coco-seco-cubos','400g','pacote','400g',12.00,1, p_net_g=>400);

perform public.__market_seed_product('frutas-in-natura','limao-rosa','Limão rosa',null,10);
perform public.__market_seed_variant('limao-rosa','3 unidades','pacote','3 unid.',1.00,1, p_units_per_pack=>3);

perform public.__market_seed_product('frutas-in-natura','limao-tahiti','Limão tahiti',null,11);
perform public.__market_seed_variant('limao-tahiti','3 unidades','pacote','3 unid.',1.00,1, p_units_per_pack=>3);

-- ---------- HORTALIÇAS (maço) ----------
perform public.__market_seed_product('hortalicas','alface-crespa','Alface crespa',null,1);
perform public.__market_seed_variant('alface-crespa','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','couve','Couve',null,2);
perform public.__market_seed_variant('couve','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','rucula','Rúcula',null,3);
perform public.__market_seed_variant('rucula','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','coentro','Coentro',null,4);
perform public.__market_seed_variant('coentro','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','cebolinha','Cebolinha',null,5);
perform public.__market_seed_variant('cebolinha','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','manjericao','Manjericão',null,6);
perform public.__market_seed_variant('manjericao','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','hortela','Hortelã',null,7);
perform public.__market_seed_variant('hortela','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','salsao','Salsão',null,8);
perform public.__market_seed_variant('salsao','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','artemisia','Artemísia (Artemisia vulgaris)',null,9);
perform public.__market_seed_variant('artemisia','Maço','pacote','maço',5.00,1);

perform public.__market_seed_product('hortalicas','citronela-maco','Citronela',null,10);
perform public.__market_seed_variant('citronela-maco','Maço','pacote','maço',3.00,1);

perform public.__market_seed_product('hortalicas','guaco','Guaco',null,11);
perform public.__market_seed_variant('guaco','50g','pacote','50g',5.00,1, p_net_g=>50);

-- ---------- PROTEÍNAS & CARBOIDRATOS ----------
perform public.__market_seed_product('proteinas-carboidratos','ovos','Ovos',null,1);
perform public.__market_seed_variant('ovos','Placa (30 unid.)','pacote','placa',40.00,1, p_units_per_pack=>30);
perform public.__market_seed_variant('ovos','Dúzia (12 unid.)','pacote','dúzia',17.00,2, p_units_per_pack=>12);

perform public.__market_seed_product('proteinas-carboidratos','aipim-descascado','Aipim descascado',null,2);
perform public.__market_seed_variant('aipim-descascado','Por quilo','peso','kg',9.00,1, p_step=>0.5, p_min=>0.5);

perform public.__market_seed_product('proteinas-carboidratos','abobora-pescoco','Abóbora de pescoço',null,3);
perform public.__market_seed_variant('abobora-pescoco','Por quilo','peso','kg',7.00,1, p_step=>0.5, p_min=>0.5);

perform public.__market_seed_product('proteinas-carboidratos','amendoim-torrado','Amendoim torrado',null,4);
perform public.__market_seed_variant('amendoim-torrado','300g','pacote','300g',7.00,1, p_net_g=>300);
perform public.__market_seed_variant('amendoim-torrado','500g','pacote','500g',10.00,2, p_net_g=>500);

perform public.__market_seed_product('proteinas-carboidratos','milho-verde','Milho verde',null,5,true);
perform public.__market_seed_variant('milho-verde','Unidade','unidade','unid.',3.00,1);

-- ---------- TEMPEROS E ESPECIARIAS ----------
perform public.__market_seed_product('temperos-especiarias','farinha-mandioca','Farinha de mandioca',null,1);
perform public.__market_seed_variant('farinha-mandioca','Pacote 500g','pacote','500g',8.00,1, p_net_g=>500);

perform public.__market_seed_product('temperos-especiarias','corante-urucum','Corante de urucum',null,2);
perform public.__market_seed_variant('corante-urucum','50g','pacote','50g',7.00,1, p_net_g=>50);

perform public.__market_seed_product('temperos-especiarias','curcuma-po','Cúrcuma em pó',null,3);
perform public.__market_seed_variant('curcuma-po','Pacote','pacote','pct',7.50,1);

perform public.__market_seed_product('temperos-especiarias','alho','Alho',null,4);
perform public.__market_seed_variant('alho','Pacote','pacote','pct',4.00,1);

-- ---------- POLPAS DE FRUTA ----------
perform public.__market_seed_product('polpas','polpa-caja','Polpa de cajá',polpa_desc,1);
perform public.__market_seed_variant('polpa-caja','120g','pacote','120g',5.00,1, p_net_g=>120);
perform public.__market_seed_variant('polpa-caja','500g','pacote','500g',15.00,2, p_net_g=>500);

perform public.__market_seed_product('polpas','polpa-cacau','Polpa de cacau',polpa_desc,2);
perform public.__market_seed_variant('polpa-cacau','120g','pacote','120g',5.00,1, p_net_g=>120);
perform public.__market_seed_variant('polpa-cacau','500g','pacote','500g',10.00,2, p_net_g=>500);

perform public.__market_seed_product('polpas','polpa-acerola','Polpa de acerola',polpa_desc,3);
perform public.__market_seed_variant('polpa-acerola','120g','pacote','120g',5.00,1, p_net_g=>120);

perform public.__market_seed_product('polpas','polpa-graviola','Polpa de graviola',polpa_desc,4);
perform public.__market_seed_variant('polpa-graviola','120g','pacote','120g',5.00,1, p_net_g=>120);
perform public.__market_seed_variant('polpa-graviola','500g','pacote','500g',12.00,2, p_net_g=>500);

perform public.__market_seed_product('polpas','polpa-cupuacu','Polpa de cupuaçu',polpa_desc,5);
perform public.__market_seed_variant('polpa-cupuacu','120g','pacote','120g',5.00,1, p_net_g=>120);

perform public.__market_seed_product('polpas','polpa-maracuja','Polpa de maracujá',polpa_desc,6);
perform public.__market_seed_variant('polpa-maracuja','120g','pacote','120g',5.00,1, p_net_g=>120);
perform public.__market_seed_variant('polpa-maracuja','500g','pacote','500g',18.00,2, p_net_g=>500);

perform public.__market_seed_product('polpas','polpa-jenipapo','Polpa de jenipapo',polpa_desc,7);
perform public.__market_seed_variant('polpa-jenipapo','120g','pacote','120g',5.00,1, p_net_g=>120);
perform public.__market_seed_variant('polpa-jenipapo','500g','pacote','500g',10.00,2, p_net_g=>500);

-- ---------- MEL & DERIVADOS ----------
perform public.__market_seed_product('mel-derivados','mel-abelha','Mel de abelha',null,1);
perform public.__market_seed_variant('mel-abelha','100ml','pacote','100ml',17.00,1, p_net_g=>100);
perform public.__market_seed_variant('mel-abelha','200ml','pacote','200ml',30.00,2, p_net_g=>200);
perform public.__market_seed_variant('mel-abelha','500ml','pacote','500ml',60.00,3, p_net_g=>500);
perform public.__market_seed_variant('mel-abelha','1 litro','pacote','1 litro',120.00,4, p_net_g=>1000);

perform public.__market_seed_product('mel-derivados','polen','Pólen',null,2);
perform public.__market_seed_variant('polen','Frasco 50g','pacote','frasco 50g',17.00,1, p_net_g=>50);

perform public.__market_seed_product('mel-derivados','pomada-propolis','Pomada de própolis',null,3);
perform public.__market_seed_variant('pomada-propolis','20g','pacote','20g',35.00,1, p_net_g=>20);

perform public.__market_seed_product('mel-derivados','extrato-propolis','Extrato de própolis',null,4);
perform public.__market_seed_variant('extrato-propolis','30ml','pacote','30ml',45.00,1, p_net_g=>30);

perform public.__market_seed_product('mel-derivados','spray-propolis','Spray de própolis silvestre',null,5);
perform public.__market_seed_variant('spray-propolis','30ml','pacote','30ml',35.00,1, p_net_g=>30);

perform public.__market_seed_product('mel-derivados','protetor-labial','Protetor labial',
  'Mel, cera de abelha, manteiga de cacau, própolis e óleo de amêndoas.',6);
perform public.__market_seed_variant('protetor-labial','Unidade','unidade','unid.',15.00,1);

-- ---------- DESIDRATADOS, DOCES E PASTAS (Kilombo Tenondé) ----------
perform public.__market_seed_product('desidratados-doces','banana-desidratada','Banana desidratada',null,1);
perform public.__market_seed_variant('banana-desidratada','100g','pacote','100g',12.00,1, p_net_g=>100);

perform public.__market_seed_product('desidratados-doces','jaca-cupuacu-desidratado','Jaca ou cupuaçu desidratado',null,2);
perform public.__market_seed_variant('jaca-cupuacu-desidratado','Jaca 50g','pacote','50g',12.00,1, p_net_g=>50);
perform public.__market_seed_variant('jaca-cupuacu-desidratado','Cupuaçu 50g','pacote','50g',12.00,2, p_net_g=>50);

perform public.__market_seed_product('desidratados-doces','nutelombo','Nutelombo',
  'Nibs de cacau, amendoim, munguba, avelã e açúcar. Desenvolvido pela chocolate maker do Kilombo, Brenda Landele.',3);
perform public.__market_seed_variant('nutelombo','100g','pacote','100g',17.00,1, p_net_g=>100);
perform public.__market_seed_variant('nutelombo','200g','pacote','200g',27.00,2, p_net_g=>200);

perform public.__market_seed_product('desidratados-doces','chocolate-barra-70','Chocolate em barra 70%',null,4);
perform public.__market_seed_variant('chocolate-barra-70','35g','pacote','35g',12.00,1, p_net_g=>35);
perform public.__market_seed_variant('chocolate-barra-70','85g','pacote','85g',25.00,2, p_net_g=>85);

perform public.__market_seed_product('desidratados-doces','nibs-caramelizado','Nibs caramelizado',null,5);
perform public.__market_seed_variant('nibs-caramelizado','50g','pacote','50g',22.00,1, p_net_g=>50);

perform public.__market_seed_product('desidratados-doces','pasta-amendoim','Pasta de amendoim',null,6);
perform public.__market_seed_variant('pasta-amendoim','200g','pacote','200g',17.00,1, p_net_g=>200);

-- ---------- ÓLEOS ESSENCIAIS (5ml) ----------
perform public.__market_seed_product('oleos-essenciais','oleo-capim-santo','Óleo essencial de capim santo','Cymbopogon citratus',1);
perform public.__market_seed_variant('oleo-capim-santo','5ml','pacote','5ml',40.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-melaleuca','Óleo essencial de melaleuca','Melaleuca alternifolia',2);
perform public.__market_seed_variant('oleo-melaleuca','5ml','pacote','5ml',40.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-curcuma','Óleo essencial de cúrcuma (folha)','Curcuma longa',3);
perform public.__market_seed_variant('oleo-curcuma','5ml','pacote','5ml',40.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-melissa','Óleo essencial de melissa',null,4);
perform public.__market_seed_variant('oleo-melissa','5ml','pacote','5ml',60.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-citronela','Óleo essencial de citronela',null,5);
perform public.__market_seed_variant('oleo-citronela','5ml','pacote','5ml',40.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-petitgrain','Óleo essencial de petitgrain (folha)','Citrus limonia',6);
perform public.__market_seed_variant('oleo-petitgrain','5ml','pacote','5ml',60.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-eucalipto','Óleo essencial de eucalipto',null,7);
perform public.__market_seed_variant('oleo-eucalipto','5ml','pacote','5ml',40.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-alfazema-cabocla','Óleo essencial de alfazema de cabocla',null,8);
perform public.__market_seed_variant('oleo-alfazema-cabocla','5ml','pacote','5ml',60.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-cravo-india','Óleo essencial de cravo da índia (folha)','Syzygium aromaticum',9);
perform public.__market_seed_variant('oleo-cravo-india','5ml','pacote','5ml',45.00,1, p_net_g=>5);

perform public.__market_seed_product('oleos-essenciais','oleo-aroeira','Óleo essencial de aroeira (folha)','Schinus terebinthifolia',10);
perform public.__market_seed_variant('oleo-aroeira','5ml','pacote','5ml',40.00,1, p_net_g=>5);

-- ---------- TINTURAS (50ml, escolher a planta) ----------
perform public.__market_seed_product('tinturas','tintura-50ml','Tintura 50ml',
  'Tinturas de plantas medicinais do Kilombo Tenondé. Outras plantas sob consulta.',1);
perform public.__market_seed_variant('tintura-50ml','Eucalipto','pacote','50ml',25.00,1, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Artemísia','pacote','50ml',25.00,2, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Guaco','pacote','50ml',25.00,3, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Confrei','pacote','50ml',25.00,4, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Melaleuca','pacote','50ml',25.00,5, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Rosa rosa','pacote','50ml',25.00,6, p_net_g=>50);
perform public.__market_seed_variant('tintura-50ml','Arnica','pacote','50ml',25.00,7, p_net_g=>50);

-- ---------- BEBIDAS ARTESANAIS ----------
perform public.__market_seed_product('bebidas-artesanais','aguardente-cana','Aguardente tradicional de cana-de-açúcar (40%)',null,1,false,true);
perform public.__market_seed_variant('aguardente-cana','330ml','pacote','330ml',35.00,1, p_net_g=>330);

perform public.__market_seed_product('bebidas-artesanais','cachaca-cravo','Cachaça saborizada de cravo',null,2,false,true);
perform public.__market_seed_variant('cachaca-cravo','200ml','pacote','200ml',22.00,1, p_net_g=>200);

perform public.__market_seed_product('bebidas-artesanais','licor-artesanal','Licor artesanal',null,3,false,true);
perform public.__market_seed_variant('licor-artesanal','330ml','pacote','330ml',37.00,1, p_net_g=>330);

perform public.__market_seed_product('bebidas-artesanais','kombucha','Kombucha',null,4);
perform public.__market_seed_variant('kombucha','200ml','pacote','200ml',17.00,1, p_net_g=>200);

end $$;

drop function if exists public.__market_seed_product(text,text,text,text,int,boolean,boolean);
drop function if exists public.__market_seed_variant(text,text,text,text,numeric,int,numeric,numeric,numeric,numeric,text);


-- ------------------------------------------------------------
-- 11) Botão de acesso na tela de Início (estilo categoria destacada)
-- ------------------------------------------------------------
-- Config do botão administrável desde /admin (nada hardcodeado).
insert into public.admin_settings (key, value)
values (
  'mercado_agro_button',
  jsonb_build_object(
    'enabled',      true,
    'title',        'Mercado Agroecológico',
    'subtitle',     'Frutas, hortaliças e produtos naturais da ilha',
    'badge',        'Novo',
    'image_url',    null,
    'vendor_slug',  'feira-agroecologica-gamboa',
    'href',         '/mercado'
  )
)
on conflict (key) do nothing;


-- ------------------------------------------------------------
-- 12) Conferência rápida (opcional)
-- ------------------------------------------------------------
-- select c.name as secao, p.name as produto, v.label, v.unit_label,
--        v.sale_mode, v.price, v.step
-- from public.market_products p
-- join public.market_categories c on c.id = p.category_id
-- join public.market_product_variants v on v.product_id = p.id
-- order by c.sort_order, p.sort_order, v.sort_order;
