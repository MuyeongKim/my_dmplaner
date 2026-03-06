import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  BackupPayload,
  PatternException,
  Schedule,
  SettingRecord,
  TrashItem,
  WorkPattern,
} from "@/lib/types";

const DB_NAME = "easy-planner-db";
const DB_VERSION = 1;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type StoreName =
  | "workPatterns"
  | "patternExceptions"
  | "schedules"
  | "trash"
  | "settings";

type SupabaseTableName =
  | "work_patterns"
  | "pattern_exceptions"
  | "schedules"
  | "trash"
  | "settings";

interface PlannerDataSnapshot {
  workPatterns: WorkPattern[];
  patternExceptions: PatternException[];
  schedules: Schedule[];
  trash: TrashItem[];
  settings: SettingRecord[];
}

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseEnabled()) {
    throw new Error("Supabase 설정이 없습니다.");
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return supabaseClient;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openPlannerDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("workPatterns")) {
        db.createObjectStore("workPatterns", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("patternExceptions")) {
        db.createObjectStore("patternExceptions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("schedules")) {
        db.createObjectStore("schedules", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("trash")) {
        db.createObjectStore("trash", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openPlannerDb();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const request = store.getAll();
  const result = await requestToPromise(request);
  await transactionToPromise(tx);
  db.close();
  return result as T[];
}

async function put<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openPlannerDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await transactionToPromise(tx);
  db.close();
}

async function remove(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openPlannerDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await transactionToPromise(tx);
  db.close();
}

async function clear(storeName: StoreName): Promise<void> {
  const db = await openPlannerDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await transactionToPromise(tx);
  db.close();
}

async function bulkPut<T>(storeName: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const db = await openPlannerDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const value of values) {
    store.put(value);
  }
  await transactionToPromise(tx);
  db.close();
}

async function supabaseSelectAll<T>(table: SupabaseTableName): Promise<T[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).select("*");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as T[];
}

async function supabaseUpsert(
  table: SupabaseTableName,
  value: unknown,
  onConflict: string,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).upsert(value, { onConflict });
  if (error) {
    throw new Error(error.message);
  }
}

async function supabaseDelete(
  table: SupabaseTableName,
  column: string,
  value: string,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).delete().eq(column, value);
  if (error) {
    throw new Error(error.message);
  }
}

async function supabaseClear(table: SupabaseTableName, keyColumn: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).delete().not(keyColumn, "is", null);
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadSnapshot(): Promise<PlannerDataSnapshot> {
  if (isSupabaseEnabled()) {
    const [workPatterns, patternExceptions, schedules, trash, settings] =
      await Promise.all([
        supabaseSelectAll<WorkPattern>("work_patterns"),
        supabaseSelectAll<PatternException>("pattern_exceptions"),
        supabaseSelectAll<Schedule>("schedules"),
        supabaseSelectAll<TrashItem>("trash"),
        supabaseSelectAll<SettingRecord>("settings"),
      ]);

    return {
      workPatterns,
      patternExceptions,
      schedules,
      trash,
      settings,
    };
  }

  const [workPatterns, patternExceptions, schedules, trash, settings] =
    await Promise.all([
      getAll<WorkPattern>("workPatterns"),
      getAll<PatternException>("patternExceptions"),
      getAll<Schedule>("schedules"),
      getAll<TrashItem>("trash"),
      getAll<SettingRecord>("settings"),
    ]);

  return {
    workPatterns,
    patternExceptions,
    schedules,
    trash,
    settings,
  };
}

export async function saveWorkPattern(pattern: WorkPattern): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseUpsert("work_patterns", pattern, "id");
    return;
  }
  await put("workPatterns", pattern);
}

export async function saveException(item: PatternException): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseUpsert("pattern_exceptions", item, "id");
    return;
  }
  await put("patternExceptions", item);
}

export async function deleteException(exceptionId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseDelete("pattern_exceptions", "id", exceptionId);
    return;
  }
  await remove("patternExceptions", exceptionId);
}

export async function saveSchedule(item: Schedule): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseUpsert("schedules", item, "id");
    return;
  }
  await put("schedules", item);
}

export async function moveScheduleToTrash(scheduleId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const client = getSupabaseClient();
    const { data: schedule, error: scheduleError } = await client
      .from("schedules")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();

    if (scheduleError) {
      throw new Error(scheduleError.message);
    }
    if (!schedule) {
      throw new Error("삭제할 일정을 찾지 못했습니다.");
    }

    const now = new Date();
    const purgeAt = new Date(now);
    purgeAt.setDate(purgeAt.getDate() + 7);

    const trashItem: TrashItem = {
      id: `trash-${schedule.id}-${now.getTime()}`,
      entityType: "schedule",
      entityId: schedule.id,
      payload: {
        ...schedule,
        deletedAt: now.toISOString(),
      },
      deletedAt: now.toISOString(),
      purgeAt: purgeAt.toISOString(),
    };

    await supabaseUpsert("trash", trashItem, "id");
    await supabaseDelete("schedules", "id", scheduleId);
    return;
  }

  const db = await openPlannerDb();
  const tx = db.transaction(["schedules", "trash"], "readwrite");
  const schedulesStore = tx.objectStore("schedules");
  const trashStore = tx.objectStore("trash");

  const schedule = (await requestToPromise(
    schedulesStore.get(scheduleId),
  )) as Schedule | undefined;

  if (!schedule) {
    db.close();
    throw new Error("삭제할 일정을 찾지 못했습니다.");
  }

  schedulesStore.delete(scheduleId);

  const now = new Date();
  const purgeAt = new Date(now);
  purgeAt.setDate(purgeAt.getDate() + 7);

  const trashItem: TrashItem = {
    id: `trash-${schedule.id}-${now.getTime()}`,
    entityType: "schedule",
    entityId: schedule.id,
    payload: {
      ...schedule,
      deletedAt: now.toISOString(),
    },
    deletedAt: now.toISOString(),
    purgeAt: purgeAt.toISOString(),
  };

  trashStore.put(trashItem);

  await transactionToPromise(tx);
  db.close();
}

export async function restoreScheduleFromTrash(trashId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const client = getSupabaseClient();
    const { data: trashItem, error: trashError } = await client
      .from("trash")
      .select("*")
      .eq("id", trashId)
      .maybeSingle();

    if (trashError) {
      throw new Error(trashError.message);
    }
    if (!trashItem) {
      throw new Error("복구할 휴지통 항목을 찾지 못했습니다.");
    }

    const restored: Schedule = {
      ...trashItem.payload,
      deletedAt: undefined,
      source: "user",
      updatedAt: new Date().toISOString(),
    };

    await supabaseUpsert("schedules", restored, "id");
    await supabaseDelete("trash", "id", trashId);
    return;
  }

  const db = await openPlannerDb();
  const tx = db.transaction(["trash", "schedules"], "readwrite");
  const trashStore = tx.objectStore("trash");
  const schedulesStore = tx.objectStore("schedules");

  const trashItem = (await requestToPromise(trashStore.get(trashId))) as
    | TrashItem
    | undefined;

  if (!trashItem) {
    db.close();
    throw new Error("복구할 휴지통 항목을 찾지 못했습니다.");
  }

  const restored: Schedule = {
    ...trashItem.payload,
    deletedAt: undefined,
    source: "user",
    updatedAt: new Date().toISOString(),
  };

  schedulesStore.put(restored);
  trashStore.delete(trashId);

  await transactionToPromise(tx);
  db.close();
}

export async function deleteTrashItem(trashId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseDelete("trash", "id", trashId);
    return;
  }
  await remove("trash", trashId);
}

export async function purgeExpiredTrash(): Promise<void> {
  if (isSupabaseEnabled()) {
    const client = getSupabaseClient();
    const { error } = await client
      .from("trash")
      .delete()
      .lte("purgeAt", new Date().toISOString());
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const db = await openPlannerDb();
  const tx = db.transaction("trash", "readwrite");
  const store = tx.objectStore("trash");
  const items = (await requestToPromise(store.getAll())) as TrashItem[];
  const now = Date.now();

  for (const item of items) {
    if (new Date(item.purgeAt).getTime() <= now) {
      store.delete(item.id);
    }
  }

  await transactionToPromise(tx);
  db.close();
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseUpsert("settings", { key, value } satisfies SettingRecord<T>, "key");
    return;
  }
  await put("settings", { key, value } satisfies SettingRecord<T>);
}

export async function replaceAllData(payload: BackupPayload): Promise<void> {
  if (isSupabaseEnabled()) {
    await Promise.all([
      supabaseClear("work_patterns", "id"),
      supabaseClear("pattern_exceptions", "id"),
      supabaseClear("schedules", "id"),
      supabaseClear("trash", "id"),
      supabaseClear("settings", "key"),
    ]);

    await Promise.all([
      payload.workPatterns.length > 0
        ? supabaseUpsert("work_patterns", payload.workPatterns, "id")
        : Promise.resolve(),
      payload.patternExceptions.length > 0
        ? supabaseUpsert("pattern_exceptions", payload.patternExceptions, "id")
        : Promise.resolve(),
      payload.schedules.length > 0
        ? supabaseUpsert("schedules", payload.schedules, "id")
        : Promise.resolve(),
      payload.trash.length > 0
        ? supabaseUpsert("trash", payload.trash, "id")
        : Promise.resolve(),
      payload.settings.length > 0
        ? supabaseUpsert("settings", payload.settings, "key")
        : Promise.resolve(),
    ]);
    return;
  }

  await Promise.all([
    clear("workPatterns"),
    clear("patternExceptions"),
    clear("schedules"),
    clear("trash"),
    clear("settings"),
  ]);

  await Promise.all([
    bulkPut("workPatterns", payload.workPatterns),
    bulkPut("patternExceptions", payload.patternExceptions),
    bulkPut("schedules", payload.schedules),
    bulkPut("trash", payload.trash),
    bulkPut("settings", payload.settings),
  ]);
}

export async function exportBackupPayload(): Promise<BackupPayload> {
  const snapshot = await loadSnapshot();

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workPatterns: snapshot.workPatterns,
    patternExceptions: snapshot.patternExceptions,
    schedules: snapshot.schedules,
    trash: snapshot.trash,
    settings: snapshot.settings,
  };
}
