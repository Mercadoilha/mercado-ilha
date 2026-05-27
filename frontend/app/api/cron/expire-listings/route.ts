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

/** Deletes all R2 photos + listing_photos rows + the listings themselves. */
async function purgeListings(supabase: ReturnType<typeof getSupabaseAdmin>, ids: number[]) {
  if (!ids.length) return { deleted: 0, photosDeleted: 0 };

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("photo_url")
    .in("listing_id", ids);

  const publicUrl = process.env.R2_PUBLIC_URL ?? "";
  let photosDeleted = 0;

  if (photos?.length) {
    await Promise.allSettled(
      photos.map(async (p) => {
        if (!p.photo_url.startsWith(publicUrl)) return; // skip legacy URLs
        const key = p.photo_url.slice(publicUrl.length + 1);
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
          photosDeleted++;
        } catch (e) {
          console.error("[cron] R2 delete error:", e);
        }
      }),
    );
    await supabase.from("listing_photos").delete().in("listing_id", ids);
  }

  await supabase.from("listings").delete().in("id", ids);

  return { deleted: ids.length, photosDeleted };
}

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

  // ── PASO 1: Eliminar definitivamente los que llevan 15 días expirados ──────
  // Un listing expirado tiene expires_at < ahora. Si además expires_at < ahora-15d,
  // significa que lleva al menos 15 días en estado "expired".
  const { data: toDelete } = await supabase
    .from("listings")
    .select("id")
    .eq("status", "expired")
    .lt("expires_at", fifteenDaysAgo);

  const purgeIds = (toDelete ?? []).map((l) => l.id);
  const { deleted, photosDeleted } = await purgeListings(supabase, purgeIds);
  if (deleted) console.log(`[cron] Purged ${deleted} listings, ${photosDeleted} R2 photos`);

  // ── PASO 2: Desactivar los activos que alcanzaron los 30 días ─────────────
  const { data: expiring, error } = await supabase
    .from("listings")
    .select("id, title, user_id, profiles(full_name, id)")
    .eq("status", "active")
    .lt("expires_at", now.toISOString());

  if (error) {
    console.error("[cron] Error fetching expiring listings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!expiring?.length) {
    return NextResponse.json({ ok: true, expired: 0, deleted, photos_deleted: photosDeleted });
  }

  const expiredIds = expiring.map((l) => l.id);
  await supabase.from("listings").update({ status: "expired" }).in("id", expiredIds);

  // ── Emails de aviso: 15 días para reactivar o se elimina ─────────────────
  const userIds = [...new Set(expiring.map((l) => l.user_id))];
  const emailMap: Record<string, string> = {};
  for (const uid of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap[uid] = u.user.email;
  }

  const byUser: Record<string, typeof expiring> = {};
  for (const l of expiring) {
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    byUser[l.user_id].push(l);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mercadoilha.vercel.app";
  let sent = 0;

  for (const [uid, listings] of Object.entries(byUser)) {
    const email = emailMap[uid];
    if (!email) continue;

    const name = (listings[0].profiles as any)?.full_name ?? "usuário";
    const single = listings.length === 1;

    const listItems = listings
      .map((l) => `<li style="margin-bottom:6px"><strong>${l.title}</strong></li>`)
      .join("");

    const { error: mailErr } = await resend.emails.send({
      from: "Mercado Ilha <onboarding@resend.dev>",
      to: email,
      subject: single
        ? `Seu anúncio "${listings[0].title}" foi desativado`
        : `${listings.length} anúncios seus foram desativados`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <img src="${siteUrl}/logo.svg" alt="Mercado Ilha" style="height:44px;margin-bottom:20px" />
          <h2 style="color:#1e293b;font-size:1.1rem;margin-bottom:8px">Olá, ${name}!</h2>
          <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin-bottom:16px">
            ${single ? "O seguinte anúncio atingiu" : "Os seguintes anúncios atingiram"} o prazo de
            <strong>30 dias</strong> e ${single ? "foi desativado" : "foram desativados"} automaticamente:
          </p>
          <ul style="color:#1e293b;font-size:0.95rem;padding-left:20px;margin-bottom:20px">
            ${listItems}
          </ul>

          <div style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin-bottom:20px">
            <p style="color:#92400e;font-size:0.9rem;line-height:1.6;margin:0;font-weight:600">
              ⚠️ Você tem 15 dias para reativar ${single ? "este anúncio" : "estes anúncios"}.
            </p>
            <p style="color:#92400e;font-size:0.85rem;line-height:1.6;margin:8px 0 0">
              Após esse prazo, ${single ? "ele será excluído" : "eles serão excluídos"} permanentemente
              para não acumular conteúdo inativo na plataforma.
            </p>
          </div>

          <a href="${siteUrl}/profile"
            style="display:inline-block;background:#185fa5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:0.95rem;margin-bottom:24px">
            Reativar agora →
          </a>

          <p style="color:#94a3b8;font-size:0.78rem;margin-top:8px">
            Mercado Ilha · Tinharé, Morro de São Paulo
          </p>
        </div>
      `,
    });

    if (!mailErr) sent++;
    else console.error(`[cron] Email error for ${email}:`, mailErr);
  }

  return NextResponse.json({
    ok: true,
    expired: expiredIds.length,
    deleted,
    photos_deleted: photosDeleted,
    emails_sent: sent,
  });
}
