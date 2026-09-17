import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

export async function registerMxMastersRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // Items
  app.get("/mx/items", async () => {
    const items = db.prepare(`SELECT * FROM mx_items WHERE deleted_at IS NULL ORDER BY code`).all();
    const variants = db
      .prepare(
        `
      SELECT v.*, i.code AS item_code, i.name AS item_name, i.quality
      FROM mx_item_variants v
      JOIN mx_items i ON i.id = v.item_id
      WHERE v.deleted_at IS NULL AND i.deleted_at IS NULL
      ORDER BY v.variant_code
    `,
      )
      .all();
    return { data: { items, variants } };
  });

  app.post("/mx/items", async (req, reply) => {
    const body = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), quality: z.string().optional() }).parse(req.body);
    const dup = db.prepare(`SELECT id FROM mx_items WHERE (code=? OR name=?) AND deleted_at IS NULL`).get(body.code, body.name);
    if (dup) return reply.code(409).send({ error: "Item code or name already exists" });
    const id = Number(db.prepare(`INSERT INTO mx_items(code, name, quality) VALUES (?,?,?)`).run(body.code, body.name, body.quality ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });

  app.patch("/mx/items/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), quality: z.string().optional() }).parse(req.body);
    db.prepare(`UPDATE mx_items SET code=?, name=?, quality=?, updated_at=? WHERE id=?`).run(body.code, body.name, body.quality ?? null, nowIso(), id);
    return { ok: true };
  });

  app.delete("/mx/items/:id", async (req) => {
    db.prepare(`UPDATE mx_items SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  app.post("/mx/variants", async (req, reply) => {
    const body = z.object({
      item_id: z.number().int().positive(),
      variant_code: z.string().trim().min(1),
      variant_name: z.string().trim().min(1),
      color: z.string().optional(),
    }).parse(req.body);
    const dup = db.prepare(`SELECT id FROM mx_item_variants WHERE variant_code=? AND deleted_at IS NULL`).get(body.variant_code);
    if (dup) return reply.code(409).send({ error: "Variant code exists" });
    const id = Number(
      db.prepare(`INSERT INTO mx_item_variants(item_id, variant_code, variant_name, color) VALUES (?,?,?,?)`)
        .run(body.item_id, body.variant_code, body.variant_name, body.color ?? null).lastInsertRowid,
    );
    return { data: { id, ...body } };
  });

  app.delete("/mx/variants/:id", async (req) => {
    db.prepare(`UPDATE mx_item_variants SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  // Suppliers
  app.get("/mx/suppliers", async () => ({ data: db.prepare(`SELECT * FROM mx_suppliers WHERE deleted_at IS NULL ORDER BY name`).all() }));
  app.post("/mx/suppliers", async (req) => {
    const body = z.object({ name: z.string().trim().min(1), contact: z.string().optional() }).parse(req.body);
    const id = Number(db.prepare(`INSERT OR IGNORE INTO mx_suppliers(name, contact) VALUES (?,?)`).run(body.name, body.contact ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/mx/suppliers/:id", async (req) => {
    db.prepare(`UPDATE mx_suppliers SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  // Job workers (mills)
  app.get("/mx/job-workers", async () => ({ data: db.prepare(`SELECT * FROM mx_job_workers WHERE deleted_at IS NULL ORDER BY name`).all() }));
  app.post("/mx/job-workers", async (req) => {
    const body = z.object({
      name: z.string().trim().min(1),
      contact: z.string().optional(),
      job_work_type: z.string().optional(),
      gstin: z.string().optional(),
      address: z.string().optional(),
      capacity_meters_per_day: z.number().optional(),
      default_turnaround_days: z.number().int().optional(),
    }).parse(req.body);
    const id = Number(db.prepare(
      `INSERT OR IGNORE INTO mx_job_workers(name, contact, job_work_type, gstin, address, capacity_meters_per_day, default_turnaround_days) VALUES (?,?,?,?,?,?,?)`,
    ).run(body.name, body.contact ?? null, body.job_work_type ?? null, body.gstin ?? null, body.address ?? null, body.capacity_meters_per_day ?? null, body.default_turnaround_days ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.patch("/mx/job-workers/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = z.object({
      name: z.string().trim().min(1),
      contact: z.string().optional(),
      job_work_type: z.string().optional(),
      gstin: z.string().optional(),
      address: z.string().optional(),
      capacity_meters_per_day: z.number().optional(),
      default_turnaround_days: z.number().int().optional(),
    }).parse(req.body);
    db.prepare(
      `UPDATE mx_job_workers SET name=?, contact=?, job_work_type=?, gstin=?, address=?, capacity_meters_per_day=?, default_turnaround_days=?, updated_at=? WHERE id=?`,
    ).run(body.name, body.contact ?? null, body.job_work_type ?? null, body.gstin ?? null, body.address ?? null, body.capacity_meters_per_day ?? null, body.default_turnaround_days ?? null, nowIso(), id);
    return { ok: true };
  });
  app.delete("/mx/job-workers/:id", async (req) => {
    db.prepare(`UPDATE mx_job_workers SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  /** Job Worker 360° Account Page — flagship entity-first endpoint */
  app.get("/mx/job-workers/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const worker = db.prepare(`SELECT * FROM mx_job_workers WHERE id=? AND deleted_at IS NULL`).get(id) as any;
    if (!worker) return reply.code(404).send({ error: "Job worker not found" });

    // Tab 1 — "With Them Now": open jobs
    const openJobs = db.prepare(`
      SELECT j.*, r.short_code AS roll_short, COALESCE(r.lot_no, r.short_code) AS lot_display,
             r.variant_code, v.variant_name, v.color, i.code AS item_code, i.name AS item_name,
             CAST((julianday('now') - julianday(j.outward_date)) AS INTEGER) AS days_out,
             pb.bill_no AS purchase_bill_no, s.name AS supplier_name
      FROM mx_job_work j
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      LEFT JOIN mx_purchase_bills pb ON pb.id = r.purchase_bill_id
      LEFT JOIN mx_suppliers s ON s.id = r.supplier_id
      WHERE j.job_worker_id = ? AND j.deleted_at IS NULL AND j.processed_state = 'outward'
      ORDER BY j.outward_date ASC
    `).all(id);

    const totalMetersOut = openJobs.reduce((s: number, j: any) => s + (j.meter_sent - (j.meter_returned ?? 0)), 0);

    // Tab 2 — Capacity & Load
    const capacityInfo = {
      declared_capacity: worker.capacity_meters_per_day ?? null,
      default_turnaround_days: worker.default_turnaround_days ?? null,
      current_meters_out: totalMetersOut,
      open_job_count: openJobs.length,
      days_of_work_queued: worker.capacity_meters_per_day
        ? Math.ceil(totalMetersOut / worker.capacity_meters_per_day)
        : null,
    };

    // Tab 3 — History: all closed/returned jobs
    const history = db.prepare(`
      SELECT j.*, r.short_code AS roll_short, COALESCE(r.lot_no, r.short_code) AS lot_display,
             r.variant_code, v.variant_name, v.color, i.name AS item_name,
             CAST((julianday(COALESCE(j.inward_date, 'now')) - julianday(j.outward_date)) AS INTEGER) AS turnaround_days,
             pb.bill_no AS purchase_bill_no, s.name AS supplier_name
      FROM mx_job_work j
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      LEFT JOIN mx_purchase_bills pb ON pb.id = r.purchase_bill_id
      LEFT JOIN mx_suppliers s ON s.id = r.supplier_id
      WHERE j.job_worker_id = ? AND j.deleted_at IS NULL AND j.processed_state IN ('inward','closed')
      ORDER BY j.inward_date DESC
      LIMIT 200
    `).all(id);

    // Summary stats (trust indicators)
    const stats = db.prepare(`
      SELECT
        COUNT(1) AS total_jobs,
        AVG(CAST((julianday(COALESCE(j.inward_date, 'now')) - julianday(j.outward_date)) AS REAL)) AS avg_turnaround_days,
        CASE WHEN SUM(j.meter_sent) > 0
          THEN (SUM(COALESCE(j.shortage_meters, 0)) / SUM(j.meter_sent)) * 100
          ELSE 0 END AS shortage_pct,
        SUM(COALESCE(j.shortage_meters, 0)) AS total_shortage_m,
        SUM(CASE WHEN j.quality_result = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN j.quality_result = 'defect' THEN 1 ELSE 0 END) AS defect_count
      FROM mx_job_work j
      WHERE j.job_worker_id = ? AND j.deleted_at IS NULL AND j.processed_state IN ('inward','closed')
    `).get(id);

    return {
      data: {
        worker,
        open_jobs: openJobs,
        total_meters_out: totalMetersOut,
        capacity: capacityInfo,
        history,
        stats,
      },
    };
  });

  // Godowns
  app.get("/mx/godowns", async () => ({ data: db.prepare(`SELECT * FROM mx_godowns WHERE deleted_at IS NULL ORDER BY name`).all() }));
  app.post("/mx/godowns", async (req) => {
    const body = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), location: z.string().optional() }).parse(req.body);
    const id = Number(db.prepare(`INSERT OR IGNORE INTO mx_godowns(code, name, location) VALUES (?,?,?)`).run(body.code, body.name, body.location ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/mx/godowns/:id", async (req) => {
    db.prepare(`UPDATE mx_godowns SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  // Parties (billing / onboarding)
  app.get("/mx/parties", async () => ({
    data: db.prepare(`SELECT * FROM mx_parties WHERE deleted_at IS NULL ORDER BY name`).all(),
  }));
  app.post("/mx/parties", async (req, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1),
        address_line: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        gstin: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const dup = db.prepare(`SELECT id FROM mx_parties WHERE LOWER(name)=LOWER(?) AND deleted_at IS NULL`).get(body.name);
    if (dup) return reply.code(409).send({ error: "Party already exists" });
    const id = Number(
      db
        .prepare(
          `INSERT INTO mx_parties(name, address_line, city, state, gstin, phone, notes) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          body.name,
          body.address_line ?? null,
          body.city ?? null,
          body.state ?? null,
          body.gstin ?? null,
          body.phone ?? null,
          body.notes ?? null,
        ).lastInsertRowid,
    );
    return { data: { id, ...body } };
  });
  app.patch("/mx/parties/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = z
      .object({
        name: z.string().trim().min(1),
        address_line: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        gstin: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    db.prepare(
      `UPDATE mx_parties SET name=?, address_line=?, city=?, state=?, gstin=?, phone=?, notes=?, updated_at=? WHERE id=?`,
    ).run(
      body.name,
      body.address_line ?? null,
      body.city ?? null,
      body.state ?? null,
      body.gstin ?? null,
      body.phone ?? null,
      body.notes ?? null,
      nowIso(),
      id,
    );
    return { ok: true };
  });
  app.delete("/mx/parties/:id", async (req) => {
    db.prepare(`UPDATE mx_parties SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  // Agents (sales / delivery agents on challan)
  app.get("/mx/agents", async () => ({
    data: db.prepare(`SELECT * FROM mx_agents WHERE deleted_at IS NULL ORDER BY name`).all(),
  }));
  app.post("/mx/agents", async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(1), phone: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const dup = db.prepare(`SELECT id FROM mx_agents WHERE LOWER(name)=LOWER(?) AND deleted_at IS NULL`).get(body.name);
    if (dup) return reply.code(409).send({ error: "Agent already exists" });
    const id = Number(
      db.prepare(`INSERT INTO mx_agents(name, phone, notes) VALUES (?,?,?)`).run(body.name, body.phone ?? null, body.notes ?? null)
        .lastInsertRowid,
    );
    return { data: { id, ...body } };
  });
  app.delete("/mx/agents/:id", async (req) => {
    db.prepare(`UPDATE mx_agents SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  // Ship-to addresses (can link to party)
  app.get("/mx/addresses", async () => ({
    data: db
      .prepare(
        `
      SELECT a.*, p.name AS party_master_name, p.gstin AS party_gstin, p.phone AS party_phone
      FROM mx_delivery_addresses a
      LEFT JOIN mx_parties p ON p.id = a.party_id
      WHERE a.deleted_at IS NULL
      ORDER BY a.party_name
    `,
      )
      .all(),
  }));
  app.post("/mx/addresses", async (req) => {
    const body = z
      .object({
        party_id: z.number().int().positive().optional(),
        party_name: z.string().trim().min(1).optional(),
        address_line: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        phone: z.string().optional(),
        label: z.string().optional(),
      })
      .parse(req.body);

    let partyName = body.party_name ?? "";
    if (body.party_id) {
      const p = db.prepare(`SELECT name FROM mx_parties WHERE id=? AND deleted_at IS NULL`).get(body.party_id) as { name: string } | undefined;
      if (p) partyName = partyName || p.name;
    }
    if (!partyName) partyName = "Ship-to";

    const id = Number(
      db
        .prepare(
          `INSERT INTO mx_delivery_addresses(party_id, party_name, address_line, city, state, phone, label) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          body.party_id ?? null,
          partyName,
          body.address_line ?? null,
          body.city ?? null,
          body.state ?? null,
          body.phone ?? null,
          body.label ?? null,
        ).lastInsertRowid,
    );
    return { data: { id, party_name: partyName, ...body } };
  });
  app.delete("/mx/addresses/:id", async (req) => {
    db.prepare(`UPDATE mx_delivery_addresses SET deleted_at=?, updated_at=? WHERE id=?`).run(nowIso(), nowIso(), Number((req.params as any).id));
    return { ok: true };
  });

  app.post("/mx/demo/reseed", async () => {
    const { reseedMaxwellDemo } = await import("../../seed.js");
    const counts = reseedMaxwellDemo(db);
    return { ok: true, data: counts };
  });
}
