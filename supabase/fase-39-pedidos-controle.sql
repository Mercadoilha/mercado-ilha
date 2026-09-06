-- ============================================================
-- FASE 39 — CONTROLE DE PEDIDOS (2026-09-06)
--
-- Três problemas reais que apareceram no primeiro uso:
--
--  1) ENVIOS REPETIDOS. O pedido é registrado no mesmo toque que abre o
--     WhatsApp. Se o envio falha e a pessoa tenta de novo, cada tentativa
--     virava um pedido novo. Agora o pedido carrega a "impressão digital"
--     do carrinho (items_hash): reenviar o MESMO carrinho dentro de 6h
--     devolve o pedido que já existe, em vez de criar outro.
--
--  2) OS DUPLICADOS QUE JÁ ENTRARAM. Limpeza única no fim do arquivo:
--     mesmo cliente + mesmo carrinho + mesmo dia → fica só o primeiro.
--     Nunca apaga pedido entregue, cancelado ou com compra na retirada.
--
--  3) ENTREGUE vs PENDENTE. Um pedido feito não é dinheiro no caixa: só
--     conta quando a pessoa retirou. O painel passa a somar no caixa
--     apenas o que está marcado como entregue, e mostra o pendente à
--     parte. Some também o botão de excluir pedido, para a feira.
--
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Colunas novas
-- ------------------------------------------------------------
alter table public.market_orders add column if not exists items_hash   text;
alter table public.market_orders add column if not exists delivered_at timestamptz;

create index if not exists idx_market_orders_dedupe
  on public.market_orders (vendor_id, user_id, items_hash, created_at desc);


-- ------------------------------------------------------------
-- 2) A impressão digital do carrinho
-- ------------------------------------------------------------
-- Mesmos itens nas mesmas quantidades → mesmo hash, não importa a ordem
-- em que foram colocados no carrinho.
create or replace function public.market_items_hash(p_items jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case when count(*) = 0 then null else
    md5(string_agg(
      (i->>'variant_id') || 'x' || trim_scale(round((i->>'quantity')::numeric, 3))::text,
      ',' order by (i->>'variant_id')::bigint))
  end
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where (i->>'variant_id') is not null;
$$;

revoke all on function public.market_items_hash(jsonb) from public;
grant execute on function public.market_items_hash(jsonb) to authenticated;


-- Preenche o hash dos pedidos que já estão na base (sem contar o que foi
-- acrescentado na retirada: o hash é o do carrinho enviado pelo app).
update public.market_orders o
set items_hash = h.hash
from (
  select oi.order_id,
         md5(string_agg(
           oi.variant_id::text || 'x' || trim_scale(round(oi.quantity, 3))::text,
           ',' order by oi.variant_id)) as hash
  from public.market_order_items oi
  where oi.variant_id is not null
    and not coalesce(oi.added_at_pickup, false)
  group by oi.order_id
) h
where h.order_id = o.id and o.items_hash is null;


-- ------------------------------------------------------------
-- 3) Registrar o pedido — agora com trava de reenvio
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
  v_hash     text;
  -- Janela do reenvio: tempo de sobra para as tentativas que falharam,
  -- curto o bastante para não engolir um pedido novo de verdade.
  v_janela   constant interval := interval '6 hours';
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

  v_hash := public.market_items_hash(p_items);

  -- Mesmo carrinho, mesma pessoa, mesma feira, dentro da janela → é reenvio.
  -- Devolve o pedido que já está registrado em vez de criar outro.
  -- Pedido com compra na retirada nunca entra aqui: já foi além do envio.
  if auth.uid() is not null and v_hash is not null then
    select o.id, o.total into v_order_id, v_total
    from public.market_orders o
    where o.vendor_id = p_vendor_id
      and o.user_id = auth.uid()
      and o.items_hash = v_hash
      and o.status <> 'cancelado'
      and o.created_at > now() - v_janela
      and not exists (
        select 1 from public.market_order_items i
        where i.order_id = o.id and i.added_at_pickup
      )
    order by o.id desc
    limit 1;

    if v_order_id is not null then
      return jsonb_build_object(
        'order_id', v_order_id,
        'total', v_total,
        'reenvio', true,
        'items', (
          select jsonb_agg(jsonb_build_object(
            'product_name', product_name, 'variant_label', variant_label,
            'unit_label', unit_label, 'unit_price', unit_price,
            'quantity', quantity, 'line_total', line_total
          ) order by id)
          from public.market_order_items where order_id = v_order_id
        )
      );
    end if;
  end if;

  insert into public.market_orders
    (vendor_id, user_id, customer_name, customer_whatsapp, customer_note, items_hash)
  values
    (p_vendor_id, auth.uid(), trim(p_customer_name), p_customer_whatsapp, p_customer_note, v_hash)
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
    'reenvio', false,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'product_name', product_name, 'variant_label', variant_label,
        'unit_label', unit_label, 'unit_price', unit_price,
        'quantity', quantity, 'line_total', line_total
      ) order by id)
      from public.market_order_items where order_id = v_order_id
    )
  );
end;
$$;

revoke all on function public.create_market_order(bigint, jsonb, text, text, text) from public;
grant execute on function public.create_market_order(bigint, jsonb, text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 4) Marcar entregue / voltar para pendente
-- ------------------------------------------------------------
create or replace function public.set_market_order_delivered(
  p_order_id  bigint,
  p_delivered boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor bigint;
begin
  select vendor_id into v_vendor from public.market_orders where id = p_order_id;
  if v_vendor is null then
    raise exception 'Pedido não encontrado';
  end if;
  if not public.is_market_admin(v_vendor) then
    raise exception 'Sem permissão';
  end if;

  update public.market_orders
     set status       = case when p_delivered then 'entregue' else 'novo' end,
         delivered_at = case when p_delivered then now() end
   where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', case when p_delivered then 'entregue' else 'novo' end
  );
end;
$$;

revoke all on function public.set_market_order_delivered(bigint, boolean) from public;
grant execute on function public.set_market_order_delivered(bigint, boolean) to authenticated;


-- ------------------------------------------------------------
-- 5) Excluir um pedido
-- ------------------------------------------------------------
-- Única exclusão de verdade do módulo, e só para quem administra a feira:
-- serve para tirar da conta um pedido que nunca existiu (teste, engano,
-- envio repetido antigo). Os itens saem junto, por cascade.
create or replace function public.delete_market_order(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor bigint;
begin
  select vendor_id into v_vendor from public.market_orders where id = p_order_id;
  if v_vendor is null then
    raise exception 'Pedido não encontrado';
  end if;
  if not public.is_market_admin(v_vendor) then
    raise exception 'Sem permissão';
  end if;

  delete from public.market_orders where id = p_order_id;
  return jsonb_build_object('order_id', p_order_id, 'excluido', true);
end;
$$;

revoke all on function public.delete_market_order(bigint) from public;
grant execute on function public.delete_market_order(bigint) to authenticated;


-- ------------------------------------------------------------
-- 6) Painel: só o que foi entregue entra no caixa
-- ------------------------------------------------------------
-- pedidos      → entregues (dinheiro de verdade: receita, CMV, margem)
-- pedidos_all  → tudo o que não foi cancelado (comportamento: hora e dia
--                em que as pessoas pedem — isso independe da retirada)
-- pendentes    → o que foi pedido e ainda não foi retirado, informado à parte
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

  with pedidos_all as (
    select
      o.id,
      o.total,
      o.status,
      (o.created_at at time zone 'America/Bahia')::date as dia,
      extract(hour from (o.created_at at time zone 'America/Bahia'))::int as hora,
      extract(isodow from (o.created_at at time zone 'America/Bahia'))::int as dow
    from public.market_orders o
    where o.vendor_id = p_vendor_id
      and (o.created_at at time zone 'America/Bahia')::date between p_from and p_to
      and o.status <> 'cancelado'
  ),
  pedidos as (
    select * from pedidos_all where status = 'entregue'
  ),
  pendentes as (
    select coalesce(sum(total), 0) as total, count(*) as qtd
    from pedidos_all where status <> 'entregue'
  ),
  itens as (
    select oi.*
    from public.market_order_items oi
    join pedidos p on p.id = oi.order_id
  ),
  cmv as (
    select
      coalesce(sum(case when i.unit_cost is not null then i.unit_cost * i.quantity end), 0) as total,
      count(*) filter (where i.unit_cost is null and i.variant_id is not null)               as faltando,
      count(*) filter (where i.variant_id is null)                                          as fora_catalogo
    from itens i
  ),
  secoes as (
    select
      c.id                                   as id,
      c.name                                 as nome,
      c.emoji                                as emoji,
      sum(i.line_total)                      as receita,
      coalesce(sum(case when i.unit_cost is not null then i.unit_cost * i.quantity end), 0) as cmv,
      count(*) filter (where i.unit_cost is null) as sem_custo
    from itens i
    join public.market_product_variants pv on pv.id = i.variant_id
    join public.market_products pr on pr.id = pv.product_id
    join public.market_categories c on c.id = pr.category_id
    group by c.id, c.name, c.emoji
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
      (select total from pendentes)                 as pendentes_total,
      (select qtd from pendentes)                   as pendentes_count,
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
    'pedidos_pendentes_total', b.pendentes_total,
    'pedidos_pendentes_count', b.pendentes_count,
    'ticket_medio',  coalesce((select round(avg(total), 2) from pedidos), 0),
    'vendas_total',  b.vendas_total,
    'vendas_count',  b.vendas_count,
    'custos_total',  b.custos_total,
    'custos_count',  b.custos_count,
    'receita_total', b.pedidos_total + b.vendas_total,
    'resultado_caixa', b.pedidos_total + b.vendas_total - b.custos_total,
    'cmv_total', b.cmv_itens + b.vendas_custo,
    'itens_sem_custo', b.itens_sem_custo,
    'itens_fora_catalogo', b.itens_fora_catalogo,
    'vendas_sem_custo', b.vendas_sem_custo,
    'catalogo_sem_custo', (select sem_custo from catalogo),
    'catalogo_total', (select total from catalogo),
    'produtos_sem_custo', coalesce((select jsonb_agg(nome) from produtos_faltando), '[]'::jsonb),
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
    'por_secao', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'emoji', emoji,
        'receita', receita, 'cmv', cmv, 'sem_custo', sem_custo,
        'margem_ok', sem_custo = 0,
        'lucro_bruto', case when sem_custo = 0 then receita - cmv end,
        'margem_pct', case
          when sem_custo = 0 and receita > 0 then round((receita - cmv) * 100 / receita, 1)
        end
      ) order by receita desc)
      from secoes), '[]'::jsonb),
    'custos_por_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('nome', nome, 'total', total) order by total desc)
      from custos_cat), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', dia, 'pedidos', pedidos, 'pedidos_total', pedidos_total, 'vendas_total', vendas_total
      ) order by dia)
      from por_dia), '[]'::jsonb),
    -- Comportamento: em que hora e em que dia as pessoas pedem. Conta todo
    -- pedido não cancelado, entregue ou não — o que se estuda é o pedido.
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', hora, 'pedidos', qtd) order by hora)
      from (select hora, count(*) qtd from pedidos_all group by hora) h), '[]'::jsonb),
    'por_dia_semana', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'pedidos', qtd) order by dow)
      from (select dow, count(*) qtd from pedidos_all group by dow) w), '[]'::jsonb),
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


-- ============================================================
-- 7) LIMPEZA ÚNICA — os duplicados que já entraram
-- ============================================================
-- Mesmo cliente + mesmo carrinho + mesmo dia = um pedido só (fica o
-- primeiro). Nunca toca em pedido entregue, cancelado, ou que já teve
-- compra acrescentada na retirada.
with dups as (
  select o.id,
         row_number() over (
           partition by o.vendor_id, o.user_id, o.items_hash,
                        (o.created_at at time zone 'America/Bahia')::date
           order by o.id
         ) as rn
  from public.market_orders o
  where o.items_hash is not null
    and o.user_id is not null
    and o.status = 'novo'
    and not exists (
      select 1 from public.market_order_items i
      where i.order_id = o.id and i.added_at_pickup
    )
)
delete from public.market_orders o
using dups d
where d.id = o.id and d.rn > 1;
