import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker } from '@/lib/types';
import { resolveTrainingItemsForFacility } from '@/lib/training-items';
import PageHeader from '@/components/page-header';
import TrainingList from './training-list';

export const revalidate = 60;

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
    .select('id, item_number, target_hours, facility_id')
    .order('sort_order');

  const { data: approvals } = await supabase
    .from('training_approvals')
    .select('worker_id, item_id, status');

  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('worker_id, item_id, start_time, end_time, break_minutes');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];
  const itemList = (items ?? []) as { id: string; item_number: number; target_hours: number; facility_id: string | null }[];
  const totalItems = new Set(itemList.map((i) => i.item_number)).size || 5;
  const approvalList = (approvals ?? []) as { worker_id: string; item_id: string; status: string }[];
  const sessionList = (sessions ?? []) as { worker_id: string; item_id: string; start_time: string; end_time: string; break_minutes: number }[];

  // Build a map: workerId -> number of completed items (based on hours OR approval)
  const completedMap: Record<string, number> = {};
  for (const w of workerList) {
    let completed = 0;
    const workerItems = resolveTrainingItemsForFacility(itemList, w.facility_id);
    for (const item of workerItems) {
      const approval = approvalList.find((a) => a.worker_id === w.id && a.item_id === item.id);
      if (approval?.status === 'completed') { completed++; continue; }
      const itemSessions = sessionList.filter((s) => s.worker_id === w.id && s.item_id === item.id);
      if (itemSessions.length === 0) continue;
      const totalHours = itemSessions.reduce((acc, s) => {
        try {
          const start = new Date(`2000-01-01T${s.start_time}`);
          const end = new Date(`2000-01-01T${s.end_time}`);
          const breakH = (s.break_minutes || 0) / 60;
          const diff = (end.getTime() - start.getTime()) / 3_600_000 - breakH;
          return acc + (diff > 0 ? diff : 0);
        } catch { return acc; }
      }, 0);
      if (totalHours >= item.target_hours) completed++;
    }
    if (completed > 0) completedMap[w.id] = completed;
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
