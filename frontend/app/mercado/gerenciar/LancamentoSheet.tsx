"use client";

import { useState } from "react";
import BottomSheet from "../../../components/BottomSheet";
import { supabase } from "../../../lib/supabaseClient";

export type CostCategory = { id: number; name: string };

// Lançar no caixa: uma venda feita na própria feira ou um custo.
// As categorias de custo são opcionais — dá para lançar sem nenhuma, e quem
// quiser separar cria as suas aqui mesmo.
export default function LancamentoSheet({
  kind, vendorId, categories, defaultDate, onClose, onDone,
}: {
  kind: "venda" | "custo";
  vendorId: number;
  categories: CostCategory[];
  defaultDate: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [saleCost, setSaleCost] = useState("");
  const [categoryId, setCategoryId] = useState<number | "" | "nova">("");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { setError("Escreva o valor."); return; }
    if (kind === "custo" && !text.trim()) { setError("Escreva o que foi o gasto."); return; }

    setSaving(true);

    if (kind === "venda") {
      // Custo desta venda: opcional, mas é o que permite calcular o lucro do
      // que se vendeu no balcão. Em branco = fica pendente.
      const costRaw = saleCost.trim();
      const cost = costRaw === "" ? null : Number(costRaw.replace(",", "."));
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) { setSaving(false); setError("Custo inválido."); return; }

      const { error: err } = await supabase.from("market_sales").insert({
        vendor_id: vendorId,
        sold_on: date,
        amount: Math.round(value * 100) / 100,
        cost_amount: cost === null ? null : Math.round(cost * 100) / 100,
        note: text.trim() || null,
      });
      setSaving(false);
      if (err) { setError("Não foi possível salvar."); return; }
      await onDone();
      return;
    }

    // Custo: se a pessoa escolheu criar uma categoria nova, cria antes.
    let finalCategory: number | null = typeof categoryId === "number" ? categoryId : null;
    if (categoryId === "nova") {
      const name = newCategory.trim();
      if (!name) { setSaving(false); setError("Escreva o nome da categoria."); return; }
      const { data, error: catErr } = await supabase
        .from("market_cost_categories")
        .insert({ vendor_id: vendorId, name })
        .select("id")
        .single();
      if (catErr || !data) { setSaving(false); setError("Não foi possível criar a categoria."); return; }
      finalCategory = data.id;
    }

    const { error: err } = await supabase.from("market_costs").insert({
      vendor_id: vendorId,
      category_id: finalCategory,
      spent_on: date,
      description: text.trim(),
      amount: Math.round(value * 100) / 100,
    });
    setSaving(false);
    if (err) { setError("Não foi possível salvar."); return; }
    await onDone();
  };

  const input: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.9rem", width: "100%", fontFamily: "inherit", outline: "none",
  };
  const label: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 5 };

  return (
    <BottomSheet
      title={kind === "venda" ? "Venda na feira" : "Custo"}
      subtitle={kind === "venda" ? "O que vendeu no dia e não passou pelo app" : "O que a feira gastou"}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Valor (R$)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} />
          </div>
        </div>

        {kind === "venda" && (
          <div>
            <label style={label}>Custo dos produtos vendidos (opcional)</label>
            <input
              value={saleCost}
              onChange={(e) => setSaleCost(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              style={{ ...input, borderColor: saleCost.trim() === "" ? "#FCD34D" : "var(--border)", background: saleCost.trim() === "" ? "#FFFBEB" : "#fff" }}
            />
            <p style={{ fontSize: "0.7rem", color: "#92400E", marginTop: 6, lineHeight: 1.4 }}>
              Quanto custou para a feira o que foi vendido nesta venda. Sem esta informação, o lucro
              do período não pode ser calculado — o resultado de caixa continua funcionando.
            </p>
          </div>
        )}

        <div>
          <label style={label}>{kind === "venda" ? "Observação (opcional)" : "O que foi"}</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "venda" ? "Ex.: vendas do balcão" : "Ex.: transporte, embalagens"}
            maxLength={160}
            style={input}
          />
        </div>

        {kind === "custo" && (
          <div>
            <label style={label}>Categoria (opcional)</label>
            <select
              value={categoryId}
              onChange={(e) => {
                const v = e.target.value;
                setCategoryId(v === "" ? "" : v === "nova" ? "nova" : Number(v));
              }}
              style={input}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="nova">+ Criar categoria…</option>
            </select>
            {categoryId === "nova" && (
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nome da categoria (ex.: Transporte)"
                maxLength={40}
                style={{ ...input, marginTop: 8 }}
              />
            )}
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
              Só se você quiser separar os gastos. Sem categoria também funciona.
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 12 }}>{error}</p>}

      <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-block" style={{ marginTop: 16, background: "var(--green-dark)" }}>
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </BottomSheet>
  );
}
