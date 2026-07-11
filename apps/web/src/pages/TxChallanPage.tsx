import { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../lib/api";

type Address = { id: number; party_name: string; city?: string };
type ChallanRow = { id: number; challan_no: string; challan_date: string; party_name?: string; city?: string; item_count: number; total_meter: number; status: string; notes?: string };
type ChallanDetail = ChallanRow & { address_line?: string; state?: string; items: ChallanItem[] };
type ChallanItem = { id: number; packing_id: string; variant_code: string; variant_name: string; item_name: string; meter: number; packing_date: string };

const STATUS_COLOR: Record<string, any> = { created: "default", assigned: "primary", dispatched: "warning", delivered: "success" };
const STATUS_FLOW: Record<string, string> = { created: "assigned", assigned: "dispatched", dispatched: "delivered" };

function ChallanDetailDialog({ open, onClose, challan_id, onUpdate }: { open: boolean; onClose: () => void; challan_id: number; onUpdate: () => void }) {
  const [detail, setDetail] = useState<ChallanDetail | null>(null);
  const [scan, setScan] = useState("");
  const [scanError, setScanError] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const load = () => api.get<{ data: ChallanDetail }>(`/tx/challans/${challan_id}`).then((r) => setDetail(r.data.data));
  useEffect(() => { if (open) { load(); setScan(""); setScanError(""); } }, [open, challan_id]);

  const handleAddItem = async () => {
    if (!scan) return;
    try {
      await api.post(`/tx/challans/${challan_id}/items`, { packing_id: scan });
      setScan(""); setScanError(""); load(); onUpdate();
      setTimeout(() => scanRef.current?.focus(), 100);
    } catch (e: any) {
      setScanError(e.response?.data?.error ?? "Packing ID not found or already dispatched");
    }
  };

  const handleAdvanceStatus = async () => {
    if (!detail) return;
    const next = STATUS_FLOW[detail.status];
    if (!next) return;
    if (!confirm(`Move challan to "${next}"?`)) return;
    await api.patch(`/tx/challans/${challan_id}/status`, { status: next });
    load(); onUpdate();
  };

  if (!detail) return null;
  const canEdit = detail.status === "created" || detail.status === "assigned";
  const nextStatus = STATUS_FLOW[detail.status];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography fontWeight={800}>{detail.challan_no}</Typography>
            <Typography variant="caption" color="text.secondary">{detail.challan_date} · {detail.party_name} {detail.city ? `— ${detail.city}` : ""}</Typography>
          </Box>
          <Chip label={detail.status} color={STATUS_COLOR[detail.status]} />
        </Stack>
      </DialogTitle>
      <DialogContent>
        {canEdit && (
          <Box mb={2}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Add Stock (scan Packing ID)</Typography>
            <Stack direction="row" spacing={1}>
              <TextField inputRef={scanRef} size="small" label="Packing ID" value={scan}
                onChange={(e) => { setScan(e.target.value.trim()); setScanError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                sx={{ flex: 1 }} autoFocus helperText="Scan barcode or type PKG-... then Enter" />
              <Button variant="outlined" onClick={handleAddItem} disabled={!scan}>Add</Button>
            </Stack>
            {scanError && <Alert severity="error" sx={{ mt: 1 }}>{scanError}</Alert>}
          </Box>
        )}
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" fontWeight={700} mb={1}>
          Line Items ({detail.items.length}) · Total: <b>{detail.items.reduce((s, i) => s + i.meter, 0)} m</b>
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Packing ID</TableCell><TableCell>Item</TableCell><TableCell>Variant</TableCell>
              <TableCell align="right">Meter</TableCell><TableCell>Packing Date</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell><Chip label={item.packing_id} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} /></TableCell>
                <TableCell>{item.item_name}</TableCell>
                <TableCell><Chip label={item.variant_code} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />{" "}{item.variant_name}</TableCell>
                <TableCell align="right"><b>{item.meter}</b></TableCell>
                <TableCell>{item.packing_date}</TableCell>
                {canEdit && (
                  <TableCell>
                    <IconButton size="small" color="error"
                      onClick={async () => { await api.delete(`/tx/challans/${challan_id}/items/${item.id}`); load(); onUpdate(); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {detail.items.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>No items added yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {nextStatus && (
          <Button variant="contained" color={nextStatus === "dispatched" ? "warning" : "success"} onClick={handleAdvanceStatus}>
            Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export function TxChallanPage() {
  const [rows, setRows] = useState<ChallanRow[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [dlg, setDlg] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState({ challan_date: new Date().toISOString().slice(0, 10), address_id: 0, notes: "" });
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api.get<{ data: ChallanRow[] }>(`/tx/challans${params}`).then((r) => setRows(r.data.data ?? []));
  };
  useEffect(() => { load(); }, [statusFilter]);
  useEffect(() => { api.get<{ data: Address[] }>("/tx/addresses").then((r) => setAddresses(r.data.data ?? [])); }, []);

  const handleCreate = async () => {
    await api.post("/tx/challans", { ...form, address_id: form.address_id || undefined });
    setDlg(false); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Delivery Challans</Typography>
          <Typography variant="body2" color="text.secondary">Create challan, scan packing IDs, dispatch</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg(true)}>New Challan</Button>
      </Stack>

      <Stack direction="row" spacing={1} mb={2}>
        {["", "created", "assigned", "dispatched", "delivered"].map((s) => (
          <Chip key={s} label={s || "All"} variant={statusFilter === s ? "filled" : "outlined"} color={STATUS_COLOR[s] ?? "default"}
            onClick={() => setStatusFilter(s)} clickable />
        ))}
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Challan No</TableCell><TableCell>Date</TableCell><TableCell>Party</TableCell>
              <TableCell align="right">Items</TableCell><TableCell align="right">Total Meter</TableCell>
              <TableCell>Status</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setDetailId(r.id)}>
                <TableCell><Chip label={r.challan_no} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} /></TableCell>
                <TableCell>{r.challan_date}</TableCell>
                <TableCell>{r.party_name || "—"}{r.city ? `, ${r.city}` : ""}</TableCell>
                <TableCell align="right">{r.item_count}</TableCell>
                <TableCell align="right"><b>{r.total_meter}</b></TableCell>
                <TableCell><Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} /></TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm("Delete this challan?")) { await api.delete(`/tx/challans/${r.id}`); load(); }
                  }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary" }}>No challans yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Delivery Challan</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField label="Challan Date" type="date" value={form.challan_date}
            onChange={(e) => setForm((p) => ({ ...p, challan_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField select label="Delivery Address (optional)" value={form.address_id}
            onChange={(e) => setForm((p) => ({ ...p, address_id: Number(e.target.value) }))} SelectProps={{ displayEmpty: true }}>
            <MenuItem value={0}>— Select Address —</MenuItem>
            {addresses.map((a) => <MenuItem key={a.id} value={a.id}>{a.party_name}{a.city ? ` — ${a.city}` : ""}</MenuItem>)}
          </TextField>
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      {detailId !== null && (
        <ChallanDetailDialog open={detailId !== null} onClose={() => setDetailId(null)}
          challan_id={detailId} onUpdate={load} />
      )}
    </Box>
  );
}
