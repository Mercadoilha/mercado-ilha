import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

// In-memory attempt tracker: email → { count, lastAt }
// Resets when server restarts; acceptable for a local marketplace.
const attempts = new Map<string, { count: number; lastAt: number }>();
const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getAttempts(email: string) {
  const entry = attempts.get(email);
  if (!entry) return 0;
  if (Date.now() - entry.lastAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(email);
    return 0;
  }
  return entry.count;
}

function incrementAttempts(email: string) {
  const current = getAttempts(email);
  attempts.set(email, { count: current + 1, lastAt: Date.now() });
  return current + 1;
}

function resetAttempts(email: string) {
  attempts.delete(email);
}

export async function POST(req: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: "Configuração de servidor ausente." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.action) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { action } = body;

  // ── Step 1: get question for email ──────────────────────────────────────
  if (action === "get_question") {
    const { email } = body;
    if (!email) return NextResponse.json({ error: "E-mail obrigatório." }, { status: 400 });

    // Find user in auth
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
      // Return generic error to avoid user enumeration
      return NextResponse.json({ error: "Se este e-mail estiver cadastrado, a pergunta será exibida." }, { status: 404 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("secret_question")
      .eq("id", authUser.id)
      .single();

    if (!profile?.secret_question) {
      // No secret question set — fall back to email reset
      await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?type=recovery`,
      });
      return NextResponse.json({ noQuestion: true });
    }

    return NextResponse.json({ question: profile.secret_question });
  }

  // ── Step 2: verify answer ────────────────────────────────────────────────
  if (action === "verify_answer") {
    const { email, answer } = body;
    if (!email || !answer) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });

    const currentAttempts = getAttempts(email);
    if (currentAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ locked: true, error: "Muitas tentativas. Enviamos um link de redefinição para seu e-mail." }, { status: 429 });
    }

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) return NextResponse.json({ error: "E-mail não encontrado." }, { status: 404 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("secret_answer")
      .eq("id", authUser.id)
      .single();

    const storedAnswer = profile?.secret_answer ?? "";
    const isCorrect = storedAnswer && answer.trim().toLowerCase() === storedAnswer;

    if (!isCorrect) {
      const newCount = incrementAttempts(email);
      const remaining = MAX_ATTEMPTS - newCount;

      if (remaining <= 0) {
        // Send email reset as fallback
        await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?type=recovery`,
        });
        return NextResponse.json({ locked: true, error: "Muitas tentativas. Enviamos um link de redefinição para seu e-mail." }, { status: 429 });
      }

      return NextResponse.json({ correct: false, attemptsLeft: remaining });
    }

    // Correct — reset attempt counter
    resetAttempts(email);
    // Return a short-lived token to authorize the password reset step
    // We encode userId + expiry in a simple signed-ish string (base64)
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    const token = Buffer.from(JSON.stringify({ uid: authUser.id, exp: expiry })).toString("base64");

    return NextResponse.json({ correct: true, resetToken: token });
  }

  // ── Step 3: set new password ─────────────────────────────────────────────
  if (action === "set_password") {
    const { resetToken, newPassword } = body;
    if (!resetToken || !newPassword) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });

    let payload: { uid: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(resetToken, "base64").toString("utf-8"));
    } catch {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    if (Date.now() > payload.exp) {
      return NextResponse.json({ error: "Token expirado. Reinicie o processo." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.uid, {
      password: newPassword,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
