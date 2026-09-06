-- ============================================================
-- Fase 40 — Corrigir custos já gravados, a partir de uma data
-- ============================================================
-- Por que isto existe:
--   O custo viaja congelado dentro do pedido (fase-36) e a fase-37 só sabe
--   PREENCHER buracos — nunca corrigir. Mas há custos que a feira só descobre
--   depois da compra (o produtor cobrou outro valor, o preço mudou no meio do
--   mês, alguém digitou errado). Sem uma forma de corrigir, o lucro daquele
--   período fica errado para sempre.
--
-- Como fica:
--   A equipe edita os custos numa lista (preço e custo lado a lado) e escolhe
--   A PARTIR DE QUE DATA esse custo vale. O novo custo é gravado no catálogo
--   (dali em diante) e reescrito nas vendas daquela data até hoje. O que é
--   anterior à data NÃO se toca — é assim que um custo que mudou no dia 10
--   deixa agosto intacto e corrige só o que veio depois.
--
--   Diferença com a fase-37: aquela preenche vazios, esta SUBSTITUI. Por isso
--   o painel pede confirmação e mostra antes quantas vendas vão mudar
--   (p_dry_run = true devolve a conta sem alterar nada).
--
-- Quem pode usar: só a equipe da feira, e só nos produtos da própria feira.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================

create or replace function public.apply_costs_from(
  p_vendor_id bigint,
  p_changes   jsonb,                    -- [{"variant_id":1,"cost_price":25.00}, ...]
  p_from      date,
  p_dry_run   boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje      date := (now() at time zone 'America/Bahia')::date;
  v_variantes int := 0;
  v_itens     int := 0;
  v_vazios    int := 0;
  v_pedidos   int := 0;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'Nenhuma mudança informada';
  end if;
  if jsonb_array_length(p_changes) > 500 then
    raise exception 'Muitas mudanças de uma vez';
  end if;
  -- Data no futuro não faz sentido (não há venda depois de hoje) e uma data
  -- absurda no passado costuma ser erro de digitação.
  if p_from is null or p_from > v_hoje or p_from < date '2020-01-01' then
    raise exception 'Data inválida';
  end if;

  -- ---- O que vai mudar (sempre calculado ANTES de alterar) ----
  with mudancas as (
    select (c->>'variant_id')::bigint            as variant_id,
           nullif(c->>'cost_price', '')::numeric as cost_price
    from jsonb_array_elements(p_changes) c
  ),
  -- Só variantes desta feira, e só custos válidos. Custo nulo é permitido:
  -- é a forma de dizer "não sei" (volta a segurar a margem, como no catálogo).
  validas as (
    select distinct on (m.variant_id) m.variant_id, round(m.cost_price, 2) as cost_price
    from mudancas m
    join public.market_product_variants pv on pv.id = m.variant_id
    join public.market_products pr on pr.id = pv.product_id
    where pr.vendor_id = p_vendor_id
      and (m.cost_price is null or m.cost_price >= 0)
    order by m.variant_id
  ),
  afetados as (
    select oi.order_id, oi.unit_cost
    from public.market_order_items oi
    join validas v on v.variant_id = oi.variant_id
    join public.market_orders o on o.id = oi.order_id
    where o.vendor_id = p_vendor_id
      and o.status <> 'cancelado'
      and (o.created_at at time zone 'America/Bahia')::date >= p_from
      and oi.unit_cost is distinct from v.cost_price
  )
  select
    (select count(*) from validas v
      join public.market_product_variants pv on pv.id = v.variant_id
      where pv.cost_price is distinct from v.cost_price),
    (select count(*) from afetados),
    (select count(*) from afetados where unit_cost is null),
    (select count(distinct order_id) from afetados)
  into v_variantes, v_itens, v_vazios, v_pedidos;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true, 'from', p_from,
      'variantes', v_variantes, 'itens', v_itens,
      'itens_vazios', v_vazios, 'pedidos', v_pedidos
    );
  end if;

  -- ---- 1) O catálogo passa a valer daqui em diante ----
  with mudancas as (
    select (c->>'variant_id')::bigint            as variant_id,
           nullif(c->>'cost_price', '')::numeric as cost_price
    from jsonb_array_elements(p_changes) c
  ),
  validas as (
    select distinct on (m.variant_id) m.variant_id, round(m.cost_price, 2) as cost_price
    from mudancas m
    join public.market_product_variants pv on pv.id = m.variant_id
    join public.market_products pr on pr.id = pv.product_id
    where pr.vendor_id = p_vendor_id
      and (m.cost_price is null or m.cost_price >= 0)
    order by m.variant_id
  )
  update public.market_product_variants pv
  set cost_price = v.cost_price
  from validas v
  where pv.id = v.variant_id
    and pv.cost_price is distinct from v.cost_price;

  -- ---- 2) E se reescreve nas vendas a partir da data escolhida ----
  with mudancas as (
    select (c->>'variant_id')::bigint            as variant_id,
           nullif(c->>'cost_price', '')::numeric as cost_price
    from jsonb_array_elements(p_changes) c
  ),
  validas as (
    select distinct on (m.variant_id) m.variant_id, round(m.cost_price, 2) as cost_price
    from mudancas m
    join public.market_product_variants pv on pv.id = m.variant_id
    join public.market_products pr on pr.id = pv.product_id
    where pr.vendor_id = p_vendor_id
      and (m.cost_price is null or m.cost_price >= 0)
    order by m.variant_id
  )
  update public.market_order_items oi
  set unit_cost = v.cost_price
  from validas v, public.market_orders o
  where v.variant_id = oi.variant_id
    and o.id = oi.order_id
    and o.vendor_id = p_vendor_id
    and o.status <> 'cancelado'
    and (o.created_at at time zone 'America/Bahia')::date >= p_from
    and oi.unit_cost is distinct from v.cost_price;

  return jsonb_build_object(
    'dry_run', false, 'from', p_from,
    'variantes', v_variantes, 'itens', v_itens,
    'itens_vazios', v_vazios, 'pedidos', v_pedidos
  );
end;
$$;

revoke all on function public.apply_costs_from(bigint, jsonb, date, boolean) from public;
grant execute on function public.apply_costs_from(bigint, jsonb, date, boolean) to authenticated;

comment on function public.apply_costs_from(bigint, jsonb, date, boolean) is
  'Grava novos custos no catálogo e os reescreve nas vendas a partir de p_from. Substitui o que já existe (ao contrário de fill_missing_costs, que só preenche vazios). p_dry_run devolve a conta do que mudaria, sem alterar nada.';
