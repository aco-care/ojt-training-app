import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PageHeader from '@/components/page-header';
import HelpContent from './help-content';

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="ヘルプ" subtitle="操作マニュアル・よくあるご質問" />
      <div className="px-4 py-6 sm:px-6">
        <HelpContent />
      </div>
    </div>
  );
}
