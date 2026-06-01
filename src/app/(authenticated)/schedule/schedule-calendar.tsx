'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CalendarEvent, CalendarViewMode } from '@/lib/types';
import { PLAN_STATUS_LABELS } from '@/lib/types';
import {
  toDateKey,
  addMonths,
  addWeeks,
  addDays,
  getMonthCalendarDates,
  getWeekDates,
  isSameDay,
  isSameMonth,
  formatMonthYear,
  formatWeekRange,
  formatDayFull,
  WEEKDAY_LABELS,
} from '@/lib/date-utils';
import DayCell from './day-cell';
import WeekSidebar from './week-sidebar';
import CreatePlanModal from './create-plan-modal';

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  workers: { id: string; name: string }[];
  trainingItems: { id: string; title: string; target_sessions: number; target_hours: number; subtopics: { id: string; title: string; groupLabel?: string | null }[] }[];
  ojtUsers: { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  staff: { id: string; name: string; qualification: string }[];
  completedSubtopicsByWorker: Record<string, string[]>;
  sessionCountByWorkerItem: Record<string, number>;
  hoursByWorkerItem: Record<string, number>;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  canCreate: boolean;
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-yellow-100 text-yellow-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'cancelled': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function eventBorderColor(event: CalendarEvent): string {
  if (event.status === 'cancelled') return 'border-gray-300';
  return event.type === 'ojt' ? 'border-green-500' : 'border-blue-500';
}

export default function ScheduleCalendar({
  events,
  workers,
  trainingItems,
  ojtUsers,
  staff,
  completedSubtopicsByWorker,
  sessionCountByWorkerItem,
  hoursByWorkerItem,
  currentUserId,
  currentUserName,
  currentUserRole,
  canCreate,
}: ScheduleCalendarProps) {
  // Format time: "07:00:00" or "07:00" → "7:00"
  const fmtTime = (t: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    return `${parseInt(h, 10)}:${m}`;
  };

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<CalendarEvent | null>(null);
  const [filterWorkerId, setFilterWorkerId] = useState('');
  const [filterTrainerName, setFilterTrainerName] = useState('');
  const router = useRouter();

  // Swipe state
  const touchStartX = useRef(0);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Build unique trainer names from events
  const trainerNames = [...new Set(events.map((e) => e.trainerName).filter(Boolean))].sort();

  const filteredEvents = events.filter((e) => {
    if (filterWorkerId && e.workerId !== filterWorkerId) return false;
    if (filterTrainerName && e.trainerName !== filterTrainerName) return false;
    return true;
  });

  const eventsForDate = useCallback(
    (date: Date) => filteredEvents.filter((e) => e.date === toDateKey(date)),
    [filteredEvents]
  );

  // Navigation
  const goNext = () => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };
  const goPrev = () => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, -1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, -1));
    else setCurrentDate((d) => addDays(d, -1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX < -50) goNext();
    else if (deltaX > 50) goPrev();
  };

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateClick = (date?: Date) => {
    if (date) setSelectedDate(date);
    setShowCreateModal(true);
  };

  // Period label
  const periodLabel =
    viewMode === 'month'
      ? formatMonthYear(currentDate)
      : viewMode === 'week'
        ? formatWeekRange(currentDate)
        : formatDayFull(currentDate);

  // Month grid dates
  const monthDates = getMonthCalendarDates(
    currentDate.getFullYear(),
    currentDate.getMonth()
  );
  const weekDates = getWeekDates(currentDate);

  const handleArchivePlan = async (event: CalendarEvent) => {
    if (!confirm(`「${event.title}」（${event.workerName}）をアーカイブしますか？\nカレンダーから非表示になりますが、研修データは保持されます。`)) return;
    const supabase = createClient();
    const table = event.type === 'training' ? 'training_plans' : 'ojt_plans';
    const planId = event.detailUrl.split('/').pop();
    await supabase.from(table).update({ is_archived: true }).eq('id', planId);
    router.refresh();
  };

  const handleDuplicate = (event: CalendarEvent) => {
    setDuplicateSource(event);
    setShowCreateModal(true);
  };

  const renderEventCard = (event: CalendarEvent, compact = false) => (
    <div
      key={event.id}
      className={`rounded-lg border-l-4 bg-white p-3 shadow-sm ${eventBorderColor(event)} ${
        event.status === 'cancelled' ? 'opacity-60' : ''
      }`}
    >
      <Link href={event.detailUrl} className="block hover:opacity-80">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
              {event.title}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{event.workerName}</p>
            {!compact && (
              <p className="text-xs text-gray-400">
                {event.startTime && event.endTime
                  ? `${fmtTime(event.startTime)}〜${fmtTime(event.endTime)}`
                  : '時間未設定'}
                {' / '}
                {event.trainerName}
              </p>
            )}
          </div>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeColor(event.status)}`}
          >
            {PLAN_STATUS_LABELS[event.status] ?? event.status}
          </span>
        </div>
        {!compact && event.status !== 'cancelled' && (
          <div className="mt-1.5 flex gap-2 text-[10px]">
            <span className={event.trainerDone ? 'text-green-600' : 'text-gray-400'}>
              指導者{event.trainerDone ? '済' : '未'}
            </span>
            <span className={event.workerDone ? 'text-green-600' : 'text-gray-400'}>
              本人{event.workerDone ? '済' : '未'}
            </span>
            <span className={event.supervisorDone ? 'text-green-600' : 'text-gray-400'}>
              責任者{event.supervisorDone ? '済' : '未'}
            </span>
          </div>
        )}
      </Link>
      {/* Action buttons */}
      {!compact && canCreate && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-3">
            <Link
              href={event.detailUrl}
              className="rounded px-1.5 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800"
            >
              詳細
            </Link>
            {event.status === 'scheduled' && (
              <Link
                href={`${event.detailUrl}?edit=true`}
                className="rounded px-1.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              >
                編集
              </Link>
            )}
            <button
              type="button"
              onClick={() => handleDuplicate(event)}
              className="rounded px-1.5 py-1 text-[10px] font-medium text-green-600 hover:bg-green-50 hover:text-green-800"
            >
              複製
            </button>
          </div>
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => handleArchivePlan(event)}
              className="rounded px-1.5 py-1 text-[10px] font-medium text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              アーカイブ
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Compact event row for event list
  const renderEventRow = (event: CalendarEvent) => (
    <Link
      key={event.id}
      href={event.detailUrl}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 ${
        event.status === 'cancelled' ? 'opacity-50' : ''
      }`}
    >
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
        event.type === 'ojt' ? 'bg-green-500' : 'bg-blue-500'
      } ${event.status === 'cancelled' ? 'bg-gray-300' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
        <p className="text-xs text-gray-500">
          {event.startTime && event.endTime ? `${fmtTime(event.startTime)}〜${fmtTime(event.endTime)}` : '終日'}
          {' '}・ {event.workerName}
        </p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeColor(event.status)}`}>
        {PLAN_STATUS_LABELS[event.status] ?? event.status}
      </span>
    </Link>
  );

  return (
    <div className="space-y-4">
      {/* ===== Mobile Controls ===== */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" onClick={goPrev} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{periodLabel}</span>
            <button type="button" onClick={goNext} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <button type="button" onClick={goToday} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">今日</button>
        </div>
        <div className="flex gap-2">
          <select
            value={filterWorkerId}
            onChange={(e) => setFilterWorkerId(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
          >
            <option value="">外国人: すべて</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            value={filterTrainerName}
            onChange={(e) => setFilterTrainerName(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
          >
            <option value="">指導者: すべて</option>
            {trainerNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== Desktop Controls ===== */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-300 bg-white">
          {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => {
            const labels: Record<CalendarViewMode, string> = { month: '月', week: '週', day: '日' };
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <button type="button" onClick={goPrev} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <button type="button" onClick={goToday} className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50">今日</button>
        <button type="button" onClick={goNext} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
        <span className="text-sm font-semibold text-gray-900">{periodLabel}</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filter + Create */}
        <select
          value={filterWorkerId}
          onChange={(e) => setFilterWorkerId(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
        >
          <option value="">外国人: すべて</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={filterTrainerName}
          onChange={(e) => setFilterTrainerName(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
        >
          <option value="">指導者: すべて</option>
          {trainerNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {canCreate && (
          <button
            type="button"
            onClick={() => handleCreateClick()}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            予定追加
          </button>
        )}
      </div>

      {/* Calendar grid area */}
      <div
        ref={calendarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ===== MONTH VIEW ===== */}
        {viewMode === 'month' && (
          <div>
            <div className="rounded-lg border border-gray-200 bg-white p-1 sm:p-2">
              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-1 text-center text-xs font-medium text-gray-500">{label}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {monthDates.map((date) => (
                  <DayCell
                    key={toDateKey(date)}
                    date={date}
                    events={eventsForDate(date)}
                    isCurrentMonth={isSameMonth(date, currentDate.getMonth(), currentDate.getFullYear())}
                    isSelected={selectedDate !== null && isSameDay(date, selectedDate)}
                    onSelect={handleDaySelect}
                  />
                ))}
              </div>
            </div>

            {/* Selected day event list */}
            {selectedDate && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1 px-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {selectedDate.getMonth() + 1}/{selectedDate.getDate()}（{WEEKDAY_LABELS[selectedDate.getDay()]}）
                  </h4>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => handleCreateClick(selectedDate)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      ＋ 追加
                    </button>
                  )}
                </div>
                {eventsForDate(selectedDate).length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">予定はありません</p>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                    {eventsForDate(selectedDate).map((ev) => renderEventRow(ev))}
                  </div>
                )}
              </div>
            )}

            {/* Today's events when no date selected */}
            {!selectedDate && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1 px-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    今日 {new Date().getMonth() + 1}/{new Date().getDate()}
                  </h4>
                </div>
                {eventsForDate(new Date()).length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">今日の予定はありません</p>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                    {eventsForDate(new Date()).map((ev) => renderEventRow(ev))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== WEEK VIEW ===== */}
        {viewMode === 'week' && (
          <div>
              <div className="rounded-lg border border-gray-200 bg-white">
                {/* Column headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {weekDates.map((date) => {
                    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
                    return (
                      <div
                        key={toDateKey(date)}
                        className="border-r border-gray-100 px-1 py-2 text-center last:border-r-0"
                      >
                        <p className="text-[10px] text-gray-500">{dayLabels[date.getDay()]}</p>
                        <p className="text-sm font-medium text-gray-900">{date.getDate()}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Event columns */}
                <div className="grid grid-cols-7 min-h-[12rem]">
                  {weekDates.map((date) => {
                    const dayEvents = eventsForDate(date);
                    return (
                      <div
                        key={toDateKey(date)}
                        className="border-r border-gray-100 p-1 last:border-r-0 space-y-1 cursor-pointer"
                        onClick={() => handleDaySelect(date)}
                      >
                        {dayEvents.map((ev) => (
                          <Link
                            key={ev.id}
                            href={ev.detailUrl}
                            className={`block rounded border-l-2 p-1 text-[10px] transition-colors hover:bg-gray-50 ${eventBorderColor(ev)} ${
                              ev.status === 'cancelled' ? 'opacity-60' : ''
                            }`}
                          >
                            <p className="truncate font-medium text-gray-800">{ev.title}</p>
                            <p className="truncate text-gray-500">{ev.workerName}</p>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
          {/* Incomplete items panel (below calendar) */}
          <div className="mt-4">
            <WeekSidebar
              workers={workers}
              trainingItems={trainingItems}
              completedSubtopicsByWorker={completedSubtopicsByWorker}
              sessionCountByWorkerItem={sessionCountByWorkerItem}
              ojtUsers={ojtUsers}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
            />
          </div>
          </div>
        )}

        {/* ===== DAY VIEW ===== */}
        {viewMode === 'day' && (
          <div>
            {eventsForDate(currentDate).length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-500">この日の予定はありません</p>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleCreateClick(currentDate)}
                    className="mt-3 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    予定を追加
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {eventsForDate(currentDate).map((ev) => renderEventRow(ev))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day detail panel (week view, when a day is selected on desktop) */}
      {selectedDate && viewMode === 'week' && (
        <div className="hidden sm:block">
          <div className="mb-2 flex items-center justify-between px-1">
            <h4 className="text-sm font-semibold text-gray-900">{formatDayFull(selectedDate)}</h4>
            {canCreate && (
              <button type="button" onClick={() => handleCreateClick(selectedDate)} className="text-xs font-medium text-blue-600 hover:text-blue-800">＋ 追加</button>
            )}
          </div>
          {eventsForDate(selectedDate).length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">予定はありません</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {eventsForDate(selectedDate).map((ev) => renderEventRow(ev))}
            </div>
          )}
        </div>
      )}

      {/* Mobile floating action button */}
      {canCreate && !showCreateModal && (
        <button
          type="button"
          onClick={() => handleCreateClick()}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all sm:hidden"
          title="予定追加"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreatePlanModal
          workers={workers}
          trainingItems={trainingItems}
          ojtUsers={ojtUsers}
          staff={staff}
          completedSubtopicsByWorker={completedSubtopicsByWorker}
          sessionCountByWorkerItem={sessionCountByWorkerItem}
          hoursByWorkerItem={hoursByWorkerItem}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          initialDate={
            selectedDate ? toDateKey(selectedDate) : toDateKey(new Date())
          }
          duplicateSource={duplicateSource}
          onClose={() => { setShowCreateModal(false); setDuplicateSource(null); }}
        />
      )}
    </div>
  );
}
