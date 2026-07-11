// Caché de sesión para /listings (T6 del plano de otimização):
//   - resultados por clave de filtros (stale-while-revalidate + LRU)
//   - posición de scroll por clave (restaurar al volver del detalle)
//   - estado de filtros (sort/condición/zona) por "baseKey" de URL, para que
//     volver del detalle restaure la selección aunque la página remonte.
// Mismo espíritu que lib/profileCache.ts (ya aprobado en el proyecto).
//
// T10 (plan V2): además del Map en memoria, se espeja en sessionStorage para que
// /listings pinte al instante también tras una recarga completa (F5). El Map se
// hidrata una sola vez, perezosamente, en el primer acceso (antes del primer render,
// porque page.tsx/ListingsClient lo leen sincrónico). Solo se persisten datos públicos
// (query anónima de listings), NADA derivado de la sesión del usuario.
//
// T7 (plan V3): la persistencia se parte en DOS claves de sessionStorage para sacar la
// serialización grande del camino del click:
//   - mi_listings_meta_v2  → scrolls + filterUi. Diminuto: se escribe SYNC en el click
//     (saveScroll ocurre en la fase de captura, antes de navegar al detalle).
//   - mi_listings_results_v2 → los resultados (hasta ~200 kB). Se marca "sucio" y se
//     escribe FUERA del camino de interacción vía requestIdleCallback (fallback
//     setTimeout 500ms), con flush garantizado en visibilitychange=hidden y pagehide
//     (ambos, por iOS). Durante la navegación SPA detalle↔back el Map en memoria alcanza;
//     sessionStorage solo se lee al hidratar (documento nuevo: F5 / reapertura del PWA),
//     siempre precedido por un pagehide que flushea. Así el JSON.stringify grande nunca
//     cae en el task del tap sobre una card.

import { DEFAULT_LISTINGS_KEY, PAGE_SIZE } from "./listingsApi";

// relaxed: la búsqueda no encontró anuncios con TODAS las palabras y se
// muestran coincidencias parciales (ver fallback en app/listings/page.tsx).
// hasMore (T4): quedan más anuncios que los que trae `data` → mostrar
// "Carregar mais". `data` es el ACUMULADO de todas las páginas cargadas.
export type ListingsCacheEntry = { data: any[]; ts: number; relaxed?: boolean; hasMore?: boolean };

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

// --- Persistencia en sessionStorage (T10 + T7) ---
// T7: claves separadas. META es chica y se escribe sync; RESULTS es grande y diferida.
const META_SS = "mi_listings_meta_v2"; // scrolls + filterUi (chico)
const RESULTS_SS = "mi_listings_results_v2"; // resultados (grande)
const OLD_SS_V1 = "mi_listings_cache_v1"; // clave monolítica anterior → migrar (borrar)
const PERSIST_KEYS = 4; // solo las últimas N claves de resultados (las más recientes por LRU)
const MAX_CHARS = 200 * 1024; // guarda de serialización (~200 kB): más grande no se persiste

type ResultsShape = { results: [string, ListingsCacheEntry][] };
type MetaShape = { scrolls: [string, number][]; filterUi: [string, FilterUi][] };

let hydrated = false;

// Hidrata los tres Map desde sessionStorage una sola vez. Se marca `hydrated`
// aunque falle, para no reintentar en cada get. No pisa entradas ya presentes en
// memoria (las de la sesión viva mandan sobre las persistidas). También registra los
// listeners de flush y borra la clave monolítica v1 (migración T7).
function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  ensureFlushListeners();
  // T7: la clave v1 (resultados+meta juntos) ya no se usa; su TTL corto la vuelve
  // irrelevante. Borrarla para no dejar basura ni re-serializarla nunca más.
  try { sessionStorage.removeItem(OLD_SS_V1); } catch { /* ignorar */ }

  // Meta (scrolls + filterUi): clave chica.
  try {
    const raw = sessionStorage.getItem(META_SS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MetaShape>;
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
    }
  } catch {
    // JSON inválido / storage no disponible: seguir con los Map en memoria.
  }

  // Resultados: clave grande.
  try {
    const raw = sessionStorage.getItem(RESULTS_SS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ResultsShape>;
      if (Array.isArray(p.results)) {
        for (const [k, e] of p.results) {
          if (typeof k === "string" && e && Array.isArray(e.data) && typeof e.ts === "number" && !results.has(k)) {
            results.set(k, e);
          }
        }
      }
    }
  } catch {
    // JSON inválido / storage no disponible: seguir con el Map en memoria.
  }
}

// T4: a sessionStorage se persiste SOLO la primera página de cada clave (el
// acumulado de "Carregar mais" puede superar el tope de 200 kB). Si había más de
// una página cargada, se fuerza hasMore=true para que tras un F5 reaparezca el
// botón y las páginas extra se re-pidan por cursor. El Map en memoria (sesión viva)
// conserva el acumulado completo → volver del detalle restaura todo.
function capEntry([k, e]: [string, ListingsCacheEntry]): [string, ListingsCacheEntry] {
  if (e.data.length <= PAGE_SIZE) return [k, e];
  return [k, { ...e, data: e.data.slice(0, PAGE_SIZE), hasMore: true }];
}

// --- Persistencia de META (chica, síncrona) ---
// scrolls y filterUi son diminutos: se pueden escribir en el camino del click sin costo
// perceptible. Es lo que necesita estar en disco ANTES de navegar al detalle.
function persistMeta(): void {
  if (typeof window === "undefined") return;
  try {
    const payload: MetaShape = {
      scrolls: Array.from(scrolls.entries()),
      filterUi: Array.from(filterUi.entries()),
    };
    sessionStorage.setItem(META_SS, JSON.stringify(payload));
  } catch {
    // quota llena / modo privado: ignorar, los Map en memoria siguen sirviendo.
  }
}

// --- Persistencia de RESULTS (grande, diferida) ---
// Serializa un snapshot acotado a sessionStorage. Los resultados grandes se recortan a
// las últimas PERSIST_KEYS claves (y a la primera página cada uno); si aun así supera
// MAX_CHARS, se persiste solo la vista default; si sigue excediendo, no se persiste
// (degradar en silencio).
let resultsDirty = false;
let idleHandle: number | null = null;
let idleIsRIC = false;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function writeResultsNow(): void {
  if (typeof window === "undefined") return;
  resultsDirty = false;
  try {
    const build = (r: [string, ListingsCacheEntry][]): ResultsShape => ({ results: r });
    let payload = build(Array.from(results.entries()).slice(-PERSIST_KEYS).map(capEntry));
    let str = JSON.stringify(payload);
    if (str.length > MAX_CHARS) {
      const def = results.get(DEFAULT_LISTINGS_KEY);
      payload = build(def ? [capEntry([DEFAULT_LISTINGS_KEY, def])] : []);
      str = JSON.stringify(payload);
      if (str.length > MAX_CHARS) return; // aún grande: no persistir resultados
    }
    sessionStorage.setItem(RESULTS_SS, str);
  } catch {
    // quota llena / modo privado: ignorar, el Map en memoria sigue sirviendo.
  }
}

// Agenda la escritura grande fuera del camino de interacción: requestIdleCallback
// cuando existe (con timeout de 2s para que no se posponga indefinidamente), o
// setTimeout 500ms como fallback. Coalesce: si ya hay una agendada, solo marca dirty.
function scheduleResultsWrite(): void {
  if (typeof window === "undefined") return;
  resultsDirty = true;
  if (idleHandle !== null) return;
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === "function") {
    idleIsRIC = true;
    idleHandle = w.requestIdleCallback(() => {
      idleHandle = null;
      if (resultsDirty) writeResultsNow();
    }, { timeout: 2000 });
  } else {
    idleIsRIC = false;
    idleHandle = window.setTimeout(() => {
      idleHandle = null;
      if (resultsDirty) writeResultsNow();
    }, 500) as unknown as number;
  }
}

function cancelScheduled(): void {
  if (idleHandle === null || typeof window === "undefined") return;
  const w = window as IdleWindow;
  if (idleIsRIC && typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleHandle);
  else if (!idleIsRIC) clearTimeout(idleHandle);
  idleHandle = null;
}

// Flush garantizado: cancela lo agendado y escribe YA si quedó algo sucio.
function flushResults(): void {
  cancelScheduled();
  if (resultsDirty) writeResultsNow();
}

// Registra (una sola vez) el flush garantizado ANTES de que el navegador congele o
// descargue la página. pagehide + visibilitychange(hidden) cubren iOS (donde
// beforeunload no es fiable) y el paso a segundo plano del PWA. beforeunload NO se usa
// a propósito. Se flushea también la meta por las dudas (es barata).
let flushListenersReady = false;
function ensureFlushListeners(): void {
  if (flushListenersReady || typeof window === "undefined") return;
  flushListenersReady = true;
  const onHide = () => { persistMeta(); flushResults(); };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
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

export function setListingsCache(key: string, data: any[], relaxed = false, hasMore = false): void {
  hydrateOnce();
  results.delete(key);
  results.set(key, { data, ts: Date.now(), relaxed, hasMore });
  while (results.size > MAX_KEYS) {
    const oldest = results.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
  // T7: la escritura grande va diferida, nunca en el camino del click.
  scheduleResultsWrite();
}

// --- Scroll por clave ---
const scrolls = new Map<string, number>();

export function saveScroll(key: string, y: number): void {
  hydrateOnce();
  scrolls.set(key, y);
  // T7: solo la clave meta (chica) → barato en la fase de captura del click.
  persistMeta();
}

export function getScroll(key: string): number {
  hydrateOnce();
  return scrolls.get(key) ?? 0;
}

// --- Estado de filtros por baseKey (categoría|q|subcategoría) ---
export type FilterUi = { sortBy: string; conditionFilter: string; zoneFilter: number | null };

const filterUi = new Map<string, FilterUi>();

export function saveFilterUi(baseKey: string, ui: FilterUi): void {
  hydrateOnce();
  filterUi.set(baseKey, ui);
  persistMeta();
}

export function getFilterUi(baseKey: string): FilterUi | null {
  hydrateOnce();
  return filterUi.get(baseKey) ?? null;
}
