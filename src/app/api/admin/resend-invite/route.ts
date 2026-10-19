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
  const { profile_id: profileId } = await request.json();
  if (!profileId) {
    return NextResponse.json({ error: 'スタッフIDが必要です' }, { status: 400 });
  }

  // 3. Send password reset email (works as invite re-send)
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from('profiles')
    .select('id, email')
    .eq('id', profileId)
    .single();
  if (targetProfileError || !targetProfile) {
    return NextResponse.json({ error: '対象スタッフが見つかりません' }, { status: 404 });
  }

  const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(profileId);
  if (authError || !authData.user?.email) {
    return NextResponse.json({ error: '対象スタッフのログインアカウントが見つかりません' }, { status: 409 });
  }
  if (authData.user.email.toLowerCase() !== targetProfile.email.toLowerCase()) {
    return NextResponse.json({
      error: '台帳とログインアカウントのメールが一致していません。スタッフ情報を保存し直してから再送してください。',
    }, { status: 409 });
  }

  // Existing account only: never create a second Auth user from the profile email.
  const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(targetProfile.email, {
    redirectTo: `${request.nextUrl.origin}/auth/callback`,
  });
  if (resetError) {
    return NextResponse.json({ error: `メール再送に失敗しました: ${resetError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, type: 'reset' });
}
