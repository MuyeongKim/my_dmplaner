import { PatternException, WorkPattern } from "@/lib/types";

export interface DayCell {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
}

const SEOUL_LOCALE = "ko-KR";

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(SEOUL_LOCALE, {
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function getDateHeadline(dateKey: string): string {
  return new Intl.DateTimeFormat(SEOUL_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(fromDateKey(dateKey));
}

export function getDayNumber(date: Date): number {
  return date.getDate();
}

export function isSameDate(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function mondayStartIndex(day: number): number {
  return (day + 6) % 7;
}

export function buildMonthGrid(monthDate: Date): DayCell[] {
  const first = startOfMonth(monthDate);
  const startOffset = mondayStartIndex(first.getDay());
  const gridStart = addDays(first, -startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      key: toDateKey(date),
      date,
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

export function buildWeekRange(baseDateKey: string): Date[] {
  const date = fromDateKey(baseDateKey);
  const offset = mondayStartIndex(date.getDay());
  const monday = addDays(date, -offset);

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function getPatternForDate(
  pattern: WorkPattern | null,
  exceptions: PatternException[],
  dateKey: string,
): { label: string; color: string; source: "pattern" | "exception" } | null {
  const matchedException = exceptions.find(
    (item) => item.date === dateKey && item.enabled,
  );
  if (matchedException) {
    return {
      label: matchedException.label,
      color: matchedException.color,
      source: "exception",
    };
  }

  if (!pattern || pattern.cycleItems.length === 0) {
    return null;
  }

  const target = fromDateKey(dateKey);
  const start = fromDateKey(pattern.startDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((target.getTime() - start.getTime()) / msPerDay);
  const cycleLength = pattern.cycleItems.length;
  const normalizedIndex = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  const cycleItem = pattern.cycleItems[normalizedIndex];

  return {
    label: cycleItem.label,
    color: cycleItem.color,
    source: "pattern",
  };
}

export function createTodayKey(): string {
  return toDateKey(new Date());
}
