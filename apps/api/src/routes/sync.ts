import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const MonthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
});

const ImportSyncBody = z.object({
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
  dispatches: z.array(z.object({
    order_id: z.number(),
    order_line_item_id: z.number(),
    dispatch_date: z.string(),
    dispatch_weight: z.number(),
    dispatch_pcs: z.number().optional().default(0),
    bundle_no: z.string().optional(),
  })),
  receipts: z.array(z.object({
    purchase_entry_id: z.number(),
    receipt_date: z.string(),
    weight_received: z.number(),
    note: z.string().optional(),
  })),
  newOrders: z.array(z.object({
    wo_no: z.string(),
    order_date: z.string(),
    client_name: z.string(),
    item: z.string(),
    size: z.string(),
    grade: z.string(),
    order_kgs: z.number(),
  })),
  newPurchases: z.array(z.object({
    po_no: z.string().optional(),
    purchase_date: z.string(),
    supplier_name: z.string(),
    item: z.string(),
    size: z.string(),
    grade: z.string(),
    ordered_weight: z.number(),
  }))
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

    // 2. Fetch Dispatches for the month
    const dispatches = db.prepare(`
      SELECT d.id, d.dispatch_date, d.dispatch_weight, d.dispatch_pcs, d.bundle_no,
             o.wo_no, c.name as client_name, oli.item, oli.size, oli.grade
      FROM dispatch_entries d
      JOIN orders o ON d.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      JOIN order_line_items oli ON d.order_line_item_id = oli.id
      WHERE strftime('%Y-%m', d.dispatch_date) = ?
      ORDER BY d.dispatch_date DESC, d.id DESC
    `).all(month);

    // 3. Fetch Sales Returns for the month
    const salesReturns = db.prepare(`
      SELECT sr.id, sr.return_date, sr.weight, sr.note, sr.remarks,
             o.wo_no, c.name as client_name, p.item, p.size, p.grade
      FROM sales_returns sr
      LEFT JOIN orders o ON sr.order_id = o.id
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE strftime('%Y-%m', sr.return_date) = ?
      ORDER BY sr.return_date DESC, sr.id DESC
    `).all(month);

    // 4. Fetch Purchases for the month
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

    // 5. Fetch Purchase Receipts for the month
    const receipts = db.prepare(`
      SELECT pr.id, pr.receipt_date, pr.weight_received, pr.note,
             pe.po_no, s.name as supplier_name, p.item, p.size, p.grade
      FROM purchase_receipts pr
      JOIN purchase_entries pe ON pr.purchase_entry_id = pe.id
      JOIN suppliers s ON pe.supplier_id = s.id
      LEFT JOIN products p ON pe.product_id = p.id
      WHERE strftime('%Y-%m', pr.receipt_date) = ?
      ORDER BY pr.receipt_date DESC, pr.id DESC
    `).all(month);

    // 6. Fetch Purchase Returns for the month
    const purchaseReturns = db.prepare(`
      SELECT pr.id, pr.return_date, pr.weight, pr.note, pr.remarks,
             pe.po_no, s.name as supplier_name, p.item, p.size, p.grade
      FROM purchase_returns pr
      JOIN purchase_entries pe ON pr.purchase_entry_id = pe.id
      JOIN suppliers s ON pe.supplier_id = s.id
      LEFT JOIN products p ON pe.product_id = p.id
      WHERE strftime('%Y-%m', pr.return_date) = ?
      ORDER BY pr.return_date DESC, pr.id DESC
    `).all(month);

    return { orders, dispatches, salesReturns, purchases, receipts, purchaseReturns };
  });

  app.post("/sync/csv-update", async (req) => {
    const body = z.object({
      table: z.enum(["orders", "order_line_items", "dispatch_entries", "purchase_entries", "purchase_receipts", "sales_returns", "purchase_returns"]),
      rows: z.array(z.record(z.any()))
    }).parse(req.body);

    const allowedColumns: Record<string, string[]> = {
      order_line_items: ["order_kgs", "order_pcs", "bill_rate", "size", "item", "grade", "length_nos"],
      orders: ["wo_no", "client_po_no", "remarks", "invoice_no", "sales_date", "or_no"],
      dispatch_entries: ["dispatch_date", "dispatch_weight", "packing_weight", "dispatch_pcs", "bundle_no", "transport", "sales_rate"],
      purchase_entries: ["po_no", "client_po_no", "purchase_date", "weight", "rate", "bill_no", "transport"],
      purchase_receipts: ["receipt_date", "weight_received", "note"],
      sales_returns: ["return_date", "weight", "note", "remarks"],
      purchase_returns: ["return_date", "weight", "note", "remarks"]
    };

    const validCols = allowedColumns[body.table];
    if (!validCols) throw new Error("Invalid table");

    let updatedCount = 0;
    db.transaction(() => {
      for (const row of body.rows) {
        // Handle ID parsing
        const id = parseInt(row.id || row.ID || row.Id, 10);
        if (!id || isNaN(id)) continue;
        
        const updates: string[] = [];
        const params: any[] = [];
        
        for (const col of validCols) {
          if (row[col] !== undefined) {
            updates.push(`${col} = ?`);
            let val = row[col];
            if (val === "") val = null;
            // Parse numbers if applicable, wait sqlite handles it dynamically but let's be careful
            if (val !== null && !isNaN(Number(val)) && typeof val === "string") {
              // Only convert if it's strictly a number and not a date or string like "WO-123"
              if (!val.includes("-") && val.trim() !== "") {
                 val = Number(val);
              }
            }
            params.push(val);
          }
        }
        
        if (updates.length > 0) {
          params.push(id);
          const stmt = db.prepare(`UPDATE ${body.table} SET ${updates.join(", ")} WHERE id = ?`);
          const info = stmt.run(...params);
          if (info.changes > 0) updatedCount++;
        }
      }
    })();
    return { success: true, updatedCount };
  });

  app.post("/sync/import", async (req) => {
    const { salesReturns, purchaseReturns, dispatches, receipts, newOrders, newPurchases } = ImportSyncBody.parse(req.body);

    const insertSalesReturn = db.prepare(`
      INSERT INTO sales_returns (order_id, return_date, weight, note, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertPurchaseReturn = db.prepare(`
      INSERT INTO purchase_returns (purchase_entry_id, return_date, weight, note, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertDispatch = db.prepare(`
      INSERT INTO dispatch_entries (order_id, order_line_item_id, dispatch_date, dispatch_weight, dispatch_pcs, bundle_no)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertReceipt = db.prepare(`
      INSERT INTO purchase_receipts (purchase_entry_id, receipt_date, weight_received, note)
      VALUES (?, ?, ?, ?)
    `);

    const updatePurchaseRecWeight = db.prepare(`
      UPDATE purchase_entries 
      SET received_weight = received_weight + ? 
      WHERE id = ?
    `);

    // For New Orders and New Purchases
    const getClient = db.prepare(`SELECT id FROM clients WHERE name = ?`);
    const insertClient = db.prepare(`INSERT INTO clients (name) VALUES (?)`);
    const getSupplier = db.prepare(`SELECT id FROM suppliers WHERE name = ?`);
    const insertSupplier = db.prepare(`INSERT INTO suppliers (name) VALUES (?)`);
    
    const getProduct = db.prepare(`SELECT id FROM products WHERE item = ? AND size = ? AND grade = ?`);
    const insertProduct = db.prepare(`INSERT INTO products (item, size, grade) VALUES (?, ?, ?)`);

    const insertOrder = db.prepare(`
      INSERT INTO orders (wo_no, order_date, client_id, product_id, order_kgs)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertOrderLine = db.prepare(`
      INSERT INTO order_line_items (order_id, size, item, grade, order_kgs)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertPurchase = db.prepare(`
      INSERT INTO purchase_entries (supplier_id, product_id, po_no, purchase_date, weight, rate)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      // Process New Orders
      for (const o of newOrders) {
        let clientId = getClient.get(o.client_name) as { id: number } | undefined;
        if (!clientId) {
          const res = insertClient.run(o.client_name);
          clientId = { id: res.lastInsertRowid as number };
        }

        let productId = getProduct.get(o.item, o.size, o.grade) as { id: number } | undefined;
        if (!productId) {
          const res = insertProduct.run(o.item, o.size, o.grade);
          productId = { id: res.lastInsertRowid as number };
        }

        const res = insertOrder.run(o.wo_no, o.order_date, clientId.id, productId.id, o.order_kgs);
        const orderId = res.lastInsertRowid as number;

        insertOrderLine.run(orderId, o.size, o.item, o.grade, o.order_kgs);
      }

      // Process New Purchases
      for (const p of newPurchases) {
        let supplierId = getSupplier.get(p.supplier_name) as { id: number } | undefined;
        if (!supplierId) {
          const res = insertSupplier.run(p.supplier_name);
          supplierId = { id: res.lastInsertRowid as number };
        }

        let productId = getProduct.get(p.item, p.size, p.grade) as { id: number } | undefined;
        if (!productId) {
          const res = insertProduct.run(p.item, p.size, p.grade);
          productId = { id: res.lastInsertRowid as number };
        }

        insertPurchase.run(supplierId.id, productId.id, p.po_no || null, p.purchase_date, p.ordered_weight, 0); // default rate 0 for bulk import, can be updated later
      }

      // Process Returns, Dispatches, Receipts
      for (const sr of salesReturns) {
        insertSalesReturn.run(sr.order_id, sr.return_date, sr.weight, sr.note || null, sr.remarks || null);
      }
      for (const pr of purchaseReturns) {
        insertPurchaseReturn.run(pr.purchase_entry_id, pr.return_date, pr.weight, pr.note || null, pr.remarks || null);
      }
      for (const d of dispatches) {
        insertDispatch.run(d.order_id, d.order_line_item_id, d.dispatch_date, d.dispatch_weight, d.dispatch_pcs, d.bundle_no || null);
      }
      for (const r of receipts) {
        insertReceipt.run(r.purchase_entry_id, r.receipt_date, r.weight_received, r.note || null);
        updatePurchaseRecWeight.run(r.weight_received, r.purchase_entry_id);
      }
    })();

    return { 
      success: true, 
      importedSales: salesReturns.length, 
      importedPurchases: purchaseReturns.length,
      importedDispatches: dispatches.length,
      importedReceipts: receipts.length,
      importedNewOrders: newOrders.length,
      importedNewPurchases: newPurchases.length
    };
  });
}
