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

  // Send 6-digit OTP via magic link flow (resetPasswordForEmail uses long tokens)
  const { error: resetError } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (resetError) {
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
