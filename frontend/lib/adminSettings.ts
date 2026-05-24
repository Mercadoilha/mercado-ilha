import { supabase } from "./supabaseClient";

type AdminSettings = {
  whatsapp: string;       // número limpio para wa.me, ej: "5575997075133"
  whatsappDisplay: string;
  bannerInterval: number; // milisegundos
};

let cache: AdminSettings | null = null;

const FALLBACK: AdminSettings = {
  whatsapp: "5575997075133",
  whatsappDisplay: "+55 75 99707-5133",
  bannerInterval: 4000,
};

export function invalidateAdminSettingsCache() {
  cache = null;
}

export async function getAdminSettings(): Promise<AdminSettings> {
  if (cache) return cache;

  const { data } = await supabase
    .from("admin_settings")
    .select("key,value")
    .in("key", ["admin_whatsapp", "banner_interval"]);

  const rows: Record<string, any> = {};
  (data ?? []).forEach((r: any) => { rows[r.key] = r.value?.value; });

  const waRaw = rows["admin_whatsapp"] ? String(rows["admin_whatsapp"]).replace(/\D/g, "") : null;
  const waNorm = waRaw ? (waRaw.startsWith("55") ? waRaw : `55${waRaw}`) : null;
  const intervalMs = rows["banner_interval"] ? Number(rows["banner_interval"]) * 1000 : FALLBACK.bannerInterval;

  cache = {
    whatsapp: waNorm ?? FALLBACK.whatsapp,
    whatsappDisplay: rows["admin_whatsapp"] ? String(rows["admin_whatsapp"]) : FALLBACK.whatsappDisplay,
    bannerInterval: intervalMs,
  };

  return cache;
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
