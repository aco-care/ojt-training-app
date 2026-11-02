import type { SupabaseClient } from '@supabase/supabase-js';
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
export function selectPlansAwaitingConfirmation(
  supabase: SupabaseClient,
  table: 'training_plans' | 'ojt_plans',
  columns: string,
) {
  return supabase
    .from(table)
    .select(columns)
    .not('trainer_completed_at', 'is', null)
    .not('worker_completed_at', 'is', null)
    .is('supervisor_completed_at', null)
    .neq('status', 'cancelled')
    .not('is_archived', 'is', true);
}

// Oldest first, so what has waited longest is at the top
export function sortReviewEntries(entries: ReviewEntry[]): ReviewEntry[] {
  return [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}
