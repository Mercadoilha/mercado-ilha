"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Tab = "login" | "register";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
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
      setError("Email ou senha incorretos. Tente novamente.");
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

    // Upsert explícito con onConflict para garantizar que se actualiza si ya existe
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
      {/* Header */}
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Entrar</h1>
      </header>

      {/* Logo */}
      <div style={{ textAlign: "center", padding: "1.5rem 1rem 0.5rem" }}>
        <div style={{ fontSize: "2.5rem" }}>🏝️</div>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--blue-main)" }}>Mercado Ilha</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>Tinharé · Morro de São Paulo</div>
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
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
              />
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
              <label className="form-label">WhatsApp (com DDD) *</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+55 71 99999-9999"
                value={regWhatsapp}
                onChange={(e) => setRegWhatsapp(e.target.value)}
                required
                maxLength={20}
                autoComplete="tel"
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Os compradores vão te contatar por aqui.
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
              <input
                className="form-input"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar senha *</label>
              <input
                className="form-input"
                type="password"
                placeholder="Repita a senha"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem", marginTop: 4 }}>
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

