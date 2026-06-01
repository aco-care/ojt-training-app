'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrainingItem, TrainingPlan, TrainingPlanStatus, UserRole } from '@/lib/types';
import { PLAN_STATUS_LABELS } from '@/lib/types';
import CreatePlanForm from './create-plan-form';
import { todayKey } from '@/lib/date-utils';

interface PlanListProps {
  plans: (TrainingPlan & {
    worker: { id: string; name: string };
    item: { id: string; title: string };
    trainer: { id: string; name: string };
  })[];
  workers: { id: string; name: string }[];
  items: (TrainingItem & { subtopics: { id: string; title: string }[] })[];
  trainers: { id: string; name: string; role: string; qualification: string }[];
  canCreate: boolean;
  currentUserId: string;
  userRole: UserRole;
}

const STATUS_COLORS: Record<TrainingPlanStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
}

export default function PlanList({
  plans,
  workers,
  items,
  trainers,
  canCreate,
  currentUserId,
  userRole,
}: PlanListProps) {
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const today = todayKey();

  const filtered = plans.filter((p) => {
    if (filter === 'today') return p.planned_date === today;
    if (filter === 'upcoming') return p.planned_date >= today && p.status === 'scheduled';
    if (filter === 'completed') return p.status === 'completed';
    return true;
  });

  // For trainer/worker, show only their plans
  const visiblePlans = (userRole === 'trainer')
    ? filtered.filter((p) => p.trainer_id === currentUserId)
    : filtered;

  return (
    <div>
      {/* Header controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            研修予定を作成
          </button>
        )}

        <div className="flex gap-1 ml-auto">
          {(['all', 'today', 'upcoming', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'すべて' : f === 'today' ? '本日' : f === 'upcoming' ? '予定' : '完了'}
            </button>
          ))}
        </div>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <CreatePlanForm
          workers={workers}
          items={items}
          trainers={trainers}
          currentUserId={currentUserId}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Plan cards */}
      {visiblePlans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            {filter === 'today' ? '本日の研修予定はありません' : '研修予定はまだありません'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePlans.map((plan) => {
            const trainerDone = !!plan.trainer_completed_at;
            const workerDone = !!plan.worker_completed_at;
            const supervisorDone = !!plan.supervisor_completed_at;

            return (
              <Link
                key={plan.id}
                href={`/training-plans/${plan.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{plan.worker.name}</p>
                    <p className="text-xs text-gray-500">{plan.item.title}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[plan.status as TrainingPlanStatus]}`}>
                    {PLAN_STATUS_LABELS[plan.status as TrainingPlanStatus]}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>{formatDate(plan.planned_date)}</span>
                  <span>指導者: {plan.trainer.name}</span>
                </div>

                {/* 3-step progress */}
                <div className="mt-3 flex items-center gap-1">
                  <div className={`flex-1 h-1.5 rounded-full ${trainerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${workerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${supervisorDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="flex-1 text-center">{trainerDone ? '✓ 指導者' : '指導者'}</span>
                  <span className="flex-1 text-center">{workerDone ? '✓ 本人' : '本人'}</span>
                  <span className="flex-1 text-center">{supervisorDone ? '✓ 責任者' : '責任者'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
