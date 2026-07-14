// Caché de sesión para datos casi-estáticos usados por /listings (T7 del plano):
//   - catálogo de categorías (slug → id, name, icon): resuelve el slug sin RTT
//     en visitas repetidas, desarmando el primer escalón del waterfall.
//   - localidades activas para el filtro de zona.
// Módulo + espejo en sessionStorage con TTL. El admin revalida el home al editar
// categorías; aquí un TTL corto alcanza para no servir catálogos viejos.

import { supabase } from "./supabaseClient";

const TTL = 5 * 60 * 1000; // 5 min

export type CatalogCategory = { id: number; slug: string; name: string; icon: string | null };
export type CatalogLocality = { id: number; name: string };
export type CatalogSubcategory = { id: number; name: string };
export type CatalogSubzone = { id: number; name: string; locality_id: number };

type Cached<T> = { data: T; ts: number };

function readSS<T>(key: string): Cached<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return parsed as Cached<T>;
  } catch {
    return null;
  }
}

function writeSS<T>(key: string, value: Cached<T>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage lleno / modo privado: ignorar, el caché de módulo sigue sirviendo.
  }
}

// ---------------- Categorías ----------------
const CAT_SS = "mi_cat_catalog_v1";
let catMem: Cached<CatalogCategory[]> | null = null;
let catInFlight: Promise<CatalogCategory[]> | null = null;

export function getCategoriesSync(): CatalogCategory[] | null {
  const now = Date.now();
  if (catMem && now - catMem.ts < TTL) return catMem.data;
  const ss = readSS<CatalogCategory[]>(CAT_SS);
  if (ss && now - ss.ts < TTL) {
    catMem = ss;
    return ss.data;
  }
  return null;
}

export async function loadCategories(): Promise<CatalogCategory[]> {
  const sync = getCategoriesSync();
  if (sync) return sync;
  if (catInFlight) return catInFlight;
  catInFlight = (async () => {
    const { data } = await supabase.from("categories").select("id, slug, name, icon");
    const rows = (data ?? []) as CatalogCategory[];
    const entry = { data: rows, ts: Date.now() };
    catMem = entry;
    writeSS(CAT_SS, entry);
    catInFlight = null;
    return rows;
  })();
  return catInFlight;
}

// ---------------- Localidades ----------------
const LOC_SS = "mi_localities_v1";
let locMem: Cached<CatalogLocality[]> | null = null;
let locInFlight: Promise<CatalogLocality[]> | null = null;

export function getLocalitiesSync(): CatalogLocality[] | null {
  const now = Date.now();
  if (locMem && now - locMem.ts < TTL) return locMem.data;
  const ss = readSS<CatalogLocality[]>(LOC_SS);
  if (ss && now - ss.ts < TTL) {
    locMem = ss;
    return ss.data;
  }
  return null;
}

export async function loadLocalities(): Promise<CatalogLocality[]> {
  const sync = getLocalitiesSync();
  if (sync) return sync;
  if (locInFlight) return locInFlight;
  locInFlight = (async () => {
    const { data } = await supabase.from("localities").select("id, name").eq("is_active", true).order("sort_order");
    const rows = (data ?? []) as CatalogLocality[];
    const entry = { data: rows, ts: Date.now() };
    locMem = entry;
    writeSS(LOC_SS, entry);
    locInFlight = null;
    return rows;
  })();
  return locInFlight;
}

// ---------------- Sub-zonas (hoja Filtrar) ----------------
// Todas las sub-zonas activas (id, name, locality_id) en una sola carga, para armar la
// hoja de filtro multi-zona (localidades + sub-zonas con casillas). Se carga recién al
// abrir la hoja, nunca en el camino crítico de la página. Incluye las sub-zonas "Outros"
// (son oficiales en DB). Mismo TTL/patrón que localidades.
const SUBZONE_SS = "mi_subzones_v1";
let subzoneMem: Cached<CatalogSubzone[]> | null = null;
let subzoneInFlight: Promise<CatalogSubzone[]> | null = null;

export function getSubzonesSync(): CatalogSubzone[] | null {
  const now = Date.now();
  if (subzoneMem && now - subzoneMem.ts < TTL) return subzoneMem.data;
  const ss = readSS<CatalogSubzone[]>(SUBZONE_SS);
  if (ss && now - ss.ts < TTL) {
    subzoneMem = ss;
    return ss.data;
  }
  return null;
}

export async function loadSubzones(): Promise<CatalogSubzone[]> {
  const sync = getSubzonesSync();
  if (sync) return sync;
  if (subzoneInFlight) return subzoneInFlight;
  subzoneInFlight = (async () => {
    const { data } = await supabase
      .from("subzones")
      .select("id, name, locality_id")
      .eq("is_active", true)
      .order("sort_order");
    const rows = (data ?? []) as CatalogSubzone[];
    const entry = { data: rows, ts: Date.now() };
    subzoneMem = entry;
    writeSS(SUBZONE_SS, entry);
    subzoneInFlight = null;
    return rows;
  })();
  return subzoneInFlight;
}

// ---------------- Subcategorías (T6 del plan V3) ----------------
// Todo el catálogo (id, name) en una sola carga, igual que categorías: el label de
// subcategoría en /listings pasa de 1 query por visita a 1 query cada 5 min.
const SUBCAT_SS = "mi_subcat_catalog_v1";
let subcatMem: Cached<CatalogSubcategory[]> | null = null;
let subcatInFlight: Promise<CatalogSubcategory[]> | null = null;

export function getSubcategoriesSync(): CatalogSubcategory[] | null {
  const now = Date.now();
  if (subcatMem && now - subcatMem.ts < TTL) return subcatMem.data;
  const ss = readSS<CatalogSubcategory[]>(SUBCAT_SS);
  if (ss && now - ss.ts < TTL) {
    subcatMem = ss;
    return ss.data;
  }
  return null;
}

export async function loadSubcategories(): Promise<CatalogSubcategory[]> {
  const sync = getSubcategoriesSync();
  if (sync) return sync;
  if (subcatInFlight) return subcatInFlight;
  subcatInFlight = (async () => {
    const { data } = await supabase.from("subcategories").select("id, name");
    const rows = (data ?? []) as CatalogSubcategory[];
    const entry = { data: rows, ts: Date.now() };
    subcatMem = entry;
    writeSS(SUBCAT_SS, entry);
    subcatInFlight = null;
    return rows;
  })();
  return subcatInFlight;
}
