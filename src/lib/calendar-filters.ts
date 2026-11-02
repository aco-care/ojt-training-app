import type { CalendarEvent } from '@/lib/types';

export interface CalendarFilters {
  showAll: boolean;
  workerId: string;
  trainerId: string;
}

// Own plans by default; people with no plans of their own start on everyone's
export function initialCalendarFilters(events: CalendarEvent[], currentUserId: string): CalendarFilters {
  return {
    showAll: !events.some((e) => e.trainerId === currentUserId),
    workerId: '',
    trainerId: '',
  };
}

// Picking someone else's plans only makes sense on the everyone view
export function withWorkerFilter(filters: CalendarFilters, workerId: string): CalendarFilters {
  return { ...filters, workerId, showAll: filters.showAll || workerId !== '' };
}

export function withTrainerFilter(filters: CalendarFilters, trainerId: string, currentUserId: string): CalendarFilters {
  return { ...filters, trainerId, showAll: filters.showAll || (trainerId !== '' && trainerId !== currentUserId) };
}

export function withScope(filters: CalendarFilters, showAll: boolean): CalendarFilters {
  return showAll ? { ...filters, showAll } : { showAll, workerId: '', trainerId: '' };
}

export function filterCalendarEvents(events: CalendarEvent[], filters: CalendarFilters, currentUserId: string): CalendarEvent[] {
  return events.filter((e) => {
    if (!filters.showAll && e.trainerId !== currentUserId) return false;
    if (filters.workerId && e.workerId !== filters.workerId) return false;
    if (filters.trainerId && e.trainerId !== filters.trainerId) return false;
    return true;
  });
}

// Unique trainers from events, keyed by ID so same-name staff stay separate
export function trainerFilterOptions(events: CalendarEvent[]): [string, string][] {
  return [
    ...new Map(
      events
        .filter((e) => e.trainerId && e.trainerName)
        .map((e): [string, string] => [e.trainerId as string, e.trainerName])
    ),
  ].sort(([, a], [, b]) => a.localeCompare(b));
}

// Matches what the database lets each role change, so the button never fails silently
export function canArchiveEvent(
  event: CalendarEvent,
  viewer: { userId: string; role: string; canCreate: boolean },
): boolean {
  return (
    viewer.role === 'admin' ||
    viewer.role === 'supervisor' ||
    (viewer.canCreate && (event.trainerId === viewer.userId || event.createdBy === viewer.userId))
  );
}
