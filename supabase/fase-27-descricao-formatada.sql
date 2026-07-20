-- Fase 27 — Descrição com formatação (negrito, itálico, sublinhado e listas)
-- Cómo correrlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Es seguro correrlo con la app en producción: solo agrega una columna nueva y
-- opcional (nullable) que el código viejo ignora. Se puede correr más de una vez.
--
-- La descripción sigue guardándose como texto plano en `description` (búsqueda y
-- preview del feed intactos). El formato viaja aparte en `description_rich`, como
-- HTML acotado y seguro (solo <strong>/<em>/<u>/<ul>/<li>/<br>), saneado por la app
-- tanto al escribir como al mostrar.

alter table public.listings
  add column if not exists description_rich text;

-- Verificación rápida (debería listar la columna nueva):
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'listings'
--     and column_name = 'description_rich';
