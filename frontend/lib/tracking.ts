/**
 * Tracking helpers — pre-monetización.
 *
 * Todas las funciones son "fire-and-forget": se disparan en segundo plano
 * y nunca bloquean ni rompen la acción del usuario. Si el tracking falla
 * (sin red, RLS, etc.) se ignora silenciosamente — el click a WhatsApp,
 * el banner o la vista del anuncio suceden igual.
 */
import { supabase } from "./supabaseClient";
import { getVisitorId } from "./visitorId";

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

/** Registra una vista de anuncio. */
export function trackListingView(listingId: number, profileId: string | null): void {
  supabase
    .rpc("track_listing_view", {
      _listing_id: listingId,
      _profile_id: profileId,
      _visitor_ip: null,
      _visitor_device: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })
    .then(() => {}, () => {});
}
