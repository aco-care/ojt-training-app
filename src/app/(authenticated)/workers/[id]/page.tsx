import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, TrainingItem, TrainingApproval, OjtUser, TrainingSession, Qualification } from '@/lib/types';
import { OJT_STATUS_LABELS, STATUS_LABELS, OJT_STEPS, QUALIFICATION_LABELS } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';
import { FacilityBadges } from '@/components/facility-badges';
import EditWorkerFacilities from './edit-worker-facilities';
import EditQualification from './edit-qualification';
import LinkProfile from './link-profile';

interface WorkerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkerDetailPage({ params }: WorkerDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { data: worker },
    { data: allFacilitiesData },
    { data: workerProfilesData },
    { data: trainingItems },
    { data: trainingSessions },
    { data: trainingApprovals },
    { data: ojtUsers },
  ] = await Promise.all([
    supabase
      .from('foreign_workers')
      .select('*, facility:facilities(id, name, address, type), worker_facilities(id, facility_id, is_primary, facility:facilities(id, name))')
      .eq('id', id)
      .single(),
    supabase
      .from('facilities')
      .select('id, name')
      .order('name'),
    supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'worker')
      .eq('is_archived', false)
      .order('name'),
    supabase
      .from('training_items')
      .select('id, item_number, title, target_hours, target_sessions, sort_order')
      .order('sort_order'),
    supabase
      .from('training_sessions')
      .select('id, worker_id, item_id, date, start_time, end_time')
      .eq('worker_id', id),
    supabase
      .from('training_approvals')
      .select('id, worker_id, item_id, status, approved_by, approved_at')
      .eq('worker_id', id),
    supabase
      .from('ojt_users')
      .select('id, worker_id, user_initial, visit_frequency, ojt_start_date, ojt_status, created_at')
      .eq('worker_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!worker) {
    notFound();
  }

  const typedWorker = worker as ForeignWorker & {
    facility: { id: string; name: string; address: string | null; type: string | null } | null;
    worker_facilities: { id: string; facility_id: string; is_primary: boolean; facility: { id: string; name: string } }[];
  };

  const allFacilities = (allFacilitiesData ?? []) as { id: string; name: string }[];

  const currentWorkerFacilities = (typedWorker.worker_facilities ?? [])
    .filter((wf) => wf.facility)
    .map((wf) => ({ id: wf.facility!.id, name: wf.facility!.name, is_primary: wf.is_primary }));

  const workerProfiles = (workerProfilesData ?? []) as { id: string; name: string; email: string }[];
  const linkedProfile = workerProfiles.find((p) => p.id === typedWorker.profile_id);

  const items = (trainingItems ?? []) as TrainingItem[];
  const sessions = (trainingSessions ?? []) as TrainingSession[];
  const approvals = (trainingApprovals ?? []) as TrainingApproval[];
  const ojtList = (ojtUsers ?? []) as OjtUser[];

  // Build training progress data
  const trainingProgress = items.map((item) => {
    const itemSessions = sessions.filter((s) => s.item_id === item.id);
    const totalHours = itemSessions.reduce((acc, s) => {
      const start = new Date(`2000-01-01T${s.start_time}`);
      const end = new Date(`2000-01-01T${s.end_time}`);
      return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    const approval = approvals.find((a) => a.item_id === item.id);
    const percentage = item.target_hours > 0 ? Math.min(100, (totalHours / item.target_hours) * 100) : 0;

    return {
      item,
      sessionCount: itemSessions.length,
      totalHours,
      approval,
      percentage,
    };
  });

  // Get current OJT step label
  const getOjtStepLabel = (status: string): string => {
    const step = OJT_STEPS.find((s) => s.step === status);
    return step ? `${step.number} ${step.label}` : status;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未設定';
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={typedWorker.name}
        subtitle="特定技能外国人詳細"
      />

      <div className="px-4 py-6 sm:px-6">
        {/* Profile Card */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">プロフィール</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">氏名</dt>
              <dd className="mt-1 text-sm text-gray-900">{typedWorker.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">国籍</dt>
              <dd className="mt-1 text-sm text-gray-900">{typedWorker.nationality ?? '未設定'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">生年月日</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(typedWorker.birth_date)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-gray-500">所属施設</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <FacilityBadges facilities={currentWorkerFacilities} />
                <EditWorkerFacilities
                  workerId={id}
                  allFacilities={allFacilities}
                  currentFacilities={currentWorkerFacilities}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">経験年数</dt>
              <dd className="mt-1 text-sm text-gray-900">{typedWorker.experience_years}年</dd>
            </div>
            <EditQualification
              workerId={id}
              currentQualification={typedWorker.qualification ?? 'none'}
            />
            <div>
              <dt className="text-xs font-medium text-gray-500">備考</dt>
              <dd className="mt-1 text-sm text-gray-900">{typedWorker.notes ?? 'なし'}</dd>
            </div>
            <LinkProfile
              workerId={id}
              currentProfileId={typedWorker.profile_id}
              currentProfileName={linkedProfile?.name ?? null}
              workerProfiles={workerProfiles}
            />
          </dl>
        </div>

        {/* Training Progress */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">研修進捗</h2>
            <Link
              href={`/training/${id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              研修詳細へ
            </Link>
          </div>

          {trainingProgress.length === 0 ? (
            <p className="text-sm text-gray-500">研修項目が設定されていません</p>
          ) : (
            <div className="space-y-4">
              {trainingProgress.map(({ item, sessionCount, totalHours, approval, percentage }) => (
                <div key={item.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.item_number}. {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {sessionCount}回実施 / {totalHours.toFixed(1)}h（目標 {item.target_hours}h）
                      </p>
                    </div>
                    <StatusBadge status={approval?.status ?? 'not_started'} />
                  </div>
                  <ProgressBar
                    percentage={percentage}
                    label={`${totalHours.toFixed(1)}h / ${item.target_hours}h`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href={`/evaluation/${id}`}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="text-xs font-medium text-gray-700">最終評価</span>
          </Link>
          <Link
            href={`/export/${id}`}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="12" y2="18" /><line x1="15" y1="15" x2="12" y2="18" />
            </svg>
            <span className="text-xs font-medium text-gray-700">PDF出力</span>
          </Link>
          <Link
            href={`/training/${id}`}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <svg className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="text-xs font-medium text-gray-700">研修記録</span>
          </Link>
          <Link
            href={`/ojt/${id}`}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <svg className="h-6 w-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <span className="text-xs font-medium text-gray-700">OJT記録</span>
          </Link>
        </div>

        {/* OJT Progress */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">OJT進捗</h2>
            <Link
              href={`/ojt/${id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              OJT詳細へ
            </Link>
          </div>

          {ojtList.length === 0 ? (
            <p className="text-sm text-gray-500">OJT利用者が登録されていません</p>
          ) : (
            <div className="space-y-3">
              {ojtList.map((ojt) => (
                <div
                  key={ojt.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      利用者: {ojt.user_initial}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      訪問頻度: {ojt.visit_frequency}回/月 / 開始日: {formatDate(ojt.ojt_start_date)}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <StatusBadge status={ojt.ojt_status} />
                    <span className="text-xs text-gray-500">
                      {OJT_STATUS_LABELS[ojt.ojt_status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
