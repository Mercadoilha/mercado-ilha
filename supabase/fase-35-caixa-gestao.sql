-- ============================================================
-- Fase 35 — Caixa e gestão da feira
-- ============================================================
-- Até aqui o painel mostrava os pedidos do app. Esta fase transforma isso
-- em gestão de verdade: o que se vendeu na feira no dia (dinheiro que não
-- passou pelo app), o que se gastou, e o lucro que sobra.
--
-- Combinado com o dono: as categorias de custo são OPCIONAIS — quem usa
-- decide se quer separar por categoria, e cria as que quiser. Um custo sem
-- categoria é perfeitamente válido.
--
-- Tudo aqui é privado da equipe da feira (is_market_admin).
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Vendas feitas na própria feira (não passaram pelo app)
-- ------------------------------------------------------------
create table if not exists public.market_sales (
  id          bigint generated always as identity primary key,
  vendor_id   bigint not null references public.market_vendors(id) on delete cascade,
  sold_on     date   not null default (now() at time zone 'America/Bahia')::date,
  amount      numeric(10,2) not null check (amount >= 0),
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_market_sales_vendor_date on public.market_sales(vendor_id, sold_on desc);


-- ------------------------------------------------------------
-- 2) Categorias de custo — opcionais, criadas pela própria feira
-- ------------------------------------------------------------
create table if not exists public.market_cost_categories (
  id         bigint generated always as identity primary key,
  vendor_id  bigint not null references public.market_vendors(id) on delete cascade,
  name       text   not null,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (vendor_id, name)
);


-- ------------------------------------------------------------
-- 3) Custos
-- ------------------------------------------------------------
create table if not exists public.market_costs (
  id          bigint generated always as identity primary key,
  vendor_id   bigint not null references public.market_vendors(id) on delete cascade,
  -- Sem categoria é válido: quem não quiser separar, não separa.
  category_id bigint references public.market_cost_categories(id) on delete set null,
  spent_on    date   not null default (now() at time zone 'America/Bahia')::date,
  description text   not null,
  amount      numeric(10,2) not null check (amount >= 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_market_costs_vendor_date on public.market_costs(vendor_id, spent_on desc);


-- ------------------------------------------------------------
-- 4) RLS — só a equipe da feira, e ninguém mais
-- ------------------------------------------------------------
-- Aqui, ao contrário do catálogo, apagar É permitido: um lançamento errado de
-- caixa tem que poder sair, senão os números ficam mentindo para sempre.
alter table public.market_sales           enable row level security;
alter table public.market_cost_categories enable row level security;
alter table public.market_costs           enable row level security;

drop policy if exists "Market sales team" on public.market_sales;
create policy "Market sales team" on public.market_sales
  for all using (public.is_market_admin(vendor_id)) with check (public.is_market_admin(vendor_id));

drop policy if exists "Market cost categories team" on public.market_cost_categories;
create policy "Market cost categories team" on public.market_cost_categories
  for all using (public.is_market_admin(vendor_id)) with check (public.is_market_admin(vendor_id));

drop policy if exists "Market costs team" on public.market_costs;
create policy "Market costs team" on public.market_costs
  for all using (public.is_market_admin(vendor_id)) with check (public.is_market_admin(vendor_id));


-- ------------------------------------------------------------
-- 5) Os números do período, numa consulta só
-- ------------------------------------------------------------
-- Devolve tudo o que o painel mostra: totais, lucro, o movimento dia a dia,
-- em que horas as pessoas pedem e o que mais sai. Uma chamada, sem N+1.
--
-- Datas no fuso da ilha (America/Bahia): "hoje" é o hoje de quem está na feira,
-- não o do servidor.
create or replace function public.get_market_dashboard(
  p_vendor_id bigint,
  p_from      date,
  p_to        date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Período inválido';
  end if;

  with pedidos as (
    select
      o.id,
      o.total,
      (o.created_at at time zone 'America/Bahia')::date as dia,
      extract(hour from (o.created_at at time zone 'America/Bahia'))::int as hora,
      extract(isodow from (o.created_at at time zone 'America/Bahia'))::int as dow
    from public.market_orders o
    where o.vendor_id = p_vendor_id
      and (o.created_at at time zone 'America/Bahia')::date between p_from and p_to
  ),
  vendas as (
    select coalesce(sum(amount), 0) as total, count(*) as qtd
    from public.market_sales
    where vendor_id = p_vendor_id and sold_on between p_from and p_to
  ),
  custos as (
    select coalesce(sum(amount), 0) as total, count(*) as qtd
    from public.market_costs
    where vendor_id = p_vendor_id and spent_on between p_from and p_to
  ),
  custos_cat as (
    select coalesce(c.name, 'Sem categoria') as nome, sum(k.amount) as total
    from public.market_costs k
    left join public.market_cost_categories c on c.id = k.category_id
    where k.vendor_id = p_vendor_id and k.spent_on between p_from and p_to
    group by coalesce(c.name, 'Sem categoria')
  ),
  por_dia as (
    -- Pedidos e vendas do balcão no mesmo eixo de dias.
    select
      d.dia,
      coalesce(p.qtd, 0)   as pedidos,
      coalesce(p.total, 0) as pedidos_total,
      coalesce(v.total, 0) as vendas_total
    from (
      select distinct dia from pedidos
      union
      select distinct sold_on from public.market_sales
        where vendor_id = p_vendor_id and sold_on between p_from and p_to
    ) d(dia)
    left join (select dia, count(*) qtd, sum(total) total from pedidos group by dia) p on p.dia = d.dia
    left join (select sold_on, sum(amount) total from public.market_sales
               where vendor_id = p_vendor_id and sold_on between p_from and p_to
               group by sold_on) v on v.sold_on = d.dia
  ),
  top_produtos as (
    select oi.product_name as nome,
           sum(oi.quantity)   as qtd,
           sum(oi.line_total) as total
    from public.market_order_items oi
    join pedidos p on p.id = oi.order_id
    group by oi.product_name
    order by sum(oi.line_total) desc
    limit 10
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'pedidos_total',  coalesce((select sum(total) from pedidos), 0),
    'pedidos_count',  (select count(*) from pedidos),
    'ticket_medio',   coalesce((select round(avg(total), 2) from pedidos), 0),
    'vendas_total',   (select total from vendas),
    'vendas_count',   (select qtd from vendas),
    'custos_total',   (select total from custos),
    'custos_count',   (select qtd from custos),
    'lucro',          coalesce((select sum(total) from pedidos), 0)
                      + (select total from vendas)
                      - (select total from custos),
    'custos_por_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('nome', nome, 'total', total) order by total desc)
      from custos_cat), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', dia, 'pedidos', pedidos, 'pedidos_total', pedidos_total, 'vendas_total', vendas_total
      ) order by dia)
      from por_dia), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', hora, 'pedidos', qtd) order by hora)
      from (select hora, count(*) qtd from pedidos group by hora) h), '[]'::jsonb),
    'por_dia_semana', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'pedidos', qtd) order by dow)
      from (select dow, count(*) qtd from pedidos group by dow) w), '[]'::jsonb),
    'top_produtos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd, 'total', total))
      from top_produtos), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_market_dashboard(bigint, date, date) from public;
grant execute on function public.get_market_dashboard(bigint, date, date) to authenticated;
