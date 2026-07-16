// Directorio de lojas (/lojas). Un único punto de acceso a la RPC get_stores
// (fase-26): trae en una sola consulta las tiendas con al menos 1 anuncio activo,
// su conteo de anuncios y las localidades donde tienen anuncios (para chips + filtro).

import { supabase } from "./supabaseClient";

export const LOJAS_PAGE_SIZE = 20;

export type StoreSort = "count" | "popular" | "name";

export type Store = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  active_count: number;
  locality_ids: number[];
};

export async function fetchStores(params: {
  search?: string;
  localityId?: number | null;
  sort?: StoreSort;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<Store[]> {
  const {
    search = "",
    localityId = null,
    sort = "count",
    limit = LOJAS_PAGE_SIZE,
    offset = 0,
    signal,
  } = params;

  let q = supabase.rpc("get_stores", {
    p_search: search.trim() || null,
    p_locality_id: localityId,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (signal) q = q.abortSignal(signal);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    avatar_url: s.avatar_url ?? null,
    active_count: Number(s.active_count) || 0,
    locality_ids: (s.locality_ids ?? []).map((n: any) => Number(n)),
  }));
}
