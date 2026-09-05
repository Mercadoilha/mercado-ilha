"use client";

import { useEffect, useMemo, useState } from "react";
import BottomSheet from "../../../components/BottomSheet";
import QtyStepper from "../QtyStepper";
import { supabase } from "../../../lib/supabaseClient";
import { fold } from "../../../lib/searchNorm";
import { indexVariants, itemName, lineTotal, type Catalog, type Product, type Variant } from "../../../lib/mercadoApi";
import { formatBRL, type CartMap } from "../../../lib/mercadoCart";

type Extra = { name: string; quantity: number; unit_price: number };

// Somar ao pedido o que a pessoa acabou levando na feira: do catálogo (o preço
// sai da base) ou escrito à mão, para o que não está na lista.
export default function AdicionarSheet({
  orderId, onClose, onDone,
}: {
  orderId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<CartMap>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [exName, setExName] = useState("");
  const [exPrice, setExPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_market_catalog", { p_vendor_slug: "feira-agroecologica-gamboa" })
      .then(({ data }) => { if (alive) setCatalog((data ?? null) as Catalog); }, () => {});
    return () => { alive = false; };
  }, []);

  const index = useMemo(() => indexVariants(catalog?.sections ?? []), [catalog]);

  // Lista plana de todas as opções de compra, para procurar por nome.
  const all = useMemo(() => {
    const rows: { variant: Variant; product: Product; hay: string }[] = [];
    for (const [, e] of index) {
      rows.push({ variant: e.variant, product: e.product, hay: fold(`${e.product.name} ${e.variant.label}`) });
    }
    return rows;
  }, [index]);

  const results = useMemo(() => {
    const q = fold(search.trim());
    if (q.length < 2) return [];
    return all.filter((r) => r.hay.includes(q)).slice(0, 25);
  }, [all, search]);

  const total = useMemo(() => {
    let sum = 0;
    for (const [id, qty] of Object.entries(picked)) {
      const e = index.get(Number(id));
      if (e) sum += lineTotal(e.variant, qty);
    }
    for (const x of extras) sum += x.quantity * x.unit_price;
    return Math.round(sum * 100) / 100;
  }, [picked, extras, index]);

  const nothingPicked = Object.keys(picked).length === 0 && extras.length === 0;

  const setQty = (variantId: number, qty: number) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (qty > 0) next[variantId] = qty; else delete next[variantId];
      return next;
    });

  const addExtra = () => {
    const name = exName.trim();
    const price = Number(exPrice.replace(",", "."));
    if (!name) { setError("Escreva o que você levou."); return; }
    if (!Number.isFinite(price) || price < 0) { setError("Escreva um valor válido."); return; }
    setExtras((prev) => [...prev, { name, quantity: 1, unit_price: Math.round(price * 100) / 100 }]);
    setExName(""); setExPrice(""); setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const items = Object.entries(picked).map(([id, qty]) => ({ variant_id: Number(id), quantity: qty }));
    const { error: err } = await supabase.rpc("add_pickup_items", {
      p_order_id: orderId,
      p_items: items,
      p_extras: extras,
    });
    setSaving(false);
    if (err) { setError("Não foi possível adicionar. Tente de novo."); return; }
    onDone();
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.9rem", width: "100%", fontFamily: "inherit", outline: "none",
  };

  return (
    <BottomSheet
      title="Adicionar ao pedido"
      subtitle="O que você levou a mais na feira"
      onClose={onClose}
    >
      {/* ── Do catálogo ── */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar no catálogo (ex.: banana)"
        style={inputStyle}
      />

      {search.trim().length >= 2 && results.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "10px 2px" }}>
          Nada com esse nome. Use “Outro item”, aqui embaixo.
        </p>
      )}

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}>
          {results.map(({ variant, product }) => (
            <div
              key={variant.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                background: "#F7FBF9", border: "1px solid #E3F1EA", borderRadius: 10, padding: "0.45rem 0.6rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                  {itemName(product, variant)}
                </div>
                <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--green-dark)" }}>
                  {formatBRL(variant.price)}
                  <span style={{ fontWeight: 600, color: "var(--text-muted)" }}> / {variant.unit_label}</span>
                </div>
              </div>
              <QtyStepper variant={variant} qty={picked[variant.id] ?? 0} onChange={setQty} />
            </div>
          ))}
        </div>
      )}

      {/* ── Item livre ── */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 8 }}>
          Outro item (não está no catálogo)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            placeholder="O que você levou"
            maxLength={80}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={exPrice}
            onChange={(e) => setExPrice(e.target.value)}
            inputMode="decimal"
            placeholder="R$"
            style={{ ...inputStyle, width: 88, flexShrink: 0 }}
          />
        </div>
        <button
          type="button"
          onClick={addExtra}
          className="btn btn-outline btn-block"
          style={{ marginTop: 8, fontSize: "0.82rem" }}
        >
          Adicionar à lista
        </button>
      </div>

      {/* ── O que vai ser somado ── */}
      {!nothingPicked && (
        <div style={{ marginTop: 14, background: "#F7FBF9", border: "1px solid #E3F1EA", borderRadius: 12, padding: "0.7rem 0.8rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--green-dark)", marginBottom: 6 }}>
            Vai ser somado ao pedido
          </div>
          {Object.entries(picked).map(([id, qty]) => {
            const e = index.get(Number(id));
            if (!e) return null;
            return (
              <Row
                key={id}
                text={`${qty} × ${itemName(e.product, e.variant)}`}
                value={formatBRL(lineTotal(e.variant, qty))}
                onRemove={() => setQty(Number(id), 0)}
              />
            );
          })}
          {extras.map((x, i) => (
            <Row
              key={`x-${i}`}
              text={`${x.quantity} × ${x.name}`}
              value={formatBRL(x.quantity * x.unit_price)}
              onRemove={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800, color: "var(--green-dark)" }}>
            <span style={{ fontSize: "0.82rem" }}>Total a somar</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 10 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={nothingPicked || saving}
        className="btn btn-primary btn-block"
        style={{ marginTop: 14, background: "var(--green-dark)" }}
      >
        {saving ? "Salvando…" : "Salvar no pedido"}
      </button>

      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
        Isto fica só no seu histórico: não é um pedido novo e não vai para a feira.
      </p>
    </BottomSheet>
  );
}

function Row({ text, value, onRemove }: { text: string; value: string; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: "0.8rem", color: "#475569", padding: "0.15rem 0" }}>
      <span style={{ minWidth: 0, flex: 1 }}>{text}</span>
      <span style={{ fontWeight: 700, flexShrink: 0 }}>{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Tirar da lista"
        style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
