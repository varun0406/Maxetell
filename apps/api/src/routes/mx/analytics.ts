import type { FastifyInstance } from "fastify";
import type { Db } from "../../db.js";

export async function registerMxAnalyticsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/analytics/summary", async () => {
    const rollMeters = db
      .prepare(
        `
      SELECT status, COUNT(1) AS rolls, COALESCE(SUM(remaining_meterage),0) AS remaining, COALESCE(SUM(original_meterage),0) AS original
      FROM mx_rolls WHERE deleted_at IS NULL GROUP BY status
    `,
      )
      .all();

    const packingByStatus = db
      .prepare(
        `
      SELECT status, COUNT(1) AS pieces, COALESCE(SUM(length_meters),0) AS meters
      FROM mx_packings WHERE deleted_at IS NULL GROUP BY status
    `,
      )
      .all();

    const totals = db
      .prepare(
        `
      SELECT
        (SELECT COALESCE(SUM(remaining_meterage),0) FROM mx_rolls WHERE deleted_at IS NULL) AS roll_remaining_m,
        (SELECT COALESCE(SUM(original_meterage),0) FROM mx_rolls WHERE deleted_at IS NULL) AS roll_original_m,
        (SELECT COUNT(1) FROM mx_rolls WHERE deleted_at IS NULL) AS roll_count,
        (SELECT COALESCE(SUM(length_meters),0) FROM mx_packings WHERE deleted_at IS NULL AND status IN ('packed','in_godown','consolidated')) AS available_packing_m,
        (SELECT COUNT(1) FROM mx_packings WHERE deleted_at IS NULL AND status IN ('packed','in_godown','consolidated')) AS available_packing_pcs,
        (SELECT COALESCE(SUM(length_meters),0) FROM mx_packings WHERE deleted_at IS NULL AND status='dispatched') AS dispatched_m,
        (SELECT COUNT(1) FROM mx_packings WHERE deleted_at IS NULL AND status='dispatched') AS dispatched_pcs,
        (SELECT COALESCE(SUM(meter_sent - COALESCE(meter_returned,0)),0) FROM mx_job_work WHERE deleted_at IS NULL AND processed_state='outward') AS mill_wip_m,
        (SELECT COUNT(1) FROM mx_challans WHERE deleted_at IS NULL AND status IN ('created','assigned','assembling')) AS open_challans
    `,
      )
      .get();

    const millWip = db
      .prepare(
        `
      SELECT w.name AS worker_name, COUNT(1) AS open_jobs,
             COALESCE(SUM(j.meter_sent - COALESCE(j.meter_returned,0)),0) AS meters_outstanding,
             MIN(j.outward_date) AS oldest_outward
      FROM mx_job_work j
      JOIN mx_job_workers w ON w.id = j.job_worker_id
      WHERE j.deleted_at IS NULL AND j.processed_state = 'outward'
      GROUP BY w.id
      ORDER BY meters_outstanding DESC
    `,
      )
      .all();

    const godown = db
      .prepare(
        `
      SELECT COALESCE(g.name, 'Unassigned') AS godown_name, COALESCE(g.code, '-') AS godown_code,
             COUNT(1) AS pieces, COALESCE(SUM(p.length_meters),0) AS meters
      FROM mx_packings p
      LEFT JOIN mx_godowns g ON g.id = p.godown_id
      WHERE p.deleted_at IS NULL AND p.status IN ('in_godown','consolidated','packed')
      GROUP BY g.id
      ORDER BY meters DESC
    `,
      )
      .all();

    const challans = db
      .prepare(`SELECT status, COUNT(1) AS n FROM mx_challans WHERE deleted_at IS NULL GROUP BY status`)
      .all();

    const parcels = db
      .prepare(
        `
      SELECT status, COUNT(1) AS n, COALESCE(SUM(total_meters),0) AS meters
      FROM mx_parcels WHERE deleted_at IS NULL GROUP BY status
    `,
      )
      .all();

    const openConflicts = (
      db.prepare(`SELECT COUNT(1) AS c FROM mx_sync_conflicts WHERE status='open'`).get() as { c: number }
    ).c;

    return {
      data: {
        totals,
        rolls_by_status: rollMeters,
        packings_by_status: packingByStatus,
        mill_wip: millWip,
        godown,
        challans_by_status: challans,
        parcels_by_status: parcels,
        open_conflicts: openConflicts,
      },
    };
  });

  /** Stock breakdown by variant — core owner view */
  app.get("/mx/analytics/stock-by-variant", async () => {
    const rows = db
      .prepare(
        `
      SELECT
        v.variant_code,
        v.variant_name,
        v.color,
        i.code AS item_code,
        i.name AS item_name,
        i.quality,
        COALESCE(r.roll_remaining, 0) AS roll_remaining_m,
        COALESCE(r.roll_count, 0) AS roll_count,
        COALESCE(pk.packed_m, 0) AS packed_m,
        COALESCE(pk.packed_pcs, 0) AS packed_pcs,
        COALESCE(pk.godown_m, 0) AS godown_m,
        COALESCE(pk.godown_pcs, 0) AS godown_pcs,
        COALESCE(pk.consol_m, 0) AS consolidated_m,
        COALESCE(pk.consol_pcs, 0) AS consolidated_pcs,
        COALESCE(pk.disp_m, 0) AS dispatched_m,
        COALESCE(pk.disp_pcs, 0) AS dispatched_pcs,
        (COALESCE(pk.packed_m,0)+COALESCE(pk.godown_m,0)+COALESCE(pk.consol_m,0)) AS available_m,
        (COALESCE(pk.packed_pcs,0)+COALESCE(pk.godown_pcs,0)+COALESCE(pk.consol_pcs,0)) AS available_pcs
      FROM mx_item_variants v
      JOIN mx_items i ON i.id = v.item_id
      LEFT JOIN (
        SELECT variant_code,
               SUM(remaining_meterage) AS roll_remaining,
               COUNT(1) AS roll_count
        FROM mx_rolls WHERE deleted_at IS NULL
        GROUP BY variant_code
      ) r ON r.variant_code = v.variant_code
      LEFT JOIN (
        SELECT variant_code,
          SUM(CASE WHEN status='packed' THEN length_meters ELSE 0 END) AS packed_m,
          SUM(CASE WHEN status='packed' THEN 1 ELSE 0 END) AS packed_pcs,
          SUM(CASE WHEN status='in_godown' THEN length_meters ELSE 0 END) AS godown_m,
          SUM(CASE WHEN status='in_godown' THEN 1 ELSE 0 END) AS godown_pcs,
          SUM(CASE WHEN status='consolidated' THEN length_meters ELSE 0 END) AS consol_m,
          SUM(CASE WHEN status='consolidated' THEN 1 ELSE 0 END) AS consol_pcs,
          SUM(CASE WHEN status='dispatched' THEN length_meters ELSE 0 END) AS disp_m,
          SUM(CASE WHEN status='dispatched' THEN 1 ELSE 0 END) AS disp_pcs
        FROM mx_packings WHERE deleted_at IS NULL
        GROUP BY variant_code
      ) pk ON pk.variant_code = v.variant_code
      WHERE v.deleted_at IS NULL AND i.deleted_at IS NULL
      ORDER BY available_m DESC, v.variant_code
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/analytics/stock-by-supplier", async () => {
    const rows = db
      .prepare(
        `
      SELECT s.name AS supplier_name,
             COUNT(DISTINCT r.roll_id) AS rolls,
             COALESCE(SUM(r.original_meterage),0) AS original_m,
             COALESCE(SUM(r.remaining_meterage),0) AS remaining_m,
             COALESCE(SUM(CASE WHEN r.status='at_job_work' THEN r.remaining_meterage ELSE 0 END),0) AS at_mill_m,
             COALESCE(SUM(CASE WHEN r.status='in_cutting' THEN r.remaining_meterage ELSE 0 END),0) AS in_cutting_m
      FROM mx_suppliers s
      LEFT JOIN mx_rolls r ON r.supplier_id = s.id AND r.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY remaining_m DESC
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/analytics/godown-detail", async () => {
    const rows = db
      .prepare(
        `
      SELECT COALESCE(g.name, 'Unassigned') AS godown_name, COALESCE(g.code, '-') AS godown_code,
             p.variant_code, v.variant_name, v.color, i.name AS item_name,
             p.location_hint, p.short_code, p.packing_id, p.length_meters, p.status, p.packing_date,
             CAST((julianday('now') - julianday(p.packing_date)) AS INTEGER) AS age_days
      FROM mx_packings p
      LEFT JOIN mx_godowns g ON g.id = p.godown_id
      LEFT JOIN mx_item_variants v ON v.variant_code = p.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE p.deleted_at IS NULL AND p.status IN ('packed','in_godown','consolidated')
      ORDER BY g.name, p.location_hint, p.variant_code
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/analytics/aging", async () => {
    const rows = db
      .prepare(
        `
      SELECT p.packing_id, p.short_code, p.variant_code, p.length_meters, p.status, p.packing_date, p.location_hint,
             g.name AS godown_name, v.variant_name, v.color,
             CAST((julianday('now') - julianday(p.packing_date)) AS INTEGER) AS age_days,
             r.short_code AS roll_short, s.name AS supplier_name
      FROM mx_packings p
      JOIN mx_rolls r ON r.roll_id = p.parent_roll_id
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_godowns g ON g.id = p.godown_id
      LEFT JOIN mx_item_variants v ON v.variant_code = p.variant_code
      WHERE p.deleted_at IS NULL AND p.status IN ('packed','in_godown','consolidated')
      ORDER BY age_days DESC
      LIMIT 200
    `,
      )
      .all();
    return { data: rows };
  });

  app.get("/mx/analytics/movement", async () => {
    const daily = db
      .prepare(
        `
      SELECT day,
             SUM(roll_in) AS roll_in,
             SUM(cut) AS cut,
             SUM(dispatched) AS dispatched
      FROM (
        SELECT substr(received_date,1,10) AS day, original_meterage AS roll_in, 0 AS cut, 0 AS dispatched
        FROM mx_rolls WHERE deleted_at IS NULL
        UNION ALL
        SELECT substr(packing_date,1,10), 0, length_meters, 0
        FROM mx_packings WHERE deleted_at IS NULL
        UNION ALL
        SELECT substr(updated_at,1,10), 0, 0, length_meters
        FROM mx_packings WHERE deleted_at IS NULL AND status='dispatched'
      )
      WHERE day IS NOT NULL
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `,
      )
      .all();
    return { data: daily };
  });

  app.get("/mx/analytics/lineage/:ref", async (req, reply) => {
    const { ref } = req.params as { ref: string };

    const packing = db
      .prepare(
        `
      SELECT p.*, r.roll_id, r.short_code AS roll_short, r.original_meterage, r.remaining_meterage, r.status AS roll_status,
             s.name AS supplier_name, v.variant_name, v.color, i.code AS item_code, i.name AS item_name, i.quality
      FROM mx_packings p
      JOIN mx_rolls r ON r.roll_id = p.parent_roll_id
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = p.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE (p.packing_id=? OR p.short_code=?) AND p.deleted_at IS NULL
    `,
      )
      .get(ref, ref) as any;

    if (packing) {
      const jobWork = db
        .prepare(`SELECT j.*, w.name AS worker_name FROM mx_job_work j JOIN mx_job_workers w ON w.id=j.job_worker_id WHERE j.roll_id=? AND j.deleted_at IS NULL`)
        .all(packing.roll_id);
      const challanScans = db
        .prepare(
          `
        SELECT s.*, c.challan_no, c.status AS challan_status
        FROM mx_challan_scans s
        JOIN mx_challans c ON c.challan_id = s.challan_id
        WHERE s.scanned_ref IN (?, ?) OR (s.scan_type='parcel' AND s.scanned_ref IN (
          SELECT parcel_id FROM mx_parcel_items WHERE packing_id=?
          UNION SELECT short_code FROM mx_parcels WHERE parcel_id IN (SELECT parcel_id FROM mx_parcel_items WHERE packing_id=?)
        ))
      `,
        )
        .all(packing.packing_id, packing.short_code, packing.packing_id, packing.packing_id);
      const siblings = db
        .prepare(`SELECT packing_id, short_code, length_meters, status FROM mx_packings WHERE parent_roll_id=? AND deleted_at IS NULL`)
        .all(packing.parent_roll_id);
      return {
        data: {
          type: "packing",
          packing,
          job_work: jobWork,
          challan_scans: challanScans,
          sibling_packings: siblings,
        },
      };
    }

    const parcel = db.prepare(`SELECT * FROM mx_parcels WHERE (parcel_id=? OR short_code=?) AND deleted_at IS NULL`).get(ref, ref) as any;
    if (parcel) {
      const items = db
        .prepare(
          `
        SELECT pk.*, r.short_code AS roll_short, s.name AS supplier_name, v.variant_name, v.color
        FROM mx_parcel_items i
        JOIN mx_packings pk ON pk.packing_id = i.packing_id
        JOIN mx_rolls r ON r.roll_id = pk.parent_roll_id
        JOIN mx_suppliers s ON s.id = r.supplier_id
        LEFT JOIN mx_item_variants v ON v.variant_code = pk.variant_code
        WHERE i.parcel_id = ?
      `,
        )
        .all(parcel.parcel_id);
      return { data: { type: "parcel", parcel, items } };
    }

    const roll = db
      .prepare(
        `
      SELECT r.*, s.name AS supplier_name, v.variant_name, v.color, i.name AS item_name
      FROM mx_rolls r
      JOIN mx_suppliers s ON s.id = r.supplier_id
      LEFT JOIN mx_item_variants v ON v.variant_code = r.variant_code
      LEFT JOIN mx_items i ON i.id = v.item_id
      WHERE (r.roll_id=? OR r.short_code=?) AND r.deleted_at IS NULL
    `,
      )
      .get(ref, ref) as any;
    if (roll) {
      const packings = db.prepare(`SELECT * FROM mx_packings WHERE parent_roll_id=? AND deleted_at IS NULL`).all(roll.roll_id);
      const jobWork = db
        .prepare(`SELECT j.*, w.name AS worker_name FROM mx_job_work j JOIN mx_job_workers w ON w.id=j.job_worker_id WHERE j.roll_id=? AND j.deleted_at IS NULL`)
        .all(roll.roll_id);
      return { data: { type: "roll", roll, packings, job_work: jobWork } };
    }

    return reply.code(404).send({ error: "No lineage found for ref" });
  });

  /** Party-wise challan pendency + dispatch progress */
  app.get("/mx/analytics/by-party", async () => {
    const rows = db
      .prepare(
        `
      SELECT
        COALESCE(p.id, 0) AS party_id,
        COALESCE(p.name, c.party_name, a.party_name, 'Unknown') AS party_name,
        p.gstin, p.phone,
        COUNT(1) AS challan_count,
        SUM(CASE WHEN c.status IN ('created','assigned','assembling') THEN 1 ELSE 0 END) AS open_challans,
        SUM(CASE WHEN c.status='dispatched' THEN 1 ELSE 0 END) AS dispatched_challans,
        SUM(CASE WHEN c.status='delivered' THEN 1 ELSE 0 END) AS delivered_challans,
        COALESCE(SUM(req.req_m),0) AS required_m,
        COALESCE(SUM(req.req_pcs),0) AS required_pcs
      FROM mx_challans c
      LEFT JOIN mx_parties p ON p.id = c.party_id
      LEFT JOIN mx_delivery_addresses a ON a.id = c.address_id
      LEFT JOIN (
        SELECT challan_id, SUM(required_meters) AS req_m, SUM(required_pieces) AS req_pcs
        FROM mx_challan_requirements GROUP BY challan_id
      ) req ON req.challan_id = c.challan_id
      WHERE c.deleted_at IS NULL
      GROUP BY COALESCE(p.id, 0), COALESCE(p.name, c.party_name, a.party_name, 'Unknown'), p.gstin, p.phone
      ORDER BY open_challans DESC, challan_count DESC
    `,
      )
      .all();
    return { data: rows };
  });

  /** Job-work pendency / progress / receive confirmation */
  app.get("/mx/analytics/job-work-pendency", async () => {
    const open = db
      .prepare(
        `
      SELECT j.*, w.name AS worker_name, w.job_work_type, r.short_code AS roll_short, r.variant_code,
             CAST((julianday('now') - julianday(j.outward_date)) AS INTEGER) AS days_out,
             (j.meter_sent - COALESCE(j.meter_returned,0)) AS meters_outstanding
      FROM mx_job_work j
      JOIN mx_job_workers w ON w.id = j.job_worker_id
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      WHERE j.deleted_at IS NULL AND j.processed_state = 'outward'
      ORDER BY days_out DESC
    `,
      )
      .all();

    const awaitingConfirm = db
      .prepare(
        `
      SELECT j.*, w.name AS worker_name, r.short_code AS roll_short, r.variant_code,
             COALESCE(j.shortage_meters, 0) AS shortage_meters
      FROM mx_job_work j
      JOIN mx_job_workers w ON w.id = j.job_worker_id
      JOIN mx_rolls r ON r.roll_id = j.roll_id
      WHERE j.deleted_at IS NULL
        AND j.processed_state IN ('inward','closed')
        AND j.received_confirmed_at IS NULL
      ORDER BY j.inward_date DESC
    `,
      )
      .all();

    const byWorker = db
      .prepare(
        `
      SELECT w.name AS worker_name, w.job_work_type,
        SUM(CASE WHEN j.processed_state='outward' THEN 1 ELSE 0 END) AS open_jobs,
        SUM(CASE WHEN j.processed_state='outward' THEN j.meter_sent - COALESCE(j.meter_returned,0) ELSE 0 END) AS meters_out,
        SUM(CASE WHEN j.processed_state IN ('inward','closed') AND j.received_confirmed_at IS NULL THEN 1 ELSE 0 END) AS unconfirmed_returns,
        SUM(CASE WHEN j.received_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS confirmed_returns,
        SUM(COALESCE(j.shortage_meters,0)) AS total_shortage_m
      FROM mx_job_workers w
      LEFT JOIN mx_job_work j ON j.job_worker_id = w.id AND j.deleted_at IS NULL
      WHERE w.deleted_at IS NULL
      GROUP BY w.id
      ORDER BY meters_out DESC
    `,
      )
      .all();

    return { data: { open, awaiting_confirm: awaitingConfirm, by_worker: byWorker } };
  });
}
