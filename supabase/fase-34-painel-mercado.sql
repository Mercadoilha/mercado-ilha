-- ============================================================
-- Fase 34 — Painel do Mercado Agroecológico
-- ============================================================
-- Dá autonomia à feira: as pessoas que o dono do app designar podem
-- manter o próprio catálogo (preços, produtos, esgotados), ver os
-- pedidos que entram e ajustar os dados da feira — sem tocar em mais
-- nada do site.
--
-- Regras combinadas com o dono:
--   · Podem tudo, MENOS apagar de verdade: para tirar algo, ocultam
--     (dá para trazer de volta). Nenhuma política concede DELETE.
--   · Veem os pedidos com nome e telefone de quem pediu.
--   · Podem designar e tirar outros administradores entre eles.
--   · Podem mudar dados da feira, o WhatsApp de destino e pausar o
--     mercado (o botão do Início some quando está pausado).
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Quem administra cada feira
-- ------------------------------------------------------------
create table if not exists public.market_vendor_admins (
  vendor_id  bigint not null references public.market_vendors(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (vendor_id, user_id)
);

create index if not exists idx_market_vendor_admins_user on public.market_vendor_admins(user_id);


-- ------------------------------------------------------------
-- 2) "Esta pessoa administra esta feira?"
-- ------------------------------------------------------------
-- security definer: a função lê a tabela de administradores por fora do RLS,
-- senão a política que a usa consultaria a própria tabela que está protegendo.
-- Sem argumento responde "administra ALGUMA feira" (serve para mostrar ou não
-- o acesso ao painel).
create or replace function public.is_market_admin(p_vendor_id bigint default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.market_vendor_admins a
    where a.user_id = auth.uid()
      and (p_vendor_id is null or a.vendor_id = p_vendor_id)
  );
$$;

revoke all on function public.is_market_admin(bigint) from public;
grant execute on function public.is_market_admin(bigint) to authenticated;

alter table public.market_vendor_admins enable row level security;

drop policy if exists "Market admins read"  on public.market_vendor_admins;
drop policy if exists "Market admins write" on public.market_vendor_admins;
-- Ver e mexer na equipe: só quem já é administrador da feira (ou o admin do app).
create policy "Market admins read" on public.market_vendor_admins
  for select using (public.is_market_admin(vendor_id));
create policy "Market admins write" on public.market_vendor_admins
  for all using (public.is_market_admin(vendor_id)) with check (public.is_market_admin(vendor_id));


-- ------------------------------------------------------------
-- 3) "Esgotado" — acabou hoje, mas o produto continua existindo
-- ------------------------------------------------------------
alter table public.market_product_variants
  add column if not exists is_sold_out boolean not null default false;

comment on column public.market_product_variants.is_sold_out is
  'true = aparece no catálogo marcado como esgotado e não pode ser pedido.';


-- ------------------------------------------------------------
-- 4) Políticas: a feira mantém o próprio catálogo
-- ------------------------------------------------------------
-- Sem DELETE em lugar nenhum: tirar do ar é ocultar (is_active = false).
drop policy if exists "Market products vendor write"   on public.market_products;
drop policy if exists "Market products vendor insert"  on public.market_products;
drop policy if exists "Market products vendor update"  on public.market_products;
create policy "Market products vendor insert" on public.market_products
  for insert with check (public.is_market_admin(vendor_id));
create policy "Market products vendor update" on public.market_products
  for update using (public.is_market_admin(vendor_id)) with check (public.is_market_admin(vendor_id));

drop policy if exists "Market variants vendor insert" on public.market_product_variants;
drop policy if exists "Market variants vendor update" on public.market_product_variants;
create policy "Market variants vendor insert" on public.market_product_variants
  for insert with check (
    exists (select 1 from public.market_products p
            where p.id = product_id and public.is_market_admin(p.vendor_id))
  );
create policy "Market variants vendor update" on public.market_product_variants
  for update using (
    exists (select 1 from public.market_products p
            where p.id = market_product_variants.product_id and public.is_market_admin(p.vendor_id))
  ) with check (
    exists (select 1 from public.market_products p
            where p.id = product_id and public.is_market_admin(p.vendor_id))
  );

-- Seções do catálogo: hoje há uma única feira, então quem a administra também
-- organiza as seções (criar, renomear, reordenar, ocultar).
drop policy if exists "Market categories vendor insert" on public.market_categories;
drop policy if exists "Market categories vendor update" on public.market_categories;
create policy "Market categories vendor insert" on public.market_categories
  for insert with check (public.is_market_admin());
create policy "Market categories vendor update" on public.market_categories
  for update using (public.is_market_admin()) with check (public.is_market_admin());

-- Pedidos: a feira vê os seus (com nome e telefone, como combinado).
drop policy if exists "Market orders own read" on public.market_orders;
create policy "Market orders own read" on public.market_orders for select using (
  user_id = (select auth.uid())
  or public.is_market_admin(vendor_id)
  or exists (select 1 from public.market_vendors v
             where v.id = market_orders.vendor_id and v.owner_id = (select auth.uid()))
);

drop policy if exists "Market order items own read" on public.market_order_items;
create policy "Market order items own read" on public.market_order_items for select using (
  exists (
    select 1 from public.market_orders o
    where o.id = market_order_items.order_id
      and (o.user_id = (select auth.uid())
           or public.is_market_admin(o.vendor_id)
           or exists (select 1 from public.market_vendors v
                      where v.id = o.vendor_id and v.owner_id = (select auth.uid())))
  )
);


-- ------------------------------------------------------------
-- 5) Catálogo público: agora também diz o que está esgotado
-- ------------------------------------------------------------
-- Mesma função de sempre (mesma assinatura, substitui a da fase-32): o item
-- esgotado continua aparecendo na lista, mas marcado e sem poder ser pedido.
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
              'note', pv.note,
              'is_sold_out', pv.is_sold_out
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
-- 6) Catálogo do painel: mostra TUDO, inclusive o que está oculto
-- ------------------------------------------------------------
create or replace function public.get_market_catalog_admin(p_vendor_slug text default 'feira-agroecologica-gamboa')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select * from public.market_vendors where slug = p_vendor_slug limit 1
  )
  select case
    when not public.is_market_admin((select id from v)) then null
    else jsonb_build_object(
      'vendor', to_jsonb(v),
      'sections', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id, 'slug', c.slug, 'name', c.name, 'emoji', c.emoji,
            'is_active', c.is_active, 'sort_order', c.sort_order,
            'products', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
                  'is_active', p.is_active, 'is_seasonal', p.is_seasonal,
                  'is_alcoholic', p.is_alcoholic, 'sort_order', p.sort_order,
                  'variants', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', pv.id, 'label', pv.label, 'sale_mode', pv.sale_mode,
                        'unit_label', pv.unit_label, 'price', pv.price, 'step', pv.step,
                        'min_qty', pv.min_qty, 'max_qty', pv.max_qty, 'note', pv.note,
                        'is_active', pv.is_active, 'is_sold_out', pv.is_sold_out,
                        'sort_order', pv.sort_order
                      ) order by pv.sort_order, pv.id
                    )
                    from public.market_product_variants pv where pv.product_id = p.id
                  ), '[]'::jsonb)
                ) order by p.sort_order, p.name
              )
              from public.market_products p
              where p.category_id = c.id and p.vendor_id = (select id from v)
            ), '[]'::jsonb)
          ) order by c.sort_order, c.id
        )
        from public.market_categories c
      ), '[]'::jsonb)
    )
  end
  from v;
$$;

revoke all on function public.get_market_catalog_admin(text) from public;
grant execute on function public.get_market_catalog_admin(text) to authenticated;


-- ------------------------------------------------------------
-- 7) Dados da feira (e pausar o mercado)
-- ------------------------------------------------------------
-- Passa por função em vez de política porque aqui interessa limitar QUAIS
-- colunas se podem tocar: nunca o dono nem o slug.
create or replace function public.update_market_vendor(
  p_vendor_id     bigint,
  p_name          text,
  p_tagline       text,
  p_description   text,
  p_whatsapp      text,
  p_pickup_place  text,
  p_delivery_day  text,
  p_deadline_text text,
  p_footer_note   text,
  p_is_active     boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'O nome da feira não pode ficar vazio';
  end if;

  update public.market_vendors set
    name          = left(btrim(p_name), 120),
    tagline       = nullif(btrim(left(coalesce(p_tagline, ''), 200)), ''),
    description   = nullif(btrim(left(coalesce(p_description, ''), 600)), ''),
    whatsapp      = nullif(btrim(left(coalesce(p_whatsapp, ''), 30)), ''),
    pickup_place  = nullif(btrim(left(coalesce(p_pickup_place, ''), 200)), ''),
    delivery_day  = nullif(btrim(left(coalesce(p_delivery_day, ''), 120)), ''),
    deadline_text = nullif(btrim(left(coalesce(p_deadline_text, ''), 200)), ''),
    footer_note   = nullif(btrim(left(coalesce(p_footer_note, ''), 800)), ''),
    is_active     = coalesce(p_is_active, true)
  where id = p_vendor_id;
end;
$$;

revoke all on function public.update_market_vendor(bigint,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.update_market_vendor(bigint,text,text,text,text,text,text,text,text,boolean) to authenticated;


-- ------------------------------------------------------------
-- 8) A equipe da feira
-- ------------------------------------------------------------
-- Listar: nome e e-mail de quem administra (o e-mail vive em auth.users, por
-- isso a função é security definer; só administradores da feira a executam).
create or replace function public.list_market_admins(p_vendor_id bigint)
returns table (user_id uuid, full_name text, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;

  return query
    select a.user_id, p.full_name, u.email::text, a.created_at
    from public.market_vendor_admins a
    join public.profiles p on p.id = a.user_id
    left join auth.users u on u.id = a.user_id
    where a.vendor_id = p_vendor_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_market_admins(bigint) from public;
grant execute on function public.list_market_admins(bigint) to authenticated;

-- Designar pelo e-mail da conta (a pessoa já tem que estar cadastrada no app).
create or replace function public.add_market_admin_by_email(p_vendor_id bigint, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_name text;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;

  select u.id into v_uid from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;

  if v_uid is null then
    raise exception 'Nenhuma conta com esse e-mail. A pessoa precisa se cadastrar no app primeiro.';
  end if;

  insert into public.market_vendor_admins (vendor_id, user_id, created_by)
  values (p_vendor_id, v_uid, auth.uid())
  on conflict (vendor_id, user_id) do nothing;

  select full_name into v_name from public.profiles where id = v_uid;
  return jsonb_build_object('user_id', v_uid, 'full_name', v_name);
end;
$$;

revoke all on function public.add_market_admin_by_email(bigint, text) from public;
grant execute on function public.add_market_admin_by_email(bigint, text) to authenticated;

-- Tirar alguém da equipe. Ninguém pode tirar a si mesmo (evita a feira ficar
-- sem nenhum administrador por engano) e não se pode esvaziar a equipe.
create or replace function public.remove_market_admin(p_vendor_id bigint, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_left int;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode tirar a si mesmo da equipe';
  end if;

  delete from public.market_vendor_admins
  where vendor_id = p_vendor_id and user_id = p_user_id;

  select count(*) into v_left from public.market_vendor_admins where vendor_id = p_vendor_id;
  if v_left = 0 then
    raise exception 'A feira precisa de pelo menos um administrador';
  end if;
end;
$$;

revoke all on function public.remove_market_admin(bigint, uuid) from public;
grant execute on function public.remove_market_admin(bigint, uuid) to authenticated;


-- ------------------------------------------------------------
-- 9) Criar produto (o endereço interno sai daqui, não do painel)
-- ------------------------------------------------------------
-- Cada produto precisa de um identificador único. Gerá-lo no servidor evita
-- que duas pessoas criando produtos ao mesmo tempo colidam, e o painel não
-- precisa perguntar nada disso a quem está cadastrando.
create or replace function public.create_market_product(
  p_vendor_id    bigint,
  p_category_id  bigint,
  p_name         text,
  p_description  text default null,
  p_is_seasonal  boolean default false,
  p_is_alcoholic boolean default false
) returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_base text;
  v_slug text;
  v_id   bigint;
  v_n    int := 0;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'O produto precisa de um nome';
  end if;

  -- "Polpa de Cajá" → "polpa-de-caja"
  v_base := regexp_replace(lower(extensions.unaccent(btrim(p_name))), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  if v_base = '' then v_base := 'produto'; end if;
  v_slug := v_base;

  while exists (select 1 from public.market_products where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.market_products
    (vendor_id, category_id, slug, name, description, is_seasonal, is_alcoholic, sort_order)
  values (
    p_vendor_id, p_category_id, v_slug, left(btrim(p_name), 120),
    nullif(btrim(left(coalesce(p_description, ''), 600)), ''),
    coalesce(p_is_seasonal, false), coalesce(p_is_alcoholic, false),
    coalesce((select max(sort_order) + 1 from public.market_products where category_id = p_category_id), 1)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_market_product(bigint,bigint,text,text,boolean,boolean) from public;
grant execute on function public.create_market_product(bigint,bigint,text,text,boolean,boolean) to authenticated;


-- ------------------------------------------------------------
-- 10) Primeiro administrador da feira
-- ------------------------------------------------------------
-- O dono do app entra sempre (is_admin), então pode designar os demais pelo
-- painel. Se a feira tiver dono definido, ele já entra na equipe.
insert into public.market_vendor_admins (vendor_id, user_id)
select v.id, v.owner_id
from public.market_vendors v
where v.owner_id is not null
on conflict do nothing;
