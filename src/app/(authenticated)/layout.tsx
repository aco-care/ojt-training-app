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

  const userName = profile?.name ?? user.email ?? '';
  const userRole = profile?.role ?? 'worker';

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
