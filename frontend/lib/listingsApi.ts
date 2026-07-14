// Fuente única de la query de la lista de anuncios (T2 del plan de optimización V2).
// El select y los helpers de paginación keyset los comparten /listings y el feed del
// inicio (vía components/ListingsFeed) → cero drift entre las dos pantallas.

// 1 foto por anúncio (a primeira por sort_order); localidade para o card.
// subzones NÃO é usado pelo card. Debe coincidir con el select de app/listings/page.tsx.
export const LISTINGS_SELECT =
  "id, title, price, price_text, condition, locality_id, subzone_id, category_id, subcategory_id, created_at, listing_photos(photo_url, sort_order), localities(name)";

// Variante para el feed del inicio: mismo select + bumped_at, que es la columna de orden
// y de cursor keyset del feed. Se separa de LISTINGS_SELECT para no engordar los payloads
// de /listings, que ordena por created_at y no necesita bumped_at. (covers_all_island se
// usa solo como filtro server-side en el .or() de zona, no se trae como columna.)
export const LISTINGS_SELECT_BUMP = LISTINGS_SELECT + ", bumped_at";

// Tamaño de página de /listings y de la tienda (T4 del plan V3). Antes hardcodeado
// como 60 en varios lados; ahora se importa de acá para que el corte, el seed ISR y
// el "Carregar mais" usen el mismo número.
export const PAGE_SIZE = 60;

// Columna de orden del feed. /listings pagina por created_at; el feed del inicio por
// bumped_at (fecha de publicación/destaque). El cursor lleva la columna para que
// applyKeysetCursor arme el predicado correcto sin duplicar helpers.
export type OrderCol = "created_at" | "bumped_at";

// Cursor keyset para paginar "Carregar mais": el último anuncio mostrado. La página
// siguiente pide los MÁS VIEJOS que este (col desc, id desc como desempate), de forma
// estable aunque entren anuncios nuevos arriba mientras se pagina.
export type ListingCursor = { col: OrderCol; value: string; id: number } | null;

export function cursorFromLast(items: any[], col: OrderCol = "created_at"): ListingCursor {
  if (!items.length) return null;
  const last = items[items.length - 1];
  if (last?.[col] == null || last.id == null) return null;
  return { col, value: last[col], id: last.id };
}

// Aplica el cursor keyset a una query de listings ya ordenada por (col desc, id desc):
// trae filas con `col` menor, o con el mismo `col` pero id menor (desempate). Con cursor
// null no cambia nada (primera página).
export function applyKeysetCursor(q: any, cursor: ListingCursor): any {
  if (!cursor) return q;
  return q.or(
    `${cursor.col}.lt.${cursor.value},and(${cursor.col}.eq.${cursor.value},id.lt.${cursor.id})`,
  );
}

// Clave del caché de resultados para la vista default de /listings (sin categoría,
// búsqueda, subcategoría, condición ni zona). Coincide con `cacheKey` del feed cuando
// todos los filtros están vacíos (namespace "" + "||" + "|" + "" + "|" + "" = "||||").
// La usa lib/listingsCache como vista a preservar bajo presión de cuota. NO hardcodear
// este string en otro lado: importarlo de acá.
export const DEFAULT_LISTINGS_KEY = "||||";
