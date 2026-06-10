import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

async function getAdminClient(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return { supabaseAdmin: null, error: "Não autorizado", status: 401 };

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return { supabaseAdmin: null, error: "Não autorizado", status: 401 };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { supabaseAdmin: null, error: "Acesso negado", status: 403 };

  return { supabaseAdmin, error: null, status: 200 };
}

export async function GET(req: NextRequest) {
  let supabaseAdmin;
  try {
    const result = await getAdminClient(req);
    if (result.error || !result.supabaseAdmin) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    supabaseAdmin = result.supabaseAdmin;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Missing service role configuration' },
      { status: 500 }
    );
  }

  const [listingsResult, conversationsResult] = await Promise.all([
    supabaseAdmin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('conversations')
      .select('id', { count: 'exact', head: true }),
  ]);

  if (listingsResult.error || conversationsResult.error) {
    return NextResponse.json(
      { error: listingsResult.error?.message ?? conversationsResult.error?.message ?? 'Error retrieving stats' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    activeListings: listingsResult.count ?? 0,
    conversations: conversationsResult.count ?? 0,
  });
}

export async function DELETE(req: NextRequest) {
  let supabaseAdmin;
  try {
    const result = await getAdminClient(req);
    if (result.error || !result.supabaseAdmin) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    supabaseAdmin = result.supabaseAdmin;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Missing service role configuration' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { userId } = body as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
