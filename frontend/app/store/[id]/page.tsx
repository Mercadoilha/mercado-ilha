import StoreClient from "./StoreClient";

// Shell estático (T11 del plano de otimização). La tienda es 100% cliente (lee el id
// con useParams y trae los datos client-side); el HTML no depende del id, así que se
// pre-renderiza estático y se cachea on-demand en vez de invocar una función por
// navegación.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <StoreClient />;
}
