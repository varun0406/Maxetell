import type { Db } from "./db.js";

function uuid() {
  return globalThis.crypto.randomUUID();
}

function short(prefix: string, id: string) {
  return `${prefix}${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Rich demo dataset for Maxwell — runs when empty/sparse, or when force=true */
export function seedMaxwellDemo(db: Db, opts?: { force?: boolean }) {
  const itemCount = (db.prepare(`SELECT COUNT(1) AS c FROM mx_items`).get() as { c: number }).c;
  const packingCount = (db.prepare(`SELECT COUNT(1) AS c FROM mx_packings`).get() as { c: number }).c;
  const rollCount = (db.prepare(`SELECT COUNT(1) AS c FROM mx_rolls`).get() as { c: number }).c;

  const sparse = itemCount > 0 && (packingCount < 5 || rollCount < 8);
  if (!opts?.force && itemCount > 0 && !sparse) return;
  if (opts?.force || sparse) {
    clearMaxwellDemo(db);
  }

  const txn = db.transaction(() => {
    const insSup = db.prepare(`INSERT INTO mx_suppliers(name, contact) VALUES (?,?)`);
    const s1 = Number(insSup.run("Surat Fabrics Pvt Ltd", "98765-11101").lastInsertRowid);
    const s2 = Number(insSup.run("Raymond Cloth Mills", "98765-11102").lastInsertRowid);
    const s3 = Number(insSup.run("Vardhman Textiles", "98765-11103").lastInsertRowid);
    const s4 = Number(insSup.run("Arvind Limited", "98765-11104").lastInsertRowid);

    const insJw = db.prepare(`INSERT INTO mx_job_workers(name, contact, job_work_type) VALUES (?,?,?)`);
    const j1 = Number(insJw.run("Shree Process House", "98200-20001", "Dyeing").lastInsertRowid);
    const j2 = Number(insJw.run("Omkar Finishing", "98200-20002", "Finishing").lastInsertRowid);
    const j3 = Number(insJw.run("City Print Works", "98200-20003", "Printing").lastInsertRowid);

    const insG = db.prepare(`INSERT INTO mx_godowns(code, name, location) VALUES (?,?,?)`);
    const g1 = Number(insG.run("G1", "Main Godown", "Ground Floor").lastInsertRowid);
    const g2 = Number(insG.run("G2", "Annex Warehouse", "First Floor Rack A-D").lastInsertRowid);
    const g3 = Number(insG.run("G3", "Dispatch Bay", "Loading Dock").lastInsertRowid);

    const insParty = db.prepare(
      `INSERT INTO mx_parties(name, address_line, city, state, gstin, phone) VALUES (?,?,?,?,?,?)`,
    );
    const p1 = Number(
      insParty.run("Fashion Hub Retail", "12 Ring Road, Textile Market", "Surat", "Gujarat", "24AABCF1234A1Z5", "98765-44001")
        .lastInsertRowid,
    );
    const p2 = Number(
      insParty.run("Metro Garments", "45 Industrial Estate", "Ahmedabad", "Gujarat", "24AABCM5678B1Z2", "98765-44002")
        .lastInsertRowid,
    );
    const p3 = Number(
      insParty.run("Style Mart", "88 MG Road", "Mumbai", "Maharashtra", "27AABCS9012C1Z8", "98765-44003").lastInsertRowid,
    );
    const p4 = Number(
      insParty.run("Cloth Corner", "3 Textile Market", "Surat", "Gujarat", "24AABCC3456D1Z1", "98765-44004").lastInsertRowid,
    );

    const insAgent = db.prepare(`INSERT INTO mx_agents(name, phone) VALUES (?,?)`);
    const ag1 = Number(insAgent.run("Ramesh Patel", "98111-10001").lastInsertRowid);
    const ag2 = Number(insAgent.run("Suresh Shah", "98111-10002").lastInsertRowid);

    const insA = db.prepare(
      `INSERT INTO mx_delivery_addresses(party_id, party_name, address_line, city, state, phone, label) VALUES (?,?,?,?,?,?,?)`,
    );
    const a1 = Number(
      insA.run(p1, "Fashion Hub Retail", "Dispatch Gate B, Ring Road", "Surat", "Gujarat", "98765-44001", "Deliver to").lastInsertRowid,
    );
    const a2 = Number(
      insA.run(p2, "Metro Garments", "Warehouse 2, Industrial Estate", "Ahmedabad", "Gujarat", "98765-44002", "Deliver to")
        .lastInsertRowid,
    );
    const a3 = Number(
      insA.run(p3, "Style Mart", "Loading Bay, MG Road", "Mumbai", "Maharashtra", "98765-44003", "Deliver to").lastInsertRowid,
    );
    const a4 = Number(
      insA.run(p4, "Cloth Corner", "Shop front, Textile Market", "Surat", "Gujarat", "98765-44004", "Deliver to").lastInsertRowid,
    );

    const items = [
      { code: "1", name: "Carens", quality: "Premium Cotton" },
      { code: "2", name: "Linen Soft", quality: "European Linen" },
      { code: "3", name: "Silk Touch", quality: "Blend 60/40" },
      { code: "4", name: "Denim Core", quality: "Heavy Denim" },
      { code: "5", name: "Voile Light", quality: "Sheer Cotton" },
    ];
    const insI = db.prepare(`INSERT INTO mx_items(code, name, quality) VALUES (?,?,?)`);
    const itemIds: number[] = [];
    for (const it of items) itemIds.push(Number(insI.run(it.code, it.name, it.quality).lastInsertRowid));

    const variants: { item_id: number; code: string; name: string; color: string }[] = [
      { item_id: itemIds[0], code: "1-a", name: "Light Blue", color: "Blue" },
      { item_id: itemIds[0], code: "1-b", name: "Navy", color: "Navy" },
      { item_id: itemIds[0], code: "1-c", name: "White", color: "White" },
      { item_id: itemIds[1], code: "2-a", name: "Beige", color: "Beige" },
      { item_id: itemIds[1], code: "2-b", name: "Olive", color: "Olive" },
      { item_id: itemIds[2], code: "3-a", name: "Ivory", color: "Ivory" },
      { item_id: itemIds[2], code: "3-b", name: "Rose", color: "Pink" },
      { item_id: itemIds[3], code: "4-a", name: "Indigo", color: "Indigo" },
      { item_id: itemIds[3], code: "4-b", name: "Black", color: "Black" },
      { item_id: itemIds[4], code: "5-a", name: "Sky", color: "Sky Blue" },
      { item_id: itemIds[4], code: "5-b", name: "Mint", color: "Mint" },
    ];
    const insV = db.prepare(`INSERT INTO mx_item_variants(item_id, variant_code, variant_name, color) VALUES (?,?,?,?)`);
    for (const v of variants) insV.run(v.item_id, v.code, v.name, v.color);

    const insR = db.prepare(`
      INSERT INTO mx_rolls(roll_id, short_code, lot_no, supplier_id, variant_code, original_meterage, remaining_meterage, status, received_date, notes, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `);

    type RollSeed = {
      supplier: number;
      variant: string;
      meters: number;
      remaining: number;
      status: string;
      days: number;
    };
    const rollSeeds: RollSeed[] = [
      { supplier: s1, variant: "1-a", meters: 120, remaining: 45, status: "in_cutting", days: 18 },
      { supplier: s1, variant: "1-a", meters: 100, remaining: 100, status: "inward", days: 3 },
      { supplier: s1, variant: "1-b", meters: 110, remaining: 28, status: "in_cutting", days: 22 },
      { supplier: s2, variant: "1-c", meters: 95, remaining: 0, status: "depleted", days: 40 },
      { supplier: s2, variant: "2-a", meters: 120, remaining: 70, status: "in_cutting", days: 12 },
      { supplier: s2, variant: "2-b", meters: 80, remaining: 80, status: "at_job_work", days: 8 },
      { supplier: s3, variant: "3-a", meters: 100, remaining: 55, status: "in_cutting", days: 15 },
      { supplier: s3, variant: "3-b", meters: 90, remaining: 90, status: "inward", days: 2 },
      { supplier: s4, variant: "4-a", meters: 120, remaining: 40, status: "in_cutting", days: 25 },
      { supplier: s4, variant: "4-b", meters: 100, remaining: 100, status: "inward", days: 5 },
      { supplier: s1, variant: "5-a", meters: 85, remaining: 35, status: "in_cutting", days: 10 },
      { supplier: s3, variant: "5-b", meters: 100, remaining: 60, status: "in_cutting", days: 7 },
      { supplier: s2, variant: "1-a", meters: 110, remaining: 110, status: "inward", days: 1 },
      { supplier: s4, variant: "2-a", meters: 95, remaining: 95, status: "at_job_work", days: 6 },
    ];

    const rolls: { id: string; short: string; variant: string; remaining: number }[] = [];
    let lotSeq = 1001;
    for (const rs of rollSeeds) {
      const id = uuid();
      const lot = `LOT-${rs.variant.toUpperCase()}-${lotSeq++}`;
      insR.run(id, lot, lot, rs.supplier, rs.variant, rs.meters, rs.remaining, rs.status, daysAgo(rs.days), "Demo seed");
      rolls.push({ id, short: lot, variant: rs.variant, remaining: rs.remaining });
    }

    // Job work open + returned
    const insJwOut = db.prepare(`
      INSERT INTO mx_job_work(job_work_id, roll_id, job_worker_id, outward_date, meter_sent, meter_returned, processed_state, notes, updated_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'))
    `);
    const atJw = rolls.filter((_, i) => rollSeeds[i].status === "at_job_work");
    for (let i = 0; i < atJw.length; i++) {
      const r = atJw[i];
      insJwOut.run(uuid(), r.id, i % 2 === 0 ? j1 : j2, daysAgo(6), 40, 0, "outward", "Demo WIP");
    }
    // one returned job
    const cutRoll = rolls[0];
    insJwOut.run(uuid(), cutRoll.id, j3, daysAgo(20), 50, 48, "inward", "Demo returned");

    // Packings across statuses
    const insP = db.prepare(`
      INSERT INTO mx_packings(packing_id, short_code, parent_roll_id, length_meters, variant_code, godown_id, location_hint, status, packing_date, notes, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `);

    const packingIds: { id: string; short: string; variant: string; meters: number; status: string }[] = [];
    function addPacking(rollIdx: number, meters: number, status: string, ageDays: number, godown?: number, rack?: string) {
      const roll = rolls[rollIdx];
      const id = uuid();
      const sc = short("P", id);
      insP.run(id, sc, roll.id, meters, roll.variant, godown ?? null, rack ?? null, status, daysAgo(ageDays), "Demo");
      packingIds.push({ id, short: sc, variant: roll.variant, meters, status });
      return { id, short: sc, variant: roll.variant, meters };
    }

    // packed (not yet godown)
    addPacking(0, 50, "packed", 1);
    addPacking(0, 25, "packed", 0);
    addPacking(2, 40, "packed", 2);
    // in godown
    addPacking(4, 30, "in_godown", 8, g1, "Rack A2");
    addPacking(4, 20, "in_godown", 8, g1, "Rack A2");
    addPacking(6, 25, "in_godown", 12, g2, "Rack B1");
    addPacking(6, 20, "in_godown", 14, g2, "Rack B3");
    addPacking(8, 35, "in_godown", 18, g1, "Rack C1");
    addPacking(8, 25, "in_godown", 20, g3, "Bay 1");
    addPacking(10, 30, "in_godown", 5, g1, "Rack A1");
    addPacking(11, 25, "in_godown", 4, g2, "Rack B2");
    addPacking(2, 30, "in_godown", 25, g1, "Rack A4");
    // consolidated (will link to parcels)
    const c1 = addPacking(0, 20, "consolidated", 6, g1, "Rack A3");
    const c2 = addPacking(4, 15, "consolidated", 6, g1, "Rack A3");
    const c3 = addPacking(6, 18, "consolidated", 7, g2, "Rack B1");
    const c4 = addPacking(8, 22, "consolidated", 9, g1, "Rack C2");
    const c5 = addPacking(10, 20, "consolidated", 3, g3, "Bay 2");
    const c6 = addPacking(11, 15, "consolidated", 3, g3, "Bay 2");
    // dispatched
    addPacking(3, 40, "dispatched", 30, g1, "Out");
    addPacking(3, 35, "dispatched", 28, g1, "Out");
    addPacking(8, 20, "dispatched", 15, g3, "Out");

    // Parcels
    const insParcel = db.prepare(`
      INSERT INTO mx_parcels(parcel_id, short_code, total_meters, status, created_at, updated_at)
      VALUES (?,?,?,'sealed',?,datetime('now'))
    `);
    const insPI = db.prepare(`INSERT INTO mx_parcel_items(parcel_id, packing_id) VALUES (?,?)`);
    const updP = db.prepare(`UPDATE mx_packings SET parcel_id=?, status='consolidated', updated_at=datetime('now') WHERE packing_id=?`);

    function makeParcel(items: { id: string; meters: number }[], age: number) {
      const id = uuid();
      const sc = short("C", id);
      const total = items.reduce((s, x) => s + x.meters, 0);
      insParcel.run(id, sc, total, daysAgo(age));
      for (const it of items) {
        insPI.run(id, it.id);
        updP.run(id, it.id);
      }
      return { id, short: sc, total };
    }

    const parcel1 = makeParcel([c1, c2, c3], 5);
    const parcel2 = makeParcel([c4, c5, c6], 3);

    // Challans — party (billing) + ship-to address + agent
    const insCh = db.prepare(`
      INSERT INTO mx_challans(
        challan_id, challan_no, challan_date, address_id, party_id, party_name,
        agent_id, agent_name, status, notes, allow_partial, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,0,datetime('now'))
    `);
    const insReq = db.prepare(`
      INSERT INTO mx_challan_requirements(challan_id, variant_code, required_meters, required_pieces) VALUES (?,?,?,?)
    `);
    const insScan = db.prepare(`
      INSERT INTO mx_challan_scans(scan_id, challan_id, scan_type, scanned_ref, scanned_at, updated_at)
      VALUES (?,?,?,?,?,datetime('now'))
    `);

    const ch1 = uuid();
    insCh.run(ch1, short("DC", ch1), daysAgo(1), a1, p1, "Fashion Hub Retail", ag1, "Ramesh Patel", "assembling", "Demo open challan");
    insReq.run(ch1, "1-a", 50, 2);
    insReq.run(ch1, "2-a", 30, 1);

    const ch2 = uuid();
    insCh.run(ch2, short("DC", ch2), daysAgo(2), a2, p2, "Metro Garments", ag2, "Suresh Shah", "created", "Awaiting floor");
    insReq.run(ch2, "3-a", 40, 2);
    insReq.run(ch2, "4-a", 35, 1);

    const ch3 = uuid();
    insCh.run(ch3, short("DC", ch3), daysAgo(10), a3, p3, "Style Mart", ag1, "Ramesh Patel", "dispatched", "Completed demo");
    insReq.run(ch3, "1-c", 70, 2);
    // use dispatched packings short codes - find them
    const dispatched = packingIds.filter((p) => p.status === "dispatched");
    if (dispatched[0]) insScan.run(uuid(), ch3, "packing", dispatched[0].id, daysAgo(9));
    if (dispatched[1]) insScan.run(uuid(), ch3, "packing", dispatched[1].id, daysAgo(9));

    const ch4 = uuid();
    insCh.run(ch4, short("DC", ch4), daysAgo(0), a4, p4, "Cloth Corner", ag2, "Suresh Shah", "assigned", "Peak season direct");
    insReq.run(ch4, "5-a", 30, 1);
    insReq.run(ch4, "5-b", 25, 1);
    insScan.run(uuid(), ch4, "parcel", parcel1.id, daysAgo(0));

    void parcel2;
  });

  txn();
}

export function clearMaxwellDemo(db: Db) {
  db.exec(`
    DELETE FROM mx_challan_scans;
    DELETE FROM mx_challan_requirements;
    DELETE FROM mx_challans;
    DELETE FROM mx_parcel_items;
    DELETE FROM mx_parcels;
    DELETE FROM mx_packings;
    DELETE FROM mx_job_work;
    DELETE FROM mx_rolls;
    DELETE FROM mx_item_variants;
    DELETE FROM mx_items;
    DELETE FROM mx_delivery_addresses;
    DELETE FROM mx_agents;
    DELETE FROM mx_parties;
    DELETE FROM mx_godowns;
    DELETE FROM mx_job_workers;
    DELETE FROM mx_suppliers;
    DELETE FROM mx_sync_conflicts;
  `);
}

export function reseedMaxwellDemo(db: Db) {
  seedMaxwellDemo(db, { force: true });
  return {
    items: (db.prepare(`SELECT COUNT(1) AS c FROM mx_items`).get() as { c: number }).c,
    rolls: (db.prepare(`SELECT COUNT(1) AS c FROM mx_rolls`).get() as { c: number }).c,
    packings: (db.prepare(`SELECT COUNT(1) AS c FROM mx_packings`).get() as { c: number }).c,
    challans: (db.prepare(`SELECT COUNT(1) AS c FROM mx_challans`).get() as { c: number }).c,
  };
}
