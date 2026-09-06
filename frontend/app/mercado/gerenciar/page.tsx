import type { Metadata } from "next";
import GerenciarClient from "./GerenciarClient";

// Cáscara estática: tudo aqui depende de quem está logado, então os dados vêm no
// cliente com a sessão da pessoa. A rota abre na hora e não roda nada no servidor.
export const metadata: Metadata = {
  title: "Painel do administrador | Mercado Agroecológico",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GerenciarClient />;
}
