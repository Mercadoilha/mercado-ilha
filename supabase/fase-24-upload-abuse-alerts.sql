-- ============================================================================
-- FASE 24 — AVISO DE USO ABUSIVO DE FOTOS (auditoría 2026-07-11, H7)
-- NO bloquea a nadie: solo cuenta cuántas fotos sube cada usuario por hora y,
-- si alguien cruza un umbral abusivo (60/hora), deja un registro para el admin
-- y dispara un email al admin (esto último lo hace el código de /api/upload).
--
-- Cómo correr: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Idempotente: se puede correr más de una vez sin problema.
-- ============================================================================

-- ── Tabla 1: upload_events ──────────────────────────────────────────────────
-- Un registro por cada foto subida. Solo sirve para contar subidas por hora.
-- RLS activo y SIN políticas: ningún usuario con sesión normal puede leerla ni
-- escribirla; solo el service role (el servidor, en /api/upload) la toca.
create table if not exists public.upload_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_upload_events_user_time
  on public.upload_events (user_id, created_at desc);
alter table public.upload_events enable row level security;

-- ── Tabla 2: upload_abuse_alerts ────────────────────────────────────────────
-- Un registro cuando un usuario cruza el umbral abusivo. Se muestra en /admin.
-- FK a profiles(id) para que el panel pueda mostrar el nombre del usuario.
create table if not exists public.upload_abuse_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_count int not null,
  window_start timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed boolean not null default false
);
create index if not exists idx_upload_abuse_alerts_time
  on public.upload_abuse_alerts (created_at desc);
alter table public.upload_abuse_alerts enable row level security;

-- El admin puede leer los avisos y marcarlos como vistos. Nadie más los ve.
-- (El service role los inserta salteando RLS.)
drop policy if exists "Abuse alerts admin read" on public.upload_abuse_alerts;
create policy "Abuse alerts admin read"
  on public.upload_abuse_alerts
  for select
  using (public.is_admin());

drop policy if exists "Abuse alerts admin update" on public.upload_abuse_alerts;
create policy "Abuse alerts admin update"
  on public.upload_abuse_alerts
  for update
  using (public.is_admin());
