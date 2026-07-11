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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mercadoilha.vercel.app";

/** Escapa texto de usuario (título, nombre) antes de interpolarlo en el HTML del email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ListingForEmail = { id: number; title: string; user_id: string; profiles: any };

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

/** Groups listings by owner, resolves their emails, and sends one email per owner via buildEmail. */
async function sendListingEmails(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  resend: Resend,
  listings: ListingForEmail[],
  buildEmail: (name: string, listings: ListingForEmail[]) => { subject: string; html: string },
) {
  if (!listings.length) return 0;

  const userIds = [...new Set(listings.map((l) => l.user_id))];
  const emailMap: Record<string, string> = {};
  for (const uid of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap[uid] = u.user.email;
  }

  const byUser: Record<string, ListingForEmail[]> = {};
  for (const l of listings) {
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    byUser[l.user_id].push(l);
  }

  let sent = 0;
  for (const [uid, userListings] of Object.entries(byUser)) {
    const email = emailMap[uid];
    if (!email) continue;

    const name = (userListings[0].profiles as any)?.full_name ?? "usuário";
    const { subject, html } = buildEmail(name, userListings);
    const { error: mailErr } = await resend.emails.send({
      from: "Mercado Ilha <onboarding@resend.dev>",
      to: email,
      subject,
      html,
    });

    if (!mailErr) sent++;
    else console.error(`[cron] Email error for ${email}:`, mailErr);
  }
  return sent;
}

function buildExpiredEmail(name: string, listings: ListingForEmail[]) {
  const single = listings.length === 1;
  const listItems = listings
    .map((l) => `<li style="margin-bottom:6px"><strong>${escapeHtml(l.title)}</strong></li>`)
    .join("");

  return {
    subject: single
      ? `Seu anúncio "${listings[0].title}" foi desativado`
      : `${listings.length} anúncios seus foram desativados`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <img src="${SITE_URL}/logo.svg" alt="Mercado Ilha" style="height:44px;margin-bottom:20px" />
        <h2 style="color:#1e293b;font-size:1.1rem;margin-bottom:8px">Olá, ${escapeHtml(name)}!</h2>
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

        <a href="${SITE_URL}/profile"
          style="display:inline-block;background:#185fa5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:0.95rem;margin-bottom:24px">
          Reativar agora →
        </a>

        <p style="color:#94a3b8;font-size:0.78rem;margin-top:8px">
          Mercado Ilha · Tinharé, Morro de São Paulo
        </p>
      </div>
    `,
  };
}

function buildDeletionWarningEmail(name: string, listings: ListingForEmail[]) {
  const single = listings.length === 1;
  const listItems = listings
    .map((l) => `<li style="margin-bottom:6px"><strong>${escapeHtml(l.title)}</strong></li>`)
    .join("");

  return {
    subject: single
      ? `Última chance: "${listings[0].title}" será excluído amanhã`
      : `Última chance: ${listings.length} anúncios seus serão excluídos amanhã`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <img src="${SITE_URL}/logo.svg" alt="Mercado Ilha" style="height:44px;margin-bottom:20px" />
        <h2 style="color:#1e293b;font-size:1.1rem;margin-bottom:8px">Olá, ${escapeHtml(name)}!</h2>
        <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin-bottom:16px">
          ${single ? "O seguinte anúncio está" : "Os seguintes anúncios estão"} inativo há 14 dias:
        </p>
        <ul style="color:#1e293b;font-size:0.95rem;padding-left:20px;margin-bottom:20px">
          ${listItems}
        </ul>

        <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 16px;margin-bottom:20px">
          <p style="color:#991b1b;font-size:0.9rem;line-height:1.6;margin:0;font-weight:600">
            🚨 Amanhã completa 15 dias e ${single ? "ele será excluído" : "eles serão excluídos"} permanentemente.
          </p>
          <p style="color:#991b1b;font-size:0.85rem;line-height:1.6;margin:8px 0 0">
            Reative agora para evitar a exclusão definitiva. Depois de excluído, não será possível recuperar.
          </p>
        </div>

        <a href="${SITE_URL}/profile"
          style="display:inline-block;background:#185fa5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:0.95rem;margin-bottom:24px">
          Reativar agora →
        </a>

        <p style="color:#94a3b8;font-size:0.78rem;margin-top:8px">
          Mercado Ilha · Tinharé, Morro de São Paulo
        </p>
      </div>
    `,
  };
}

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

  // ── PASO 1: Avisar (dia 14) que amanhã se completam 15 dias e será excluído ──
  const { data: toWarn } = await supabase
    .from("listings")
    .select("id, title, user_id, profiles(full_name, id)")
    .eq("status", "expired")
    .is("deletion_warning_sent_at", null)
    .lt("expires_at", fourteenDaysAgo)
    .gte("expires_at", fifteenDaysAgo);

  const warned = await sendListingEmails(supabase, resend, toWarn ?? [], buildDeletionWarningEmail);
  if (toWarn?.length) {
    await supabase
      .from("listings")
      .update({ deletion_warning_sent_at: now.toISOString() })
      .in("id", toWarn.map((l) => l.id));
  }

  // ── PASO 2: Eliminar definitivamente los que llevan 15 días expirados ─────
  // Ya fueron avisados el día anterior (Paso 1), así que se eliminan sin email.
  const { data: toDelete } = await supabase
    .from("listings")
    .select("id")
    .eq("status", "expired")
    .lt("expires_at", fifteenDaysAgo);

  const purgeIds = (toDelete ?? []).map((l) => l.id);
  const { deleted, photosDeleted } = await purgeListings(supabase, purgeIds);
  if (deleted) console.log(`[cron] Purged ${deleted} listings, ${photosDeleted} R2 photos`);

  // ── PASO 2.5: Podar tablas de tracking viejas (retención, fase-20) ────────
  // Evita que listing_views/search_queries/banner_clicks crezcan sin tope y
  // llenen la DB free. Fire-and-forget: si falla, no aborta el cron.
  let trackingPruned: unknown = null;
  {
    const { data: pruned, error: pruneErr } = await supabase.rpc("prune_tracking");
    if (pruneErr) console.error("[cron] prune_tracking error:", pruneErr);
    else {
      trackingPruned = pruned;
      console.log("[cron] Pruned tracking:", pruned);
    }
  }

  // Podar upload_events viejos (>1 día): solo se usan para contar la última hora
  // (aviso de uso abusivo, fase-24). Fire-and-forget: si falla, no aborta el cron.
  {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: upErr } = await supabase.from("upload_events").delete().lt("created_at", oneDayAgo);
    if (upErr) console.error("[cron] prune upload_events error:", upErr);
  }

  // ── PASO 3: Desativar os ativos que atingiram os 30 dias ──────────────────
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
    return NextResponse.json({
      ok: true,
      expired: 0,
      deleted,
      photos_deleted: photosDeleted,
      deletion_warnings_sent: warned,
      tracking_pruned: trackingPruned,
    });
  }

  const expiredIds = expiring.map((l) => l.id);
  await supabase.from("listings").update({ status: "expired" }).in("id", expiredIds);

  const sent = await sendListingEmails(supabase, resend, expiring, buildExpiredEmail);

  return NextResponse.json({
    ok: true,
    expired: expiredIds.length,
    deleted,
    photos_deleted: photosDeleted,
    emails_sent: sent,
    deletion_warnings_sent: warned,
    tracking_pruned: trackingPruned,
  });
}
