// Carrinho do Mercado Agroecológico.
//
// Vive no telefone do cliente (localStorage): se a página recarrega, se ele sai do
// app e volta amanhã, ou se passa pela tela de login antes de enviar, o pedido
// segue armado. É justamente isso que permite pedir o login só no final, sem
// risco de perder o que a pessoa escolheu.
//
// Guardamos só {variante → quantidade}: preços e nomes vêm sempre do catálogo
// (que é servido pelo servidor). Assim uma lista de preços nova nunca fica
// "presa" dentro de um carrinho velho.

const KEY = "mercado_cart_v1";

export type CartMap = Record<number, number>; // variant_id → quantidade

type Stored = { vendorId: number; items: CartMap };

export function readCart(vendorId: number): CartMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    // Carrinho de outra feira (ou formato antigo): começa limpo.
    if (!parsed || parsed.vendorId !== vendorId || typeof parsed.items !== "object") return {};
    const out: CartMap = {};
    for (const [k, v] of Object.entries(parsed.items)) {
      const id = Number(k);
      const qty = Number(v);
      if (Number.isFinite(id) && Number.isFinite(qty) && qty > 0) out[id] = qty;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeCart(vendorId: number, items: CartMap) {
  if (typeof window === "undefined") return;
  try {
    const clean: CartMap = {};
    for (const [k, v] of Object.entries(items)) if (v > 0) clean[Number(k)] = v;
    window.localStorage.setItem(KEY, JSON.stringify({ vendorId, items: clean } satisfies Stored));
  } catch { /* modo privado / armazenamento cheio: o carrinho segue na memória */ }
}

export function clearCart() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignorar */ }
}

// R$ 1.234,50 — sempre com 2 casas, no formato do Brasil.
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

// Quantidade legível: 2 → "2", 1.5 → "1,5".
export function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
