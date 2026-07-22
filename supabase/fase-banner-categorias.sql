-- ============================================================
-- Fase Banner Categorias — Posição própria para a publicidade
-- da tela de Categorias (administrada separadamente do Início)
-- ============================================================
-- Objetivo: permitir gerir a publicidade da tela /categorias de
-- forma independente da tela inicial (home). Reaproveita a tabela
-- banners, adicionando a posição 'categorias' à restrição.
--
-- O resto do fluxo (active, sort_order, link_url, rotação) já
-- existe e funciona igual aos demais banners.
--
-- Como rodar:
--   Supabase → SQL Editor → New query → colar TUDO → Run.
--   É idempotente: pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

alter table public.banners
  drop constraint if exists banners_position_check;

alter table public.banners
  add constraint banners_position_check
  check (position in ('home', 'listado', 'splash', 'categorias'));

-- ============================================================
-- FIN
-- ============================================================
