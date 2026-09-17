import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

function nowIso() {
  return new Date().toISOString();
}

export async function registerMxAccountsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // Invoices
  app.get("/mx/accounts/invoices", async () => {
    return {
      data: db.prepare(`
        SELECT i.*, p.name as party_name 
        FROM mx_invoices i
        LEFT JOIN mx_parties p ON i.party_id = p.id
        WHERE i.deleted_at IS NULL
        ORDER BY i.invoice_date DESC, i.created_at DESC
      `).all()
    };
  });

  app.post("/mx/accounts/invoices", async (req) => {
    const body = z.object({
      invoice_no: z.string().trim().min(1),
      invoice_date: z.string().trim().min(1),
      party_id: z.number(),
      challan_id: z.string().optional(),
      total_amount: z.number().min(0)
    }).parse(req.body);

    const id = Number(
      db.prepare(`
        INSERT INTO mx_invoices (invoice_no, invoice_date, party_id, challan_id, total_amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(body.invoice_no, body.invoice_date, body.party_id, body.challan_id ?? null, body.total_amount).lastInsertRowid
    );

    return { data: { id, ...body, status: "unpaid" } };
  });

  // Payments
  app.get("/mx/accounts/payments", async () => {
    return {
      data: db.prepare(`
        SELECT * FROM mx_payments WHERE deleted_at IS NULL ORDER BY payment_date DESC, created_at DESC
      `).all()
    };
  });

  app.post("/mx/accounts/payments", async (req) => {
    const body = z.object({
      entity_type: z.enum(["party", "supplier", "job_worker"]),
      entity_id: z.number(),
      payment_date: z.string().trim().min(1),
      amount: z.number().min(0.01),
      payment_mode: z.string().optional(),
      reference_no: z.string().optional(),
      notes: z.string().optional()
    }).parse(req.body);

    const id = Number(
      db.prepare(`
        INSERT INTO mx_payments (entity_type, entity_id, payment_date, amount, payment_mode, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(body.entity_type, body.entity_id, body.payment_date, body.amount, body.payment_mode ?? null, body.reference_no ?? null, body.notes ?? null).lastInsertRowid
    );

    return { data: { id, ...body } };
  });

  // Ledger Summary Endpoint (Aggregated AR/AP)
  app.get("/mx/accounts/ledger-summary", async () => {
    // AR: Parties
    const ar = db.prepare(`
      SELECT 
        p.id, p.name,
        COALESCE((SELECT SUM(total_amount) FROM mx_invoices WHERE party_id=p.id AND deleted_at IS NULL), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM mx_payments WHERE entity_type='party' AND entity_id=p.id AND deleted_at IS NULL), 0) as total_received
      FROM mx_parties p
      WHERE p.deleted_at IS NULL
    `).all() as any[];

    // AP: Suppliers
    const ap = db.prepare(`
      SELECT 
        s.id, s.name,
        COALESCE((SELECT SUM(total_amount) FROM mx_purchase_bills WHERE supplier_id=s.id AND deleted_at IS NULL), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM mx_payments WHERE entity_type='supplier' AND entity_id=s.id AND deleted_at IS NULL), 0) as total_paid
      FROM mx_suppliers s
      WHERE s.deleted_at IS NULL
    `).all() as any[];

    return { data: { receivables: ar, payables: ap } };
  });
}
