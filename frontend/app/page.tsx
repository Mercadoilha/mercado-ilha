import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import HomeClient from "../components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = getSupabaseAdmin();

  const [
    { data: listData },
    { data: catData },
    { data: settingsData },
    { data: bannersData },
  ] = await Promise.all([
    admin
      .from("listings")
      .select(
        "id, title, price, price_text, condition, locality_id, subzone_id, category_id, created_at, listing_photos(photo_url, sort_order), localities(name)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("categories")
      .select("id,name,slug,icon,description")
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("admin_settings")
      .select("key,value")
      .in("key", ["admin_whatsapp", "banner_interval"]),
    admin
      .from("banners")
      .select("id,title,image_url,link_url")
      .eq("position", "home")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const rows: Record<string, any> = {};
  (settingsData ?? []).forEach((r: any) => {
    rows[r.key] = r.value;
  });
  const waRaw = rows["admin_whatsapp"]?.value
    ? String(rows["admin_whatsapp"].value).replace(/\D/g, "")
    : null;
  const adminWa = waRaw
    ? waRaw.startsWith("55") ? waRaw : `55${waRaw}`
    : "5575997075133";
  const intervalRaw = rows["banner_interval"]?.value;
  const bannerInterval = intervalRaw ? Number(intervalRaw) * 1000 : 4000;

  return (
    <HomeClient
      listings={listData ?? []}
      categories={catData ?? []}
      adminWa={adminWa}
      banners={bannersData ?? []}
      bannerInterval={bannerInterval}
    />
  );
}
