-- ============================================================
-- FASE 17 — Destacar anúncio (bump al tope de la home)
-- ============================================================
-- El usuario puede "destacar" un anuncio propio desde su perfil
-- para empujarlo de vuelta al tope de la pantalla principal, como
-- si recién se hubiera publicado (simula el reposteo del grupo de
-- WhatsApp). La home ordena los "Anúncios destacados" por bumped_at.
--
-- Reglas:
--   • Solo el dueño, solo anuncios activos.
--   • Cooldown: 1 vez cada 15 minutos por anuncio.
--   • Destacar renueva la validez 30 días (equivale a republicar).
--   • created_at NO se toca (sigue veraz para "publicado há X dias").
--
-- Futuro (monetización): gatear bump_listing con verificación de
-- pago/crédito. La RPC es el único punto de entrada.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- ============================================================

-- 1) Columna de orden para la home. Default now() → los anuncios
--    nuevos siguen apareciendo arriba al crearse.
alter table public.listings
  add column if not exists bumped_at timestamptz not null default now();

-- Backfill: los anuncios existentes arrancan con su fecha de creación.
update public.listings set bumped_at = created_at where bumped_at is null or bumped_at <> created_at;

-- 2) Índice para que ordenar por bumped_at no afecte la velocidad
--    de la home (filtra status = 'active', ordena bumped_at desc).
create index if not exists listings_status_bumped_idx
  on public.listings (status, bumped_at desc);

-- 3) RPC: destacar un anuncio propio (con cooldown de 1 hora).
create or replace function public.bump_listing(_listing_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  _last timestamptz;
  _now  timestamptz := now();
begin
  -- Solo el dueño y solo si está activo. Lock de la fila.
  select bumped_at into _last
  from public.listings
  where id = _listing_id
    and user_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'not_allowed';
  end if;

  -- Cooldown: 1 vez cada 15 minutos.
  if _last is not null and _last > _now - interval '15 minutes' then
    raise exception 'cooldown';
  end if;

  update public.listings
  set bumped_at = _now,
      expires_at = _now + interval '30 days',
      deletion_warning_sent_at = null
  where id = _listing_id;

  return _now;
end;
$$;

revoke execute on function public.bump_listing(bigint) from public, anon;
grant execute on function public.bump_listing(bigint) to authenticated;

-- ============================================================
-- FIN
-- ============================================================
