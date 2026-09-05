"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { AdminVendor } from "./types";

// Os dados que o cliente vê no topo do mercado, o WhatsApp que recebe os pedidos
// e a chave de pausar tudo. Passa por uma função da base que só deixa mexer
// nestes campos — nunca no dono nem no endereço interno da feira.
export default function AjustesTab({ vendor, onReload }: { vendor: AdminVendor; onReload: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: vendor.name ?? "",
    tagline: vendor.tagline ?? "",
    description: vendor.description ?? "",
    whatsapp: vendor.whatsapp ?? "",
    pickup_place: vendor.pickup_place ?? "",
    delivery_day: vendor.delivery_day ?? "",
    deadline_text: vendor.deadline_text ?? "",
    footer_note: vendor.footer_note ?? "",
    is_active: vendor.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setMsg(null);
  };

  const save = async () => {
    setSaving(true); setError(null); setMsg(null);
    const { error: err } = await supabase.rpc("update_market_vendor", {
      p_vendor_id: vendor.id,
      p_name: form.name,
      p_tagline: form.tagline,
      p_description: form.description,
      p_whatsapp: form.whatsapp,
      p_pickup_place: form.pickup_place,
      p_delivery_day: form.delivery_day,
      p_deadline_text: form.deadline_text,
      p_footer_note: form.footer_note,
      p_is_active: form.is_active,
    });
    setSaving(false);
    if (err) { setError("Não foi possível salvar."); return; }
    setMsg("Tudo salvo!");
    await onReload();
  };

  const input: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.9rem", width: "100%", fontFamily: "inherit", outline: "none",
  };
  const label: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 5 };

  return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Nome da feira" hint="Aparece no topo do mercado.">
        <input value={form.name} onChange={(e) => set("name", e.target.value)} style={input} maxLength={120} />
      </Field>

      <Field label="Frase de apresentação" hint="A linha menor, embaixo do nome.">
        <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} style={input} maxLength={200} />
      </Field>

      <Field label="WhatsApp que recebe os pedidos" hint="Com DDD. De outro país, comece com + e o código.">
        <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} style={input} inputMode="tel" maxLength={30} />
      </Field>

      <Field label="Quando é a feira" hint="Ex.: Todas as sextas-feiras.">
        <input value={form.delivery_day} onChange={(e) => set("delivery_day", e.target.value)} style={input} maxLength={120} />
      </Field>

      <Field label="Onde se retira" hint="Ex.: Praia da Argila — Casa Gêmeos Viva.">
        <input value={form.pickup_place} onChange={(e) => set("pickup_place", e.target.value)} style={input} maxLength={200} />
      </Field>

      <Field label="Prazo para pedir" hint="Ex.: Pedidos até quarta-feira, às 17h.">
        <input value={form.deadline_text} onChange={(e) => set("deadline_text", e.target.value)} style={input} maxLength={200} />
      </Field>

      <Field label="Aviso no rodapé" hint="O texto pequeno no fim da lista de produtos.">
        <textarea
          value={form.footer_note}
          onChange={(e) => set("footer_note", e.target.value)}
          style={{ ...input, minHeight: 90, resize: "vertical" }}
          maxLength={800}
        />
      </Field>

      <div style={{ background: form.is_active ? "#F7FBF9" : "#FEF3C7", border: `1px solid ${form.is_active ? "#E3F1EA" : "#FCD34D"}`, borderRadius: 12, padding: "0.8rem" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!form.is_active}
            onChange={(e) => set("is_active", !e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ ...label, marginBottom: 2 }}>Pausar o mercado</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Enquanto estiver pausado, o acesso some da tela de Início e ninguém consegue fazer pedidos.
              O catálogo fica guardado — é só despausar para voltar.
            </span>
          </span>
        </label>
      </div>

      {error && <p className="text-error" style={{ fontSize: "0.82rem" }}>{error}</p>}
      {msg && <p style={{ fontSize: "0.82rem", color: "var(--green-dark)", fontWeight: 700 }}>{msg}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn btn-primary btn-block"
        style={{ background: "var(--green-dark)" }}
      >
        {saving ? "Salvando…" : "Salvar ajustes"}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: 2 }}>{label}</span>
      {hint && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{hint}</span>}
      {children}
    </div>
  );
}
