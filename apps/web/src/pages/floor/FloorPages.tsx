import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
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
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Parcel Consolidation
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Scan 3–4 packing IDs, then seal and print master sticker.
      </Typography>
      <TextField
        fullWidth
        label="Scan packing"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void addScan(input)}
        sx={{ mb: 2 }}
        autoFocus
      />
      <List dense>
        {detail.map((d) => (
          <ListItem key={d.packing_id}>
            <ListItemText primary={`${d.short_code} · ${d.variant_code} · ${d.length_meters}m`} secondary={d.packing_id} />
          </ListItem>
        ))}
      </List>
      <Button variant="contained" disabled={scans.length < 1} onClick={() => void createParcel()}>
        Create parcel ({scans.length})
      </Button>
      {msg && (
        <Alert sx={{ mt: 2 }} severity={msg.ok ? "success" : "error"}>
          {msg.text}
        </Alert>
      )}
    </Box>
  );
}

export function GodownReceivePage() {
  const [godowns, setGodowns] = useState<any[]>([]);
  const [godownId, setGodownId] = useState(0);
  const [hint, setHint] = useState("");
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get("/mx/godowns").then((r) => setGodowns(r.data.data ?? []));
  }, []);

  async function receive() {
    if (!scan || !godownId) return;
    try {
      // Resolve packing id
      const p = await api.get(`/mx/packings/${encodeURIComponent(scan.trim())}`);
      await api.post(`/mx/packings/${p.data.data.packing_id}/godown`, { godown_id: godownId, location_hint: hint || undefined });
      setMsg({ ok: true, text: `${p.data.data.short_code} → godown` });
      setScan("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Failed" });
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Godown Receive
      </Typography>
      <Stack spacing={2} maxWidth={480}>
        <TextField select label="Godown" value={godownId} onChange={(e) => setGodownId(Number(e.target.value))}>
          {godowns.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name} ({g.code})
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Rack / location hint" value={hint} onChange={(e) => setHint(e.target.value)} />
        <TextField
          label="Scan packing"
          value={scan}
          autoFocus
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void receive()}
        />
        <Button variant="contained" onClick={() => void receive()}>
          Receive
        </Button>
        {msg && <Alert severity={msg.ok ? "success" : "error"}>{msg.text}</Alert>}
      </Stack>
    </Box>
  );
}

export function FloorChallanPage() {
  const [list, setList] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [scan, setScan] = useState("");
  const [scanType, setScanType] = useState<"packing" | "parcel">("packing");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [buzzer, setBuzzer] = useState(false);

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
    setBuzzer(true);
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
    setTimeout(() => setBuzzer(false), 600);
  }

  async function doScan() {
    if (!active || !scan.trim()) return;
    try {
      await api.post(`/mx/challans/${active.challan_id}/scan`, {
        scan_id: newId(),
        scan_type: scanType,
        scanned_ref: scan.trim(),
        scanned_at: new Date().toISOString(),
      });
      setMsg({ ok: true, text: `Scanned ${scan.trim()}` });
      setScan("");
      await openChallan(active.challan_id);
    } catch (e: any) {
      playAlert();
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Scan rejected" });
    }
  }

  async function dispatch() {
    if (!active) return;
    try {
      await api.post(`/mx/challans/${active.challan_id}/dispatch`);
      setMsg({ ok: true, text: "Dispatched" });
      setActive(null);
      await loadList();
    } catch (e: any) {
      playAlert();
      setMsg({ ok: false, text: e?.response?.data?.error ?? "Dispatch blocked" });
    }
  }

  // Assembled checklist progress
  const reqs: any[] = active?.requirements ?? [];
  const scans: any[] = active?.scans ?? [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Floor Dispatch
      </Typography>
      {!active ? (
        <Stack spacing={1}>
          {list.map((c) => (
            <Paper key={c.challan_id} sx={{ p: 2, cursor: "pointer" }} onClick={() => void openChallan(c.challan_id)}>
              <Typography fontWeight={700}>
                {c.challan_no} · {c.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {c.party_name || c.addr_party || "—"} · {c.scan_count} scans
              </Typography>
            </Paper>
          ))}
          {!list.length && <Typography color="text.secondary">No open challans</Typography>}
        </Stack>
      ) : (
        <Box>
          <Button size="small" onClick={() => setActive(null)}>
            ← Back
          </Button>
          <Typography fontWeight={800} mt={1}>
            {active.challan_no}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {active.party_name || active.addr_party} · {active.status}
          </Typography>

          <Typography fontWeight={700} mb={1}>
            Required materials
          </Typography>
          {reqs.map((r) => (
            <Chip key={r.variant_code} label={`${r.variant_code} · ${r.required_meters}m / ${r.required_pieces}pcs`} sx={{ m: 0.5 }} />
          ))}
          {!reqs.length && <Typography variant="body2">No checklist — any stock allowed</Typography>}

          <Typography fontWeight={700} mt={2} mb={1}>
            Location hints
          </Typography>
          {(active.location_hints ?? []).slice(0, 8).map((h: any) => (
            <Typography key={h.packing_id} variant="body2">
              {h.variant_code} · {h.short_code} → {h.godown_name ?? "?"} {h.location_hint ?? ""}
            </Typography>
          ))}

          <Stack direction="row" spacing={1} mt={2} mb={1}>
            <TextField select size="small" label="Type" value={scanType} onChange={(e) => setScanType(e.target.value as any)} sx={{ width: 140 }}>
              <MenuItem value="packing">Packing</MenuItem>
              <MenuItem value="parcel">Parcel</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Scan ID"
              value={scan}
              autoFocus
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doScan()}
              error={buzzer}
            />
            <Button variant="contained" onClick={() => void doScan()}>
              Add
            </Button>
          </Stack>

          <Typography fontWeight={700} mb={1}>
            Scanned ({scans.length})
          </Typography>
          {scans.map((s) => (
            <Chip key={s.scan_id} label={`${s.scan_type}: ${s.scanned_ref.slice(0, 12)}…`} sx={{ m: 0.5 }} color="success" />
          ))}

          <Button variant="contained" color="secondary" sx={{ mt: 2 }} onClick={() => void dispatch()}>
            Dispatch challan
          </Button>
          {msg && (
            <Alert sx={{ mt: 2 }} severity={msg.ok ? "success" : "error"}>
              {msg.text}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
}

export function AdminChallanCreatePage() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [form, setForm] = useState({
    challan_date: new Date().toISOString().slice(0, 10),
    party_id: 0,
    address_id: 0,
    agent_id: 0,
    notes: "",
  });
  const [reqs, setReqs] = useState<{ variant_code: string; required_meters: number; required_pieces: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get("/mx/addresses"), api.get("/mx/parties"), api.get("/mx/agents"), api.get("/mx/items")]).then(
      ([a, p, ag, i]) => {
        setAddresses(a.data.data ?? []);
        setParties(p.data.data ?? []);
        setAgents(ag.data.data ?? []);
        setVariants(i.data.data.variants ?? []);
      },
    );
  }, []);

  const shipOptions = form.party_id
    ? addresses.filter((a) => a.party_id === form.party_id || !a.party_id)
    : addresses;

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Create Delivery Challan
      </Typography>
      <Stack spacing={2} maxWidth={560}>
        <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.challan_date} onChange={(e) => setForm({ ...form, challan_date: e.target.value })} />
        <TextField
          select
          label="Party (billing)"
          value={form.party_id}
          onChange={(e) => setForm({ ...form, party_id: Number(e.target.value), address_id: 0 })}
        >
          <MenuItem value={0}>—</MenuItem>
          {parties.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} {p.gstin ? `· ${p.gstin}` : ""}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Deliver to (ship address)" value={form.address_id} onChange={(e) => setForm({ ...form, address_id: Number(e.target.value) })}>
          <MenuItem value={0}>—</MenuItem>
          {shipOptions.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.party_name} · {a.address_line ?? ""} {a.city ?? ""}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Agent" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: Number(e.target.value) })}>
          <MenuItem value={0}>—</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <Typography fontWeight={700}>Requirements</Typography>
        {reqs.map((r, idx) => (
          <Stack direction="row" spacing={1} key={idx}>
            <Chip label={`${r.variant_code} ${r.required_meters}m / ${r.required_pieces}pcs`} onDelete={() => setReqs(reqs.filter((_, i) => i !== idx))} />
          </Stack>
        ))}
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Variant"
            sx={{ minWidth: 160 }}
            defaultValue=""
            onChange={(e) => {
              const code = e.target.value;
              if (!code) return;
              setReqs([...reqs, { variant_code: code, required_meters: 0, required_pieces: 1 }]);
            }}
          >
            {variants.map((v) => (
              <MenuItem key={v.variant_code} value={v.variant_code}>
                {v.variant_code}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Button
          variant="contained"
          onClick={async () => {
            const body = {
              challan_date: form.challan_date,
              notes: form.notes,
              party_id: form.party_id || undefined,
              address_id: form.address_id || undefined,
              agent_id: form.agent_id || undefined,
              requirements: reqs,
            };
            const res = await api.post("/mx/challans", body);
            setMsg(`Created ${res.data.data.challan_no}`);
            setReqs([]);
          }}
        >
          Create challan
        </Button>
        {msg && <Alert severity="success">{msg}</Alert>}
      </Stack>
    </Box>
  );
}
