import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const PatchOpeningBody = z.object({
  opening_stock_kgs: z.coerce.number().min(0),
});

const PatchMinimumBody = z.object({
  minimum_stock_kgs: z.coerce.number().min(0),
});

export function getOpeningStockKgs(db: Db): number {
  const row = db
    .prepare(`SELECT value_real FROM app_settings WHERE key = 'opening_stock_kgs'`)
    .get() as { value_real: number } | undefined;
  return row?.value_real ?? 0;
}

export function getMinimumStockKgs(db: Db): number {
  const row = db
    .prepare(`SELECT value_real FROM app_settings WHERE key = 'minimum_stock_kgs'`)
    .get() as { value_real: number } | undefined;
  return row?.value_real ?? 0;
}

export async function registerInventoryRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/inventory/opening-stock", async () => {
    return { data: { opening_stock_kgs: getOpeningStockKgs(db) } };
  });

  app.patch("/inventory/opening-stock", async (req) => {
    const body = PatchOpeningBody.parse(req.body);
    db.prepare(
      `INSERT INTO app_settings(key, value_real) VALUES ('opening_stock_kgs', @v)
       ON CONFLICT(key) DO UPDATE SET value_real = excluded.value_real`,
    ).run({ v: body.opening_stock_kgs });
    return { data: { opening_stock_kgs: getOpeningStockKgs(db) } };
  });

  app.get("/inventory/minimum-stock", async () => {
    return { data: { minimum_stock_kgs: getMinimumStockKgs(db) } };
  });

  app.patch("/inventory/minimum-stock", async (req) => {
    const body = PatchMinimumBody.parse(req.body);
    db.prepare(
      `INSERT INTO app_settings(key, value_real) VALUES ('minimum_stock_kgs', @v)
       ON CONFLICT(key) DO UPDATE SET value_real = excluded.value_real`,
    ).run({ v: body.minimum_stock_kgs });
    return { data: { minimum_stock_kgs: getMinimumStockKgs(db) } };
  });

  app.get("/inventory/ledger", async () => {
    const query = `
      SELECT 
        'Purchase Receipt' AS transaction_type,
        pr.receipt_date AS date,
        p.id AS product_id,
        p.item,
        p.size,
        p.grade,
        pr.weight_received AS inward_quantity,
        0 AS outward_quantity,
        pe.po_no AS reference_number,
        pe.client_po_no AS client_po,
        pe.rate AS rate
      FROM purchase_receipts pr
      JOIN purchase_entries pe ON pe.id = pr.purchase_entry_id
      JOIN products p ON p.id = pe.product_id

      UNION ALL

      SELECT 
        'Purchase Return' AS transaction_type,
        pret.return_date AS date,
        p.id AS product_id,
        p.item,
        p.size,
        p.grade,
        0 AS inward_quantity,
        pret.weight AS outward_quantity,
        COALESCE(pret.remarks, pe.debit_note) AS reference_number,
        pe.client_po_no AS client_po,
        pe.rate AS rate
      FROM purchase_returns pret
      JOIN purchase_entries pe ON pe.id = pret.purchase_entry_id
      JOIN products p ON p.id = pe.product_id

      UNION ALL

      SELECT 
        'Sales Dispatch' AS transaction_type,
        de.dispatch_date AS date,
        p.id AS product_id,
        p.item,
        p.size,
        p.grade,
        0 AS inward_quantity,
        de.dispatch_weight AS outward_quantity,
        o.wo_no AS reference_number,
        o.client_po_no AS client_po,
        de.sales_rate AS rate
      FROM dispatch_entries de
      JOIN orders o ON o.id = de.order_id
      LEFT JOIN order_line_items oli ON oli.id = de.order_line_item_id
      JOIN products p ON p.id = COALESCE((SELECT id FROM products WHERE item = oli.item AND size = oli.size AND grade = oli.grade), o.product_id)

      UNION ALL

      SELECT 
        'Sales Return' AS transaction_type,
        sret.return_date AS date,
        p.id AS product_id,
        p.item,
        p.size,
        p.grade,
        sret.weight AS inward_quantity,
        0 AS outward_quantity,
        o.wo_no AS reference_number,
        o.client_po_no AS client_po,
        COALESCE((SELECT AVG(bill_rate) FROM order_line_items WHERE order_id = o.id), 0) AS rate
      FROM sales_returns sret
      JOIN orders o ON o.id = sret.order_id
      JOIN products p ON p.id = o.product_id
    `;

    const rows = db.prepare(query).all() as any[];
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Get actual average prices
    const avgPricesRows = db.prepare(`
      SELECT pe.product_id, SUM(pr.weight_received * pe.rate) / NULLIF(SUM(pr.weight_received), 0) as avg_price
      FROM purchase_receipts pr
      JOIN purchase_entries pe ON pe.id = pr.purchase_entry_id
      GROUP BY pe.product_id
    `).all() as { product_id: number; avg_price: number | null }[];

    const avgPriceMap = new Map<number, number>();
    for (const row of avgPricesRows) {
      if (row.avg_price) avgPriceMap.set(row.product_id, row.avg_price);
    }
    
    // Calculate running balance per product
    const balances: Record<number, number> = {};
    const ledger = rows.map((r) => {
      const pid = r.product_id;
      const prevBal = balances[pid] ?? 0;
      const net = r.inward_quantity - r.outward_quantity;
      const nextBal = prevBal + net;
      balances[pid] = nextBal;
      return {
        ...r,
        balance_quantity: nextBal,
        actual_avg_price: avgPriceMap.get(pid) ?? 0,
      };
    });

    ledger.reverse();
    return { data: ledger };
  });
}
