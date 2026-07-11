// Fuente única de la query de la lista de anuncios (T2 del plan de optimización V2).
// La página /listings y el prewarm del home importan de acá el mismo select y la
// misma query default → cero drift entre lo que la página cachea y lo que el home
// pre-calienta.

import { supabase } from "./supabaseClient";

// 1 foto por anúncio (a primeira por sort_order); localidade para o card.
// subzones NÃO é usado pelo card. Debe coincidir con el select de app/listings/page.tsx.
export const LISTINGS_SELECT =
  "id, title, price, price_text, condition, locality_id, subzone_id, category_id, subcategory_id, created_at, listing_photos(photo_url, sort_order), localities(name)";

// Tamaño de página de /listings y de la tienda (T4 del plan V3). Antes hardcodeado
// como 60 en varios lados; ahora se importa de acá para que el corte, el seed ISR y
// el "Carregar mais" usen el mismo número.
export const PAGE_SIZE = 60;

// Cursor keyset para paginar "Carregar mais": el último anuncio mostrado. La página
// siguiente pide los MÁS VIEJOS que este (created_at desc, id desc como desempate),
// de forma estable aunque entren anuncios nuevos arriba mientras se pagina.
export type ListingCursor = { created_at: string; id: number } | null;

export function cursorFromLast(items: any[]): ListingCursor {
  if (!items.length) return null;
  const last = items[items.length - 1];
  if (!last?.created_at || last.id == null) return null;
  return { created_at: last.created_at, id: last.id };
}

// Aplica el cursor keyset a una query de listings ya ordenada por (created_at desc,
// id desc): trae filas con created_at menor, o con el mismo created_at pero id menor
// (desempate). Con cursor null no cambia nada (primera página).
export function applyKeysetCursor(q: any, cursor: ListingCursor): any {
  if (!cursor) return q;
  return q.or(
    `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
  );
}

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
    .order("id", { ascending: false }) // desempate estable para el keyset (T4)
    .limit(PAGE_SIZE);
  return data ?? [];
}
