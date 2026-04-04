import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  Profile,
  ForeignWorker,
  TrainingItem,
  TrainingSubtopic,
  TrainingSession,
  TrainingApproval,
  TrainingStatus,
  OjtUser,
  OjtRecord,
  OjtStep,
} from '@/lib/types';
import { OJT_STEPS, OJT_STATUS_LABELS, ROLE_LABELS } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';
import AdminDashboardContent from './dashboard-content';

// ---------- helpers ----------

const ITEM_NUMBERS = ['①', '②', '③', '④', '⑤'];

function statusDot(status: TrainingStatus) {
  const colors: Record<TrainingStatus, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    not_started: 'bg-gray-300',
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`}
      title={
        status === 'completed'
          ? '完了'
          : status === 'in_progress'
            ? '進行中'
            : '未着手'
      }
    />
  );
}

function computeItemStatus(
  sessions: TrainingSession[],
  subtopics: TrainingSubtopic[],
  targetHours: number,
  approval: TrainingApproval | undefined,
): TrainingStatus {
  if (approval?.status === 'completed') return 'completed';
  if (sessions.length === 0) return 'not_started';
  const completedIds = new Set(sessions.flatMap((s) => s.completed_subtopics));
  const allDone =
    subtopics.length > 0 && subtopics.every((st) => completedIds.has(st.id));
  const totalHours = sessions.reduce((acc, s) => {
    const start = new Date(`2000-01-01T${s.start_time}`);
    const end = new Date(`2000-01-01T${s.end_time}`);
    return acc + (end.getTime() - start.getTime()) / 3_600_000;
  }, 0);
  if (allDone && totalHours >= targetHours) return 'completed';
  return 'in_progress';
}

function getCurrentOjtStep(
  records: OjtRecord[],
  userId: string,
): { step: OjtStep; label: string } {
  const userRecords = records.filter((r) => r.ojt_user_id === userId);
  if (userRecords.length === 0) {
    return {
      step: OJT_STEPS[0].step,
      label: `${OJT_STEPS[0].number} ${OJT_STEPS[0].label}`,
    };
  }
  const passedSteps = userRecords
    .filter((r) => r.result === 'pass')
    .map((r) => r.step);
  const stepOrder = OJT_STEPS.map((s) => s.step);
  let latestPassedIndex = -1;
  for (const passed of passedSteps) {
    const idx = stepOrder.indexOf(passed);
    if (idx > latestPassedIndex) latestPassedIndex = idx;
  }
  const nextIndex = Math.min(latestPassedIndex + 1, OJT_STEPS.length - 1);
  const next = OJT_STEPS[nextIndex];
  return { step: next.step, label: `${next.number} ${next.label}` };
}

// ---------- page ----------

export default async function DashboardPage() {
  const supabase = await createClient();

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single();

  const profile = profileRow as Profile | null;
  const role = profile?.role ?? 'worker';
  const userName = profile?.name ?? user.email ?? '';

  // ---------- shared data fetching ----------

  const { data: workersData } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');
  const workers = (workersData ?? []) as (ForeignWorker & {
    facility: { id: string; name: string } | null;
  })[];

  const { data: itemsData } = await supabase
    .from('training_items')
    .select('id, item_number, title, target_hours, target_sessions, sort_order, subtopics:training_subtopics(id, item_id, title, sort_order)')
    .order('sort_order');
  const items = (itemsData ?? []) as (TrainingItem & {
    subtopics: TrainingSubtopic[];
  })[];

  const { data: sessionsData } = await supabase
    .from('training_sessions')
    .select('id, worker_id, item_id, date, start_time, end_time, trainer_id, completed_subtopics, companion_id, break_minutes');
  const sessions = (sessionsData ?? []) as unknown as TrainingSession[];

  const { data: approvalsData } = await supabase
    .from('training_approvals')
    .select('id, worker_id, item_id, status, approved_by, approved_at');
  const approvals = (approvalsData ?? []) as unknown as TrainingApproval[];

  const { data: ojtUsersData } = await supabase
    .from('ojt_users')
    .select('id, worker_id, facility_id, user_initial, visit_frequency, ojt_start_date, ojt_status, created_at')
    .order('created_at', { ascending: false });
  const ojtUsers = (ojtUsersData ?? []) as unknown as OjtUser[];

  const { data: ojtRecordsData } = await supabase
    .from('ojt_records')
    .select('*, companion:profiles!ojt_records_companion_id_fkey(id, name)')
    .order('date', { ascending: false });
  const ojtRecords = (ojtRecordsData ?? []) as (OjtRecord & {
    companion: { id: string; name: string } | null;
  })[];

  // ---------- compute per-worker training statuses ----------

  type WorkerItemStatus = {
    workerId: string;
    itemId: string;
    status: TrainingStatus;
  };

  // DEBUG: Log data counts
  console.log('[DASHBOARD DEBUG] sessions count:', sessions.length, 'items count:', items.length, 'workers count:', workers.length);
  if (sessions.length > 0) {
    console.log('[DASHBOARD DEBUG] first session:', JSON.stringify(sessions[0]));
  }
  if (items.length > 0) {
    console.log('[DASHBOARD DEBUG] first item subtopics count:', items[0].subtopics?.length ?? 'NO SUBTOPICS');
  }

  const workerItemStatuses: WorkerItemStatus[] = [];
  for (const w of workers) {
    for (const item of items) {
      const wSessions = sessions.filter(
        (s) => s.worker_id === w.id && s.item_id === item.id,
      );
      const approval = approvals.find(
        (a) => a.worker_id === w.id && a.item_id === item.id,
      );
      const status = computeItemStatus(
        wSessions,
        item.subtopics ?? [],
        item.target_hours,
        approval,
      );

      // DEBUG: Log each computation
      if (wSessions.length > 0) {
        const completedIds = new Set(wSessions.flatMap((s) => s.completed_subtopics ?? []));
        console.log(`[DASHBOARD DEBUG] ${w.name} - ${item.title}: sessions=${wSessions.length}, subtopics=${(item.subtopics??[]).length}, completedSubtopics=${completedIds.size}, targetHours=${item.target_hours}, status=${status}`);
      }

      workerItemStatuses.push({
        workerId: w.id,
        itemId: item.id,
        status,
      });
    }
  }

  const totalCombinations = workerItemStatuses.length;
  const completedCombinations = workerItemStatuses.filter(
    (s) => s.status === 'completed',
  ).length;
  const trainingCompletionRate =
    totalCombinations > 0
      ? Math.round((completedCombinations / totalCombinations) * 100)
      : 0;

  const ojtInProgress = ojtUsers.filter(
    (u) => u.ojt_status === 'in_progress',
  ).length;
  const ojtCompleted = ojtUsers.filter(
    (u) => u.ojt_status === 'completed',
  ).length;

  // ---------- admin / supervisor view ----------

  if (role === 'admin' || role === 'supervisor') {
    // Fetch facilities list and worker_facilities mapping
    const { data: facilitiesData } = await supabase
      .from('facilities')
      .select('id, name')
      .order('name');
    const facilitiesList = (facilitiesData ?? []) as { id: string; name: string }[];

    const { data: wfData } = await supabase
      .from('worker_facilities')
      .select('worker_id, facility_id');
    const workerFacilitiesList = (wfData ?? []) as {
      worker_id: string;
      facility_id: string;
    }[];

    // Fetch ojt_users with facility join for facility name
    const { data: ojtUsersWithFacility } = await supabase
      .from('ojt_users')
      .select('*, facility:facilities(id, name)')
      .order('created_at', { ascending: false });
    const ojtUsersEnriched = (ojtUsersWithFacility ?? []) as (OjtUser & {
      facility: { id: string; name: string } | null;
    })[];

    // Pre-compute OJT current steps on the server
    const ojtCurrentSteps = ojtUsersEnriched.map((u) => {
      const step = getCurrentOjtStep(ojtRecords, u.id);
      return { ojtUserId: u.id, step: step.step, label: step.label };
    });

    // Workers with pending items
    const workersWithPending = workers
      .map((w) => {
        const pending = workerItemStatuses
          .filter(
            (s) =>
              s.workerId === w.id &&
              (s.status === 'not_started' || s.status === 'in_progress'),
          )
          .map((s) => {
            const item = items.find((i) => i.id === s.itemId);
            return { itemId: s.itemId, title: item?.title ?? '', status: s.status };
          });
        return {
          worker: {
            id: w.id,
            name: w.name,
            facility: w.facility ? { id: w.facility.id, name: w.facility.name } : null,
          },
          pending,
        };
      })
      .filter((wp) => wp.pending.length > 0);

    // Serialise data for the client component
    const workerDataForClient = workers.map((w) => ({
      id: w.id,
      name: w.name,
      facility: w.facility ? { id: w.facility.id, name: w.facility.name } : null,
    }));

    const itemDataForClient = items.map((i) => ({
      id: i.id,
      title: i.title,
    }));

    const ojtUserDataForClient = ojtUsersEnriched.map((u) => ({
      id: u.id,
      worker_id: u.worker_id,
      facility_id: u.facility_id,
      user_initial: u.user_initial,
      ojt_status: u.ojt_status,
      facilityName: u.facility?.name ?? null,
    }));

    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="ダッシュボード"
          subtitle={`${userName}（${ROLE_LABELS[role]}）`}
        />

        <div className="px-4 py-6 sm:px-6">
          <AdminDashboardContent
            userName={userName}
            role={role}
            workers={workerDataForClient}
            items={itemDataForClient}
            workerItemStatuses={workerItemStatuses}
            ojtUsers={ojtUserDataForClient}
            ojtCurrentSteps={ojtCurrentSteps}
            facilities={facilitiesList}
            workerFacilities={workerFacilitiesList}
            workersWithPending={workersWithPending}
            summaryStats={{
              totalWorkers: workers.length,
              trainingCompletionRate,
              completedCombinations,
              totalCombinations,
              ojtInProgress,
              ojtCompleted,
            }}
          />
        </div>
      </div>
    );
  }

  // ---------- trainer view ----------

  if (role === 'trainer') {
    // Workers this trainer has trained
    const trainerSessions = sessions.filter(
      (s) => s.trainer_id === user.id,
    );
    const trainedWorkerIds = [...new Set(trainerSessions.map((s) => s.worker_id))];
    const trainedWorkers = workers.filter((w) =>
      trainedWorkerIds.includes(w.id),
    );

    // Per-worker progress for trainer
    const trainerWorkerProgress = trainedWorkers.map((w) => {
      const itemStatuses = items.map((item) => {
        const found = workerItemStatuses.find(
          (s) => s.workerId === w.id && s.itemId === item.id,
        );
        return {
          item,
          status: found?.status ?? ('not_started' as TrainingStatus),
        };
      });
      const completed = itemStatuses.filter(
        (s) => s.status === 'completed',
      ).length;
      const pct =
        items.length > 0
          ? Math.round((completed / items.length) * 100)
          : 0;
      return { worker: w, itemStatuses, pct };
    });

    // Uncovered subtopics per trained worker
    const uncoveredByWorker = trainedWorkers.map((w) => {
      const wSessions = sessions.filter((s) => s.worker_id === w.id);
      const coveredSubtopicIds = new Set(
        wSessions.flatMap((s) => s.completed_subtopics),
      );
      const uncovered = items.flatMap((item) =>
        (item.subtopics ?? [])
          .filter((st) => !coveredSubtopicIds.has(st.id))
          .map((st) => ({
            itemTitle: item.title,
            itemNumber:
              ITEM_NUMBERS[items.indexOf(item)] ?? `${items.indexOf(item) + 1}`,
            subtopicTitle: st.title,
          })),
      );
      return { worker: w, uncovered };
    }).filter((u) => u.uncovered.length > 0);

    // OJT records where this user is the companion
    const companionOjtRecords = ojtRecords.filter(
      (r) => r.companion_id === user.id,
    );
    const companionOjtUserIds = [
      ...new Set(companionOjtRecords.map((r) => r.ojt_user_id)),
    ];
    const companionOjtUsers = ojtUsers.filter(
      (u) =>
        companionOjtUserIds.includes(u.id) && u.ojt_status !== 'completed',
    );

    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="ダッシュボード"
          subtitle={`${userName}（${ROLE_LABELS[role]}）`}
        />

        <div className="px-4 py-6 sm:px-6 space-y-8">
          {/* 担当外国人 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              担当外国人
            </h2>

            {trainedWorkers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-sm text-gray-500">
                  まだ研修を実施した外国人がいません
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trainerWorkerProgress.map(({ worker, itemStatuses, pct }) => (
                  <Link
                    key={worker.id}
                    href={`/training/${worker.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {worker.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {worker.facility?.name ?? '未所属'}
                        </p>
                      </div>
                      <span className="ml-2 text-sm font-bold text-gray-700">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar percentage={pct} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {itemStatuses.map((is, idx) => (
                        <div
                          key={is.item.id}
                          className="flex flex-col items-center gap-1"
                        >
                          <span className="text-[10px] text-gray-400">
                            {ITEM_NUMBERS[idx]}
                          </span>
                          {statusDot(is.status)}
                        </div>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 未指導の細目 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              未指導の細目
            </h2>

            {uncoveredByWorker.length === 0 ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm font-medium text-green-700">
                  全ての細目が指導済みです
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {uncoveredByWorker.map(({ worker, uncovered }) => (
                  <div
                    key={worker.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {worker.name}
                      </p>
                      <Link
                        href={`/training/${worker.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        研修詳細
                      </Link>
                    </div>
                    <div className="space-y-1.5">
                      {uncovered.map((u, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-gray-600"
                        >
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500">
                            {u.itemNumber}
                          </span>
                          <span className="truncate">{u.subtopicTitle}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 次回OJT予定 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              次回OJT予定
            </h2>

            {companionOjtUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-sm text-gray-500">
                  担当中のOJTはありません
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {companionOjtUsers.map((ojtUser) => {
                  const w = workers.find(
                    (w) => w.id === ojtUser.worker_id,
                  );
                  const currentStep = getCurrentOjtStep(
                    ojtRecords,
                    ojtUser.id,
                  );
                  return (
                    <Link
                      key={ojtUser.id}
                      href={`/ojt/${ojtUser.worker_id}`}
                      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {ojtUser.user_initial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {w?.name ?? '不明'}
                            </p>
                            <p className="text-xs text-gray-500">
                              利用者 {ojtUser.user_initial}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={ojtUser.ojt_status} />
                      </div>
                      <div className="mt-2 rounded bg-blue-50 p-2">
                        <p className="text-xs font-medium text-blue-800">
                          次のステップ
                        </p>
                        <p className="text-sm text-blue-900">
                          {currentStep.label}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ---------- executive view ----------

  if (role === 'executive') {
    const ojtTotal = ojtUsers.length;
    const ojtCompletionRate =
      ojtTotal > 0 ? Math.round((ojtCompleted / ojtTotal) * 100) : 0;

    // Fetch facilities for cross-facility breakdown
    const { data: facilitiesData } = await supabase.from('facilities').select('id, name, address, type').order('name');
    const facilities = facilitiesData ?? [];

    // Fetch worker_facilities junction for multi-facility support
    const { data: wfData } = await supabase.from('worker_facilities').select('worker_id, facility_id');
    const workerFacilitiesMap = new Map<string, Set<string>>();
    for (const wf of wfData ?? []) {
      if (!workerFacilitiesMap.has(wf.facility_id)) {
        workerFacilitiesMap.set(wf.facility_id, new Set());
      }
      workerFacilitiesMap.get(wf.facility_id)!.add(wf.worker_id);
    }

    // Per-facility stats (workers can appear in multiple facilities)
    const facilityStats = facilities.map((f) => {
      const fWorkerIds = workerFacilitiesMap.get(f.id) ?? new Set<string>();
      const fStatuses = workerItemStatuses.filter((s) => fWorkerIds.has(s.workerId));
      const fTotal = fStatuses.length;
      const fCompleted = fStatuses.filter((s) => s.status === 'completed').length;
      const fTrainingRate = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
      const fOjtUsers = ojtUsers.filter((u) => fWorkerIds.has(u.worker_id));
      const fOjtCompleted = fOjtUsers.filter((u) => u.ojt_status === 'completed').length;
      const fOjtTotal = fOjtUsers.length;
      const fOjtRate = fOjtTotal > 0 ? Math.round((fOjtCompleted / fOjtTotal) * 100) : 0;
      return {
        facility: f,
        workerCount: fWorkerIds.size,
        trainingRate: fTrainingRate,
        ojtRate: fOjtRate,
        ojtInProgress: fOjtUsers.filter((u) => u.ojt_status === 'in_progress').length,
        ojtCompleted: fOjtCompleted,
        ojtTotal: fOjtTotal,
      };
    });

    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="経営ダッシュボード"
          subtitle={`${userName}（${ROLE_LABELS[role]}）— 全事業所横断サマリー`}
        />

        <div className="px-4 py-6 sm:px-6 space-y-6">
          {/* Overall summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">外国人総数</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{workers.length}</p>
              <p className="mt-1 text-xs text-gray-400">名（{facilities.length}事業所）</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">研修完了率</p>
              <p className="mt-2 text-2xl font-bold text-green-600">{trainingCompletionRate}%</p>
              <p className="mt-1 text-xs text-gray-400">{completedCombinations}/{totalCombinations}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">OJT完了率</p>
              <p className="mt-2 text-2xl font-bold text-green-600">{ojtCompletionRate}%</p>
              <p className="mt-1 text-xs text-gray-400">{ojtCompleted}/{ojtTotal}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">OJT進行中</p>
              <p className="mt-2 text-2xl font-bold text-blue-600">{ojtInProgress}</p>
              <p className="mt-1 text-xs text-gray-400">件</p>
            </div>
          </div>

          {/* Overall progress bars */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">全体研修完了率</h3>
              <ProgressBar percentage={trainingCompletionRate} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">全体OJT完了率</h3>
              <ProgressBar percentage={ojtCompletionRate} />
            </div>
          </div>

          {/* Per-facility breakdown */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">事業所別進捗</h2>
            {facilityStats.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-sm text-gray-500">事業所が登録されていません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {facilityStats.map(({ facility, workerCount, trainingRate, ojtRate, ojtInProgress: fOjtIp, ojtCompleted: fOjtC, ojtTotal: fOjtT }) => (
                  <div key={facility.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{facility.name}</p>
                        <p className="text-xs text-gray-500">{facility.address ?? ''} / {facility.type ?? '種別未設定'}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{workerCount}名</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs text-gray-500">研修完了率</p>
                        <ProgressBar percentage={trainingRate} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-500">OJT完了率</p>
                        <ProgressBar percentage={ojtRate} />
                      </div>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      <span>OJT進行中: {fOjtIp}件</span>
                      <span>OJT完了: {fOjtC}/{fOjtT}件</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Per-worker quick list */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">外国人進捗一覧</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">氏名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">事業所</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">研修</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">OJT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {workers.map((w) => {
                      const wStatuses = workerItemStatuses.filter((s) => s.workerId === w.id);
                      const wCompleted = wStatuses.filter((s) => s.status === 'completed').length;
                      const wTotal = wStatuses.length;
                      const wRate = wTotal > 0 ? Math.round((wCompleted / wTotal) * 100) : 0;
                      const wOjt = ojtUsers.filter((u) => u.worker_id === w.id);
                      const wOjtDone = wOjt.filter((u) => u.ojt_status === 'completed').length;
                      return (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{w.name}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{w.facility?.name ?? '未所属'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-center">
                            <span className={`text-sm font-bold ${wRate >= 100 ? 'text-green-600' : wRate > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{wRate}%</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">{wOjtDone}/{wOjt.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- worker view ----------

  if (role === 'worker') {
    // Find which foreign_worker is linked to this profile
    const { data: linkedWorker } = await supabase
      .from('foreign_workers')
      .select('*, facility:facilities(id, name)')
      .eq('profile_id', user.id)
      .single();

    if (!linkedWorker) {
      return (
        <div className="min-h-screen bg-gray-50">
          <PageHeader title="マイページ" subtitle={`${userName}（特定技能外国人）`} />
          <div className="px-4 py-6 sm:px-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-sm font-medium text-amber-800">アカウントが特定技能外国人情報に紐づけられていません</p>
              <p className="mt-1 text-xs text-amber-600">管理者に連絡してアカウントを特定技能外国人情報にリンクしてもらってください。</p>
            </div>
          </div>
        </div>
      );
    }

    const workerId = linkedWorker.id;

    // Fetch training items and sessions
    const workerItems = items;
    const workerSessions = sessions.filter((s) => s.worker_id === workerId);
    const workerApprovals = (approvals ?? []).filter((a) => a.worker_id === workerId);

    // Compute training status per item
    const workerTrainingStatuses = workerItems.map((item) => {
      const itemSessions = workerSessions.filter((s) => s.item_id === item.id);
      const itemApproval = workerApprovals.find((a) => a.item_id === item.id);
      const st = computeItemStatus(itemSessions, item.subtopics ?? [], item.target_hours, itemApproval);
      return { item, status: st };
    });
    const trainingPct = workerItems.length > 0
      ? Math.round((workerTrainingStatuses.filter((s) => s.status === 'completed').length / workerItems.length) * 100)
      : 0;

    // Fetch OJT data
    const workerOjtUsers = ojtUsers.filter((u) => u.worker_id === workerId);
    const workerOjtRecords = ojtRecords.filter((r) => r.worker_id === workerId);

    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="マイページ" subtitle={`${userName}（特定技能外国人）`} />

        <div className="px-4 py-6 sm:px-6 space-y-6">
          {/* Progress overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs text-gray-400">研修進捗</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{trainingPct}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xs text-gray-400">OJT利用者数</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">{workerOjtUsers.length}</p>
            </div>
          </div>

          {/* Training status */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">研修進捗</h2>
            <div className="mb-2">
              <ProgressBar percentage={trainingPct} />
            </div>
            <div className="space-y-2">
              {workerTrainingStatuses.map(({ item, status }, idx) => (
                <Link
                  key={item.id}
                  href={`/training/${workerId}/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="text-sm text-gray-400">{ITEM_NUMBERS[idx]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                  </div>
                  {statusDot(status)}
                  <span className="text-xs text-gray-500">
                    {status === 'completed' ? '完了' : status === 'in_progress' ? '進行中' : '未着手'}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* OJT status */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">OJT進捗</h2>
            {workerOjtUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
                <p className="text-sm text-gray-500">OJT対象利用者はまだ登録されていません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workerOjtUsers.map((ojtUser) => {
                  const userRecords = workerOjtRecords.filter((r) => r.ojt_user_id === ojtUser.id);
                  const currentStep = getCurrentOjtStep(userRecords, ojtUser.id);
                  return (
                    <Link
                      key={ojtUser.id}
                      href={`/ojt/${workerId}/${ojtUser.id}`}
                      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {ojtUser.user_initial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">利用者 {ojtUser.user_initial}</p>
                            <p className="text-xs text-gray-500">{currentStep.label}</p>
                          </div>
                        </div>
                        <StatusBadge status={ojtUser.ojt_status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Links */}
          <section>
            <div className="flex flex-col gap-2">
              <Link
                href={`/evaluation/${workerId}`}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 transition-colors text-center"
              >
                最終到達目標評価を確認
              </Link>
              <Link
                href={`/export/${workerId}`}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors text-center"
              >
                PDF出力
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- fallback (unknown role) ----------

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="ダッシュボード"
        subtitle={`${userName}（${ROLE_LABELS[role] ?? role}）`}
      />

      <div className="px-4 py-6 sm:px-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            ダッシュボードの表示はお使いのアカウントには対応していません。
          </p>
          <p className="mt-1 text-xs text-gray-400">
            管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
