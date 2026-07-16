import { supabase } from "./supabaseClient";

type CachedProfile = {
  profile: Record<string, unknown> | null;
  listings: Record<string, unknown>[];
  // Contadores 👁️/💬 de "Meus anúncios", precalentados junto al perfil para que no salten
  // de 0 al valor real al entrar. undefined = todavía no precalentado (la página los pide).
  statsMap?: Record<number, { views: number; wa_clicks: number }>;
};

const cache = new Map<string, CachedProfile>();
const inFlight = new Set<string>();

export function getCachedProfile(uid: string): CachedProfile | null {
  return cache.get(uid) ?? null;
}

export function setCachedProfile(uid: string, patch: Partial<CachedProfile>) {
  const current = cache.get(uid) ?? { profile: null, listings: [] };
  cache.set(uid, { ...current, ...patch });
}

export async function prewarmProfile(uid: string): Promise<void> {
  if (inFlight.has(uid)) return;
  inFlight.add(uid);
  try {
    // El select de listings debe coincidir con app/profile/page.tsx (miniaturas + botón
    // "Vendido"): trae la 1ª foto y categories.is_product. Sin esto, al entrar al perfil
    // desde el caché se pintan sin foto (🛍️) y sin "Vendido" hasta que responde la query
    // completa. El RPC de stats precalienta los contadores 👁️/💬 (misma sesión → auth ok).
    const [profileRes, listRes, statsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase
        .from("listings")
        .select("id,title,price,price_text,status,created_at,expires_at,bumped_at,categories(is_product),listing_photos(photo_url,sort_order)")
        .order("sort_order", { referencedTable: "listing_photos" })
        .limit(1, { referencedTable: "listing_photos" })
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_my_listings_stats"),
    ]);
    const statsMap: Record<number, { views: number; wa_clicks: number }> = {};
    for (const s of (statsRes.data as any[]) ?? []) {
      statsMap[s.listing_id] = { views: Number(s.views) || 0, wa_clicks: Number(s.wa_clicks) || 0 };
    }
    cache.set(uid, {
      profile: profileRes.data ?? null,
      listings: listRes.data ?? [],
      statsMap,
    });
  } finally {
    inFlight.delete(uid);
  }
}
