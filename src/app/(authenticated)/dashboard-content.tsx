'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrainingStatus, OjtStatus } from '@/lib/types';
import { OJT_STEPS } from '@/lib/types';
import StatusBadge from '@/components/status-badge';
import ProgressBar from '@/components/progress-bar';
import {
  ChevronDown,
  LayoutList,
  LayoutGrid,
  Columns2,
  Square,
} from 'lucide-react';

// ---------- shared types ----------

export type WorkerData = {
  id: string;
  name: string;
  facility: { id: string; name: string } | null;
};

export type ItemData = { id: string; title: string };

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

export type OjtCurrentStep = { ojtUserId: string; step: string; label: string };

export type WorkerFacilityMapping = { worker_id: string; facility_id: string };

export type PendingItem = { itemId: string; title: string; status: TrainingStatus };

export type WorkerWithPending = { worker: WorkerData; pending: PendingItem[] };

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

// ---------- view mode ----------

type ViewMode = 'list' | 'grid' | 'columns' | 'large';

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const modes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'list', icon: <LayoutList size={14} />, label: 'リスト' },
    { mode: 'grid', icon: <LayoutGrid size={14} />, label: 'グリッド' },
    { mode: 'columns', icon: <Columns2 size={14} />, label: '2カラム' },
    { mode: 'large', icon: <Square size={14} />, label: '大' },
  ];
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {modes.map((m) => (
        <button
          key={m.mode}
          onClick={() => onChange(m.mode)}
          title={m.label}
          className={`px-2 py-1 transition-colors ${
            value === m.mode
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
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
      title={status === 'completed' ? '完了' : status === 'in_progress' ? '進行中' : '未着手'}
    />
  );
}

const OJT_PROGRESS_STEPS = OJT_STEPS.filter((_, i) => i >= 1);

function getOjtStepIndex(step: string): number {
  const idx = OJT_PROGRESS_STEPS.findIndex((s) => s.step === step);
  return idx >= 0 ? idx : 0;
}

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
          selectedId === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        すべて
      </button>
      {facilities.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            selectedId === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}

// ---------- grid layout classes ----------

function getGridClass(mode: ViewMode) {
  switch (mode) {
    case 'grid': return 'grid grid-cols-2 sm:grid-cols-3 gap-3';
    case 'columns': return 'grid grid-cols-1 sm:grid-cols-2 gap-3';
    case 'large': return 'grid grid-cols-1 gap-4';
    default: return 'space-y-2';
  }
}

// ---------- main component ----------

export default function AdminDashboardContent({
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
  const [trainingView, setTrainingView] = useState<ViewMode>('list');
  const [ojtView, setOjtView] = useState<ViewMode>('list');
  const [expandedOjtWorkers, setExpandedOjtWorkers] = useState<Set<string>>(new Set());

  // facility -> worker lookup
  const facilityWorkerMap = new Map<string, Set<string>>();
  for (const wf of workerFacilities) {
    if (!facilityWorkerMap.has(wf.facility_id)) facilityWorkerMap.set(wf.facility_id, new Set());
    facilityWorkerMap.get(wf.facility_id)!.add(wf.worker_id);
  }

  function filterWorkers(list: WorkerData[], fid: string | null) {
    if (!fid) return list;
    const ids = facilityWorkerMap.get(fid);
    return ids ? list.filter((w) => ids.has(w.id)) : [];
  }

  function filterOjtUsers(list: OjtUserData[], fid: string | null) {
    if (!fid) return list;
    return list.filter((u) => u.facility_id === fid);
  }

  function filterPending(list: WorkerWithPending[], fid: string | null) {
    if (!fid) return list;
    const ids = facilityWorkerMap.get(fid);
    return ids ? list.filter((wp) => ids.has(wp.worker.id)) : [];
  }

  function getWorkerStatuses(workerId: string) {
    return items.map((item) => {
      const found = workerItemStatuses.find((s) => s.workerId === workerId && s.itemId === item.id);
      return found?.status ?? ('not_started' as TrainingStatus);
    });
  }

  function getWorkerPct(workerId: string) {
    const statuses = getWorkerStatuses(workerId);
    const completed = statuses.filter((s) => s === 'completed').length;
    return items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  }

  function isAllTrainingDone(workerId: string) {
    return getWorkerStatuses(workerId).every((s) => s === 'completed');
  }

  function groupOjtByWorker(list: OjtUserData[]) {
    const map = new Map<string, OjtUserData[]>();
    for (const u of list) {
      if (!map.has(u.worker_id)) map.set(u.worker_id, []);
      map.get(u.worker_id)!.push(u);
    }
    return Array.from(map.entries()).map(([wid, users]) => ({
      workerId: wid,
      worker: workers.find((w) => w.id === wid),
      users,
    }));
  }

  function getOjtProgress(ojtUserId: string) {
    const ojtUser = ojtUsers.find((u) => u.id === ojtUserId);
    if (ojtUser?.ojt_status === 'completed') return { completed: 6, total: 6, pct: 100 };
    const stepInfo = ojtCurrentSteps.find((s) => s.ojtUserId === ojtUserId);
    if (!stepInfo) return { completed: 0, total: 6, pct: 0 };
    const idx = getOjtStepIndex(stepInfo.step);
    return { completed: idx, total: 6, pct: Math.round((idx / 6) * 100) };
  }

  function toggleOjtExpand(workerId: string) {
    setExpandedOjtWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }

  // ---- computed data ----
  const activeOjt = ojtUsers.filter((u) => u.ojt_status !== 'completed');
  const completedOjt = ojtUsers.filter((u) => u.ojt_status === 'completed');

  const fWorkers = filterWorkers(workers, trainingFacilityId);
  const fActiveOjt = filterOjtUsers(activeOjt, ojtFacilityId);
  const fCompletedOjt = filterOjtUsers(completedOjt, ojtFacilityId);
  const fPending = filterPending(workersWithPending, trainingFacilityId);

  const activeWorkers = fWorkers.filter((w) => !isAllTrainingDone(w.id));
  const completedWorkers = fWorkers.filter((w) => isAllTrainingDone(w.id));
  const activeOjtGrouped = groupOjtByWorker(fActiveOjt);
  const completedOjtGrouped = groupOjtByWorker(fCompletedOjt);

  // ---- OJT alerts: not_started or stalled (>7 days on same step) ----
  const ojtAlerts: { worker: WorkerData; ojtUser: OjtUserData; reason: string }[] = [];
  for (const u of activeOjt) {
    const w = workers.find((w) => w.id === u.worker_id);
    if (!w) continue;
    if (u.ojt_status === 'not_started') {
      ojtAlerts.push({ worker: w, ojtUser: u, reason: `利用者${u.user_initial}: 未着手` });
    } else if (u.ojt_status === 'in_progress') {
      const progress = getOjtProgress(u.id);
      if (progress.completed === 0) {
        ojtAlerts.push({ worker: w, ojtUser: u, reason: `利用者${u.user_initial}: ステップ未進行` });
      }
    }
  }

  // ---- Training card rendering ----
  function renderTrainingCard(w: WorkerData, isCompact: boolean) {
    const statuses = getWorkerStatuses(w.id);
    const pct = getWorkerPct(w.id);

    if (isCompact) {
      return (
        <Link
          key={w.id}
          href={`/training/${w.id}`}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{w.name}</p>
            <p className="text-[10px] text-gray-400">{w.facility?.name ?? ''}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {statuses.map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[8px] text-gray-300">{ITEM_NUMBERS[i]}</span>
                {statusDot(s)}
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-gray-600 whitespace-nowrap">{pct}%</span>
        </Link>
      );
    }

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
          {statuses.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{ITEM_NUMBERS[i]}</span>
              {statusDot(s)}
            </div>
          ))}
        </div>
      </Link>
    );
  }

  // ---- OJT card rendering ----
  function renderOjtGroupCard(
    group: { workerId: string; worker: WorkerData | undefined; users: OjtUserData[] },
    isCompact: boolean,
  ) {
    const { workerId, worker, users } = group;
    const totalSteps = users.length * 6;
    const completedSteps = users.reduce((acc, u) => acc + getOjtProgress(u.id).completed, 0);
    const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const isExpanded = expandedOjtWorkers.has(workerId);

    if (isCompact) {
      return (
        <div key={workerId} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{worker?.name ?? '不明'}</p>
              <p className="text-[10px] text-gray-400">{users.length}名</p>
            </div>
            <div className="w-20">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold text-gray-600 whitespace-nowrap">{overallPct}%</span>
            <button
              onClick={() => toggleOjtExpand(workerId)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {isExpanded && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {users.map((u) => renderOjtUserRow(u))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={workerId} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Worker header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{worker?.name ?? '不明'}</p>
              <p className="text-xs text-gray-500">{worker?.facility?.name ?? ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-700">{overallPct}%</p>
                <p className="text-[10px] text-gray-400">{users.length}名の利用者</p>
              </div>
              <button
                onClick={() => toggleOjtExpand(workerId)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          <div className="mt-2">
            <ProgressBar percentage={overallPct} />
          </div>
        </div>

        {/* Collapsible user rows */}
        {isExpanded && (
          <div className="divide-y divide-gray-100">
            {users.map((u) => renderOjtUserRow(u))}
          </div>
        )}
      </div>
    );
  }

  function renderOjtUserRow(ojtUser: OjtUserData) {
    const stepInfo = ojtCurrentSteps.find((s) => s.ojtUserId === ojtUser.id);
    const progress = getOjtProgress(ojtUser.id);
    return (
      <Link
        key={ojtUser.id}
        href={`/ojt/${ojtUser.worker_id}/${ojtUser.id}`}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
          {ojtUser.user_initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">
              利用者 {ojtUser.user_initial}
              {ojtUser.facilityName && <span className="ml-1 text-gray-400">({ojtUser.facilityName})</span>}
            </p>
            <StatusBadge status={ojtUser.ojt_status} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
            <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{progress.completed}/6</span>
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">{stepInfo?.label ?? '①利用者の選定・マッチング'}</p>
        </div>
      </Link>
    );
  }

  const isTrainingCompact = trainingView === 'list';
  const isOjtCompact = ojtView === 'list';

  return (
    <div className="space-y-6">
      {/* ===== Compact Summary ===== */}
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
          <div className="ml-auto">
            <ViewToggle value={trainingView} onChange={setTrainingView} />
          </div>
        </div>

        {fWorkers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              {trainingFacilityId ? 'この施設に所属する外国人はいません' : '外国人が登録されていません'}
            </p>
          </div>
        ) : (
          <>
            <div className={getGridClass(trainingView)}>
              {activeWorkers.map((w) => renderTrainingCard(w, isTrainingCompact))}
            </div>

            {completedWorkers.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCompletedTraining(!showCompletedTraining)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm hover:bg-gray-50"
                >
                  <ChevronDown size={12} className={`transition-transform ${showCompletedTraining ? 'rotate-180' : ''}`} />
                  完了済み（{completedWorkers.length}件）
                </button>
                {showCompletedTraining && (
                  <div className={`mt-2 opacity-60 ${getGridClass(trainingView)}`}>
                    {completedWorkers.map((w) => renderTrainingCard(w, isTrainingCompact))}
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
          <div className="ml-auto">
            <ViewToggle value={ojtView} onChange={setOjtView} />
          </div>
        </div>

        {fActiveOjt.length === 0 && fCompletedOjt.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              {ojtFacilityId ? 'この施設のOJT対象利用者はいません' : 'OJT対象利用者が登録されていません'}
            </p>
          </div>
        ) : (
          <>
            <div className={getGridClass(ojtView)}>
              {activeOjtGrouped.map((g) => renderOjtGroupCard(g, isOjtCompact))}
            </div>

            {completedOjtGrouped.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCompletedOjt(!showCompletedOjt)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm hover:bg-gray-50"
                >
                  <ChevronDown size={12} className={`transition-transform ${showCompletedOjt ? 'rotate-180' : ''}`} />
                  完了済み（{fCompletedOjt.length}件）
                </button>
                {showCompletedOjt && (
                  <div className={`mt-2 opacity-60 ${getGridClass(ojtView)}`}>
                    {completedOjtGrouped.map((g) => renderOjtGroupCard(g, isOjtCompact))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== 未実施アラート (研修 + OJT) ===== */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">未実施アラート</h2>

        {fPending.length === 0 && ojtAlerts.length === 0 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm font-medium text-green-700">
              {trainingFacilityId ? 'この施設のアラートはありません' : '全ての項目が順調に進んでいます'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 研修アラート */}
            {fPending.map(({ worker, pending }) => (
              <div key={`t-${worker.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
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
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      研修
                      {' '}{p.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* OJTアラート */}
            {ojtAlerts.length > 0 && (() => {
              // group by worker
              const grouped = new Map<string, { worker: WorkerData; reasons: string[] }>();
              for (const a of ojtAlerts) {
                if (!grouped.has(a.worker.id)) grouped.set(a.worker.id, { worker: a.worker, reasons: [] });
                grouped.get(a.worker.id)!.reasons.push(a.reason);
              }
              return Array.from(grouped.values()).map(({ worker, reasons }) => (
                <div key={`o-${worker.id}`} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{worker.name}</p>
                      <p className="text-xs text-gray-500">{worker.facility?.name ?? '未所属'}</p>
                    </div>
                    <Link href={`/ojt/${worker.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                      OJT詳細
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reasons.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
                        OJT
                        {' '}{r}
                      </span>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
