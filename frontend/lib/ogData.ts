// Datos mínimos para armar la vista previa de enlaces compartidos (Open Graph), leídos
// en el servidor por generateMetadata / opengraph-image. Van por fetch a PostgREST con la
// anon key (mismo acceso público que el cliente, RLS filtra: solo anuncios activos y
// profiles_public). El fetch usa `next: { revalidate }` → la respuesta se cachea y la ruta
// sigue siendo ISR (○), sin volverse una función por navegación (pilar de velocidad).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Los previews de links casi no cambian (precio/foto). 5 min alcanza y evita re-consultar
// en cada unfurl (WhatsApp además cachea su propia preview del lado de ellos).
export const OG_REVALIDATE = 300;

type PhotoRow = { photo_url: string; sort_order: number | null };

async function pgFetch<T>(path: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      next: { revalidate: OG_REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function formatPrice(price: number | null, priceText: string | null): string {
  if (price != null) return `R$ ${Number(price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return priceText ?? "";
}

export type ListingOg = {
  title: string;
  price: number | null;
  price_text: string | null;
  photo: string | null;
};

export async function getListingOg(id: number): Promise<ListingOg | null> {
  const rows = await pgFetch<
    { title: string; price: number | null; price_text: string | null; listing_photos: PhotoRow[] }[]
  >(`listings?id=eq.${id}&select=title,price,price_text,listing_photos(photo_url,sort_order)`);
  const row = rows?.[0];
  if (!row) return null;
  const photos = [...(row.listing_photos ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return {
    title: row.title,
    price: row.price,
    price_text: row.price_text,
    photo: photos[0]?.photo_url ?? null,
  };
}

export type StoreOg = {
  name: string;
  photos: string[]; // hasta 4 fotos de productos, para el collage
};

export async function getStoreOg(sellerId: string): Promise<StoreOg | null> {
  const [profiles, listings] = await Promise.all([
    pgFetch<{ full_name: string }[]>(
      `profiles_public?id=eq.${encodeURIComponent(sellerId)}&select=full_name`
    ),
    pgFetch<{ listing_photos: PhotoRow[] }[]>(
      `listings?user_id=eq.${encodeURIComponent(sellerId)}&status=eq.active` +
        `&select=listing_photos(photo_url,sort_order)&order=created_at.desc&limit=8`
    ),
  ]);
  const profile = profiles?.[0];
  if (!profile) return null;

  // Una foto por anuncio (la principal), hasta 4, para armar el collage.
  const photos: string[] = [];
  for (const l of listings ?? []) {
    const sorted = [...(l.listing_photos ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const first = sorted[0]?.photo_url;
    if (first) photos.push(first);
    if (photos.length >= 4) break;
  }
  return { name: profile.full_name, photos };
}
