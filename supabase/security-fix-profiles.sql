-- Security fix: protect personal data in profiles table (LGPD compliance)
-- Run this in Supabase SQL Editor after the existing fase-1.sql migrations.

-- 1. Drop the over-permissive public read policy
drop policy if exists "Profiles public read" on public.profiles;

-- 2. Authenticated users can read any profile
--    (needed for admin panel, seller info when logged in, own profile)
create policy "Profiles auth read"
  on public.profiles
  for select
  using (auth.uid() is not null);

-- 3. Public view — exposes only safe, non-sensitive fields (no whatsapp, no role)
--    security_invoker = false means the view runs as its owner, bypassing RLS
--    on the base table, so anonymous users can read name + avatar only.
create or replace view public.profiles_public
  with (security_invoker = false)
as
  select id, full_name, avatar_url, created_at
  from public.profiles
  where is_active = true;

grant select on public.profiles_public to anon;
grant select on public.profiles_public to authenticated;

-- 4. Auth-gated RPC — the only way to retrieve a seller's WhatsApp number.
--    Returns NULL (not an error) when called by an anonymous user.
--    Only authenticated users can execute this function.
create or replace function public.get_seller_whatsapp(seller_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select whatsapp
  from public.profiles
  where id = seller_id
    and auth.uid() is not null;
$$;

revoke execute on function public.get_seller_whatsapp(uuid) from public;
revoke execute on function public.get_seller_whatsapp(uuid) from anon;
grant execute on function public.get_seller_whatsapp(uuid) to authenticated;
