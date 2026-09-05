-- ============================================================
-- Fase 38 — Quanto espaço a base está usando (só para o dono)
-- ============================================================
-- Um número que hoje só se vê entrando no painel do Supabase: quanto
-- do espaço disponível a base já ocupa, e quais tabelas pesam mais.
-- Fica visível no /admin, e só para o dono do app (is_admin).
--
-- Não é uma métrica de produto: é manutenção. Serve para enxergar
-- com meses de antecedência se algo começa a crescer demais.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================

create or replace function public.get_db_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_total bigint;
  v_tables jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão';
  end if;

  select pg_database_size(current_database()) into v_total;

  -- As 8 tabelas mais pesadas (dados + índices), para saber onde olhar.
  select jsonb_agg(t) into v_tables
  from (
    select
      c.relname                              as nome,
      pg_total_relation_size(c.oid)          as bytes,
      coalesce(s.n_live_tup, 0)              as linhas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s on s.relid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
    limit 8
  ) t;

  return jsonb_build_object(
    'total_bytes', v_total,
    -- Teto do plano gratuito do Supabase (500 MB). Se um dia o plano mudar,
    -- é só trocar este número.
    'limit_bytes', 524288000::bigint,
    'tables', coalesce(v_tables, '[]'::jsonb),
    'measured_at', now()
  );
end;
$$;

revoke all on function public.get_db_usage() from public;
grant execute on function public.get_db_usage() to authenticated;
