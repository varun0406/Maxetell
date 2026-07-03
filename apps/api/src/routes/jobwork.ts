import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const CreateClientBody = z.object({
  name: z.string().nonempty(),
});

const CreateInwardBody = z.object({
  client_id: z.coerce.number().int().positive(),
  challan_date: z.string().nonempty(),
  description: z.string().nonempty(),
  qty: z.coerce.number().min(0),
  short_qty: z.coerce.number().min(0).default(0),
});

const CreateOutwardBody = z.object({
  client_id: z.coerce.number().int().positive(),
  dispatch_date: z.string().nonempty(),
  dispatch_qty: z.coerce.number().min(0),
  process_loss: z.coerce.number().min(0).default(0),
});

const CreateOutSentBody = z.object({
  client_id: z.coerce.number().int().positive(),
  challan_date: z.string().nonempty(),
  description: z.string().nonempty(),
  qty: z.coerce.number().min(0),
  short_qty: z.coerce.number().min(0).default(0),
});

const CreateOutReceiptBody = z.object({
  client_id: z.coerce.number().int().positive(),
  receipt_date: z.string().nonempty(),
  receipt_qty: z.coerce.number().min(0),
  process_loss: z.coerce.number().min(0).default(0),
});

export async function registerJobWorkRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/jobwork/clients", async () => {
    const data = db.prepare(`SELECT * FROM job_work_clients ORDER BY name ASC`).all();
    return { data };
  });

  app.post("/jobwork/clients", async (req) => {
    const { name } = CreateClientBody.parse(req.body);
    const stmt = db.prepare(`INSERT INTO job_work_clients (name) VALUES (?)`);
    try {
      const info = stmt.run(name);
      return { data: { id: Number(info.lastInsertRowid) } };
    } catch (e: any) {
      if (e.message.includes("UNIQUE")) {
        return { error: "Client name already exists" };
      }
      throw e;
    }
  });

  // --- JOB WORK (IN) ---
  app.get("/jobwork", async () => {
    const clients = db.prepare(`SELECT * FROM job_work_clients ORDER BY name ASC`).all() as any[];
    const inward = db.prepare(`SELECT * FROM job_work_inward ORDER BY challan_date ASC, id ASC`).all() as any[];
    const outward = db.prepare(`SELECT * FROM job_work_outward ORDER BY dispatch_date ASC, id ASC`).all() as any[];

    const data = clients.map(client => {
      const clientInward = inward.filter(i => i.client_id === client.id);
      const clientOutward = outward.filter(o => o.client_id === client.id);

      const total_inward = clientInward.reduce((sum, i) => sum + (i.qty - (i.short_qty || 0)), 0);
      const total_dispatched = clientOutward.reduce((sum, o) => sum + o.dispatch_qty, 0);
      const total_loss = clientOutward.reduce((sum, o) => sum + (o.process_loss || 0), 0);
      const balance = total_inward - total_dispatched - total_loss;

      return {
        ...client,
        inwards: clientInward,
        outwards: clientOutward,
        total_inward,
        total_dispatched,
        total_loss,
        balance
      };
    }).filter(c => c.inwards.length > 0 || c.outwards.length > 0);

    return { data };
  });

  app.post("/jobwork/inward", async (req) => {
    const body = CreateInwardBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_inward (client_id, challan_date, description, qty, short_qty)
      VALUES (@client_id, @challan_date, @description, @qty, @short_qty)
    `);
    const info = stmt.run(body);
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.post("/jobwork/outward", async (req) => {
    const body = CreateOutwardBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_outward (client_id, dispatch_date, dispatch_qty, process_loss)
      VALUES (@client_id, @dispatch_date, @dispatch_qty, @process_loss)
    `);
    const info = stmt.run(body);
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

  // --- JOB WORK (OUT) ---
  app.get("/jobwork-out", async () => {
    const clients = db.prepare(`SELECT * FROM job_work_clients ORDER BY name ASC`).all() as any[];
    const sent = db.prepare(`SELECT * FROM job_work_out_sent ORDER BY challan_date ASC, id ASC`).all() as any[];
    const received = db.prepare(`SELECT * FROM job_work_out_receipt ORDER BY receipt_date ASC, id ASC`).all() as any[];

    const data = clients.map(client => {
      const clientSent = sent.filter(s => s.client_id === client.id);
      const clientReceived = received.filter(r => r.client_id === client.id);

      const total_sent = clientSent.reduce((sum, s) => sum + (s.qty - (s.short_qty || 0)), 0);
      const total_received = clientReceived.reduce((sum, r) => sum + r.receipt_qty, 0);
      const total_loss = clientReceived.reduce((sum, r) => sum + (r.process_loss || 0), 0);
      const balance = total_sent - total_received - total_loss;

      return {
        ...client,
        sents: clientSent,
        receipts: clientReceived,
        total_sent,
        total_received,
        total_loss,
        balance
      };
    }).filter(c => c.sents.length > 0 || c.receipts.length > 0);

    return { data };
  });

  app.post("/jobwork-out/sent", async (req) => {
    const body = CreateOutSentBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_out_sent (client_id, challan_date, description, qty, short_qty)
      VALUES (@client_id, @challan_date, @description, @qty, @short_qty)
    `);
    const info = stmt.run(body);
    return { data: { id: Number(info.lastInsertRowid) } };
  });

  app.post("/jobwork-out/receipt", async (req) => {
    const body = CreateOutReceiptBody.parse(req.body);
    const stmt = db.prepare(`
      INSERT INTO job_work_out_receipt (client_id, receipt_date, receipt_qty, process_loss)
      VALUES (@client_id, @receipt_date, @receipt_qty, @process_loss)
    `);
    const info = stmt.run(body);
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
