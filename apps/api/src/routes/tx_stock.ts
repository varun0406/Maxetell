import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

// ── helpers ───────────────────────────────────────────────────────────────────
function makeLotNo(db: Db, prefix: string, table: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const like = `${prefix}-${today}-%`;
  const { c } = db.prepare(`SELECT COUNT(1) AS c FROM ${table} WHERE lot_no LIKE ?`).get(like) as { c: number };
  return `${prefix}-${today}-${String(c + 1).padStart(3, "0")}`;
}

const StockInBody = z.object({
  company_id:    z.number().int().positive(),
  variant_code:  z.string().trim().min(1),
  meter:         z.number().positive(),
  received_date: z.string().min(1),
  notes:         z.string().optional(),
});

const MillOutBody = z.object({
  mill_id:         z.number().int().positive(),
  variant_code:    z.string().trim().min(1),
  meter:           z.number().positive(),
  ref_stock_in_id: z.number().int().positive().optional(),
  sent_date:       z.string().min(1),
  notes:           z.string().optional(),
});

const MillReturnBody = z.object({
  mill_out_id:   z.number().int().positive(),
  variant_code:  z.string().trim().min(1),
  meter:         z.number().positive(),
  received_date: z.string().min(1),
  notes:         z.string().optional(),
});

export async function registerTxStockRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // ── STOCK IN ──────────────────────────────────────────────────────────────
  app.get("/tx/stock-in", async () => {
    const rows = db.prepare(`
      SELECT si.*, c.name AS company_name,
             v.variant_name, v.color,
             i.code AS item_code, i.name AS item_name,
             COALESCE(si.meter - (
               SELECT COALESCE(SUM(mo.meter),0) FROM tx_mill_out mo WHERE mo.ref_stock_in_id = si.id
             ), si.meter) AS balance_meter
      FROM tx_stock_in si
      JOIN tx_companies c ON c.id = si.company_id
      JOIN tx_item_variants v ON v.variant_code = si.variant_code
      JOIN tx_items i ON i.id = v.item_id
      ORDER BY si.received_date DESC, si.id DESC
    `).all();
    return { data: rows };
  });

  app.post("/tx/stock-in", async (req) => {
    const body = StockInBody.parse(req.body);
    const lot_no = makeLotNo(db, "LOT", "tx_stock_in");
    const id = Number(
      db.prepare(`INSERT INTO tx_stock_in(lot_no, company_id, variant_code, meter, received_date, notes) VALUES (?,?,?,?,?,?)`)
        .run(lot_no, body.company_id, body.variant_code, body.meter, body.received_date, body.notes ?? null).lastInsertRowid,
    );
    return { data: { id, lot_no, ...body } };
  });

  app.delete("/tx/stock-in/:id", async (req) => {
    db.prepare(`DELETE FROM tx_stock_in WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });

  // ── MILL OUT ──────────────────────────────────────────────────────────────
  app.get("/tx/mill-out", async () => {
    const rows = db.prepare(`
      SELECT mo.*, m.name AS mill_name,
             v.variant_name, v.color,
             i.code AS item_code, i.name AS item_name,
             COALESCE(si.lot_no, '') AS ref_lot_no,
             COALESCE((
               SELECT SUM(mr.meter) FROM tx_mill_return mr WHERE mr.mill_out_id = mo.id
             ), 0) AS returned_meter
      FROM tx_mill_out mo
      JOIN tx_mills m ON m.id = mo.mill_id
      JOIN tx_item_variants v ON v.variant_code = mo.variant_code
      JOIN tx_items i ON i.id = v.item_id
      LEFT JOIN tx_stock_in si ON si.id = mo.ref_stock_in_id
      ORDER BY mo.sent_date DESC, mo.id DESC
    `).all();
    return { data: rows };
  });

  app.post("/tx/mill-out", async (req) => {
    const body = MillOutBody.parse(req.body);
    const lot_no = makeLotNo(db, "MO", "tx_mill_out");
    const id = Number(
      db.prepare(`INSERT INTO tx_mill_out(lot_no, mill_id, variant_code, meter, ref_stock_in_id, sent_date, notes) VALUES (?,?,?,?,?,?,?)`)
        .run(lot_no, body.mill_id, body.variant_code, body.meter, body.ref_stock_in_id ?? null, body.sent_date, body.notes ?? null).lastInsertRowid,
    );
    return { data: { id, lot_no, ...body } };
  });

  app.delete("/tx/mill-out/:id", async (req) => {
    db.prepare(`DELETE FROM tx_mill_out WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });

  // ── MILL RETURN ───────────────────────────────────────────────────────────
  app.get("/tx/mill-return", async () => {
    const rows = db.prepare(`
      SELECT mr.*, mo.lot_no AS mill_out_lot, m.name AS mill_name,
             v.variant_name, v.color,
             i.code AS item_code, i.name AS item_name
      FROM tx_mill_return mr
      JOIN tx_mill_out mo ON mo.id = mr.mill_out_id
      JOIN tx_mills m ON m.id = mo.mill_id
      JOIN tx_item_variants v ON v.variant_code = mr.variant_code
      JOIN tx_items i ON i.id = v.item_id
      ORDER BY mr.received_date DESC, mr.id DESC
    `).all();
    return { data: rows };
  });

  app.post("/tx/mill-return", async (req) => {
    const body = MillReturnBody.parse(req.body);
    const id = Number(
      db.prepare(`INSERT INTO tx_mill_return(mill_out_id, variant_code, meter, received_date, notes) VALUES (?,?,?,?,?)`)
        .run(body.mill_out_id, body.variant_code, body.meter, body.received_date, body.notes ?? null).lastInsertRowid,
    );
    // Mark parent as received
    db.prepare(`UPDATE tx_mill_out SET status='received' WHERE id = ?`).run(body.mill_out_id);
    return { data: { id, ...body } };
  });

  app.delete("/tx/mill-return/:id", async (req) => {
    const row = db.prepare(`SELECT mill_out_id FROM tx_mill_return WHERE id = ?`).get(Number((req.params as any).id)) as any;
    db.prepare(`DELETE FROM tx_mill_return WHERE id = ?`).run(Number((req.params as any).id));
    if (row) db.prepare(`UPDATE tx_mill_out SET status='pending' WHERE id = ?`).run(row.mill_out_id);
    return { ok: true };
  });

  // ── STOCK BALANCE (quick ledger per variant) ──────────────────────────────
  app.get("/tx/stock-balance", async () => {
    const rows = db.prepare(`
      SELECT
        v.variant_code,
        v.variant_name,
        v.color,
        i.code AS item_code,
        i.name AS item_name,
        COALESCE(SUM(CASE WHEN src='in'  THEN m ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN src='out' THEN m ELSE 0 END), 0) AS total_mill_out,
        COALESCE(SUM(CASE WHEN src='ret' THEN m ELSE 0 END), 0) AS total_returned,
        COALESCE(SUM(CASE WHEN src='pkg' THEN m ELSE 0 END), 0) AS total_packed
      FROM (
        SELECT variant_code, meter AS m, 'in'  AS src FROM tx_stock_in
        UNION ALL
        SELECT variant_code, meter AS m, 'out' AS src FROM tx_mill_out
        UNION ALL
        SELECT variant_code, meter AS m, 'ret' AS src FROM tx_mill_return
        UNION ALL
        SELECT variant_code, meter AS m, 'pkg' AS src FROM tx_packing WHERE status != 'faulty'
      ) x
      JOIN tx_item_variants v ON v.variant_code = x.variant_code
      JOIN tx_items i ON i.id = v.item_id
      GROUP BY x.variant_code
      ORDER BY i.code, v.variant_code
    `).all();
    return { data: rows };
  });
}
