import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ForeignWorker,
  TrainingItem,
  TrainingSubtopic,
  TrainingSession,
  TrainingApproval,
  Profile,
} from '@/lib/types';
import { FORMAT_LABELS } from '@/lib/types';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import ProgressBar from '@/components/progress-bar';
import StatusBadge from '@/components/status-badge';
import ApprovalAction from './approval-action';

interface TrainingItemDetailPageProps {
  params: Promise<{ workerId: string; itemId: string }>;
}

function calculateSessionHours(session: TrainingSession): number {
  const start = new Date(`2000-01-01T${session.start_time}`);
  const end = new Date(`2000-01-01T${session.end_time}`);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (session.break_minutes || 0) / 60;
}

export default async function TrainingItemDetailPage({
  params,
}: TrainingItemDetailPageProps) {
  const { workerId, itemId } = await params;
  const supabase = await createClient();

  // Fetch worker, facilities, and training item in parallel
  const [
    { data: worker },
    { data: workerFacilitiesData },
    { data: trainingItem },
  ] = await Promise.all([
    supabase
      .from('foreign_workers')
      .select('*, facility:facilities(id, name)')
      .eq('id', workerId)
      .single(),
    supabase
      .from('worker_facilities')
      .select('facility:facilities(id, name)')
      .eq('worker_id', workerId),
    supabase
      .from('training_items')
      .select('*, subtopics:training_subtopics(id, item_id, title, sort_order)')
      .eq('id', itemId)
      .single(),
  ]);

  if (!worker) {
    notFound();
  }

  const typedWorker = worker as ForeignWorker & {
    facility: { id: string; name: string } | null;
  };

  const workerFacilities = (workerFacilitiesData ?? [])
    .map((wf: Record<string, unknown>) => wf.facility as { id: string; name: string } | null)
    .filter((f): f is { id: string; name: string } => f !== null);

  const workerFacilityIds = workerFacilities.map((f) => f.id);

  if (!trainingItem) {
    notFound();
  }

  const item = trainingItem as TrainingItem & {
    subtopics: TrainingSubtopic[];
  };
  const subtopics = (item.subtopics ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  // Fetch sessions, approval, trainers, and current user in parallel
  const [
    { data: trainingSessions },
    { data: approvalData },
    { data: trainersData },
    { data: { user: authUser } },
  ] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('*, trainer:profiles(id, name, email, role), facility:facilities(id, name)')
      .eq('worker_id', workerId)
      .eq('item_id', itemId)
      .order('date', { ascending: false }),
    supabase
      .from('training_approvals')
      .select('id, worker_id, item_id, status, approved_by, approved_at')
      .eq('worker_id', workerId)
      .eq('item_id', itemId)
      .single(),
    supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('facility_id', workerFacilityIds.length > 0 ? workerFacilityIds : ['__none__'])
      .in('role', ['trainer', 'supervisor', 'admin']),
    supabase.auth.getUser(),
  ]);

  const sessions = (trainingSessions ?? []) as (TrainingSession & {
    trainer: Pick<Profile, 'id' | 'name' | 'email' | 'role'> | null;
    facility: { id: string; name: string } | null;
  })[];

  const approval = approvalData as TrainingApproval | null;

  const trainers = (trainersData ?? []) as Pick<
    Profile,
    'id' | 'name' | 'email' | 'role'
  >[];

  const { data: currentProfile } = authUser
    ? await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', authUser.id)
        .single()
    : { data: null };

  const canApprove =
    currentProfile &&
    (currentProfile.role === 'supervisor' || currentProfile.role === 'admin');

  // Compute aggregated subtopic completion across all sessions
  const completedSubtopicIds = new Set(
    sessions.flatMap((s) => s.completed_subtopics)
  );

  // Cumulative hours
  const totalHours = sessions.reduce(
    (acc, s) => acc + calculateSessionHours(s),
    0
  );
  const percentage =
    item.target_hours > 0
      ? Math.min(100, (totalHours / item.target_hours) * 100)
      : 0;

  // Check completion eligibility for approval
  const allSubtopicsComplete =
    subtopics.length > 0 &&
    subtopics.every((st) => completedSubtopicIds.has(st.id));
  const hoursTargetMet = totalHours >= item.target_hours;
  const isEligibleForApproval =
    allSubtopicsComplete && hoursTargetMet && approval?.status !== 'completed';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5); // HH:MM
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <PageHeader
        title={item.title}
        subtitle={`${typedWorker.name} / 研修項目詳細`}
      />

      <div className="px-4 py-6 sm:px-6">
        {/* Item Summary Card */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">研修概要</h2>
            <StatusBadge status={approval?.status ?? (sessions.length > 0 ? 'in_progress' : 'not_started')} />
          </div>
          {/* 研修要件の説明 */}
          <div className="mb-4 rounded-md bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs font-medium text-blue-800">
              この研修項目は <span className="font-bold">{item.target_sessions > 0 ? (item.target_hours / item.target_sessions % 1 === 0 ? (item.target_hours / item.target_sessions).toFixed(0) : (item.target_hours / item.target_sessions).toFixed(1)) : '—'}時間/回 × {item.target_sessions}回</span> ＝ 合計<span className="font-bold">{item.target_hours}時間</span>で完了
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500">目標時間</p>
              <p className="mt-0.5 text-sm text-gray-900">{item.target_hours}時間</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">目標回数</p>
              <p className="mt-0.5 text-sm text-gray-900">{item.target_sessions}回</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">累計時間</p>
              <p className="mt-0.5 text-sm text-gray-900">{totalHours.toFixed(1)}時間</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">実施回数</p>
              <p className="mt-0.5 text-sm text-gray-900">{sessions.length}回</p>
            </div>
          </div>
          <ProgressBar
            percentage={percentage}
            label={`${totalHours.toFixed(1)}h / ${item.target_hours}h`}
          />
        </div>

        {/* Subtopic Checklist */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            サブトピック ({completedSubtopicIds.size} / {subtopics.length} 完了)
          </h2>
          {subtopics.length === 0 ? (
            <p className="text-sm text-gray-500">サブトピックが設定されていません</p>
          ) : (
            <ul className="space-y-2">
              {subtopics.map((st) => {
                const isCompleted = completedSubtopicIds.has(st.id);
                return (
                  <li
                    key={st.id}
                    className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    {isCompleted ? (
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    <span
                      className={`text-sm ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                      {st.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Approval Action */}
        {canApprove && isEligibleForApproval && (
          <div className="mb-6">
            <ApprovalAction
              workerId={workerId}
              itemId={itemId}
              approvedBy={currentProfile.id}
            />
          </div>
        )}

        {/* Session History */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            セッション履歴 ({sessions.length}件)
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">まだセッションが記録されていません</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const hours = calculateSessionHours(session);
                const sessionSubtopics = subtopics.filter((st) =>
                  session.completed_subtopics.includes(st.id)
                );
                return (
                  <div
                    key={session.id}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(session.date)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          {' '}({hours.toFixed(1)}h{(session.break_minutes || 0) > 0 ? ` 休憩${session.break_minutes}分除く` : ''})
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {FORMAT_LABELS[session.format]}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {session.facility && (
                        <p className="text-xs text-gray-500">
                          事業所: {session.facility.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        指導者: {session.trainer?.name ?? '不明'}
                      </p>
                      {sessionSubtopics.length > 0 && (
                        <p className="text-xs text-gray-500">
                          完了サブトピック: {sessionSubtopics.map((st) => st.title).join('、')}
                        </p>
                      )}
                      {session.notes && (
                        <p className="mt-1 text-xs text-gray-600">
                          {session.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guidance Banner */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">研修記録は予定管理から入力してください</p>
          <p className="mt-1 text-xs text-blue-600">予定を作成 → 研修実施 → 3者フロー入力で記録が登録されます</p>
          <Link href="/schedule" className="mt-2 inline-block rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            予定管理へ
          </Link>
        </div>
      </div>
    </div>
  );
}
