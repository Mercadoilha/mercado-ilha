-- FASE 11 — Delivery con zonas de atención
-- Ejecutar en Supabase SQL Editor.
--
-- Delivery define las zonas A DONDE entrega. Pasa de 'fija' a 'zonas_de_atencion'
-- para que cada anuncio marque sus zonas de reparto (o "toda a ilha"), usando el
-- mismo selector que el resto de categorías que se trasladan al cliente.
-- has_delivery=true y el botón "Fazer pedido" no se modifican.

update public.categories
set location_type = 'zonas_de_atencion'
where slug = 'delivery';

-- Verificación (opcional):
-- select slug, location_type, has_delivery from public.categories where slug = 'delivery';
