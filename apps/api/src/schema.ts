import type { Db } from "./db.js";
import { seedMaxwellDemo } from "./seed.js";

export function migrate(db: Db) {
  migrateAppUsers(db);
  migrateMaxwellDomain(db);
  seedMaxwellDemo(db);
}

function migrateAppUsers(db: Db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS app_users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
}

/** Maxwell cloth trading domain — offline-first lineage model */
function migrateMaxwellDomain(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mx_items (
      id          INTEGER PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL UNIQUE,
      quality     TEXT,
      deleted_at  TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_item_variants (
      id            INTEGER PRIMARY KEY,
      item_id       INTEGER NOT NULL REFERENCES mx_items(id),
      variant_code  TEXT NOT NULL UNIQUE,
      variant_name  TEXT NOT NULL,
      color         TEXT,
      deleted_at    TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_suppliers (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      contact     TEXT,
      deleted_at  TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_job_workers (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      contact       TEXT,
      job_work_type TEXT,
      deleted_at    TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_godowns (
      id          INTEGER PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      location    TEXT,
      deleted_at  TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_delivery_addresses (
      id           INTEGER PRIMARY KEY,
      party_name   TEXT NOT NULL,
      address_line TEXT,
      city         TEXT,
      state        TEXT,
      deleted_at   TEXT,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_rolls (
      roll_id              TEXT PRIMARY KEY,
      short_code           TEXT NOT NULL UNIQUE,
      supplier_id          INTEGER NOT NULL REFERENCES mx_suppliers(id),
      variant_code         TEXT NOT NULL,
      original_meterage    REAL NOT NULL CHECK(original_meterage > 0),
      remaining_meterage   REAL NOT NULL CHECK(remaining_meterage >= 0),
      status               TEXT NOT NULL DEFAULT 'inward'
                           CHECK(status IN ('inward','at_job_work','in_cutting','depleted')),
      received_date        TEXT NOT NULL,
      notes                TEXT,
      version              INTEGER NOT NULL DEFAULT 1,
      deleted_at           TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_job_work (
      job_work_id      TEXT PRIMARY KEY,
      roll_id          TEXT NOT NULL REFERENCES mx_rolls(roll_id),
      job_worker_id    INTEGER NOT NULL REFERENCES mx_job_workers(id),
      outward_date     TEXT NOT NULL,
      inward_date      TEXT,
      meter_sent       REAL NOT NULL CHECK(meter_sent > 0),
      meter_returned   REAL DEFAULT 0 CHECK(meter_returned >= 0),
      processed_state  TEXT NOT NULL DEFAULT 'outward'
                       CHECK(processed_state IN ('outward','inward','closed')),
      notes            TEXT,
      version          INTEGER NOT NULL DEFAULT 1,
      deleted_at       TEXT,
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_packings (
      packing_id       TEXT PRIMARY KEY,
      short_code       TEXT NOT NULL UNIQUE,
      parent_roll_id   TEXT NOT NULL REFERENCES mx_rolls(roll_id),
      length_meters    REAL NOT NULL CHECK(length_meters > 0),
      variant_code     TEXT NOT NULL,
      godown_id        INTEGER REFERENCES mx_godowns(id),
      location_hint    TEXT,
      parcel_id        TEXT,
      status           TEXT NOT NULL DEFAULT 'packed'
                       CHECK(status IN ('packed','in_godown','consolidated','dispatched','faulty')),
      packing_date     TEXT NOT NULL,
      notes            TEXT,
      device_id        TEXT,
      version          INTEGER NOT NULL DEFAULT 1,
      deleted_at       TEXT,
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mx_packings_roll ON mx_packings(parent_roll_id);
    CREATE INDEX IF NOT EXISTS idx_mx_packings_status ON mx_packings(status);
    CREATE INDEX IF NOT EXISTS idx_mx_packings_updated ON mx_packings(updated_at);

    CREATE TABLE IF NOT EXISTS mx_parcels (
      parcel_id      TEXT PRIMARY KEY,
      short_code     TEXT NOT NULL UNIQUE,
      total_meters   REAL NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'open'
                     CHECK(status IN ('open','sealed','dispatched')),
      device_id      TEXT,
      version        INTEGER NOT NULL DEFAULT 1,
      deleted_at     TEXT,
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_parcel_items (
      parcel_id   TEXT NOT NULL REFERENCES mx_parcels(parcel_id),
      packing_id  TEXT NOT NULL UNIQUE REFERENCES mx_packings(packing_id),
      PRIMARY KEY (parcel_id, packing_id)
    );

    CREATE TABLE IF NOT EXISTS mx_challans (
      challan_id     TEXT PRIMARY KEY,
      challan_no     TEXT NOT NULL UNIQUE,
      challan_date   TEXT NOT NULL,
      address_id     INTEGER REFERENCES mx_delivery_addresses(id),
      party_name     TEXT,
      assigned_to    INTEGER REFERENCES app_users(id),
      status         TEXT NOT NULL DEFAULT 'created'
                     CHECK(status IN ('created','assigned','assembling','dispatched','delivered')),
      notes          TEXT,
      allow_partial  INTEGER NOT NULL DEFAULT 0,
      version        INTEGER NOT NULL DEFAULT 1,
      deleted_at     TEXT,
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mx_challan_requirements (
      id               INTEGER PRIMARY KEY,
      challan_id       TEXT NOT NULL REFERENCES mx_challans(challan_id) ON DELETE CASCADE,
      variant_code     TEXT NOT NULL,
      required_meters  REAL NOT NULL DEFAULT 0 CHECK(required_meters >= 0),
      required_pieces  INTEGER NOT NULL DEFAULT 0 CHECK(required_pieces >= 0)
    );

    CREATE TABLE IF NOT EXISTS mx_challan_scans (
      scan_id      TEXT PRIMARY KEY,
      challan_id   TEXT NOT NULL REFERENCES mx_challans(challan_id) ON DELETE CASCADE,
      scan_type    TEXT NOT NULL CHECK(scan_type IN ('packing','parcel')),
      scanned_ref  TEXT NOT NULL,
      scanned_at   TEXT NOT NULL,
      device_id    TEXT,
      deleted_at   TEXT,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(challan_id, scan_type, scanned_ref)
    );

    CREATE TABLE IF NOT EXISTS mx_sync_conflicts (
      id              INTEGER PRIMARY KEY,
      entity          TEXT NOT NULL,
      client_id       TEXT NOT NULL,
      device_id       TEXT,
      local_payload   TEXT NOT NULL,
      server_payload  TEXT,
      reason          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'open'
                      CHECK(status IN ('open','resolved','dismissed')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at     TEXT,
      resolved_by     INTEGER REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS mx_sync_cursors (
      device_id     TEXT PRIMARY KEY,
      last_pull_at  TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateLegacyTxIfEmpty(db);
}

function migrateLegacyTxIfEmpty(db: Db) {
  const rolls = (db.prepare(`SELECT COUNT(1) AS c FROM mx_rolls`).get() as { c: number }).c;
  if (rolls > 0) return;
  if (!tableExists(db, "tx_companies")) return;

  try {
    const companies = db.prepare(`SELECT * FROM tx_companies`).all() as any[];
    const insSup = db.prepare(`INSERT OR IGNORE INTO mx_suppliers(id, name, contact) VALUES (?,?,?)`);
    for (const c of companies) insSup.run(c.id, c.name, c.contact ?? null);

    const mills = db.prepare(`SELECT * FROM tx_mills`).all() as any[];
    const insJw = db.prepare(`INSERT OR IGNORE INTO mx_job_workers(id, name, contact, job_work_type) VALUES (?,?,?,?)`);
    for (const m of mills) insJw.run(m.id, m.name, m.contact ?? null, m.job_work_type ?? null);

    const godowns = db.prepare(`SELECT * FROM tx_godowns`).all() as any[];
    const insG = db.prepare(`INSERT OR IGNORE INTO mx_godowns(id, code, name, location) VALUES (?,?,?,?)`);
    for (const g of godowns) insG.run(g.id, g.code, g.name, g.location ?? null);

    const addrs = db.prepare(`SELECT * FROM tx_delivery_addresses`).all() as any[];
    const insA = db.prepare(`INSERT OR IGNORE INTO mx_delivery_addresses(id, party_name, address_line, city, state) VALUES (?,?,?,?,?)`);
    for (const a of addrs) insA.run(a.id, a.party_name, a.address_line ?? null, a.city ?? null, a.state ?? null);

    const items = db.prepare(`SELECT * FROM tx_items`).all() as any[];
    const insI = db.prepare(`INSERT OR IGNORE INTO mx_items(id, code, name) VALUES (?,?,?)`);
    for (const i of items) insI.run(i.id, i.code, i.name);

    const variants = db.prepare(`SELECT * FROM tx_item_variants`).all() as any[];
    const insV = db.prepare(`INSERT OR IGNORE INTO mx_item_variants(id, item_id, variant_code, variant_name, color) VALUES (?,?,?,?,?)`);
    for (const v of variants) insV.run(v.id, v.item_id, v.variant_code, v.variant_name, v.color ?? null);

    const stockIns = db.prepare(`SELECT * FROM tx_stock_in`).all() as any[];
    const insR = db.prepare(`
      INSERT OR IGNORE INTO mx_rolls(roll_id, short_code, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes)
      VALUES (?,?,?,?,?,?,'inward',?,?)
    `);
    for (const s of stockIns) {
      const rollId = globalThis.crypto.randomUUID();
      insR.run(rollId, s.lot_no, s.company_id, s.variant_code, s.meter, s.meter, s.received_date, s.notes ?? null);
    }
  } catch {
    /* best-effort */
  }
}

function tableExists(db: Db, name: string): boolean {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name));
}
