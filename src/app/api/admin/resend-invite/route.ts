import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // 1. Verify the caller is an admin/supervisor
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  // 2. Parse request body
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 });
  }

  // 3. Send password reset email (works as invite re-send)
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Re-send invite email. inviteUserByEmail will re-send if user already exists.
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.nextUrl.origin}/auth/callback`,
  });

  if (inviteError) {
    // If user already confirmed, use resetPasswordForEmail instead
    if (inviteError.message.includes('already confirmed') || inviteError.message.includes('already been registered')) {
      const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${request.nextUrl.origin}/auth/callback`,
      });
      if (resetError) {
        return NextResponse.json({ error: `メール再送に失敗しました: ${resetError.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, type: 'reset' });
    }
    return NextResponse.json({ error: `招待メールの再送に失敗しました: ${inviteError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, type: 'invite' });
}
