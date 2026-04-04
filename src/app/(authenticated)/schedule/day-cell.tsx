'use client';

import type { CalendarEvent } from '@/lib/types';
import { isToday, isSameDay } from '@/lib/date-utils';

interface DayCellProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

function eventDotColor(event: CalendarEvent): string {
  if (event.status === 'cancelled') return 'bg-gray-300';
  if (event.type === 'ojt') return 'bg-green-500';
  return 'bg-blue-500';
}

export default function DayCell({
  date,
  events,
  isCurrentMonth,
  isSelected,
  onSelect,
}: DayCellProps) {
  const today = isToday(date);
  const dayNumber = date.getDate();
  const maxDots = 3;
  const visibleEvents = events.slice(0, maxDots);
  const extraCount = events.length - maxDots;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={`flex flex-col items-center gap-0.5 rounded-lg p-1 text-center transition-colors min-h-[3rem] w-full ${
        isSelected
          ? 'bg-blue-100 ring-1 ring-blue-400'
          : 'hover:bg-gray-100'
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
          today
            ? 'bg-blue-600 text-white'
            : isCurrentMonth
              ? 'text-gray-900'
              : 'text-gray-400'
        }`}
      >
        {dayNumber}
      </span>
      <div className="flex items-center gap-0.5">
        {visibleEvents.map((ev) => (
          <span
            key={ev.id}
            className={`h-1.5 w-1.5 rounded-full ${eventDotColor(ev)}`}
          />
        ))}
        {extraCount > 0 && (
          <span className="text-[9px] leading-none text-gray-500">
            +{extraCount}
          </span>
        )}
      </div>
    </button>
  );
}
