import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { Resend } from "resend";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_FOLDERS = ["listings", "profiles"] as const;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (after compression files will be small, but guard server-side too)

// Aviso de uso abusivo (H7). NO bloquea: solo cuenta subidas por hora y, si un
// usuario cruza el umbral, deja un registro en /admin y avisa por email al admin.
// Un usuario normal jamás se acerca: tope de 4 fotos/anuncio → 40/h ≈ 10 anúncios/h.
const ABUSE_THRESHOLD = 40; // fotos por hora

/** Escapa texto de usuario antes de interpolarlo en el HTML del email al admin. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fire-and-forget tras una subida OK: registra el evento, cuenta la última hora
 * y —si cruza el umbral y no hubo aviso en la última hora— guarda un aviso para
 * el admin y le manda un email. Todo dentro de try/catch: si algo falla, la
 * subida ya respondió OK y esto no afecta al usuario. No corre en la navegación.
 */
async function trackUploadAndMaybeAlert(supabaseAdmin: SupabaseClient, userId: string) {
  try {
    await supabaseAdmin.from("upload_events").insert({ user_id: userId });

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("upload_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo);

    if ((count ?? 0) < ABUSE_THRESHOLD) return;

    // Dedupe: máximo un aviso por usuario por hora.
    const { data: recentAlert } = await supabaseAdmin
      .from("upload_abuse_alerts")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", hourAgo)
      .limit(1)
      .maybeSingle();
    if (recentAlert) return;

    await supabaseAdmin
      .from("upload_abuse_alerts")
      .insert({ user_id: userId, photo_count: count ?? 0, window_start: hourAgo });

    await notifyAdminAbuse(supabaseAdmin, userId, count ?? 0);
  } catch (err) {
    console.error("[upload] abuse-track error:", err);
  }
}

/** Manda un email al/los admin con los datos del usuario que subió demasiadas fotos. */
async function notifyAdminAbuse(supabaseAdmin: SupabaseClient, userId: string, count: number) {
  if (!process.env.RESEND_API_KEY) return;

  // Datos del usuario abusivo
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("full_name, whatsapp")
    .eq("id", userId)
    .single();
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email ?? "(sem email)";
  const userName = prof?.full_name ?? "usuário";

  // Email(s) de admin
  const { data: admins } = await supabaseAdmin.from("profiles").select("id").eq("role", "admin");
  const adminEmails: string[] = [];
  for (const a of admins ?? []) {
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(a.id);
    if (au?.user?.email) adminEmails.push(au.user.email);
  }
  if (!adminEmails.length) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mercadoilha.vercel.app";
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Mercado Ilha <onboarding@resend.dev>",
    to: adminEmails,
    subject: `⚠️ Uso abusivo de fotos: ${userName} (${count}/hora)`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <img src="${siteUrl}/logo.svg" alt="Mercado Ilha" style="height:44px;margin-bottom:20px" />
        <h2 style="color:#1e293b;font-size:1.1rem;margin-bottom:8px">Alerta de uso abusivo</h2>
        <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin-bottom:16px">
          O usuário abaixo subiu <strong>${count} fotos na última hora</strong>
          (limite de alerta: ${ABUSE_THRESHOLD}). Ele <strong>não foi bloqueado</strong> —
          este é apenas um aviso para você revisar.
        </p>
        <div style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin-bottom:20px">
          <p style="color:#92400e;font-size:0.9rem;line-height:1.6;margin:0">
            <strong>Nome:</strong> ${escapeHtml(userName)}<br/>
            <strong>Email:</strong> ${escapeHtml(userEmail)}<br/>
            <strong>WhatsApp:</strong> ${escapeHtml(prof?.whatsapp ?? "—")}
          </p>
        </div>
        <a href="${siteUrl}/admin"
          style="display:inline-block;background:#185fa5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:0.95rem">
          Abrir painel →
        </a>
        <p style="color:#94a3b8;font-size:0.78rem;margin-top:20px">Mercado Ilha · alerta automático</p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  // Require a valid Supabase session — prevents unauthorized uploads
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!folder || !ALLOWED_FOLDERS.includes(folder as (typeof ALLOWED_FOLDERS)[number])) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 10 MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `${folder}/${randomUUID()}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    // Rastreo de uso abusivo (no bloquea, no afecta la respuesta al usuario).
    await trackUploadAndMaybeAlert(supabaseAdmin, user.id);

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
  }
}
