// Caché de sesión para /listings (T6 del plano de otimização):
//   - resultados por clave de filtros (stale-while-revalidate + LRU)
//   - posición de scroll por clave (restaurar al volver del detalle)
//   - estado de filtros (sort/condición/zona) por "baseKey" de URL, para que
//     volver del detalle restaure la selección aunque la página remonte.
// Mismo espíritu que lib/profileCache.ts (ya aprobado en el proyecto).
//
// T10 (plan V2): además del Map en memoria, se espeja en sessionStorage
// (mi_listings_cache_v1) para que /listings pinte al instante también tras una
// recarga completa (F5). El Map se hidrata una sola vez, perezosamente, en el
// primer acceso (antes del primer render, porque page.tsx lo lee sincrónico).
// Solo se persisten datos públicos (query anónima de listings), NADA derivado
// de la sesión del usuario.

import { DEFAULT_LISTINGS_KEY } from "./listingsApi";

// relaxed: la búsqueda no encontró anuncios con TODAS las palabras y se
// muestran coincidencias parciales (ver fallback en app/listings/page.tsx).
export type ListingsCacheEntry = { data: any[]; ts: number; relaxed?: boolean };

// Dos umbrales para el caché de resultados (T4 del plan V2):
//   - SOFT: dentro de esta ventana el caché es "fresco" (comportamiento previo).
//   - HARD: entre SOFT y HARD el caché AÚN se muestra (sin spinner) mientras se
//     revalida atrás con el indicador sutil "Atualizando…". Datos de hasta 30 min
//     son perfectamente mostrables; evita volver al spinner en cada reingreso.
//     Pasado HARD, sí se muestra el spinner (datos demasiado viejos).
export const LISTINGS_SOFT_TTL = 3 * 60 * 1000; // 3 min
export const LISTINGS_HARD_TTL = 30 * 60 * 1000; // 30 min
// Compat: el nombre anterior apunta al umbral soft; lo usa el prewarm del home
// (lib/listingsApi vía HomeClient) para decidir si re-calienta el listado default.
export const LISTINGS_RESULTS_TTL = LISTINGS_SOFT_TTL;
const MAX_KEYS = 10;

const results = new Map<string, ListingsCacheEntry>();

// --- Persistencia en sessionStorage (T10) ---
const SS_KEY = "mi_listings_cache_v1";
const PERSIST_KEYS = 4; // solo las últimas N claves de resultados (las más recientes por LRU)
const MAX_CHARS = 200 * 1024; // guarda de serialización (~200 kB): más grande no se persiste

type PersistShape = {
  results: [string, ListingsCacheEntry][];
  scrolls: [string, number][];
  filterUi: [string, FilterUi][];
};

let hydrated = false;

// Hidrata los tres Map desde sessionStorage una sola vez. Se marca `hydrated`
// aunque falle, para no reintentar en cada get. No pisa entradas ya presentes en
// memoria (las de la sesión viva mandan sobre las persistidas).
function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<PersistShape>;
    if (Array.isArray(p.results)) {
      for (const [k, e] of p.results) {
        if (typeof k === "string" && e && Array.isArray(e.data) && typeof e.ts === "number" && !results.has(k)) {
          results.set(k, e);
        }
      }
    }
    if (Array.isArray(p.scrolls)) {
      for (const [k, y] of p.scrolls) {
        if (typeof k === "string" && typeof y === "number" && !scrolls.has(k)) scrolls.set(k, y);
      }
    }
    if (Array.isArray(p.filterUi)) {
      for (const [k, ui] of p.filterUi) {
        if (typeof k === "string" && ui && !filterUi.has(k)) filterUi.set(k, ui as FilterUi);
      }
    }
  } catch {
    // JSON inválido / storage no disponible: seguir con el Map en memoria.
  }
}

// Serializa un snapshot acotado a sessionStorage. Los resultados grandes se
// recortan a las últimas PERSIST_KEYS claves; si aun así supera MAX_CHARS, se
// persiste solo la vista default; si sigue excediendo, no se persiste (degradar
// en silencio). scroll y filterUi son chicos y van completos.
function persist(): void {
  if (typeof window === "undefined") return;
  try {
    const scrollsArr = Array.from(scrolls.entries());
    const filterUiArr = Array.from(filterUi.entries());
    const build = (r: [string, ListingsCacheEntry][]): PersistShape => ({
      results: r,
      scrolls: scrollsArr,
      filterUi: filterUiArr,
    });

    let payload = build(Array.from(results.entries()).slice(-PERSIST_KEYS));
    let str = JSON.stringify(payload);
    if (str.length > MAX_CHARS) {
      const def = results.get(DEFAULT_LISTINGS_KEY);
      payload = build(def ? [[DEFAULT_LISTINGS_KEY, def]] : []);
      str = JSON.stringify(payload);
      if (str.length > MAX_CHARS) return; // aún grande: no persistir resultados
    }
    sessionStorage.setItem(SS_KEY, str);
  } catch {
    // quota llena / modo privado: ignorar, el Map en memoria sigue sirviendo.
  }
}

export function getListingsCache(key: string): ListingsCacheEntry | null {
  hydrateOnce();
  const e = results.get(key);
  if (!e) return null;
  // LRU: reposicionar al final como "usado recientemente".
  results.delete(key);
  results.set(key, e);
  return e;
}

export function setListingsCache(key: string, data: any[], relaxed = false): void {
  hydrateOnce();
  results.delete(key);
  results.set(key, { data, ts: Date.now(), relaxed });
  while (results.size > MAX_KEYS) {
    const oldest = results.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
  persist();
}

// --- Scroll por clave ---
const scrolls = new Map<string, number>();

export function saveScroll(key: string, y: number): void {
  scrolls.set(key, y);
  persist();
}

export function getScroll(key: string): number {
  hydrateOnce();
  return scrolls.get(key) ?? 0;
}

// --- Estado de filtros por baseKey (categoría|q|subcategoría) ---
export type FilterUi = { sortBy: string; conditionFilter: string; zoneFilter: number | null };

const filterUi = new Map<string, FilterUi>();

export function saveFilterUi(baseKey: string, ui: FilterUi): void {
  filterUi.set(baseKey, ui);
  persist();
}

export function getFilterUi(baseKey: string): FilterUi | null {
  hydrateOnce();
  return filterUi.get(baseKey) ?? null;
}
