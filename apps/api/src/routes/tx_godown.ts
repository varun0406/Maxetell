import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const ReceiveBody = z.object({
  packing_id:    z.string().trim().min(1),
  godown_id:     z.number().int().positive(),
  received_date: z.string().min(1),
});

export async function registerTxGodownRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // Current godown stock
  app.get("/tx/godown/stock", async (req) => {
    const { godown_id } = req.query as any;
    let sql = `
      SELECT gs.*, g.name AS godown_name, g.code AS godown_code,
             p.meter, p.variant_code, p.packing_date, p.notes AS packing_notes,
             v.variant_name, v.color,
             i.code AS item_code, i.name AS item_name
      FROM tx_godown_stock gs
      JOIN tx_godowns g ON g.id = gs.godown_id
      JOIN tx_packing p ON p.packing_id = gs.packing_id
      JOIN tx_item_variants v ON v.variant_code = p.variant_code
      JOIN tx_items i ON i.id = v.item_id
      WHERE gs.status = 'in_godown'
    `;
    const params: any[] = [];
    if (godown_id) { sql += ` AND gs.godown_id = ?`; params.push(Number(godown_id)); }
    sql += ` ORDER BY gs.received_date DESC`;
    return { data: db.prepare(sql).all(...params) };
  });

  // Summary per godown
  app.get("/tx/godown/summary", async () => {
    const rows = db.prepare(`
      SELECT g.id, g.name, g.code,
             COUNT(gs.id) AS pieces,
             COALESCE(SUM(p.meter), 0) AS total_meter
      FROM tx_godowns g
      LEFT JOIN tx_godown_stock gs ON gs.godown_id = g.id AND gs.status = 'in_godown'
      LEFT JOIN tx_packing p ON p.packing_id = gs.packing_id
      GROUP BY g.id
      ORDER BY g.name
    `).all();
    return { data: rows };
  });

  // Receive packing ID into godown (scan or manual entry)
  app.post("/tx/godown/receive", async (req, reply) => {
    const body = ReceiveBody.parse(req.body);
    // Check packing exists
    const packing = db.prepare(`SELECT * FROM tx_packing WHERE packing_id = ?`).get(body.packing_id) as any;
    if (!packing) return reply.code(404).send({ error: "Packing ID not found" });
    if (packing.status === "dispatched") return reply.code(400).send({ error: "Packing ID already dispatched" });
    // Upsert into godown stock
    db.prepare(`
      INSERT INTO tx_godown_stock(packing_id, godown_id, received_date, status)
      VALUES (?, ?, ?, 'in_godown')
      ON CONFLICT(packing_id) DO UPDATE SET godown_id=excluded.godown_id, received_date=excluded.received_date, status='in_godown'
    `).run(body.packing_id, body.godown_id, body.received_date);
    db.prepare(`UPDATE tx_packing SET status='in_godown' WHERE packing_id=?`).run(body.packing_id);
    return { ok: true, packing };
  });

  // Remove from godown (reverse)
  app.delete("/tx/godown/stock/:packing_id", async (req) => {
    const { packing_id } = req.params as { packing_id: string };
    db.prepare(`DELETE FROM tx_godown_stock WHERE packing_id = ?`).run(packing_id);
    db.prepare(`UPDATE tx_packing SET status='packed' WHERE packing_id=?`).run(packing_id);
    return { ok: true };
  });
}
