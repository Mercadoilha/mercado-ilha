"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Step = "email" | "question" | "password" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  // Step 1
  const [email, setEmail] = useState("");

  // Step 2
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [resetToken, setResetToken] = useState("");

  // Step 3
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFallback, setEmailFallback] = useState(false);

  // ── Step 1: submit email ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_question", email: email.trim() }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.noQuestion) {
      // User never set a secret question — email link sent
      setEmailFallback(true);
      setStep("done");
      return;
    }

    if (!res.ok || !data.question) {
      // Generic message to avoid user enumeration
      setError("Se este e-mail estiver cadastrado, você verá a pergunta secreta.");
      return;
    }

    setQuestion(data.question);
    setStep("question");
  };

  // ── Step 2: verify answer ─────────────────────────────────────────────────
  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_answer", email: email.trim(), answer }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.locked) {
      setEmailFallback(true);
      setStep("done");
      return;
    }

    if (!data.correct) {
      setAttemptsLeft(data.attemptsLeft ?? 0);
      setError(`Resposta incorreta. Você tem mais ${data.attemptsLeft} tentativa${data.attemptsLeft !== 1 ? "s" : ""}.`);
      setAnswer("");
      return;
    }

    setResetToken(data.resetToken);
    setStep("password");
  };

  // ── Step 3: set new password ──────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }

    setLoading(true);

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_password", resetToken, newPassword }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error ?? "Erro ao redefinir senha. Tente novamente.");
      return;
    }

    setStep("done");
  };

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/signin" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Recuperar senha</h1>
      </header>

      <div style={{ padding: "1.5rem 1rem" }}>

        {/* Progress dots */}
        {step !== "done" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: "1.5rem" }}>
            {(["email", "question", "password"] as Step[]).map((s, i) => (
              <div key={s} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: step === s ? "var(--blue-main)" : (["email", "question", "password"].indexOf(step) > i ? "#059669" : "var(--blue-light)"),
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Email ── */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔐</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Recuperar senha</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Informe seu e-mail e responda a pergunta secreta que você definiu no cadastro.
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
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: "0.875rem", fontSize: "1rem" }}>
              {loading ? "Verificando..." : "Continuar →"}
            </button>
            <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Lembrou a senha?{" "}
              <Link href="/signin" style={{ color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}>
                Voltar ao login
              </Link>
            </p>
          </form>
        )}

        {/* ── STEP 2: Secret question ── */}
        {step === "question" && (
          <form onSubmit={handleAnswerSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "var(--blue-xlight)", borderRadius: 12, padding: "0.875rem", marginBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--blue-main)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Pergunta secreta
              </p>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{question}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Sua resposta *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Responda aqui..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                autoComplete="off"
                autoFocus
              />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                {attemptsLeft < 3 && `Tentativas restantes: ${attemptsLeft}`}
                {attemptsLeft === 3 && "Não diferencia maiúsculas de minúsculas."}
              </span>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !answer.trim()} style={{ padding: "0.875rem", fontSize: "1rem" }}>
              {loading ? "Verificando..." : "Confirmar resposta →"}
            </button>
          </form>
        )}

        {/* ── STEP 3: New password ── */}
        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>Resposta correta!</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Agora defina sua nova senha.</p>
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
              {loading ? "Salvando..." : "💾 Salvar nova senha"}
            </button>
          </form>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            {emailFallback ? (
              <>
                <div style={{ fontSize: "3rem" }}>📧</div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>E-mail enviado!</p>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Enviamos um link de redefinição para <strong>{email}</strong>.<br />
                  Verifique sua caixa de entrada (e o spam).
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: "3rem" }}>🎉</div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Senha redefinida com sucesso!</p>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  Agora você pode entrar com sua nova senha.
                </p>
              </>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push("/signin")}
              style={{ marginTop: 8, padding: "0.75rem 2rem" }}
            >
              Ir para o login →
            </button>
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
