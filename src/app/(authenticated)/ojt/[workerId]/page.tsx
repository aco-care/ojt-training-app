import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, OjtUser, OjtRecord } from '@/lib/types';
import { OJT_STEPS } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import OjtUserForm from './ojt-user-form';

interface OjtOverviewPageProps {
  params: Promise<{ workerId: string }>;
}

export default async function OjtOverviewPage({ params }: OjtOverviewPageProps) {
  const { workerId } = await params;
  const supabase = await createClient();

  // Fetch worker, facilities, OJT users, and records in parallel
  const [
    { data: worker },
    { data: workerFacilitiesData },
    { data: ojtUsers },
    { data: ojtRecords },
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
      .from('ojt_users')
      .select('*, facility:facilities(id, name)')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ojt_records')
      .select('id, worker_id, ojt_user_id, step, result, date')
      .eq('worker_id', workerId)
      .order('date', { ascending: false }),
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

  const users = (ojtUsers ?? []) as (OjtUser & {
    facility: { id: string; name: string } | null;
  })[];

  const records = (ojtRecords ?? []) as OjtRecord[];

  // Determine current step for each user
  const getCurrentStep = (userId: string): { step: string; label: string } => {
    const userRecords = records.filter((r) => r.ojt_user_id === userId);
    if (userRecords.length === 0) {
      return { step: OJT_STEPS[0].step, label: `${OJT_STEPS[0].number} ${OJT_STEPS[0].label}` };
    }

    // Find the latest passed step
    const passedSteps = userRecords
      .filter((r) => r.result === 'pass')
      .map((r) => r.step);

    const stepOrder = OJT_STEPS.map((s) => s.step);
    let latestPassedIndex = -1;
    for (const passed of passedSteps) {
      const idx = stepOrder.indexOf(passed);
      if (idx > latestPassedIndex) {
        latestPassedIndex = idx;
      }
    }

    // Next step is the one after the latest passed
    const nextIndex = Math.min(latestPassedIndex + 1, OJT_STEPS.length - 1);
    const nextStep = OJT_STEPS[nextIndex];
    return { step: nextStep.step, label: `${nextStep.number} ${nextStep.label}` };
  };

  // Summary counts
  const totalUsers = users.length;
  const completedUsers = users.filter((u) => u.ojt_status === 'completed').length;
  const inProgressUsers = users.filter((u) => u.ojt_status === 'in_progress').length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未設定';
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="OJT管理"
        subtitle={`${typedWorker.name} - ${typedWorker.facility?.name ?? '未所属'}`}
      />

      <div className="px-4 py-6 sm:px-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
            <p className="mt-1 text-xs text-gray-500">対象利用者</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{inProgressUsers}</p>
            <p className="mt-1 text-xs text-gray-500">進行中</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{completedUsers}</p>
            <p className="mt-1 text-xs text-gray-500">完了</p>
          </div>
        </div>

        {/* User list header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">OJT対象利用者</h2>
          <OjtUserForm
            workerId={workerId}
            facilities={workerFacilities}
          />
        </div>

        {/* User cards */}
        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">OJT対象利用者が登録されていません</p>
            <p className="mt-1 text-xs text-gray-400">「利用者追加」ボタンから追加してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const currentStep = getCurrentStep(user.id);
              const userRecordCount = records.filter(
                (r) => r.ojt_user_id === user.id
              ).length;

              return (
                <Link
                  key={user.id}
                  href={`/ojt/${workerId}/${user.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {user.user_initial}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            利用者 {user.user_initial}
                          </p>
                          <p className="text-xs text-gray-500">
                            週{user.visit_frequency}回
                            {user.facility && ` / ${user.facility.name}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-3 flex flex-col items-end gap-1">
                      <StatusBadge status={user.ojt_status} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">
                        現在のステップ
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">
                        {user.ojt_status === 'completed'
                          ? '全ステップ完了'
                          : currentStep.label}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500">記録数</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">
                        {userRecordCount}件
                      </p>
                    </div>
                    <svg
                      className="ml-3 h-5 w-5 flex-shrink-0 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>

                  <div className="mt-2 text-xs text-gray-400">
                    開始日: {formatDate(user.ojt_start_date)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
