"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  buildMonthGrid,
  buildWeekRange,
  createId,
  createTodayKey,
  fromDateKey,
  getDateHeadline,
  getMonthLabel,
  getPatternForDate,
  toDateKey,
} from "@/lib/calendar";
import {
  deleteException,
  deleteTrashItem,
  exportBackupPayload,
  loadSnapshot,
  moveScheduleToTrash,
  purgeExpiredTrash,
  replaceAllData,
  restoreScheduleFromTrash,
  saveException,
  saveSchedule,
  saveWorkPattern,
  setSetting,
} from "@/lib/idb";
import {
  BackupPayload,
  CycleItem,
  PatternException,
  PlannerTab,
  Schedule,
  TrashItem,
  WorkPattern,
} from "@/lib/types";

const EVENT_COLORS = ["#2b6cb0", "#0f766e", "#c2410c", "#7e22ce", "#be185d", "#166534"];
const PATTERN_COLORS = ["#4c6e3b", "#4f86c6", "#ea580c", "#7d8597"];
const WEEKDAY = ["월", "화", "수", "목", "금", "토", "일"];

type ScheduleForm = {
  id?: string;
  date: string;
  title: string;
  memo: string;
  color: string;
  reminderEnabled: boolean;
  reminderAt: string;
};

type ExceptionForm = {
  id?: string;
  date: string;
  label: string;
  color: string;
  enabled: boolean;
};

function defaultCycle(): CycleItem[] {
  return [
    { id: createId("cycle"), label: "D", color: PATTERN_COLORS[0], isOffDay: false },
    { id: createId("cycle"), label: "E", color: PATTERN_COLORS[1], isOffDay: false },
    { id: createId("cycle"), label: "N", color: PATTERN_COLORS[2], isOffDay: false },
    { id: createId("cycle"), label: "휴무", color: PATTERN_COLORS[3], isOffDay: true },
  ];
}

function sortSchedules(items: Schedule[]): Schedule[] {
  return [...items].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

function reverseRecent(items: Schedule[]): Schedule[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateTimeLocalValue(iso?: string): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatReminderLabel(iso?: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type IconProps = {
  className?: string;
};

function SearchIcon({ className = "ui-icon" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
  );
}

function TargetIcon({ className = "ui-icon" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function PlusIcon({ className = "ui-icon" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MenuIcon({ className = "ui-icon" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function ChevronIcon({ className = "ui-icon", direction = "left" }: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {direction === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

function ChevronsIcon({ className = "ui-icon", direction = "left" }: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {direction === "left" ? (
        <>
          <polyline points="13 17 8 12 13 7" />
          <polyline points="18 17 13 12 18 7" />
        </>
      ) : (
        <>
          <polyline points="6 17 11 12 6 7" />
          <polyline points="11 17 16 12 11 7" />
        </>
      )}
    </svg>
  );
}

export default function HomePage() {
  const todayKey = createTodayKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  const [tab, setTab] = useState<PlannerTab>("month");
  const [currentMonth, setCurrentMonth] = useState(fromDateKey(todayKey));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const [topMode, setTopMode] = useState<"solution" | "personal" | "work">("personal");
  const [rangeMode, setRangeMode] = useState<"month" | "3day">("month");

  const [pattern, setPattern] = useState<WorkPattern | null>(null);
  const [cycleItems, setCycleItems] = useState<CycleItem[]>(defaultCycle);
  const [startDate, setStartDate] = useState(todayKey);

  const [exceptions, setExceptions] = useState<PatternException[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    date: todayKey,
    title: "",
    memo: "",
    color: EVENT_COLORS[0],
    reminderEnabled: false,
    reminderAt: "",
  });

  const [exceptionForm, setExceptionForm] = useState<ExceptionForm>({
    date: todayKey,
    label: "",
    color: PATTERN_COLORS[0],
    enabled: true,
  });

  const [memoDraft, setMemoDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async (spin = false) => {
    if (spin) setLoading(true);

    try {
      await purgeExpiredTrash();
      const snapshot = await loadSnapshot();
      const settingsMap = new Map(snapshot.settings.map((item) => [item.key, item.value]));

      const active =
        snapshot.workPatterns.find((item) => item.isActive) ?? snapshot.workPatterns[0] ?? null;

      setPattern(active);
      if (active) {
        setCycleItems(active.cycleItems);
        setStartDate(active.startDate);
      }

      const savedTopMode = settingsMap.get("ui:topMode");
      if (savedTopMode === "solution" || savedTopMode === "personal" || savedTopMode === "work") {
        setTopMode(savedTopMode);
      }

      const savedRangeMode = settingsMap.get("ui:rangeMode");
      if (savedRangeMode === "month" || savedRangeMode === "3day") {
        setRangeMode(savedRangeMode);
      }

      const savedTab = settingsMap.get("ui:tab");
      if (savedTab === "month" || savedTab === "week" || savedTab === "settings" || savedTab === "memo") {
        setTab(savedTab);
      }

      const savedDate = settingsMap.get("ui:lastDate");
      if (isDateKey(savedDate)) {
        setSelectedDate(savedDate);
        setCurrentMonth(fromDateKey(savedDate));
      }

      setExceptions(snapshot.patternExceptions);
      setSchedules(snapshot.schedules.filter((item) => !item.deletedAt));
      setTrash([...snapshot.trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));

      const memoEntries = snapshot.settings
        .filter((item) => item.key.startsWith("memo:"))
        .map((item) => [item.key.replace("memo:", ""), String(item.value ?? "")]);
      setMemos(Object.fromEntries(memoEntries));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "데이터를 불러오지 못했습니다.");
    } finally {
      if (spin) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    setMemoDraft(memos[selectedDate] ?? "");
  }, [memos, selectedDate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // no-op
      });
    }

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }

    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    setSetting("ui:topMode", topMode).catch(() => {
      // no-op
    });
  }, [topMode]);

  useEffect(() => {
    setSetting("ui:rangeMode", rangeMode).catch(() => {
      // no-op
    });
  }, [rangeMode]);

  useEffect(() => {
    setSetting("ui:tab", tab).catch(() => {
      // no-op
    });
  }, [tab]);

  useEffect(() => {
    setSetting("ui:lastDate", selectedDate).catch(() => {
      // no-op
    });
  }, [selectedDate]);

  const monthCells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const weekDates = useMemo(() => buildWeekRange(selectedDate), [selectedDate]);

  const threeDayDates = useMemo(() => {
    const base = fromDateKey(selectedDate);
    return [addDays(base, -1), base, addDays(base, 1)];
  }, [selectedDate]);

  const selectedPattern = useMemo(
    () => getPatternForDate(pattern, exceptions, selectedDate),
    [pattern, exceptions, selectedDate],
  );

  const selectedSchedules = useMemo(
    () => sortSchedules(schedules.filter((item) => item.date === selectedDate)),
    [schedules, selectedDate],
  );

  const selectedException = useMemo(
    () => exceptions.find((item) => item.date === selectedDate && item.enabled),
    [exceptions, selectedDate],
  );

  const selectedDateObj = useMemo(() => fromDateKey(selectedDate), [selectedDate]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return reverseRecent(
      schedules.filter((item) => {
        const title = item.title.toLowerCase();
        const memo = (item.memo ?? "").toLowerCase();
        return title.includes(q) || memo.includes(q);
      }),
    ).slice(0, 80);
  }, [searchQuery, schedules]);

  const savePatternConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cycleItems.length || cycleItems.some((item) => !item.label.trim())) {
      setError("근무패턴 라벨을 모두 입력해주세요.");
      return;
    }

    const updated: WorkPattern = {
      id: pattern?.id ?? createId("pattern"),
      startDate,
      cycleItems,
      isActive: true,
    };

    await saveWorkPattern(updated);
    await setSetting("app:configured", true);
    setPattern(updated);
    await refresh();
  };

  const openAddSchedule = (date = selectedDate) => {
    setScheduleForm({
      id: undefined,
      date,
      title: "",
      memo: "",
      color: EVENT_COLORS[0],
      reminderEnabled: false,
      reminderAt: "",
    });
    setShowScheduleModal(true);
  };

  const openEditSchedule = (schedule: Schedule) => {
    setScheduleForm({
      id: schedule.id,
      date: schedule.date,
      title: schedule.title,
      memo: schedule.memo ?? "",
      color: schedule.color,
      reminderEnabled: Boolean(schedule.reminderAt),
      reminderAt: toDateTimeLocalValue(schedule.reminderAt),
    });
    setShowScheduleModal(true);
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = scheduleForm.title.trim();
    if (!title) {
      setError("일정 제목은 필수입니다.");
      return;
    }

    const now = new Date().toISOString();
    const existing = scheduleForm.id
      ? schedules.find((item) => item.id === scheduleForm.id)
      : undefined;
    const createdAt = existing?.createdAt ?? now;

    const reminderAt =
      scheduleForm.reminderEnabled && scheduleForm.reminderAt
        ? new Date(scheduleForm.reminderAt).toISOString()
        : undefined;

    await saveSchedule({
      id: scheduleForm.id ?? createId("schedule"),
      date: scheduleForm.date,
      title,
      memo: scheduleForm.memo.trim() || undefined,
      color: scheduleForm.color,
      source: "user",
      createdAt,
      updatedAt: now,
      reminderAt,
      notifiedAt: existing?.reminderAt === reminderAt ? existing?.notifiedAt : undefined,
    });

    setShowScheduleModal(false);
    setSelectedDate(scheduleForm.date);
    setCurrentMonth(fromDateKey(scheduleForm.date));
    await refresh();
  };

  const deleteSchedule = async () => {
    if (!scheduleForm.id) return;
    if (!window.confirm("이 일정을 휴지통으로 이동할까요?")) return;
    await moveScheduleToTrash(scheduleForm.id);
    setShowScheduleModal(false);
    await refresh();
  };

  const openExceptionEditor = () => {
    if (selectedException) {
      setExceptionForm({
        id: selectedException.id,
        date: selectedException.date,
        label: selectedException.label,
        color: selectedException.color,
        enabled: selectedException.enabled,
      });
    } else {
      setExceptionForm({ date: selectedDate, label: "", color: PATTERN_COLORS[0], enabled: true });
    }
    setShowExceptionModal(true);
  };

  const submitException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!exceptionForm.label.trim()) {
      setError("예외 라벨을 입력해주세요.");
      return;
    }

    await saveException({
      id: exceptionForm.id ?? createId("exception"),
      date: exceptionForm.date,
      label: exceptionForm.label.trim(),
      color: exceptionForm.color,
      enabled: exceptionForm.enabled,
    });

    setShowExceptionModal(false);
    await refresh();
  };

  const removeExceptionAction = async () => {
    if (!exceptionForm.id) return;
    await deleteException(exceptionForm.id);
    setShowExceptionModal(false);
    await refresh();
  };

  const exportBackup = async () => {
    const payload = await exportBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `easy-planner-backup-${todayKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text()) as BackupPayload;
      if (payload.schemaVersion !== 1) {
        throw new Error("지원하지 않는 백업 파일입니다.");
      }
      await replaceAllData(payload);
      await refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "백업 복원 실패");
    } finally {
      event.target.value = "";
    }
  };

  const saveMemo = async () => {
    await setSetting(`memo:${selectedDate}`, memoDraft);
    setMemos((prev) => ({ ...prev, [selectedDate]: memoDraft }));
  };

  const moveCycle = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cycleItems.length) return;
    const copied = [...cycleItems];
    [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
    setCycleItems(copied);
  };

  const addCycleItem = () => {
    setCycleItems((prev) => [
      ...prev,
      {
        id: createId("cycle"),
        label: "",
        color: PATTERN_COLORS[prev.length % PATTERN_COLORS.length],
        isOffDay: false,
      },
    ]);
  };

  const updateCycleItem = (id: string, field: keyof CycleItem, value: string | boolean) => {
    setCycleItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeCycleItem = (id: string) => {
    if (cycleItems.length <= 1) return;
    setCycleItems((prev) => prev.filter((item) => item.id !== id));
  };

  const restoreTrash = async (trashId: string) => {
    await restoreScheduleFromTrash(trashId);
    await refresh();
  };

  const deleteTrash = async (trashId: string) => {
    if (!window.confirm("이 항목을 영구 삭제할까요?")) return;
    await deleteTrashItem(trashId);
    await refresh();
  };

  const goToday = () => {
    const now = new Date();
    const nowKey = toDateKey(now);
    setCurrentMonth(now);
    setSelectedDate(nowKey);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setError("이 브라우저에서는 알림을 지원하지 않습니다.");
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result !== "granted") {
      setError("알림 권한이 허용되지 않았습니다.");
      return;
    }
    setError(null);
  };

  const sendTestNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("이 브라우저에서는 알림을 지원하지 않습니다.");
      return;
    }
    if (Notification.permission !== "granted") {
      setError("먼저 알림 권한을 허용해주세요.");
      return;
    }

    new Notification("Easy Planner 테스트 알림", {
      body: "브라우저 로컬 알림이 정상 작동합니다.",
    });
    setError(null);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }

    const timer = window.setInterval(async () => {
      const now = Date.now();
      const due = schedules.filter((item) => {
        if (!item.reminderAt) {
          return false;
        }
        const reminderTs = new Date(item.reminderAt).getTime();
        if (Number.isNaN(reminderTs)) {
          return false;
        }
        const alreadyNotified =
          item.notifiedAt && new Date(item.notifiedAt).getTime() >= reminderTs;
        return reminderTs <= now && !alreadyNotified;
      });

      if (due.length === 0) {
        return;
      }

      for (const item of due) {
        new Notification(`일정 알림: ${item.title}`, {
          body: `${item.date}${item.memo ? ` · ${item.memo}` : ""}`,
        });

        await saveSchedule({
          ...item,
          notifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await refresh();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [schedules, refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        setShowSearchModal(true);
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setScheduleForm({
          id: undefined,
          date: selectedDate,
          title: "",
          memo: "",
          color: EVENT_COLORS[0],
          reminderEnabled: false,
          reminderAt: "",
        });
        setShowScheduleModal(true);
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        goToday();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDate]);

  if (loading) {
    return <main className="loading-screen">불러오는 중...</main>;
  }

  return (
    <main className="planner-shell">
      <section className="planner-card">
        <section className="legacy-topbar" aria-label="모드">
          <div className="legacy-tabs">
            <button type="button" className={`legacy-tab ${topMode === "solution" ? "active" : ""}`} onClick={() => setTopMode("solution")}>문제해결</button>
            <button type="button" className={`legacy-tab ${topMode === "personal" ? "active" : ""}`} onClick={() => setTopMode("personal")}>개인용</button>
            <button type="button" className={`legacy-tab ${topMode === "work" ? "active" : ""}`} onClick={() => setTopMode("work")}>업무용</button>
            <button type="button" className={`legacy-tab pill ${rangeMode === "3day" ? "active" : ""}`} onClick={() => setRangeMode((prev) => (prev === "month" ? "3day" : "month"))}>3일</button>
          </div>
          <button type="button" className="search-icon" aria-label="검색" onClick={() => setShowSearchModal(true)}><SearchIcon /></button>
        </section>

        <header className="planner-header">
          <div className="month-side">
            <button type="button" className="month-nav" onClick={() => setCurrentMonth(addDays(currentMonth, -62))}><ChevronsIcon className="month-nav-icon" direction="left" /></button>
            <button type="button" className="month-nav" onClick={() => setCurrentMonth(addDays(currentMonth, -31))}><ChevronIcon className="month-nav-icon" direction="left" /></button>
          </div>
          <div className="month-title-wrap">
            <p className="month-title">{getMonthLabel(currentMonth).replace(". ", ".")}</p>
            <button type="button" className="today-btn" onClick={goToday}>오늘</button>
          </div>
          <div className="month-side right">
            <button type="button" className="month-nav" onClick={() => setCurrentMonth(addDays(currentMonth, 31))}><ChevronIcon className="month-nav-icon" direction="right" /></button>
            <button type="button" className="month-nav" onClick={() => setCurrentMonth(addDays(currentMonth, 62))}><ChevronsIcon className="month-nav-icon" direction="right" /></button>
          </div>
        </header>

        <section className="date-hero">
          <p className="hero-day">{selectedDateObj.getDate()}</p>
          <div className="hero-copy">
            <p className="hero-line">{getDateHeadline(selectedDate)}</p>
            <p className="hero-sub">{selectedPattern ? `근무 ${selectedPattern.label}` : "근무패턴 없음"} · 일정 {selectedSchedules.length}건</p>
          </div>
        </section>

        <section className="summary-row">
          <div className="summary-actions">
            <button type="button" className="chip-btn" onClick={() => openAddSchedule(selectedDate)}>일정 등록</button>
            <button type="button" className="chip-btn" onClick={openExceptionEditor}>패턴 예외</button>
          </div>
          <div className={`status-pill ${isOnline ? "online" : "offline"}`}>{isOnline ? "온라인" : "오프라인"}</div>
        </section>

        <p className="shortcut-hint">단축키: <kbd>/</kbd> 검색, <kbd>N</kbd> 일정 등록, <kbd>T</kbd> 오늘</p>

        {error && <p className="error-banner">{error}</p>}

        {(!pattern || tab === "settings") && (
          <section className="panel">
            <h2>{pattern ? "근무패턴 편집" : "초기 근무패턴 설정"}</h2>
            <form className="stack" onSubmit={savePatternConfig}>
              <label className="field">
                <span>시작일</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              </label>

              <div className="stack cycle-list">
                {cycleItems.map((item, index) => (
                  <div key={item.id} className="cycle-item">
                    <input
                      value={item.label}
                      onChange={(event) => updateCycleItem(item.id, "label", event.target.value)}
                      placeholder={`항목 ${index + 1}`}
                      required
                    />
                    <input
                      type="color"
                      value={item.color}
                      onChange={(event) => updateCycleItem(item.id, "color", event.target.value)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={item.isOffDay}
                        onChange={(event) => updateCycleItem(item.id, "isOffDay", event.target.checked)}
                      />
                      휴무
                    </label>
                    <button type="button" onClick={() => moveCycle(index, -1)}>↑</button>
                    <button type="button" onClick={() => moveCycle(index, 1)}>↓</button>
                    <button type="button" onClick={() => removeCycleItem(item.id)}>삭제</button>
                  </div>
                ))}
              </div>

              <div className="inline-actions">
                <button type="button" onClick={addCycleItem}>항목 추가</button>
                <button type="submit">패턴 저장</button>
              </div>
            </form>
          </section>
        )}

        {pattern && tab === "month" && rangeMode === "month" && (
          <section className="panel calendar-panel">
            <div className="calendar-headline">
              <span className="alarm-chip">⏰</span>
              <span className="calendar-caption">월</span>
              <span className="calendar-note">[월 전용 메모]</span>
            </div>
            <div className="weekday-row">
              {WEEKDAY.map((label, idx) => (
                <span key={label} className={idx === 5 ? "sat" : idx === 6 ? "sun" : ""}>{label}</span>
              ))}
            </div>
            <div className="month-grid">
              {monthCells.map((cell) => {
                const dateKey = toDateKey(cell.date);
                const dayPattern = getPatternForDate(pattern, exceptions, dateKey);
                const daySchedules = sortSchedules(schedules.filter((item) => item.date === dateKey));
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === todayKey;
                const dayOfWeek = cell.date.getDay();

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`day-cell ${cell.inCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${dayOfWeek === 6 ? "sat" : ""} ${dayOfWeek === 0 ? "sun" : ""}`}
                    onClick={() => setSelectedDate(dateKey)}
                    onDoubleClick={() => openAddSchedule(dateKey)}
                  >
                    <span className="day-number">{cell.date.getDate()}</span>
                    {dayPattern && (
                      <span className="badge pattern" style={{ borderColor: dayPattern.color, color: dayPattern.color }}>
                        {dayPattern.label}
                      </span>
                    )}
                    {daySchedules.slice(0, 2).map((item) => (
                      <span key={item.id} className="badge schedule" style={{ backgroundColor: item.color }}>
                        {item.title}
                      </span>
                    ))}
                    {daySchedules.length > 2 && <span className="more-count">+{daySchedules.length - 2}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {pattern && tab === "month" && rangeMode === "3day" && (
          <section className="panel stack">
            <h3>3일 보기</h3>
            <div className="three-day-grid">
              {threeDayDates.map((date) => {
                const key = toDateKey(date);
                const dayPattern = getPatternForDate(pattern, exceptions, key);
                const daySchedules = sortSchedules(schedules.filter((item) => item.date === key));
                return (
                  <button key={key} type="button" className={`three-day-card ${key === selectedDate ? "selected" : ""}`} onClick={() => setSelectedDate(key)}>
                    <strong>{new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(date)}</strong>
                    <span>{dayPattern ? `근무 ${dayPattern.label}` : "근무패턴 없음"}</span>
                    <span>일정 {daySchedules.length}건</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {pattern && tab === "week" && (
          <section className="panel week-view">
            {weekDates.map((date) => {
              const dateKey = toDateKey(date);
              const dayPattern = getPatternForDate(pattern, exceptions, dateKey);
              const daySchedules = sortSchedules(schedules.filter((item) => item.date === dateKey));

              return (
                <article key={dateKey} className={`week-card ${dateKey === selectedDate ? "selected" : ""}`} onClick={() => setSelectedDate(dateKey)}>
                  <div className="week-head">
                    <strong>{new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(date)}</strong>
                    {dayPattern && <span style={{ color: dayPattern.color }}>{dayPattern.label}</span>}
                  </div>
                  <div className="week-items">
                    {daySchedules.length ? (
                      daySchedules.map((item) => (
                        <button key={item.id} type="button" className="week-schedule" onClick={() => openEditSchedule(item)}>
                          <span className="dot" style={{ backgroundColor: item.color }} />
                          {item.title}
                        </button>
                      ))
                    ) : (
                      <p className="empty">등록된 일정 없음</p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {tab === "settings" && (
          <section className="panel stack">
            <h3>데이터 관리</h3>
            <div className="inline-actions">
              <button type="button" onClick={exportBackup}>JSON 내보내기</button>
              <label className="file-btn">
                JSON 복원
                <input type="file" accept="application/json" onChange={importBackup} />
              </label>
            </div>

            <h3>알림 설정</h3>
            <div className="notification-panel">
              <p>
                권한 상태: <strong>{notificationPermission === "unsupported" ? "지원 안됨" : notificationPermission}</strong>
              </p>
              <div className="inline-actions">
                <button type="button" onClick={requestNotificationPermission}>권한 요청</button>
                <button type="button" onClick={sendTestNotification}>테스트 알림</button>
              </div>
            </div>

            <h3>휴지통 (7일 보관)</h3>
            {trash.length === 0 && <p className="empty">휴지통이 비어있습니다.</p>}
            {trash.map((item) => (
              <div key={item.id} className="trash-item">
                <div>
                  <strong>{item.payload.title}</strong>
                  <p>{item.payload.date} · 삭제 {new Intl.DateTimeFormat("ko-KR").format(new Date(item.deletedAt))}</p>
                </div>
                <div className="inline-actions">
                  <button type="button" onClick={() => restoreTrash(item.id)}>복구</button>
                  <button type="button" onClick={() => deleteTrash(item.id)}>영구삭제</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "memo" && (
          <section className="panel stack">
            <h3>{getDateHeadline(selectedDate)} 메모</h3>
            <textarea
              value={memoDraft}
              onChange={(event) => setMemoDraft(event.target.value)}
              rows={8}
              placeholder="필요한 메모를 남겨두세요"
            />
            <button type="button" onClick={saveMemo}>메모 저장</button>
          </section>
        )}

        {tab !== "settings" && pattern && selectedSchedules.length > 0 && (
          <section className="panel stack compact">
            <h3>선택 날짜 일정</h3>
            {selectedSchedules.map((item) => (
              <button key={item.id} type="button" className="schedule-list-item" onClick={() => openEditSchedule(item)}>
                <span className="dot" style={{ backgroundColor: item.color }} />
                <span>{item.title}</span>
                {item.reminderAt && <small className="reminder-label">⏰ {formatReminderLabel(item.reminderAt)}</small>}
              </button>
            ))}
          </section>
        )}
      </section>

      <div className="quick-dock" role="toolbar" aria-label="빠른 작업">
        <button type="button" onClick={() => setShowSearchModal(true)}>
          <SearchIcon className="dock-icon" />
          <small>검색</small>
        </button>
        <button type="button" onClick={goToday}>
          <TargetIcon className="dock-icon" />
          <small>오늘</small>
        </button>
        <button type="button" onClick={() => openAddSchedule(selectedDate)}>
          <PlusIcon className="dock-icon" />
          <small>등록</small>
        </button>
        <button type="button" onClick={() => setTab("settings")}>
          <MenuIcon className="dock-icon" />
          <small>설정</small>
        </button>
      </div>

      <nav className="bottom-tabs">
  <button type="button" className="meta-tab" onClick={() => setShowSearchModal(true)}>*공지</button>
  <button
    type="button"
    className={tab === "month" && rangeMode === "month" ? "active" : ""}
    onClick={() => {
      setTab("month");
      setRangeMode("month");
    }}
  >
    월
  </button>
  <button
    type="button"
    className={tab === "week" ? "active" : ""}
    onClick={() => setTab("week")}
  >
    주
  </button>
  <button
    type="button"
    className={tab === "month" && rangeMode === "3day" ? "active" : ""}
    onClick={() => {
      setTab("month");
      setRangeMode("3day");
    }}
  >
    일
  </button>
  <button
    type="button"
    className={tab === "settings" ? "active" : ""}
    onClick={() => setTab("settings")}
  >
    설정
  </button>
  <button
    type="button"
    className={tab === "memo" ? "active" : ""}
    onClick={() => setTab("memo")}
  >
    메모
  </button>
</nav>

      {tab !== "settings" && pattern && (
        <button type="button" className="fab" onClick={() => openAddSchedule(selectedDate)} aria-label="일정 추가">
          <PlusIcon className="fab-icon" />
        </button>
      )}

      {showScheduleModal && (
        <div className="modal-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>{scheduleForm.id ? "일정 수정" : "일정 등록"}</h3>
            <form className="stack" onSubmit={submitSchedule}>
              <label className="field">
                <span>제목</span>
                <input
                  value={scheduleForm.title}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>날짜</span>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>메모</span>
                <textarea
                  rows={3}
                  value={scheduleForm.memo}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, memo: event.target.value }))}
                />
              </label>
              <label className="field checkbox-field">
                <span>
                  <input
                    type="checkbox"
                    checked={scheduleForm.reminderEnabled}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        reminderEnabled: event.target.checked,
                        reminderAt: event.target.checked ? prev.reminderAt : "",
                      }))
                    }
                  />
                  알림 사용
                </span>
              </label>
              {scheduleForm.reminderEnabled && (
                <label className="field">
                  <span>알림 시각</span>
                  <input
                    type="datetime-local"
                    value={scheduleForm.reminderAt}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, reminderAt: event.target.value }))
                    }
                  />
                </label>
              )}
              <div className="palette-row">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`palette-dot ${scheduleForm.color === color ? "active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setScheduleForm((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
              <div className="inline-actions">
                {scheduleForm.id && (
                  <button type="button" onClick={deleteSchedule}>삭제</button>
                )}
                <button type="button" onClick={() => setShowScheduleModal(false)}>취소</button>
                <button type="submit">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExceptionModal && (
        <div className="modal-backdrop" onClick={() => setShowExceptionModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>패턴 예외 설정</h3>
            <form className="stack" onSubmit={submitException}>
              <label className="field">
                <span>날짜</span>
                <input
                  type="date"
                  value={exceptionForm.date}
                  onChange={(event) => setExceptionForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>라벨</span>
                <input
                  value={exceptionForm.label}
                  onChange={(event) => setExceptionForm((prev) => ({ ...prev, label: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>색상</span>
                <input
                  type="color"
                  value={exceptionForm.color}
                  onChange={(event) => setExceptionForm((prev) => ({ ...prev, color: event.target.value }))}
                />
              </label>
              <div className="inline-actions">
                {exceptionForm.id && (
                  <button type="button" onClick={removeExceptionAction}>예외 해제</button>
                )}
                <button type="button" onClick={() => setShowExceptionModal(false)}>취소</button>
                <button type="submit">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSearchModal && (
        <div className="modal-backdrop" onClick={() => setShowSearchModal(false)}>
          <div className="modal search-modal" onClick={(event) => event.stopPropagation()}>
            <h3>일정 검색</h3>
            <input
              autoFocus
              placeholder="제목 또는 메모"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="search-results">
              {searchQuery.trim().length === 0 && <p className="empty">검색어를 입력하세요.</p>}
              {searchQuery.trim().length > 0 && searchResults.length === 0 && <p className="empty">검색 결과가 없습니다.</p>}
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-item"
                  onClick={() => {
                    setSelectedDate(item.date);
                    setCurrentMonth(fromDateKey(item.date));
                    setShowSearchModal(false);
                    openEditSchedule(item);
                  }}
                >
                  <span className="dot" style={{ backgroundColor: item.color }} />
                  <strong>{item.title}</strong>
                  <small>{item.date}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

















