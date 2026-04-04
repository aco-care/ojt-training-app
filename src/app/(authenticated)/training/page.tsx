import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker } from '@/lib/types';
import PageHeader from '@/components/page-header';
import TrainingList from './training-list';

export default async function TrainingListPage() {
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name');

  const { data: items } = await supabase
    .from('training_items')
    .select('id')
    .order('sort_order');

  const { data: approvals } = await supabase
    .from('training_approvals')
    .select('worker_id, item_id, status');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];
  const totalItems = (items ?? []).length || 5;
  const approvalList = (approvals ?? []) as { worker_id: string; item_id: string; status: string }[];

  // Build a map: workerId -> number of completed items
  const completedMap: Record<string, number> = {};
  for (const a of approvalList) {
    if (a.status === 'completed') {
      completedMap[a.worker_id] = (completedMap[a.worker_id] ?? 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="研修記録一覧" subtitle={`${workerList.length}名の特定技能外国人`} />

      <div className="px-4 py-6 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">特定技能外国人ごとの研修進捗</h2>

        <TrainingList
          workers={workerList}
          facilities={facilityList}
          totalItems={totalItems}
          completedMap={completedMap}
        />
      </div>
    </div>
  );
}
