-- ============================================================================
-- FASE 23 — SEGURIDAD CRÍTICA (auditoría 2026-07-11)
-- Cierra tres agujeros graves:
--   H1: un usuario podía ascenderse a admin editando su propio perfil.
--   H3: cualquier usuario logueado podía leer los WhatsApp de todos los vendedores.
--   (H2 se arregla en el código, no aquí.)
--
-- Cómo correr: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Idempotente: se puede correr más de una vez sin problema.
-- ============================================================================

-- ── T1.0 — is_admin() con SECURITY DEFINER ─────────────────────────────────
-- Necesario para T1.2: la política de lectura de profiles va a llamar a is_admin(),
-- y como is_admin() lee profiles, sin security definer generaría recursión de RLS.
-- Con security definer lee profiles como dueño (saltea RLS) → corta la recursión.
-- Misma semántica de siempre: true si el usuario actual es admin.
create or replace function public.is_admin()
returns boolean
stable
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── T1.1 — Anti-escalada de privilegios (H1) ───────────────────────────────
-- Un trigger BEFORE UPDATE que, si quien edita NO es admin, restaura los valores
-- previos de role e is_active (los ignora en silencio). Los usuarios normales
-- editan nombre/whatsapp/avatar; esos campos no se tocan. El admin sí puede
-- cambiarlos porque is_admin() es true para él.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_fields();

-- ── T1.2 — Cerrar lectura de profiles / fuga de WhatsApp (H3) ───────────────
-- Cada usuario lee solo su propia fila; el admin lee todas. El nombre/avatar
-- públicos del vendedor siguen saliendo por la vista profiles_public y el
-- teléfono por la RPC get_seller_whatsapp (ambos ya usados por la app).
-- Se dropean por si acaso las dos políticas de lectura anteriores (la original
-- de fase-1 y la de security-fix), sea cual sea la que exista en la DB.
drop policy if exists "Profiles auth read" on public.profiles;
drop policy if exists "Profiles public read" on public.profiles;
create policy "Profiles self or admin read"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());
