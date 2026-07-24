-- ─────────────────────────────────────────────────────────────
-- Banners: janela de exibição (data de início / data de fim)
-- ─────────────────────────────────────────────────────────────
-- As colunas já existiam no schema original (fase-1.sql), mas nunca foram usadas.
-- Este passo é idempotente: garante que existam em produção antes de o código
-- passar a filtrar por elas. Rodar uma vez no SQL Editor do Supabase.
--
-- Regra de exibição (aplicada no código, não aqui):
--   valid_from NULL  → começa já.
--   valid_until NULL → fica para sempre.
--   valid_until é INCLUSIVO: o banner aparece o dia todo e pausa no dia seguinte.

alter table public.banners add column if not exists valid_from  date;
alter table public.banners add column if not exists valid_until date;
