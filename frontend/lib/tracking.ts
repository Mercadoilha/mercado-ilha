/**
 * Tracking helpers — pre-monetización.
 *
 * Todas las funciones son "fire-and-forget": se disparan en segundo plano
 * y nunca bloquean ni rompen la acción del usuario. Si el tracking falla
 * (sin red, RLS, etc.) se ignora silenciosamente — el click a WhatsApp,
 * el banner o la vista del anuncio suceden igual.
 */
import { supabase } from "./supabaseClient";
import { getSessionId, getVisitorId } from "./visitorId";

export type WaContext = "listing" | "store" | "banner_cta" | "suggestion";

/** Registra un click en un botón de WhatsApp. */
export function trackWhatsappClick(
  listingId: number | null,
  context: WaContext = "listing"
): void {
  supabase
    .rpc("track_whatsapp_click", {
      _listing_id: listingId,
      _context: context,
      _visitor_id: getVisitorId(),
    })
    .then(() => {}, () => {});
}

/** Registra un click en un banner. */
export function trackBannerClick(
  bannerId: number,
  position: string | null
): void {
  supabase
    .rpc("track_banner_click", {
      _banner_id: bannerId,
      _position: position,
      _visitor_id: getVisitorId(),
    })
    .then(() => {}, () => {});
}

/**
 * Registra una búsqueda de texto y cuántos resultados obtuvo.
 * Sirve para descubrir búsquedas sin resultados (candidatas a sinónimos)
 * y las más frecuentes. La normalización del término la hace el servidor.
 */
export function trackSearch(term: string, resultsCount: number): void {
  const t = term.trim();
  if (t.length < 2) return;
  supabase
    .rpc("track_search", {
      _term: t,
      _results_count: resultsCount,
      _visitor_id: getVisitorId(),
    })
    .then(() => {}, () => {});
}

/**
 * Registra la apertura de una pantalla (métrica de audiencia del app).
 * La ruta llega ya normalizada por VisitTracker: los ids numéricos se
 * colapsan a ':id' para que el ranking de pantallas sea legible.
 *
 * `source` (fase-31) es el marcador `?de=` del link por el que entró la
 * persona ('grupo' para los links que salen del Estúdio a los grupos de
 * WhatsApp). Solo lo trae la PRIMERA pantalla de la visita, así una
 * entrada no se cuenta dos veces.
 *
 * Sin source se llama a la RPC de 4 parámetros de fase-29 — la de 5 es
 * una sobrecarga. Así el tracking normal sigue funcionando aunque la
 * migración de fase-31 todavía no se haya corrido en la base.
 */
export function trackAppVisit(path: string, source?: string | null): void {
  const isPwa =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  const args: Record<string, unknown> = {
    _path: path,
    _visitor_id: getVisitorId(),
    _session_id: getSessionId(),
    _is_pwa: !!isPwa,
  };
  if (source) args._source = source;

  supabase.rpc("track_app_visit", args).then(() => {}, () => {});
}

/** Registra una vista de anuncio. */
export function trackListingView(listingId: number, profileId: string | null): void {
  supabase
    .rpc("track_listing_view", {
      _listing_id: listingId,
      _profile_id: profileId,
      _visitor_ip: null,
      // El truncado real vive en la RPC (fase-20); esto es defensa en
      // profundidad: el user-agent completo no lo usa ningún reporte.
      _visitor_device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : null,
      // fase-30: permite no contar dos veces la misma vista (mismo
      // aparato + mismo anuncio dentro de 30 min). Id anónimo.
      _visitor_id: getVisitorId(),
    })
    .then(() => {}, () => {});
}
