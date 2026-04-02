'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrainingStatus, OjtStatus } from '@/lib/types';
import { ROLE_LABELS, OJT_STEPS } from '@/lib/types';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';
import DashboardFilter from './dashboard-filter';

// ---------- shared types for serialised data from server ----------

export type WorkerData = {
  id: string;
  name: string;
  facility: { id: string; name: string } | null;
};

export type ItemData = {
  id: string;
  title: string;
};

export type WorkerItemStatusData = {
  workerId: string;
  itemId: string;
  status: TrainingStatus;
};

export type OjtUserData = {
  id: string;
  worker_id: string;
  facility_id: string;
  user_initial: string;
  ojt_status: OjtStatus;
  facilityName: string | null;
};

export type OjtCurrentStep = {
  ojtUserId: string;
  step: string;
  label: string;
};

export type WorkerFacilityMapping = {
  worker_id: string;
  facility_id: string;
};

export type PendingItem = {
  itemId: string;
  title: string;
  status: TrainingStatus;
};

export type WorkerWithPending = {
  worker: WorkerData;
  pending: PendingItem[];
};

export interface AdminDashboardProps {
  userName: string;
  role: 'admin' | 'supervisor';
  workers: WorkerData[];
  items: ItemData[];
  workerItemStatuses: WorkerItemStatusData[];
  ojtUsers: OjtUserData[];
  ojtCurrentSteps: OjtCurrentStep[];
  facilities: { id: string; name: string }[];
  workerFacilities: WorkerFacilityMapping[];
  workersWithPending: WorkerWithPending[];
  summaryStats: {
    totalWorkers: number;
    trainingCompletionRate: number;
    completedCombinations: number;
    totalCombinations: number;
    ojtInProgress: number;
    ojtCompleted: number;
  };
}

// ---------- helpers ----------

const ITEM_NUMBERS = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];

function statusDot(status: TrainingStatus) {
  const colors: Record<TrainingStatus, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    not_started: 'bg-gray-300',
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`}
      title={
        status === 'completed'
          ? '\u5b8c\u4e86'
          : status === 'in_progress'
            ? '\u9032\u884c\u4e2d'
            : '\u672a\u7740\u624b'
      }
    />
  );
}

// ---------- component ----------

export default function AdminDashboardContent({
  userName,
  role,
  workers,
  items,
  workerItemStatuses,
  ojtUsers,
  ojtCurrentSteps,
  facilities,
  workerFacilities,
  workersWithPending,
  summaryStats,
}: AdminDashboardProps) {
  const [showCompletedTraining, setShowCompletedTraining] = useState(false);
  const [showCompletedOjt, setShowCompletedOjt] = useState(false);

  // Build a set for quick lookup: facilityId -> Set of workerIds
  const facilityWorkerMap = new Map<string, Set<string>>();
  for (const wf of workerFacilities) {
    if (!facilityWorkerMap.has(wf.facility_id)) {
      facilityWorkerMap.set(wf.facility_id, new Set());
    }
    facilityWorkerMap.get(wf.facility_id)!.add(wf.worker_id);
  }

  function filterWorkers(
    list: WorkerData[],
    selectedFacilityId: string | null,
  ): WorkerData[] {
    if (!selectedFacilityId) return list;
    const workerIds = facilityWorkerMap.get(selectedFacilityId);
    if (!workerIds) return [];
    return list.filter((w) => workerIds.has(w.id));
  }

  function filterOjtUsers(
    list: OjtUserData[],
    selectedFacilityId: string | null,
  ): OjtUserData[] {
    if (!selectedFacilityId) return list;
    return list.filter((u) => u.facility_id === selectedFacilityId);
  }

  function filterWorkersWithPending(
    list: WorkerWithPending[],
    selectedFacilityId: string | null,
  ): WorkerWithPending[] {
    if (!selectedFacilityId) return list;
    const workerIds = facilityWorkerMap.get(selectedFacilityId);
    if (!workerIds) return [];
    return list.filter((wp) => workerIds.has(wp.worker.id));
  }

  function getWorkerStatuses(workerId: string) {
    return items.map((item) => {
      const found = workerItemStatuses.find(
        (s) => s.workerId === workerId && s.itemId === item.id,
      );
      return found?.status ?? ('not_started' as TrainingStatus);
    });
  }

  function getWorkerPct(workerId: string) {
    const statuses = getWorkerStatuses(workerId);
    const completed = statuses.filter((s) => s === 'completed').length;
    return items.length > 0
      ? Math.round((completed / items.length) * 100)
      : 0;
  }

  function isWorkerAllTrainingCompleted(workerId: string) {
    const statuses = getWorkerStatuses(workerId);
    return statuses.every((s) => s === 'completed');
  }

  // Split OJT users into active and completed
  const activeOjtUsers = ojtUsers.filter((u) => u.ojt_status !== 'completed');
  const completedOjtUsers = ojtUsers.filter(
    (u) => u.ojt_status === 'completed',
  );

  return (
    <DashboardFilter facilities={facilities}>
      {(selectedFacilityId) => {
        const filteredWorkers = filterWorkers(workers, selectedFacilityId);
        const filteredActiveOjt = filterOjtUsers(
          activeOjtUsers,
          selectedFacilityId,
        );
        const filteredCompletedOjt = filterOjtUsers(
          completedOjtUsers,
          selectedFacilityId,
        );
        const filteredPending = filterWorkersWithPending(
          workersWithPending,
          selectedFacilityId,
        );

        // Split workers into active (has incomplete training) and all-completed
        const activeWorkers = filteredWorkers.filter(
          (w) => !isWorkerAllTrainingCompleted(w.id),
        );
        const completedWorkers = filteredWorkers.filter((w) =>
          isWorkerAllTrainingCompleted(w.id),
        );

        return (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  外国人総数
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {selectedFacilityId
                    ? filteredWorkers.length
                    : summaryStats.totalWorkers}
                </p>
                <p className="mt-1 text-xs text-gray-400">名</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  研修完了率
                </p>
                <p className="mt-2 text-2xl font-bold text-green-600">
                  {selectedFacilityId
                    ? (() => {
                        const fStatuses = workerItemStatuses.filter((s) =>
                          filteredWorkers.some((w) => w.id === s.workerId),
                        );
                        const fTotal = fStatuses.length;
                        const fCompleted = fStatuses.filter(
                          (s) => s.status === 'completed',
                        ).length;
                        return fTotal > 0
                          ? Math.round((fCompleted / fTotal) * 100)
                          : 0;
                      })()
                    : summaryStats.trainingCompletionRate}
                  %
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {selectedFacilityId
                    ? (() => {
                        const fStatuses = workerItemStatuses.filter((s) =>
                          filteredWorkers.some((w) => w.id === s.workerId),
                        );
                        const fCompleted = fStatuses.filter(
                          (s) => s.status === 'completed',
                        ).length;
                        return `${fCompleted}/${fStatuses.length}`;
                      })()
                    : `${summaryStats.completedCombinations}/${summaryStats.totalCombinations}`}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  OJT進行中
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                  {selectedFacilityId
                    ? filteredActiveOjt.length
                    : summaryStats.ojtInProgress}
                </p>
                <p className="mt-1 text-xs text-gray-400">件</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">OJT完了</p>
                <p className="mt-2 text-2xl font-bold text-green-600">
                  {selectedFacilityId
                    ? filteredCompletedOjt.length
                    : summaryStats.ojtCompleted}
                </p>
                <p className="mt-1 text-xs text-gray-400">件</p>
              </div>
            </div>

            {/* 研修進捗一覧 */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                研修進捗一覧
              </h2>

              {filteredWorkers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">
                    {selectedFacilityId
                      ? 'この施設に所属する外国人はいません'
                      : '外国人が登録されていません'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="space-y-3 sm:hidden">
                    {activeWorkers.map((w) => {
                      const statuses = getWorkerStatuses(w.id);
                      const pct = getWorkerPct(w.id);
                      return (
                        <Link
                          key={w.id}
                          href={`/training/${w.id}`}
                          className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {w.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {w.facility?.name ?? '未所属'}
                              </p>
                            </div>
                            <span className="ml-2 text-sm font-bold text-gray-700">
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-2">
                            <ProgressBar percentage={pct} />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {statuses.map((status, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center gap-1"
                              >
                                <span className="text-[10px] text-gray-400">
                                  {ITEM_NUMBERS[idx]}
                                </span>
                                {statusDot(status)}
                              </div>
                            ))}
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            氏名
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            施設
                          </th>
                          {items.map((item, idx) => (
                            <th
                              key={item.id}
                              className="px-3 py-3 text-center text-xs font-medium text-gray-500"
                              title={item.title}
                            >
                              {ITEM_NUMBERS[idx]}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            進捗
                          </th>
                          <th className="relative px-4 py-3">
                            <span className="sr-only">詳細</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeWorkers.map((w) => {
                          const statuses = getWorkerStatuses(w.id);
                          const pct = getWorkerPct(w.id);
                          return (
                            <tr
                              key={w.id}
                              className="transition-colors hover:bg-gray-50"
                            >
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                {w.name}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                {w.facility?.name ?? '未所属'}
                              </td>
                              {statuses.map((status, idx) => (
                                <td
                                  key={idx}
                                  className="px-3 py-3 text-center"
                                >
                                  {statusDot(status)}
                                </td>
                              ))}
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-700">
                                {pct}%
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                <Link
                                  href={`/training/${w.id}`}
                                  className="font-medium text-blue-600 hover:text-blue-800"
                                >
                                  詳細
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Completed workers toggle */}
                  {completedWorkers.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          setShowCompletedTraining(!showCompletedTraining)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${showCompletedTraining ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m19 9-7 7-7-7"
                          />
                        </svg>
                        完了済みを表示（{completedWorkers.length}件）
                      </button>

                      {showCompletedTraining && (
                        <div className="mt-3 opacity-60">
                          {/* Mobile: completed cards */}
                          <div className="space-y-3 sm:hidden">
                            {completedWorkers.map((w) => {
                              const statuses = getWorkerStatuses(w.id);
                              const pct = getWorkerPct(w.id);
                              return (
                                <Link
                                  key={w.id}
                                  href={`/training/${w.id}`}
                                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-gray-900">
                                        {w.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {w.facility?.name ?? '未所属'}
                                      </p>
                                    </div>
                                    <span className="ml-2 text-sm font-bold text-green-600">
                                      {pct}%
                                    </span>
                                  </div>
                                  <div className="mt-2">
                                    <ProgressBar percentage={pct} />
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    {statuses.map((status, idx) => (
                                      <div
                                        key={idx}
                                        className="flex flex-col items-center gap-1"
                                      >
                                        <span className="text-[10px] text-gray-400">
                                          {ITEM_NUMBERS[idx]}
                                        </span>
                                        {statusDot(status)}
                                      </div>
                                    ))}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>

                          {/* Desktop: completed table */}
                          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    氏名
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    施設
                                  </th>
                                  {items.map((item, idx) => (
                                    <th
                                      key={item.id}
                                      className="px-3 py-3 text-center text-xs font-medium text-gray-500"
                                      title={item.title}
                                    >
                                      {ITEM_NUMBERS[idx]}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                                    進捗
                                  </th>
                                  <th className="relative px-4 py-3">
                                    <span className="sr-only">詳細</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {completedWorkers.map((w) => {
                                  const statuses = getWorkerStatuses(w.id);
                                  const pct = getWorkerPct(w.id);
                                  return (
                                    <tr
                                      key={w.id}
                                      className="transition-colors hover:bg-gray-50"
                                    >
                                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                        {w.name}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                        {w.facility?.name ?? '未所属'}
                                      </td>
                                      {statuses.map((status, idx) => (
                                        <td
                                          key={idx}
                                          className="px-3 py-3 text-center"
                                        >
                                          {statusDot(status)}
                                        </td>
                                      ))}
                                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-green-600">
                                        {pct}%
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                        <Link
                                          href={`/training/${w.id}`}
                                          className="font-medium text-blue-600 hover:text-blue-800"
                                        >
                                          詳細
                                        </Link>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* OJT進捗一覧 */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                OJT進捗一覧
              </h2>

              {filteredActiveOjt.length === 0 &&
              filteredCompletedOjt.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">
                    {selectedFacilityId
                      ? 'この施設のOJT対象利用者はいません'
                      : 'OJT対象利用者が登録されていません'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Active OJT - Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {filteredActiveOjt.map((ojtUser) => {
                      const w = workers.find(
                        (w) => w.id === ojtUser.worker_id,
                      );
                      const stepInfo = ojtCurrentSteps.find(
                        (s) => s.ojtUserId === ojtUser.id,
                      );
                      return (
                        <Link
                          key={ojtUser.id}
                          href={`/ojt/${ojtUser.worker_id}`}
                          className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                                {ojtUser.user_initial}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {w?.name ?? '不明'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  利用者 {ojtUser.user_initial}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={ojtUser.ojt_status} />
                          </div>
                          {ojtUser.facilityName && (
                            <p className="mt-1.5 text-xs text-gray-400">
                              {ojtUser.facilityName}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-gray-600">
                            {stepInfo?.label ?? ''}
                          </p>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Active OJT - Desktop table */}
                  {filteredActiveOjt.length > 0 && (
                    <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              外国人
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              利用者
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              施設
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              現在のステップ
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              状態
                            </th>
                            <th className="relative px-4 py-3">
                              <span className="sr-only">詳細</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredActiveOjt.map((ojtUser) => {
                            const w = workers.find(
                              (w) => w.id === ojtUser.worker_id,
                            );
                            const stepInfo = ojtCurrentSteps.find(
                              (s) => s.ojtUserId === ojtUser.id,
                            );
                            return (
                              <tr
                                key={ojtUser.id}
                                className="transition-colors hover:bg-gray-50"
                              >
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                  {w?.name ?? '不明'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                                    {ojtUser.user_initial}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                  {ojtUser.facilityName ?? '---'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                  {stepInfo?.label ?? ''}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <StatusBadge status={ojtUser.ojt_status} />
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                  <Link
                                    href={`/ojt/${ojtUser.worker_id}`}
                                    className="font-medium text-blue-600 hover:text-blue-800"
                                  >
                                    詳細
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Completed OJT toggle */}
                  {filteredCompletedOjt.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowCompletedOjt(!showCompletedOjt)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${showCompletedOjt ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m19 9-7 7-7-7"
                          />
                        </svg>
                        完了済みを表示（{filteredCompletedOjt.length}件）
                      </button>

                      {showCompletedOjt && (
                        <div className="mt-3 opacity-60">
                          {/* Mobile: completed OJT cards */}
                          <div className="space-y-3 sm:hidden">
                            {filteredCompletedOjt.map((ojtUser) => {
                              const w = workers.find(
                                (w) => w.id === ojtUser.worker_id,
                              );
                              return (
                                <Link
                                  key={ojtUser.id}
                                  href={`/ojt/${ojtUser.worker_id}`}
                                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                                        {ojtUser.user_initial}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                          {w?.name ?? '不明'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          利用者 {ojtUser.user_initial}
                                        </p>
                                      </div>
                                    </div>
                                    <StatusBadge status={ojtUser.ojt_status} />
                                  </div>
                                  {ojtUser.facilityName && (
                                    <p className="mt-1.5 text-xs text-gray-400">
                                      {ojtUser.facilityName}
                                    </p>
                                  )}
                                </Link>
                              );
                            })}
                          </div>

                          {/* Desktop: completed OJT table */}
                          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    外国人
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    利用者
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    施設
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    状態
                                  </th>
                                  <th className="relative px-4 py-3">
                                    <span className="sr-only">詳細</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {filteredCompletedOjt.map((ojtUser) => {
                                  const w = workers.find(
                                    (w) => w.id === ojtUser.worker_id,
                                  );
                                  return (
                                    <tr
                                      key={ojtUser.id}
                                      className="transition-colors hover:bg-gray-50"
                                    >
                                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                        {w?.name ?? '不明'}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                                          {ojtUser.user_initial}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                        {ojtUser.facilityName ?? '---'}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3">
                                        <StatusBadge
                                          status={ojtUser.ojt_status}
                                        />
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                        <Link
                                          href={`/ojt/${ojtUser.worker_id}`}
                                          className="font-medium text-blue-600 hover:text-blue-800"
                                        >
                                          詳細
                                        </Link>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 未実施アラート */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                未実施アラート
              </h2>

              {filteredPending.length === 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                  <p className="text-sm font-medium text-green-700">
                    {selectedFacilityId
                      ? 'この施設の研修項目は全て完了しています'
                      : '全ての研修項目が完了しています'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPending.map(({ worker, pending }) => (
                    <div
                      key={worker.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {worker.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {worker.facility?.name ?? '未所属'}
                          </p>
                        </div>
                        <Link
                          href={`/training/${worker.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          研修詳細
                        </Link>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pending.map((p) => (
                          <span
                            key={p.itemId}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.status === 'not_started'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {statusDot(p.status)}
                            {p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      }}
    </DashboardFilter>
  );
}
