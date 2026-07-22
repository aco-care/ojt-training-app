import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ForeignWorker,
  TrainingItem,
  TrainingSession,
  TrainingApproval,
  TrainingStatus,
  OjtUser,
  OjtRecord,
} from '@/lib/types';
import PageHeader from '@/components/page-header';
import WorkerForm from './worker-form';
import WorkerList from './worker-list';

export const revalidate = 60;

function computeItemStatus(
  sessions: TrainingSession[],
  targetHours: number,
  approval: TrainingApproval | undefined,
): TrainingStatus {
  if (approval?.status === 'completed') return 'completed';
  if (!sessions || sessions.length === 0) return 'not_started';
  const totalHours = sessions.reduce((acc, s) => {
    try {
      const start = new Date(`2000-01-01T${s.start_time}`);
      const end = new Date(`2000-01-01T${s.end_time}`);
      const breakH = (s.break_minutes || 0) / 60;
      const diff = (end.getTime() - start.getTime()) / 3_600_000 - breakH;
      return acc + (diff > 0 ? diff : 0);
    } catch {
      return acc;
    }
  }, 0);
  if (totalHours >= targetHours) return 'completed';
  return 'in_progress';
}

export default async function WorkersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: workers },
    { data: facilities },
    { data: profile },
    { data: itemsData },
    { data: sessionsData },
    { data: approvalsData },
    { data: ojtUsersData },
    { data: ojtRecordsData },
  ] = await Promise.all([
    supabase
      .from('foreign_workers')
      .select('*, facility:facilities(id, name), worker_facilities(id, facility_id, is_primary, facility:facilities(id, name))')
      .order('name'),
    supabase
      .from('facilities')
      .select('id, name')
      .order('name'),
    supabase
      .from('profiles')
      .select('id, name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('training_items')
      .select('id, item_number, title, target_hours, target_sessions, sort_order')
      .order('sort_order'),
    supabase
      .from('training_sessions')
      .select('id, worker_id, item_id, start_time, end_time, completed_subtopics, break_minutes')
      .limit(5000),
    supabase
      .from('training_approvals')
      .select('id, worker_id, item_id, status'),
    supabase
      .from('ojt_users')
      .select('id, worker_id, ojt_status'),
    supabase
      .from('ojt_records')
      .select('id, ojt_user_id, step')
      .limit(2000),
  ]);

  const workerList = (workers ?? []) as (ForeignWorker & {
    facility: { id: string; name: string } | null;
    worker_facilities: { id: string; facility_id: string; is_primary: boolean; facility: { id: string; name: string } }[];
  })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];

  const items = (itemsData ?? []) as TrainingItem[];
  const sessions = (sessionsData ?? []) as unknown as TrainingSession[];
  const approvals = (approvalsData ?? []) as TrainingApproval[];
  const ojtUsers = (ojtUsersData ?? []) as OjtUser[];
  const ojtRecords = (ojtRecordsData ?? []) as OjtRecord[];

  // Compute overall status (training + OJT combined) per worker
  const workerStatuses = new Map<string, TrainingStatus>();
  for (const w of workerList) {
    const itemStatuses = items.map((item) => {
      const wSessions = sessions.filter((s) => s.worker_id === w.id && s.item_id === item.id);
      const approval = approvals.find((a) => a.worker_id === w.id && a.item_id === item.id);
      return computeItemStatus(wSessions, item.target_hours, approval);
    });
    const trainingCompleted = itemStatuses.length > 0 && itemStatuses.every((s) => s === 'completed');
    const trainingStarted = itemStatuses.some((s) => s !== 'not_started');

    const wOjtUsers = ojtUsers.filter((u) => u.worker_id === w.id);
    const ojtCompleted = wOjtUsers.every((u) => {
      const hasIndependent = ojtRecords.some((r) => r.ojt_user_id === u.id && r.step === 'independent');
      return u.ojt_status === 'completed' || hasIndependent;
    });
    const ojtStarted = wOjtUsers.some((u) => u.ojt_status !== 'not_started' || ojtRecords.some((r) => r.ojt_user_id === u.id));

    let status: TrainingStatus = 'not_started';
    if (trainingCompleted && (wOjtUsers.length === 0 || ojtCompleted)) {
      status = 'completed';
    } else if (trainingStarted || ojtStarted) {
      status = 'in_progress';
    }
    workerStatuses.set(w.id, status);
  }

  const workerListWithStatus = workerList.map((w) => ({
    ...w,
    status: workerStatuses.get(w.id) ?? ('not_started' as TrainingStatus),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="特定技能外国人一覧" subtitle={`${workerList.length}名の特定技能外国人が登録されています`} />

      <div className="px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">特定技能外国人リスト</h2>
          <WorkerForm facilities={facilityList} currentUserId={user.id} currentUserName={profile?.name ?? ''} />
        </div>

        <WorkerList workers={workerListWithStatus} facilities={facilityList} />
      </div>
    </div>
  );
}
