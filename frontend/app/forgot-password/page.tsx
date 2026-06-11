"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type State = "form" | "sent";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<State>("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // redirectTo is omitted — the destination URL is hardcoded in the Supabase
    // email template using {{ .SiteURL }}/reset-password?token_hash=...
    let { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());

    // Retry once on transient network failures
    if (err) {
      await new Promise((r) => setTimeout(r, 600));
      ({ error: err } = await supabase.auth.resetPasswordForEmail(email.trim()));
    }

    setLoading(false);

    if (err) {
      setError("Erro ao enviar e-mail. Tente novamente.");
      return;
    }

    setState("sent");
  };

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/signin" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Recuperar senha</h1>
      </header>

      <div style={{ padding: "1.5rem 1rem" }}>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {state === "form" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔑</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Esqueceu sua senha?</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Informe seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">E-mail cadastrado *</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem" }}>
              {loading ? "Enviando..." : "Enviar e-mail de recuperação"}
            </button>
            <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Lembrou a senha?{" "}
              <Link href="/signin" style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}>
                Voltar ao login
              </Link>
            </p>
          </form>
        )}

        {state === "sent" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "3rem" }}>📧</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>E-mail enviado!</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Enviamos um link de recuperação para <strong>{email}</strong>.<br />
              Verifique sua caixa de entrada e também o spam.
            </p>
            <Link href="/signin" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-primary" style={{ padding: "0.75rem 2rem" }}>
                Voltar ao login
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
