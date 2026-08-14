import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, OjtPlan } from '@/lib/types';
import PageHeader from '@/components/page-header';
import OjtPlanList from './ojt-plan-list';

export default async function OjtPlansPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch all data in parallel
  const [
    { data: profile },
    { data: plansData },
    { data: workersData },
    { data: ojtUsersData },
    { data: staffData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single(),
    supabase
      .from('ojt_plans')
      .select(`
        *,
        worker:foreign_workers(id, name),
        ojt_user:ojt_users(id, user_initial, ojt_status),
        companion:profiles!ojt_plans_companion_id_fkey(id, name)
      `)
      .order('planned_date', { ascending: false }),
    supabase
      .from('foreign_workers')
      .select('id, name, facility_id')
      .order('name'),
    supabase
      .from('ojt_users')
      .select('id, worker_id, user_initial, ojt_status')
      .neq('ojt_status', 'completed')
      .order('created_at'),
    supabase
      .from('profiles')
      .select('id, name, role, qualification, facility_id, profile_facilities(facility_id)')
      .in('role', ['trainer', 'supervisor', 'admin'])
      .eq('is_archived', false)
      .order('name'),
  ]);

  if (!profile) redirect('/login');
  const userRole = (profile as Profile).role;

  const plans = (plansData ?? []) as (OjtPlan & {
    worker: { id: string; name: string };
    ojt_user: { id: string; user_initial: string; ojt_status: string } | null;
    companion: { id: string; name: string };
  })[];
  const workers = (workersData ?? []) as { id: string; name: string; facility_id: string }[];
  const ojtUsers = (ojtUsersData ?? []) as { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  const staff = (staffData ?? []) as { id: string; name: string; role: string; qualification: string; facility_id: string | null; profile_facilities: { facility_id: string }[] }[];

  const canCreate = userRole === 'admin' || userRole === 'supervisor' || userRole === 'trainer';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="OJT予定管理" subtitle="3者フロー：予定作成 → 当日入力 → フィードバック" />
      <div className="px-4 py-6 sm:px-6">
        <OjtPlanList
          plans={plans}
          workers={workers}
          ojtUsers={ojtUsers}
          staff={staff}
          canCreate={canCreate}
          currentUserId={user.id}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
