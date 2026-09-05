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
  const [costs, setCosts] = useState<Record<number, string>>({});
  const [onlyMissingCost, setOnlyMissingCost] = useState(false);
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
        .map((s) => ({
          ...s,
          products: s.products.filter(
            (p) =>
              (showHidden || p.is_active) &&
              (!onlyMissingCost || p.variants.some((v) => v.is_active && v.cost_price == null)),
          ),
        }))
        .filter((s) => s.products.length > 0),
    [sections, showHidden, onlyMissingCost],
  );

  // Quantas opções ativas ainda estão sem custo. É o que separa a feira de
  // poder ver o lucro no Caixa.
  const missingCost = useMemo(() => {
    let missing = 0, total = 0;
    for (const s of sections) {
      for (const p of s.products) {
        if (!p.is_active) continue;
        for (const v of p.variants) {
          if (!v.is_active) continue;
          total++;
          if (v.cost_price == null) missing++;
        }
      }
    }
    return { missing, total };
  }, [sections]);

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

  const saveCost = async (variant: AdminVariant) => {
    const raw = costs[variant.id];
    const trimmed = String(raw).trim();
    // Campo vazio = "não sei ainda": volta a ficar sem custo, sem inventar zero.
    const value = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0)) { setError("Custo inválido."); return; }
    const ok = await patchVariant(variant, { cost_price: value === null ? null : Math.round(value * 100) / 100 });
    if (ok) setCosts((prev) => { const next = { ...prev }; delete next[variant.id]; return next; });
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

      {/* O custo é opcional, mas sem ele não há lucro possível. Em vez de um
          número aproximado, o painel mostra exatamente o que falta. */}
      {missingCost.missing > 0 && (
        <div style={{ background: "#FFFBEB", borderBottom: "1px solid #FCD34D", padding: "0.7rem 1rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#92400E" }}>
            {missingCost.missing} de {missingCost.total} opções ainda sem custo
          </div>
          <p style={{ fontSize: "0.74rem", color: "#92400E", lineHeight: 1.45, marginTop: 2 }}>
            O custo fica ao lado do preço e é opcional — mas o lucro no Caixa só é calculado quando
            todas as opções vendidas têm custo informado. Um lucro pela metade seria um número errado.
          </p>
          <button
            type="button"
            onClick={() => setOnlyMissingCost((v) => !v)}
            style={{ marginTop: 8, border: "1.5px solid #92400E", background: onlyMissingCost ? "#92400E" : "transparent", color: onlyMissingCost ? "#fff" : "#92400E", borderRadius: 8, padding: "0.3rem 0.6rem", fontSize: "0.74rem", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}
          >
            {onlyMissingCost ? "Ver todos os produtos" : "Ver só o que falta"}
          </button>
        </div>
      )}

      {missingCost.missing === 0 && missingCost.total > 0 && (
        <div style={{ background: "#ECFDF5", borderBottom: "1px solid #A7F3D0", padding: "0.55rem 1rem", fontSize: "0.76rem", color: "#065F46", fontWeight: 700 }}>
          ✓ Todos os custos preenchidos — o lucro aparece no Caixa.
        </div>
      )}

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
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {section.emoji ? `${section.emoji} ` : ""}{section.name}{!section.is_active && " (oculta)"}
              </span>
              {/* Quanto falta nesta seção: completando uma seção inteira já se
                  vê a margem dela no Caixa, sem esperar o catálogo todo. */}
              {(() => {
                const faltam = section.products.reduce(
                  (acc, p) => acc + (p.is_active ? p.variants.filter((v) => v.is_active && v.cost_price == null).length : 0),
                  0,
                );
                return faltam > 0 ? (
                  <span style={{ background: "#FCD34D", color: "#78350F", borderRadius: 999, padding: "1px 6px", fontSize: "0.62rem", fontWeight: 800, flexShrink: 0, textTransform: "none" }}>
                    {faltam} sem custo
                  </span>
                ) : (
                  <span style={{ color: "var(--green-sea)", fontSize: "0.7rem", flexShrink: 0 }}>✓</span>
                );
              })()}
            </span>
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
                  const costEdited = costs[variant.id] !== undefined;
                  // Margem da opção: quanto do preço sobra depois do custo.
                  const margem =
                    variant.cost_price != null && Number(variant.price) > 0
                      ? Math.round(((Number(variant.price) - Number(variant.cost_price)) / Number(variant.price)) * 100)
                      : null;
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

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <MoneyField
                          caption="preço"
                          value={edited ? prices[variant.id] : String(variant.price).replace(".", ",")}
                          edited={edited}
                          onChange={(v) => setPrices((prev) => ({ ...prev, [variant.id]: v }))}
                          onSave={() => savePrice(variant)}
                          busy={busy === variant.id}
                        />
                        <MoneyField
                          caption="custo"
                          value={costEdited ? costs[variant.id] : variant.cost_price == null ? "" : String(variant.cost_price).replace(".", ",")}
                          edited={costEdited}
                          missing={variant.cost_price == null && !costEdited}
                          onChange={(v) => setCosts((prev) => ({ ...prev, [variant.id]: v }))}
                          onSave={() => saveCost(variant)}
                          busy={busy === variant.id}
                        />
                        {margem !== null && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, color: margem >= 0 ? "var(--green-dark)" : "#b91c1c", flexShrink: 0 }}>
                            {margem}%
                          </span>
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

// Preço e custo compartilham o mesmo campo: número à direita, legenda embaixo e
// o botão de salvar só aparece quando algo mudou. O custo em falta fica âmbar,
// para que se veja de longe o que ainda precisa ser preenchido.
function MoneyField({
  caption, value, edited, missing, busy, onChange, onSave,
}: {
  caption: string;
  value: string;
  edited: boolean;
  missing?: boolean;
  busy?: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const border = edited ? "var(--green-dark)" : missing ? "#FCD34D" : "var(--border)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>R$</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            placeholder={missing ? "—" : ""}
            style={{
              width: 62, padding: "0.28rem 0.35rem", border: `1.5px solid ${border}`,
              borderRadius: 8, fontSize: "0.8rem", fontWeight: 700, fontFamily: "inherit",
              textAlign: "right", background: missing ? "#FFFBEB" : "#fff",
            }}
          />
        </div>
        <div style={{ fontSize: "0.6rem", color: missing ? "#B45309" : "var(--text-muted)", textAlign: "center", marginTop: 1 }}>
          {caption}
        </div>
      </div>
      {edited && (
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          style={{ border: "none", background: "var(--green-dark)", color: "#fff", borderRadius: 8, padding: "0.28rem 0.45rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
        >
          {busy ? "…" : "ok"}
        </button>
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
