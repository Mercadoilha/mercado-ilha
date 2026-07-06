// Caché de sesión para los favoritos del usuario (T8 del plano de otimização).
// Se carga UNA vez por sesión de navegación; los toggles actualizan el caché
// localmente para que sobrevivan al cambio de pantalla (listings ↔ detalle ↔ loja).
// El logout / cambio de usuario invalida el caché.

import { supabase } from "./supabaseClient";

let cache: { userId: string; ids: Set<number> } | null = null;
let inFlight: { userId: string; promise: Promise<Set<number>> } | null = null;

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
  if (cache && cache.userId === userId) cache.ids.add(listingId);
}

export function removeFavorite(userId: string, listingId: number): void {
  if (cache && cache.userId === userId) cache.ids.delete(listingId);
}

export function clearFavoritesCache(): void {
  cache = null;
  inFlight = null;
}
