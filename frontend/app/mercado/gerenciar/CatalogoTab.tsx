"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../../lib/supabaseClient";
import type { AdminCatalog, AdminProduct, AdminSection, AdminVariant } from "./types";

const ProdutoSheet = dynamic(() => import("./ProdutoSheet"), { ssr: false });

// Manter o catálogo: preço, esgotado, ocultar, criar produto e criar opção.
// Nada se apaga de verdade — "tirar do catálogo" é ocultar, e sempre dá para
// trazer de volta.
export default function CatalogoTab({ catalog, onReload }: { catalog: AdminCatalog; onReload: () => Promise<void> }) {
  const [sections, setSections] = useState<AdminSection[]>(catalog.sections);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [sheet, setSheet] = useState<
    | { mode: "novo-produto"; sectionId: number }
    | { mode: "editar-produto"; product: AdminProduct }
    | { mode: "nova-opcao"; product: AdminProduct }
    | null
  >(null);

  useEffect(() => { setSections(catalog.sections); }, [catalog]);

  const visibleSections = useMemo(
    () =>
      sections
        .map((s) => ({ ...s, products: s.products.filter((p) => showHidden || p.is_active) }))
        .filter((s) => s.products.length > 0 || s.is_active),
    [sections, showHidden],
  );

  // Toda alteração vai direto à base e se reflete na tela na hora; se a base
  // recusar, a tela volta ao que era e avisa.
  const patchVariant = async (variant: AdminVariant, patch: Partial<AdminVariant>) => {
    setBusy(variant.id);
    setError(null);
    const { error: err } = await supabase.from("market_product_variants").update(patch).eq("id", variant.id);
    setBusy(null);
    if (err) { setError("Não foi possível salvar. Tente de novo."); return false; }
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        products: s.products.map((p) => ({
          ...p,
          variants: p.variants.map((v) => (v.id === variant.id ? { ...v, ...patch } : v)),
        })),
      })),
    );
    return true;
  };

  const patchProduct = async (product: AdminProduct, patch: Partial<AdminProduct>) => {
    setBusy(-product.id);
    setError(null);
    const { error: err } = await supabase.from("market_products").update(patch).eq("id", product.id);
    setBusy(null);
    if (err) { setError("Não foi possível salvar. Tente de novo."); return; }
    setSections((prev) =>
      prev.map((s) => ({ ...s, products: s.products.map((p) => (p.id === product.id ? { ...p, ...patch } : p)) })),
    );
  };

  const savePrice = async (variant: AdminVariant) => {
    const raw = prices[variant.id];
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value < 0) { setError("Preço inválido."); return; }
    const ok = await patchVariant(variant, { price: Math.round(value * 100) / 100 });
    if (ok) setPrices((prev) => { const next = { ...prev }; delete next[variant.id]; return next; });
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0.6rem 1rem", background: "#F7FBF9", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Toque no preço para mudar. Nada é apagado: para tirar algo do app, oculte.
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 700, color: "var(--green-dark)", flexShrink: 0 }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Ver ocultos
        </label>
      </div>

      {error && <p className="text-error" style={{ margin: "10px 1rem", fontSize: "0.82rem" }}>{error}</p>}

      {visibleSections.map((section) => (
        <section key={section.id}>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              background: "var(--green-dark)", color: "#fff", padding: "0.5rem 1rem",
              fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em",
            }}
          >
            <span>{section.emoji ? `${section.emoji} ` : ""}{section.name}{!section.is_active && " (oculta)"}</span>
            <button
              type="button"
              onClick={() => setSheet({ mode: "novo-produto", sectionId: section.id })}
              style={{ border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "0.2rem 0.55rem", fontSize: "0.72rem", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}
            >
              + produto
            </button>
          </div>

          {section.products.map((product) => (
            <div key={product.id} style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "0.65rem 1rem", opacity: product.is_active ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" }}>
                    {product.name}
                    {!product.is_active && <Tag text="oculto" color="#64748b" bg="#f1f5f9" />}
                    {product.is_seasonal && <Tag text="sazonal" color="#b45309" bg="#fef3c7" />}
                  </div>
                  {product.description && (
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{product.description}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <MiniBtn onClick={() => setSheet({ mode: "editar-produto", product })}>editar</MiniBtn>
                  <MiniBtn
                    onClick={() => patchProduct(product, { is_active: !product.is_active })}
                    busy={busy === -product.id}
                  >
                    {product.is_active ? "ocultar" : "mostrar"}
                  </MiniBtn>
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {product.variants.map((variant) => {
                  const edited = prices[variant.id] !== undefined;
                  return (
                    <div
                      key={variant.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                        background: variant.is_active ? "#F7FBF9" : "#f8fafc",
                        border: "1px solid #E3F1EA", borderRadius: 10, padding: "0.45rem 0.6rem",
                        opacity: variant.is_active ? 1 : 0.6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 110 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                          {variant.label}
                          {variant.is_sold_out && <Tag text="esgotado" color="#b91c1c" bg="#fee2e2" />}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          {variant.sale_mode === "peso" ? `por ${variant.unit_label} (aceita meio)` : `por ${variant.unit_label}`}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>R$</span>
                        <input
                          value={edited ? prices[variant.id] : String(variant.price).replace(".", ",")}
                          onChange={(e) => setPrices((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                          inputMode="decimal"
                          style={{
                            width: 72, padding: "0.3rem 0.4rem", border: `1.5px solid ${edited ? "var(--green-dark)" : "var(--border)"}`,
                            borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit", textAlign: "right",
                          }}
                        />
                        {edited && (
                          <button
                            type="button"
                            onClick={() => savePrice(variant)}
                            disabled={busy === variant.id}
                            style={{ border: "none", background: "var(--green-dark)", color: "#fff", borderRadius: 8, padding: "0.3rem 0.5rem", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {busy === variant.id ? "…" : "salvar"}
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <MiniBtn onClick={() => patchVariant(variant, { is_sold_out: !variant.is_sold_out })} busy={busy === variant.id}>
                          {variant.is_sold_out ? "tem de novo" : "esgotou"}
                        </MiniBtn>
                        <MiniBtn onClick={() => patchVariant(variant, { is_active: !variant.is_active })} busy={busy === variant.id}>
                          {variant.is_active ? "ocultar" : "mostrar"}
                        </MiniBtn>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSheet({ mode: "nova-opcao", product })}
                  style={{ alignSelf: "flex-start", border: "1.5px dashed var(--green-sea)", background: "transparent", color: "var(--green-dark)", borderRadius: 10, padding: "0.3rem 0.6rem", fontSize: "0.74rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                >
                  + opção de venda
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}

      {sheet && (
        <ProdutoSheet
          vendorId={catalog.vendor.id}
          sections={sections}
          config={sheet}
          onClose={() => setSheet(null)}
          onDone={async () => { setSheet(null); await onReload(); }}
        />
      )}
    </div>
  );
}

function Tag({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 800, color, background: bg, borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }}>
      {text}
    </span>
  );
}

function MiniBtn({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        border: "1px solid var(--border)", background: "#fff", color: "#475569", borderRadius: 8,
        padding: "0.25rem 0.5rem", fontSize: "0.72rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
