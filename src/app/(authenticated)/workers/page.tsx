import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ForeignWorker } from '@/lib/types';
import PageHeader from '@/components/page-header';
import WorkerForm from './worker-form';

export default async function WorkersPage() {
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from('foreign_workers')
    .select('*, facility:facilities(id, name)')
    .order('name');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name');

  const workerList = (workers ?? []) as (ForeignWorker & { facility: { id: string; name: string } | null })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="外国人技能実習生一覧" subtitle={`${workerList.length}名の実習生が登録されています`} />

      <div className="px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">実習生リスト</h2>
          <WorkerForm facilities={facilityList} />
        </div>

        {workerList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">実習生が登録されていません</p>
            <p className="mt-1 text-xs text-gray-400">「新規登録」ボタンから追加してください</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {workerList.map((worker) => (
                <Link
                  key={worker.id}
                  href={`/workers/${worker.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{worker.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{worker.nationality ?? '未設定'}</p>
                    </div>
                    <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                      </svg>
                      {worker.facility?.name ?? '未所属'}
                    </span>
                    <span>経験 {worker.experience_years}年</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">氏名</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">国籍</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">所属施設</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">経験年数</th>
                    <th scope="col" className="relative px-4 py-3"><span className="sr-only">詳細</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workerList.map((worker) => (
                    <tr key={worker.id} className="transition-colors hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{worker.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{worker.nationality ?? '未設定'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{worker.facility?.name ?? '未所属'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{worker.experience_years}年</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <Link
                          href={`/workers/${worker.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
