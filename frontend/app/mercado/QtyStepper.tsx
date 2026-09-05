"use client";

import type { Variant } from "../../lib/mercadoApi";
import { formatQty } from "../../lib/mercadoCart";

// Seletor de quantidade. Obedece a forma de venda da variante: o que se vende por
// quilo anda de meio em meio (0,5 kg), o resto anda de um em um e nunca aceita
// fração — passo e mínimo vêm da base, não estão escritos aqui.
export default function QtyStepper({
  variant, qty, onChange,
}: {
  variant: Variant;
  qty: number;
  onChange: (variantId: number, qty: number) => void;
}) {
  const step = variant.step > 0 ? variant.step : 1;
  const min = variant.min_qty > 0 ? variant.min_qty : step;
  const max = variant.max_qty ?? 99;
  const round = (n: number) => Math.round(n * 1000) / 1000;

  if (qty <= 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(variant.id, min)}
        aria-label={`Adicionar ${variant.label}`}
        style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: "1.5px solid var(--green-dark)",
          background: "#fff", color: "var(--green-dark)", fontSize: "1.15rem", fontWeight: 700,
          lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        +
      </button>
    );
  }

  const btn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
    color: "var(--green-dark)", fontSize: "1.15rem", fontWeight: 800, lineHeight: 1,
    cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <div
      style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
        border: "1.5px solid var(--green-dark)", borderRadius: 10, background: "#fff", padding: "1px 2px",
      }}
    >
      <button
        type="button" style={btn} aria-label="Diminuir"
        onClick={() => onChange(variant.id, round(qty - step) < min ? 0 : round(qty - step))}
      >
        −
      </button>
      <span style={{ minWidth: 46, textAlign: "center", fontSize: "0.82rem", fontWeight: 800, color: "#1e293b" }}>
        {formatQty(qty)}{variant.sale_mode === "peso" ? ` ${variant.unit_label}` : ""}
      </span>
      <button
        type="button" style={btn} aria-label="Aumentar" disabled={qty >= max}
        onClick={() => onChange(variant.id, Math.min(max, round(qty + step)))}
      >
        +
      </button>
    </div>
  );
}
