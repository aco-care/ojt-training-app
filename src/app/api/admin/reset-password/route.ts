import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // 1. Verify the caller is an admin
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

  // 2. Parse request
  const body = await request.json();
  const { user_id, new_password } = body;

  if (!user_id || !new_password) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
  }

  if (new_password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 });
  }

  // 3. Use service role to update password
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(user_id, {
    password: new_password,
  });

  if (updateError) {
    return NextResponse.json({ error: `パスワード更新に失敗しました: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
