import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../db.js";

export async function registerMxAliasRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  /** Add an alias to any entity */
  app.post("/mx/aliases", async (req) => {
    const body = z
      .object({
        entity_type: z.enum(["roll", "packing", "parcel"]),
        entity_id: z.string().min(1),
        alias_type: z.enum(["supplier_name", "job_work_ref", "commercial_name", "lot_no", "custom"]),
        alias_value: z.string().trim().min(1),
      })
      .parse(req.body);

    // Avoid exact duplicates
    const dup = db
      .prepare(
        `SELECT id FROM mx_aliases WHERE entity_type=? AND entity_id=? AND alias_type=? AND LOWER(alias_value)=LOWER(?)`,
      )
      .get(body.entity_type, body.entity_id, body.alias_type, body.alias_value);
    if (dup) return { data: dup, duplicate: true };

    const id = Number(
      db
        .prepare(`INSERT INTO mx_aliases(entity_type, entity_id, alias_type, alias_value) VALUES (?,?,?,?)`)
        .run(body.entity_type, body.entity_id, body.alias_type, body.alias_value).lastInsertRowid,
    );
    return { data: { id, ...body } };
  });

  /** List aliases for an entity */
  app.get("/mx/aliases/:entity_type/:entity_id", async (req) => {
    const { entity_type, entity_id } = req.params as { entity_type: string; entity_id: string };
    const rows = db.prepare(`SELECT * FROM mx_aliases WHERE entity_type=? AND entity_id=?`).all(entity_type, entity_id);
    return { data: rows };
  });

  /**
   * Universal Search — the single most important feature for daily use.
   * Searches across aliases, rolls, packings, parcels, parties, suppliers,
   * job workers, and challans. Returns typed results.
   */
  app.get("/mx/search", async (req) => {
    const { q } = req.query as { q?: string };
    if (!q || q.trim().length < 2) return { data: [] };
    const term = q.trim();
    const like = `%${term}%`;

    const results: any[] = [];

    // 1) Alias layer — resolves any name to its entity
    const aliasHits = db
      .prepare(
        `SELECT a.entity_type, a.entity_id, a.alias_type, a.alias_value
         FROM mx_aliases a
         WHERE LOWER(a.alias_value) LIKE LOWER(?)
         LIMIT 20`,
      )
      .all(like) as any[];

    for (const a of aliasHits) {
      results.push({
        type: a.entity_type,
        id: a.entity_id,
        match_field: a.alias_type,
        match_value: a.alias_value,
        source: "alias",
      });
    }

    // 2) Rolls — by lot_no, short_code, or roll_id
    const rollHits = db
      .prepare(
        `SELECT r.roll_id AS id, r.short_code, r.lot_no, r.variant_code, r.status, r.remaining_meterage,
                s.name AS supplier_name
         FROM mx_rolls r
         JOIN mx_suppliers s ON s.id = r.supplier_id
         WHERE r.deleted_at IS NULL AND (r.roll_id = ? OR r.short_code LIKE ? OR r.lot_no LIKE ?)
         LIMIT 10`,
      )
      .all(term, like, like) as any[];

    for (const r of rollHits) {
      if (!results.some((x) => x.type === "roll" && x.id === r.id)) {
        results.push({
          type: "roll",
          id: r.id,
          match_field: "lot_no",
          match_value: r.lot_no || r.short_code,
          summary: `${r.variant_code} · ${r.remaining_meterage}m · ${r.status}`,
          supplier_name: r.supplier_name,
          source: "direct",
        });
      }
    }

    // 3) Packings — by short_code, packing_id, or commercial_name
    const packingHits = db
      .prepare(
        `SELECT p.packing_id AS id, p.short_code, p.variant_code, p.length_meters, p.status, p.commercial_name
         FROM mx_packings p
         WHERE p.deleted_at IS NULL AND (p.packing_id = ? OR p.short_code LIKE ? OR p.commercial_name LIKE ?)
         LIMIT 10`,
      )
      .all(term, like, like) as any[];

    for (const p of packingHits) {
      if (!results.some((x) => x.type === "packing" && x.id === p.id)) {
        results.push({
          type: "packing",
          id: p.id,
          match_field: p.commercial_name ? "commercial_name" : "short_code",
          match_value: p.commercial_name || p.short_code,
          summary: `${p.variant_code} · ${p.length_meters}m · ${p.status}`,
          source: "direct",
        });
      }
    }

    // 4) Parcels
    const parcelHits = db
      .prepare(
        `SELECT p.parcel_id AS id, p.short_code, p.total_meters, p.status
         FROM mx_parcels p
         WHERE p.deleted_at IS NULL AND (p.parcel_id = ? OR p.short_code LIKE ?)
         LIMIT 5`,
      )
      .all(term, like) as any[];

    for (const p of parcelHits) {
      results.push({
        type: "parcel",
        id: p.id,
        match_field: "short_code",
        match_value: p.short_code,
        summary: `${p.total_meters}m · ${p.status}`,
        source: "direct",
      });
    }

    // 5) Parties (buyers)
    const partyHits = db
      .prepare(
        `SELECT id, name, city, gstin FROM mx_parties
         WHERE deleted_at IS NULL AND (LOWER(name) LIKE LOWER(?) OR gstin LIKE ?)
         LIMIT 5`,
      )
      .all(like, like) as any[];

    for (const p of partyHits) {
      results.push({
        type: "party",
        id: String(p.id),
        match_field: "name",
        match_value: p.name,
        summary: [p.city, p.gstin].filter(Boolean).join(" · ") || undefined,
        source: "direct",
      });
    }

    // 6) Suppliers
    const supplierHits = db
      .prepare(
        `SELECT id, name, contact FROM mx_suppliers
         WHERE deleted_at IS NULL AND LOWER(name) LIKE LOWER(?)
         LIMIT 5`,
      )
      .all(like) as any[];

    for (const s of supplierHits) {
      results.push({
        type: "supplier",
        id: String(s.id),
        match_field: "name",
        match_value: s.name,
        source: "direct",
      });
    }

    // 7) Job Workers
    const jwHits = db
      .prepare(
        `SELECT id, name, job_work_type FROM mx_job_workers
         WHERE deleted_at IS NULL AND LOWER(name) LIKE LOWER(?)
         LIMIT 5`,
      )
      .all(like) as any[];

    for (const w of jwHits) {
      results.push({
        type: "job_worker",
        id: String(w.id),
        match_field: "name",
        match_value: w.name,
        summary: w.job_work_type || undefined,
        source: "direct",
      });
    }

    // 8) Challans
    const challanHits = db
      .prepare(
        `SELECT c.challan_id AS id, c.challan_no, c.status, c.party_name,
                p.name AS party_master_name
         FROM mx_challans c
         LEFT JOIN mx_parties p ON p.id = c.party_id
         WHERE c.deleted_at IS NULL AND (c.challan_no LIKE ? OR c.party_name LIKE ?)
         LIMIT 5`,
      )
      .all(like, like) as any[];

    for (const c of challanHits) {
      results.push({
        type: "challan",
        id: c.id,
        match_field: "challan_no",
        match_value: c.challan_no,
        summary: `${c.party_master_name || c.party_name || ""} · ${c.status}`,
        source: "direct",
      });
    }

    return { data: results.slice(0, 30) };
  });
}
