/** Pure date utility functions for calendar */

export function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

/** Monday-start week */
export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon=0 offset
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function getWeekDates(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Get all dates for a month calendar grid (includes padding from prev/next months) */
export function getMonthCalendarDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const start = startOfWeek(firstDay);
  // Always show 6 weeks for consistent grid height
  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isSameMonth(d: Date, month: number, year: number): boolean {
  return d.getMonth() === month && d.getFullYear() === year;
}

export function formatMonthYear(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function formatWeekRange(d: Date): string {
  const start = startOfWeek(d);
  const end = addDays(start, 6);
  const sm = start.getMonth() + 1;
  const em = end.getMonth() + 1;
  if (sm === em) {
    return `${start.getFullYear()}年${sm}月${start.getDate()}日〜${end.getDate()}日`;
  }
  return `${sm}/${start.getDate()}〜${em}/${end.getDate()}`;
}

export function formatDayFull(d: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
