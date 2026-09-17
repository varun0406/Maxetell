import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

export async function registerMxPurchaseBillRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/purchase-bills", async () => {
    const rows = db
      .prepare(
        `
      SELECT pb.*, s.name AS supplier_name
      FROM mx_purchase_bills pb
      JOIN mx_suppliers s ON s.id = pb.supplier_id
      WHERE pb.deleted_at IS NULL
      ORDER BY pb.bill_date DESC, pb.created_at DESC
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/purchase-bills/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const bill = db
      .prepare(
        `
      SELECT pb.*, s.name AS supplier_name
      FROM mx_purchase_bills pb
      JOIN mx_suppliers s ON s.id = pb.supplier_id
      WHERE pb.id = ? AND pb.deleted_at IS NULL
    `,
      )
      .get(id) as any;
    if (!bill) return reply.code(404).send({ error: "Purchase bill not found" });

    const rolls = db
      .prepare(
        `
      SELECT r.*, r.roll_id AS job_id, COALESCE(r.lot_no, r.short_code) AS lot_display,
             v.variant_name, v.color, i.code AS item_code, i.name AS item_name
      FROM mx_rolls r
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE r.purchase_bill_id = ? AND r.deleted_at IS NULL
      ORDER BY r.received_date DESC
    `,
      )
      .all(id);

    return { data: { ...bill, rolls } };
  });

  app.post("/mx/purchase-bills", async (req) => {
    const body = z
      .object({
        bill_no: z.string().trim().min(1),
        supplier_id: z.number().int().positive(),
        bill_date: z.string().min(1),
        total_meterage: z.number().optional(),
        total_amount: z.number().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const id = Number(
      db
        .prepare(
          `INSERT INTO mx_purchase_bills(bill_no, supplier_id, bill_date, total_meterage, total_amount, notes)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(
          body.bill_no,
          body.supplier_id,
          body.bill_date,
          body.total_meterage ?? null,
          body.total_amount ?? null,
          body.notes ?? null,
        ).lastInsertRowid,
    );
    return { data: { id, ...body } };
  });

  app.patch("/mx/purchase-bills/:id", async (req, reply) => {
    const id = Number((req.params as any).id);
    const body = z
      .object({
        bill_no: z.string().trim().min(1),
        supplier_id: z.number().int().positive(),
        bill_date: z.string().min(1),
        total_meterage: z.number().optional(),
        total_amount: z.number().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const r = db
      .prepare(
        `UPDATE mx_purchase_bills SET bill_no=?, supplier_id=?, bill_date=?, total_meterage=?, total_amount=?, notes=?, updated_at=?
         WHERE id=? AND deleted_at IS NULL`,
      )
      .run(
        body.bill_no,
        body.supplier_id,
        body.bill_date,
        body.total_meterage ?? null,
        body.total_amount ?? null,
        body.notes ?? null,
        nowIso(),
        id,
      );
    if (r.changes === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });

  app.delete("/mx/purchase-bills/:id", async (req) => {
    db.prepare(`UPDATE mx_purchase_bills SET deleted_at=?, updated_at=? WHERE id=?`).run(
      nowIso(),
      nowIso(),
      Number((req.params as any).id),
    );
    return { ok: true };
  });
}
