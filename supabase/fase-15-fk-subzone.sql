-- Fase 15: Agregar FK listings.subzone_id → subzones.id
-- Ejecutar en Supabase SQL Editor.
--
-- Problema: listings.subzone_id no tenía FK declarada, por lo que
-- PostgREST no podía hacer join automático. Las cards mostraban
-- solo el nombre de la localidad padre (ej: "Colina de São Paulo")
-- en lugar de la sub-zona elegida (ej: "Mangaba").
--
-- Paso 1: limpiar subzone_id huérfanos para que el ALTER no falle
UPDATE public.listings
SET subzone_id = NULL
WHERE subzone_id IS NOT NULL
  AND subzone_id NOT IN (SELECT id FROM public.subzones);

-- Paso 2: agregar el FK con ON DELETE SET NULL (seguro)
ALTER TABLE public.listings
  ADD CONSTRAINT fk_listings_subzone_id
  FOREIGN KEY (subzone_id)
  REFERENCES public.subzones(id)
  ON DELETE SET NULL;
