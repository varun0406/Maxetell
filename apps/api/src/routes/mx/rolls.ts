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
             s.name AS supplier_name, v.variant_name, v.color, i.code AS item_code, i.name AS item_name, i.quality,
             pb.bill_no AS purchase_bill_no
      FROM mx_rolls r
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      LEFT JOIN mx_purchase_bills pb ON pb.id = r.purchase_bill_id
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
        purchase_bill_no: z.string().trim().optional(),
        purchase_price: z.number().nonnegative().optional(),
      })
      .parse(req.body);

    const lot = body.lot_no.trim().toUpperCase();
    const dup = db
      .prepare(`SELECT roll_id FROM mx_rolls WHERE (lot_no = ? OR short_code = ?) AND deleted_at IS NULL`)
      .get(lot, lot);
    if (dup) return reply.code(409).send({ error: `Lot no ${lot} already exists` });

    const job_id = body.roll_id ?? crypto.randomUUID();
    let bill_id: number | null = null;
    if (body.purchase_bill_no) {
      const existingBill = db.prepare(`SELECT id FROM mx_purchase_bills WHERE bill_no = ? AND supplier_id = ? AND deleted_at IS NULL`).get(body.purchase_bill_no, body.supplier_id) as { id: number } | undefined;
      if (existingBill) {
        bill_id = existingBill.id;
        // Optional: update total_meterage and total_amount of the bill if needed
        db.prepare(`UPDATE mx_purchase_bills SET total_meterage = COALESCE(total_meterage, 0) + ?, total_amount = COALESCE(total_amount, 0) + ? WHERE id = ?`).run(body.original_meterage, body.original_meterage * (body.purchase_price || 0), bill_id);
      } else {
        bill_id = Number(db.prepare(`INSERT INTO mx_purchase_bills (supplier_id, bill_no, bill_date, total_meterage, total_amount) VALUES (?, ?, ?, ?, ?)`).run(body.supplier_id, body.purchase_bill_no, body.received_date, body.original_meterage, body.original_meterage * (body.purchase_price || 0)).lastInsertRowid);
      }
    }

    db.prepare(
      `
      INSERT INTO mx_rolls(roll_id, short_code, lot_no, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, purchase_bill_id, purchase_price, updated_at)
      VALUES (?,?,?,?,?,?,?,'inward',?,?,?,?,?)
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
      bill_id,
      body.purchase_price ?? null,
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
      SELECT j.*, w.name AS worker_name, r.short_code AS roll_short, r.variant_code, pb.bill_no AS purchase_bill_no, s.name AS supplier_name
      FROM mx_job_work j
      JOIN mx_job_workers w ON w.id = j.job_worker_id
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      LEFT JOIN mx_purchase_bills pb ON pb.id = r.purchase_bill_id
      LEFT JOIN mx_suppliers s ON s.id = r.supplier_id
      WHERE j.deleted_at IS NULL
      ORDER BY j.outward_date DESC
    `,
      )
      .all() as any[];
      
    const jwIds = rows.map((r) => r.job_work_id);
    let returns: any[] = [];
    if (jwIds.length > 0) {
      const placeholders = jwIds.map(() => "?").join(",");
      returns = db.prepare(`SELECT * FROM mx_job_work_returns WHERE job_work_id IN (${placeholders}) ORDER BY created_at ASC`).all(...jwIds) as any[];
    }
    
    for (const r of rows) {
      r.returns = returns.filter((ret) => ret.job_work_id === r.job_work_id);
    }
    
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
        job_work_ref: z.string().optional(),
        transporter: z.string().optional(),
        lr_no: z.string().optional(),
        vehicle_no: z.string().optional(),
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
        INSERT INTO mx_job_work(job_work_id, roll_id, job_worker_id, outward_date, meter_sent, processed_state, notes, job_work_ref, transporter, lr_no, vehicle_no, updated_at)
        VALUES (?,?,?,?,?,'outward',?,?,?,?,?,?)
      `,
      ).run(job_work_id, body.roll_id, body.job_worker_id, body.outward_date, body.meter_sent, body.notes ?? null, body.job_work_ref ?? null, body.transporter ?? null, body.lr_no ?? null, body.vehicle_no ?? null, nowIso());
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
        meter_returned: z.number().nonnegative(),
        inward_date: z.string().min(1),
        notes: z.string().optional(),
        received_by: z.string().optional(),
        confirm_receive: z.boolean().optional().default(true),
        quality_result: z.enum(["accepted", "defect", "rejected"]).optional(),
        quality_notes: z.string().optional(),
        is_final: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const jw = db.prepare(`SELECT * FROM mx_job_work WHERE job_work_id=? AND deleted_at IS NULL`).get(id) as any;
    if (!jw) return reply.code(404).send({ error: "Job work not found" });
    if (jw.processed_state !== "outward") return reply.code(400).send({ error: "Already completed or returned" });

    const roll = db.prepare(`SELECT * FROM mx_rolls WHERE roll_id=?`).get(jw.roll_id) as any;
    
    const newMeterReturned = Number(jw.meter_returned) + body.meter_returned;
    const shortage = body.is_final ? Math.max(0, Number(jw.meter_sent) - newMeterReturned) : 0;
    const confirmedAt = body.confirm_receive ? nowIso() : null;

    let splitRollId = null;
    let splitShortCode = null;
    if (body.meter_returned > 0) {
      splitRollId = crypto.randomUUID();
      // find how many returns already exist to append -P1, -P2 etc.
      const returnCount = (db.prepare(`SELECT COUNT(*) as c FROM mx_job_work_returns WHERE job_work_id=?`).get(id) as any).c;
      splitShortCode = `${roll.short_code}-P${returnCount + 1}`;
    }

    const txn = db.transaction(() => {
      // 1. Create a split roll if returning material
      if (splitRollId && splitShortCode) {
        db.prepare(`
          INSERT INTO mx_rolls(roll_id, short_code, lot_no, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          splitRollId, splitShortCode, splitShortCode, roll.supplier_id, roll.variant_code, 
          body.meter_returned, body.meter_returned, 'in_cutting', body.inward_date, body.notes ?? null, nowIso()
        );
        
        // Insert into mx_job_work_returns
        db.prepare(`
          INSERT INTO mx_job_work_returns(job_work_id, returned_roll_id, meter_returned, inward_date, quality_result, quality_notes)
          VALUES (?,?,?,?,?,?)
        `).run(
          id, splitRollId, body.meter_returned, body.inward_date, body.quality_result ?? null, body.quality_notes ?? null
        );
      }

      // 2. Update job work record
      if (body.is_final) {
        db.prepare(`
          UPDATE mx_job_work SET
            meter_returned=?, inward_date=?, processed_state='inward',
            notes=COALESCE(?, notes),
            shortage_meters=?,
            received_by=?,
            received_confirmed_at=?,
            quality_result=?,
            quality_notes=?,
            updated_at=?, version=version+1
          WHERE job_work_id=?
        `).run(
          newMeterReturned, body.inward_date, body.notes ?? null, shortage, body.received_by ?? null, confirmedAt, body.quality_result ?? null, body.quality_notes ?? null, nowIso(), id
        );
      } else {
        db.prepare(`
          UPDATE mx_job_work SET
            meter_returned=?,
            notes=COALESCE(?, notes),
            updated_at=?, version=version+1
          WHERE job_work_id=?
        `).run(
          newMeterReturned, body.notes ?? null, nowIso(), id
        );
      }
    });
    txn();
    return {
      ok: true,
      data: {
        meter_sent: jw.meter_sent,
        meter_returned: newMeterReturned,
        shortage_meters: shortage,
        received_confirmed_at: confirmedAt,
        split_roll_id: splitRollId,
        split_short_code: splitShortCode,
      },
    };
  });

  app.post("/mx/job-work/bulk-return", async (req, reply) => {
    const body = z
      .object({
        job_worker_id: z.number().int().positive(),
        variant_code: z.string().min(1),
        total_meter_returned: z.number().positive(),
        roll_count: z.number().int().positive().default(1),
        inward_date: z.string().min(1),
        quality_result: z.enum(["accepted", "defect", "rejected"]).optional(),
        quality_notes: z.string().optional(),
        declare_shortage: z.number().nonnegative().optional().default(0),
      })
      .parse(req.body);

    // Fetch open outward records for this worker and variant (FIFO)
    const openOutwards = db.prepare(`
      SELECT j.*, r.short_code, r.supplier_id 
      FROM mx_job_work j
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      WHERE j.job_worker_id = ? AND r.variant_code = ? AND j.processed_state = 'outward' AND j.deleted_at IS NULL
      ORDER BY j.outward_date ASC, j.created_at ASC
    `).all(body.job_worker_id, body.variant_code) as any[];

    if (openOutwards.length === 0) {
      return reply.code(400).send({ error: "No open job work found for this variant and job worker" });
    }

    let remainingToReturn = body.total_meter_returned;
    let remainingShortage = body.declare_shortage;
    let totalPendingMeters = openOutwards.reduce((acc, curr) => acc + (curr.meter_sent - curr.meter_returned), 0);

    if (remainingToReturn + remainingShortage > totalPendingMeters) {
      return reply.code(400).send({ error: `Cannot settle ${remainingToReturn + remainingShortage}m. Only ${totalPendingMeters}m pending.` });
    }

    const metersPerRoll = body.total_meter_returned / body.roll_count;
    const splitRolls: any[] = [];
    const baseShortCode = openOutwards[0].short_code; // just use the oldest roll's shortcode as base

    const txn = db.transaction(() => {
      // 1. Generate Physical Rolls (split rolls)
      for (let i = 0; i < body.roll_count; i++) {
        const splitRollId = crypto.randomUUID();
        const splitShortCode = `${baseShortCode}-B${Date.now().toString().slice(-4)}-${i+1}`;
        db.prepare(`
          INSERT INTO mx_rolls(roll_id, short_code, lot_no, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          splitRollId, splitShortCode, splitShortCode, openOutwards[0].supplier_id, body.variant_code, 
          metersPerRoll, metersPerRoll, 'in_cutting', body.inward_date, null, nowIso()
        );
        splitRolls.push(splitRollId);
      }

      // 2. FIFO Settlement against outward records
      for (const jw of openOutwards) {
        if (remainingToReturn <= 0 && remainingShortage <= 0) break;

        const pendingOnThisRecord = jw.meter_sent - jw.meter_returned;
        if (pendingOnThisRecord <= 0) continue;

        // How much of the return can we apply here?
        const returnToApply = Math.min(pendingOnThisRecord, remainingToReturn);
        remainingToReturn -= returnToApply;

        // How much of the shortage can we apply here?
        const remainingPendingAfterReturn = pendingOnThisRecord - returnToApply;
        const shortageToApply = Math.min(remainingPendingAfterReturn, remainingShortage);
        remainingShortage -= shortageToApply;

        const newMeterReturned = jw.meter_returned + returnToApply;
        
        // Is this record fully settled? (if newMeterReturned + applied shortage >= meter_sent)
        // Or if we are applying the final bit of return and shortage and they explicitly declared it.
        // Actually, if we apply ANY shortage, it means we are closing this record (because shortage is a write-off).
        // Let's just close it if (returnToApply + shortageToApply == pendingOnThisRecord) OR (shortageToApply > 0).
        const isFullySettled = (newMeterReturned + shortageToApply >= jw.meter_sent);

        // Record the return in mx_job_work_returns
        // Since we created bulk rolls, we just map the return to the first generated roll, or null?
        // Wait, mx_job_work_returns requires returned_roll_id. We can use splitRolls[0].
        if (returnToApply > 0) {
          db.prepare(`
            INSERT INTO mx_job_work_returns(job_work_id, returned_roll_id, meter_returned, inward_date, quality_result, quality_notes)
            VALUES (?,?,?,?,?,?)
          `).run(jw.job_work_id, splitRolls[0], returnToApply, body.inward_date, body.quality_result ?? null, body.quality_notes ?? null);
        }

        // Update mx_job_work
        if (isFullySettled) {
           db.prepare(`
            UPDATE mx_job_work SET
              meter_returned=?, inward_date=?, processed_state='inward',
              shortage_meters=shortage_meters + ?,
              received_by='warehouse',
              received_confirmed_at=?,
              quality_result=?,
              quality_notes=?,
              updated_at=?, version=version+1
            WHERE job_work_id=?
          `).run(newMeterReturned, body.inward_date, shortageToApply, nowIso(), body.quality_result ?? null, body.quality_notes ?? null, nowIso(), jw.job_work_id);
        } else {
           db.prepare(`
            UPDATE mx_job_work SET
              meter_returned=?,
              updated_at=?, version=version+1
            WHERE job_work_id=?
          `).run(newMeterReturned, nowIso(), jw.job_work_id);
        }
      }
    });

    txn();

    return {
      ok: true,
      data: {
        settled_meterage: body.total_meter_returned,
        rolls_generated: splitRolls.length
      }
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
