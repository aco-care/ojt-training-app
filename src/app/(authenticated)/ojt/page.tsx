import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, OjtUser } from '@/lib/types';
import { OJT_STATUS_LABELS } from '@/lib/types';
import PageHeader from '@/components/page-header';

export default async function OjtListPage() {
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');

  const { data: ojtUsers } = await supabase
    .from('ojt_users')
    .select('id, worker_id, ojt_status');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const ojtUserList = (ojtUsers ?? []) as Pick<OjtUser, 'id' | 'worker_id' | 'ojt_status'>[];

  // Build maps per worker
  const userCountMap = new Map<string, number>();
  const completedCountMap = new Map<string, number>();
  for (const u of ojtUserList) {
    userCountMap.set(u.worker_id, (userCountMap.get(u.worker_id) ?? 0) + 1);
    if (u.ojt_status === 'completed') {
      completedCountMap.set(u.worker_id, (completedCountMap.get(u.worker_id) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="OJT記録一覧" subtitle={`${workerList.length}名の実習生`} />

      <div className="px-4 py-6 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">実習生ごとのOJT進捗</h2>

        {workerList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">実習生が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workerList.map((worker) => {
              const totalUsers = userCountMap.get(worker.id) ?? 0;
              const completedUsers = completedCountMap.get(worker.id) ?? 0;

              return (
                <Link
                  key={worker.id}
                  href={`/ojt/${worker.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{worker.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{worker.facility?.name ?? '未所属'}</p>
                    </div>
                    <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>利用者数: {totalUsers}名</span>
                    {totalUsers > 0 && (
                      <span>完了: {completedUsers} / {totalUsers}</span>
                    )}
                    {totalUsers === 0 && (
                      <span className="text-gray-400">利用者未登録</span>
                    )}
                  </div>

                  {totalUsers > 0 && (
                    <div className="mt-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${Math.round((completedUsers / totalUsers) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
