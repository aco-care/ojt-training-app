'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { FacilityBadges } from '@/components/facility-badges';

type WorkerFacility = {
  id: string;
  facility_id: string;
  is_primary: boolean;
  facility: { id: string; name: string };
};

type Worker = {
  id: string;
  name: string;
  nationality: string | null;
  experience_years: number;
  facility: { id: string; name: string } | null;
  worker_facilities: WorkerFacility[];
};

type Facility = { id: string; name: string };

interface WorkerListProps {
  workers: Worker[];
  facilities: Facility[];
}

const PAGE_SIZE = 20;

export default function WorkerList({ workers, facilities }: WorkerListProps) {
  const [search, setSearch] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filter workers by search + facility
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((w) => {
      // Facility filter
      if (selectedFacilityId) {
        const belongsToFacility = (w.worker_facilities ?? []).some(
          (wf) => wf.facility_id === selectedFacilityId
        );
        if (!belongsToFacility) return false;
      }
      // Search filter
      if (q) {
        const name = (w.name ?? '').toLowerCase();
        const nationality = (w.nationality ?? '').toLowerCase();
        const facilityNames = (w.worker_facilities ?? [])
          .map((wf) => wf.facility?.name ?? '')
          .join(' ')
          .toLowerCase();
        if (!name.includes(q) && !nationality.includes(q) && !facilityNames.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [workers, search, selectedFacilityId]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [search, selectedFacilityId]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  // Intersection observer for auto-load
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const facilityBadges = (wf: WorkerFacility[]) =>
    (wf ?? [])
      .filter((f) => f.facility)
      .map((f) => ({ id: f.facility.id, name: f.facility.name, is_primary: f.is_primary }));

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="氏名・国籍・施設名で検索..."
          className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Facility filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFacilityId(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selectedFacilityId === null
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        {facilities.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFacilityId(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedFacilityId === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="mb-3 text-sm text-gray-500">
        {filtered.length}名の特定技能外国人
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {workers.length === 0
              ? '実習生が登録されていません'
              : '条件に一致する実習生が見つかりません'}
          </p>
          {workers.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">検索条件やフィルターを変更してください</p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {displayed.map((worker) => (
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
                    <FacilityBadges facilities={facilityBadges(worker.worker_facilities)} />
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
                {displayed.map((worker) => (
                  <tr key={worker.id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{worker.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{worker.nationality ?? '未設定'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <FacilityBadges facilities={facilityBadges(worker.worker_facilities)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{worker.experience_years}年</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <Link href={`/workers/${worker.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more / sentinel */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                もっと見る ({filtered.length - displayCount}名)
              </button>
              <div ref={sentinelRef} className="h-1" />
            </div>
          )}
          {!hasMore && filtered.length > PAGE_SIZE && (
            <p className="mt-4 text-center text-xs text-gray-400">
              すべて表示しました
            </p>
          )}
        </>
      )}
    </div>
  );
}
