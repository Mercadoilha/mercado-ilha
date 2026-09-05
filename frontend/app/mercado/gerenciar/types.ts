// Formato do catálogo visto pelo painel (RPC get_market_catalog_admin): igual ao
// público, mas mostra também o que está oculto e o que está esgotado.

export type AdminVariant = {
  id: number;
  label: string;
  sale_mode: "peso" | "unidade" | "pacote";
  unit_label: string;
  price: number;
  step: number;
  min_qty: number;
  max_qty: number | null;
  note: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  sort_order: number;
};

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_seasonal: boolean;
  is_alcoholic: boolean;
  sort_order: number;
  variants: AdminVariant[];
};

export type AdminSection = {
  id: number;
  slug: string;
  name: string;
  emoji: string | null;
  is_active: boolean;
  sort_order: number;
  products: AdminProduct[];
};

export type AdminVendor = {
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
  is_active: boolean;
};

export type AdminCatalog = { vendor: AdminVendor; sections: AdminSection[] };

export const VENDOR_SLUG = "feira-agroecologica-gamboa";
