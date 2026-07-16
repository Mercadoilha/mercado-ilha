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

// Reintento acotado. Las consultas normales viajan por GET y postgrest-js las
// reintenta solo por ser idempotentes (RETRYABLE_METHODS = GET/HEAD/OPTIONS);
// get_stores es una RPC → POST, así que se queda SIN esa red de contención: un
// tropiezo de red, o la renovación del token al abrir la app, llegaban a la
// pantalla como error duro en el primer toque. Solo se reintenta lo transitorio
// (fallo de red = status 0, 5xx, statement timeout); un error real de la base no
// se cura solo, así que se propaga en el acto. En el camino feliz no agrega nada.
const RETRY_DELAYS = [400, 1200];

function isTransient(status: number, code?: string): boolean {
  return status === 0 || status >= 500 || code === "57014";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

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

  for (let attempt = 0; ; attempt++) {
    let q = supabase.rpc("get_stores", {
      p_search: search.trim() || null,
      p_locality_id: localityId,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });
    if (signal) q = q.abortSignal(signal);

    const { data, error, status } = await q;
    if (!error) {
      return ((data ?? []) as any[]).map((s) => ({
        id: s.id,
        full_name: s.full_name,
        avatar_url: s.avatar_url ?? null,
        active_count: Number(s.active_count) || 0,
        locality_ids: (s.locality_ids ?? []).map((n: any) => Number(n)),
      }));
    }
    // Una consulta cancelada (búsqueda vieja, salida de la pantalla) también cae
    // acá con status 0: no es un fallo que valga la pena reintentar.
    if (signal?.aborted) throw error;
    if (attempt >= RETRY_DELAYS.length || !isTransient(status, error.code)) throw error;
    await sleep(RETRY_DELAYS[attempt], signal);
    if (signal?.aborted) throw error;
  }
}
