import LojasClient from "./LojasClient";

// Shell estático (mismo patrón que /store/[id]). El HTML no depende de datos, así que
// se pre-renderiza estático; el listado se trae client-side (RPC get_stores) sin invocar
// una función por navegación → la ruta abre al instante.
export default function Page() {
  return <LojasClient />;
}
