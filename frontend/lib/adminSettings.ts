import { supabase } from "./supabaseClient";

type AdminSettings = {
  whatsapp: string;
  whatsappDisplay: string;
  bannerInterval: number;
};

let cache: AdminSettings | null = null;
let pending: Promise<AdminSettings> | null = null;

const FALLBACK: AdminSettings = {
  whatsapp: "5575997075133",
  whatsappDisplay: "+55 75 99707-5133",
  bannerInterval: 4000,
};

export function invalidateAdminSettingsCache() {
  cache = null;
  pending = null;
}

async function fetchSettings(): Promise<AdminSettings> {
  const { data } = await supabase
    .from("admin_settings")
    .select("key,value")
    .in("key", ["admin_whatsapp", "banner_interval"]);

  const rows: Record<string, any> = {};
  (data ?? []).forEach((r: any) => { rows[r.key] = r.value; });

  // admin_whatsapp and banner_interval use { value: X } wrapper structure
  const waRaw = rows["admin_whatsapp"]?.value
    ? String(rows["admin_whatsapp"].value).replace(/\D/g, "")
    : null;
  const waNorm = waRaw ? (waRaw.startsWith("55") ? waRaw : `55${waRaw}`) : null;
  const intervalRaw = rows["banner_interval"]?.value;
  const intervalMs = intervalRaw ? Number(intervalRaw) * 1000 : FALLBACK.bannerInterval;

  return {
    whatsapp: waNorm ?? FALLBACK.whatsapp,
    whatsappDisplay: rows["admin_whatsapp"]?.value
      ? String(rows["admin_whatsapp"].value)
      : FALLBACK.whatsappDisplay,
    bannerInterval: intervalMs,
  };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  if (cache) return cache;
  if (pending) return pending;
  pending = fetchSettings().then((result) => {
    cache = result;
    pending = null;
    return result;
  });
  return pending;
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
