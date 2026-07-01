-- Fase 12: aviso de eliminación definitiva (día 14 de inactividad)
-- Permite que el cron de expiración (frontend/app/api/cron/expire-listings)
-- marque cuándo se envió el email de "mañana se elimina" para no duplicarlo,
-- y para poder resetearlo si el usuario reactiva el anúncio antes del día 15.

alter table public.listings
  add column if not exists deletion_warning_sent_at timestamptz;
