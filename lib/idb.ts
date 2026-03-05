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

type StoreName =
  | "workPatterns"
  | "patternExceptions"
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

export async function loadSnapshot(): Promise<PlannerDataSnapshot> {
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
  await put("workPatterns", pattern);
}

export async function saveException(item: PatternException): Promise<void> {
  await put("patternExceptions", item);
}

export async function deleteException(exceptionId: string): Promise<void> {
  await remove("patternExceptions", exceptionId);
}

export async function saveSchedule(item: Schedule): Promise<void> {
  await put("schedules", item);
}

export async function moveScheduleToTrash(scheduleId: string): Promise<void> {
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
  await remove("trash", trashId);
}

export async function purgeExpiredTrash(): Promise<void> {
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
  await put("settings", { key, value } satisfies SettingRecord<T>);
}

export async function replaceAllData(payload: BackupPayload): Promise<void> {
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
