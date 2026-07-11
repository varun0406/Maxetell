import { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import { api } from "../lib/api";

type Godown = { id: number; code: string; name: string };
type GodownSummary = { id: number; name: string; code: string; pieces: number; total_meter: number };
type GodownStock = { id: number; packing_id: string; godown_name: string; meter: number; variant_code: string; variant_name: string; item_name: string; item_code: string; received_date: string; status: string };

function SummaryTab() {
  const [rows, setRows] = useState<GodownSummary[]>([]);
  useEffect(() => { api.get<{ data: GodownSummary[] }>("/tx/godown/summary").then((r) => setRows(r.data.data ?? [])); }, []);
  const totalPieces = rows.reduce((s, r) => s + r.pieces, 0);
  const totalMeter = rows.reduce((s, r) => s + r.total_meter, 0);
  return (
    <Box>
      <Stack direction="row" spacing={2} mb={3}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="h4" fontWeight={800} color="primary">{totalPieces}</Typography>
          <Typography variant="caption" color="text.secondary">Total Pieces in Godown</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="h4" fontWeight={800} color="success.main">{totalMeter.toFixed(1)}</Typography>
          <Typography variant="caption" color="text.secondary">Total Meters in Godown</Typography>
        </Paper>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Godown</TableCell><TableCell>Code</TableCell>
              <TableCell align="right">Pieces</TableCell><TableCell align="right">Total Meter</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell fontWeight={700}>{r.name}</TableCell>
                <TableCell><Chip label={r.code} size="small" sx={{ fontFamily: "monospace" }} /></TableCell>
                <TableCell align="right">{r.pieces}</TableCell>
                <TableCell align="right"><b>{r.total_meter.toFixed(1)}</b></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>No godowns set up yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

function ReceiveTab() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [scan, setScan] = useState("");
  const [godownId, setGodownId] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.get<{ data: Godown[] }>("/tx/godowns").then((r) => setGodowns(r.data.data ?? [])); }, []);

  const handleReceive = async () => {
    if (!scan || !godownId) return;
    try {
      const res = await api.post("/tx/godown/receive", { packing_id: scan, godown_id: godownId, received_date: date });
      setResult({ ok: true, msg: `✓ ${scan} received into godown` });
      setScan("");
      setTimeout(() => scanRef.current?.focus(), 100);
    } catch (e: any) {
      setResult({ ok: false, msg: e.response?.data?.error ?? "Error receiving packing ID" });
    }
  };

  return (
    <Box maxWidth={500}>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>Receive Packing ID into Godown</Typography>
      <Stack spacing={2}>
        <TextField select label="Godown" value={godownId} onChange={(e) => setGodownId(Number(e.target.value))}>
          {godowns.map((g) => <MenuItem key={g.id} value={g.id}>{g.name} ({g.code})</MenuItem>)}
        </TextField>
        <TextField label="Received Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField inputRef={scanRef} label="Packing ID (scan or type)" value={scan} onChange={(e) => setScan(e.target.value.trim())}
          onKeyDown={(e) => { if (e.key === "Enter") handleReceive(); }}
          helperText="Scan barcode or type PKG-YYYYMMDD-NNN then press Enter" autoFocus />
        <Button variant="contained" onClick={handleReceive} disabled={!scan || !godownId}>Receive</Button>
        {result && <Alert severity={result.ok ? "success" : "error"}>{result.msg}</Alert>}
      </Stack>
    </Box>
  );
}

function StockTab() {
  const [rows, setRows] = useState<GodownStock[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [filterGodown, setFilterGodown] = useState("");

  const load = () => {
    const params = filterGodown ? `?godown_id=${filterGodown}` : "";
    api.get<{ data: GodownStock[] }>(`/tx/godown/stock${params}`).then((r) => setRows(r.data.data ?? []));
  };
  useEffect(() => { load(); }, [filterGodown]);
  useEffect(() => { api.get<{ data: Godown[] }>("/tx/godowns").then((r) => setGodowns(r.data.data ?? [])); }, []);

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField select label="Filter by Godown" size="small" value={filterGodown} onChange={(e) => setFilterGodown(e.target.value)} sx={{ minWidth: 200 }}
          SelectProps={{ displayEmpty: true }}>
          <MenuItem value="">All Godowns</MenuItem>
          {godowns.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">{rows.length} pieces</Typography>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Packing ID</TableCell><TableCell>Godown</TableCell><TableCell>Item</TableCell>
              <TableCell>Variant</TableCell><TableCell align="right">Meter</TableCell><TableCell>Received</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Chip label={r.packing_id} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} /></TableCell>
                <TableCell>{r.godown_name}</TableCell>
                <TableCell>{r.item_name}</TableCell>
                <TableCell><Chip label={r.variant_code} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />{" "}{r.variant_name}</TableCell>
                <TableCell align="right"><b>{r.meter}</b></TableCell>
                <TableCell>{r.received_date}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={async () => { if (confirm("Remove from godown?")) { await api.delete(`/tx/godown/stock/${r.packing_id}`); load(); } }}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary" }}>No stock in godown</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export function TxGodownPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={1}>Godown</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Receive packed stock into godown by scanning Packing ID</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Summary" />
        <Tab label="Receive Stock" />
        <Tab label="Current Stock" />
      </Tabs>
      {tab === 0 && <SummaryTab />}
      {tab === 1 && <ReceiveTab />}
      {tab === 2 && <StockTab />}
    </Box>
  );
}
