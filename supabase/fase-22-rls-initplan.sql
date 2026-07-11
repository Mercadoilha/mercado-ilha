-- ============================================================
-- Fase 22 — RLS con InitPlan + scoping por rol (plan V3, T3)
-- ============================================================
-- ⚠️ ZONA DELICADA (seguridad / LGPD). Leer antes de correr.
--
-- Objetivo: que el COSTO de RLS por query NO crezca linealmente con
-- la cantidad de filas. Patrón recomendado por Supabase:
--   1) Envolver las funciones de auth en (select ...) para que el
--      planner las evalúe UNA sola vez como InitPlan, no por fila:
--        auth.uid()          → (select auth.uid())
--        public.is_admin()   → (select public.is_admin())
--   2) Restringir con 'to authenticated' las políticas que solo
--      aplican a usuarios logueados, para que los visitantes anónimos
--      NO las evalúen.
--
-- Alcance (SOLO estas 4 tablas de tráfico caliente):
--   listings, listing_photos, listing_service_zones, favorites.
-- NO se tocan: profiles, get_seller_whatsapp, ni tablas admin-only.
--
-- Qué NO cambia de comportamiento (matriz de seguridad):
--   - Anónimo: ve SOLO anuncios status='active' (y sus fotos/zonas);
--     NO ve paused/expired/hidden/blocked; no puede escribir nada.
--   - Dueño logueado: ve TODOS sus anuncios (cualquier estado) +
--     todos los activos ajenos; edita/borra solo lo suyo; favoritos
--     propios operables.
--   - Admin: sigue viendo y gestionando todo.
--   Las políticas 'public read' (status='active' / true) quedan
--   IGUAL: siguen aplicando a todos los roles (incluido anon).
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Idempotente (drop policy if exists + create). Al final hay un
--   bloque de ROLLBACK comentado para volver al estado anterior.
--
-- Verificación sugerida (SQL Editor, "Impersonate role"):
--   Como anon:   select count(*) from listings;  -- solo activos
--   Como user:   select count(*) from listings;  -- activos + propios
--   explain analyze de la query default → auth.uid()/is_admin()
--   deben aparecer como InitPlan (1 vez), no en el filtro por fila.
-- ============================================================


-- ------------------------------------------------------------
-- LISTINGS
-- ------------------------------------------------------------
-- public read: SIN role clause (aplica a anon + authenticated).
-- Comparación barata, no se envuelve.
drop policy if exists "Listings public read" on public.listings;
create policy "Listings public read" on public.listings
  for select using (status = 'active');

-- owner read: solo authenticated; anon deja de evaluarla.
drop policy if exists "Listings owner read" on public.listings;
create policy "Listings owner read" on public.listings
  for select to authenticated
  using (user_id = (select auth.uid()));

-- admin read: solo authenticated.
drop policy if exists "Listings admin read" on public.listings;
create policy "Listings admin read" on public.listings
  for select to authenticated
  using ((select public.is_admin()));

-- insert / update / delete: solo authenticated.
drop policy if exists "Listings insert" on public.listings;
create policy "Listings insert" on public.listings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Listings update" on public.listings;
create policy "Listings update" on public.listings
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Listings delete" on public.listings;
create policy "Listings delete" on public.listings
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));


-- ------------------------------------------------------------
-- LISTING_PHOTOS
-- ------------------------------------------------------------
-- public read queda igual (fotos son públicas). El anon lee por acá.
drop policy if exists "Listing photos public read" on public.listing_photos;
create policy "Listing photos public read" on public.listing_photos
  for select using (true);

-- owner write (for all): solo authenticated; auth.uid()/is_admin()
-- envueltos y el subquery de listings usa el uid como InitPlan.
drop policy if exists "Listing photos owner write" on public.listing_photos;
create policy "Listing photos owner write" on public.listing_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = public.listing_photos.listing_id
        and (l.user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );


-- ------------------------------------------------------------
-- LISTING_SERVICE_ZONES
-- ------------------------------------------------------------
drop policy if exists "Listing service zones public read" on public.listing_service_zones;
create policy "Listing service zones public read" on public.listing_service_zones
  for select using (true);

drop policy if exists "Listing service zones owner write" on public.listing_service_zones;
create policy "Listing service zones owner write" on public.listing_service_zones
  for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = public.listing_service_zones.listing_id
        and (l.user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );


-- ------------------------------------------------------------
-- FAVORITES
-- ------------------------------------------------------------
drop policy if exists "Favorites owner read" on public.favorites;
create policy "Favorites owner read" on public.favorites
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Favorites owner insert" on public.favorites;
create policy "Favorites owner insert" on public.favorites
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "Favorites owner delete" on public.favorites;
create policy "Favorites owner delete" on public.favorites
  for delete to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Favorites admin manage" on public.favorites;
create policy "Favorites admin manage" on public.favorites
  for all to authenticated
  using ((select public.is_admin()));


-- ============================================================
-- ROLLBACK (recrea el estado anterior). Descomentar TODO y correr
-- solo si algo se rompió y hay que volver atrás.
-- ============================================================
-- -- LISTINGS
-- drop policy if exists "Listings public read" on public.listings;
-- create policy "Listings public read" on public.listings for select using (status = 'active');
-- drop policy if exists "Listings owner read" on public.listings;
-- create policy "Listings owner read" on public.listings for select using (user_id = auth.uid());
-- drop policy if exists "Listings admin read" on public.listings;
-- create policy "Listings admin read" on public.listings for select using (public.is_admin());
-- drop policy if exists "Listings insert" on public.listings;
-- create policy "Listings insert" on public.listings for insert with check (auth.uid() = user_id);
-- drop policy if exists "Listings update" on public.listings;
-- create policy "Listings update" on public.listings for update using (user_id = auth.uid() or public.is_admin());
-- drop policy if exists "Listings delete" on public.listings;
-- create policy "Listings delete" on public.listings for delete using (user_id = auth.uid() or public.is_admin());
-- -- LISTING_PHOTOS
-- drop policy if exists "Listing photos public read" on public.listing_photos;
-- create policy "Listing photos public read" on public.listing_photos for select using (true);
-- drop policy if exists "Listing photos owner write" on public.listing_photos;
-- create policy "Listing photos owner write" on public.listing_photos for all using (
--   exists (select 1 from public.listings l where l.id = public.listing_photos.listing_id and (l.user_id = auth.uid() or public.is_admin()))
-- );
-- -- LISTING_SERVICE_ZONES
-- drop policy if exists "Listing service zones public read" on public.listing_service_zones;
-- create policy "Listing service zones public read" on public.listing_service_zones for select using (true);
-- drop policy if exists "Listing service zones owner write" on public.listing_service_zones;
-- create policy "Listing service zones owner write" on public.listing_service_zones for all using (
--   exists (select 1 from public.listings l where l.id = public.listing_service_zones.listing_id and (l.user_id = auth.uid() or public.is_admin()))
-- );
-- -- FAVORITES
-- drop policy if exists "Favorites owner read" on public.favorites;
-- create policy "Favorites owner read" on public.favorites for select using (profile_id = auth.uid());
-- drop policy if exists "Favorites owner insert" on public.favorites;
-- create policy "Favorites owner insert" on public.favorites for insert with check (profile_id = auth.uid());
-- drop policy if exists "Favorites owner delete" on public.favorites;
-- create policy "Favorites owner delete" on public.favorites for delete using (profile_id = auth.uid() or public.is_admin());
-- drop policy if exists "Favorites admin manage" on public.favorites;
-- create policy "Favorites admin manage" on public.favorites for all using (public.is_admin());
-- ============================================================
-- FIN
-- ============================================================
