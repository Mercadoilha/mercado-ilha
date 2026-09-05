// Mercado Agroecológico — tipos do catálogo, texto do pedido e registro na base.
//
// O catálogo chega inteiro do servidor (RPC get_market_catalog, fase-32): seções →
// produtos → variantes, numa consulta só. A variante é quem manda: ela diz o preço
// e COMO se vende (peso / unidade / pacote fechado), e é isso que o seletor de
// quantidade obedece.

import { supabase } from "./supabaseClient";
import { formatBRL, formatQty, type CartMap } from "./mercadoCart";

export type Variant = {
  id: number;
  label: string;
  sale_mode: "peso" | "unidade" | "pacote";
  unit_label: string;
  units_per_pack: number | null;
  net_weight_g: number | null;
  price: number;
  step: number;
  min_qty: number;
  max_qty: number | null;
  note: string | null;
  // true = acabou por hoje: aparece marcado e não entra no carrinho
  is_sold_out?: boolean;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  is_seasonal: boolean;
  is_alcoholic: boolean;
  variants: Variant[];
};

export type Section = {
  id: number;
  slug: string;
  name: string;
  emoji: string | null;
  products: Product[];
};

export type Vendor = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  whatsapp: string | null;
  pickup_place: string | null;
  delivery_day: string | null;
  deadline_text: string | null;
  footer_note: string | null;
};

export type Catalog = { vendor: Vendor; sections: Section[] } | null;

// Todas as variantes num mapa id → {variante, produto, seção}: o carrinho guarda
// só ids, e daqui saem preço, nome e regra de quantidade na hora de somar.
export type VariantIndex = Map<number, { variant: Variant; product: Product; section: Section }>;

export function indexVariants(sections: Section[]): VariantIndex {
  const map: VariantIndex = new Map();
  for (const section of sections) {
    for (const product of section.products ?? []) {
      for (const variant of product.variants ?? []) {
        map.set(variant.id, { variant, product, section });
      }
    }
  }
  return map;
}

export function cartTotal(cart: CartMap, index: VariantIndex): number {
  let total = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const entry = index.get(Number(id));
    if (entry) total += entry.variant.price * qty;
  }
  // Duas casas: evita o 0,30000000000000004 das somas com decimais.
  return Math.round(total * 100) / 100;
}

export function cartCount(cart: CartMap): number {
  return Object.values(cart).filter((q) => q > 0).length;
}

// Como o item é nomeado no pedido. "Dúzia"/"Unidade"/"Pacote" não acrescentam nada
// ao nome do produto → viram a unidade entre parênteses; um rótulo com informação
// própria (sabor, "Placa (30 unid.)") vai depois do travessão.
const GENERIC_LABELS = ["unidade", "por quilo", "pacote"];

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function itemName(product: Product, variant: Variant): string {
  const label = normalize(variant.label);
  const unit = normalize(variant.unit_label);
  if (label === unit || GENERIC_LABELS.includes(label)) return `${product.name} (${variant.unit_label})`;
  return `${product.name} — ${variant.label}`;
}

export function lineTotal(variant: Variant, qty: number): number {
  return Math.round(variant.price * qty * 100) / 100;
}

// ---------------------------------------------------------------
// Texto que chega no WhatsApp do vendedor
// ---------------------------------------------------------------
// Agrupado por seção e com negrito (*) — no celular se lê de cima a baixo sem
// esforço, e o total fica destacado no fim.
export function buildOrderMessage(
  vendor: Vendor,
  cart: CartMap,
  index: VariantIndex,
  customerName: string | null,
): string {
  const bySection = new Map<string, { emoji: string | null; lines: string[] }>();

  for (const [rawId, qty] of Object.entries(cart)) {
    const entry = index.get(Number(rawId));
    if (!entry || qty <= 0) continue;
    const { variant, product, section } = entry;
    const price = formatBRL(lineTotal(variant, qty));
    const line =
      variant.sale_mode === "peso"
        ? `• ${formatQty(qty)} ${variant.unit_label} ${product.name} — ${price}`
        : `• ${formatQty(qty)} × ${itemName(product, variant)} — ${price}`;

    const bucket = bySection.get(section.name) ?? { emoji: section.emoji, lines: [] };
    bucket.lines.push(line);
    bySection.set(section.name, bucket);
  }

  const parts: string[] = [`*PEDIDO — ${vendor.name}*`];
  if (vendor.delivery_day) parts.push(`Retirada: ${vendor.delivery_day}`);
  if (vendor.pickup_place) parts.push(vendor.pickup_place);
  parts.push("");

  for (const [sectionName, bucket] of bySection) {
    parts.push(`*${sectionName.toUpperCase()}*`);
    parts.push(...bucket.lines);
    parts.push("");
  }

  parts.push(`*TOTAL: ${formatBRL(cartTotal(cart, index))}*`);
  parts.push("");
  if (customerName) parts.push(`Cliente: ${customerName}`);
  const now = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  parts.push(`Pedido feito pelo app Mercado Ilha · ${now}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------
// Registro do pedido na base
// ---------------------------------------------------------------
// Roda em segundo plano, no mesmo toque que abre o WhatsApp: o link do WhatsApp
// é um <a> nativo (nunca window.open — bloqueado no celular), então nada pode
// atrasar ou engolir esse toque. Se o registro falhar, o cliente manda o pedido
// do mesmo jeito; o que se perde é só a estatística.
export function registerOrder(params: {
  vendorId: number;
  cart: CartMap;
  customerName: string;
  customerWhatsapp?: string | null;
}): void {
  const items = Object.entries(params.cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ variant_id: Number(id), quantity: qty }));
  if (items.length === 0) return;

  void supabase
    .rpc("create_market_order", {
      p_vendor_id: params.vendorId,
      p_items: items,
      p_customer_name: params.customerName,
      p_customer_whatsapp: params.customerWhatsapp ?? null,
    })
    .then(() => {}, () => {});
}
