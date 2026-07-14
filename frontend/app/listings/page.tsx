import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { LISTINGS_SELECT, PAGE_SIZE } from "../../lib/listingsApi";
import ListingsClient from "./ListingsClient";

// T11 (plan V2): Server Component con ISR. El listado default (60 anuncios activos,
// orden created_at desc, 1 foto por anuncio) se renderiza en el servidor y viaja en el
// primer HTML → cards visibles antes de que el JS hidrate y consulte Supabase. Mismo
// patrón que el home (app/page.tsx).
//
// IMPORTANTE: NO se leen searchParams acá. Leerlos en el server convertiría la ruta en
// ƒ Dynamic (se perdería el ISR). Los filtros/búsqueda los lee el cliente con
// useSearchParams (bajo Suspense en ListingsClient); con filtros en la URL, el cliente
// ignora initialDefault y hace su fetch normal.
export const revalidate = 60;

export default async function ListingsPage() {
  const admin = getSupabaseAdmin({ revalidate: 60 });
  // Primera página del listado default (orden created_at desc) con el cliente server-side
  // (ISR de 60s en el fetch), usando el mismo LISTINGS_SELECT que el feed cliente → cero
  // drift. El cliente (ListingsFeed) revalida y pagina por keyset (created_at, id).
  const { data } = await admin
    .from("listings")
    .select(LISTINGS_SELECT)
    .order("sort_order", { referencedTable: "listing_photos" })
    .limit(1, { referencedTable: "listing_photos" })
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }) // desempate estable para el keyset (T4)
    .limit(PAGE_SIZE);

  return <ListingsClient initialDefault={data ?? []} />;
}
