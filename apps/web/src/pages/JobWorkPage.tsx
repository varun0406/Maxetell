import { useEffect, useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Tooltip,
  MenuItem,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  fetchJobWorkList,
  fetchJobWorkClients,
  createJobWorkClient,
  createJobWorkInward,
  createJobWorkOutward,
  deleteJobWorkInward,
  deleteJobWorkOutward,
  type JobWorkClientLedger,
  type JobWorkClient,
} from "../lib/api";
import { exportToCsv } from "../lib/export";
import dayjs from "dayjs";

export function JobWorkPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<JobWorkClientLedger[]>([]);
  const [clients, setClients] = useState<JobWorkClient[]>([]);
  const [search, setSearch] = useState("");

  // Dialogs
  const [clientOpen, setClientOpen] = useState(false);
  const [inwardOpen, setInwardOpen] = useState(false);
  const [outwardOpen, setOutwardOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  
  const [selectedClientLedger, setSelectedClientLedger] = useState<JobWorkClientLedger | null>(null);

  // Client Form
  const [clientName, setClientName] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  // Inward Form
  const [inwardClientId, setInwardClientId] = useState<number | "">("");
  const [challanDate, setChallanDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [shortQty, setShortQty] = useState<number>(0);
  const [savingInward, setSavingInward] = useState(false);

  // Outward Form
  const [outwardClientId, setOutwardClientId] = useState<number | "">("");
  const [dispatchDate, setDispatchDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dispatchQty, setDispatchQty] = useState<number>(0);
  const [processLoss, setProcessLoss] = useState<number>(0);
  const [savingOutward, setSavingOutward] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [ledgersData, clientsData] = await Promise.all([
        fetchJobWorkList(),
        fetchJobWorkClients()
      ]);
      setItems(ledgersData);
      setClients(clientsData);
      
      // Update selected ledger if it's open
      if (selectedClientLedger) {
        const updated = ledgersData.find(l => l.id === selectedClientLedger.id);
        if (updated) setSelectedClientLedger(updated);
        else setLedgerOpen(false);
      }

      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load Job Work data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(lower));
  }, [items, search]);

  // Totals
  const totals = useMemo(() => {
    let tInward = 0;
    let tDispatched = 0;
    let tLoss = 0;
    let tBal = 0;

    for (const item of filteredItems) {
      tInward += item.total_inward;
      tDispatched += item.total_dispatched;
      tLoss += item.total_loss;
      tBal += item.balance;
    }

    return { tInward, tDispatched, tLoss, tBal };
  }, [filteredItems]);

  async function handleAddClient() {
    if (!clientName.trim()) return;
    setSavingClient(true);
    try {
      await createJobWorkClient(clientName.trim());
      setClientOpen(false);
      setClientName("");
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setSavingClient(false);
    }
  }

  async function handleAddInward() {
    if (!inwardClientId || !description || qty <= 0) return;
    setSavingInward(true);
    try {
      await createJobWorkInward({
        client_id: Number(inwardClientId),
        challan_date: challanDate,
        description,
        qty,
        short_qty: shortQty,
      });
      setInwardOpen(false);
      setDescription("");
      setQty(0);
      setShortQty(0);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create inward");
    } finally {
      setSavingInward(false);
    }
  }

  async function handleAddOutward() {
    if (!outwardClientId || dispatchQty <= 0) return;
    setSavingOutward(true);
    try {
      await createJobWorkOutward({
        client_id: Number(outwardClientId),
        dispatch_date: dispatchDate,
        dispatch_qty: dispatchQty,
        process_loss: processLoss,
      });
      setOutwardOpen(false);
      setDispatchQty(0);
      setProcessLoss(0);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add dispatch");
    } finally {
      setSavingOutward(false);
    }
  }

  async function handleDeleteInward(id: number) {
    if (!window.confirm("Are you sure you want to delete this inward entry?")) return;
    try {
      await deleteJobWorkInward(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete inward");
    }
  }

  async function handleDeleteOutward(id: number) {
    if (!window.confirm("Are you sure you want to delete this dispatch entry?")) return;
    try {
      await deleteJobWorkOutward(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete dispatch");
    }
  }

  function handleExport() {
    const csvData = filteredItems.map(item => ({
      "Client": item.name,
      "Total Inward": item.total_inward,
      "Total Dispatched": item.total_dispatched,
      "Total Loss": item.total_loss,
      "Balance": item.balance
    }));
    exportToCsv("job_work_client_report", csvData);
  }

  // Generate Ledger View Rows
  const ledgerRows = useMemo(() => {
    if (!selectedClientLedger) return [];
    
    type Row = { type: 'inward' | 'outward'; date: string; desc?: string; qty: number; short?: number; loss?: number; id: number };
    
    const rows: Row[] = [];
    selectedClientLedger.inwards.forEach(i => {
      rows.push({ type: 'inward', date: i.challan_date, desc: i.description, qty: i.qty, short: i.short_qty, id: i.id });
    });
    selectedClientLedger.outwards.forEach(o => {
      rows.push({ type: 'outward', date: o.dispatch_date, qty: o.dispatch_qty, loss: o.process_loss, id: o.id });
    });
    
    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedClientLedger]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={900}>
          Job Work System (Inward)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleExport} disabled={items.length === 0}>
            Export Report
          </Button>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setClientOpen(true)}>
            Add Client
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setInwardClientId(""); setInwardOpen(true); }}>
            Inward
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOutwardClientId(""); setOutwardOpen(true); }}>
            Dispatch
          </Button>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      {/* Overview Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL INWARD (NET)
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              {Math.round(totals.tInward).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL DISPATCHED
            </Typography>
            <Typography variant="h5" fontWeight={900} color="success.main">
              {Math.round(totals.tDispatched).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              PROCESS LOSS
            </Typography>
            <Typography variant="h5" fontWeight={900} color="warning.main">
              {Math.round(totals.tLoss).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              PENDING BALANCE
            </Typography>
            <Typography variant="h5" fontWeight={900} color="error.main">
              {Math.round(totals.tBal).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <TextField
        label="Search Client"
        variant="outlined"
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredItems.length === 0 ? (
        <Typography color="text.secondary">No Job Work entries found.</Typography>
      ) : (
        <Card>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 800 }}>
              {/* Column Headers */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 150px 150px 150px 150px 120px",
                  borderBottom: "1px solid rgba(0,0,0,0.12)",
                  fontWeight: 800,
                  bgcolor: "rgba(0,0,0,0.03)",
                  fontSize: 13,
                  p: 1.5,
                }}
              >
                <Box>CLIENT NAME</Box>
                <Box sx={{ textAlign: "right" }}>INWARD (NET)</Box>
                <Box sx={{ textAlign: "right" }}>DISPATCHED</Box>
                <Box sx={{ textAlign: "right" }}>LOSS</Box>
                <Box sx={{ textAlign: "right" }}>BALANCE</Box>
                <Box sx={{ textAlign: "center" }}>ACTIONS</Box>
              </Box>

              {/* Rows */}
              {filteredItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px 150px 150px 150px 120px",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    fontSize: 13,
                    p: 1.5,
                    alignItems: "center",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
                  }}
                >
                  <Box sx={{ fontWeight: 700 }}>{item.name}</Box>
                  <Box sx={{ textAlign: "right" }}>{item.total_inward.toFixed(3)}</Box>
                  <Box sx={{ textAlign: "right", color: "success.main" }}>{item.total_dispatched.toFixed(3)}</Box>
                  <Box sx={{ textAlign: "right", color: "warning.main" }}>{item.total_loss.toFixed(3)}</Box>
                  <Box sx={{ textAlign: "right", fontWeight: 800, color: item.balance > 0.01 ? "error.main" : "text.primary" }}>
                    {item.balance.toFixed(3)}
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Tooltip title="View Ledger">
                      <IconButton size="small" onClick={() => { setSelectedClientLedger(item); setLedgerOpen(true); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}

              {/* Totals Row */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 150px 150px 150px 150px 120px",
                  fontWeight: 900,
                  bgcolor: "rgba(0,0,0,0.03)",
                  fontSize: 13,
                  p: 1.5,
                  borderTop: "2px solid rgba(0,0,0,0.12)",
                }}
              >
                <Box>TOTALS</Box>
                <Box sx={{ textAlign: "right" }}>{totals.tInward.toFixed(3)}</Box>
                <Box sx={{ textAlign: "right", color: "success.main" }}>{totals.tDispatched.toFixed(3)}</Box>
                <Box sx={{ textAlign: "right", color: "warning.main" }}>{totals.tLoss.toFixed(3)}</Box>
                <Box sx={{ textAlign: "right", color: "error.main" }}>{totals.tBal.toFixed(3)}</Box>
                <Box></Box>
              </Box>
            </Box>
          </Box>
        </Card>
      )}

      {/* Ledger Dialog */}
      <Dialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {selectedClientLedger?.name} - Job Work Ledger
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ minWidth: 600 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 120px 120px 60px",
                borderBottom: "1px solid rgba(0,0,0,0.12)",
                fontWeight: 800,
                bgcolor: "rgba(0,0,0,0.03)",
                fontSize: 13,
                p: 1.5,
              }}
            >
              <Box>DATE</Box>
              <Box>TYPE / DESC</Box>
              <Box sx={{ textAlign: "right" }}>INWARD (QTY)</Box>
              <Box sx={{ textAlign: "right" }}>OUT (QTY+LOSS)</Box>
              <Box sx={{ textAlign: "center" }}>DEL</Box>
            </Box>
            
            {ledgerRows.map((row, i) => (
              <Box
                key={`${row.type}-${row.id}-${i}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 120px 120px 60px",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                  fontSize: 13,
                  p: 1,
                  alignItems: "center",
                  bgcolor: row.type === 'inward' ? "rgba(0,100,255,0.03)" : "rgba(255,100,0,0.03)",
                }}
              >
                <Box>{row.date.split("T")[0]}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {row.type === 'inward' ? "INWARD" : "DISPATCH"}
                  </Typography>
                  {row.desc && <Typography variant="caption" color="text.secondary">{row.desc}</Typography>}
                  {row.short && row.short > 0 ? <Typography variant="caption" color="error.main" display="block">Short: {row.short}</Typography> : null}
                  {row.loss && row.loss > 0 ? <Typography variant="caption" color="warning.main" display="block">Loss: {row.loss}</Typography> : null}
                </Box>
                <Box sx={{ textAlign: "right", fontWeight: row.type === 'inward' ? 700 : 400 }}>
                  {row.type === 'inward' ? (row.qty - (row.short || 0)).toFixed(3) : "—"}
                </Box>
                <Box sx={{ textAlign: "right", fontWeight: row.type === 'outward' ? 700 : 400 }}>
                  {row.type === 'outward' ? (row.qty + (row.loss || 0)).toFixed(3) : "—"}
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <IconButton size="small" color="error" onClick={() => row.type === 'inward' ? handleDeleteInward(row.id) : handleDeleteOutward(row.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLedgerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={clientOpen} onClose={() => !savingClient && setClientOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Client</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Client Name"
            fullWidth
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientOpen(false)} disabled={savingClient}>Cancel</Button>
          <Button variant="contained" onClick={handleAddClient} disabled={savingClient || !clientName.trim()}>
            {savingClient ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Inward Challan Dialog */}
      <Dialog open={inwardOpen} onClose={() => !savingInward && setInwardOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Inward Challan</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Select Client"
              fullWidth
              value={inwardClientId}
              onChange={(e) => setInwardClientId(Number(e.target.value))}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Dated"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
            />
            <TextField
              label="Item Description (DESP)"
              fullWidth
              placeholder="e.g. COPPER SCRAP-CABLE"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <TextField
              label="Quantity Received (QTY)"
              type="number"
              fullWidth
              value={qty || ""}
              onChange={(e) => setQty(Number(e.target.value))}
            />
            <TextField
              label="Shortage Quantity"
              type="number"
              fullWidth
              value={shortQty || ""}
              onChange={(e) => setShortQty(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInwardOpen(false)} disabled={savingInward}>Cancel</Button>
          <Button variant="contained" onClick={handleAddInward} disabled={savingInward || !inwardClientId || !description || qty <= 0}>
            {savingInward ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Dispatch Dialog */}
      <Dialog open={outwardOpen} onClose={() => !savingOutward && setOutwardOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Outward Dispatch</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Select Client"
              fullWidth
              value={outwardClientId}
              onChange={(e) => setOutwardClientId(Number(e.target.value))}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            {outwardClientId && items.find(i => i.id === outwardClientId) && (
              <Typography variant="body2" color="text.secondary">
                Current Pending Balance: <b>{items.find(i => i.id === outwardClientId)?.balance.toFixed(3)} kg</b>
              </Typography>
            )}
            <TextField
              label="Dispatch Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
            />
            <TextField
              label="Dispatch Weight (kg)"
              type="number"
              fullWidth
              value={dispatchQty || ""}
              onChange={(e) => setDispatchQty(Number(e.target.value))}
            />
            <TextField
              label="Process Loss (kg)"
              type="number"
              fullWidth
              value={processLoss || ""}
              onChange={(e) => setProcessLoss(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutwardOpen(false)} disabled={savingOutward}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddOutward}
            disabled={savingOutward || !outwardClientId || dispatchQty <= 0}
          >
            {savingOutward ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
