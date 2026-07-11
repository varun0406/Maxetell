import { useEffect, useState } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../lib/api";

type Row = { id: number; name: string; contact?: string; job_work_type?: string; code?: string; location?: string; party_name?: string; address_line?: string; city?: string; state?: string };

function SimpleList({ endpoint, fields, label }: {
  endpoint: string;
  label: string;
  fields: { key: string; label: string; multiline?: boolean }[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = () => api.get<{ data: Row[] }>(endpoint).then((r) => setRows(r.data.data ?? []));
  useEffect(() => { load(); }, [endpoint]);

  const handleSave = async () => {
    await api.post(endpoint, form);
    setDlg(false); setForm({}); load();
  };
  const handleDelete = async (id: number) => {
    if (!confirm(`Delete this ${label.toLowerCase()}?`)) return;
    await api.delete(`${endpoint}/${id}`); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>{label}s</Typography>
        <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => { setForm({}); setDlg(true); }}>
          Add {label}
        </Button>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {fields.map((f) => <TableCell key={f.key}>{f.label}</TableCell>)}
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={fields.length + 1} align="center" sx={{ color: "text.secondary" }}>No records yet</TableCell></TableRow>
            )}
            {rows.map((row: any) => (
              <TableRow key={row.id} hover>
                {fields.map((f) => <TableCell key={f.key}>{row[f.key] || "—"}</TableCell>)}
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add {label}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {fields.map((f) => (
            <TextField key={f.key} label={f.label} value={form[f.key] ?? ""} multiline={f.multiline}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const TABS = [
  { label: "Companies", endpoint: "/tx/companies", fields: [{ key: "name", label: "Name" }, { key: "contact", label: "Contact" }] },
  { label: "Mills", endpoint: "/tx/mills", fields: [{ key: "name", label: "Name" }, { key: "contact", label: "Contact" }, { key: "job_work_type", label: "Job Work Type" }] },
  { label: "Godowns", endpoint: "/tx/godowns", fields: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "location", label: "Location" }] },
  { label: "Addresses", endpoint: "/tx/addresses", fields: [{ key: "party_name", label: "Party Name" }, { key: "address_line", label: "Address" }, { key: "city", label: "City" }, { key: "state", label: "State" }] },
];

export function TxMastersPage() {
  const [tab, setTab] = useState(0);
  const t = TABS[tab];
  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={1}>Masters</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Companies, Mills, Godowns & Delivery Addresses</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        {TABS.map((t) => <Tab key={t.label} label={t.label} />)}
      </Tabs>
      <SimpleList key={t.label} endpoint={t.endpoint} fields={t.fields} label={t.label.replace(/s$/, "")} />
    </Box>
  );
}
