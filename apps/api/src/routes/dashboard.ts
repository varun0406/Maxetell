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
      WHERE pr.weight_received > 0 AND pe.rate > 0
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
        SELECT strftime('%Y-%m', de.dispatch_date) as month, de.dispatch_weight as sales_weight, (de.dispatch_weight * COALESCE(NULLIF(de.sales_rate, 0), NULLIF(oli.bill_rate, 0), o.bill_rate, 0)) as sales_amount, 0 as purchase_weight, 0 as purchase_amount, 0 as sales_return_weight, 0 as purchase_return_weight 
          FROM dispatch_entries de LEFT JOIN order_line_items oli ON de.order_line_item_id = oli.id LEFT JOIN orders o ON de.order_id = o.id
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
        strftime('%Y', de.dispatch_date) || '-Q' || ((cast(strftime('%m', de.dispatch_date) as integer) + 2) / 3) as quarter,
        SUM(de.dispatch_weight) as sales_weight,
        SUM(de.dispatch_weight * COALESCE(NULLIF(de.sales_rate, 0), NULLIF(oli.bill_rate, 0), o.bill_rate, 0)) as sales_amount
      FROM dispatch_entries de
      LEFT JOIN order_line_items oli ON de.order_line_item_id = oli.id
      LEFT JOIN orders o ON de.order_id = o.id
      WHERE de.dispatch_date IS NOT NULL
      GROUP BY quarter
      ORDER BY quarter DESC
      LIMIT 8
    `).all() as any[];

    const topClients = db.prepare(`
      SELECT c.name, SUM(de.dispatch_weight) as total_weight, SUM(de.dispatch_weight * COALESCE(NULLIF(de.sales_rate, 0), NULLIF(oli.bill_rate, 0), o.bill_rate, 0)) as total_amount
      FROM dispatch_entries de
      LEFT JOIN order_line_items oli ON de.order_line_item_id = oli.id
      JOIN orders o ON de.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      GROUP BY c.id
      ORDER BY total_weight DESC
      LIMIT 5
    `).all() as any[];

    const topProducts = db.prepare(`
      SELECT p.item || ' (' || p.size || ')' as name, SUM(de.dispatch_weight) as total_weight
      FROM dispatch_entries de
      JOIN orders o ON de.order_id = o.id
      JOIN products p ON o.product_id = p.id
      GROUP BY p.id
      ORDER BY total_weight DESC
      LIMIT 5
    `).all() as any[];

    return {
      data: {
        avg_purchase_price: avgPurchasePrice,
        monthly_summary: monthlySummary,
        quarterly_sales: quarterlySales,
        top_clients: topClients,
        top_products: topProducts
      }
    };
  });

  app.get("/dashboard/product_stock", async () => {
    const products = db.prepare(`
      SELECT 
        p.id as product_id, p.size, p.item, p.grade,
        COALESCE(pr.receipts, 0) as receipts,
        COALESCE(pret.returns, 0) as purchase_returns,
        COALESCE(de.dispatches, 0) as dispatches,
        COALESCE(sret.returns, 0) as sales_returns,
        (COALESCE(pr.receipts, 0) - COALESCE(pret.returns, 0) - COALESCE(de.dispatches, 0) + COALESCE(sret.returns, 0)) as current_stock,
        COALESCE(pr.avg_price, 0) as actual_avg_price
      FROM products p
      LEFT JOIN (
        SELECT pe.product_id, SUM(pr.weight_received) as receipts, SUM(CASE WHEN pe.rate > 0 THEN pr.weight_received * pe.rate ELSE 0 END) / NULLIF(SUM(CASE WHEN pe.rate > 0 THEN pr.weight_received ELSE 0 END), 0) as avg_price
        FROM purchase_receipts pr
        JOIN purchase_entries pe ON pe.id = pr.purchase_entry_id
        GROUP BY pe.product_id
      ) pr ON pr.product_id = p.id
      LEFT JOIN (
        SELECT pe.product_id, SUM(pret.weight) as returns
        FROM purchase_returns pret
        JOIN purchase_entries pe ON pe.id = pret.purchase_entry_id
        GROUP BY pe.product_id
      ) pret ON pret.product_id = p.id
      LEFT JOIN (
        SELECT o.product_id, SUM(de.dispatch_weight) as dispatches
        FROM dispatch_entries de
        JOIN orders o ON o.id = de.order_id
        GROUP BY o.product_id
      ) de ON de.product_id = p.id
      LEFT JOIN (
        SELECT COALESCE(sret.product_id, o.product_id) as product_id, SUM(sret.weight) as returns
        FROM sales_returns sret
        LEFT JOIN orders o ON o.id = sret.order_id
        GROUP BY COALESCE(sret.product_id, o.product_id)
      ) sret ON sret.product_id = p.id
      WHERE (COALESCE(pr.receipts, 0) + COALESCE(pret.returns, 0) + COALESCE(de.dispatches, 0) + COALESCE(sret.returns, 0)) > 0
      ORDER BY p.item, p.size, p.grade
    `).all();

    return { data: products };
  });

  app.get<{ Params: { productId: string } }>("/dashboard/product_ledger/:productId", async (req) => {
    const productId = Number(req.params.productId);
    
    // Ledger: union of all transactions ordered by date
    const ledger = db.prepare(`
      SELECT 'Receipt' as type, pr.receipt_date as date, pr.weight_received as weight, pe.po_no as ref
      FROM purchase_receipts pr
      JOIN purchase_entries pe ON pe.id = pr.purchase_entry_id
      WHERE pe.product_id = ?
      
      UNION ALL
      
      SELECT 'Purchase Return' as type, pret.return_date as date, -pret.weight as weight, pe.po_no as ref
      FROM purchase_returns pret
      JOIN purchase_entries pe ON pe.id = pret.purchase_entry_id
      WHERE pe.product_id = ?
      
      UNION ALL
      
      SELECT 'Dispatch' as type, de.dispatch_date as date, -de.dispatch_weight as weight, o.wo_no as ref
      FROM dispatch_entries de
      JOIN orders o ON o.id = de.order_id
      WHERE o.product_id = ?
      
      UNION ALL
      
      SELECT 'Sales Return' as type, sret.return_date as date, sret.weight as weight, COALESCE(o.wo_no, 'Old Return') as ref
      FROM sales_returns sret
      LEFT JOIN orders o ON o.id = sret.order_id
      WHERE COALESCE(sret.product_id, o.product_id) = ?
      
      ORDER BY date ASC
    `).all(productId, productId, productId, productId) as { type: string, date: string, weight: number, ref: string | null }[];

    let balance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      balance += entry.weight;
      return { ...entry, balance };
    });

    return { data: ledgerWithBalance };
  });
}
