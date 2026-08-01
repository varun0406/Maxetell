import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";
import { applyCutPacking } from "./packing.js";
import { applyParcelCreate } from "./parcels.js";
import { applyChallanScan } from "./challans.js";

function nowIso() {
  return new Date().toISOString();
}

function recordConflict(
  db: Db,
  opts: { entity: string; client_id: string; device_id?: string; local_payload: unknown; server_payload?: unknown; reason: string },
) {
  db.prepare(
    `
    INSERT INTO mx_sync_conflicts(entity, client_id, device_id, local_payload, server_payload, reason, status)
    VALUES (?,?,?,?,?,?,'open')
  `,
  ).run(
    opts.entity,
    opts.client_id,
    opts.device_id ?? null,
    JSON.stringify(opts.local_payload),
    opts.server_payload ? JSON.stringify(opts.server_payload) : null,
    opts.reason,
  );
}

export async function registerMxSyncRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.post("/mx/sync/push", async (req) => {
    const body = z
      .object({
        device_id: z.string().min(1),
        items: z
          .array(
            z.object({
              client_id: z.string().min(1),
              entity: z.enum(["roll", "job_work", "packing", "parcel", "challan", "challan_scan", "godown_receive"]),
              op: z.enum(["upsert", "delete"]),
              payload: z.record(z.string(), z.unknown()),
              updated_at: z.string(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(req.body);

    const results: { client_id: string; entity: string; status: string; reason?: string }[] = [];

    for (const item of body.items) {
      try {
        if (item.entity === "packing" && item.op === "upsert") {
          const p = item.payload as any;
          const result = applyCutPacking(db, {
            packing_id: String(p.packing_id ?? item.client_id),
            parent_roll_id: String(p.parent_roll_id),
            length_meters: Number(p.length_meters),
            variant_code: String(p.variant_code),
            packing_date: String(p.packing_date ?? item.updated_at.slice(0, 10)),
            notes: p.notes ? String(p.notes) : null,
            device_id: body.device_id,
          });
          if (result.status === "conflict") {
            const server = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=?`).get(String(p.packing_id ?? item.client_id));
            recordConflict(db, {
              entity: "packing",
              client_id: item.client_id,
              device_id: body.device_id,
              local_payload: item.payload,
              server_payload: server,
              reason: result.reason ?? "conflict",
            });
          }
          results.push({ client_id: item.client_id, entity: item.entity, status: result.status, reason: result.reason });
          continue;
        }

        if (item.entity === "parcel" && item.op === "upsert") {
          const p = item.payload as any;
          const result = applyParcelCreate(db, {
            parcel_id: String(p.parcel_id ?? item.client_id),
            packing_ids: (p.packing_ids as string[]) ?? [],
            created_at: String(p.created_at ?? item.updated_at),
            device_id: body.device_id,
          });
          if (result.status === "conflict") {
            recordConflict(db, {
              entity: "parcel",
              client_id: item.client_id,
              device_id: body.device_id,
              local_payload: item.payload,
              reason: result.reason ?? "conflict",
            });
          }
          results.push({ client_id: item.client_id, entity: item.entity, status: result.status, reason: result.reason });
          continue;
        }

        if (item.entity === "challan_scan" && item.op === "upsert") {
          const p = item.payload as any;
          const result = applyChallanScan(db, {
            scan_id: String(p.scan_id ?? item.client_id),
            challan_id: String(p.challan_id),
            scan_type: p.scan_type as "packing" | "parcel",
            scanned_ref: String(p.scanned_ref),
            scanned_at: String(p.scanned_at ?? item.updated_at),
            device_id: body.device_id,
          });
          if (result.status === "conflict") {
            recordConflict(db, {
              entity: "challan_scan",
              client_id: item.client_id,
              device_id: body.device_id,
              local_payload: item.payload,
              reason: result.reason ?? "conflict",
            });
          }
          results.push({ client_id: item.client_id, entity: item.entity, status: result.status, reason: result.reason });
          continue;
        }

        if (item.entity === "godown_receive" && item.op === "upsert") {
          const p = item.payload as any;
          const packing_id = String(p.packing_id);
          const existing = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=?`).get(packing_id) as any;
          if (!existing) {
            results.push({ client_id: item.client_id, entity: item.entity, status: "rejected", reason: "Packing not found" });
            continue;
          }
          if (existing.status === "dispatched") {
            recordConflict(db, {
              entity: "godown_receive",
              client_id: item.client_id,
              device_id: body.device_id,
              local_payload: item.payload,
              server_payload: existing,
              reason: "Packing already dispatched on server",
            });
            results.push({ client_id: item.client_id, entity: item.entity, status: "conflict", reason: "Already dispatched" });
            continue;
          }
          db.prepare(
            `UPDATE mx_packings SET godown_id=?, location_hint=?, status='in_godown', updated_at=?, version=version+1 WHERE packing_id=?`,
          ).run(Number(p.godown_id), p.location_hint ? String(p.location_hint) : null, nowIso(), packing_id);
          results.push({ client_id: item.client_id, entity: item.entity, status: "applied" });
          continue;
        }

        if (item.entity === "roll" && item.op === "upsert") {
          const p = item.payload as any;
          const roll_id = String(p.roll_id ?? item.client_id);
          const existing = db.prepare(`SELECT * FROM mx_rolls WHERE roll_id=?`).get(roll_id) as any;
          if (existing) {
            results.push({ client_id: item.client_id, entity: item.entity, status: "applied" });
            continue;
          }
          const short = String(p.short_code ?? `R${roll_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`);
          db.prepare(
            `
            INSERT INTO mx_rolls(roll_id, short_code, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
          `,
          ).run(
            roll_id,
            short,
            Number(p.supplier_id),
            String(p.variant_code),
            Number(p.original_meterage),
            Number(p.remaining_meterage ?? p.original_meterage),
            String(p.status ?? "inward"),
            String(p.received_date),
            p.notes ? String(p.notes) : null,
            nowIso(),
          );
          results.push({ client_id: item.client_id, entity: item.entity, status: "applied" });
          continue;
        }

        results.push({ client_id: item.client_id, entity: item.entity, status: "rejected", reason: "Unsupported entity/op" });
      } catch (e: any) {
        results.push({ client_id: item.client_id, entity: item.entity, status: "rejected", reason: e?.message ?? "error" });
      }
    }

    return { data: { results } };
  });

  app.get("/mx/sync/pull", async (req) => {
    const q = z
      .object({
        device_id: z.string().min(1),
        since: z.string().optional(),
      })
      .parse(req.query);

    const since = q.since ?? "1970-01-01T00:00:00.000Z";

    const rolls = db.prepare(`SELECT * FROM mx_rolls WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000`).all(since);
    const packings = db.prepare(`SELECT * FROM mx_packings WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000`).all(since);
    const parcels = db.prepare(`SELECT * FROM mx_parcels WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000`).all(since);
    const parcel_items = db
      .prepare(
        `
      SELECT i.* FROM mx_parcel_items i
      JOIN mx_parcels p ON p.parcel_id = i.parcel_id
      WHERE p.updated_at > ?
    `,
      )
      .all(since);
    const challans = db.prepare(`SELECT * FROM mx_challans WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 500`).all(since);
    const challan_reqs = db
      .prepare(
        `
      SELECT r.* FROM mx_challan_requirements r
      JOIN mx_challans c ON c.challan_id = r.challan_id
      WHERE c.updated_at > ?
    `,
      )
      .all(since);
    const challan_scans = db.prepare(`SELECT * FROM mx_challan_scans WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000`).all(since);
    const job_work = db.prepare(`SELECT * FROM mx_job_work WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 500`).all(since);
    const suppliers = db.prepare(`SELECT * FROM mx_suppliers WHERE updated_at > ? OR created_at > ?`).all(since, since);
    const variants = db.prepare(`SELECT * FROM mx_item_variants WHERE updated_at > ? OR created_at > ?`).all(since, since);
    const items = db.prepare(`SELECT * FROM mx_items WHERE updated_at > ? OR created_at > ?`).all(since, since);
    const godowns = db.prepare(`SELECT * FROM mx_godowns WHERE updated_at > ? OR created_at > ?`).all(since, since);
    const job_workers = db.prepare(`SELECT * FROM mx_job_workers WHERE updated_at > ? OR created_at > ?`).all(since, since);

    const conflicts = db
      .prepare(`SELECT * FROM mx_sync_conflicts WHERE device_id=? AND status='open' ORDER BY created_at DESC LIMIT 50`)
      .all(q.device_id);

    const server_time = nowIso();
    db.prepare(
      `
      INSERT INTO mx_sync_cursors(device_id, last_pull_at, updated_at) VALUES (?,?,?)
      ON CONFLICT(device_id) DO UPDATE SET last_pull_at=excluded.last_pull_at, updated_at=excluded.updated_at
    `,
    ).run(q.device_id, server_time, server_time);

    return {
      data: {
        server_time,
        rolls,
        packings,
        parcels,
        parcel_items,
        challans,
        challan_reqs,
        challan_scans,
        job_work,
        masters: { suppliers, items, variants, godowns, job_workers },
        conflicts,
      },
    };
  });

  app.get("/mx/sync/conflicts", async () => {
    const rows = db.prepare(`SELECT * FROM mx_sync_conflicts WHERE status='open' ORDER BY created_at DESC LIMIT 200`).all();
    return { data: rows };
  });

  app.post("/mx/sync/conflicts/:id/resolve", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z.object({ status: z.enum(["resolved", "dismissed"]) }).parse(req.body);
    const r = db
      .prepare(`UPDATE mx_sync_conflicts SET status=?, resolved_at=? WHERE id=? AND status='open'`)
      .run(body.status, nowIso(), id);
    if (r.changes === 0) return reply.code(404).send({ error: "Not found or already resolved" });
    return { ok: true };
  });
}
