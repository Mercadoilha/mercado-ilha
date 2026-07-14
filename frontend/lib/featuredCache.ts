// Caché de sesión de los IDs "destacados" (contorno dorado): los N anuncios activos más
// recientemente destacados (bumped_at desc, id desc), con N = admin_settings.featured_count
// (default 10). Es EXACTAMENTE el mismo conjunto que marca el inicio (app/page.tsx). Se
// expone acá para que el contorno dorado acompañe a esos anuncios en TODAS las pantallas
// donde aparecen (categorías, busca, loja del vendedor, favoritos) sin volver a consultar
// en cada una: módulo + espejo en sessionStorage, stale-while-revalidate.
//
// Pilar de velocidad: el conjunto se resuelve de forma asíncrona y NO bloquea el render de
// las cards (igual que los favoritos). En visitas repetidas se sirve sincrónico desde el
// caché → cero RTT. El TTL (60s) queda alineado al revalidate=60 del inicio.

import { supabase } from "./supabaseClient";

const TTL = 60 * 1000; // 60s — alineado al revalidate del inicio (ISR)
const SS = "mi_featured_ids_v1";
const DEFAULT_COUNT = 10;
// Tope de IDs traídos por consulta. featured_count real es chico (default 10); este cap
// evita traer de más y cubre cualquier valor razonable configurado en /admin.
const MAX_FETCH = 60;

type Cached = { data: number[]; ts: number };

let mem: Cached | null = null;
let inFlight: Promise<number[]> | null = null;

function readSS(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return parsed as Cached;
  } catch {
    return null;
  }
}

function writeSS(value: Cached): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SS, JSON.stringify(value));
  } catch {
    // storage lleno / modo privado: ignorar, el caché de módulo sigue sirviendo.
  }
}

// Lectura sincrónica: devuelve el Set de IDs destacados si hay caché fresco, o null.
export function getFeaturedIdsSync(): Set<number> | null {
  const now = Date.now();
  if (mem && now - mem.ts < TTL) return new Set(mem.data);
  const ss = readSS();
  if (ss && now - ss.ts < TTL) {
    mem = ss;
    return new Set(ss.data);
  }
  return null;
}

// Carga (con deduplicación de vuelos en curso) el conjunto de IDs destacados.
export async function loadFeaturedIds(): Promise<Set<number>> {
  const sync = getFeaturedIdsSync();
  if (sync) return sync;
  if (inFlight) return inFlight.then((ids) => new Set(ids));
  inFlight = (async () => {
    // featured_count + top-N ids en paralelo (sin waterfall): traemos hasta MAX_FETCH ids
    // por bumped_at desc y recortamos por el count configurado.
    const [settingRes, listRes] = await Promise.all([
      supabase.from("admin_settings").select("value").eq("key", "featured_count").single(),
      supabase
        .from("listings")
        .select("id")
        .eq("status", "active")
        .order("bumped_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MAX_FETCH),
    ]);

    const count = Number((settingRes.data as any)?.value?.value ?? DEFAULT_COUNT) || 0;
    const ids = ((listRes.data as any[]) ?? []).slice(0, count).map((r) => r.id as number);

    const entry = { data: ids, ts: Date.now() };
    mem = entry;
    writeSS(entry);
    inFlight = null;
    return ids;
  })();
  return inFlight.then((ids) => new Set(ids));
}
