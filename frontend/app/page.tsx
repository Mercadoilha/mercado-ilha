import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { LISTINGS_SELECT_BUMP, PAGE_SIZE } from "../lib/listingsApi";
import HomeClient from "../components/HomeClient";

// ISR: HTML pre-renderizado servido desde el edge (sin cold start ni viaje a la DB en el
// camino crítico). Se refresca en segundo plano cada 60s → un anuncio nuevo aparece en ≤60s.
export const revalidate = 60;

export default async function Home() {
  const admin = getSupabaseAdmin({ revalidate: 60 });

  // Data de hoje no fuso da ilha (Bahia, UTC-3). Um banner só aparece se hoje estiver
  // dentro da sua janela (valid_from/valid_until). Com o ISR de 60s, isto se reavalia
  // sozinho a cada minuto → o banner começa/pausa na data certa sem intervenção.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });

  const [
    { data: listData },
    { data: settingsData },
    { data: bannersData },
  ] = await Promise.all([
    // Feed del inicio: primera página (PAGE_SIZE anuncios activos), 1 foto por anuncio,
    // orden bumped_at desc (fecha de publicação/destaque, lo más nuevo arriba). Mismo
    // patrón ISR que /listings; el cliente lo revalida y pagina por keyset (bumped_at, id).
    admin
      .from("listings")
      .select(LISTINGS_SELECT_BUMP)
      .order("sort_order", { referencedTable: "listing_photos" })
      .limit(1, { referencedTable: "listing_photos" })
      .eq("status", "active")
      .order("bumped_at", { ascending: false })
      .order("id", { ascending: false }) // desempate estable para el keyset
      .limit(PAGE_SIZE),
    admin
      .from("admin_settings")
      .select("key,value")
      .in("key", ["admin_whatsapp", "banner_interval", "featured_count", "mercado_agro_button"]),
    admin
      .from("banners")
      .select("id,title,image_url,link_url")
      .eq("position", "home")
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

  // Reforma 4: los primeros N anuncios del feed default (orden bumped_at) llevan contorno
  // dorado. N configurable desde /admin → Config (key featured_count, default 10). La marca
  // viaja con cada anuncio → el contorno acompaña al anuncio si el usuario reordena/filtra.
  const featuredCount = Number(rows["featured_count"]?.value ?? 10) || 0;

  // Acceso al Mercado Agroecológico (banner entre la fila de pills y el grid). Todo
  // configurable desde /admin: si está apagado o no existe la config, no se pinta nada.
  const mercadoRaw = rows["mercado_agro_button"];
  const mercadoButton =
    mercadoRaw && mercadoRaw.enabled !== false
      ? {
          title: String(mercadoRaw.title ?? "Mercado Agroecológico"),
          subtitle: mercadoRaw.subtitle ? String(mercadoRaw.subtitle) : null,
          badge: mercadoRaw.badge ? String(mercadoRaw.badge) : null,
        }
      : null;

  const listings = listData ?? [];
  const featuredIds = listings.slice(0, featuredCount).map((l: any) => l.id);

  return (
    <HomeClient
      listings={listings}
      featuredIds={featuredIds}
      adminWa={adminWa}
      banners={bannersData ?? []}
      bannerInterval={bannerInterval}
      mercadoButton={mercadoButton}
    />
  );
}
