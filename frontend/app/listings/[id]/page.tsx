import type { Metadata } from "next";
import ListingDetailClient from "./ListingDetailClient";
import { getListingOg, formatPrice, OG_REVALIDATE } from "../../../lib/ogData";

// Shell estático (T11 del plano de otimização). La página es 100% cliente (lee el id
// con useParams y trae los datos client-side), así que el HTML es idéntico para
// cualquier id. Sin params pre-generados + dynamicParams: Next genera y cachea el
// shell on-demand en vez de invocar una función serverless por navegación (adiós a
// la ruta ƒ y a sus cold starts).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// ISR: la vista previa (generateMetadata) lee del server pero con fetch cacheado
// (OG_REVALIDATE) → la ruta sigue siendo estática/ISR (○), no una función por navegación.
export const revalidate = OG_REVALIDATE;

// Vista previa del enlace compartido (WhatsApp, redes): foto do produto grande, nome +
// preço no título e um convite a entrar. Sem isto o link mostrava só o logo do site.
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = Number(params.id);
  const og = Number.isNaN(id) ? null : await getListingOg(id);
  if (!og) return {}; // cai no metadata padrão do layout (logo)

  const price = formatPrice(og.price, og.price_text);
  const title = price ? `${og.title} — ${price}` : og.title;
  const description = "Veja este anúncio no Mercado Ilha 🏝️ Toque para abrir e falar com o vendedor.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Mercado Ilha",
      type: "website",
      locale: "pt_BR",
      ...(og.photo ? { images: [{ url: og.photo }] } : {}),
    },
    twitter: {
      card: og.photo ? "summary_large_image" : "summary",
      title,
      description,
      ...(og.photo ? { images: [og.photo] } : {}),
    },
  };
}

export default function Page() {
  return <ListingDetailClient />;
}
