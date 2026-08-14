import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, TrainingPlan, OjtPlan } from '@/lib/types';
import { OJT_STEPS } from '@/lib/types';
import type { CalendarEvent } from '@/lib/types';
import dynamic from 'next/dynamic';
import PageHeader from '@/components/page-header';

const ScheduleCalendar = dynamic(() => import('./schedule-calendar'), {
  loading: () => <div className="animate-pulse h-96 bg-gray-100 rounded-lg" />,
});

export const revalidate = 60;

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 8 parallel queries
  const [
    { data: trainingPlansData },
    { data: ojtPlansData },
    { data: workersData },
    { data: itemsData },
    { data: ojtUsersData },
    { data: staffData },
    { data: trainingSessionsData },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('training_plans')
      .select('*, worker:foreign_workers(id, name), item:training_items(id, title), trainer:profiles!training_plans_trainer_id_fkey(id, name)')
      .neq('is_archived', true)
      .order('planned_date', { ascending: false }),
    supabase
      .from('ojt_plans')
      .select('*, worker:foreign_workers(id, name), companion:profiles!ojt_plans_companion_id_fkey(id, name)')
      .neq('is_archived', true)
      .order('planned_date', { ascending: false }),
    supabase
      .from('foreign_workers')
      .select('id, name, facility_id')
      .order('name'),
    supabase
      .from('training_items')
      .select('id, item_number, facility_id, title, target_sessions, target_hours, training_subtopics(id, title, group_label, sort_order)')
      .order('sort_order'),
    supabase
      .from('ojt_users')
      .select('id, worker_id, user_initial, ojt_status')
      .order('created_at'),
    supabase
      .from('profiles')
      .select('id, name, role, qualification')
      .in('role', ['trainer', 'supervisor', 'admin'])
      .eq('is_archived', false)
      .order('name'),
    supabase
      .from('training_sessions')
      .select('worker_id, item_id, completed_subtopics, start_time, end_time, break_minutes')
      .limit(5000),
    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single(),
  ]);

  if (!profile) redirect('/login');
  const userRole = (profile as Profile).role;

  const trainingPlans = (trainingPlansData ?? []) as (TrainingPlan & {
    worker: { id: string; name: string };
    item: { id: string; title: string };
    trainer: { id: string; name: string };
  })[];

  const ojtPlans = (ojtPlansData ?? []) as (OjtPlan & {
    worker: { id: string; name: string };
    companion: { id: string; name: string };
  })[];

  const workers = (workersData ?? []) as { id: string; name: string; facility_id: string }[];
  const rawItems = (itemsData ?? []) as { id: string; item_number: number; facility_id: string | null; title: string; target_sessions: number; target_hours: number; training_subtopics: { id: string; title: string; group_label: string | null; sort_order: number }[] }[];
  const trainingItems = rawItems.map((item) => ({
    id: item.id,
    item_number: item.item_number,
    facility_id: item.facility_id,
    title: item.title,
    target_sessions: item.target_sessions,
    target_hours: item.target_hours,
    subtopics: (item.training_subtopics ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((st) => ({ id: st.id, title: st.title, groupLabel: st.group_label })),
  }));
  const ojtUsers = (ojtUsersData ?? []) as { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  const staffList = (staffData ?? []) as { id: string; name: string; role: string; qualification: string }[];
  const trainingSessions = (trainingSessionsData ?? []) as { worker_id: string; item_id: string; completed_subtopics: string[]; start_time: string; end_time: string; break_minutes: number | null }[];

  // Transform to CalendarEvent[]
  let events: CalendarEvent[] = [
    ...trainingPlans.map((p) => ({
      id: p.id,
      type: 'training' as const,
      date: p.planned_date,
      startTime: p.start_time,
      endTime: p.end_time,
      status: p.status,
      workerName: p.worker?.name ?? '',
      workerId: p.worker_id,
      title: p.item?.title ?? '',
      trainerName: p.trainer?.name ?? '',
      detailUrl: `/training-plans/${p.id}`,
      cancelReason: p.cancel_reason ?? undefined,
      cancelHistory: p.cancel_history ?? undefined,
      trainerDone: !!p.trainer_completed_at,
      workerDone: !!p.worker_completed_at,
      supervisorDone: !!p.supervisor_completed_at,
    })),
    ...ojtPlans.map((p) => ({
      id: p.id,
      type: 'ojt' as const,
      date: p.planned_date,
      startTime: p.start_time,
      endTime: p.end_time,
      status: p.status,
      workerName: p.worker?.name ?? '',
      workerId: p.worker_id,
      title: `OJT ${OJT_STEPS.find((s) => s.step === p.step)?.label ?? p.step}`,
      trainerName: p.companion?.name ?? '',
      detailUrl: `/ojt-plans/${p.id}`,
      cancelReason: undefined,
      cancelHistory: undefined,
      trainerDone: !!p.trainer_completed_at,
      workerDone: !!p.worker_completed_at,
      supervisorDone: !!p.supervisor_completed_at,
    })),
  ];

  // Role-based filter for trainers
  if (userRole === 'trainer') {
    events = events.filter(
      (e) => e.trainerName === profile.name
    );
  }

  // Compute completedSubtopicsByWorker
  const completedSubtopicsByWorker: Record<string, string[]> = {};
  for (const s of trainingSessions) {
    if (!completedSubtopicsByWorker[s.worker_id]) {
      completedSubtopicsByWorker[s.worker_id] = [];
    }
    completedSubtopicsByWorker[s.worker_id].push(...(s.completed_subtopics ?? []));
  }
  for (const k of Object.keys(completedSubtopicsByWorker)) {
    completedSubtopicsByWorker[k] = [...new Set(completedSubtopicsByWorker[k])];
  }

  // Compute session count and hours per worker+item (key: "workerId:itemId")
  const sessionCountByWorkerItem: Record<string, number> = {};
  const hoursByWorkerItem: Record<string, number> = {};
  for (const s of trainingSessions) {
    const key = `${s.worker_id}:${s.item_id}`;
    sessionCountByWorkerItem[key] = (sessionCountByWorkerItem[key] ?? 0) + 1;
    if (s.start_time && s.end_time) {
      const start = new Date(`2000-01-01T${s.start_time}`);
      const end = new Date(`2000-01-01T${s.end_time}`);
      const diffH = (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (s.break_minutes || 0) / 60;
      if (diffH > 0) hoursByWorkerItem[key] = (hoursByWorkerItem[key] ?? 0) + diffH;
    }
  }

  const canCreate = userRole === 'admin' || userRole === 'supervisor' || userRole === 'trainer';

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="予定管理" subtitle="研修・OJTの予定をカレンダーで管理" />
      <div className="px-4 py-6 sm:px-6">
        <ScheduleCalendar
          events={events}
          workers={workers}
          trainingItems={trainingItems.map((item) => ({
            id: item.id,
            item_number: item.item_number,
            facility_id: item.facility_id,
            title: item.title,
            target_sessions: item.target_sessions,
            target_hours: item.target_hours,
            subtopics: (item.subtopics ?? []).map((st) => ({
              id: st.id,
              title: st.title,
              groupLabel: st.groupLabel ?? null,
            })),
          }))}
          ojtUsers={ojtUsers}
          staff={staffList.map((s) => ({ id: s.id, name: s.name, qualification: s.qualification }))}
          completedSubtopicsByWorker={completedSubtopicsByWorker}
          sessionCountByWorkerItem={sessionCountByWorkerItem}
          hoursByWorkerItem={hoursByWorkerItem}
          currentUserId={user.id}
          currentUserName={profile.name}
          currentUserRole={userRole}
          canCreate={canCreate}
        />
      </div>
    </div>
  );
}
