import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, TrainingPlan, TrainingItem } from '@/lib/types';
import PageHeader from '@/components/page-header';
import PlanDetail from './plan-detail';

interface PlanDetailPageProps {
  params: Promise<{ planId: string }>;
}

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { planId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: plan }, { data: staffData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single(),
    supabase
      .from('training_plans')
      .select(`
        *,
        worker:foreign_workers(id, name, profile_id),
        item:training_items(id, title, training_subtopics(id, title)),
        trainer:profiles!training_plans_trainer_id_fkey(id, name),
        creator:profiles!training_plans_created_by_fkey(id, name)
      `)
      .eq('id', planId)
      .single(),
    supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['trainer', 'supervisor', 'admin'])
      .eq('is_archived', false)
      .order('name'),
  ]);
  const staffList = (staffData ?? []) as { id: string; name: string }[];

  if (!profile) redirect('/login');

  const typedProfile = profile as Profile;

  if (!plan) notFound();

  const typedPlan = plan as TrainingPlan & {
    worker: { id: string; name: string; profile_id: string | null };
    item: TrainingItem & { training_subtopics: { id: string; title: string }[] };
    trainer: { id: string; name: string };
    creator: { id: string; name: string };
  };

  // Determine user's role in this plan
  type PlanRole = 'supervisor' | 'trainer' | 'worker' | 'viewer';
  let planRole: PlanRole = 'viewer';
  const isAlsoTrainer = user.id === typedPlan.trainer_id;

  if (typedProfile.role === 'admin' || typedProfile.role === 'supervisor') {
    planRole = 'supervisor';
  } else if (user.id === typedPlan.trainer_id) {
    planRole = 'trainer';
  } else if (typedPlan.worker.profile_id === user.id) {
    planRole = 'worker';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`${typedPlan.worker.name} の研修`}
        subtitle={typedPlan.item.title}
      />
      <div className="px-4 py-6 sm:px-6">
        <PlanDetail
          plan={typedPlan}
          planRole={planRole}
          currentUserId={user.id}
          currentUserName={typedProfile.name}
          isAlsoTrainer={isAlsoTrainer}
          staffList={staffList}
        />
      </div>
    </div>
  );
}
