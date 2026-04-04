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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const typedProfile = profile as Profile;

  // Fetch plan with joins
  const { data: plan } = await supabase
    .from('training_plans')
    .select(`
      *,
      worker:foreign_workers(id, name, profile_id),
      item:training_items(id, title, subtopics),
      trainer:profiles!training_plans_trainer_id_fkey(id, name),
      creator:profiles!training_plans_created_by_fkey(id, name)
    `)
    .eq('id', planId)
    .single();

  if (!plan) notFound();

  const typedPlan = plan as TrainingPlan & {
    worker: { id: string; name: string; profile_id: string | null };
    item: TrainingItem & { subtopics: { id: string; title: string }[] };
    trainer: { id: string; name: string };
    creator: { id: string; name: string };
  };

  // Determine user's role in this plan
  type PlanRole = 'supervisor' | 'trainer' | 'worker' | 'viewer';
  let planRole: PlanRole = 'viewer';

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
        />
      </div>
    </div>
  );
}
