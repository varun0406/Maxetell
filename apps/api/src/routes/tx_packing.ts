import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

function generatePackingId(db: Db): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const like = `PKG-${today}-%`;
  const { c } = db.prepare(`SELECT COUNT(1) AS c FROM tx_packing WHERE packing_id LIKE ?`).get(like) as { c: number };
  return `PKG-${today}-${String(c + 1).padStart(3, "0")}`;
}

const PackingBody = z.object({
  source_type:  z.enum(["stock_in", "mill_return"]),
  source_id:    z.number().int().positive(),
  variant_code: z.string().trim().min(1),
  meter:        z.number().positive(),
  packing_date: z.string().min(1),
  notes:        z.string().optional(),
  pieces: z.array(z.object({ meter: z.number().positive(), notes: z.string().optional() })).optional(),
});

const PatchStatusBody = z.object({ status: z.enum(["packed", "in_godown", "dispatched", "faulty"]) });

export async function registerTxPackingRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/tx/packing", async (req) => {
    const { status, variant_code } = (req.query as any);
    let sql = `
      SELECT p.*, v.variant_name, v.color, i.code AS item_code, i.name AS item_name,
             g.name AS godown_name
      FROM tx_packing p
      JOIN tx_item_variants v ON v.variant_code = p.variant_code
      JOIN tx_items i ON i.id = v.item_id
      LEFT JOIN tx_godown_stock gs ON gs.packing_id = p.packing_id
      LEFT JOIN tx_godowns g ON g.id = gs.godown_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { sql += ` AND p.status = ?`; params.push(status); }
    if (variant_code) { sql += ` AND p.variant_code = ?`; params.push(variant_code); }
    sql += ` ORDER BY p.packing_date DESC, p.id DESC`;
    return { data: db.prepare(sql).all(...params) };
  });

  app.get("/tx/packing/:packing_id", async (req) => {
    const { packing_id } = req.params as { packing_id: string };
    const row = db.prepare(`
      SELECT p.*, v.variant_name, v.color, i.code AS item_code, i.name AS item_name
      FROM tx_packing p
      JOIN tx_item_variants v ON v.variant_code = p.variant_code
      JOIN tx_items i ON i.id = v.item_id
      WHERE p.packing_id = ?
    `).get(packing_id);
    if (!row) return { data: null };
    return { data: row };
  });

  // Create one or more packing pieces from a source
  app.post("/tx/packing", async (req) => {
    const body = PackingBody.parse(req.body);
    const pieces = body.pieces && body.pieces.length > 0
      ? body.pieces
      : [{ meter: body.meter, notes: body.notes }];

    const insert = db.prepare(
      `INSERT INTO tx_packing(packing_id, source_type, source_id, variant_code, meter, packing_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const created = [];
    for (const piece of pieces) {
      const packing_id = generatePackingId(db);
      insert.run(packing_id, body.source_type, body.source_id, body.variant_code, piece.meter, body.packing_date, piece.notes ?? null);
      created.push({ packing_id, ...piece });
    }
    return { data: created };
  });

  app.patch("/tx/packing/:packing_id/status", async (req) => {
    const { packing_id } = req.params as { packing_id: string };
    const { status } = PatchStatusBody.parse(req.body);
    db.prepare(`UPDATE tx_packing SET status = ? WHERE packing_id = ?`).run(status, packing_id);
    return { ok: true };
  });

  app.delete("/tx/packing/:packing_id", async (req) => {
    const { packing_id } = req.params as { packing_id: string };
    db.prepare(`DELETE FROM tx_packing WHERE packing_id = ?`).run(packing_id);
    return { ok: true };
  });
}
