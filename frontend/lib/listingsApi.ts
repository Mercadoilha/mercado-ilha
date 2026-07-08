// Fuente única de la query de la lista de anuncios (T2 del plan de optimización V2).
// La página /listings y el prewarm del home importan de acá el mismo select y la
// misma query default → cero drift entre lo que la página cachea y lo que el home
// pre-calienta.

import { supabase } from "./supabaseClient";

// 1 foto por anúncio (a primeira por sort_order); localidade para o card.
// subzones NÃO é usado pelo card. Debe coincidir con el select de app/listings/page.tsx.
export const LISTINGS_SELECT =
  "id, title, price, price_text, condition, locality_id, subzone_id, category_id, subcategory_id, created_at, listing_photos(photo_url, sort_order), localities(name)";

// Clave del caché de resultados para la vista default de /listings (sin categoría,
// búsqueda, subcategoría, condición ni zona). Coincide con `cacheKey` de la página
// cuando todos los filtros están vacíos: baseKey "||" + "|" + "" (condición) + "|" +
// "" (zona) = "||||".  NO hardcodear este string en otro lado: importarlo de acá.
export const DEFAULT_LISTINGS_KEY = "||||";

// Query default de /listings: anuncios activos, 1 foto por anuncio, orden
// created_at desc, límite 60. Replica EXACTAMENTE lo que hace decorate() en la
// página sin filtros (words vacío, sin condición, sin zona, sin categoría).
export async function fetchDefaultListings(): Promise<any[]> {
  const { data } = await supabase
    .from("listings")
    .select(LISTINGS_SELECT)
    .order("sort_order", { referencedTable: "listing_photos" })
    .limit(1, { referencedTable: "listing_photos" })
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  return data ?? [];
}
