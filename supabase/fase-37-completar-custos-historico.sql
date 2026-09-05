-- ============================================================
-- Fase 37 — Completar o custo de vendas já feitas
-- ============================================================
-- Por que isto existe:
--   O custo viaja congelado dentro do pedido (fase-36) — e tem que ser assim,
--   senão mudar um custo hoje reescreveria o resultado de meses passados.
--   Só que isso cria um beco: o que foi vendido ANTES de a feira preencher os
--   custos fica sem custo para sempre, e o lucro daquele período nunca sai.
--
--   Esta função resolve o beco de um jeito honesto: preenche APENAS os buracos
--   (itens que ficaram sem custo nenhum), usando o custo que está hoje no
--   catálogo. Nunca toca num item que já tem custo gravado — o histórico real
--   segue intocado.
--
-- Quem pode usar: só a equipe da feira, e só nos pedidos da própria feira.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================

create or replace function public.fill_missing_costs(
  p_vendor_id bigint,
  p_from      date,
  p_to        date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itens int;
  v_resta int;
begin
  if not public.is_market_admin(p_vendor_id) then
    raise exception 'Sem permissão';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Período inválido';
  end if;

  -- Só os buracos: unit_cost nulo, item do catálogo, e a opção já tem custo hoje.
  update public.market_order_items oi
  set unit_cost = pv.cost_price
  from public.market_product_variants pv,
       public.market_orders o
  where pv.id = oi.variant_id
    and o.id = oi.order_id
    and o.vendor_id = p_vendor_id
    and (o.created_at at time zone 'America/Bahia')::date between p_from and p_to
    and oi.unit_cost is null
    and pv.cost_price is not null;

  get diagnostics v_itens = row_count;

  -- O que ainda fica de fora (opções que seguem sem custo no catálogo).
  select count(*) into v_resta
  from public.market_order_items oi
  join public.market_orders o on o.id = oi.order_id
  where o.vendor_id = p_vendor_id
    and (o.created_at at time zone 'America/Bahia')::date between p_from and p_to
    and oi.unit_cost is null
    and oi.variant_id is not null;

  return jsonb_build_object('preenchidos', v_itens, 'ainda_sem_custo', v_resta);
end;
$$;

revoke all on function public.fill_missing_costs(bigint, date, date) from public;
grant execute on function public.fill_missing_costs(bigint, date, date) to authenticated;
