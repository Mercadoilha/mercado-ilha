import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { url, listingId } = (await req.json()) as { url?: string; listingId?: number };

    if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

    const publicUrl = process.env.R2_PUBLIC_URL!;
    if (!url.startsWith(publicUrl)) {
      // Not an R2 URL (could be a legacy Supabase Storage URL) — ignore silently
      return NextResponse.json({ success: true, skipped: true });
    }

    // Auth check: require a valid Supabase session
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // Verify the session token
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Authorization: must be admin OR verified owner of the resource
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const key = url.slice(publicUrl.length + 1); // strip leading "/"

    if (!isAdmin) {
      if (listingId != null) {
        // Listing photo: the authority is the url itself, not the client-supplied
        // listingId. Look up the photo by its url and confirm it belongs to a
        // listing owned by this user. (Prevents deleting another user's photo by
        // passing your own listingId + someone else's url.)
        const { data: photo } = await supabaseAdmin
          .from("listing_photos")
          .select("listings!inner(user_id)")
          .eq("photo_url", url)
          .limit(1)
          .maybeSingle();
        const ownerId = (photo?.listings as any)?.user_id;
        if (!ownerId || ownerId !== user.id) {
          return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
        }
      } else {
        // Avatar: a key's ownership is baked into its path ("profiles/{userId}/...")
        // at upload time, so this holds regardless of what profiles.avatar_url
        // currently points to (e.g. right after a newer avatar was already saved).
        if (!key.startsWith(`profiles/${user.id}/`)) {
          return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
        }
      }
    }

    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      }),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-file]", err);
    return NextResponse.json({ error: "Erro ao deletar arquivo" }, { status: 500 });
  }
}
