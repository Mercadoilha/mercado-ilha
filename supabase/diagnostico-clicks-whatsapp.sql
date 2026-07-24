-- ============================================================
-- Diagnóstico — de dónde salen los clicks de WhatsApp
-- ============================================================
-- Sirve para entender por qué el contador del panel muestra un
-- número más alto de lo esperado. NO modifica ni borra nada:
-- es solo una consulta de lectura.
--
-- Cómo correrlo:
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--
-- Qué devuelve, una fila por anuncio (o por tipo de botón):
--   onde        → título del anuncio, o el botón si no es un anuncio
--                 ("Fale conosco" del banner, contacto desde una loja…)
--   clicks      → cuántas veces se apretó el botón
--   aparelhos   → cuántos celulares/navegadores DISTINTOS lo apretaron
--                 (si son 1 o 2 con muchos clicks → son pruebas)
--   primeiro    → fecha del primer click
--   ultimo      → fecha del último click
-- ============================================================

select
  coalesce(l.title, '⚙️ botão: ' || wc.context)   as onde,
  count(*)                                        as clicks,
  count(distinct wc.visitor_id)                   as aparelhos,
  min(wc.clicked_at)::date                        as primeiro,
  max(wc.clicked_at)::date                        as ultimo
from public.whatsapp_clicks wc
left join public.listings l on l.id = wc.listing_id
group by 1
order by 2 desc;
