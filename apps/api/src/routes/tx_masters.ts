import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";

const ItemBody = z.object({
  code: z.string().trim().min(1).max(5),
  name: z.string().trim().min(1),
});
const VariantBody = z.object({
  variant_code: z.string().trim().min(1).max(15),
  variant_name: z.string().trim().min(1),
  color: z.string().trim().optional(),
});
const CompanyBody = z.object({ name: z.string().trim().min(1), contact: z.string().trim().optional() });
const MillBody = z.object({ name: z.string().trim().min(1), contact: z.string().trim().optional(), job_work_type: z.string().trim().optional() });
const GodownBody = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), location: z.string().trim().optional() });
const AddressBody = z.object({ party_name: z.string().trim().min(1), address_line: z.string().trim().optional(), city: z.string().trim().optional(), state: z.string().trim().optional() });

export async function registerTxMastersRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  app.get("/tx/items", async () => {
    const items = db.prepare(`SELECT * FROM tx_items ORDER BY code ASC`).all() as any[];
    const variants = db.prepare(`SELECT * FROM tx_item_variants ORDER BY variant_code ASC`).all() as any[];
    return {
      data: items.map((item) => ({
        ...item,
        variants: variants.filter((v) => v.item_id === item.id),
      })),
    };
  });

  app.post("/tx/items", async (req, reply) => {
    const body = ItemBody.parse(req.body);
    const dup = db.prepare(`SELECT id FROM tx_items WHERE code = ? OR name = ?`).get(body.code, body.name);
    if (dup) return reply.code(409).send({ error: "Item code or name already exists" });
    const id = Number(db.prepare(`INSERT INTO tx_items(code, name) VALUES (?, ?)`).run(body.code, body.name).lastInsertRowid);
    return { data: { id, ...body, variants: [] } };
  });

  app.put("/tx/items/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = ItemBody.parse(req.body);
    db.prepare(`UPDATE tx_items SET code = ?, name = ? WHERE id = ?`).run(body.code, body.name, Number(id));
    return { ok: true };
  });

  app.delete("/tx/items/:id", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`DELETE FROM tx_items WHERE id = ?`).run(Number(id));
    return { ok: true };
  });

  // ── VARIANTS ───────────────────────────────────────────────────────────────
  app.post("/tx/items/:id/variants", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = VariantBody.parse(req.body);
    const dup = db.prepare(`SELECT id FROM tx_item_variants WHERE variant_code = ?`).get(body.variant_code);
    if (dup) return reply.code(409).send({ error: "Variant code already exists" });
    const rid = Number(
      db.prepare(`INSERT INTO tx_item_variants(item_id, variant_code, variant_name, color) VALUES (?, ?, ?, ?)`)
        .run(Number(id), body.variant_code, body.variant_name, body.color ?? null).lastInsertRowid,
    );
    return { data: { id: rid, item_id: Number(id), ...body } };
  });

  app.put("/tx/variants/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = VariantBody.parse(req.body);
    db.prepare(`UPDATE tx_item_variants SET variant_code=?, variant_name=?, color=? WHERE id=?`)
      .run(body.variant_code, body.variant_name, body.color ?? null, Number(id));
    return { ok: true };
  });

  app.delete("/tx/variants/:id", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`DELETE FROM tx_item_variants WHERE id = ?`).run(Number(id));
    return { ok: true };
  });

  // ── COMPANIES ──────────────────────────────────────────────────────────────
  app.get("/tx/companies", async () => ({ data: db.prepare(`SELECT * FROM tx_companies ORDER BY name ASC`).all() }));
  app.post("/tx/companies", async (req) => {
    const body = CompanyBody.parse(req.body);
    const id = Number(db.prepare(`INSERT OR IGNORE INTO tx_companies(name, contact) VALUES (?, ?)`).run(body.name, body.contact ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/tx/companies/:id", async (req) => {
    db.prepare(`DELETE FROM tx_companies WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });

  // ── MILLS ──────────────────────────────────────────────────────────────────
  app.get("/tx/mills", async () => ({ data: db.prepare(`SELECT * FROM tx_mills ORDER BY name ASC`).all() }));
  app.post("/tx/mills", async (req) => {
    const body = MillBody.parse(req.body);
    const id = Number(db.prepare(`INSERT OR IGNORE INTO tx_mills(name, contact, job_work_type) VALUES (?, ?, ?)`).run(body.name, body.contact ?? null, body.job_work_type ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/tx/mills/:id", async (req) => {
    db.prepare(`DELETE FROM tx_mills WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });

  // ── GODOWNS ────────────────────────────────────────────────────────────────
  app.get("/tx/godowns", async () => ({ data: db.prepare(`SELECT * FROM tx_godowns ORDER BY name ASC`).all() }));
  app.post("/tx/godowns", async (req) => {
    const body = GodownBody.parse(req.body);
    const id = Number(db.prepare(`INSERT OR IGNORE INTO tx_godowns(code, name, location) VALUES (?, ?, ?)`).run(body.code, body.name, body.location ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/tx/godowns/:id", async (req) => {
    db.prepare(`DELETE FROM tx_godowns WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });

  // ── DELIVERY ADDRESSES ─────────────────────────────────────────────────────
  app.get("/tx/addresses", async () => ({ data: db.prepare(`SELECT * FROM tx_delivery_addresses ORDER BY party_name ASC`).all() }));
  app.post("/tx/addresses", async (req) => {
    const body = AddressBody.parse(req.body);
    const id = Number(db.prepare(`INSERT INTO tx_delivery_addresses(party_name, address_line, city, state) VALUES (?, ?, ?, ?)`).run(body.party_name, body.address_line ?? null, body.city ?? null, body.state ?? null).lastInsertRowid);
    return { data: { id, ...body } };
  });
  app.delete("/tx/addresses/:id", async (req) => {
    db.prepare(`DELETE FROM tx_delivery_addresses WHERE id = ?`).run(Number((req.params as any).id));
    return { ok: true };
  });
}
