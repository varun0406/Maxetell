import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
} from "@mui/material";
import { api, createAppUser, deleteAppUser, fetchAppUsers, type AppUserRow } from "../../lib/api";
import { getPrinterConfig, setPrinterConfig } from "../../lib/print/zpl";
import { runSyncOnce } from "../../offline/syncWorker";
import { listPendingOutbox } from "../../offline/localDb";

export { AnalyticsPage } from "./AnalyticsDashboard";
export { MastersPage } from "./MastersPage";

function JobWorkReceivePanel({ onDone }: { onDone: () => Promise<void> }) {
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [meters, setMeters] = useState<Record<string, number>>({});

  async function loadJobs() {
    const r = await api.get("/mx/job-work");
    setOpenJobs((r.data.data ?? []).filter((j: any) => j.processed_state === "outward"));
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <Box mb={2}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Worker</TableCell>
            <TableCell>Roll</TableCell>
            <TableCell align="right">Sent m</TableCell>
            <TableCell align="right">Return m</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {openJobs.map((j) => (
            <TableRow key={j.job_work_id}>
              <TableCell>{j.worker_name}</TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{j.roll_short}</TableCell>
              <TableCell align="right">{j.meter_sent}</TableCell>
              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  sx={{ width: 100 }}
                  value={meters[j.job_work_id] ?? j.meter_sent}
                  onChange={(e) => setMeters({ ...meters, [j.job_work_id]: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="contained"
                  onClick={async () => {
                    await api.post(`/mx/job-work/${j.job_work_id}/return`, {
                      meter_returned: meters[j.job_work_id] ?? j.meter_sent,
                      inward_date: new Date().toISOString().slice(0, 10),
                      received_by: "warehouse",
                      confirm_receive: true,
                    });
                    await loadJobs();
                    await onDone();
                  }}
                >
                  Receive & confirm
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!openJobs.length && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                No open job-work outward
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

export function RollsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplier_id: 0,
    variant_code: "",
    lot_no: "",
    original_meterage: 100,
    received_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [jw, setJw] = useState({ roll_id: "", job_worker_id: 0, meter_sent: 0, outward_date: new Date().toISOString().slice(0, 10) });

  async function load() {
    const [r, s, i, w] = await Promise.all([api.get("/mx/rolls"), api.get("/mx/suppliers"), api.get("/mx/items"), api.get("/mx/job-workers")]);
    setRows(r.data.data ?? []);
    setSuppliers(s.data.data ?? []);
    setVariants(i.data.data.variants ?? []);
    setWorkers(w.data.data ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Stock in (lots)
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Type the supplier <strong>lot no</strong>. System creates a unique <strong>job ID</strong> for tracing cuts → parcels → challans.
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          label="Lot no"
          required
          value={form.lot_no}
          onChange={(e) => setForm({ ...form, lot_no: e.target.value })}
          sx={{ minWidth: 140 }}
          placeholder="e.g. SF-2401-A"
        />
        <TextField select size="small" label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: Number(e.target.value) })} sx={{ minWidth: 160 }}>
          {suppliers.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Variant" value={form.variant_code} onChange={(e) => setForm({ ...form, variant_code: e.target.value })} sx={{ minWidth: 160 }}>
          {variants.map((v) => (
            <MenuItem key={v.variant_code} value={v.variant_code}>
              {v.variant_code} {v.variant_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="number" label="Meters" value={form.original_meterage} onChange={(e) => setForm({ ...form, original_meterage: Number(e.target.value) })} />
        <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
        <Button
          variant="contained"
          onClick={async () => {
            if (!form.lot_no.trim()) return;
            await api.post("/mx/rolls", form);
            setForm({ ...form, lot_no: "" });
            await load();
          }}
        >
          Stock In
        </Button>
      </Stack>

      <Typography fontWeight={700} mb={1}>
        Send to job work
      </Typography>
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <TextField select size="small" label="Lot" value={jw.roll_id} onChange={(e) => setJw({ ...jw, roll_id: e.target.value })} sx={{ minWidth: 180 }}>
          {rows.filter((r) => r.remaining_meterage > 0).map((r) => (
            <MenuItem key={r.roll_id} value={r.roll_id}>
              {r.lot_no || r.short_code} ({r.remaining_meterage}m)
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Worker" value={jw.job_worker_id} onChange={(e) => setJw({ ...jw, job_worker_id: Number(e.target.value) })} sx={{ minWidth: 160 }}>
          {workers.map((w) => (
            <MenuItem key={w.id} value={w.id}>
              {w.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="number" label="Meters" value={jw.meter_sent || ""} onChange={(e) => setJw({ ...jw, meter_sent: Number(e.target.value) })} />
        <Button
          variant="outlined"
          onClick={async () => {
            await api.post("/mx/job-work/out", jw);
            await load();
          }}
        >
          Send out
        </Button>
      </Stack>

      <Typography fontWeight={700} mb={1}>
        Confirm material received from job work
      </Typography>
      <JobWorkReceivePanel onDone={load} />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Lot no</TableCell>
            <TableCell>Job ID</TableCell>
            <TableCell>Supplier</TableCell>
            <TableCell>Variant</TableCell>
            <TableCell>Remaining</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.roll_id}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.lot_no || r.short_code}</TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{String(r.job_id || r.roll_id).slice(0, 8).toUpperCase()}</TableCell>
              <TableCell>{r.supplier_name}</TableCell>
              <TableCell>{r.variant_code}</TableCell>
              <TableCell>
                {r.remaining_meterage} / {r.original_meterage}
              </TableCell>
              <TableCell>
                <Chip size="small" label={r.status} />
              </TableCell>
              <TableCell>{r.received_date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function SettingsSyncPage() {
  const [host, setHost] = useState(getPrinterConfig()?.host ?? "");
  const [port, setPort] = useState(getPrinterConfig()?.port ?? 9100);
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);

  async function refresh() {
    setPending((await listPendingOutbox()).length);
    try {
      const c = await api.get("/mx/sync/conflicts");
      setConflicts(c.data.data ?? []);
    } catch {
      /* auth/offline */
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Device & Sync
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Thermal printer (ZPL LAN) and offline outbox
      </Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField size="small" label="Printer host" value={host} onChange={(e) => setHost(e.target.value)} />
        <TextField size="small" type="number" label="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} sx={{ width: 100 }} />
        <Button
          variant="contained"
          onClick={() => {
            setPrinterConfig(host ? { host, port } : null);
            setMsg("Printer saved");
          }}
        >
          Save printer
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} mb={2} alignItems="center">
        <Chip label={`Pending sync: ${pending}`} />
        <Button
          variant="outlined"
          onClick={async () => {
            const r = await runSyncOnce();
            setMsg(`Pushed ${r.pushed}, pulled=${r.pulled}, conflicts=${r.conflicts}`);
            await refresh();
          }}
        >
          Sync now
        </Button>
        <Button
          variant="outlined"
          color="warning"
          onClick={async () => {
            if (!confirm("Replace all Maxwell stock data with full demo seed?")) return;
            try {
              const r = await api.post("/mx/demo/reseed");
              setMsg(`Demo loaded: ${r.data.data.rolls} rolls, ${r.data.data.packings} packings, ${r.data.data.challans} challans`);
            } catch (e: any) {
              setMsg(e?.response?.data?.error ?? "Reseed failed — restart API first");
            }
          }}
        >
          Load demo data
        </Button>
      </Stack>
      {msg && <Alert severity="info">{msg}</Alert>}
      <Typography fontWeight={700} mt={2} mb={1}>
        Open conflicts
      </Typography>
      {conflicts.map((c) => (
        <Paper key={c.id} sx={{ p: 1.5, mb: 1 }}>
          <Typography variant="body2">
            {c.entity} · {c.client_id.slice(0, 8)}… — {c.reason}
          </Typography>
          <Button
            size="small"
            onClick={async () => {
              await api.post(`/mx/sync/conflicts/${c.id}/resolve`, { status: "resolved" });
              await refresh();
            }}
          >
            Resolve
          </Button>
        </Paper>
      ))}
    </Box>
  );
}

export function UsersAdminPage() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  async function load() {
    setUsers(await fetchAppUsers());
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Users
      </Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField size="small" label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <TextField size="small" type="password" label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <TextField select size="small" label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} sx={{ minWidth: 120 }}>
          {["admin", "user", "packing", "godown", "floor"].map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          onClick={async () => {
            await createAppUser(form);
            setForm({ username: "", password: "", role: "user" });
            await load();
          }}
        >
          Create
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Role</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={async () => { await deleteAppUser(u.id); await load(); }}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
