import { supabase } from "./supabaseClient";

type CachedProfile = {
  profile: Record<string, unknown> | null;
  listings: Record<string, unknown>[];
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
    const [profileRes, listRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase
        .from("listings")
        .select("id,title,price,price_text,status,created_at,expires_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    cache.set(uid, {
      profile: profileRes.data ?? null,
      listings: listRes.data ?? [],
    });
  } finally {
    inFlight.delete(uid);
  }
}
