import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const CreateInwardBody = z.object({
  challan_date: z.string().nonempty(),
  description: z.string().nonempty(),
  qty: z.coerce.number().min(0),
  short_qty: z.coerce.number().min(0).default(0),
});

const CreateOutwardBody = z.object({
  inward_id: z.coerce.number().int().positive(),
  dispatch_date: z.string().nonempty(),
  dispatch_qty: z.coerce.number().min(0),
  process_loss: z.coerce.number().min(0).default(0),
});

const CreateOutSentBody = z.object({
  challan_date: z.string().nonempty(),
  description: z.string().nonempty(),
  qty: z.coerce.number().min(0),
  short_qty: z.coerce.number().min(0).default(0),
});

const CreateOutReceiptBody = z.object({
  sent_id: z.coerce.number().int().positive(),
  receipt_date: z.string().nonempty(),
  receipt_qty: z.coerce.number().min(0),
  process_loss: z.coerce.number().min(0).default(0),
});

export async function registerJobWorkRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/jobwork", async () => {
    const inward = db.prepare(`SELECT * FROM job_work_inward ORDER BY challan_date DESC, id DESC`).all() as any[];
    const outward = db.prepare(`SELECT * FROM job_work_outward ORDER BY dispatch_date ASC, id ASC`).all() as any[];

    // Map outward to inward
    const outwardMap = new Map<number, any[]>();
    for (const out of outward) {
      const list = outwardMap.get(out.inward_id) || [];
      list.push(out);
      outwardMap.set(out.inward_id, list);
    }

    const data = inward.map((inw) => {
      const dispatches = outwardMap.get(inw.id) || [];
      const totalDispatched = dispatches.reduce((sum, d) => sum + d.dispatch_qty, 0);
      const totalLoss = dispatches.reduce((sum, d) => sum + d.process_loss, 0);
      const finalQty = inw.qty - (inw.short_qty || 0);
      const balance = finalQty - totalDispatched - totalLoss;

      return {
        ...inw,
        final_qty: finalQty,
        dispatches,
        total_dispatched: totalDispatched,
        total_loss: totalLoss,
        balance,
      };
    });

    return { data };
  });

  app.post("/jobwork/inward", async (req) => {
    const body = CreateInwardBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_inward (challan_date, description, qty, short_qty)
      VALUES (@challan_date, @description, @qty, @short_qty)
    `);
    const info = stmt.run({
      challan_date: body.challan_date,
      description: body.description,
      qty: body.qty,
      short_qty: body.short_qty,
    });
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.post("/jobwork/outward", async (req) => {
    const body = CreateOutwardBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_outward (inward_id, dispatch_date, dispatch_qty, process_loss)
      VALUES (@inward_id, @dispatch_date, @dispatch_qty, @process_loss)
    `);
    const info = stmt.run({
      inward_id: body.inward_id,
      dispatch_date: body.dispatch_date,
      dispatch_qty: body.dispatch_qty,
      process_loss: body.process_loss,
    });
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.delete<{ Params: { id: string } }>("/jobwork/inward/:id", async (req) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM job_work_inward WHERE id = ?`).run(id);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/jobwork/outward/:id", async (req) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM job_work_outward WHERE id = ?`).run(id);
    return { success: true };
  });

  // Job Work Out endpoints
  app.get("/jobwork-out", async () => {
    const sent = db.prepare(`SELECT * FROM job_work_out_sent ORDER BY challan_date DESC, id DESC`).all() as any[];
    const received = db.prepare(`SELECT * FROM job_work_out_receipt ORDER BY receipt_date ASC, id ASC`).all() as any[];

    const receiptMap = new Map<number, any[]>();
    for (const rec of received) {
      const list = receiptMap.get(rec.sent_id) || [];
      list.push(rec);
      receiptMap.set(rec.sent_id, list);
    }

    const data = sent.map((s) => {
      const receipts = receiptMap.get(s.id) || [];
      const totalReceived = receipts.reduce((sum, r) => sum + r.receipt_qty, 0);
      const totalLoss = receipts.reduce((sum, r) => sum + r.process_loss, 0);
      const finalQty = s.qty - (s.short_qty || 0);
      const balance = finalQty - totalReceived - totalLoss;

      return {
        ...s,
        final_qty: finalQty,
        receipts,
        total_received: totalReceived,
        total_loss: totalLoss,
        balance,
      };
    });

    return { data };
  });

  app.post("/jobwork-out/sent", async (req) => {
    const body = CreateOutSentBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_out_sent (challan_date, description, qty, short_qty)
      VALUES (@challan_date, @description, @qty, @short_qty)
    `);
    const info = stmt.run({
      challan_date: body.challan_date,
      description: body.description,
      qty: body.qty,
      short_qty: body.short_qty,
    });
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.post("/jobwork-out/receipt", async (req) => {
    const body = CreateOutReceiptBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_out_receipt (sent_id, receipt_date, receipt_qty, process_loss)
      VALUES (@sent_id, @receipt_date, @receipt_qty, @process_loss)
    `);
    const info = stmt.run({
      sent_id: body.sent_id,
      receipt_date: body.receipt_date,
      receipt_qty: body.receipt_qty,
      process_loss: body.process_loss,
    });
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.delete<{ Params: { id: string } }>("/jobwork-out/sent/:id", async (req) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM job_work_out_sent WHERE id = ?`).run(id);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/jobwork-out/receipt/:id", async (req) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM job_work_out_receipt WHERE id = ?`).run(id);
    return { success: true };
  });
}
