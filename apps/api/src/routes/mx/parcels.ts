import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

function shortCode(prefix: string, id: string) {
  return `${prefix}${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function applyParcelCreate(
  db: Db,
  payload: {
    parcel_id: string;
    packing_ids: string[];
    created_at?: string;
    device_id?: string | null;
  },
): { status: "applied" | "conflict" | "rejected"; reason?: string } {
  const existing = db.prepare(`SELECT * FROM mx_parcels WHERE parcel_id=?`).get(payload.parcel_id) as any;
  if (existing) {
    if (existing.deleted_at) return { status: "rejected", reason: "Parcel soft-deleted" };
    return { status: "applied" }; // idempotent
  }

  const packings = payload.packing_ids.map((id) => db.prepare(`SELECT * FROM mx_packings WHERE packing_id=? AND deleted_at IS NULL`).get(id) as any);
  if (packings.some((p) => !p)) return { status: "rejected", reason: "One or more packings not found" };
  for (const p of packings) {
    if (p.parcel_id) return { status: "conflict", reason: `Packing ${p.short_code} already in a parcel` };
    if (p.status === "dispatched") return { status: "conflict", reason: `Packing ${p.short_code} already dispatched` };
  }

  const total = packings.reduce((s, p) => s + p.length_meters, 0);
  const short_code = shortCode("C", payload.parcel_id); // C = consolidated parcel

  const txn = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO mx_parcels(parcel_id, short_code, total_meters, status, device_id, created_at, updated_at)
      VALUES (?,?,?,'sealed',?,?,?)
    `,
    ).run(payload.parcel_id, short_code, total, payload.device_id ?? null, payload.created_at ?? nowIso(), nowIso());

    const link = db.prepare(`INSERT INTO mx_parcel_items(parcel_id, packing_id) VALUES (?,?)`);
    const upd = db.prepare(
      `UPDATE mx_packings SET parcel_id=?, status='consolidated', updated_at=?, version=version+1 WHERE packing_id=?`,
    );
    for (const p of packings) {
      link.run(payload.parcel_id, p.packing_id);
      upd.run(payload.parcel_id, nowIso(), p.packing_id);
    }
  });
  txn();
  return { status: "applied" };
}

export async function registerMxParcelRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/parcels", async () => {
    const rows = db
      .prepare(
        `
      SELECT p.*,
        (SELECT COUNT(1) FROM mx_parcel_items i WHERE i.parcel_id = p.parcel_id) AS packing_count
      FROM mx_parcels p
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/parcels/:parcel_id", async (req, reply) => {
    const { parcel_id } = req.params as { parcel_id: string };
    const parcel = db
      .prepare(`SELECT * FROM mx_parcels WHERE (parcel_id=? OR short_code=?) AND deleted_at IS NULL`)
      .get(parcel_id, parcel_id) as any;
    if (!parcel) return reply.code(404).send({ error: "Not found" });
    const items = db
      .prepare(
        `
      SELECT pk.*, v.variant_name, v.color
      FROM mx_parcel_items i
      JOIN mx_packings pk ON pk.packing_id = i.packing_id
      LEFT JOIN mx_item_variants v ON v.variant_code = pk.variant_code
      WHERE i.parcel_id = ?
    `,
      )
      .all(parcel.parcel_id);
    return { data: { ...parcel, items } };
  });

  app.post("/mx/parcels", async (req, reply) => {
    const body = z
      .object({
        parcel_id: z.string().uuid(),
        packing_ids: z.array(z.string().uuid()).min(1).max(20),
        created_at: z.string().optional(),
        device_id: z.string().optional(),
      })
      .parse(req.body);

    const result = applyParcelCreate(db, body);
    if (result.status === "rejected") return reply.code(400).send({ error: result.reason, status: result.status });
    if (result.status === "conflict") return reply.code(409).send({ error: result.reason, status: result.status });
    const row = db.prepare(`SELECT * FROM mx_parcels WHERE parcel_id=?`).get(body.parcel_id);
    return { data: row, status: "applied" };
  });
}
