import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

export async function registerMxRollsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/rolls", async (req) => {
    const { status, q } = req.query as { status?: string; q?: string };
    let sql = `
      SELECT r.*, r.roll_id AS job_id, COALESCE(r.lot_no, r.short_code) AS lot_display,
             s.name AS supplier_name, v.variant_name, v.color, i.code AS item_code, i.name AS item_name, i.quality
      FROM mx_rolls r
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE r.deleted_at IS NULL
    `;
    const params: any[] = [];
    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }
    if (q) {
      sql += ` AND (r.roll_id = ? OR r.short_code LIKE ? OR r.lot_no LIKE ? OR r.variant_code LIKE ?)`;
      params.push(q, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if ((req.query as any).variant_code) {
      sql += ` AND r.variant_code = ?`;
      params.push((req.query as any).variant_code);
    }
    sql += ` ORDER BY r.received_date DESC, r.created_at DESC`;
    return { data: db.prepare(sql).all(...params) };
  });

  app.get("/mx/rolls/:roll_id", async (req, reply) => {
    const { roll_id } = req.params as { roll_id: string };
    const row = db
      .prepare(
        `
      SELECT r.*, r.roll_id AS job_id, COALESCE(r.lot_no, r.short_code) AS lot_display,
             s.name AS supplier_name, v.variant_name, v.color, i.code AS item_code, i.name AS item_name, i.quality
      FROM mx_rolls r
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE (r.roll_id = ? OR r.short_code = ? OR r.lot_no = ?) AND r.deleted_at IS NULL
    `,
      )
      .get(roll_id, roll_id, roll_id);
    if (!row) return reply.code(404).send({ error: "Roll not found" });
    const packings = db
      .prepare(`SELECT * FROM mx_packings WHERE parent_roll_id = ? AND deleted_at IS NULL ORDER BY created_at`)
      .all((row as any).roll_id);
    return { data: { ...(row as object), packings } };
  });

  app.post("/mx/rolls", async (req, reply) => {
    const body = z
      .object({
        roll_id: z.string().uuid().optional(),
        lot_no: z.string().trim().min(1).max(64),
        supplier_id: z.number().int().positive(),
        variant_code: z.string().trim().min(1),
        original_meterage: z.number().positive(),
        received_date: z.string().min(1),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const lot = body.lot_no.trim().toUpperCase();
    const dup = db
      .prepare(`SELECT roll_id FROM mx_rolls WHERE (lot_no = ? OR short_code = ?) AND deleted_at IS NULL`)
      .get(lot, lot);
    if (dup) return reply.code(409).send({ error: `Lot no ${lot} already exists` });

    const job_id = body.roll_id ?? crypto.randomUUID();
    db.prepare(
      `
      INSERT INTO mx_rolls(roll_id, short_code, lot_no, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, updated_at)
      VALUES (?,?,?,?,?,?,?,'inward',?,?,?)
    `,
    ).run(
      job_id,
      lot,
      lot,
      body.supplier_id,
      body.variant_code,
      body.original_meterage,
      body.original_meterage,
      body.received_date,
      body.notes ?? null,
      nowIso(),
    );
    return {
      data: {
        job_id,
        roll_id: job_id,
        lot_no: lot,
        short_code: lot,
        supplier_id: body.supplier_id,
        variant_code: body.variant_code,
        original_meterage: body.original_meterage,
        received_date: body.received_date,
        notes: body.notes,
        remaining_meterage: body.original_meterage,
        status: "inward",
      },
    };
  });

  app.patch("/mx/rolls/:roll_id/status", async (req, reply) => {
    const { roll_id } = req.params as { roll_id: string };
    const body = z.object({ status: z.enum(["inward", "at_job_work", "in_cutting", "depleted"]) }).parse(req.body);
    const r = db.prepare(`UPDATE mx_rolls SET status=?, updated_at=?, version=version+1 WHERE roll_id=? AND deleted_at IS NULL`).run(body.status, nowIso(), roll_id);
    if (r.changes === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });

  app.delete("/mx/rolls/:roll_id", async (req) => {
    const { roll_id } = req.params as { roll_id: string };
    db.prepare(`UPDATE mx_rolls SET deleted_at=?, updated_at=? WHERE roll_id=?`).run(nowIso(), nowIso(), roll_id);
    return { ok: true };
  });

  // Job work
  app.get("/mx/job-work", async () => {
    const rows = db
      .prepare(
        `
      SELECT j.*, w.name AS worker_name, r.short_code AS roll_short, r.variant_code
      FROM mx_job_work j
      JOIN mx_job_workers w ON w.id = j.job_worker_id
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      WHERE j.deleted_at IS NULL
      ORDER BY j.outward_date DESC
    `,
      )
      .all();
    return { data: rows };
  });

  app.post("/mx/job-work/out", async (req, reply) => {
    const body = z
      .object({
        job_work_id: z.string().uuid().optional(),
        roll_id: z.string().min(1),
        job_worker_id: z.number().int().positive(),
        meter_sent: z.number().positive(),
        outward_date: z.string().min(1),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const roll = db.prepare(`SELECT * FROM mx_rolls WHERE roll_id=? AND deleted_at IS NULL`).get(body.roll_id) as any;
    if (!roll) return reply.code(404).send({ error: "Roll not found" });
    if (body.meter_sent > roll.remaining_meterage) {
      return reply.code(400).send({ error: `Only ${roll.remaining_meterage}m remaining on roll` });
    }

    const job_work_id = body.job_work_id ?? crypto.randomUUID();
    const txn = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO mx_job_work(job_work_id, roll_id, job_worker_id, outward_date, meter_sent, processed_state, notes, updated_at)
        VALUES (?,?,?,?,?,'outward',?,?)
      `,
      ).run(job_work_id, body.roll_id, body.job_worker_id, body.outward_date, body.meter_sent, body.notes ?? null, nowIso());
      db.prepare(
        `UPDATE mx_rolls SET remaining_meterage = remaining_meterage - ?, status='at_job_work', updated_at=?, version=version+1 WHERE roll_id=?`,
      ).run(body.meter_sent, nowIso(), body.roll_id);
    });
    txn();
    return { data: { job_work_id, ...body, processed_state: "outward" } };
  });

  app.post("/mx/job-work/:id/return", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        meter_returned: z.number().positive(),
        inward_date: z.string().min(1),
        notes: z.string().optional(),
        received_by: z.string().optional(),
        confirm_receive: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const jw = db.prepare(`SELECT * FROM mx_job_work WHERE job_work_id=? AND deleted_at IS NULL`).get(id) as any;
    if (!jw) return reply.code(404).send({ error: "Job work not found" });
    if (jw.processed_state !== "outward") return reply.code(400).send({ error: "Already returned" });

    const shortage = Math.max(0, Number(jw.meter_sent) - body.meter_returned);
    const confirmedAt = body.confirm_receive ? nowIso() : null;

    const txn = db.transaction(() => {
      db.prepare(
        `
        UPDATE mx_job_work SET
          meter_returned=?, inward_date=?, processed_state='inward',
          notes=COALESCE(?, notes),
          shortage_meters=?,
          received_by=?,
          received_confirmed_at=?,
          updated_at=?, version=version+1
        WHERE job_work_id=?
      `,
      ).run(
        body.meter_returned,
        body.inward_date,
        body.notes ?? null,
        shortage,
        body.received_by ?? null,
        confirmedAt,
        nowIso(),
        id,
      );
      db.prepare(
        `UPDATE mx_rolls SET remaining_meterage = remaining_meterage + ?, status='in_cutting', updated_at=?, version=version+1 WHERE roll_id=?`,
      ).run(body.meter_returned, nowIso(), jw.roll_id);
    });
    txn();
    return {
      ok: true,
      data: {
        meter_sent: jw.meter_sent,
        meter_returned: body.meter_returned,
        shortage_meters: shortage,
        received_confirmed_at: confirmedAt,
      },
    };
  });

  app.post("/mx/job-work/:id/confirm-receive", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ received_by: z.string().optional() }).parse(req.body ?? {});
    const jw = db.prepare(`SELECT * FROM mx_job_work WHERE job_work_id=? AND deleted_at IS NULL`).get(id) as any;
    if (!jw) return reply.code(404).send({ error: "Job work not found" });
    if (jw.processed_state === "outward") {
      return reply.code(400).send({ error: "Record return meters first via /return" });
    }
    db.prepare(
      `UPDATE mx_job_work SET received_confirmed_at=?, received_by=COALESCE(?, received_by), updated_at=?, version=version+1 WHERE job_work_id=?`,
    ).run(nowIso(), body.received_by ?? null, nowIso(), id);
    return { ok: true };
  });
}
