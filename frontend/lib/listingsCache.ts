// Caché de sesión para /listings (T6 del plano de otimização):
//   - resultados por clave de filtros (stale-while-revalidate + LRU)
//   - posición de scroll por clave (restaurar al volver del detalle)
//   - estado de filtros (sort/condición/zona) por "baseKey" de URL, para que
//     volver del detalle restaure la selección aunque la página remonte.
// Mismo espíritu que lib/profileCache.ts (ya aprobado en el proyecto).

export type ListingsCacheEntry = { data: any[]; ts: number };

// TTL corto: pasado esto, no se muestra el caché sin spinner (evita datos muy viejos).
export const LISTINGS_RESULTS_TTL = 3 * 60 * 1000; // 3 min
const MAX_KEYS = 10;

const results = new Map<string, ListingsCacheEntry>();

export function getListingsCache(key: string): ListingsCacheEntry | null {
  const e = results.get(key);
  if (!e) return null;
  // LRU: reposicionar al final como "usado recientemente".
  results.delete(key);
  results.set(key, e);
  return e;
}

export function setListingsCache(key: string, data: any[]): void {
  results.delete(key);
  results.set(key, { data, ts: Date.now() });
  while (results.size > MAX_KEYS) {
    const oldest = results.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
}

// --- Scroll por clave ---
const scrolls = new Map<string, number>();

export function saveScroll(key: string, y: number): void {
  scrolls.set(key, y);
}

export function getScroll(key: string): number {
  return scrolls.get(key) ?? 0;
}

// --- Estado de filtros por baseKey (categoría|q|subcategoría) ---
export type FilterUi = { sortBy: string; conditionFilter: string; zoneFilter: number | null };

const filterUi = new Map<string, FilterUi>();

export function saveFilterUi(baseKey: string, ui: FilterUi): void {
  filterUi.set(baseKey, ui);
}

export function getFilterUi(baseKey: string): FilterUi | null {
  return filterUi.get(baseKey) ?? null;
}
