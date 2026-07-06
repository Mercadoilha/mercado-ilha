import ListingDetailClient from "./ListingDetailClient";

// Shell estático (T11 del plano de otimização). La página es 100% cliente (lee el id
// con useParams y trae los datos client-side), así que el HTML es idéntico para
// cualquier id. Sin params pre-generados + dynamicParams: Next genera y cachea el
// shell on-demand en vez de invocar una función serverless por navegación (adiós a
// la ruta ƒ y a sus cold starts).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ListingDetailClient />;
}
