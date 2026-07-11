import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, MenuItem, Paper,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../lib/api";

type Variant = { variant_code: string; variant_name: string; item_name?: string };
type Source = { id: number; lot_no: string; variant_code: string; meter: number };
type PackingRow = { id: number; packing_id: string; variant_code: string; variant_name: string; color?: string; item_code: string; item_name: string; meter: number; packing_date: string; status: string; source_type: string; godown_name?: string; notes?: string };

const STATUS_COLOR: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  packed: "primary", in_godown: "success", dispatched: "default", faulty: "error",
};

function PiecesForm({ pieces, onChange }: { pieces: { meter: string; notes: string }[]; onChange: (p: { meter: string; notes: string }[]) => void }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" fontWeight={700}>Pieces</Typography>
        <Button size="small" onClick={() => onChange([...pieces, { meter: "", notes: "" }])}>+ Add Piece</Button>
      </Stack>
      {pieces.map((p, i) => (
        <Stack key={i} direction="row" spacing={1} mb={1} alignItems="center">
          <TextField size="small" label={`Piece ${i + 1} Meter`} type="number" value={p.meter}
            onChange={(e) => { const n = [...pieces]; n[i] = { ...n[i], meter: e.target.value }; onChange(n); }} sx={{ flex: 1 }} />
          <TextField size="small" label="Notes" value={p.notes}
            onChange={(e) => { const n = [...pieces]; n[i] = { ...n[i], notes: e.target.value }; onChange(n); }} sx={{ flex: 2 }} />
          {pieces.length > 1 && (
            <IconButton size="small" color="error" onClick={() => onChange(pieces.filter((_, j) => j !== i))}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}

export function TxPackingPage() {
  const [rows, setRows] = useState<PackingRow[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stockIns, setStockIns] = useState<Source[]>([]);
  const [millReturns, setMillReturns] = useState<Source[]>([]);
  const [dlg, setDlg] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ source_type: "stock_in", source_id: 0, variant_code: "", packing_date: new Date().toISOString().slice(0, 10) });
  const [pieces, setPieces] = useState([{ meter: "", notes: "" }]);

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api.get<{ data: PackingRow[] }>(`/tx/packing${params}`).then((r) => setRows(r.data.data ?? []));
  };
  useEffect(() => { load(); }, [statusFilter]);
  useEffect(() => {
    api.get<{ data: any[] }>("/tx/items").then((r) => {
      const all: Variant[] = [];
      r.data.data?.forEach((item: any) => item.variants?.forEach((v: any) => all.push({ ...v, item_name: item.name })));
      setVariants(all);
    });
    api.get<{ data: Source[] }>("/tx/stock-in").then((r) => setStockIns(r.data.data ?? []));
    api.get<{ data: Source[] }>("/tx/mill-return").then((r) => setMillReturns(r.data.data ?? []));
  }, []);

  const sources = form.source_type === "stock_in" ? stockIns : millReturns;

  const handleSave = async () => {
    const goodPieces = pieces.filter((p) => Number(p.meter) > 0);
    await api.post("/tx/packing", {
      source_type: form.source_type, source_id: form.source_id, variant_code: form.variant_code,
      packing_date: form.packing_date, meter: Number(goodPieces[0]?.meter ?? 0),
      pieces: goodPieces.map((p) => ({ meter: Number(p.meter), notes: p.notes || undefined })),
    });
    setDlg(false); setPieces([{ meter: "", notes: "" }]); load();
  };

  const handleStatusChange = async (packing_id: string, status: string) => {
    await api.patch(`/tx/packing/${packing_id}/status`, { status });
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Packing Register</Typography>
          <Typography variant="body2" color="text.secondary">Split stock into packed pieces — each gets a unique Packing ID</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg(true)}>Create Packing</Button>
      </Stack>

      <Stack direction="row" spacing={1} mb={2}>
        {["", "packed", "in_godown", "dispatched", "faulty"].map((s) => (
          <Chip key={s} label={s || "All"} variant={statusFilter === s ? "filled" : "outlined"} color={STATUS_COLOR[s] ?? "default"}
            onClick={() => setStatusFilter(s)} clickable />
        ))}
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Packing ID</TableCell><TableCell>Date</TableCell><TableCell>Item</TableCell>
              <TableCell>Variant</TableCell><TableCell align="right">Meter</TableCell>
              <TableCell>Source</TableCell><TableCell>Godown</TableCell><TableCell>Status</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary" }}>No packing entries</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Chip label={r.packing_id} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} /></TableCell>
                <TableCell>{r.packing_date}</TableCell>
                <TableCell>{r.item_name}</TableCell>
                <TableCell><Chip label={r.variant_code} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />{" "}{r.variant_name}</TableCell>
                <TableCell align="right"><b>{r.meter}</b></TableCell>
                <TableCell><Chip label={r.source_type.replace("_", " ")} size="small" /></TableCell>
                <TableCell>{r.godown_name || "—"}</TableCell>
                <TableCell>
                  <TextField select size="small" value={r.status} onChange={(e) => handleStatusChange(r.packing_id, e.target.value)}
                    SelectProps={{ sx: { fontSize: 12 } }} sx={{ minWidth: 110 }}>
                    {["packed", "in_godown", "dispatched", "faulty"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={async () => { if (confirm("Delete packing entry?")) { await api.delete(`/tx/packing/${r.packing_id}`); load(); } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Packing Entry</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField select label="Source Type" value={form.source_type}
            onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value, source_id: 0 }))}>
            <MenuItem value="stock_in">Stock In (from Company)</MenuItem>
            <MenuItem value="mill_return">Mill Return</MenuItem>
          </TextField>
          <TextField select label="Source Lot" value={form.source_id}
            onChange={(e) => {
              const src = sources.find((s) => s.id === Number(e.target.value));
              setForm((p) => ({ ...p, source_id: Number(e.target.value), variant_code: src?.variant_code ?? "" }));
            }}>
            {sources.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.lot_no} — {s.variant_code} ({s.meter}m)</MenuItem>)}
          </TextField>
          <Autocomplete options={variants} getOptionLabel={(o) => `${o.variant_code} — ${o.item_name} ${o.variant_name}`}
            value={variants.find((v) => v.variant_code === form.variant_code) ?? null}
            onChange={(_, v) => setForm((p) => ({ ...p, variant_code: v?.variant_code ?? "" }))}
            renderInput={(params) => <TextField {...params} label="Item Variant" />} />
          <TextField label="Packing Date" type="date" value={form.packing_date}
            onChange={(e) => setForm((p) => ({ ...p, packing_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <Divider />
          <PiecesForm pieces={pieces} onChange={setPieces} />
          <Alert severity="info" sx={{ py: 0.5 }}>
            Total: <b>{pieces.reduce((s, p) => s + (Number(p.meter) || 0), 0)} m</b> across {pieces.length} piece(s). Each piece gets its own Packing ID (PKG-YYYYMMDD-NNN).
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.source_id || !form.variant_code || pieces.every((p) => !p.meter)}>
            Create {pieces.length} Piece(s)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
