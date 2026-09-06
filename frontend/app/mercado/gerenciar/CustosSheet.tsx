"use client";

import { useMemo, useState } from "react";
import BottomSheet from "../../../components/BottomSheet";
import { supabase } from "../../../lib/supabaseClient";
import { formatBRL } from "../../../lib/mercadoCart";
import { ilhaToday } from "./periodo";
import type { AdminSection } from "./types";

// Corrigir custos que já foram gravados.
//
// A aba Catálogo muda o custo de hoje em diante. Isto é para o outro caso: um
// custo que só se soube DEPOIS da venda (o produtor cobrou outro valor, mudou no
// meio do mês, alguém digitou errado). Aqui se editam os custos numa lista, com
// o preço de venda ao lado, e se escolhe A PARTIR DE QUE DATA esse custo vale —
// o que é anterior a essa data fica intocado, como deve ser.
//
// Sempre passa por uma confirmação que diz quantas vendas vão mudar: isto
// reescreve números já registrados, ao contrário do botão de preencher vazios.

type Row = {
  variantId: number;
  section: string;
  emoji: string | null;
  product: string;
  label: string;
  unitLabel: string;
  price: number;
  cost: number | null;
};

type Preview = { itens: number; itens_vazios: number; pedidos: number; variantes: number };

// Chips de data: os começos de período que a feira realmente usa.
function dateOptions(): { key: string; label: string; value: string }[] {
  const today = ilhaToday();
  const [y, m] = today.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return [
    { key: "hoje", label: "Só de hoje", value: today },
    { key: "mes", label: "Este mês", value: `${today.slice(0, 7)}-01` },
    { key: "passado", label: "Mês passado", value: `${prevY}-${String(prevM).padStart(2, "0")}-01` },
  ];
}

function toBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function CustosSheet({
  vendorId, sections, onClose, onDone,
}: {
  vendorId: number;
  sections: AdminSection[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(ilhaToday());
  const [step, setStep] = useState<"editar" | "confirmar" | "pronto">("editar");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Só o que está à venda: corrigir o custo de algo oculto não muda nenhuma conta.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of sections) {
      for (const p of s.products) {
        if (!p.is_active) continue;
        for (const v of p.variants) {
          if (!v.is_active) continue;
          out.push({
            variantId: v.id, section: s.name, emoji: s.emoji, product: p.name,
            label: v.label, unitLabel: v.unit_label, price: Number(v.price),
            cost: v.cost_price == null ? null : Number(v.cost_price),
          });
        }
      }
    }
    return out;
  }, [sections]);

  const term = search.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visible = useMemo(
    () =>
      term === ""
        ? rows
        : rows.filter((r) =>
            `${r.product} ${r.label} ${r.section}`
              .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .includes(term),
          ),
    [rows, term],
  );

  // Uma mudança é real quando o texto digitado dá um número diferente do que
  // está gravado. Reescrever um campo com o mesmo valor não conta.
  const changes = useMemo(() => {
    const out: { variant_id: number; cost_price: number | null }[] = [];
    for (const r of rows) {
      const raw = edits[r.variantId];
      if (raw === undefined) continue;
      const trimmed = raw.trim();
      if (trimmed === "") {
        if (r.cost !== null) out.push({ variant_id: r.variantId, cost_price: null });
        continue;
      }
      const value = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) continue;
      const rounded = Math.round(value * 100) / 100;
      if (r.cost === null || Math.abs(r.cost - rounded) > 0.0001) {
        out.push({ variant_id: r.variantId, cost_price: rounded });
      }
    }
    return out;
  }, [rows, edits]);

  const invalid = useMemo(
    () =>
      Object.values(edits).some((raw) => {
        const t = raw.trim();
        if (t === "") return false;
        const v = Number(t.replace(",", "."));
        return !Number.isFinite(v) || v < 0;
      }),
    [edits],
  );

  const run = async (dryRun: boolean) => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.rpc("apply_costs_from", {
      p_vendor_id: vendorId,
      p_changes: changes,
      p_from: from,
      p_dry_run: dryRun,
    });
    setBusy(false);
    if (err) { setError("Não foi possível aplicar agora. Tente de novo."); return; }
    setPreview(data as Preview);
    setStep(dryRun ? "confirmar" : "pronto");
    if (!dryRun) await onDone();
  };

  const input: React.CSSProperties = {
    padding: "0.55rem 0.7rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.88rem", width: "100%", fontFamily: "inherit", outline: "none",
  };

  // ---- Pronto ----
  if (step === "pronto" && preview) {
    return (
      <BottomSheet title="Custos corrigidos" subtitle={`A partir de ${toBR(from)}`} onClose={onClose}>
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "0.9rem 1rem" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>✓</div>
          <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#065F46" }}>
            {preview.variantes} {preview.variantes === 1 ? "custo atualizado" : "custos atualizados"} no catálogo
          </div>
          <p style={{ fontSize: "0.8rem", color: "#065F46", lineHeight: 1.5, marginTop: 4 }}>
            {preview.itens === 0
              ? "Nenhuma venda anterior precisou de ajuste."
              : `${preview.itens} ${preview.itens === 1 ? "item" : "itens"} de ${preview.pedidos} ${preview.pedidos === 1 ? "pedido" : "pedidos"} desde ${toBR(from)} passaram a contar o custo novo.`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-block" style={{ marginTop: 14, background: "var(--green-dark)", color: "#fff", fontWeight: 800 }}>
          Fechar
        </button>
      </BottomSheet>
    );
  }

  // ---- Confirmação ----
  if (step === "confirmar" && preview) {
    return (
      <BottomSheet title="Confirmar" subtitle="Isto muda números já registrados" onClose={onClose}>
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "0.9rem 1rem" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#92400E" }}>
            {preview.variantes} {preview.variantes === 1 ? "custo será alterado" : "custos serão alterados"}
          </div>
          <p style={{ fontSize: "0.82rem", color: "#78350F", lineHeight: 1.55, marginTop: 6 }}>
            O novo custo passa a valer no catálogo e é aplicado às vendas <strong>a partir de {toBR(from)}</strong>.
          </p>
          <div style={{ marginTop: 10, background: "#fff", border: "1px solid #FDE68A", borderRadius: 10, padding: "0.6rem 0.7rem", fontSize: "0.8rem", color: "#78350F", lineHeight: 1.6 }}>
            {preview.itens === 0 ? (
              <>• Nenhuma venda registrada desde essa data será afetada.</>
            ) : (
              <>
                • {preview.itens} {preview.itens === 1 ? "item vendido" : "itens vendidos"} em {preview.pedidos}{" "}
                {preview.pedidos === 1 ? "pedido" : "pedidos"}
                {preview.itens_vazios > 0 && (
                  <span style={{ color: "var(--text-muted)" }}> ({preview.itens_vazios} estavam sem custo)</span>
                )}
                <br />• Tudo o que é anterior a {toBR(from)} fica como está.
              </>
            )}
          </div>
        </div>

        {error && <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 12 }}>{error}</p>}

        <button type="button" onClick={() => void run(false)} disabled={busy} className="btn btn-block" style={{ marginTop: 14, background: "#92400E", color: "#fff", fontWeight: 800 }}>
          {busy ? "Aplicando…" : "Sim, aplicar"}
        </button>
        <button type="button" onClick={() => { setStep("editar"); setPreview(null); }} className="btn btn-outline btn-block" style={{ marginTop: 8, fontWeight: 700 }}>
          Voltar e revisar
        </button>
      </BottomSheet>
    );
  }

  // ---- Lista ----
  let lastSection = "";
  let lastProduct = "";

  return (
    <BottomSheet
      title="Corrigir custos"
      subtitle="Mude o custo e escolha a partir de que data ele vale"
      onClose={onClose}
    >
      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 10 }}>
        Use isto quando um custo mudou ou foi digitado errado <strong>depois</strong> de já ter vendido.
        As vendas anteriores à data escolhida não se tocam.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar produto…"
        style={{ ...input, marginBottom: 10 }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {visible.map((r) => {
          const edited = edits[r.variantId] !== undefined;
          const shown = edited
            ? edits[r.variantId]
            : r.cost == null
              ? ""
              : String(r.cost).replace(".", ",");
          const num = shown.trim() === "" ? null : Number(shown.trim().replace(",", "."));
          const valid = num === null || (Number.isFinite(num) && num >= 0);
          const margem = num !== null && valid && r.price > 0 ? Math.round(((r.price - num) / r.price) * 100) : null;

          const newSection = r.section !== lastSection;
          const newProduct = r.product !== lastProduct || newSection;
          lastSection = r.section;
          lastProduct = r.product;

          return (
            <div key={r.variantId}>
              {newSection && (
                <div style={{ marginTop: 12, marginBottom: 4, fontSize: "0.7rem", fontWeight: 800, color: "var(--green-dark)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {r.emoji ? `${r.emoji} ` : ""}{r.section}
                </div>
              )}
              {newProduct && (
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginTop: newSection ? 0 : 8 }}>
                  {r.product}
                </div>
              )}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                  background: edited ? "#F0FDF4" : "#F7FBF9",
                  border: `1px solid ${edited ? "var(--green-sea)" : "#E3F1EA"}`,
                  borderRadius: 10, padding: "0.4rem 0.55rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    venda {formatBRL(r.price)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>R$</span>
                  <input
                    value={shown}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [r.variantId]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`Custo de ${r.product} ${r.label}`}
                    style={{
                      width: 62, padding: "0.28rem 0.35rem", borderRadius: 8, textAlign: "right",
                      border: `1.5px solid ${!valid ? "#b91c1c" : edited ? "var(--green-dark)" : r.cost == null ? "#FCD34D" : "var(--border)"}`,
                      background: r.cost == null && !edited ? "#FFFBEB" : "#fff",
                      fontSize: "0.8rem", fontWeight: 700, fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ width: 34, flexShrink: 0, textAlign: "right", fontSize: "0.68rem", fontWeight: 800, color: margem === null ? "var(--text-muted)" : margem >= 0 ? "var(--green-dark)" : "#b91c1c" }}>
                  {margem === null ? "—" : `${margem}%`}
                </div>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "1.5rem 0" }}>
            Nenhum produto com esse nome.
          </p>
        )}
      </div>

      {/* Rodapé fixo: a data manda, por isso viaja junto com o botão. */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 12, paddingBottom: 4 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", marginBottom: 6 }}>
          Aplicar a partir de
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {dateOptions().map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setFrom(o.value)}
              style={{
                border: `1.5px solid ${from === o.value ? "var(--green-dark)" : "var(--border)"}`,
                background: from === o.value ? "var(--green-dark)" : "#fff",
                color: from === o.value ? "#fff" : "#475569",
                borderRadius: 999, padding: "0.28rem 0.65rem", fontSize: "0.74rem",
                fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input type="date" value={from} max={ilhaToday()} onChange={(e) => setFrom(e.target.value)} style={input} />
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.45, margin: "6px 0 0" }}>
          As vendas do balcão (“Venda na feira”) guardam um custo total, não por produto — essas
          se corrigem apagando e lançando de novo.
        </p>

        {error && <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 8 }}>{error}</p>}

        <button
          type="button"
          onClick={() => void run(true)}
          disabled={busy || changes.length === 0 || invalid}
          className="btn btn-block"
          style={{
            marginTop: 10, fontWeight: 800,
            background: changes.length === 0 || invalid ? "#CBD5E1" : "var(--green-dark)",
            color: "#fff",
          }}
        >
          {busy
            ? "Conferindo…"
            : invalid
              ? "Há um custo inválido"
              : changes.length === 0
                ? "Mude algum custo para continuar"
                : `Rever ${changes.length} ${changes.length === 1 ? "mudança" : "mudanças"}`}
        </button>
      </div>
    </BottomSheet>
  );
}
