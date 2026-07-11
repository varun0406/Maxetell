import { useEffect, useState } from "react";
import {
  Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../lib/api";

type Variant = { variant_code: string; variant_name: string; color?: string; item_name?: string; item_code?: string };
type Company = { id: number; name: string };
type Mill = { id: number; name: string };
type StockIn = { id: number; lot_no: string; company_name: string; variant_code: string; item_name: string; variant_name: string; color?: string; meter: number; received_date: string; balance_meter: number; notes?: string };
type MillOut = { id: number; lot_no: string; mill_name: string; variant_code: string; item_name: string; variant_name: string; meter: number; sent_date: string; returned_meter: number; status: string; ref_lot_no?: string };
type MillReturn = { id: number; mill_out_lot: string; mill_name: string; variant_code: string; item_name: string; variant_name: string; meter: number; received_date: string };

function StockInTab() {
  const [rows, setRows] = useState<StockIn[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ company_id: 0, variant_code: "", meter: "", received_date: new Date().toISOString().slice(0, 10), notes: "" });

  const load = () => api.get<{ data: StockIn[] }>("/tx/stock-in").then((r) => setRows(r.data.data ?? []));
  useEffect(() => {
    load();
    api.get<{ data: Variant[] }>("/tx/items").then((r) => {
      const all: Variant[] = [];
      (r.data as any).data?.forEach((item: any) => item.variants?.forEach((v: any) => all.push({ ...v, item_name: item.name, item_code: item.code })));
      setVariants(all);
    });
    api.get<{ data: Company[] }>("/tx/companies").then((r) => setCompanies(r.data.data ?? []));
  }, []);

  const handleSave = async () => {
    await api.post("/tx/stock-in", { ...form, company_id: Number(form.company_id), meter: Number(form.meter) });
    setDlg(false); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Stock In Entries ({rows.length})</Typography>
        <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => setDlg(true)}>Add Entry</Button>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lot No</TableCell><TableCell>Date</TableCell><TableCell>Company</TableCell>
              <TableCell>Item</TableCell><TableCell>Variant</TableCell><TableCell align="right">Meter In</TableCell>
              <TableCell align="right">Balance (m)</TableCell><TableCell>Notes</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Chip label={r.lot_no} size="small" sx={{ fontFamily: "monospace" }} /></TableCell>
                <TableCell>{r.received_date}</TableCell>
                <TableCell>{r.company_name}</TableCell>
                <TableCell>{r.item_name}</TableCell>
                <TableCell><Chip label={r.variant_code} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />{" "}{r.variant_name}</TableCell>
                <TableCell align="right">{r.meter}</TableCell>
                <TableCell align="right"><b>{r.balance_meter}</b></TableCell>
                <TableCell>{r.notes || "—"}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={async () => { if (confirm("Delete?")) { await api.delete(`/tx/stock-in/${r.id}`); load(); } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary" }}>No stock-in entries yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Stock In</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField select label="Company" value={form.company_id} onChange={(e) => setForm((p) => ({ ...p, company_id: Number(e.target.value) }))}>
            {companies.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Autocomplete options={variants} getOptionLabel={(o) => `${o.variant_code} — ${o.item_name} ${o.variant_name}`}
            onChange={(_, v) => setForm((p) => ({ ...p, variant_code: v?.variant_code ?? "" }))}
            renderInput={(params) => <TextField {...params} label="Item Variant" />} />
          <TextField label="Meter" type="number" value={form.meter} onChange={(e) => setForm((p) => ({ ...p, meter: e.target.value }))} />
          <TextField label="Received Date" type="date" value={form.received_date} onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.company_id || !form.variant_code || !form.meter}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function MillOutTab() {
  const [rows, setRows] = useState<MillOut[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [mills, setMills] = useState<Mill[]>([]);
  const [stockIns, setStockIns] = useState<StockIn[]>([]);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ mill_id: 0, variant_code: "", meter: "", ref_stock_in_id: "", sent_date: new Date().toISOString().slice(0, 10), notes: "" });

  const load = () => api.get<{ data: MillOut[] }>("/tx/mill-out").then((r) => setRows(r.data.data ?? []));
  useEffect(() => {
    load();
    api.get<{ data: Mill[] }>("/tx/mills").then((r) => setMills(r.data.data ?? []));
    api.get<{ data: StockIn[] }>("/tx/stock-in").then((r) => setStockIns(r.data.data ?? []));
    api.get<{ data: Variant[] }>("/tx/items").then((r) => {
      const all: Variant[] = [];
      (r.data as any).data?.forEach((item: any) => item.variants?.forEach((v: any) => all.push({ ...v, item_name: item.name })));
      setVariants(all);
    });
  }, []);

  const handleSave = async () => {
    await api.post("/tx/mill-out", { ...form, mill_id: Number(form.mill_id), meter: Number(form.meter), ref_stock_in_id: form.ref_stock_in_id ? Number(form.ref_stock_in_id) : undefined });
    setDlg(false); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Mill Job Work Out ({rows.length})</Typography>
        <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => setDlg(true)}>Send to Mill</Button>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lot</TableCell><TableCell>Date</TableCell><TableCell>Mill</TableCell>
              <TableCell>Item</TableCell><TableCell align="right">Sent (m)</TableCell>
              <TableCell align="right">Returned (m)</TableCell><TableCell>Status</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Chip label={r.lot_no} size="small" sx={{ fontFamily: "monospace" }} /></TableCell>
                <TableCell>{r.sent_date}</TableCell>
                <TableCell>{r.mill_name}</TableCell>
                <TableCell>{r.item_name} — {r.variant_name} <Chip label={r.variant_code} size="small" variant="outlined" sx={{ fontFamily: "monospace", ml: 0.5 }} /></TableCell>
                <TableCell align="right">{r.meter}</TableCell>
                <TableCell align="right">{r.returned_meter}</TableCell>
                <TableCell><Chip label={r.status} size="small" color={r.status === "received" ? "success" : "warning"} /></TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={async () => { if (confirm("Delete?")) { await api.delete(`/tx/mill-out/${r.id}`); load(); } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary" }}>No mill-out entries</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Stock to Mill</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField select label="Mill" value={form.mill_id} onChange={(e) => setForm((p) => ({ ...p, mill_id: Number(e.target.value) }))}>
            {mills.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
          </TextField>
          <Autocomplete options={variants} getOptionLabel={(o) => `${o.variant_code} — ${o.item_name} ${o.variant_name}`}
            onChange={(_, v) => setForm((p) => ({ ...p, variant_code: v?.variant_code ?? "" }))}
            renderInput={(params) => <TextField {...params} label="Item Variant" />} />
          <TextField label="Meter" type="number" value={form.meter} onChange={(e) => setForm((p) => ({ ...p, meter: e.target.value }))} />
          <TextField select label="Ref Stock-In Lot (optional)" value={form.ref_stock_in_id} onChange={(e) => setForm((p) => ({ ...p, ref_stock_in_id: e.target.value }))} SelectProps={{ displayEmpty: true }}>
            <MenuItem value="">— None —</MenuItem>
            {stockIns.map((s) => <MenuItem key={s.id} value={s.id}>{s.lot_no} ({s.variant_code}, {s.meter}m)</MenuItem>)}
          </TextField>
          <TextField label="Sent Date" type="date" value={form.sent_date} onChange={(e) => setForm((p) => ({ ...p, sent_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.mill_id || !form.variant_code || !form.meter}>Send</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function MillReturnTab() {
  const [rows, setRows] = useState<MillReturn[]>([]);
  const [millOuts, setMillOuts] = useState<MillOut[]>([]);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ mill_out_id: 0, variant_code: "", meter: "", received_date: new Date().toISOString().slice(0, 10), notes: "" });

  const load = () => api.get<{ data: MillReturn[] }>("/tx/mill-return").then((r) => setRows(r.data.data ?? []));
  useEffect(() => {
    load();
    api.get<{ data: MillOut[] }>("/tx/mill-out").then((r) => setMillOuts((r.data.data ?? []).filter((m: any) => m.status === "pending")));
  }, []);

  const handleSave = async () => {
    await api.post("/tx/mill-return", { ...form, mill_out_id: Number(form.mill_out_id), meter: Number(form.meter) });
    setDlg(false); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Mill Returns ({rows.length})</Typography>
        <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => setDlg(true)}>Record Return</Button>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mill Out Lot</TableCell><TableCell>Mill</TableCell><TableCell>Item</TableCell>
              <TableCell align="right">Returned (m)</TableCell><TableCell>Date</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Chip label={r.mill_out_lot} size="small" sx={{ fontFamily: "monospace" }} /></TableCell>
                <TableCell>{r.mill_name}</TableCell>
                <TableCell>{r.item_name} — {r.variant_name}</TableCell>
                <TableCell align="right">{r.meter}</TableCell>
                <TableCell>{r.received_date}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={async () => { if (confirm("Delete?")) { await api.delete(`/tx/mill-return/${r.id}`); load(); } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>No returns yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Mill Return</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField select label="Mill Out Lot (pending)" value={form.mill_out_id} onChange={(e) => {
            const mo = millOuts.find((m) => m.id === Number(e.target.value));
            setForm((p) => ({ ...p, mill_out_id: Number(e.target.value), variant_code: mo?.variant_code ?? "" }));
          }}>
            {millOuts.map((m) => <MenuItem key={m.id} value={m.id}>{m.lot_no} — {m.mill_name} ({m.meter}m)</MenuItem>)}
          </TextField>
          <TextField label="Meter Received" type="number" value={form.meter} onChange={(e) => setForm((p) => ({ ...p, meter: e.target.value }))} />
          <TextField label="Received Date" type="date" value={form.received_date} onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.mill_out_id || !form.meter}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export function TxStockPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={1}>Stock Ledger</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Track stock inward, mill dispatch & mill returns</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Stock In (from Company)" />
        <Tab label="Mill Job Work Out" />
        <Tab label="Mill Returns" />
      </Tabs>
      {tab === 0 && <StockInTab />}
      {tab === 1 && <MillOutTab />}
      {tab === 2 && <MillReturnTab />}
    </Box>
  );
}
