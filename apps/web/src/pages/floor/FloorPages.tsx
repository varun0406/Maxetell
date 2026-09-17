import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { buildParcelZpl, sendZplImmediate } from "../../lib/print/zpl";

function newId() {
  return crypto.randomUUID();
}

export function ParcelPage() {
  const [scans, setScans] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [detail, setDetail] = useState<any[]>([]);

  async function addScan(code: string) {
    const c = code.trim();
    if (!c || scans.includes(c)) return;
    try {
      const res = await api.get(`/mx/packings/${encodeURIComponent(c)}`);
      const p = res.data.data;
      if (p.parcel_id) {
        setMsg({ ok: false, text: `${p.short_code} already in a parcel` });
        return;
      }
      if (p.status === "dispatched") {
        setMsg({ ok: false, text: `${p.short_code} already dispatched` });
        return;
      }
      setScans((s) => [...s, p.packing_id]);
      setDetail((d) => [...d, p]);
      setInput("");
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: "Packing not found" });
    }
  }

  async function createParcel() {
    if (scans.length < 1) return;
    const parcel_id = newId();
    try {
      const res = await api.post("/mx/parcels", { parcel_id, packing_ids: scans });
      const parcel = res.data.data;
      const zpl = buildParcelZpl({
        parcelId: parcel.parcel_id,
        shortCode: parcel.short_code,
        totalMeters: parcel.total_meters,
        lines: detail.map((d) => ({ code: d.variant_code, meters: d.length_meters })),
      });
      sendZplImmediate(zpl);
      setMsg({ ok: true, text: `Parcel ${parcel.short_code} sealed · printing` });
      setScans([]);
      setDetail([]);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Failed" });
    }
  }

  return (
    <div>
      <h1 className="floor-h1">Parcel</h1>
      <p className="floor-sub">Scan packing stickers, then seal & print master label.</p>
      {msg && <div className={`floor-toast ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <input
        className="floor-input floor-mono"
        placeholder="Scan packing barcode…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void addScan(input)}
        autoFocus
      />
      {detail.map((d) => (
        <div key={d.packing_id} className="floor-list-item">
          <div>
            <strong className="floor-mono">{d.short_code}</strong>
            <div style={{ color: "var(--mx-muted)", fontSize: 14 }}>
              {d.variant_code} · {d.length_meters}m
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="floor-btn" disabled={scans.length < 1} onClick={() => void createParcel()}>
        Create parcel ({scans.length})
      </button>
    </div>
  );
}

export function GodownReceivePage() {
  const [godowns, setGodowns] = useState<any[]>([]);
  const [godownId, setGodownId] = useState(0);
  const [hint, setHint] = useState("");
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get("/mx/godowns").then((r) => {
      const list = r.data.data ?? [];
      setGodowns(list);
      if (list[0]) setGodownId(list[0].id);
    });
  }, []);

  async function receive() {
    if (!scan || !godownId) return;
    try {
      const p = await api.get(`/mx/packings/${encodeURIComponent(scan.trim())}`);
      await api.post(`/mx/packings/${p.data.data.packing_id}/godown`, {
        godown_id: godownId,
        location_hint: hint || undefined,
      });
      setMsg({ ok: true, text: `${p.data.data.short_code} → godown` });
      setScan("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Failed" });
    }
  }

  return (
    <div>
      <h1 className="floor-h1">Godown receive</h1>
      <p className="floor-sub">Scan packing into a rack / location.</p>
      {msg && <div className={`floor-toast ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <div className="floor-label">Godown</div>
      <select className="floor-select" value={godownId} onChange={(e) => setGodownId(Number(e.target.value))}>
        {godowns.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.code})
          </option>
        ))}
      </select>
      <div className="floor-label">Rack / location</div>
      <input className="floor-input" placeholder="e.g. A-12" value={hint} onChange={(e) => setHint(e.target.value)} />
      <div className="floor-label">Scan packing</div>
      <input
        className="floor-input floor-mono"
        placeholder="Scan packing…"
        value={scan}
        autoFocus
        onChange={(e) => setScan(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void receive()}
      />
      <button type="button" className="floor-btn" onClick={() => void receive()}>
        Receive
      </button>
    </div>
  );
}

export function FloorChallanPage() {
  const [list, setList] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [scan, setScan] = useState("");
  const [scanType, setScanType] = useState<"packing" | "parcel">("packing");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [flash, setFlash] = useState<"success" | "warning" | "error" | null>(null);
  const [transporterData, setTransporterData] = useState({ vehicle_no: "", transporter_name: "" });

  async function loadList() {
    const r = await api.get("/mx/challans");
    setList((r.data.data ?? []).filter((c: any) => c.status !== "delivered"));
  }
  useEffect(() => {
    void loadList();
  }, []);

  async function openChallan(id: string) {
    const r = await api.get(`/mx/challans/${id}`);
    setActive(r.data.data);
    setMsg(null);
  }

  function playAlert() {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 440;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.stop(ctx.currentTime + 0.4);
    } catch {
      /* ignore */
    }
  }

  async function doScan(overrideRef?: string) {
    const ref = overrideRef || scan.trim();
    if (!active || !ref) return;
    try {
      await api.post(`/mx/challans/${active.challan_id}/scan`, {
        scan_id: newId(),
        scan_type: scanType,
        scanned_ref: ref,
        scanned_at: new Date().toISOString(),
      });
      setMsg({ ok: true, text: `Scanned ${ref}` });
      setFlash("success");
      setScan("");
      await openChallan(active.challan_id);
    } catch (e: any) {
      playAlert();
      setFlash("error");
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Scan rejected" });
    }
    setTimeout(() => setFlash(null), 800);
  }

  async function undoScan(scanId: string) {
    if (!active) return;
    try {
      await api.delete(`/mx/challans/${active.challan_id}/scan/${scanId}`);
      setMsg({ ok: true, text: "Scan removed" });
      await openChallan(active.challan_id);
    } catch {
      setMsg({ ok: false, text: "Failed to remove scan" });
    }
  }

  async function dispatch() {
    if (!active) return;
    try {
      await api.post(`/mx/challans/${active.challan_id}/dispatch`, transporterData);
      setMsg({ ok: true, text: "Dispatched" });
      setActive(null);
      setTransporterData({ vehicle_no: "", transporter_name: "" });
      await loadList();
    } catch (e: any) {
      playAlert();
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Dispatch blocked" });
    }
  }

  const reqs: any[] = active?.requirements ?? [];
  const scans: any[] = active?.scans ?? [];
  const pick_list: any[] = active?.pick_list ?? [];
  
  const pick_list_flat = pick_list.flatMap(g => g.racks.flatMap((r: any) => r.packings.map((p: any) => ({ ...p, rack: r.rack }))));
  const available_packings = pick_list_flat.filter(p => !scans.some(s => s.scanned_ref === p.short_code));



  if (!active) {
    return (
      <div>
        <h1 className="floor-h1">Dispatch</h1>
        <p className="floor-sub">Open a challan, scan stock, then dispatch.</p>
        {msg && <div className={`floor-toast ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
        {list.map((c) => (
          <button key={c.challan_id} type="button" className="floor-variant-tile" onClick={() => void openChallan(c.challan_id)}>
            <div className="floor-mono" style={{ fontWeight: 700, color: "var(--mx-primary)", fontSize: 18 }}>
              {c.challan_no}
            </div>
            <div style={{ marginTop: 4 }}>{c.party_master_name || c.party_name || c.addr_party || "—"}</div>
            <div className="floor-label" style={{ marginTop: 6 }}>
              {c.status} · {c.scan_count} scans
            </div>
          </button>
        ))}
        {!list.length && <p className="floor-sub">No open challans</p>}
      </div>
    );
  }

  return (
    <div style={{
      transition: "background-color 0.3s",
      backgroundColor: flash === "success" ? "#dcfce7" : flash === "error" ? "#fee2e2" : flash === "warning" ? "#fef3c7" : "transparent",
      padding: flash ? "16px" : 0,
      margin: flash ? "-16px" : 0,
      borderRadius: flash ? 8 : 0,
    }}>
      {msg && <div className={`floor-toast ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <button type="button" className="floor-btn ghost" onClick={() => setActive(null)}>
        ← Back to list
      </button>
      <div className="floor-variant-banner">
        <div className="floor-label">Challan</div>
        <div className="floor-mono" style={{ fontSize: 22, fontWeight: 700 }}>
          {active.challan_no}
        </div>
        <div>
          {active.party_name_master || active.party_name || active.addr_party} · {active.status}
        </div>
      </div>

      <div className="floor-label">Required</div>
      <div className="floor-card">
        {reqs.length ? (
          reqs.map((r) => (
            <div key={r.variant_code} style={{ marginBottom: 8 }}>
              <strong className="floor-mono">{r.variant_code}</strong> — {r.required_meters}m / {r.required_pieces} pcs
            </div>
          ))
        ) : (
          <div style={{ color: "var(--mx-muted)" }}>No checklist — any stock allowed</div>
        )}
      </div>

      {pick_list.length > 0 && (
        <>
          <div className="floor-label">Pick List (Walking Order)</div>
          <div className="floor-card">
            {pick_list.map((godown: any) => (
              <div key={godown.godown} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 800, color: "var(--mx-primary)", marginBottom: 4 }}>
                  {godown.godown}
                </div>
                {godown.racks.map((rack: any) => (
                  <div key={rack.rack} style={{ marginLeft: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Rack: {rack.rack}</div>
                    {rack.packings.map((p: any) => (
                      <div key={p.packing_id} style={{ marginLeft: 8, fontSize: 13, color: "var(--mx-text)" }}>
                        <strong className="floor-mono">{p.short_code}</strong> · {p.variant_code} ({p.length_meters}m)
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="floor-label">Scan type</div>
      <select className="floor-select" value={scanType} onChange={(e) => setScanType(e.target.value as any)}>
        <option value="packing">Packing</option>
        <option value="parcel">Parcel</option>
      </select>
      
      {scanType === "packing" && available_packings.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="floor-label">Or Select Packing Manually</div>
          <select 
            className="floor-select" 
            value="" 
            onChange={(e) => {
              if (e.target.value) {
                setScanType("packing");
                void doScan(e.target.value);
              }
            }}
          >
            <option value="">-- Choose from Pick List --</option>
            {available_packings.map(p => (
              <option key={p.packing_id} value={p.short_code}>
                {p.short_code} · {p.variant_code} ({p.length_meters}m) - Rack: {p.rack}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        className="floor-input floor-mono"
        placeholder="Scan packing / parcel…"
        value={scan}
        autoFocus
        onChange={(e) => setScan(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void doScan()}
      />
      <button type="button" className="floor-btn secondary" style={{ marginBottom: 12 }} onClick={() => void doScan()}>
        Add scan
      </button>

      <div className="floor-label">Scanned ({scans.length})</div>
      {scans.map((s) => (
        <div key={s.scan_id} className="floor-list-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="floor-mono">
            {s.scan_type}: {String(s.scanned_ref).slice(0, 16)}
          </span>
          <button type="button" onClick={() => undoScan(s.scan_id)} style={{ background: "none", border: "none", color: "var(--mx-error)", fontSize: 18, cursor: "pointer", padding: "0 8px" }}>
            ✕
          </button>
        </div>
      ))}

      <div className="floor-label" style={{ marginTop: 24 }}>Transport Details</div>
      <input
        className="floor-input"
        placeholder="Vehicle Number"
        value={transporterData.vehicle_no}
        onChange={(e) => setTransporterData({ ...transporterData, vehicle_no: e.target.value })}
        style={{ marginBottom: 8 }}
      />
      <input
        className="floor-input"
        placeholder="Transporter Name"
        value={transporterData.transporter_name}
        onChange={(e) => setTransporterData({ ...transporterData, transporter_name: e.target.value })}
        style={{ marginBottom: 16 }}
      />

      <button type="button" className="floor-btn" style={{ marginTop: 12 }} onClick={() => void dispatch()}>
        Dispatch challan
      </button>
    </div>
  );
}

/* Admin challan create stays MUI — imported from same module historically */
export { AdminChallanCreatePage } from "./AdminChallanCreatePage";
