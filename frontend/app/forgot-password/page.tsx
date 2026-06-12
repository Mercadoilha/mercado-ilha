"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type State = "email" | "code" | "password" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Método específico para recuperação de senha. Gera o código {{ .Token }}
    // (template "Reset Password"). Não revela se o e-mail existe — por segurança
    // sempre retorna sucesso; se a conta não existir, simplesmente nenhum e-mail chega.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/forgot-password`,
    });

    setLoading(false);

    if (err) {
      const m = (err.message || "").toLowerCase();
      if (m.includes("rate") || m.includes("limit") || m.includes("too many")) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Erro ao enviar o código. Tente novamente em instantes.");
      }
      return;
    }

    setState("code");
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length < 6) { setError("O código deve ter 6 a 8 dígitos."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    setLoading(false);
    if (err) {
      setError("Código inválido ou expirado. Verifique e tente novamente.");
      return;
    }
    setState("password");
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (err) {
      setError("Erro ao salvar senha. Tente novamente.");
      return;
    }
    setState("success");
    setTimeout(() => router.push("/signin"), 3000);
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

        {state === "email" && (
          <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔑</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Esqueceu sua senha?</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Informe seu e-mail e enviaremos um código para você criar uma nova senha. Não é necessário clicar em nenhum link.
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
              {loading ? "Enviando..." : "Enviar código"}
            </button>
            <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Lembrou a senha?{" "}
              <Link href="/signin" style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}>
                Voltar ao login
              </Link>
            </p>
          </form>
        )}

        {state === "code" && (
          <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📧</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Código enviado!</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Enviamos um código para <strong>{email}</strong>.<br />
                Verifique sua caixa de entrada e o spam.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Código de recuperação *</label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6,8}"
                maxLength={8}
                placeholder="00000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                style={{ fontSize: "1.5rem", letterSpacing: "0.4rem", textAlign: "center" }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem" }}>
              {loading ? "Verificando..." : "Confirmar código"}
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setState("email"); }}
              style={{ background: "none", border: "none", color: "var(--blue-main)", fontSize: "0.85rem", cursor: "pointer", textAlign: "center" }}
            >
              Não recebi o código — tentar novamente
            </button>
          </form>
        )}

        {state === "password" && (
          <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
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
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
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
