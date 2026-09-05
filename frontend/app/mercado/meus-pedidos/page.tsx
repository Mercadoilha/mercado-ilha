import type { Metadata } from "next";
import MeusPedidosClient from "./MeusPedidosClient";

// Cáscara estática: o HTML não depende de dados (os pedidos são de cada pessoa e
// vêm no cliente, com a sessão dela) → a tela abre na hora, sem esperar a base.
export const metadata: Metadata = {
  title: "Meus pedidos | Mercado Agroecológico",
};

export default function Page() {
  return <MeusPedidosClient />;
}
