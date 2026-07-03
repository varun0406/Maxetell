import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const MonthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
});

const ImportReturnsBody = z.object({
  salesReturns: z.array(z.object({
    order_id: z.number(),
    weight: z.number(),
    return_date: z.string(),
    note: z.string().optional(),
    remarks: z.string().optional(),
  })),
  purchaseReturns: z.array(z.object({
    purchase_entry_id: z.number(),
    weight: z.number(),
    return_date: z.string(),
    note: z.string().optional(),
    remarks: z.string().optional(),
  })),
});

export async function registerSyncRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/sync/export", async (req) => {
    const { month } = MonthQuery.parse(req.query);

    // 1. Fetch Orders for the month
    const orders = db.prepare(`
      SELECT 
        o.id, o.wo_no, o.order_date, c.name as client_name, o.client_po_no,
        oli.id as line_id, oli.item, oli.size, oli.grade, oli.order_kgs,
        (SELECT COALESCE(SUM(dispatch_weight), 0) FROM dispatch_entries WHERE order_line_item_id = oli.id) as total_dispatch,
        (SELECT COALESCE(SUM(weight), 0) FROM sales_returns WHERE order_id = o.id) as total_sales_return
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      JOIN order_line_items oli ON oli.order_id = o.id
      WHERE strftime('%Y-%m', o.order_date) = ?
      ORDER BY o.order_date DESC, o.id DESC
    `).all(month);

    // 2. Fetch Purchases for the month
    const purchases = db.prepare(`
      SELECT 
        pe.id as purchase_entry_id, pe.po_no, pe.client_po_no, pe.purchase_date,
        s.name as supplier_name,
        p.item, p.size, p.grade, pe.weight as ordered_weight, pe.received_weight,
        (SELECT COALESCE(SUM(weight), 0) FROM purchase_returns WHERE purchase_entry_id = pe.id) as total_purchase_return
      FROM purchase_entries pe
      JOIN suppliers s ON pe.supplier_id = s.id
      LEFT JOIN products p ON pe.product_id = p.id
      WHERE strftime('%Y-%m', pe.purchase_date) = ?
      ORDER BY pe.purchase_date DESC, pe.id DESC
    `).all(month);

    return { orders, purchases };
  });

  app.post("/sync/import", async (req) => {
    const { salesReturns, purchaseReturns } = ImportReturnsBody.parse(req.body);

    const insertSalesReturn = db.prepare(`
      INSERT INTO sales_returns (order_id, return_date, weight, note, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertPurchaseReturn = db.prepare(`
      INSERT INTO purchase_returns (purchase_entry_id, return_date, weight, note, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const sr of salesReturns) {
        insertSalesReturn.run(sr.order_id, sr.return_date, sr.weight, sr.note || null, sr.remarks || null);
      }
      for (const pr of purchaseReturns) {
        insertPurchaseReturn.run(pr.purchase_entry_id, pr.return_date, pr.weight, pr.note || null, pr.remarks || null);
      }
    })();

    return { success: true, importedSales: salesReturns.length, importedPurchases: purchaseReturns.length };
  });
}
