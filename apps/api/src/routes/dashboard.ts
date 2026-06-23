import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";
import { getMinimumStockKgs, getOpeningStockKgs } from "./inventory.js";

export async function registerDashboardRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/dashboard/summary", async () => {
    const totalOrderKgs = (
      db.prepare(`SELECT COALESCE(SUM(order_kgs),0) AS t FROM order_line_items`).get() as { t: number }
    ).t;

    const totalDispatchKgs = (
      db.prepare(`SELECT COALESCE(SUM(dispatch_weight),0) AS w FROM dispatch_entries`).get() as { w: number }
    ).w;

    const pendingKgsRow = db
      .prepare(
        `
SELECT COALESCE(SUM(CASE WHEN (ol.tot - COALESCE(d.disp, 0)) > 0 THEN (ol.tot - COALESCE(d.disp, 0)) ELSE 0 END), 0) AS p
FROM (
  SELECT order_id, SUM(order_kgs) AS tot FROM order_line_items GROUP BY order_id
) ol
LEFT JOIN (
  SELECT order_id, SUM(dispatch_weight) AS disp FROM dispatch_entries GROUP BY order_id
) d ON d.order_id = ol.order_id
`,
      )
      .get() as { p: number };

    const profitAgg = db
      .prepare(
        `
SELECT
  COALESCE(SUM(CASE WHEN (oli.bill_rate - oli.avg_cost) >= 0 THEN (oli.bill_rate - oli.avg_cost) * oli.order_kgs ELSE 0 END), 0) AS pos,
  COALESCE(SUM(CASE WHEN (oli.bill_rate - oli.avg_cost) < 0 THEN (oli.bill_rate - oli.avg_cost) * oli.order_kgs ELSE 0 END), 0) AS neg
FROM order_line_items oli
`,
      )
      .get() as { pos: number; neg: number };

    const incomingMaterial = (
      db.prepare(`SELECT COALESCE(SUM(weight_received),0) AS w FROM purchase_receipts`).get() as { w: number }
    ).w;
    const dispatchTotal = (
      db.prepare(`SELECT COALESCE(SUM(dispatch_weight),0) AS w FROM dispatch_entries`).get() as { w: number }
    ).w;
    const dispatchReturn = (db.prepare(`SELECT COALESCE(SUM(weight),0) AS w FROM sales_returns`).get() as { w: number }).w;
    const incomingRmReturn = (
      db.prepare(`SELECT COALESCE(SUM(weight),0) AS w FROM purchase_returns`).get() as { w: number }
    ).w;

    const pendingPurchaseOrders = (
      db
        .prepare(`SELECT COALESCE(SUM(CASE WHEN (weight - received_weight) > 0 THEN (weight - received_weight) ELSE 0 END), 0) AS w FROM purchase_entries`)
        .get() as { w: number }
    ).w;

    const pendingSalesOrders = pendingKgsRow.p;

    const openingStock = getOpeningStockKgs(db);
    const minimumStock = getMinimumStockKgs(db);
    const currentStock = openingStock + incomingMaterial + dispatchReturn - dispatchTotal - incomingRmReturn;

    // Per requested formula:
    // PurchaseRequired = (Opening + IncomingMaterial - IncomingRmReturn - MinimumStock) + PendingPurchaseOrders - DispatchTotal - PendingSalesOrders
    const purchaseRequired =
      (openingStock + incomingMaterial - incomingRmReturn - minimumStock) + pendingPurchaseOrders - dispatchTotal - pendingSalesOrders;

    return {
      data: {
        total_order_kgs: totalOrderKgs,
        total_dispatch_kgs: totalDispatchKgs,
        pending_kgs: pendingKgsRow.p,
        profit_per_kg_positive_sum: profitAgg.pos,
        profit_per_kg_negative_sum: profitAgg.neg,
        opening_stock_kgs: openingStock,
        minimum_stock_kgs: minimumStock,
        current_stock_kgs: currentStock,
        purchase_required_kgs: purchaseRequired,
        breakdown: {
          pending_sales_orders_kgs: pendingSalesOrders,
          pending_purchase_orders_kgs: pendingPurchaseOrders,
          incoming_material_kgs: incomingMaterial,
          dispatch_kgs: dispatchTotal,
          dispatch_return_kgs: dispatchReturn,
          incoming_rm_return_kgs: incomingRmReturn,
        },
        total_orders: db.prepare(`SELECT COUNT(1) AS c FROM orders`).get(),
      },
    };
  });

  app.get("/dashboard/analytics", async () => {
    // Average purchase price overall based on received material
    const avgPurchasePriceRow = db.prepare(`
      SELECT SUM(pr.weight_received * pe.rate) / SUM(pr.weight_received) as avg 
      FROM purchase_receipts pr
      JOIN purchase_entries pe ON pr.purchase_entry_id = pe.id
      WHERE pr.weight_received > 0
    `).get() as { avg: number | null };
    const avgPurchasePrice = avgPurchasePriceRow?.avg || 0;

    // Monthly summary
    const monthlySummary = db.prepare(`
      SELECT 
        month,
        SUM(sales_weight) as sales_weight,
        SUM(sales_amount) as sales_amount,
        SUM(purchase_weight) as purchase_weight,
        SUM(purchase_amount) as purchase_amount,
        SUM(sales_return_weight) as sales_return_weight,
        SUM(purchase_return_weight) as purchase_return_weight
      FROM (
        SELECT strftime('%Y-%m', dispatch_date) as month, dispatch_weight as sales_weight, (dispatch_weight * COALESCE(sales_rate, 0)) as sales_amount, 0 as purchase_weight, 0 as purchase_amount, 0 as sales_return_weight, 0 as purchase_return_weight FROM dispatch_entries
        UNION ALL
        SELECT strftime('%Y-%m', pr.receipt_date) as month, 0, 0, pr.weight_received, pr.weight_received * COALESCE(pe.rate, 0), 0, 0 
          FROM purchase_receipts pr JOIN purchase_entries pe ON pr.purchase_entry_id = pe.id
        UNION ALL
        SELECT strftime('%Y-%m', return_date) as month, 0, 0, 0, 0, weight, 0 FROM sales_returns
        UNION ALL
        SELECT strftime('%Y-%m', return_date) as month, 0, 0, 0, 0, 0, weight FROM purchase_returns
      ) 
      WHERE month IS NOT NULL
      GROUP BY month 
      ORDER BY month DESC
      LIMIT 12
    `).all() as any[];

    // Quarterly sales price
    const quarterlySales = db.prepare(`
      SELECT 
        strftime('%Y', dispatch_date) || '-Q' || ((cast(strftime('%m', dispatch_date) as integer) + 2) / 3) as quarter,
        SUM(dispatch_weight) as sales_weight,
        SUM(dispatch_weight * COALESCE(sales_rate, 0)) as sales_amount
      FROM dispatch_entries
      WHERE dispatch_date IS NOT NULL
      GROUP BY quarter
      ORDER BY quarter DESC
      LIMIT 8
    `).all() as any[];

    return {
      data: {
        avg_purchase_price: avgPurchasePrice,
        monthly_summary: monthlySummary,
        quarterly_sales: quarterlySales
      }
    };
  });
}
