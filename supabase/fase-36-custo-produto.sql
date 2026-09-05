-- ============================================================
-- Fase 36 — Custo do produto e lucro de verdade
-- ============================================================
-- Até aqui o painel sabia o que ENTROU e o que se gastou em custos soltos
-- (transporte, embalagens). Faltava o principal para falar de lucro: quanto
-- custa cada produto que se vende.
--
-- Como fica:
--   · Cada opção de venda ganha um CUSTO, ao lado do preço. É opcional.
--   · O custo viaja congelado dentro do pedido (como o preço): se o custo
--     mudar amanhã, o pedido de ontem continua contando o custo de ontem.
--   · A venda feita no balcão também aceita o custo daquela venda.
--   · O painel só mostra lucro e margem quando NÃO FALTA NENHUM custo do
--     período. Faltando um, mostra quantos faltam em vez de um número errado.
--
-- Um número de lucro calculado pela metade é pior que nenhum: pareceria certo
-- e levaria a decisões erradas. Por isso o painel exige a informação completa.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Colunas novas
-- ------------------------------------------------------------
-- Custo atual de cada opção de venda. NULL = ainda não informado.
alter table public.market_product_variants
  add column if not exists cost_price numeric(10,2);

alter table public.market_product_variants
  drop constraint if exists market_variants_cost_nao_negativo;
alter table public.market_product_variants
  add constraint market_variants_cost_nao_negativo check (cost_price is null or cost_price >= 0);

comment on column public.market_product_variants.cost_price is
  'Quanto custa para a feira esta opção de venda. NULL = não informado (a margem fica bloqueada).';

-- Custo congelado no momento do pedido (espelha unit_price).
alter table public.market_order_items
  add column if not exists unit_cost numeric(10,2);

comment on column public.market_order_items.unit_cost is
  'Custo unitário no momento do pedido. NULL = o produto não tinha custo informado.';

-- Custo dos produtos de uma venda feita no balcão.
alter table public.market_sales
  add column if not exists cost_amount numeric(10,2);

alter table public.market_sales
  drop constraint if exists market_sales_cost_nao_negativo;
alter table public.market_sales
  add constraint market_sales_cost_nao_negativo check (cost_amount is null or cost_amount >= 0);


-- ------------------------------------------------------------
-- 2) O pedido passa a guardar o custo junto com o preço
-- ------------------------------------------------------------
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
    (order_id, variant_id, product_name, variant_label, unit_label, unit_price, unit_cost, quantity, line_total)
  select
    v_order_id, pv.id, pr.name, pv.label, pv.unit_label, pv.price, pv.cost_price,
    ped.quantity, round(pv.price * ped.quantity, 2)
  from pedido ped
  join public.market_product_variants pv on pv.id = ped.variant_id and pv.is_active
  join public.market_products pr on pr.id = pv.product_id and pr.is_active and pr.vendor_id = p_vendor_id
  where ped.quantity >= pv.min_qty
    and (pv.max_qty is null or ped.quantity <= pv.max_qty)
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


-- O que o cliente acrescenta na retirada também leva o custo do catálogo.
-- (Item livre segue sem custo: é algo que não está no catálogo.)
create or replace function public.add_pickup_items(
  p_order_id bigint,
  p_items    jsonb default '[]'::jsonb,
  p_extras   jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id bigint;
  v_total     numeric(10,2);
  v_added     int := 0;
  v_n         int;
begin
  select vendor_id into v_vendor_id
  from public.market_orders
  where id = p_order_id and user_id = auth.uid();

  if v_vendor_id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato inválido';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb))
     + jsonb_array_length(coalesce(p_extras, '[]'::jsonb)) > 20 then
    raise exception 'Muitos itens de uma vez';
  end if;

  with pedido as (
    select (i->>'variant_id')::bigint as variant_id,
           (i->>'quantity')::numeric  as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  )
  insert into public.market_order_items
    (order_id, variant_id, product_name, variant_label, unit_label, unit_price, unit_cost, quantity, line_total, added_at_pickup)
  select
    p_order_id, pv.id, pr.name, pv.label, pv.unit_label, pv.price, pv.cost_price,
    ped.quantity, round(pv.price * ped.quantity, 2), true
  from pedido ped
  join public.market_product_variants pv on pv.id = ped.variant_id and pv.is_active
  join public.market_products pr on pr.id = pv.product_id and pr.vendor_id = v_vendor_id
  where ped.quantity > 0
    and ped.quantity <= 999
    and mod(ped.quantity::numeric, pv.step) = 0;

  get diagnostics v_n = row_count;
  v_added := v_added + v_n;

  with extras as (
    select
      nullif(btrim(left(e->>'name', 80)), '')      as name,
      (e->>'quantity')::numeric                    as quantity,
      (e->>'unit_price')::numeric                  as unit_price
    from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) e
  )
  insert into public.market_order_items
    (order_id, variant_id, product_name, variant_label, unit_label, unit_price, quantity, line_total, added_at_pickup)
  select
    p_order_id, null, x.name, 'Comprado na feira', 'unid.',
    round(x.unit_price, 2), x.quantity, round(x.unit_price * x.quantity, 2), true
  from extras x
  where x.name is not null
    and x.quantity > 0 and x.quantity <= 999
    and x.unit_price >= 0 and x.unit_price <= 100000;

  get diagnostics v_n = row_count;
  v_added := v_added + v_n;

  if v_added = 0 then
    raise exception 'Nenhum item válido para adicionar';
  end if;

  select coalesce(sum(line_total), 0) into v_total
  from public.market_order_items where order_id = p_order_id;

  update public.market_orders set total = v_total where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'added', v_added, 'total', v_total);
end;
$$;

revoke all on function public.add_pickup_items(bigint, jsonb, jsonb) from public;
grant execute on function public.add_pickup_items(bigint, jsonb, jsonb) to authenticated;


-- ------------------------------------------------------------
-- 3) O catálogo do painel mostra o custo
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
                        'unit_label', pv.unit_label, 'price', pv.price, 'cost_price', pv.cost_price,
                        'step', pv.step, 'min_qty', pv.min_qty, 'max_qty', pv.max_qty, 'note', pv.note,
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
-- 4) Painel: margem e lucro, com a regra do "tudo ou nada"
-- ------------------------------------------------------------
-- resultado_caixa  → sempre disponível: o que entrou menos os custos soltos.
-- lucro_liquido    → só quando NÃO falta nenhum custo do período; senão vem
--                    nulo, acompanhado de quantos faltam e quais são.
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
  itens as (
    select oi.*
    from public.market_order_items oi
    join pedidos p on p.id = oi.order_id
  ),
  -- Custo do que saiu: só conta o que tem custo informado; o resto vira
  -- "pendência", e é isso que segura a margem.
  cmv as (
    select
      coalesce(sum(case when i.unit_cost is not null then i.unit_cost * i.quantity end), 0) as total,
      count(*) filter (where i.unit_cost is null and i.variant_id is not null)               as faltando,
      count(*) filter (where i.variant_id is null)                                          as fora_catalogo
    from itens i
  ),
  produtos_faltando as (
    select distinct i.product_name as nome
    from itens i
    where i.unit_cost is null and i.variant_id is not null
    limit 8
  ),
  vendas as (
    select
      coalesce(sum(amount), 0) as total,
      count(*) as qtd,
      coalesce(sum(cost_amount), 0) as custo,
      count(*) filter (where cost_amount is null) as sem_custo
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
    select i.product_name as nome, sum(i.quantity) as qtd, sum(i.line_total) as total
    from itens i
    group by i.product_name
    order by sum(i.line_total) desc
    limit 10
  ),
  -- Quantas opções do catálogo ativo ainda estão sem custo (o trabalho que
  -- falta fazer, independentemente do período escolhido).
  catalogo as (
    select count(*) filter (where pv.cost_price is null) as sem_custo,
           count(*)                                     as total
    from public.market_product_variants pv
    join public.market_products pr on pr.id = pv.product_id
    where pr.vendor_id = p_vendor_id and pr.is_active and pv.is_active
  ),
  base as (
    select
      coalesce((select sum(total) from pedidos), 0) as pedidos_total,
      (select count(*) from pedidos)                as pedidos_count,
      (select total from vendas)                    as vendas_total,
      (select qtd from vendas)                      as vendas_count,
      (select sem_custo from vendas)                as vendas_sem_custo,
      (select custo from vendas)                    as vendas_custo,
      (select total from custos)                    as custos_total,
      (select qtd from custos)                      as custos_count,
      (select total from cmv)                       as cmv_itens,
      (select faltando from cmv)                    as itens_sem_custo,
      (select fora_catalogo from cmv)               as itens_fora_catalogo
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'pedidos_total', b.pedidos_total,
    'pedidos_count', b.pedidos_count,
    'ticket_medio',  coalesce((select round(avg(total), 2) from pedidos), 0),
    'vendas_total',  b.vendas_total,
    'vendas_count',  b.vendas_count,
    'custos_total',  b.custos_total,
    'custos_count',  b.custos_count,
    'receita_total', b.pedidos_total + b.vendas_total,
    -- Sempre disponível: não depende de custo de produto nenhum.
    'resultado_caixa', b.pedidos_total + b.vendas_total - b.custos_total,
    -- Custo dos produtos vendidos (o que se sabe até agora)
    'cmv_total', b.cmv_itens + b.vendas_custo,
    'itens_sem_custo', b.itens_sem_custo,
    'itens_fora_catalogo', b.itens_fora_catalogo,
    'vendas_sem_custo', b.vendas_sem_custo,
    'catalogo_sem_custo', (select sem_custo from catalogo),
    'catalogo_total', (select total from catalogo),
    'produtos_sem_custo', coalesce((select jsonb_agg(nome) from produtos_faltando), '[]'::jsonb),
    -- Tudo ou nada: um custo faltando e o lucro não sai.
    'margem_ok', (b.itens_sem_custo = 0 and b.vendas_sem_custo = 0),
    'lucro_liquido', case
      when b.itens_sem_custo = 0 and b.vendas_sem_custo = 0
      then b.pedidos_total + b.vendas_total - (b.cmv_itens + b.vendas_custo) - b.custos_total
    end,
    'margem_pct', case
      when b.itens_sem_custo = 0 and b.vendas_sem_custo = 0 and (b.pedidos_total + b.vendas_total) > 0
      then round(
        (b.pedidos_total + b.vendas_total - (b.cmv_itens + b.vendas_custo) - b.custos_total)
        * 100 / (b.pedidos_total + b.vendas_total), 1)
    end,
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
  ) into v_result
  from base b;

  return v_result;
end;
$$;

revoke all on function public.get_market_dashboard(bigint, date, date) from public;
grant execute on function public.get_market_dashboard(bigint, date, date) to authenticated;
