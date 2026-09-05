import type { Metadata } from "next";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import type { Catalog } from "../../lib/mercadoApi";
import MercadoClient from "./MercadoClient";

// ISR: o catálogo é igual para todo mundo, então a tela sai pré-renderizada do edge
// (sem cold start nem viagem à base no caminho crítico) e se refresca sozinha a cada
// 60s → um preço novo aparece em no máximo um minuto.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mercado Agroecológico | Mercado Ilha",
  description: "Frutas, hortaliças e produtos naturais da agricultura familiar da região. Faça seu pedido pelo app.",
};

const VENDOR_SLUG = "feira-agroecologica-gamboa";

export default async function Page() {
  const admin = getSupabaseAdmin({ revalidate: 60 });

  // Uma chamada só traz seções → produtos → variantes já aninhados e ordenados
  // (RPC get_market_catalog, fase-32). Nada de N+1 nem de várias idas à base.
  const { data } = await admin.rpc("get_market_catalog", { p_vendor_slug: VENDOR_SLUG });
  const catalog = (data ?? null) as Catalog;

  return <MercadoClient catalog={catalog} />;
}
