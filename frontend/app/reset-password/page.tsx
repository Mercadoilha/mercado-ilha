"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type State = "loading" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setState((prev) => prev === "loading" ? "invalid" : prev);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearTimeout(timeout);
        setState("form");
      }
    });

    // PKCE flow: the email link arrives as ?code=XXXX — exchange it for a session
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        clearTimeout(timeout);
        if (error) {
          setState("invalid");
        } else {
          // Some SDK versions fire SIGNED_IN instead of PASSWORD_RECOVERY after
          // code exchange, so we transition directly rather than waiting for the event.
          setState("form");
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (state === "success") {
      const timeout = setTimeout(() => router.push("/signin"), 3000);
      return () => clearTimeout(timeout);
    }
  }, [state, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (err) {
      const isSessionGone = err.name === "AuthSessionMissingError"
        || err.message?.toLowerCase().includes("auth session missing");
      if (isSessionGone) {
        setState("success");
        return;
      }
      setError("Erro ao atualizar senha. O link pode ter expirado. Solicite um novo.");
      return;
    }

    setState("success");
  };

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/signin" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Nova senha</h1>
      </header>

      <div style={{ padding: "1.5rem 1rem" }}>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {state === "loading" && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
            <p>Verificando link...</p>
          </div>
        )}

        {state === "invalid" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "2.5rem" }}>⚠️</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Link inválido ou expirado</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Este link de recuperação não é mais válido. Solicite um novo.
            </p>
            <Link href="/forgot-password">
              <button type="button" className="btn btn-primary" style={{ marginTop: 8, padding: "0.75rem 2rem" }}>
                Solicitar novo link
              </button>
            </Link>
          </div>
        )}

        {state === "form" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔒</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Crie sua nova senha</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Escolha uma senha segura com no mínimo 6 caracteres.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Nova senha *</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showPw ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: "2.75rem" }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeToggle show={showPw} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar nova senha *</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeToggle show={showConfirm} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem" }}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

        {state === "success" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "3rem" }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Senha atualizada com sucesso!</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Você será redirecionado ao login em instantes...
            </p>
            <Link href="/signin">
              <button type="button" className="btn btn-primary" style={{ marginTop: 8, padding: "0.75rem 2rem" }}>
                Ir para o login
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function EyeToggle({ show }: { show: boolean }) {
  return show ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
