import { supabase } from "./supabaseClient";

export type NavCustom1 = { icon: string; label: string; category_slug: string };

type AdminSettings = {
  whatsapp: string;
  whatsappDisplay: string;
  bannerInterval: number;
  navCustom1: NavCustom1;
};

let cache: AdminSettings | null = null;
let pending: Promise<AdminSettings> | null = null;

const FALLBACK: AdminSettings = {
  whatsapp: "5575997075133",
  whatsappDisplay: "+55 75 99707-5133",
  bannerInterval: 4000,
  navCustom1: { icon: "🍽️", label: "Comida", category_slug: "gastronomia" },
};

export function invalidateAdminSettingsCache() {
  cache = null;
  pending = null;
}

async function fetchSettings(): Promise<AdminSettings> {
  const { data } = await supabase
    .from("admin_settings")
    .select("key,value")
    .in("key", ["admin_whatsapp", "banner_interval", "nav_custom_1"]);

  const rows: Record<string, any> = {};
  (data ?? []).forEach((r: any) => { rows[r.key] = r.value; });

  // admin_whatsapp and banner_interval use { value: X } wrapper structure
  const waRaw = rows["admin_whatsapp"]?.value
    ? String(rows["admin_whatsapp"].value).replace(/\D/g, "")
    : null;
  const waNorm = waRaw ? (waRaw.startsWith("55") ? waRaw : `55${waRaw}`) : null;
  const intervalRaw = rows["banner_interval"]?.value;
  const intervalMs = intervalRaw ? Number(intervalRaw) * 1000 : FALLBACK.bannerInterval;

  // nav_custom_1 stores the object directly without { value } wrapper
  const navCustom1: NavCustom1 = rows["nav_custom_1"] ?? FALLBACK.navCustom1;

  return {
    whatsapp: waNorm ?? FALLBACK.whatsapp,
    whatsappDisplay: rows["admin_whatsapp"]?.value
      ? String(rows["admin_whatsapp"].value)
      : FALLBACK.whatsappDisplay,
    bannerInterval: intervalMs,
    navCustom1,
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
