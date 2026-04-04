'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
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
  trainingItems: { id: string; title: string; subtopics: { id: string; title: string }[] }[];
  ojtUsers: { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  staff: { id: string; name: string }[];
  completedSubtopicsByWorker: Record<string, string[]>;
  currentUserId: string;
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
  currentUserId,
  currentUserRole,
  canCreate,
}: ScheduleCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterWorkerId, setFilterWorkerId] = useState('');

  // Swipe state
  const touchStartX = useRef(0);
  const calendarRef = useRef<HTMLDivElement>(null);

  const filteredEvents = filterWorkerId
    ? events.filter((e) => e.workerId === filterWorkerId)
    : events;

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

  const renderEventCard = (event: CalendarEvent, compact = false) => (
    <Link
      key={event.id}
      href={event.detailUrl}
      className={`block rounded-lg border-l-4 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${eventBorderColor(event)} ${
        event.status === 'cancelled' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
            {event.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{event.workerName}</p>
          {!compact && (
            <p className="text-xs text-gray-400">
              {event.startTime && event.endTime
                ? `${event.startTime}〜${event.endTime}`
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
  );

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-300 bg-white">
          {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => {
            const labels: Record<CalendarViewMode, string> = { month: '月', week: '週', day: '日' };
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            前
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            今日
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            次
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-900">{periodLabel}</span>
        </div>

        {/* Right side: filter + create */}
        <div className="flex items-center gap-2">
          <select
            value={filterWorkerId}
            onChange={(e) => setFilterWorkerId(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
          >
            <option value="">すべて</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {canCreate && (
            <button
              type="button"
              onClick={() => handleCreateClick()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              予定追加
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid area */}
      <div
        ref={calendarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ===== MONTH VIEW ===== */}
        {viewMode === 'month' && (
          <div className="rounded-lg border border-gray-200 bg-white p-2">
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-xs font-medium text-gray-500"
                >
                  {label}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {monthDates.map((date) => (
                <DayCell
                  key={toDateKey(date)}
                  date={date}
                  events={eventsForDate(date)}
                  isCurrentMonth={isSameMonth(
                    date,
                    currentDate.getMonth(),
                    currentDate.getFullYear()
                  )}
                  isSelected={selectedDate !== null && isSameDay(date, selectedDate)}
                  onSelect={handleDaySelect}
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== WEEK VIEW ===== */}
        {viewMode === 'week' && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
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
            </div>
            {/* Side panel */}
            <div className="w-full md:w-64 flex-shrink-0">
              <WeekSidebar
                workers={workers}
                trainingItems={trainingItems}
                completedSubtopicsByWorker={completedSubtopicsByWorker}
                ojtUsers={ojtUsers}
                currentUserRole={currentUserRole}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        )}

        {/* ===== DAY VIEW ===== */}
        {viewMode === 'day' && (
          <div className="space-y-3">
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
              eventsForDate(currentDate).map((ev) => renderEventCard(ev))
            )}
          </div>
        )}
      </div>

      {/* Day detail panel (month/week view, when a day is selected) */}
      {selectedDate && viewMode !== 'day' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {formatDayFull(selectedDate)}
            </h3>
            {canCreate && (
              <button
                type="button"
                onClick={() => handleCreateClick(selectedDate)}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                追加
              </button>
            )}
          </div>
          {eventsForDate(selectedDate).length === 0 ? (
            <p className="text-xs text-gray-500">予定はありません</p>
          ) : (
            <div className="space-y-2">
              {eventsForDate(selectedDate).map((ev) => renderEventCard(ev))}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreatePlanModal
          workers={workers}
          trainingItems={trainingItems}
          ojtUsers={ojtUsers}
          staff={staff}
          completedSubtopicsByWorker={completedSubtopicsByWorker}
          currentUserId={currentUserId}
          initialDate={
            selectedDate ? toDateKey(selectedDate) : toDateKey(new Date())
          }
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
