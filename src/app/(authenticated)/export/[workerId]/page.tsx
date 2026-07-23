import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ForeignWorker,
  TrainingItem,
  TrainingSubtopic,
  TrainingSession,
  TrainingApproval,
  OjtUser,
  OjtRecord,
  FinalEvaluation,
} from '@/lib/types';
import { OJT_STEPS } from '@/lib/types';
import PageHeader from '@/components/page-header';
import ExportClient from './export-client';

interface ExportPageProps {
  params: Promise<{ workerId: string }>;
}

export default async function ExportPage({ params }: ExportPageProps) {
  const { workerId } = await params;
  const supabase = await createClient();

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

  // Fetch training items with subtopics
  const { data: trainingItems } = await supabase
    .from('training_items')
    .select('*, subtopics:training_subtopics(id, item_id, title, sort_order)')
    .order('sort_order');

  const items = (trainingItems ?? []) as (TrainingItem & {
    subtopics: TrainingSubtopic[];
  })[];

  // Fetch training sessions with trainer profile
  const { data: trainingSessions } = await supabase
    .from('training_sessions')
    .select('*, trainer:profiles(id, name)')
    .eq('worker_id', workerId)
    .order('date');

  const sessions = (trainingSessions ?? []) as (TrainingSession & {
    trainer: { id: string; name: string } | null;
    training_plan_id: string | null;
  })[];

  // Fetch 3-party flow comments (trainer/worker/supervisor) for linked training plans
  const trainingPlanIds = [...new Set(sessions.map((s) => s.training_plan_id).filter((id): id is string => !!id))];
  const { data: trainingPlansData } = trainingPlanIds.length > 0
    ? await supabase
        .from('training_plans')
        .select('id, trainer_comment, worker_comment, supervisor_comment_to_trainer, supervisor_comment_to_worker')
        .in('id', trainingPlanIds)
    : { data: [] };

  const trainingPlanComments = new Map(
    (trainingPlansData ?? []).map((p) => [p.id, {
      trainer_comment: p.trainer_comment as string | null,
      worker_comment: p.worker_comment as string | null,
      supervisor_comment_to_trainer: p.supervisor_comment_to_trainer as string | null,
      supervisor_comment_to_worker: p.supervisor_comment_to_worker as string | null,
    }]),
  );

  // Fetch training approvals with approved_by profile
  const { data: trainingApprovals } = await supabase
    .from('training_approvals')
    .select('*, approved_by_profile:profiles(id, name)')
    .eq('worker_id', workerId);

  const approvals = (trainingApprovals ?? []) as (TrainingApproval & {
    approved_by_profile: { id: string; name: string } | null;
  })[];

  // Fetch OJT users
  const { data: ojtUsersData } = await supabase
    .from('ojt_users')
    .select('id, worker_id, user_initial, visit_frequency, ojt_start_date, ojt_status, created_at')
    .eq('worker_id', workerId)
    .order('created_at');

  const ojtUsers = (ojtUsersData ?? []) as OjtUser[];

  // Fetch OJT records with companion profile
  const { data: ojtRecordsData } = await supabase
    .from('ojt_records')
    .select('*, companion:profiles!ojt_records_companion_id_fkey(id, name)')
    .eq('worker_id', workerId)
    .order('date');

  const ojtRecords = (ojtRecordsData ?? []) as (OjtRecord & {
    companion: { id: string; name: string } | null;
    ojt_plan_id: string | null;
  })[];

  // Fetch 3-party flow comments (trainer/worker/supervisor) for linked OJT plans
  const ojtPlanIds = [...new Set(ojtRecords.map((r) => r.ojt_plan_id).filter((id): id is string => !!id))];
  const { data: ojtPlansData } = ojtPlanIds.length > 0
    ? await supabase
        .from('ojt_plans')
        .select('id, trainer_comment, worker_comment, supervisor_comment_to_trainer, supervisor_comment_to_worker')
        .in('id', ojtPlanIds)
    : { data: [] };

  const ojtPlanComments = new Map(
    (ojtPlansData ?? []).map((p) => [p.id, {
      trainer_comment: p.trainer_comment as string | null,
      worker_comment: p.worker_comment as string | null,
      supervisor_comment_to_trainer: p.supervisor_comment_to_trainer as string | null,
      supervisor_comment_to_worker: p.supervisor_comment_to_worker as string | null,
    }]),
  );

  // Fetch final evaluations with approved_by profile
  const { data: finalEvaluationsData } = await supabase
    .from('final_evaluations')
    .select('*, approved_by_profile:profiles(id, name)')
    .eq('worker_id', workerId);

  const finalEvaluations = (finalEvaluationsData ?? []) as (FinalEvaluation & {
    approved_by_profile: { id: string; name: string } | null;
  })[];

  // Serialize data for client component
  const workerInfo = {
    name: typedWorker.name,
    nationality: typedWorker.nationality,
    facility_name: typedWorker.facility?.name ?? '未所属',
  };

  // Build training data per item
  const trainingData = items.map((item) => {
    const itemSessions = sessions
      .filter((s) => s.item_id === item.id)
      .map((s) => ({
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        trainer_name: s.trainer?.name ?? '不明',
        format: s.format,
        completed_subtopics: s.completed_subtopics,
        notes: s.notes,
        comments: s.training_plan_id ? trainingPlanComments.get(s.training_plan_id) ?? null : null,
      }));

    const approval = approvals.find((a) => a.item_id === item.id);
    const approvalData = approval?.approved_by_profile
      ? {
          approved_by_name: approval.approved_by_profile.name,
          approved_at: approval.approved_at ?? '',
        }
      : null;

    return {
      item: {
        id: item.id,
        item_number: item.item_number,
        title: item.title,
        target_hours: item.target_hours,
      },
      subtopics: (item.subtopics ?? []).map((st) => ({
        id: st.id,
        title: st.title,
        sort_order: st.sort_order,
      })),
      sessions: itemSessions,
      approval: approvalData,
    };
  });

  // Build OJT data per user
  const ojtData = ojtUsers.map((ojtUser) => {
    const userRecords = ojtRecords
      .filter((r) => r.ojt_user_id === ojtUser.id)
      .map((r) => {
        const stepInfo = OJT_STEPS.find(
          (s) => s.step === r.step,
        );
        return {
          step: r.step,
          step_label: stepInfo ? `${stepInfo.number} ${stepInfo.label}` : r.step,
          attempt_number: r.attempt_number,
          date: r.date,
          companion_name: r.companion?.name ?? null,
          content: r.content,
          checklist_self: r.checklist_self as string[],
          checklist_trainer: r.checklist_trainer as string[],
          result: r.result,
          manager_comment: r.manager_comment,
          worker_comment: r.worker_comment,
          notes: r.notes,
          comments: r.ojt_plan_id ? ojtPlanComments.get(r.ojt_plan_id) ?? null : null,
        };
      });

    return {
      ojtUser: {
        id: ojtUser.id,
        user_initial: ojtUser.user_initial,
        visit_frequency: ojtUser.visit_frequency,
        ojt_start_date: ojtUser.ojt_start_date,
        ojt_status: ojtUser.ojt_status,
      },
      records: userRecords,
    };
  });

  // Build final evaluation data
  const evaluationData = finalEvaluations.length > 0
    ? {
        eval_date: finalEvaluations[0].eval_date,
        scores_self: finalEvaluations[0].scores_self as string[],
        scores_trainer: finalEvaluations[0].scores_trainer as string[],
        supervisor_comment: finalEvaluations[0].supervisor_comment,
        approved_by_name: finalEvaluations[0].approved_by_profile?.name ?? null,
        approved_at: finalEvaluations[0].approved_at,
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="帳票出力"
        subtitle={`${typedWorker.name} - ${typedWorker.facility?.name ?? '未所属'}`}
      />

      <div className="px-4 py-6 sm:px-6">
        <ExportClient
          worker={workerInfo}
          trainingData={trainingData}
          ojtData={ojtData}
          evaluationData={evaluationData}
        />
      </div>
    </div>
  );
}
