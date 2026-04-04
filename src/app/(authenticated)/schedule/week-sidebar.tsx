'use client';

import { useState } from 'react';
import { OJT_STEPS } from '@/lib/types';

interface WeekSidebarProps {
  workers: { id: string; name: string }[];
  trainingItems: { id: string; title: string; subtopics: { id: string; title: string }[] }[];
  completedSubtopicsByWorker: Record<string, string[]>;
  ojtUsers: { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  currentUserRole: string;
  currentUserId: string;
}

export default function WeekSidebar({
  workers,
  trainingItems,
  completedSubtopicsByWorker,
  ojtUsers,
}: WeekSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Mobile toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 md:cursor-default"
      >
        <h3 className="text-sm font-semibold text-gray-900">今週の未実施項目</h3>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform md:hidden ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Content - always visible on md+, collapsible on mobile */}
      <div className={`divide-y divide-gray-100 ${isOpen ? 'block' : 'hidden'} md:block`}>
        {workers.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-500">対象者がいません</p>
        )}
        {workers.map((worker) => {
          const completed = completedSubtopicsByWorker[worker.id] ?? [];
          const workerOjtUsers = ojtUsers.filter((u) => u.worker_id === worker.id);

          return (
            <div key={worker.id} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-800">{worker.name}</p>

              {/* Training items with incomplete subtopics */}
              <div className="mt-1.5 space-y-1">
                {trainingItems.map((item) => {
                  const totalSubs = item.subtopics.length;
                  if (totalSubs === 0) return null;
                  const doneCount = item.subtopics.filter((st) =>
                    completed.includes(st.id)
                  ).length;
                  if (doneCount >= totalSubs) return null;

                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-gray-600">{item.title}</span>
                      <div className="ml-2 flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-gray-500">{doneCount}/{totalSubs} 完了</span>
                        {doneCount === 0 && (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                            未実施
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* OJT users */}
              {workerOjtUsers.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {workerOjtUsers.map((ou) => {
                    const stepLabel = OJT_STEPS.find((s) => s.step === ou.ojt_status)?.label;
                    return (
                      <div key={ou.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">利用者 {ou.user_initial}</span>
                        <span className="text-gray-500">{stepLabel ?? ou.ojt_status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
