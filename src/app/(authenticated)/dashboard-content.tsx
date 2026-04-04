'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrainingStatus, OjtStatus } from '@/lib/types';
import { ROLE_LABELS, OJT_STEPS } from '@/lib/types';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';

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
          ? '完了'
          : status === 'in_progress'
            ? '進行中'
            : '未着手'
      }
    />
  );
}

/** OJT steps ②〜⑦ (6 steps) — ① matching is admin-only setup */
const OJT_PROGRESS_STEPS = OJT_STEPS.filter((_, i) => i >= 1); // ②〜⑦

function getOjtStepIndex(step: string): number {
  const idx = OJT_PROGRESS_STEPS.findIndex((s) => s.step === step);
  return idx >= 0 ? idx : 0;
}

// ---------- Inline facility filter ----------

function FacilityFilter({
  facilities,
  selectedId,
  onChange,
}: {
  facilities: { id: string; name: string }[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  if (facilities.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          selectedId === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        すべて
      </button>
      {facilities.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            selectedId === f.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {f.name}
        </button>
      ))}
    </div>
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
  const [trainingFacilityId, setTrainingFacilityId] = useState<string | null>(null);
  const [ojtFacilityId, setOjtFacilityId] = useState<string | null>(null);

  // Build a set for quick lookup: facilityId -> Set of workerIds
  const facilityWorkerMap = new Map<string, Set<string>>();
  for (const wf of workerFacilities) {
    if (!facilityWorkerMap.has(wf.facility_id)) {
      facilityWorkerMap.set(wf.facility_id, new Set());
    }
    facilityWorkerMap.get(wf.facility_id)!.add(wf.worker_id);
  }

  function filterWorkers(list: WorkerData[], selectedFacilityId: string | null): WorkerData[] {
    if (!selectedFacilityId) return list;
    const workerIds = facilityWorkerMap.get(selectedFacilityId);
    if (!workerIds) return [];
    return list.filter((w) => workerIds.has(w.id));
  }

  function filterOjtUsers(list: OjtUserData[], selectedFacilityId: string | null): OjtUserData[] {
    if (!selectedFacilityId) return list;
    return list.filter((u) => u.facility_id === selectedFacilityId);
  }

  function filterWorkersWithPending(list: WorkerWithPending[], selectedFacilityId: string | null): WorkerWithPending[] {
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
    return items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  }

  function isWorkerAllTrainingCompleted(workerId: string) {
    const statuses = getWorkerStatuses(workerId);
    return statuses.every((s) => s === 'completed');
  }

  // Group OJT users by worker_id for card consolidation
  function groupOjtByWorker(list: OjtUserData[]) {
    const map = new Map<string, OjtUserData[]>();
    for (const u of list) {
      if (!map.has(u.worker_id)) map.set(u.worker_id, []);
      map.get(u.worker_id)!.push(u);
    }
    return Array.from(map.entries()).map(([workerId, users]) => ({
      workerId,
      worker: workers.find((w) => w.id === workerId),
      users,
    }));
  }

  /** Compute OJT progress for a single ojt_user: how many of steps ②〜⑦ are passed */
  function getOjtProgress(ojtUserId: string) {
    const stepInfo = ojtCurrentSteps.find((s) => s.ojtUserId === ojtUserId);
    const ojtUser = ojtUsers.find((u) => u.id === ojtUserId);
    if (ojtUser?.ojt_status === 'completed') return { completed: 6, total: 6, pct: 100 };
    if (!stepInfo) return { completed: 0, total: 6, pct: 0 };
    const currentIdx = getOjtStepIndex(stepInfo.step);
    // Steps before current are completed
    return { completed: currentIdx, total: 6, pct: Math.round((currentIdx / 6) * 100) };
  }

  // Split OJT users into active and completed
  const activeOjtUsers = ojtUsers.filter((u) => u.ojt_status !== 'completed');
  const completedOjtUsers = ojtUsers.filter((u) => u.ojt_status === 'completed');

  // Apply filters
  const filteredWorkers = filterWorkers(workers, trainingFacilityId);
  const filteredActiveOjt = filterOjtUsers(activeOjtUsers, ojtFacilityId);
  const filteredCompletedOjt = filterOjtUsers(completedOjtUsers, ojtFacilityId);
  const filteredPending = filterWorkersWithPending(workersWithPending, trainingFacilityId);

  // Split workers into active vs all-completed
  const activeWorkers = filteredWorkers.filter((w) => !isWorkerAllTrainingCompleted(w.id));
  const completedWorkers = filteredWorkers.filter((w) => isWorkerAllTrainingCompleted(w.id));

  // Grouped OJT
  const activeOjtGrouped = groupOjtByWorker(filteredActiveOjt);
  const completedOjtGrouped = groupOjtByWorker(filteredCompletedOjt);

  return (
    <div className="space-y-6">
      {/* ===== Compact Summary Cards ===== */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-center">
          <p className="text-[10px] font-medium text-gray-400">外国人</p>
          <p className="text-lg font-bold text-gray-900">{summaryStats.totalWorkers}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-center">
          <p className="text-[10px] font-medium text-gray-400">研修完了</p>
          <p className="text-lg font-bold text-green-600">{summaryStats.trainingCompletionRate}%</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-center">
          <p className="text-[10px] font-medium text-gray-400">OJT中</p>
          <p className="text-lg font-bold text-blue-600">{summaryStats.ojtInProgress}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-center">
          <p className="text-[10px] font-medium text-gray-400">OJT完了</p>
          <p className="text-lg font-bold text-green-600">{summaryStats.ojtCompleted}</p>
        </div>
      </div>

      {/* ===== 研修進捗一覧 ===== */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">研修進捗一覧</h2>
          <FacilityFilter facilities={facilities} selectedId={trainingFacilityId} onChange={setTrainingFacilityId} />
        </div>

        {filteredWorkers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              {trainingFacilityId ? 'この施設に所属する外国人はいません' : '外国人が登録されていません'}
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
                        <p className="truncate text-sm font-semibold text-gray-900">{w.name}</p>
                        <p className="text-xs text-gray-500">{w.facility?.name ?? '未所属'}</p>
                      </div>
                      <span className="ml-2 text-sm font-bold text-gray-700">{pct}%</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar percentage={pct} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {statuses.map((status, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-400">{ITEM_NUMBERS[idx]}</span>
                          {statusDot(status)}
                        </div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: table */}
            {activeWorkers.length > 0 && (
              <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">氏名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">施設</th>
                      {items.map((item, idx) => (
                        <th key={item.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500" title={item.title}>
                          {ITEM_NUMBERS[idx]}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">進捗</th>
                      <th className="relative px-4 py-3"><span className="sr-only">詳細</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {activeWorkers.map((w) => {
                      const statuses = getWorkerStatuses(w.id);
                      const pct = getWorkerPct(w.id);
                      return (
                        <tr key={w.id} className="transition-colors hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{w.name}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{w.facility?.name ?? '未所属'}</td>
                          {statuses.map((status, idx) => (
                            <td key={idx} className="px-3 py-3 text-center">{statusDot(status)}</td>
                          ))}
                          <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-700">{pct}%</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                            <Link href={`/training/${w.id}`} className="font-medium text-blue-600 hover:text-blue-800">詳細</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Completed workers toggle */}
            {completedWorkers.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCompletedTraining(!showCompletedTraining)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <svg className={`h-3 w-3 transition-transform ${showCompletedTraining ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                  </svg>
                  完了済み（{completedWorkers.length}件）
                </button>

                {showCompletedTraining && (
                  <div className="mt-3 opacity-60 space-y-3">
                    <div className="space-y-3 sm:hidden">
                      {completedWorkers.map((w) => {
                        const pct = getWorkerPct(w.id);
                        return (
                          <Link key={w.id} href={`/training/${w.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="truncate text-sm font-medium text-gray-700">{w.name}</p>
                              <span className="text-xs font-bold text-green-600">{pct}%</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
                      <table className="min-w-full divide-y divide-gray-200">
                        <tbody className="divide-y divide-gray-200">
                          {completedWorkers.map((w) => (
                            <tr key={w.id}>
                              <td className="px-4 py-2 text-sm text-gray-700">{w.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{w.facility?.name ?? ''}</td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-green-600">100%</td>
                              <td className="px-4 py-2 text-right text-sm">
                                <Link href={`/training/${w.id}`} className="text-blue-600 hover:text-blue-800">詳細</Link>
                              </td>
                            </tr>
                          ))}
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

      {/* ===== OJT進捗一覧 ===== */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">OJT進捗一覧</h2>
          <FacilityFilter facilities={facilities} selectedId={ojtFacilityId} onChange={setOjtFacilityId} />
        </div>

        {filteredActiveOjt.length === 0 && filteredCompletedOjt.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              {ojtFacilityId ? 'この施設のOJT対象利用者はいません' : 'OJT対象利用者が登録されていません'}
            </p>
          </div>
        ) : (
          <>
            {/* Active OJT — grouped by worker */}
            <div className="space-y-3">
              {activeOjtGrouped.map(({ workerId, worker, users }) => {
                // Compute overall progress for this worker's OJTs
                const totalSteps = users.length * 6;
                const completedSteps = users.reduce((acc, u) => acc + getOjtProgress(u.id).completed, 0);
                const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                return (
                  <div key={workerId} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {/* Worker header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{worker?.name ?? '不明'}</p>
                          <p className="text-xs text-gray-500">{worker?.facility?.name ?? ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700">{overallPct}%</p>
                          <p className="text-[10px] text-gray-400">{users.length}名の利用者</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProgressBar percentage={overallPct} />
                      </div>
                    </div>

                    {/* Per-user rows */}
                    <div className="divide-y divide-gray-100">
                      {users.map((ojtUser) => {
                        const stepInfo = ojtCurrentSteps.find((s) => s.ojtUserId === ojtUser.id);
                        const progress = getOjtProgress(ojtUser.id);
                        return (
                          <Link
                            key={ojtUser.id}
                            href={`/ojt/${ojtUser.worker_id}/${ojtUser.id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {ojtUser.user_initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-gray-700">
                                  利用者 {ojtUser.user_initial}
                                  {ojtUser.facilityName && (
                                    <span className="ml-1.5 text-gray-400">({ojtUser.facilityName})</span>
                                  )}
                                </p>
                                <StatusBadge status={ojtUser.ojt_status} />
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="h-1.5 w-full rounded-full bg-gray-200">
                                    <div
                                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                                      style={{ width: `${progress.pct}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">
                                  {progress.completed}/6
                                </span>
                              </div>
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                {stepInfo?.label ?? '①利用者の選定・マッチング'}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completed OJT toggle */}
            {completedOjtGrouped.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCompletedOjt(!showCompletedOjt)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <svg className={`h-3 w-3 transition-transform ${showCompletedOjt ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                  </svg>
                  完了済み（{filteredCompletedOjt.length}件）
                </button>

                {showCompletedOjt && (
                  <div className="mt-3 opacity-60 space-y-3">
                    {completedOjtGrouped.map(({ workerId, worker, users }) => (
                      <div key={workerId} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">{worker?.name ?? '不明'}</p>
                          <span className="text-xs font-bold text-green-600">完了</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {users.map((u) => (
                            <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                              利用者 {u.user_initial}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== 未実施アラート ===== */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">未実施アラート</h2>

        {filteredPending.length === 0 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm font-medium text-green-700">
              {trainingFacilityId ? 'この施設の研修項目は全て完了しています' : '全ての研修項目が完了しています'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPending.map(({ worker, pending }) => (
              <div key={worker.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{worker.name}</p>
                    <p className="text-xs text-gray-500">{worker.facility?.name ?? '未所属'}</p>
                  </div>
                  <Link href={`/training/${worker.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                    研修詳細
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pending.map((p) => (
                    <span
                      key={p.itemId}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'not_started' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
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
}
