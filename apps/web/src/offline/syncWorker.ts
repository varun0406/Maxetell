import { api } from "../lib/api";
import {
  getDeviceId,
  getSyncCursor,
  listPendingOutbox,
  markOutbox,
  putLocalChallan,
  putLocalPacking,
  putLocalParcel,
  putLocalRoll,
  setSyncCursor,
} from "./localDb";

let syncing = false;
let timer: number | null = null;

export async function runSyncOnce(): Promise<{ pushed: number; pulled: boolean; conflicts: number }> {
  if (syncing) return { pushed: 0, pulled: false, conflicts: 0 };
  syncing = true;
  let pushed = 0;
  let conflicts = 0;
  try {
    const device_id = await getDeviceId();
    const pending = await listPendingOutbox();
    if (pending.length) {
      const res = await api.post<{ data: { results: { client_id: string; status: string; reason?: string }[] } }>("/mx/sync/push", {
        device_id,
        items: pending.map((p) => ({
          client_id: p.client_id,
          entity: p.entity,
          op: p.op,
          payload: p.payload as Record<string, unknown>,
          updated_at: p.updated_at,
        })),
      });
      for (const r of res.data.data.results) {
        if (r.status === "applied") {
          await markOutbox(r.client_id, "done");
          pushed++;
        } else if (r.status === "conflict") {
          await markOutbox(r.client_id, "conflict", r.reason);
          conflicts++;
        } else {
          await markOutbox(r.client_id, "conflict", r.reason ?? "rejected");
          conflicts++;
        }
      }
    }

    const since = await getSyncCursor();
    const pull = await api.get<{ data: any }>("/mx/sync/pull", { params: { device_id, since } });
    const d = pull.data.data;
    for (const r of d.rolls ?? []) await putLocalRoll(r);
    for (const p of d.packings ?? []) await putLocalPacking(p);
    for (const p of d.parcels ?? []) await putLocalParcel(p);
    for (const c of d.challans ?? []) {
      await putLocalChallan({
        ...c,
        requirements: (d.challan_reqs ?? []).filter((r: any) => r.challan_id === c.challan_id),
        scans: (d.challan_scans ?? []).filter((s: any) => s.challan_id === c.challan_id),
      });
    }
    await setSyncCursor(d.server_time ?? new Date().toISOString());
    conflicts += (d.conflicts ?? []).length;
    return { pushed, pulled: true, conflicts };
  } catch (e) {
    console.warn("[sync] failed (offline?)", e);
    return { pushed, pulled: false, conflicts };
  } finally {
    syncing = false;
  }
}

export function startSyncWorker(intervalMs = 15000) {
  if (timer != null) return;
  void runSyncOnce();
  timer = window.setInterval(() => void runSyncOnce(), intervalMs);
  window.addEventListener("online", () => void runSyncOnce());
}

export function stopSyncWorker() {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
