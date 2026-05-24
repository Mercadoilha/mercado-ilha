import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
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
