import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, OjtPlan } from '@/lib/types';
import PageHeader from '@/components/page-header';
import OjtPlanDetail from './ojt-plan-detail';

interface OjtPlanDetailPageProps {
  params: Promise<{ planId: string }>;
}

export default async function OjtPlanDetailPage({ params }: OjtPlanDetailPageProps) {
  const { planId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const typedProfile = profile as Profile;

  const { data: plan } = await supabase
    .from('ojt_plans')
    .select(`
      *,
      worker:foreign_workers(id, name, profile_id),
      ojt_user:ojt_users(id, user_initial, ojt_status),
      companion:profiles!ojt_plans_companion_id_fkey(id, name),
      creator:profiles!ojt_plans_created_by_fkey(id, name)
    `)
    .eq('id', planId)
    .single();

  if (!plan) notFound();

  const typedPlan = plan as OjtPlan & {
    worker: { id: string; name: string; profile_id: string | null };
    ojt_user: { id: string; user_initial: string; ojt_status: string } | null;
    companion: { id: string; name: string };
    creator: { id: string; name: string };
  };

  // Determine role in this plan
  type PlanRole = 'supervisor' | 'trainer' | 'worker' | 'viewer';
  let planRole: PlanRole = 'viewer';

  if (typedProfile.role === 'admin' || typedProfile.role === 'supervisor') {
    planRole = 'supervisor';
  } else if (user.id === typedPlan.companion_id) {
    planRole = 'trainer';
  } else if (typedPlan.worker.profile_id === user.id) {
    planRole = 'worker';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`${typedPlan.worker.name} のOJT`}
        subtitle={typedPlan.ojt_user ? `利用者 ${typedPlan.ojt_user.user_initial}` : undefined}
      />
      <div className="px-4 py-6 sm:px-6">
        <OjtPlanDetail
          plan={typedPlan}
          planRole={planRole}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
