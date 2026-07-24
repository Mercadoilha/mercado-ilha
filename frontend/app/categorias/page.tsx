import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import CategoriasClient from "../../components/CategoriasClient";

// Server Component con ISR (mismo patrón que el inicio). El admin revalida esta ruta al
// editar categorías (ver /api/revalidate), así los cambios se ven sin esperar los 60s.
export const revalidate = 60;

export default async function CategoriasPage() {
  const admin = getSupabaseAdmin({ revalidate: 60 });

  // Data de hoje no fuso da ilha (Bahia, UTC-3). Um banner só aparece se hoje estiver
  // dentro da sua janela (valid_from/valid_until). Com o ISR de 60s isto se reavalia sozinho.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });

  const [
    { data: catData },
    { data: settingsData },
    { data: bannersData },
  ] = await Promise.all([
    admin
      .from("categories")
      .select("id,name,slug,icon,description,home_section_id,home_sections(id,title,sort_order,is_featured_block),subcategories(id,is_active)")
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("admin_settings")
      .select("key,value")
      .in("key", ["admin_whatsapp", "banner_interval"]),
    admin
      .from("banners")
      .select("id,title,image_url,link_url")
      .eq("position", "categorias")
      .eq("active", true)
      .or(`valid_from.is.null,valid_from.lte.${today}`)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("sort_order"),
  ]);

  const rows: Record<string, any> = {};
  (settingsData ?? []).forEach((r: any) => { rows[r.key] = r.value; });
  const waRaw = rows["admin_whatsapp"]?.value
    ? String(rows["admin_whatsapp"].value).replace(/\D/g, "")
    : null;
  const adminWa = waRaw ? (waRaw.startsWith("55") ? waRaw : `55${waRaw}`) : "5575997075133";
  const intervalRaw = rows["banner_interval"]?.value;
  const bannerInterval = intervalRaw ? Number(intervalRaw) * 1000 : 4000;

  return (
    <CategoriasClient
      categories={catData ?? []}
      adminWa={adminWa}
      banners={bannersData ?? []}
      bannerInterval={bannerInterval}
    />
  );
}
