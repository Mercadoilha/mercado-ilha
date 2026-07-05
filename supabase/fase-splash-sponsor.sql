-- ============================================================
-- Fase Splash — Slot de patrocinador na tela de abertura (PWA)
-- ============================================================
-- Objetivo: permitir um banner "Oferecido por…" na cortina de
-- abertura do app instalado (PWA). Reaproveita a tabela banners.
--
-- Adiciona a posição 'splash' à restrição de position. O resto
-- do fluxo (active, sort_order, valid_from/until, link_url) já
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
  check (position in ('home', 'listado', 'splash'));

-- ============================================================
-- FIN
-- ============================================================
