import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'missing_email' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Check if the email exists in auth.users
  const { data, error } = await supabase
    .schema('auth')
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Send the 4-digit OTP recovery email
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (resetError) {
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
