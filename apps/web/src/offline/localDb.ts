/**
 * Device-local store for offline-first floor ops.
 * Uses IndexedDB (works in browser + Capacitor WebView). Native SQLite can wrap the same API later.
 */

const DB_NAME = "maxwell_local";
const DB_VERSION = 1;

export type OutboxRow = {
  id?: number;
  client_id: string;
  entity: string;
  op: "upsert" | "delete";
  payload: unknown;
  updated_at: string;
  status: "pending" | "syncing" | "done" | "conflict";
  reason?: string;
};

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) {
        const os = db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
        os.createIndex("by_status", "status");
        os.createIndex("by_client", "client_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("rolls")) {
        db.createObjectStore("rolls", { keyPath: "roll_id" });
      }
      if (!db.objectStoreNames.contains("packings")) {
        db.createObjectStore("packings", { keyPath: "packing_id" });
      }
      if (!db.objectStoreNames.contains("parcels")) {
        db.createObjectStore("parcels", { keyPath: "parcel_id" });
      }
      if (!db.objectStoreNames.contains("challans")) {
        db.createObjectStore("challans", { keyPath: "challan_id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDeviceId(): Promise<string> {
  const existing = await idbGet<{ key: string; value: string }>("meta", "device_id");
  if (existing?.value) return existing.value;
  const id = crypto.randomUUID();
  await idbPut("meta", { key: "device_id", value: id });
  return id;
}

export async function getSyncCursor(): Promise<string> {
  const row = await idbGet<{ key: string; value: string }>("meta", "sync_cursor");
  return row?.value ?? "1970-01-01T00:00:00.000Z";
}

export async function setSyncCursor(iso: string) {
  await idbPut("meta", { key: "sync_cursor", value: iso });
}

function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openIdb();
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

function idbPut(store: string, value: unknown): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openIdb();
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openIdb();
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function enqueueOutbox(row: Omit<OutboxRow, "id" | "status"> & { status?: OutboxRow["status"] }) {
  const db = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").add({ ...row, status: row.status ?? "pending" });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  const all = await idbGetAll<OutboxRow>("outbox");
  return all.filter((r) => r.status === "pending" || r.status === "conflict");
}

export async function markOutbox(clientId: string, status: OutboxRow["status"], reason?: string) {
  const all = await idbGetAll<OutboxRow>("outbox");
  const row = all.find((r) => r.client_id === clientId);
  if (!row) return;
  row.status = status;
  if (reason) row.reason = reason;
  await idbPut("outbox", row);
}

export async function putLocalRoll(roll: any) {
  await idbPut("rolls", roll);
}
export async function getLocalRoll(rollId: string) {
  return idbGet<any>("rolls", rollId);
}
export async function findLocalRollByCode(code: string) {
  const all = await idbGetAll<any>("rolls");
  return all.find((r) => r.roll_id === code || r.short_code === code || r.short_code?.toUpperCase() === code.toUpperCase());
}
export async function putLocalPacking(p: any) {
  await idbPut("packings", p);
}
export async function getLocalPacking(id: string) {
  const byId = await idbGet<any>("packings", id);
  if (byId) return byId;
  const all = await idbGetAll<any>("packings");
  return all.find((p) => p.short_code === id);
}
export async function listLocalPackings() {
  return idbGetAll<any>("packings");
}
export async function putLocalParcel(p: any) {
  await idbPut("parcels", p);
}
export async function putLocalChallan(c: any) {
  await idbPut("challans", c);
}
export async function getLocalChallan(id: string) {
  const byId = await idbGet<any>("challans", id);
  if (byId) return byId;
  const all = await idbGetAll<any>("challans");
  return all.find((c) => c.challan_no === id);
}
export async function listLocalChallans() {
  return idbGetAll<any>("challans");
}

/** Apply a cut locally — returns packing immediately for print */
export async function localCutPacking(opts: {
  packing_id: string;
  parent_roll_id: string;
  length_meters: number;
  variant_code: string;
  packing_date: string;
  notes?: string;
}) {
  const roll = await getLocalRoll(opts.parent_roll_id);
  if (!roll) throw new Error("Roll not on device — sync first or scan after pull");
  if (opts.length_meters > Number(roll.remaining_meterage) + 1e-9) {
    throw new Error(`Only ${roll.remaining_meterage}m left on roll`);
  }
  const short_code = `P${opts.packing_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const packing = {
    ...opts,
    short_code,
    status: "packed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  roll.remaining_meterage = Math.max(0, Number(roll.remaining_meterage) - opts.length_meters);
  roll.status = roll.remaining_meterage <= 0.001 ? "depleted" : "in_cutting";
  roll.updated_at = new Date().toISOString();
  await putLocalRoll(roll);
  await putLocalPacking(packing);
  const device_id = await getDeviceId();
  await enqueueOutbox({
    client_id: opts.packing_id,
    entity: "packing",
    op: "upsert",
    payload: { ...packing, device_id },
    updated_at: packing.updated_at,
  });
  return packing;
}
