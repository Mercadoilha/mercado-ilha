"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useSession } from "../../../contexts/SessionContext";

type Admin = { user_id: string; full_name: string | null; email: string | null; created_at: string };

// Quem pode entrar nesta área. Qualquer pessoa da equipe pode somar outra (pelo
// e-mail da conta dela no app) e tirar alguém — menos a si mesma, e a equipe
// nunca pode ficar sem ninguém.
export default function EquipeTab({ vendorId }: { vendorId: number }) {
  const { session } = useSession();
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("list_market_admins", { p_vendor_id: vendorId });
    if (err) { setError("Não foi possível carregar a equipe."); setAdmins([]); return; }
    setAdmins((data ?? []) as Admin[]);
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const value = email.trim();
    if (!value) { setError("Escreva o e-mail da pessoa."); return; }
    setBusy(true); setError(null); setMsg(null);
    const { error: err } = await supabase.rpc("add_market_admin_by_email", { p_vendor_id: vendorId, p_email: value });
    setBusy(false);
    if (err) { setError(err.message || "Não foi possível adicionar."); return; }
    setEmail("");
    setMsg("Pronto! A pessoa já pode entrar nesta área.");
    await load();
  };

  const remove = async (admin: Admin) => {
    setBusy(true); setError(null); setMsg(null);
    const { error: err } = await supabase.rpc("remove_market_admin", { p_vendor_id: vendorId, p_user_id: admin.user_id });
    setBusy(false);
    if (err) { setError(err.message || "Não foi possível remover."); return; }
    await load();
  };

  const input: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: 10,
    fontSize: "0.9rem", width: "100%", fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{ padding: "1rem", paddingBottom: 24 }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45, marginBottom: 12 }}>
        Quem estiver nesta lista pode mudar preços, produtos e ajustes da feira, e ver os pedidos.
        A pessoa precisa já ter conta no app.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail da conta"
          inputMode="email"
          autoCapitalize="none"
          style={{ ...input, flex: 1 }}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="btn"
          style={{ background: "var(--green-dark)", color: "#fff", fontWeight: 800, flexShrink: 0 }}
        >
          Adicionar
        </button>
      </div>

      {error && <p className="text-error" style={{ fontSize: "0.8rem", marginTop: 10 }}>{error}</p>}
      {msg && <p style={{ fontSize: "0.8rem", color: "var(--green-dark)", fontWeight: 700, marginTop: 10 }}>{msg}</p>}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {admins === null && <div style={{ textAlign: "center", padding: "1.5rem 0" }}><div className="spinner" /></div>}
        {admins?.map((admin) => {
          const isMe = admin.user_id === session?.user.id;
          return (
            <div
              key={admin.user_id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "0.6rem 0.75rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>
                  {admin.full_name || "Sem nome"}
                  {isMe && <span style={{ marginLeft: 6, fontSize: "0.64rem", fontWeight: 800, color: "var(--green-dark)", background: "#DCFCE7", borderRadius: 4, padding: "1px 5px" }}>você</span>}
                </div>
                {admin.email && (
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{admin.email}</div>
                )}
              </div>
              {!isMe && (
                <button
                  type="button"
                  onClick={() => remove(admin)}
                  disabled={busy}
                  style={{ border: "1px solid var(--border)", background: "#fff", color: "#b91c1c", borderRadius: 8, padding: "0.3rem 0.55rem", fontSize: "0.74rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}
                >
                  tirar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
