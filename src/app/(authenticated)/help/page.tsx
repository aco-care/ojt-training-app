import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PageHeader from '@/components/page-header';
import HelpContent from './help-content';
import type { UserRole } from '@/lib/types';

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = (profile?.role ?? 'worker') as UserRole;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="ヘルプ" subtitle="操作マニュアル・よくあるご質問" />
      <div className="px-4 py-6 sm:px-6">
        <HelpContent userRole={userRole} />
      </div>
    </div>
  );
}
