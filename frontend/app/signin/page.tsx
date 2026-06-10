"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import InstallAppBanner from "../../components/InstallAppBanner";

type Tab = "login" | "register";

export default function SignInPage() {
  return (
    <>
      <InstallAppBanner />
      <Suspense>
        <SignInContent />
      </Suspense>
    </>
  );
}

function isValidWhatsapp(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) {
    // Internacional: entre 7 y 15 dígitos después del +
    return digits.length >= 7 && digits.length <= 15;
  }
  // Brasil: DDD (2) + número (8 ou 9) = 10 ou 11 dígitos
  return digits.length === 10 || digits.length === 11;
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactMsg = searchParams.get("msg") === "contact";
  const [tab, setTab] = useState<Tab>("login");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register
  const [regName, setRegName] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regTermsAccepted, setRegTermsAccepted] = useState(false);

  // Login attempt counter
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    setLoading(false);
    if (authErr) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= 3) {
        await supabase.auth.resetPasswordForEmail(loginEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        setShowRecoveryModal(true);
        setError(null);
      } else {
        setError("Email ou senha incorretos. Tente novamente.");
      }
      return;
    }
    router.push("/");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!regName.trim()) { setError("Informe seu nome."); return; }
    if (!regWhatsapp.trim()) { setError("Informe seu WhatsApp."); return; }
    if (!isValidWhatsapp(regWhatsapp)) { setError("Número de WhatsApp inválido. Brasil: DDD + número (ex: 75 99999-9999). Outro país: com + e código (ex: +54 11 99999-9999)."); return; }
    if (!regTermsAccepted) { setError("Você precisa aceitar os Termos e Condições para se cadastrar."); return; }
    if (regPassword.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    if (regPassword !== regConfirm) { setError("As senhas não coincidem."); return; }

    setLoading(true);

    const { data, error: authErr } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { data: { full_name: regName.trim(), whatsapp: regWhatsapp.trim() } },
    });

    if (authErr || !data.user) {
      const msg = authErr?.message ?? "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        setError("Este email já está cadastrado. Tente fazer login.");
      } else {
        setError(msg || "Erro ao criar conta.");
      }
      setLoading(false);
      return;
    }

    // Espera breve para que el trigger de Supabase cree el perfil primero
    await new Promise((r) => setTimeout(r, 600));

    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: regName.trim(),
      whatsapp: regWhatsapp.trim(),
      role: "user",
      is_active: true,
    }, { onConflict: "id" });

    setLoading(false);

    // If email confirmation is required
    if (!data.session) {
      setSuccess("Conta criada! Verifique seu email para confirmar o cadastro.");
      return;
    }

    router.push("/");
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: "0.75rem",
    background: tab === t ? "#fff" : "transparent",
    border: "none",
    borderBottom: tab === t ? "2px solid var(--blue-main)" : "2px solid transparent",
    fontWeight: 700,
    fontSize: "0.9rem",
    color: tab === t ? "var(--blue-main)" : "var(--text-muted)",
    cursor: "pointer",
    transition: "color 0.15s",
  });

  return (
    <div className="page-body">

      {/* Modal: recovery email sent after 3 failed attempts */}
      {showRecoveryModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "1.75rem 1.5rem", maxWidth: 340, width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📧</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 8 }}>E-mail de recuperação enviado</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
              Enviamos um link para <strong>{loginEmail}</strong> para você criar uma nova senha.<br />
              Verifique sua caixa de entrada e o spam.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => { setShowRecoveryModal(false); setLoginAttempts(0); }}
              style={{ padding: "0.75rem", fontSize: "1rem" }}
            >
              Aceitar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Entrar</h1>
      </header>

      {/* Logo */}
      <div style={{ textAlign: "center", padding: "1.5rem 1rem 0.5rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-entrada.svg" alt="Mercado Ilha" style={{ height: "64px", width: "auto", display: "inline-block" }} />
      </div>

      {/* Banner de contexto */}
      {contactMsg && (
        <div style={{ margin: "1rem 1rem 0", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#92400e", fontWeight: 600 }}>
          Para entrar em contato com o vendedor, você precisa estar cadastrado. É gratuito e rápido! 🎉
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", margin: "1rem 1rem 0" }}>
        <button type="button" style={tabStyle("login")} onClick={() => { setTab("login"); setError(null); setSuccess(null); }}>
          Entrar
        </button>
        <button type="button" style={tabStyle("register")} onClick={() => { setTab("register"); setError(null); setSuccess(null); }}>
          Cadastrar
        </button>
      </div>

      <div style={{ padding: "1.25rem 1rem" }}>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#16a34a", fontWeight: 600 }}>
            {success}
          </div>
        )}

        {/* ── LOGIN ── */}
        {tab === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showLoginPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={6}
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
                  aria-label={showLoginPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showLoginPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem", marginTop: 4 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
              Ainda não tem conta?{" "}
              <button type="button" onClick={() => setTab("register")} style={{ background: "none", border: "none", color: "var(--blue-main)", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}>
                Cadastre-se grátis
              </button>
            </p>
            <p style={{ textAlign: "center", fontSize: "0.82rem", marginTop: 2 }}>
              <Link href="/forgot-password" style={{ color: "var(--text-muted)", fontSize: "0.82rem", textDecoration: "underline" }}>
                Esqueceu a senha?
              </Link>
            </p>
          </form>
        )}

        {/* ── REGISTER ── */}
        {tab === "register" && (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div className="form-group">
              <label className="form-label">Seu nome *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Como você se chama?"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                maxLength={80}
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp *</label>
              <input
                className="form-input"
                type="tel"
                placeholder="71 99999-9999"
                value={regWhatsapp}
                onChange={(e) => setRegWhatsapp(e.target.value)}
                required
                maxLength={20}
                autoComplete="tel"
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Brasil: só DDD + número (ex: 75 99999-9999). Outro país: com + e código (ex: +54 11 9999-9999)
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha *</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showRegPw ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPw((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
                  aria-label={showRegPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showRegPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar senha *</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showRegConfirm ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirm((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
                  aria-label={showRegConfirm ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showRegConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, fontSize: "0.95rem", color: "#334155", lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={regTermsAccepted}
                  onChange={(e) => setRegTermsAccepted(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--blue-main)", marginTop: 3 }}
                />
                <span>
                  Li e aceito os <a href="/termos" target="_blank" rel="noreferrer" style={{ color: "var(--blue-main)", textDecoration: "underline" }}>Termos e Condições de Uso</a> do Mercado Ilha.
                </span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !regTermsAccepted} style={{ padding: "0.875rem", fontSize: "1rem", marginTop: 4 }}>
              {loading ? "Criando conta..." : "Criar conta grátis"}
            </button>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Ao se cadastrar, você concorda com os termos de uso do Mercado Ilha.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

