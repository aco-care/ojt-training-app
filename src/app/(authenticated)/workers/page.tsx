import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker } from '@/lib/types';
import PageHeader from '@/components/page-header';
import WorkerForm from './worker-form';
import WorkerList from './worker-list';

export const revalidate = 60;

export default async function WorkersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: workers },
    { data: facilities },
    { data: profile },
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
  ]);

  const workerList = (workers ?? []) as (ForeignWorker & {
    facility: { id: string; name: string } | null;
    worker_facilities: { id: string; facility_id: string; is_primary: boolean; facility: { id: string; name: string } }[];
  })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="特定技能外国人一覧" subtitle={`${workerList.length}名の特定技能外国人が登録されています`} />

      <div className="px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">特定技能外国人リスト</h2>
          <WorkerForm facilities={facilityList} currentUserId={user.id} currentUserName={profile?.name ?? ''} />
        </div>

        <WorkerList workers={workerList} facilities={facilityList} />
      </div>
    </div>
  );
}
