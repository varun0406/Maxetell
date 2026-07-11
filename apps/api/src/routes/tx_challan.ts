import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

function generateChallanNo(db: Db): string {
  const year = new Date().getFullYear();
  const { c } = db.prepare(`SELECT COUNT(1) AS c FROM tx_challans WHERE challan_no LIKE 'DC-${year}-%'`).get() as { c: number };
  return `DC-${year}-${String(c + 1).padStart(4, "0")}`;
}

const ChallanBody = z.object({
  challan_date: z.string().min(1),
  address_id:   z.number().int().positive().optional(),
  assigned_to:  z.number().int().positive().optional(),
  notes:        z.string().optional(),
});

const AddItemBody = z.object({
  packing_id: z.string().trim().min(1),
});

const PatchStatusBody = z.object({
  status: z.enum(["created", "assigned", "dispatched", "delivered"]),
});

export async function registerTxChallanRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // List challans
  app.get("/tx/challans", async (req) => {
    const { status } = req.query as any;
    let sql = `
      SELECT ch.*, a.party_name, a.city,
             (SELECT COUNT(1) FROM tx_challan_items ci WHERE ci.challan_id = ch.id) AS item_count,
             (SELECT COALESCE(SUM(ci.meter),0) FROM tx_challan_items ci WHERE ci.challan_id = ch.id) AS total_meter
      FROM tx_challans ch
      LEFT JOIN tx_delivery_addresses a ON a.id = ch.address_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { sql += ` AND ch.status = ?`; params.push(status); }
    sql += ` ORDER BY ch.challan_date DESC, ch.id DESC`;
    return { data: db.prepare(sql).all(...params) };
  });

  // Single challan with line items
  app.get("/tx/challans/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const challan = db.prepare(`
      SELECT ch.*, a.party_name, a.address_line, a.city, a.state
      FROM tx_challans ch
      LEFT JOIN tx_delivery_addresses a ON a.id = ch.address_id
      WHERE ch.id = ?
    `).get(Number(id));
    if (!challan) return reply.code(404).send({ error: "Not found" });
    const items = db.prepare(`
      SELECT ci.*, p.meter, p.packing_date, p.status AS packing_status,
             v.variant_name, v.color, it.code AS item_code, it.name AS item_name
      FROM tx_challan_items ci
      JOIN tx_packing p ON p.packing_id = ci.packing_id
      JOIN tx_item_variants v ON v.variant_code = ci.variant_code
      JOIN tx_items it ON it.id = v.item_id
      WHERE ci.challan_id = ?
      ORDER BY ci.id
    `).all(Number(id));
    return { data: { ...challan as object, items } };
  });

  // Create challan
  app.post("/tx/challans", async (req) => {
    const body = ChallanBody.parse(req.body);
    const challan_no = generateChallanNo(db);
    const id = Number(
      db.prepare(`INSERT INTO tx_challans(challan_no, challan_date, address_id, assigned_to, notes) VALUES (?,?,?,?,?)`)
        .run(challan_no, body.challan_date, body.address_id ?? null, body.assigned_to ?? null, body.notes ?? null).lastInsertRowid,
    );
    return { data: { id, challan_no, ...body, status: "created" } };
  });

  // Add packing ID to challan
  app.post("/tx/challans/:id/items", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { packing_id } = AddItemBody.parse(req.body);
    const packing = db.prepare(`SELECT * FROM tx_packing WHERE packing_id = ?`).get(packing_id) as any;
    if (!packing) return reply.code(404).send({ error: "Packing ID not found" });
    if (packing.status === "dispatched") return reply.code(400).send({ error: "Already dispatched" });
    const iid = Number(
      db.prepare(`INSERT INTO tx_challan_items(challan_id, packing_id, variant_code, meter) VALUES (?,?,?,?)`)
        .run(Number(id), packing_id, packing.variant_code, packing.meter).lastInsertRowid,
    );
    return { data: { id: iid, challan_id: Number(id), packing_id, variant_code: packing.variant_code, meter: packing.meter } };
  });

  // Remove item from challan
  app.delete("/tx/challans/:id/items/:item_id", async (req) => {
    const { item_id } = req.params as { id: string; item_id: string };
    db.prepare(`DELETE FROM tx_challan_items WHERE id = ?`).run(Number(item_id));
    return { ok: true };
  });

  // Update challan status — on dispatched, mark all packing IDs as dispatched
  app.patch("/tx/challans/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = PatchStatusBody.parse(req.body);
    const challan = db.prepare(`SELECT status FROM tx_challans WHERE id = ?`).get(Number(id)) as any;
    if (!challan) return reply.code(404).send({ error: "Not found" });
    db.prepare(`UPDATE tx_challans SET status = ? WHERE id = ?`).run(status, Number(id));
    if (status === "dispatched") {
      const items = db.prepare(`SELECT packing_id FROM tx_challan_items WHERE challan_id = ?`).all(Number(id)) as any[];
      for (const item of items) {
        db.prepare(`UPDATE tx_packing SET status='dispatched' WHERE packing_id=?`).run(item.packing_id);
        db.prepare(`UPDATE tx_godown_stock SET status='dispatched' WHERE packing_id=?`).run(item.packing_id);
      }
    }
    return { ok: true };
  });

  app.delete("/tx/challans/:id", async (req) => {
    db.prepare(`DELETE FROM tx_challans WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });
}
