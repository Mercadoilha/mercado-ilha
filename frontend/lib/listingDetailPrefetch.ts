// Prefetch de la query completa del detalle, disparado al tocar una card (mismo espíritu
// que prewarmProfile). Al hacer click en ListingCard se lanza la query en paralelo con la
// navegación RSC → cuando monta ListingDetailClient la respuesta ya llegó o está por
// llegar, y la descripción (+ fotos 2..N) aparece al toque en vez de esperar la cadena
// serial tap → payload RSC → mount → query. Deep link / F5 no pasa por acá → cae al
// flujo normal (query en el mount), que es lo correcto.

import { supabase } from "./supabaseClient";
import { LISTING_DETAIL_SELECT } from "./listingsApi";

type DetailResult = { data: any; error: any };
type Entry = { promise: Promise<DetailResult>; ts: number };

const cache = new Map<number, Entry>();
const MAX = 10;
const TTL = 30_000;

// Fire-and-forget, deduplicado. La query arranca ya (el .then dispara el fetch de
// PostgREST); la promesa nunca rechaza (un error se mapea a { data, error }) para no
// dejar rejections sin manejar si nadie la consume.
export function prefetchListingDetail(id: number): void {
  if (!id || Number.isNaN(id)) return;
  const existing = cache.get(id);
  if (existing && Date.now() - existing.ts < TTL) return; // ya en vuelo y fresca

  const promise: Promise<DetailResult> = Promise.resolve(
    supabase.from("listings").select(LISTING_DETAIL_SELECT).eq("id", id).single()
  ).then((res) => res as DetailResult, (error) => ({ data: null, error }));

  cache.set(id, { promise, ts: Date.now() });
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// Consume la promesa prefetcheada si existe y está fresca (la remueve al entregarla, uso
// único). Devuelve null si no hay o venció → el detalle ejecuta la query como siempre.
export function takeListingDetailPrefetch(id: number): Promise<DetailResult> | null {
  const entry = cache.get(id);
  if (!entry) return null;
  cache.delete(id);
  if (Date.now() - entry.ts >= TTL) return null;
  return entry.promise;
}
