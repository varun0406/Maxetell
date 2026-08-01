import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

function shortCode(prefix: string, id: string) {
  return `${prefix}${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Apply a cut packing idempotently. Returns applied | conflict | rejected. */
export function applyCutPacking(
  db: Db,
  payload: {
    packing_id: string;
    parent_roll_id: string;
    length_meters: number;
    variant_code: string;
    packing_date: string;
    notes?: string | null;
    device_id?: string | null;
  },
): { status: "applied" | "conflict" | "rejected"; reason?: string } {
  const existing = db.prepare(`SELECT * FROM mx_packings WHERE packing_id = ?`).get(payload.packing_id) as any;
  if (existing) {
    if (existing.deleted_at) return { status: "rejected", reason: "Packing soft-deleted" };
    // Idempotent replay
    if (
      existing.parent_roll_id === payload.parent_roll_id &&
      Math.abs(existing.length_meters - payload.length_meters) < 0.001
    ) {
      return { status: "applied" };
    }
    return { status: "conflict", reason: "Packing ID exists with different payload" };
  }

  const roll = db.prepare(`SELECT * FROM mx_rolls WHERE roll_id=? AND deleted_at IS NULL`).get(payload.parent_roll_id) as any;
  if (!roll) return { status: "rejected", reason: "Parent roll not found" };
  if (roll.status === "dispatched") return { status: "rejected", reason: "Roll unavailable" };
  if (payload.length_meters > roll.remaining_meterage + 1e-9) {
    return { status: "conflict", reason: `Insufficient remaining meterage (${roll.remaining_meterage}m)` };
  }

  const short_code = shortCode("P", payload.packing_id);
  const remaining = roll.remaining_meterage - payload.length_meters;
  const newStatus = remaining <= 0.001 ? "depleted" : "in_cutting";

  const txn = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO mx_packings(packing_id, short_code, parent_roll_id, length_meters, variant_code, status, packing_date, notes, device_id, updated_at)
      VALUES (?,?,?,?,?,'packed',?,?,?,?)
    `,
    ).run(
      payload.packing_id,
      short_code,
      payload.parent_roll_id,
      payload.length_meters,
      payload.variant_code,
      payload.packing_date,
      payload.notes ?? null,
      payload.device_id ?? null,
      nowIso(),
    );
    db.prepare(
      `UPDATE mx_rolls SET remaining_meterage=?, status=?, updated_at=?, version=version+1 WHERE roll_id=?`,
    ).run(Math.max(0, remaining), newStatus, nowIso(), payload.parent_roll_id);
  });
  txn();
  return { status: "applied" };
}

export async function registerMxPackingRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/packings", async (req) => {
    const { status, roll_id, q } = req.query as { status?: string; roll_id?: string; q?: string };
    let sql = `
      SELECT p.*, r.short_code AS roll_short, v.variant_name, v.color, i.code AS item_code, i.name AS item_name,
             g.name AS godown_name, g.code AS godown_code
      FROM mx_packings p
      JOIN mx_rolls r ON r.roll_id = p.parent_roll_id
      LEFT JOIN mx_item_variants v ON v.variant_code = p.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      LEFT JOIN mx_godowns g ON g.id = p.godown_id
      WHERE p.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (roll_id) {
      sql += ` AND p.parent_roll_id = ?`;
      params.push(roll_id);
    }
    if (q) {
      sql += ` AND (p.packing_id = ? OR p.short_code LIKE ? OR p.variant_code LIKE ?)`;
      params.push(q, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY p.created_at DESC LIMIT 500`;
    return { data: db.prepare(sql).all(...params) };
  });

  app.get("/mx/packings/:packing_id", async (req, reply) => {
    const { packing_id } = req.params as { packing_id: string };
    const row = db
      .prepare(
        `
      SELECT p.*, r.short_code AS roll_short, r.supplier_id, s.name AS supplier_name,
             v.variant_name, v.color, i.code AS item_code, i.name AS item_name
      FROM mx_packings p
      JOIN mx_rolls r ON r.roll_id = p.parent_roll_id
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = p.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE (p.packing_id = ? OR p.short_code = ?) AND p.deleted_at IS NULL
    `,
      )
      .get(packing_id, packing_id);
    if (!row) return reply.code(404).send({ error: "Not found" });
    return { data: row };
  });

  /** Online cut (also used when device is online). Idempotent on packing_id. */
  app.post("/mx/packings/cut", async (req, reply) => {
    const body = z
      .object({
        packing_id: z.string().uuid(),
        parent_roll_id: z.string().min(1),
        length_meters: z.number().positive(),
        variant_code: z.string().min(1),
        packing_date: z.string().min(1),
        notes: z.string().optional(),
        device_id: z.string().optional(),
      })
      .parse(req.body);

    const result = applyCutPacking(db, body);
    if (result.status === "rejected") return reply.code(400).send({ error: result.reason, status: result.status });
    if (result.status === "conflict") return reply.code(409).send({ error: result.reason, status: result.status });
    const row = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=?`).get(body.packing_id);
    return { data: row, status: "applied" };
  });

  app.post("/mx/packings/:packing_id/godown", async (req, reply) => {
    const { packing_id } = req.params as { packing_id: string };
    const body = z
      .object({
        godown_id: z.number().int().positive(),
        location_hint: z.string().optional(),
      })
      .parse(req.body);

    const p = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=? AND deleted_at IS NULL`).get(packing_id) as any;
    if (!p) return reply.code(404).send({ error: "Not found" });
    if (p.status === "dispatched") return reply.code(409).send({ error: "Already dispatched" });

    db.prepare(
      `UPDATE mx_packings SET godown_id=?, location_hint=?, status='in_godown', updated_at=?, version=version+1 WHERE packing_id=?`,
    ).run(body.godown_id, body.location_hint ?? null, nowIso(), packing_id);
    return { ok: true };
  });

  app.patch("/mx/packings/:packing_id/status", async (req, reply) => {
    const { packing_id } = req.params as { packing_id: string };
    const body = z.object({ status: z.enum(["packed", "in_godown", "consolidated", "dispatched", "faulty"]) }).parse(req.body);
    const p = db.prepare(`SELECT status FROM mx_packings WHERE packing_id=? AND deleted_at IS NULL`).get(packing_id) as any;
    if (!p) return reply.code(404).send({ error: "Not found" });
    if (p.status === "dispatched" && body.status !== "dispatched") {
      return reply.code(409).send({ error: "Cannot change status of dispatched packing" });
    }
    db.prepare(`UPDATE mx_packings SET status=?, updated_at=?, version=version+1 WHERE packing_id=?`).run(body.status, nowIso(), packing_id);
    return { ok: true };
  });

  app.delete("/mx/packings/:packing_id", async (req, reply) => {
    const { packing_id } = req.params as { packing_id: string };
    const p = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=? AND deleted_at IS NULL`).get(packing_id) as any;
    if (!p) return reply.code(404).send({ error: "Not found" });
    if (p.status === "dispatched") return reply.code(409).send({ error: "Cannot delete dispatched packing" });
    const txn = db.transaction(() => {
      db.prepare(`UPDATE mx_packings SET deleted_at=?, updated_at=? WHERE packing_id=?`).run(nowIso(), nowIso(), packing_id);
      db.prepare(
        `UPDATE mx_rolls SET remaining_meterage = remaining_meterage + ?, status='in_cutting', updated_at=?, version=version+1 WHERE roll_id=?`,
      ).run(p.length_meters, nowIso(), p.parent_roll_id);
    });
    txn();
    return { ok: true };
  });
}
