import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import AuthenticatedShell from './authenticated-shell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">アカウント設定を確認してください</h1>
          <p className="mt-3 text-sm text-gray-600">
            ログイン情報とスタッフ台帳が紐づいていません。特定技能外国人としては処理されていません。
          </p>
          <p className="mt-2 text-xs text-gray-500">
            管理者にメールアドレスとスタッフ登録の確認を依頼してください。
          </p>
        </div>
      </div>
    );
  }

  const userName = profile.name;
  const userRole = profile.role;

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '/';

  return (
    <AuthenticatedShell
      currentPath={pathname}
      userRole={userRole}
      userName={userName}
    >
      {children}
    </AuthenticatedShell>
  );
}
