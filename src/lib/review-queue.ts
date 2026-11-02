import type { TrainingSession } from '@/lib/types';

export type ReviewKind = 'training_plan' | 'ojt_plan' | 'training_item';

export interface ReviewEntry {
  key: string;
  kind: ReviewKind;
  href: string;
  workerName: string;
  facilityName: string | null;
  title: string;
  date: string | null;
}

type SessionForHours = Pick<TrainingSession, 'start_time' | 'end_time' | 'break_minutes'>;

export function calculateSessionHours(session: SessionForHours): number {
  const start = new Date(`2000-01-01T${session.start_time}`);
  const end = new Date(`2000-01-01T${session.end_time}`);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (session.break_minutes || 0) / 60;
}

// The rule behind the approve button on the training item screen
export function isItemEligibleForApproval(
  sessions: (SessionForHours & Pick<TrainingSession, 'completed_subtopics'>)[],
  subtopics: { id: string }[],
  targetHours: number,
  approvalStatus: string | undefined,
): boolean {
  const completedIds = new Set(sessions.flatMap((s) => s.completed_subtopics ?? []));
  const totalHours = sessions.reduce((acc, s) => acc + calculateSessionHours(s), 0);
  return (
    subtopics.length > 0 &&
    subtopics.every((st) => completedIds.has(st.id)) &&
    totalHours >= targetHours &&
    approvalStatus !== 'completed'
  );
}

// The state where the plan screens offer the supervisor's confirmation form
export function isPlanAwaitingConfirmation(plan: {
  status: string;
  is_archived: boolean | null;
  trainer_completed_at: string | null;
  worker_completed_at: string | null;
  supervisor_completed_at: string | null;
}): boolean {
  return (
    !!plan.trainer_completed_at &&
    !!plan.worker_completed_at &&
    !plan.supervisor_completed_at &&
    plan.status !== 'cancelled' &&
    !plan.is_archived
  );
}

// Oldest first, so what has waited longest is at the top
export function sortReviewEntries(entries: ReviewEntry[]): ReviewEntry[] {
  return [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}
