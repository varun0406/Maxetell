import type { FastifyInstance } from "fastify";
import type { Db } from "../../db.js";

export async function registerMxAlertsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get("/mx/alerts", async () => {
    // We can compute these on the fly instead of always relying on the mx_alerts table
    // For a real engine, a cron job would write to mx_alerts. 
    // Here we compute active alerts on demand for immediate feedback.
    
    const alerts = [];
    
    // 1. Unvalidated Returns > 24 hours
    // (Job work returns that are marked 'returned' but not 'received_confirmed')
    const unvalidated = db.prepare(`
      SELECT id, worker_id, roll_id, meter_sent, returned_at 
      FROM mx_job_work 
      WHERE processed_state = 'returned' 
        AND received_confirmed_at IS NULL 
        AND deleted_at IS NULL
        AND returned_at < datetime('now', '-1 day')
    `).all() as any[];

    for (const u of unvalidated) {
      alerts.push({
        id: `unvalidated_${u.id}`,
        alert_type: "unvalidated_return",
        severity: "warning",
        message: `Return unvalidated for >24h (JobWork #${u.id})`,
        entity_type: "job_work",
        entity_id: String(u.id),
        created_at: u.returned_at
      });
    }

    // 2. Job Work Pending > 7 Days (Turnaround limit)
    const overdueJobs = db.prepare(`
      SELECT j.id, j.worker_id, w.name as worker_name, j.sent_at
      FROM mx_job_work j
      JOIN mx_job_workers w ON j.worker_id = w.id
      WHERE j.processed_state = 'outward'
        AND j.deleted_at IS NULL
        AND j.sent_at < datetime('now', '-7 day')
    `).all() as any[];

    for (const o of overdueJobs) {
      alerts.push({
        id: `overdue_${o.id}`,
        alert_type: "overdue_job_work",
        severity: "critical",
        message: `Material at ${o.worker_name} >7 days (JobWork #${o.id})`,
        entity_type: "job_work",
        entity_id: String(o.id),
        created_at: o.sent_at
      });
    }

    // 3. Dead Stock (Aging > 30 days)
    // Finding packings that are not dispatched and are > 30 days old
    const deadStock = db.prepare(`
      SELECT p.id, p.code, p.meters, p.created_at, i.name as item_name
      FROM mx_packings p
      JOIN mx_rolls r ON p.roll_id = r.id
      JOIN mx_items i ON r.item_id = i.id
      WHERE p.status IN ('packed', 'godown')
        AND p.deleted_at IS NULL
        AND p.created_at < datetime('now', '-30 day')
    `).all() as any[];

    for (const d of deadStock) {
      alerts.push({
        id: `deadstock_${d.id}`,
        alert_type: "dead_stock",
        severity: "info",
        message: `${d.item_name} packing ${d.code} (${d.meters}m) is aging >30 days`,
        entity_type: "packing",
        entity_id: String(d.id),
        created_at: d.created_at
      });
    }

    // Combine with any manual/system alerts from mx_alerts table
    const storedAlerts = db.prepare(`SELECT * FROM mx_alerts WHERE is_resolved = 0`).all();
    
    return { data: [...storedAlerts, ...alerts] };
  });
}
