import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import AuditLogList from './audit-log-list';

export const revalidate = 0;

export default async function AuditLogsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'supervisor'].includes(profile.role)) redirect('/');

  const { data: logsData } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const logs = (logsData ?? []) as {
    id: string;
    actor_id: string;
    actor_name: string;
    action: string;
    target_table: string;
    target_id: string;
    target_label: string;
    description: string;
    created_at: string;
  }[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="操作履歴" subtitle="スタッフの操作ログを確認できます" />
      <div className="px-4 py-6 sm:px-6">
        <AuditLogList initialLogs={logs} />
      </div>
    </div>
  );
}
