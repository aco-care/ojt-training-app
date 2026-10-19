import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VALID_ROLES = ['admin', 'trainer', 'supervisor', 'worker', 'executive'] as const;
const VALID_QUALIFICATIONS = ['none', 'shoninsya', 'kaigofukushishi'] as const;

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'supervisor')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  const body = await request.json();
  const profileId = typeof body.profile_id === 'string' ? body.profile_id : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const qualification = typeof body.qualification === 'string' ? body.qualification : 'none';
  const facilityIds = Array.isArray(body.facility_ids)
    ? [...new Set(body.facility_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const primaryFacilityId = typeof body.primary_facility_id === 'string' && body.primary_facility_id
    ? body.primary_facility_id
    : facilityIds[0] ?? null;

  if (!profileId || !email || !name || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: '必須項目または役職が正しくありません' }, { status: 400 });
  }
  if (!VALID_QUALIFICATIONS.includes(qualification as (typeof VALID_QUALIFICATIONS)[number])) {
    return NextResponse.json({ error: '資格情報が正しくありません' }, { status: 400 });
  }
  if (primaryFacilityId && !facilityIds.includes(primaryFacilityId)) {
    return NextResponse.json({ error: '主所属は所属事業所の中から選択してください' }, { status: 400 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: existingProfile, error: profileFetchError } = await serviceClient
    .from('profiles')
    .select('id, email, name, role, qualification, facility_id')
    .eq('id', profileId)
    .single();
  if (profileFetchError || !existingProfile) {
    return NextResponse.json({ error: '対象スタッフが見つかりません' }, { status: 404 });
  }

  const { data: authData, error: authFetchError } = await serviceClient.auth.admin.getUserById(profileId);
  if (authFetchError || !authData.user) {
    return NextResponse.json({ error: '対象スタッフのログインアカウントが見つかりません' }, { status: 409 });
  }

  const { data: duplicateProfile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .neq('id', profileId)
    .maybeSingle();
  if (duplicateProfile) {
    return NextResponse.json({ error: 'このメールアドレスは別のスタッフに登録されています' }, { status: 409 });
  }

  const { data: authUsers, error: authListError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if (authListError) {
    return NextResponse.json({ error: `ログインアカウントの確認に失敗しました: ${authListError.message}` }, { status: 500 });
  }
  const duplicateAuth = authUsers.users.find(
    (authUser) => authUser.email?.toLowerCase() === email && authUser.id !== profileId,
  );
  if (duplicateAuth) {
    return NextResponse.json({
      error: 'このメールアドレスのログインアカウントが既に存在します。管理者にアカウント統合を依頼してください。',
    }, { status: 409 });
  }

  const previousEmail = authData.user.email ?? existingProfile.email;
  const previousMetadata = authData.user.user_metadata ?? {};
  const authNeedsUpdate = previousEmail.toLowerCase() !== email || previousMetadata.name !== name;

  if (authNeedsUpdate) {
    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(profileId, {
      email,
      email_confirm: true,
      user_metadata: { ...previousMetadata, name },
    });
    if (authUpdateError) {
      return NextResponse.json({ error: `ログイン情報の更新に失敗しました: ${authUpdateError.message}` }, { status: 500 });
    }
  }

  const { error: profileUpdateError } = await serviceClient
    .from('profiles')
    .update({
      email,
      name,
      role,
      qualification,
      facility_id: primaryFacilityId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (profileUpdateError) {
    if (authNeedsUpdate) {
      await serviceClient.auth.admin.updateUserById(profileId, {
        email: previousEmail,
        email_confirm: true,
        user_metadata: previousMetadata,
      });
    }
    return NextResponse.json({ error: `スタッフ情報の更新に失敗しました: ${profileUpdateError.message}` }, { status: 500 });
  }

  const { data: previousFacilities } = await serviceClient
    .from('profile_facilities')
    .select('facility_id, is_primary')
    .eq('profile_id', profileId);

  const { error: facilitiesDeleteError } = await serviceClient
    .from('profile_facilities')
    .delete()
    .eq('profile_id', profileId);

  if (facilitiesDeleteError) {
    return NextResponse.json({ error: `施設割り当ての更新に失敗しました: ${facilitiesDeleteError.message}` }, { status: 500 });
  }

  if (facilityIds.length > 0) {
    const { error: facilitiesInsertError } = await serviceClient
      .from('profile_facilities')
      .insert(facilityIds.map((facilityId) => ({
        profile_id: profileId,
        facility_id: facilityId,
        is_primary: facilityId === primaryFacilityId,
      })));

    if (facilitiesInsertError) {
      if (previousFacilities && previousFacilities.length > 0) {
        await serviceClient.from('profile_facilities').insert(
          previousFacilities.map((facility) => ({ profile_id: profileId, ...facility })),
        );
      }
      return NextResponse.json({ error: `施設割り当ての保存に失敗しました: ${facilitiesInsertError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
