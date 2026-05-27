import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find active listings that have expired
  const { data: expired, error } = await supabase
    .from("listings")
    .select("id, title, user_id, profiles(full_name, id)")
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[cron] Error fetching expired listings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  const ids = expired.map((l) => l.id);

  // ── Delete photos from R2 ──────────────────────────────────────────────────
  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id, photo_url")
    .in("listing_id", ids);

  const publicUrl = process.env.R2_PUBLIC_URL ?? "";
  let photosDeleted = 0;

  if (photos?.length) {
    await Promise.allSettled(
      photos.map(async (p) => {
        if (!p.photo_url.startsWith(publicUrl)) return; // skip legacy URLs
        const key = p.photo_url.slice(publicUrl.length + 1);
        await r2.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
        }));
        photosDeleted++;
      }),
    );

    // Remove listing_photos records from DB
    await supabase
      .from("listing_photos")
      .delete()
      .in("listing_id", ids);
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Mark all as expired
  await supabase.from("listings").update({ status: "expired" }).in("id", ids);

  // Fetch user emails from auth.users via admin
  const userIds = [...new Set(expired.map((l) => l.user_id))];
  const emailMap: Record<string, string> = {};

  for (const uid of userIds) {
    const { data: userData } = await supabase.auth.admin.getUserById(uid);
    if (userData?.user?.email) emailMap[uid] = userData.user.email;
  }

  // Group expired listings by user
  const byUser: Record<string, typeof expired> = {};
  for (const l of expired) {
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    byUser[l.user_id].push(l);
  }

  // Send one email per user
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mercadoilha.vercel.app";
  let sent = 0;

  for (const [uid, listings] of Object.entries(byUser)) {
    const email = emailMap[uid];
    if (!email) continue;

    const profile = (listings[0].profiles as any);
    const name = profile?.full_name ?? "usuário";

    const listItems = listings
      .map((l) => `<li style="margin-bottom:6px"><a href="${siteUrl}/listings/${l.id}" style="color:#185fa5;font-weight:600">${l.title}</a></li>`)
      .join("");

    const { error: mailErr } = await resend.emails.send({
      from: "Mercado Ilha <onboarding@resend.dev>",
      to: email,
      subject: listings.length === 1
        ? `Seu anúncio "${listings[0].title}" foi desativado`
        : `${listings.length} anúncios seus foram desativados`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <img src="${siteUrl}/logo.svg" alt="Mercado Ilha" style="height:44px;margin-bottom:20px" />
          <h2 style="color:#1e293b;font-size:1.1rem;margin-bottom:8px">Olá, ${name}!</h2>
          <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin-bottom:16px">
            ${listings.length === 1 ? "O seguinte anúncio atingiu" : "Os seguintes anúncios atingiram"} o prazo de
            <strong>30 dias</strong> e ${listings.length === 1 ? "foi desativado" : "foram desativados"} automaticamente:
          </p>
          <ul style="color:#1e293b;font-size:0.95rem;padding-left:20px;margin-bottom:20px">
            ${listItems}
          </ul>
          <p style="color:#475569;font-size:0.9rem;line-height:1.6;margin-bottom:20px">
            Você pode <strong>reativar a qualquer momento</strong> acessando o seu perfil — basta clicar em <em>"Ativar"</em> no anúncio desejado e ele voltará a aparecer por mais 30 dias.
          </p>
          <a href="${siteUrl}/profile"
            style="display:inline-block;background:#185fa5;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:700;font-size:0.9rem">
            Ver meus anúncios
          </a>
          <p style="color:#94a3b8;font-size:0.78rem;margin-top:28px">
            Mercado Ilha · Tinharé, Morro de São Paulo
          </p>
        </div>
      `,
    });

    if (!mailErr) sent++;
    else console.error(`[cron] Email error for ${email}:`, mailErr);
  }

  return NextResponse.json({ ok: true, expired: ids.length, photos_deleted: photosDeleted, emails_sent: sent });
}
