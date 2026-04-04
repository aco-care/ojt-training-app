import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ForeignWorker,
  TrainingItem,
  TrainingSubtopic,
  TrainingSession,
  TrainingApproval,
  TrainingStatus,
} from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';

interface TrainingOverviewPageProps {
  params: Promise<{ workerId: string }>;
}

const ITEM_NUMBERS = ['①', '②', '③', '④', '⑤'];

function calculateSessionHours(session: TrainingSession): number {
  const start = new Date(`2000-01-01T${session.start_time}`);
  const end = new Date(`2000-01-01T${session.end_time}`);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (session.break_minutes || 0) / 60;
}

function computeStatus(
  sessions: TrainingSession[],
  subtopics: TrainingSubtopic[],
  totalHours: number,
  targetHours: number,
  approval: TrainingApproval | undefined
): TrainingStatus {
  if (approval?.status === 'completed') return 'completed';
  if (sessions.length === 0) return 'not_started';

  // Check if all subtopics are completed across all sessions
  const completedSubtopicIds = new Set(
    sessions.flatMap((s) => s.completed_subtopics)
  );
  const allSubtopicsComplete =
    subtopics.length > 0 && subtopics.every((st) => completedSubtopicIds.has(st.id));
  const hoursComplete = totalHours >= targetHours;

  if (allSubtopicsComplete && hoursComplete) return 'completed';
  return 'in_progress';
}

export default async function TrainingOverviewPage({
  params,
}: TrainingOverviewPageProps) {
  const { workerId } = await params;
  const supabase = await createClient();

  // Fetch worker
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

  // Fetch all training sessions for this worker
  const { data: trainingSessions } = await supabase
    .from('training_sessions')
    .select('id, worker_id, item_id, date, start_time, end_time, completed_subtopics, break_minutes')
    .eq('worker_id', workerId);

  const sessions = (trainingSessions ?? []) as TrainingSession[];

  // Fetch training approvals for this worker
  const { data: trainingApprovals } = await supabase
    .from('training_approvals')
    .select('id, worker_id, item_id, status, approved_by, approved_at')
    .eq('worker_id', workerId);

  const approvals = (trainingApprovals ?? []) as TrainingApproval[];

  // Build progress data for each training item
  const itemProgress = items.map((item, index) => {
    const itemSessions = sessions.filter((s) => s.item_id === item.id);
    const totalHours = itemSessions.reduce(
      (acc, s) => acc + calculateSessionHours(s),
      0
    );
    const percentage =
      item.target_hours > 0
        ? Math.min(100, (totalHours / item.target_hours) * 100)
        : 0;

    const subtopics = item.subtopics ?? [];
    const completedSubtopicIds = new Set(
      itemSessions.flatMap((s) => s.completed_subtopics)
    );
    const completedSubtopicCount = subtopics.filter((st) =>
      completedSubtopicIds.has(st.id)
    ).length;

    const approval = approvals.find((a) => a.item_id === item.id);
    const status = computeStatus(
      itemSessions,
      subtopics,
      totalHours,
      item.target_hours,
      approval
    );

    return {
      item,
      number: ITEM_NUMBERS[index] ?? `${index + 1}`,
      totalHours,
      percentage,
      completedSubtopicCount,
      totalSubtopicCount: subtopics.length,
      sessionCount: itemSessions.length,
      status,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="研修進捗"
        subtitle={`${typedWorker.name}${typedWorker.facility ? ` / ${typedWorker.facility.name}` : ''}`}
      />

      <div className="px-4 py-6 sm:px-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">
              {itemProgress.filter((p) => p.status === 'completed').length}
            </p>
            <p className="mt-1 text-xs text-gray-500">完了</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">
              {itemProgress.filter((p) => p.status === 'in_progress').length}
            </p>
            <p className="mt-1 text-xs text-gray-500">進行中</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-600">
              {itemProgress.filter((p) => p.status === 'not_started').length}
            </p>
            <p className="mt-1 text-xs text-gray-500">未着手</p>
          </div>
        </div>

        {/* Training Items */}
        <div className="space-y-4">
          {itemProgress.map((progress) => (
            <Link
              key={progress.item.id}
              href={`/training/${workerId}/${progress.item.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:bg-gray-50"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    <span className="mr-1 text-blue-600">{progress.number}</span>
                    {progress.item.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {progress.sessionCount}回実施 / 目標 {progress.item.target_sessions}回
                  </p>
                </div>
                <StatusBadge status={progress.status} />
              </div>

              <ProgressBar
                percentage={progress.percentage}
                label={`${progress.totalHours.toFixed(1)}h / ${progress.item.target_hours}h`}
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  サブトピック: {progress.completedSubtopicCount} / {progress.totalSubtopicCount} 完了
                </span>
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {itemProgress.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">研修項目が設定されていません</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <Link
        href={`/training/${workerId}/${items[0]?.id ?? ''}?addSession=true`}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95 sm:h-auto sm:w-auto sm:rounded-lg sm:px-5 sm:py-3"
      >
        <svg
          className="h-6 w-6 sm:mr-2 sm:h-5 sm:w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        <span className="hidden sm:inline text-sm font-medium">セッション追加</span>
      </Link>
    </div>
  );
}
