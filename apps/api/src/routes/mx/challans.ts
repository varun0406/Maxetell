import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

function shortCode(prefix: string, id: string) {
  return `${prefix}${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function applyChallanScan(
  db: Db,
  payload: {
    scan_id: string;
    challan_id: string;
    scan_type: "packing" | "parcel";
    scanned_ref: string;
    scanned_at: string;
    device_id?: string | null;
  },
): { status: "applied" | "conflict" | "rejected"; reason?: string; matched_codes?: string[] } {
  const existing = db.prepare(`SELECT * FROM mx_challan_scans WHERE scan_id=?`).get(payload.scan_id) as any;
  if (existing) return { status: "applied" };

  const challan = db.prepare(`SELECT * FROM mx_challans WHERE challan_id=? AND deleted_at IS NULL`).get(payload.challan_id) as any;
  if (!challan) return { status: "rejected", reason: "Challan not found" };
  if (challan.status === "dispatched" || challan.status === "delivered") {
    return { status: "conflict", reason: "Challan already dispatched" };
  }

  const dup = db
    .prepare(`SELECT scan_id FROM mx_challan_scans WHERE challan_id=? AND scan_type=? AND scanned_ref=? AND deleted_at IS NULL`)
    .get(payload.challan_id, payload.scan_type, payload.scanned_ref);
  if (dup) return { status: "applied" };

  const reqs = db
    .prepare(`SELECT variant_code FROM mx_challan_requirements WHERE challan_id=?`)
    .all(payload.challan_id) as { variant_code: string }[];
  const requiredCodes = new Set(reqs.map((r) => r.variant_code));

  let codes: string[] = [];
  if (payload.scan_type === "packing") {
    const p = db
      .prepare(`SELECT * FROM mx_packings WHERE (packing_id=? OR short_code=?) AND deleted_at IS NULL`)
      .get(payload.scanned_ref, payload.scanned_ref) as any;
    if (!p) return { status: "rejected", reason: "Packing not found" };
    if (p.status === "dispatched") return { status: "conflict", reason: "Packing already dispatched" };
    codes = [p.variant_code];
    if (requiredCodes.size > 0 && !requiredCodes.has(p.variant_code)) {
      return { status: "rejected", reason: `Variant ${p.variant_code} not on challan requirements`, matched_codes: codes };
    }
  } else {
    const parcel = db
      .prepare(`SELECT * FROM mx_parcels WHERE (parcel_id=? OR short_code=?) AND deleted_at IS NULL`)
      .get(payload.scanned_ref, payload.scanned_ref) as any;
    if (!parcel) return { status: "rejected", reason: "Parcel not found" };
    const items = db
      .prepare(
        `
      SELECT pk.variant_code, pk.status FROM mx_parcel_items i
      JOIN mx_packings pk ON pk.packing_id = i.packing_id
      WHERE i.parcel_id = ?
    `,
      )
      .all(parcel.parcel_id) as any[];
    if (items.some((i) => i.status === "dispatched")) {
      return { status: "conflict", reason: "Parcel contains dispatched packing" };
    }
    codes = [...new Set(items.map((i) => i.variant_code))];
    if (requiredCodes.size > 0) {
      const bad = codes.filter((c) => !requiredCodes.has(c));
      if (bad.length) return { status: "rejected", reason: `Variants not on challan: ${bad.join(", ")}`, matched_codes: codes };
    }
  }

  const txn = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO mx_challan_scans(scan_id, challan_id, scan_type, scanned_ref, scanned_at, device_id, updated_at)
      VALUES (?,?,?,?,?,?,?)
    `,
    ).run(payload.scan_id, payload.challan_id, payload.scan_type, payload.scanned_ref, payload.scanned_at, payload.device_id ?? null, nowIso());
    if (challan.status === "created" || challan.status === "assigned") {
      db.prepare(`UPDATE mx_challans SET status='assembling', updated_at=?, version=version+1 WHERE challan_id=?`).run(nowIso(), payload.challan_id);
    }
  });
  txn();
  return { status: "applied", matched_codes: codes };
}

export async function registerMxChallanRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/challans", async (req) => {
    const { status } = req.query as { status?: string };
    let sql = `
      SELECT c.*,
        a.party_name AS addr_party, a.city AS ship_city,
        p.name AS party_master_name, p.gstin AS party_gstin,
        COALESCE(ag.name, c.agent_name) AS agent_display,
        (SELECT COUNT(1) FROM mx_challan_scans s WHERE s.challan_id=c.challan_id AND s.deleted_at IS NULL) AS scan_count
      FROM mx_challans c
      LEFT JOIN mx_delivery_addresses a ON a.id = c.address_id
      LEFT JOIN mx_parties p ON p.id = c.party_id
      LEFT JOIN mx_agents ag ON ag.id = c.agent_id
      WHERE c.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY c.challan_date DESC, c.created_at DESC`;
    return { data: db.prepare(sql).all(...params) };
  });

  app.get("/mx/challans/:challan_id", async (req, reply) => {
    const { challan_id } = req.params as { challan_id: string };
    const c = db
      .prepare(
        `
      SELECT c.*,
        a.party_name AS ship_label, a.address_line AS ship_address_line, a.city AS ship_city, a.state AS ship_state, a.phone AS ship_phone,
        a.party_name AS addr_party, a.address_line, a.city, a.state,
        p.name AS party_name_master, p.address_line AS party_address_line, p.city AS party_city, p.state AS party_state,
        p.gstin AS party_gstin, p.phone AS party_phone,
        COALESCE(ag.name, c.agent_name) AS agent_display, ag.phone AS agent_phone
      FROM mx_challans c
      LEFT JOIN mx_delivery_addresses a ON a.id = c.address_id
      LEFT JOIN mx_parties p ON p.id = c.party_id
      LEFT JOIN mx_agents ag ON ag.id = c.agent_id
      WHERE (c.challan_id=? OR c.challan_no=?) AND c.deleted_at IS NULL
    `,
      )
      .get(challan_id, challan_id) as any;
    if (!c) return reply.code(404).send({ error: "Not found" });

    const requirements = db.prepare(`SELECT * FROM mx_challan_requirements WHERE challan_id=?`).all(c.challan_id);
    const scans = db.prepare(`SELECT * FROM mx_challan_scans WHERE challan_id=? AND deleted_at IS NULL ORDER BY scanned_at`).all(c.challan_id);

    // Location hints for required variants still in godown
    const hints = db
      .prepare(
        `
      SELECT p.variant_code, p.short_code, p.packing_id, p.length_meters, p.location_hint,
             g.name AS godown_name, g.code AS godown_code
      FROM mx_packings p
      LEFT JOIN mx_godowns g ON g.id = p.godown_id
      WHERE p.deleted_at IS NULL
        AND p.status IN ('packed','in_godown','consolidated')
        AND p.variant_code IN (SELECT variant_code FROM mx_challan_requirements WHERE challan_id=?)
      ORDER BY g.name, p.location_hint
      LIMIT 100
    `,
      )
      .all(c.challan_id);

    return { data: { ...c, requirements, scans, location_hints: hints } };
  });

  app.post("/mx/challans", async (req) => {
    const body = z
      .object({
        challan_id: z.string().uuid().optional(),
        challan_date: z.string().min(1),
        address_id: z.number().int().positive().optional(),
        party_id: z.number().int().positive().optional(),
        party_name: z.string().optional(),
        agent_id: z.number().int().positive().optional(),
        agent_name: z.string().optional(),
        assigned_to: z.number().int().positive().optional(),
        notes: z.string().optional(),
        allow_partial: z.boolean().optional(),
        requirements: z
          .array(
            z.object({
              variant_code: z.string().min(1),
              required_meters: z.number().nonnegative().default(0),
              required_pieces: z.number().int().nonnegative().default(0),
            }),
          )
          .default([]),
      })
      .parse(req.body);

    const challan_id = body.challan_id ?? crypto.randomUUID();
    const challan_no = shortCode("DC", challan_id);

    let partyName = body.party_name ?? null;
    if (body.party_id && !partyName) {
      const p = db.prepare(`SELECT name FROM mx_parties WHERE id=?`).get(body.party_id) as { name: string } | undefined;
      partyName = p?.name ?? null;
    }
    let agentName = body.agent_name ?? null;
    if (body.agent_id && !agentName) {
      const a = db.prepare(`SELECT name FROM mx_agents WHERE id=?`).get(body.agent_id) as { name: string } | undefined;
      agentName = a?.name ?? null;
    }

    const txn = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO mx_challans(
          challan_id, challan_no, challan_date, address_id, party_id, party_name,
          agent_id, agent_name, assigned_to, notes, allow_partial, status, updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'created',?)
      `,
      ).run(
        challan_id,
        challan_no,
        body.challan_date,
        body.address_id ?? null,
        body.party_id ?? null,
        partyName,
        body.agent_id ?? null,
        agentName,
        body.assigned_to ?? null,
        body.notes ?? null,
        body.allow_partial ? 1 : 0,
        nowIso(),
      );
      const ins = db.prepare(
        `INSERT INTO mx_challan_requirements(challan_id, variant_code, required_meters, required_pieces) VALUES (?,?,?,?)`,
      );
      for (const r of body.requirements) {
        ins.run(challan_id, r.variant_code, r.required_meters, r.required_pieces);
      }
    });
    txn();
    return { data: { challan_id, challan_no, status: "created", ...body } };
  });

  app.post("/mx/challans/:challan_id/scan", async (req, reply) => {
    const { challan_id } = req.params as { challan_id: string };
    const body = z
      .object({
        scan_id: z.string().uuid(),
        scan_type: z.enum(["packing", "parcel"]),
        scanned_ref: z.string().min(1),
        scanned_at: z.string().min(1),
        device_id: z.string().optional(),
      })
      .parse(req.body);

    const result = applyChallanScan(db, { ...body, challan_id });
    if (result.status === "rejected") return reply.code(400).send({ error: result.reason, status: result.status });
    if (result.status === "conflict") return reply.code(409).send({ error: result.reason, status: result.status });
    return { data: result, status: "applied" };
  });

  app.post("/mx/challans/:challan_id/dispatch", async (req, reply) => {
    const { challan_id } = req.params as { challan_id: string };
    const challan = db.prepare(`SELECT * FROM mx_challans WHERE challan_id=? AND deleted_at IS NULL`).get(challan_id) as any;
    if (!challan) return reply.code(404).send({ error: "Not found" });
    if (challan.status === "dispatched" || challan.status === "delivered") {
      return reply.code(409).send({ error: "Already dispatched" });
    }

    const reqs = db.prepare(`SELECT * FROM mx_challan_requirements WHERE challan_id=?`).all(challan_id) as any[];
    const scans = db.prepare(`SELECT * FROM mx_challan_scans WHERE challan_id=? AND deleted_at IS NULL`).all(challan_id) as any[];

    if (reqs.length > 0 && !challan.allow_partial) {
      // Gather assembled variant meters/pieces
      const assembled = new Map<string, { meters: number; pieces: number }>();
      for (const sc of scans) {
        if (sc.scan_type === "packing") {
          const p = db.prepare(`SELECT * FROM mx_packings WHERE packing_id=? OR short_code=?`).get(sc.scanned_ref, sc.scanned_ref) as any;
          if (!p) continue;
          const cur = assembled.get(p.variant_code) ?? { meters: 0, pieces: 0 };
          cur.meters += p.length_meters;
          cur.pieces += 1;
          assembled.set(p.variant_code, cur);
        } else {
          const parcel = db.prepare(`SELECT parcel_id FROM mx_parcels WHERE parcel_id=? OR short_code=?`).get(sc.scanned_ref, sc.scanned_ref) as any;
          if (!parcel) continue;
          const items = db
            .prepare(
              `SELECT pk.variant_code, pk.length_meters FROM mx_parcel_items i JOIN mx_packings pk ON pk.packing_id=i.packing_id WHERE i.parcel_id=?`,
            )
            .all(parcel.parcel_id) as any[];
          for (const it of items) {
            const cur = assembled.get(it.variant_code) ?? { meters: 0, pieces: 0 };
            cur.meters += it.length_meters;
            cur.pieces += 1;
            assembled.set(it.variant_code, cur);
          }
        }
      }
      for (const r of reqs) {
        const a = assembled.get(r.variant_code) ?? { meters: 0, pieces: 0 };
        if (r.required_meters > 0 && a.meters + 1e-6 < r.required_meters) {
          return reply.code(400).send({ error: `Incomplete: ${r.variant_code} needs ${r.required_meters}m, have ${a.meters}m` });
        }
        if (r.required_pieces > 0 && a.pieces < r.required_pieces) {
          return reply.code(400).send({ error: `Incomplete: ${r.variant_code} needs ${r.required_pieces} pcs, have ${a.pieces}` });
        }
      }
    }

    if (scans.length === 0) return reply.code(400).send({ error: "No scans on challan" });

    const txn = db.transaction(() => {
      for (const sc of scans) {
        if (sc.scan_type === "packing") {
          db.prepare(
            `UPDATE mx_packings SET status='dispatched', updated_at=?, version=version+1 WHERE (packing_id=? OR short_code=?) AND deleted_at IS NULL`,
          ).run(nowIso(), sc.scanned_ref, sc.scanned_ref);
        } else {
          const parcel = db.prepare(`SELECT parcel_id FROM mx_parcels WHERE parcel_id=? OR short_code=?`).get(sc.scanned_ref, sc.scanned_ref) as any;
          if (!parcel) continue;
          db.prepare(`UPDATE mx_parcels SET status='dispatched', updated_at=?, version=version+1 WHERE parcel_id=?`).run(nowIso(), parcel.parcel_id);
          db.prepare(
            `
            UPDATE mx_packings SET status='dispatched', updated_at=?, version=version+1
            WHERE packing_id IN (SELECT packing_id FROM mx_parcel_items WHERE parcel_id=?)
          `,
          ).run(nowIso(), parcel.parcel_id);
        }
      }
      db.prepare(`UPDATE mx_challans SET status='dispatched', updated_at=?, version=version+1 WHERE challan_id=?`).run(nowIso(), challan_id);
    });
    txn();
    return { ok: true, status: "dispatched" };
  });

  app.patch("/mx/challans/:challan_id/status", async (req, reply) => {
    const { challan_id } = req.params as { challan_id: string };
    const body = z.object({ status: z.enum(["created", "assigned", "assembling", "dispatched", "delivered"]) }).parse(req.body);
    const r = db.prepare(`UPDATE mx_challans SET status=?, updated_at=?, version=version+1 WHERE challan_id=? AND deleted_at IS NULL`).run(body.status, nowIso(), challan_id);
    if (r.changes === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });

  app.delete("/mx/challans/:challan_id", async (req) => {
    const { challan_id } = req.params as { challan_id: string };
    db.prepare(`UPDATE mx_challans SET deleted_at=?, updated_at=? WHERE challan_id=?`).run(nowIso(), nowIso(), challan_id);
    return { ok: true };
  });
}
