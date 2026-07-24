import type { Metadata } from "next";
import StoreClient from "./StoreClient";
import { getStoreOg, OG_REVALIDATE } from "../../../lib/ogData";

// Shell estático (T11 del plano de otimização). La tienda es 100% cliente (lee el id
// con useParams y trae los datos client-side); el HTML no depende del id, así que se
// pre-renderiza estático y se cachea on-demand en vez de invocar una función por
// navegación.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// ISR: la vista previa lee del server con fetch cacheado → la ruta sigue ISR (○).
export const revalidate = OG_REVALIDATE;

// Vista previa del enlace compartido de la loja. El og:image (collage de productos) lo
// aporta opengraph-image.tsx (convención de Next). Acá solo el texto: nome da loja +
// convite curto, sem número de anúncios (decisão do usuário). Redação neutra (sem
// vendedor/vendedora).
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const og = await getStoreOg(params.id);
  const name = og?.name ? `Loja de ${og.name}` : "Loja no Mercado Ilha";
  const description = "Veja os produtos desta loja no Mercado Ilha 🏝️ Toque para abrir.";
  return {
    title: name,
    description,
    openGraph: { title: name, description, type: "website", locale: "pt_BR" },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default function Page() {
  return <StoreClient />;
}
