import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, OjtUser } from '@/lib/types';
import PageHeader from '@/components/page-header';
import OjtList from './ojt-list';

export default async function OjtListPage() {
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name');

  const { data: ojtUsers } = await supabase
    .from('ojt_users')
    .select('id, worker_id, ojt_status');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];
  const ojtUserList = (ojtUsers ?? []) as Pick<OjtUser, 'id' | 'worker_id' | 'ojt_status'>[];

  // Build maps per worker
  const userCountMap: Record<string, number> = {};
  const completedCountMap: Record<string, number> = {};
  for (const u of ojtUserList) {
    userCountMap[u.worker_id] = (userCountMap[u.worker_id] ?? 0) + 1;
    if (u.ojt_status === 'completed') {
      completedCountMap[u.worker_id] = (completedCountMap[u.worker_id] ?? 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="OJT記録一覧" subtitle={`${workerList.length}名の特定技能外国人`} />

      <div className="px-4 py-6 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">特定技能外国人ごとのOJT進捗</h2>

        <OjtList
          workers={workerList}
          facilities={facilityList}
          userCountMap={userCountMap}
          completedCountMap={completedCountMap}
        />
      </div>
    </div>
  );
}
