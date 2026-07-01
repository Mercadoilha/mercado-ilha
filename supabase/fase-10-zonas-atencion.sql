-- FASE 10 — Zonas de atención múltiples por categoría
-- Ejecutar en Supabase SQL Editor.
--
-- Contexto: las categorías cuya prestadora se TRASLADA al cliente deben permitir
-- elegir varias sub-zonas (no una sola ni obligatoriamente "toda a ilha"). Esas
-- categorías usan location_type = 'zonas_de_atencion' y persisten sus zonas en la
-- tabla public.listing_service_zones (ya existente desde fase-1.sql).

-- 1) Convertir a 'zonas_de_atencion' las categorías que prestan servicio a domicilio/obra.
--    (Las ya existentes en zonas_de_atencion no se tocan: servicios-do-lar,
--     transporte-de-mercaderia, mobilidade-e-transportes, beleza-e-bem-estar.)
update public.categories
set location_type = 'zonas_de_atencion'
where slug in (
  'gas',
  'babas',
  'fotografia-e-social-media',  -- ⚠️ categoría eliminada de la app el 2026-06-24 (no borrar esta línea: es registro histórico de la migración)
  'consertos',
  'construcao-e-reformas',
  'bioconstrucao',
  'saude'
);

-- 2) Permitir locality_id nulo en listings: un servicio que atiende "toda a ilha"
--    no necesita una localidad base. (Las categorías 'fija' siguen exigiéndola en la app.)
alter table public.listings
  alter column locality_id drop not null;

-- 3) Índices para el filtro por zona de atención (joins sobre listing_service_zones).
create index if not exists ix_lsz_subzone on public.listing_service_zones(subzone_id);
create index if not exists ix_lsz_listing on public.listing_service_zones(listing_id);

-- Verificación rápida (opcional):
-- select slug, location_type from public.categories where location_type = 'zonas_de_atencion' order by sort_order;
