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

  Autocomplete,
} from "@mui/material";
import { api, createAppUser, deleteAppUser, fetchAppUsers, type AppUserRow } from "../../lib/api";
import { getPrinterConfig, setPrinterConfig } from "../../lib/print/zpl";
import { runSyncOnce } from "../../offline/syncWorker";
import { listPendingOutbox } from "../../offline/localDb";

export { AnalyticsPage } from "./AnalyticsDashboard";

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
        <Autocomplete
          size="small"
          options={["admin", "user", "packing", "godown", "floor"]}
          value={form.role}
          onChange={(_, newValue) => setForm({ ...form, role: newValue || "user" })}
          renderInput={(params) => <TextField {...params} label="Role" />}
          sx={{ minWidth: 120 }}
          disableClearable
        />
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
