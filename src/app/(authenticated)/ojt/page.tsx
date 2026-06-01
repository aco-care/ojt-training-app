import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker, OjtUser } from '@/lib/types';
import PageHeader from '@/components/page-header';
import OjtList from './ojt-list';

export default async function OjtListPage() {
  const supabase = await createClient();

  const [{ data: workers }, { data: facilities }, { data: ojtUsers }, { data: ojtRecords }] = await Promise.all([
    supabase
      .from('foreign_workers')
      .select('*, facility:facilities(id, name)')
      .order('name'),
    supabase
      .from('facilities')
      .select('id, name')
      .order('name'),
    supabase
      .from('ojt_users')
      .select('id, worker_id, ojt_status'),
    supabase
      .from('ojt_records')
      .select('ojt_user_id, step'),
  ]);

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];
  const ojtUserList = (ojtUsers ?? []) as Pick<OjtUser, 'id' | 'worker_id' | 'ojt_status'>[];
  const recordList = (ojtRecords ?? []) as { ojt_user_id: string; step: string }[];

  // Build maps per worker — use ojt_status OR check if independent step exists
  const userCountMap: Record<string, number> = {};
  const completedCountMap: Record<string, number> = {};
  for (const u of ojtUserList) {
    userCountMap[u.worker_id] = (userCountMap[u.worker_id] ?? 0) + 1;
    const userRecords = recordList.filter((r) => r.ojt_user_id === u.id);
    const hasIndependent = userRecords.some((r) => r.step === 'independent');
    if (u.ojt_status === 'completed' || hasIndependent) {
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
