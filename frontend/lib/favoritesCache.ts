// Caché de sesión para los favoritos del usuario (T8 del plano de otimização).
// Se carga UNA vez por sesión de navegación; los toggles actualizan el caché
// localmente para que sobrevivan al cambio de pantalla (listings ↔ detalle ↔ loja).
// El logout / cambio de usuario invalida el caché.

import { supabase } from "./supabaseClient";

export type FavoriteRow = {
  id: number;
  listing_id: number;
  listings: any;
};

let cache: { userId: string; ids: Set<number> } | null = null;
let inFlight: { userId: string; promise: Promise<Set<number>> } | null = null;
let listCache: { userId: string; rows: FavoriteRow[] } | null = null;
let listInFlight: { userId: string; promise: Promise<FavoriteRow[] | null> } | null = null;
// Cuenta los toggles locales. Una consulta de la lista que salió ANTES de un toggle trae
// datos ya viejos: si al volver pisara el caché, reviviría el favorito recién sacado.
// Comparando la marca de antes/después, esa respuesta tardía se descarta.
let mutationEpoch = 0;

export function getCachedFavorites(userId: string): Set<number> | null {
  return cache && cache.userId === userId ? cache.ids : null;
}

export async function loadFavorites(userId: string): Promise<Set<number>> {
  if (cache && cache.userId === userId) return cache.ids;
  if (inFlight && inFlight.userId === userId) return inFlight.promise;
  const promise = (async () => {
    const { data } = await supabase.from("favorites").select("listing_id").eq("profile_id", userId);
    const ids = new Set<number>((data ?? []).map((f: any) => f.listing_id));
    cache = { userId, ids };
    inFlight = null;
    return ids;
  })();
  inFlight = { userId, promise };
  return promise;
}

export function addFavorite(userId: string, listingId: number): void {
  mutationEpoch++;
  if (cache && cache.userId === userId) cache.ids.add(listingId);
  // No podemos fabricar la fila (falta el anuncio embebido) → invalidamos la lista.
  // La próxima entrada a /favorites la trae de nuevo, cubierta por el prefetch del tap.
  if (listCache && listCache.userId === userId) listCache = null;
}

export function removeFavorite(userId: string, listingId: number): void {
  mutationEpoch++;
  if (cache && cache.userId === userId) cache.ids.delete(listingId);
  // Sacar la fila del caché de la lista lo deja completo y válido (sin refetch).
  if (listCache && listCache.userId === userId) {
    listCache = { userId, rows: listCache.rows.filter((r) => r.listing_id !== listingId) };
  }
}

export function clearFavoritesCache(): void {
  cache = null;
  inFlight = null;
  listCache = null;
  listInFlight = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista completa de favoritos (filas con el anuncio embebido) — la que pinta
// /favorites. Antes esa pantalla consultaba de cero en CADA entrada, con spinner
// bloqueante: era la única con favoritos/perfil/lojas ya cacheados o prefetcheados
// alrededor. Ahora: caché de sesión + stale-while-revalidate (entrada repetida =
// cero espera) y prefetch al tocar el botón (entrada fría = la query viaja en
// paralelo con la navegación, no en serie después del mount).
// ─────────────────────────────────────────────────────────────────────────────

// Debe coincidir con lo que pinta app/favorites/page.tsx (miniatura, precio,
// localidad, condição, estado).
const FAV_LIST_SELECT =
  "id, listing_id, listings(id, title, price, price_text, condition, status, locality_id, subzone_id, localities(name), listing_photos(photo_url, sort_order))";

// Lectura sincrónica: filas cacheadas de este usuario, o null si no hay.
export function getCachedFavoritesList(userId: string): FavoriteRow[] | null {
  return listCache && listCache.userId === userId ? listCache.rows : null;
}

// Trae la lista y la cachea (deduplicando vuelos en curso). Devuelve null si la
// consulta falla → el llamador conserva lo que ya tenía en pantalla en vez de
// vaciarla. De paso alinea el Set de ids, que sale gratis de las mismas filas.
export function loadFavoritesList(userId: string): Promise<FavoriteRow[] | null> {
  if (listInFlight && listInFlight.userId === userId) return listInFlight.promise;

  const epoch = mutationEpoch;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("favorites")
      .select(FAV_LIST_SELECT)
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      // T13 (plan V2): 1 foto por anuncio (la primera por sort_order). Sintaxis anidada
      // de dos niveles verificada contra la DB real (referencedTable con path punteado).
      .order("sort_order", { referencedTable: "listings.listing_photos" })
      .limit(1, { referencedTable: "listings.listing_photos" });

    listInFlight = null;
    if (error) return null;
    // Hubo un toggle mientras esto viajaba → la respuesta ya nació vieja: se descarta
    // (el toggle local dejó el caché correcto) y el llamador conserva lo que muestra.
    if (epoch !== mutationEpoch) return null;

    const rows = (data ?? []) as FavoriteRow[];
    listCache = { userId, rows };
    cache = { userId, ids: new Set<number>(rows.map((r) => r.listing_id)) };
    return rows;
  })();

  listInFlight = { userId, promise };
  return promise;
}

// Fire-and-forget al tocar el botón "Favoritos": arranca la query en paralelo con
// la navegación. Si ya hay caché, no hace nada — la pantalla revalida sola al montar.
export function prefetchFavoritesList(userId: string): void {
  if (!userId) return;
  if (listCache && listCache.userId === userId) return;
  void loadFavoritesList(userId);
}
