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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  // 2. Parse request body
  const body = await request.json();
  const { email, password, name, role, facility_id } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 });
  }

  const validRoles = ['admin', 'trainer', 'supervisor', 'worker', 'executive'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 });
  }

  // 3. Use service role client to create auth user
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError) {
    if (createError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
    }
    return NextResponse.json({ error: `ユーザー作成に失敗しました: ${createError.message}` }, { status: 500 });
  }

  // 4. Create profile record
  const { error: profileError } = await serviceClient
    .from('profiles')
    .insert({
      id: newUser.user.id,
      email,
      name,
      role,
      facility_id: facility_id || null,
    });

  if (profileError) {
    // Rollback: delete the auth user
    await serviceClient.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: `プロフィール作成に失敗しました: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    id: newUser.user.id,
    email,
    name,
    role,
  });
}
