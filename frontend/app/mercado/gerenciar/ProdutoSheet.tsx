"use client";

import { useState } from "react";
import BottomSheet from "../../../components/BottomSheet";
import { supabase } from "../../../lib/supabaseClient";
import type { AdminProduct, AdminSection } from "./types";

type Config =
  | { mode: "novo-produto"; sectionId: number }
  | { mode: "editar-produto"; product: AdminProduct }
  | { mode: "nova-opcao"; product: AdminProduct };

// As três formas de vender, do jeito que a feira fala. Cada uma já traz as regras
// de quantidade prontas — ninguém precisa saber o que é "passo" ou "mínimo".
const SALE_MODES = [
  {
    key: "unidade" as const,
    title: "Por unidade",
    hint: "Manga, coco, milho… conta-se de um em um.",
    unit: "unid.", step: 1, min: 1,
  },
  {
    key: "peso" as const,
    title: "Por quilo",
    hint: "Aipim, abóbora… aceita meio quilo.",
    unit: "kg", step: 0.5, min: 0.5,
  },
  {
    key: "pacote" as const,
    title: "Pacote fechado",
    hint: "Maço, dúzia, 500g, 200ml… vende-se inteiro.",
    unit: "", step: 1, min: 1,
  },
];

export default function ProdutoSheet({
  vendorId, sections, config, onClose, onDone,
}: {
  vendorId: number;
  sections: AdminSection[];
  config: Config;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const editing = config.mode === "editar-produto" ? config.product : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  // Em que seção o produto está (ou em qual vai entrar, se for novo).
  const currentSectionId =
    config.mode === "novo-produto"
      ? config.sectionId
      : sections.find((s) => s.products.some((p) => p.id === config.product.id))?.id ?? sections[0]?.id ?? 0;
  const [sectionId, setSectionId] = useState<number>(currentSectionId);

  const [seasonal, setSeasonal] = useState(editing?.is_seasonal ?? false);
  const [alcoholic, setAlcoholic] = useState(editing?.is_alcoholic ?? false);

  const [mode, setMode] = useState<"unidade" | "peso" | "pacote">("pacote");
  const [unit, setUnit] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsVariant = config.mode !== "editar-produto";
  const chosen = SALE_MODES.find((m) => m.key === mode)!;

  const save = async () => {
    setError(null);

    if (config.mode === "editar-produto") {
      if (!name.trim()) { setError("O produto precisa de um nome."); return; }
      setSaving(true);
      const { error: err } = await supabase
        .from("market_products")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_seasonal: seasonal,
          is_alcoholic: alcoholic,
          category_id: sectionId,
        })
        .eq("id", config.product.id);
      setSaving(false);
      if (err) { setError("Não foi possível salvar."); return; }
      await onDone();
      return;
    }

    // Dados da opção de venda (vale para produto novo e para opção nova)
    const unitLabel = (mode === "pacote" ? unit.trim() : chosen.unit) || chosen.unit;
    if (!unitLabel) { setError("Escreva como é o pacote (maço, dúzia, 500g…)."); return; }
    const value = Number(price.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { setError("Escreva o preço."); return; }
    const finalLabel = label.trim() || unitLabel;

    setSaving(true);

    let productId: number;
    if (config.mode === "novo-produto") {
      if (!name.trim()) { setSaving(false); setError("O produto precisa de um nome."); return; }
      const { data, error: err } = await supabase.rpc("create_market_product", {
        p_vendor_id: vendorId,
        p_category_id: sectionId,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_is_seasonal: seasonal,
        p_is_alcoholic: alcoholic,
      });
      if (err || !data) { setSaving(false); setError("Não foi possível criar o produto."); return; }
      productId = Number(data);
    } else {
      productId = config.product.id;
    }

    // Custo em branco é aceito: fica pendente e o painel avisa depois.
    const costRaw = cost.trim();
    const costValue = costRaw === "" ? null : Number(costRaw.replace(",", "."));
    if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) {
      setSaving(false); setError("Custo inválido."); return;
    }

    const { error: vErr } = await supabase.from("market_product_variants").insert({
      product_id: productId,
      label: finalLabel,
      sale_mode: mode,
      unit_label: unitLabel,
      price: Math.round(value * 100) / 100,
      cost_price: costValue === null ? null : Math.round(costValue * 100) / 100,
      step: chosen.step,
      min_qty: chosen.min,
      sort_order: 99,
    });
    setSaving(false);
    if (vErr) { setError("O produto foi criado, mas a opção de venda não. Tente adicioná-la de novo."); return; }
    await onDone();
  };

  const input: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.9rem", width: "100%", fontFamily: "inherit", outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 5 };

  const title =
    config.mode === "novo-produto" ? "Novo produto"
    : config.mode === "editar-produto" ? "Editar produto"
    : "Nova opção de venda";

  return (
    <BottomSheet
      title={title}
      subtitle={config.mode === "nova-opcao" ? config.product.name : undefined}
      onClose={onClose}
    >
      {config.mode !== "nova-opcao" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Nome do produto</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Banana prata" maxLength={120} style={input} />
          </div>
          <div>
            <label style={labelStyle}>Seção</label>
            <select value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))} style={input}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descrição (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} style={input} placeholder="Ex.: Sem conservantes" />
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", color: "#334155" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={seasonal} onChange={(e) => setSeasonal(e.target.checked)} /> Sazonal
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={alcoholic} onChange={(e) => setAlcoholic(e.target.checked)} /> Bebida alcoólica
            </label>
          </div>
        </div>
      )}

      {needsVariant && (
        <div style={{ marginTop: config.mode === "nova-opcao" ? 0 : 16, paddingTop: config.mode === "nova-opcao" ? 0 : 14, borderTop: config.mode === "nova-opcao" ? "none" : "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--green-dark)", marginBottom: 8 }}>
            Como se vende
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SALE_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                style={{
                  textAlign: "left", border: `1.5px solid ${mode === m.key ? "var(--green-dark)" : "var(--border)"}`,
                  background: mode === m.key ? "#F2FBF7" : "#fff", borderRadius: 10, padding: "0.55rem 0.7rem",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: mode === m.key ? "var(--green-dark)" : "#334155" }}>{m.title}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{m.hint}</div>
              </button>
            ))}
          </div>

          {mode === "pacote" && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>O pacote é de…</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="maço, dúzia, 500g, 200ml…" maxLength={30} style={input} />
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Preço (R$)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Custo (R$)</label>
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                inputMode="decimal"
                placeholder="opcional"
                style={{ ...input, borderColor: cost.trim() === "" ? "#FCD34D" : "var(--border)", background: cost.trim() === "" ? "#FFFBEB" : "#fff" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "0.7rem", color: "#92400E", marginTop: 6, lineHeight: 1.4 }}>
            O custo é opcional, mas o lucro no Caixa só é calculado quando todos os produtos vendidos
            têm custo informado.
          </p>

          <div style={{ marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Nome da opção</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={mode === "pacote" ? (unit || "igual ao pacote") : chosen.unit}
                maxLength={40}
                style={input}
              />
            </div>
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
            O nome da opção só é preciso quando o produto tem mais de uma (ex.: “200ml”, “500ml”, ou o sabor).
            Em branco, usa o próprio pacote.
          </p>
        </div>
      )}

      {error && <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 12 }}>{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn btn-primary btn-block"
        style={{ marginTop: 16, background: "var(--green-dark)" }}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </BottomSheet>
  );
}
