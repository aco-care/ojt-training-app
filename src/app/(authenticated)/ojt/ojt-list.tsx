'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';

type Worker = {
  id: string;
  name: string;
  nationality: string | null;
  facility: { id: string; name: string } | null;
};

type Facility = { id: string; name: string };

interface OjtListProps {
  workers: Worker[];
  facilities: Facility[];
  userCountMap: Record<string, number>;
  completedCountMap: Record<string, number>;
}

const PAGE_SIZE = 20;

export default function OjtList({ workers, facilities, userCountMap, completedCountMap }: OjtListProps) {
  const [search, setSearch] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setDisplayCount(PAGE_SIZE);
  }, []);

  const handleFacilityChange = useCallback((facilityId: string | null) => {
    setSelectedFacilityId(facilityId);
    setDisplayCount(PAGE_SIZE);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((w) => {
      if (selectedFacilityId) {
        if (w.facility?.id !== selectedFacilityId) return false;
      }
      if (q) {
        const name = (w.name ?? '').toLowerCase();
        const nationality = (w.nationality ?? '').toLowerCase();
        const facilityName = (w.facility?.name ?? '').toLowerCase();
        if (!name.includes(q) && !nationality.includes(q) && !facilityName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [workers, search, selectedFacilityId]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

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
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="氏名・国籍・施設名で検索..."
          className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Facility filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleFacilityChange(null)}
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
            onClick={() => handleFacilityChange(f.id)}
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
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayed.map((worker) => {
              const totalUsers = userCountMap[worker.id] ?? 0;
              const completedUsers = completedCountMap[worker.id] ?? 0;

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
