import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, TrainingItem, TrainingApproval } from '@/lib/types';
import PageHeader from '@/components/page-header';

export default async function TrainingListPage() {
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');

  const { data: items } = await supabase
    .from('training_items')
    .select('id')
    .order('sort_order');

  const { data: approvals } = await supabase
    .from('training_approvals')
    .select('worker_id, item_id, status');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const totalItems = (items ?? []).length || 5;
  const approvalList = (approvals ?? []) as { worker_id: string; item_id: string; status: string }[];

  // Build a map: workerId -> number of completed items
  const completedMap = new Map<string, number>();
  for (const a of approvalList) {
    if (a.status === 'completed') {
      completedMap.set(a.worker_id, (completedMap.get(a.worker_id) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="研修記録一覧" subtitle={`${workerList.length}名の実習生`} />

      <div className="px-4 py-6 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">実習生ごとの研修進捗</h2>

        {workerList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">実習生が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workerList.map((worker) => {
              const completed = completedMap.get(worker.id) ?? 0;
              const pct = Math.round((completed / totalItems) * 100);

              return (
                <Link
                  key={worker.id}
                  href={`/training/${worker.id}`}
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

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>研修進捗</span>
                      <span>{completed} / {totalItems} 科目完了</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
