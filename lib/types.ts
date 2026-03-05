export type PlannerTab = "month" | "week" | "settings" | "memo";

export type CalendarSource = "user" | "pattern" | "exception";

export interface CycleItem {
  id: string;
  label: string;
  color: string;
  isOffDay: boolean;
}

export interface WorkPattern {
  id: string;
  startDate: string;
  cycleItems: CycleItem[];
  isActive: boolean;
}

export interface PatternException {
  id: string;
  date: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface Schedule {
  id: string;
  date: string;
  title: string;
  memo?: string;
  color: string;
  source: CalendarSource;
  createdAt: string;
  updatedAt: string;
  reminderAt?: string;
  notifiedAt?: string;
  deletedAt?: string;
}

export interface TrashItem {
  id: string;
  entityType: "schedule";
  entityId: string;
  payload: Schedule;
  deletedAt: string;
  purgeAt: string;
}

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  workPatterns: WorkPattern[];
  patternExceptions: PatternException[];
  schedules: Schedule[];
  trash: TrashItem[];
  settings: SettingRecord[];
}

