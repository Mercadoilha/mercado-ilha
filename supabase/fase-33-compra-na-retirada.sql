-- ============================================================
-- Fase 33 — "Levei algo a mais na retirada"
-- ============================================================
-- O cliente faz o pedido pelo app e, na sexta, na feira, acaba levando
-- mais alguma coisa. Esta fase deixa ele mesmo somar isso ao pedido,
-- para que "Meus pedidos" mostre o que ele realmente levou e gastou.
--
-- O que muda:
--   1) Cada renglón do pedido passa a saber se veio no pedido original
--      ou se foi acrescentado na retirada.
--   2) Duas funções novas, que só o dono do pedido pode usar: uma para
--      acrescentar itens, outra para tirar um item acrescentado por engano.
--
-- O item acrescentado pode ser do catálogo (o preço sai da base, não do
-- telefone) ou um item livre — o que se comprou na feira e não está na
-- lista, com nome e valor escritos pelo cliente.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================


-- ------------------------------------------------------------
-- 1) De onde veio cada item do pedido
-- ------------------------------------------------------------
alter table public.market_order_items
  add column if not exists added_at_pickup boolean not null default false;

comment on column public.market_order_items.added_at_pickup is
  'false = veio no pedido feito pelo app; true = o cliente acrescentou na hora da retirada.';


-- ------------------------------------------------------------
-- 2) Acrescentar itens a um pedido já feito
-- ------------------------------------------------------------
-- p_items:  [{"variant_id": 12, "quantity": 2}, ...]   → preço vem do catálogo
-- p_extras: [{"name": "Bolo de aipim", "quantity": 1, "unit_price": 15}, ...]
--
-- Só o dono do pedido consegue mexer nele (a função checa auth.uid()).
-- No fim recalcula o total do pedido e devolve o total novo.
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
  -- Dono do pedido, e só ele.
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

  -- Teto por chamada: evita que um erro (ou um abuso) encha o pedido.
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb))
     + jsonb_array_length(coalesce(p_extras, '[]'::jsonb)) > 20 then
    raise exception 'Muitos itens de uma vez';
  end if;

  -- a) Itens do catálogo: nome e preço saem da base.
  with pedido as (
    select (i->>'variant_id')::bigint as variant_id,
           (i->>'quantity')::numeric  as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  )
  insert into public.market_order_items
    (order_id, variant_id, product_name, variant_label, unit_label, unit_price, quantity, line_total, added_at_pickup)
  select
    p_order_id, pv.id, pr.name, pv.label, pv.unit_label, pv.price,
    ped.quantity, round(pv.price * ped.quantity, 2), true
  from pedido ped
  join public.market_product_variants pv on pv.id = ped.variant_id and pv.is_active
  join public.market_products pr on pr.id = pv.product_id and pr.vendor_id = v_vendor_id
  where ped.quantity > 0
    and ped.quantity <= 999
    and mod(ped.quantity::numeric, pv.step) = 0;

  get diagnostics v_n = row_count;
  v_added := v_added + v_n;

  -- b) Itens livres: o que se comprou na feira e não está no catálogo.
  --    Nome limitado a 80 caracteres e valor com teto — o texto entra como
  --    dado, nunca como comando (é uma inserção comum, sem SQL montado).
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
-- 3) Tirar um item acrescentado por engano
-- ------------------------------------------------------------
-- Só o dono, e só o que ELE acrescentou na retirada: o pedido feito pelo
-- app fica intacto (é o que a feira recebeu no WhatsApp).
create or replace function public.remove_pickup_item(p_item_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_total    numeric(10,2);
begin
  select oi.order_id into v_order_id
  from public.market_order_items oi
  join public.market_orders o on o.id = oi.order_id
  where oi.id = p_item_id
    and oi.added_at_pickup
    and o.user_id = auth.uid();

  if v_order_id is null then
    raise exception 'Item não encontrado';
  end if;

  delete from public.market_order_items where id = p_item_id;

  select coalesce(sum(line_total), 0) into v_total
  from public.market_order_items where order_id = v_order_id;

  update public.market_orders set total = v_total where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'total', v_total);
end;
$$;

revoke all on function public.remove_pickup_item(bigint) from public;
grant execute on function public.remove_pickup_item(bigint) to authenticated;
