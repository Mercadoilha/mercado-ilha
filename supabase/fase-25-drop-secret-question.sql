-- ============================================================================
-- FASE 25 — ELIMINAR CAMPOS MUERTOS DE "PERGUNTA SECRETA" (auditoría 2026-07-11, H8)
-- Las columnas secret_question / secret_answer se crearon en secret-question.sql
-- pero NINGÚN archivo del frontend ni RPC las usa (verificado por búsqueda).
-- Guardaban la respuesta en TEXTO PLANO; si tuvieran datos serían legibles.
-- La recuperación de senha hoy es por código al email (forgot-password/page.tsx).
--
-- Cómo correr: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Idempotente: se puede correr más de una vez sin problema.
-- ============================================================================

alter table public.profiles drop column if exists secret_question;
alter table public.profiles drop column if exists secret_answer;
