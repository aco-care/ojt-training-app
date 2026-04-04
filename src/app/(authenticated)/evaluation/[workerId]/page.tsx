import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ForeignWorker,
  OjtRecord,
  FinalEvaluation,
  Profile,
  EvalRating,
} from '@/lib/types';
import { CHECKLIST_ITEMS } from '@/lib/types';
import PageHeader from '@/components/page-header';
import EvaluationForm from './evaluation-form';
import EvaluationApproval from './evaluation-approval';
import CareerAlert from './career-alert';

interface EvaluationPageProps {
  params: Promise<{ workerId: string }>;
}

export default async function EvaluationPage({ params }: EvaluationPageProps) {
  const { workerId } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = profileRow as Profile | null;
  const userRole = profile?.role ?? 'worker';

  // Fetch worker with facility
  const { data: worker } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .eq('id', workerId)
    .single();

  if (!worker) {
    notFound();
  }

  const typedWorker = worker as ForeignWorker & {
    facility: { id: string; name: string } | null;
  };

  // Fetch existing final evaluation
  const { data: evaluationData } = await supabase
    .from('final_evaluations')
    .select('*, approved_by_profile:profiles(id, name)')
    .eq('worker_id', workerId)
    .order('eval_date', { ascending: false })
    .limit(1);

  const evaluations = (evaluationData ?? []) as (FinalEvaluation & {
    approved_by_profile: { id: string; name: string } | null;
  })[];

  const existingEvaluation = evaluations.length > 0 ? evaluations[0] : null;

  // Fetch latest OJT records to pre-populate checklist data
  const { data: ojtRecordsData } = await supabase
    .from('ojt_records')
    .select('*')
    .eq('worker_id', workerId)
    .order('date', { ascending: false });

  const ojtRecords = (ojtRecordsData ?? []) as OjtRecord[];

  // Extract latest checklist scores from OJT records
  let prefilledSelf: EvalRating[] = Array(CHECKLIST_ITEMS.length).fill('fair');
  let prefilledTrainer: EvalRating[] = Array(CHECKLIST_ITEMS.length).fill('fair');

  if (ojtRecords.length > 0) {
    // Find the latest record that has checklist data
    const latestWithChecklist = ojtRecords.find(
      (r) => r.checklist_self.length > 0 || r.checklist_trainer.length > 0,
    );
    if (latestWithChecklist) {
      prefilledSelf = CHECKLIST_ITEMS.map(
        (_, idx) =>
          (latestWithChecklist.checklist_self[idx] as EvalRating) ?? 'fair',
      );
      prefilledTrainer = CHECKLIST_ITEMS.map(
        (_, idx) =>
          (latestWithChecklist.checklist_trainer[idx] as EvalRating) ?? 'fair',
      );
    }
  }

  // If existing evaluation, use its scores
  const formData = existingEvaluation
    ? {
        id: existingEvaluation.id,
        eval_date: existingEvaluation.eval_date,
        scores_self: existingEvaluation.scores_self,
        scores_trainer: existingEvaluation.scores_trainer,
        supervisor_comment: existingEvaluation.supervisor_comment,
        approved_by: existingEvaluation.approved_by,
        approved_at: existingEvaluation.approved_at,
        approved_by_name: existingEvaluation.approved_by_profile?.name ?? null,
      }
    : null;

  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="最終評価"
        subtitle={`${typedWorker.name} - ${typedWorker.facility?.name ?? '未所属'}`}
      />

      <div className="px-4 py-6 sm:px-6 space-y-6">
        {/* Career update alert */}
        {existingEvaluation?.approved_at && (
          <CareerAlert approvedAt={existingEvaluation.approved_at} />
        )}

        {/* Evaluation form */}
        <EvaluationForm
          workerId={workerId}
          existingEvaluation={formData}
          prefilledSelf={prefilledSelf}
          prefilledTrainer={prefilledTrainer}
          userRole={userRole}
        />

        {/* Approval section (admin/supervisor only) */}
        {isAdminOrSupervisor && existingEvaluation && (
          <EvaluationApproval
            evaluationId={existingEvaluation.id}
            approvedBy={existingEvaluation.approved_by}
            approvedAt={existingEvaluation.approved_at}
            approvedByName={existingEvaluation.approved_by_profile?.name ?? null}
          />
        )}
      </div>
    </div>
  );
}
