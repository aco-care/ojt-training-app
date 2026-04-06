import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, TrainingItem, TrainingPlan } from '@/lib/types';
import PageHeader from '@/components/page-header';
import PlanList from './plan-list';

export default async function TrainingPlansPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch all data in parallel
  const [
    { data: profile },
    { data: plansData },
    { data: workersData },
    { data: itemsData },
    { data: trainersData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single(),
    supabase
      .from('training_plans')
      .select('*, worker:foreign_workers(id, name), item:training_items(id, title), trainer:profiles!training_plans_trainer_id_fkey(id, name)')
      .order('planned_date', { ascending: false }),
    supabase
      .from('foreign_workers')
      .select('id, name')
      .order('name'),
    supabase
      .from('training_items')
      .select('id, title, subtopics')
      .order('sort_order'),
    supabase
      .from('profiles')
      .select('id, name, role, qualification')
      .in('role', ['trainer', 'supervisor', 'admin'])
      .eq('is_archived', false)
      .order('name'),
  ]);

  if (!profile) redirect('/login');
  const userRole = (profile as Profile).role;

  const plans = (plansData ?? []) as (TrainingPlan & {
    worker: { id: string; name: string };
    item: { id: string; title: string };
    trainer: { id: string; name: string };
  })[];
  const workers = (workersData ?? []) as { id: string; name: string }[];
  const items = (itemsData ?? []) as (TrainingItem & { subtopics: { id: string; title: string }[] })[];
  const trainers = (trainersData ?? []) as { id: string; name: string; role: string; qualification: string }[];

  const canCreate = userRole === 'admin' || userRole === 'supervisor' || userRole === 'trainer';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="研修予定管理" subtitle="3者フロー：予定作成 → 当日入力 → フィードバック" />
      <div className="px-4 py-6 sm:px-6">
        <PlanList
          plans={plans}
          workers={workers}
          items={items}
          trainers={trainers}
          canCreate={canCreate}
          currentUserId={user.id}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
