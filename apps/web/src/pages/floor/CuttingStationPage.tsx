import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { buildPackingZpl, sendZplImmediate } from "../../lib/print/zpl";
import { findLocalRollByCode, localCutPacking, putLocalRoll } from "../../offline/localDb";
import { runSyncOnce } from "../../offline/syncWorker";
import {
  loadCuttingSession,
  patchSessionRoll,
  saveCuttingSession,
  type CuttingFlow,
  type CuttingSession,
} from "./cuttingSession";

type VariantRow = {
  variant_code: string;
  variant_name: string;
  color: string | null;
  quality: string | null;
  item_name: string | null;
  item_code: string | null;
};

type RollRow = {
  roll_id: string;
  short_code: string;
  variant_code: string;
  variant_name?: string;
  color?: string;
  item_name?: string;
  item_code?: string;
  remaining_meterage: number;
  status: string;
};

function newId() {
  return crypto.randomUUID();
}

function rollToSession(roll: RollRow, flow: CuttingFlow): CuttingSession {
  return {
    roll_id: roll.roll_id,
    roll_short: (roll as any).lot_no || (roll as any).lot_display || roll.short_code,
    variant_code: roll.variant_code,
    variant_name: roll.variant_name ?? roll.variant_code,
    color: roll.color ?? null,
    quality: null,
    item_name: roll.item_name ?? null,
    item_code: roll.item_code ?? null,
    remaining_meterage: roll.remaining_meterage,
    flow,
  };
}

export function CuttingStationPage() {
  const [step, setStep] = useState<"variant" | "roll" | "cut">(() => (loadCuttingSession() ? "cut" : "variant"));
  const [session, setSession] = useState<CuttingSession | null>(() => loadCuttingSession());
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [pickedVariant, setPickedVariant] = useState<VariantRow | null>(null);
  const [rolls, setRolls] = useState<RollRow[]>([]);
  const [flow, setFlow] = useState<CuttingFlow>("normal");
  const [rollScan, setRollScan] = useState("");
  const [digits, setDigits] = useState("");
  const [lastCut, setLastCut] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [flash, setFlash] = useState(false);
  const cuttingRef = useRef(false);

  useEffect(() => {
    api.get("/mx/items").then((r) => setVariants(r.data.data?.variants ?? []));
  }, []);

  useEffect(() => {
    if (session) {
      setStep("cut");
    }
  }, [session]);

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  async function loadRollsForVariant(v: VariantRow, direct: CuttingFlow) {
    const status = direct === "direct_dispatch" ? "in_cutting" : undefined;
    const params: Record<string, string> = { variant_code: v.variant_code };
    if (status) params.status = status;
    const r = await api.get("/mx/rolls", { params });
    const list = (r.data.data ?? []).filter((x: RollRow) => x.remaining_meterage > 0.01);
    setRolls(list);
  }

  function pickVariant(v: VariantRow) {
    setPickedVariant(v);
    void loadRollsForVariant(v, flow);
    setStep("roll");
  }

  async function pickRoll(roll: RollRow) {
    const enriched: RollRow = {
      ...roll,
      variant_name: pickedVariant?.variant_name ?? roll.variant_name,
      color: pickedVariant?.color ?? roll.color,
      item_name: pickedVariant?.item_name ?? roll.item_name,
      item_code: pickedVariant?.item_code ?? roll.item_code,
    };
    await putLocalRoll(enriched);
    const s: CuttingSession = {
      ...rollToSession(enriched, flow),
      variant_name: pickedVariant?.variant_name ?? enriched.variant_code,
      color: pickedVariant?.color ?? null,
      quality: pickedVariant?.quality ?? null,
      item_name: pickedVariant?.item_name ?? null,
      item_code: pickedVariant?.item_code ?? null,
    };
    saveCuttingSession(s);
    setSession(s);
    setStep("cut");
    setDigits("");
  }

  async function scanRoll() {
    const code = rollScan.trim();
    if (!code || !pickedVariant) return;
    try {
      let roll = rolls.find(
        (r) =>
          r.short_code === code ||
          r.roll_id === code ||
          (r as any).lot_no?.toUpperCase() === code ||
          (r as any).lot_display?.toUpperCase() === code,
      );
      if (!roll) {
        const res = await api.get(`/mx/rolls/${encodeURIComponent(code)}`);
        roll = res.data.data;
      }
      if (!roll || roll.variant_code !== pickedVariant.variant_code) {
        showToast(false, "Wrong variant for this roll");
        return;
      }
      if (roll.remaining_meterage <= 0) {
        showToast(false, "Roll empty");
        return;
      }
      await pickRoll(roll);
      setRollScan("");
    } catch {
      showToast(false, "Roll not found");
    }
  }

  function appendDigit(d: string) {
    if (d === "." && digits.includes(".")) return;
    if (digits.length >= 6) return;
    setDigits((prev) => prev + d);
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  const doCut = useCallback(async () => {
    if (!session || cuttingRef.current) return;
    const meters = Number(digits);
    if (!digits || !Number.isFinite(meters) || meters <= 0) {
      showToast(false, "Enter meters first");
      return;
    }
    if (meters > session.remaining_meterage + 1e-6) {
      showToast(false, `Only ${session.remaining_meterage}m on roll`);
      return;
    }

    cuttingRef.current = true;
    const packing_id = newId();
    const packing_date = new Date().toISOString().slice(0, 10);
    const notes = session.flow === "direct_dispatch" ? "direct_dispatch" : undefined;

    try {
      let packing: any;
      try {
        packing = await localCutPacking({
          packing_id,
          parent_roll_id: session.roll_id,
          length_meters: meters,
          variant_code: session.variant_code,
          packing_date,
          notes,
        });
      } catch {
        const res = await api.post("/mx/packings/cut", {
          packing_id,
          parent_roll_id: session.roll_id,
          length_meters: meters,
          variant_code: session.variant_code,
          packing_date,
          notes,
        });
        packing = res.data.data;
        const refreshed = await api.get(`/mx/rolls/${session.roll_id}`);
        await putLocalRoll(refreshed.data.data);
      }

      const zpl = buildPackingZpl({
        packingId: packing.packing_id,
        shortCode: packing.short_code,
        meters: packing.length_meters,
        variantCode: session.variant_code,
        variantName: session.variant_name,
        color: session.color,
        quality: session.quality,
        rollShort: session.roll_short,
      });
      sendZplImmediate(zpl);

      const updated = await findLocalRollByCode(session.roll_id);
      const remaining = updated?.remaining_meterage ?? session.remaining_meterage - meters;
      const nextSession = { ...session, remaining_meterage: Math.max(0, remaining) };
      saveCuttingSession(nextSession);
      patchSessionRoll(nextSession.remaining_meterage);
      setSession(nextSession);
      setLastCut(meters);
      setDigits("");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 350);
      showToast(true, `Printed ${meters}m · ${packing.short_code}`);
      void runSyncOnce();
    } catch (e: any) {
      showToast(false, e?.response?.data?.error ?? e?.message ?? "Cut failed");
    } finally {
      cuttingRef.current = false;
    }
  }, [digits, session, showToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step !== "cut" || !session) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === ".") {
        e.preventDefault();
        appendDigit(".");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void doCut();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, session, doCut]);

  function changeVariant() {
    saveCuttingSession(null);
    setSession(null);
    setPickedVariant(null);
    setRolls([]);
    setDigits("");
    setStep("variant");
  }

  // ── SETUP: pick variant ─────────────────────────────────────
  if (step === "variant" || (!session && step !== "roll")) {
    return (
      <div>
        <p className="floor-label" style={{ marginBottom: 8 }}>
          Step 1 — Select quality / variant
        </p>
        <div className="floor-card" style={{ marginBottom: 16 }}>
          <label className="floor-check">
            <input
              type="checkbox"
              checked={flow === "direct_dispatch"}
              onChange={(e) => setFlow(e.target.checked ? "direct_dispatch" : "normal")}
            />
            Peak season: direct dispatch (skip godown)
          </label>
        </div>
        {variants.map((v) => (
          <button key={v.variant_code} type="button" className="floor-variant-tile" onClick={() => pickVariant(v)}>
            <div className="floor-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--mx-primary)" }}>
              {v.variant_code}
            </div>
            <div style={{ fontSize: 16, marginTop: 4 }}>{v.variant_name}</div>
            <div style={{ fontSize: 14, color: "var(--mx-muted)" }}>
              {[v.color, v.quality, v.item_name].filter(Boolean).join(" · ")}
            </div>
          </button>
        ))}
        {!variants.length && <p style={{ color: "var(--mx-muted)" }}>No variants — add in Masters first</p>}
      </div>
    );
  }

  // ── SETUP: pick roll ────────────────────────────────────────
  if (step === "roll" && pickedVariant) {
    return (
      <div>
        <button type="button" onClick={() => setStep("variant")} style={{ background: "none", border: "none", color: "var(--mx-primary)", marginBottom: 12 }}>
          ← Change variant
        </button>
        <div className={`floor-variant-banner ${flow === "direct_dispatch" ? "direct" : ""}`}>
          <div className="floor-label">Active variant</div>
          <div className="floor-mono" style={{ fontSize: 20, fontWeight: 700 }}>
            {pickedVariant.variant_code} — {pickedVariant.variant_name}
          </div>
          <div style={{ fontSize: 14, color: "var(--mx-muted)" }}>
            {pickedVariant.color} {pickedVariant.quality ? `· ${pickedVariant.quality}` : ""}
          </div>
        </div>
        <p className="floor-label" style={{ marginBottom: 8 }}>
          Step 2 — Scan or tap lot
        </p>
        <input
          className="floor-input floor-mono"
          placeholder="Scan / type lot no…"
          value={rollScan}
          autoFocus
          onChange={(e) => setRollScan(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void scanRoll()}
        />
        {rolls.map((r) => (
          <button key={r.roll_id} type="button" className="floor-variant-tile" onClick={() => void pickRoll(r)}>
            <div className="floor-mono" style={{ fontWeight: 700, color: "var(--mx-primary)", fontSize: 18 }}>
              {(r as any).lot_no || r.short_code}
            </div>
            <div style={{ color: "var(--mx-success)", fontWeight: 700, fontSize: 18 }}>{r.remaining_meterage} m left</div>
            <div className="floor-label">Job {(r as any).job_id || r.roll_id.slice(0, 8)} · {r.status}</div>
          </button>
        ))}
        {!rolls.length && <p className="floor-sub">No lots with balance for this variant</p>}
      </div>
    );
  }

  // ── CUT: calculator mode ────────────────────────────────────
  if (!session) return null;

  const display = digits || "0";

  return (
    <div>
      {toast && <div className={`floor-toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}

      <div className={`floor-variant-banner ${session.flow === "direct_dispatch" ? "direct" : ""}`}>
        <div className="floor-label">{session.flow === "direct_dispatch" ? "Direct dispatch" : "Cutting"}</div>
        <div className="floor-mono" style={{ fontSize: 18, fontWeight: 700 }}>
          {session.variant_code} — {session.variant_name}
        </div>
        <div style={{ fontSize: 14 }}>{[session.color, session.quality].filter(Boolean).join(" · ")}</div>
      </div>

      <div className="floor-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="floor-label">Lot</div>
            <div className="floor-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--mx-primary)" }}>
              {session.roll_short}
            </div>
            <div className="floor-label" style={{ marginTop: 6 }}>
              Job {session.roll_id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="floor-label">Balance</div>
            <div className="floor-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--mx-success)" }}>
              {session.remaining_meterage} m
            </div>
          </div>
        </div>
        {lastCut != null && (
          <div style={{ marginTop: 8, fontSize: 14, color: "var(--mx-muted)" }}>
            Last cut: <strong style={{ color: "var(--mx-on-surface)" }}>{lastCut}m</strong>
          </div>
        )}
      </div>

      <div className="floor-meter-display">
        {display}
        <span className="floor-meter-suffix"> m</span>
      </div>

      <div className="floor-numpad">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "⌫" ? backspace() : appendDigit(k))}
            aria-label={k === "⌫" ? "Backspace" : k}
          >
            {k}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`floor-print-btn ${flash ? "floor-flash-ok" : ""}`}
        disabled={!digits || Number(digits) <= 0}
        onClick={() => void doCut()}
      >
        Print sticker
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={changeVariant}
          style={{
            flex: 1,
            minHeight: 48,
            background: "transparent",
            border: "2px solid var(--mx-outline)",
            color: "var(--mx-muted)",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Change variant
        </button>
        <button
          type="button"
          onClick={() => {
            saveCuttingSession(null);
            setSession(null);
            setStep("roll");
          }}
          style={{
            flex: 1,
            minHeight: 48,
            background: "transparent",
            border: "2px solid var(--mx-outline)",
            color: "var(--mx-muted)",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Change roll
        </button>
      </div>
    </div>
  );
}
