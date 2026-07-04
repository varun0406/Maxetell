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
  fetchJobWorkOutList,
  fetchJobWorkClients,
  createJobWorkClient,
  createJobWorkOutSent,
  createJobWorkOutReceipt,
  deleteJobWorkOutSent,
  deleteJobWorkOutReceipt,
  type JobWorkOutClientLedger,
  type JobWorkClient,
} from "../lib/api";
import { exportToCsv } from "../lib/export";
import dayjs from "dayjs";

export function JobWorkOutPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<JobWorkOutClientLedger[]>([]);
  const [clients, setClients] = useState<JobWorkClient[]>([]);
  const [search, setSearch] = useState("");

  // Dialogs
  const [clientOpen, setClientOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  
  const [selectedClientLedger, setSelectedClientLedger] = useState<JobWorkOutClientLedger | null>(null);

  // Client Form
  const [clientName, setClientName] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  // Sent Form
  const [sentClientId, setSentClientId] = useState<number | "">("");
  const [sentChallanNo, setSentChallanNo] = useState("");
  const [challanDate, setChallanDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [sentGross, setSentGross] = useState<number>(0);
  const [sentTare, setSentTare] = useState<number>(0);
  const [qty, setQty] = useState<number>(0);
  const [shortQty, setShortQty] = useState<number>(0);
  const [savingSent, setSavingSent] = useState(false);

  useEffect(() => {
    if (sentGross > 0 || sentTare > 0) {
      setQty(Math.max(0, sentGross - sentTare));
    }
  }, [sentGross, sentTare]);

  // Receipt Form
  const [receiptClientId, setReceiptClientId] = useState<number | "">("");
  const [receiptChallanNo, setReceiptChallanNo] = useState("");
  const [receiptDate, setReceiptDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [receiptGross, setReceiptGross] = useState<number>(0);
  const [receiptTare, setReceiptTare] = useState<number>(0);
  const [receiptQty, setReceiptQty] = useState<number>(0);
  const [processLoss, setProcessLoss] = useState<number>(0);
  const [savingReceipt, setSavingReceipt] = useState(false);

  useEffect(() => {
    if (receiptGross > 0 || receiptTare > 0) {
      setReceiptQty(Math.max(0, receiptGross - receiptTare));
    }
  }, [receiptGross, receiptTare]);

  async function loadData() {
    setLoading(true);
    try {
      const [ledgersData, clientsData] = await Promise.all([
        fetchJobWorkOutList(),
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
      setErr(e instanceof Error ? e.message : "Failed to load Job Work Out data");
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
    let tSent = 0;
    let tReceived = 0;
    let tLoss = 0;
    let tBal = 0;

    for (const item of filteredItems) {
      tSent += item.total_sent;
      tReceived += item.total_received;
      tLoss += item.total_loss;
      tBal += item.balance;
    }

    return { tSent, tReceived, tLoss, tBal };
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

  async function handleAddSent() {
    if (!sentClientId || !description || qty <= 0) return;
    setSavingSent(true);
    try {
      await createJobWorkOutSent({
        client_id: Number(sentClientId),
        challan_no: sentChallanNo,
        challan_date: challanDate,
        description,
        qty,
        short_qty: shortQty,
        gross_weight: sentGross,
        tare_weight: sentTare,
      });
      setSentOpen(false);
      setSentChallanNo("");
      setDescription("");
      setSentGross(0);
      setSentTare(0);
      setQty(0);
      setShortQty(0);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create outward challan");
    } finally {
      setSavingSent(false);
    }
  }

  async function handleAddReceipt() {
    if (!receiptClientId || receiptQty <= 0) return;
    setSavingReceipt(true);
    try {
      await createJobWorkOutReceipt({
        client_id: Number(receiptClientId),
        challan_no: receiptChallanNo,
        receipt_date: receiptDate,
        receipt_qty: receiptQty,
        process_loss: processLoss,
        gross_weight: receiptGross,
        tare_weight: receiptTare,
      });
      setReceiptOpen(false);
      setReceiptChallanNo("");
      setReceiptGross(0);
      setReceiptTare(0);
      setReceiptQty(0);
      setProcessLoss(0);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add receipt");
    } finally {
      setSavingReceipt(false);
    }
  }

  async function handleDeleteSent(id: number) {
    if (!window.confirm("Are you sure you want to delete this outward entry?")) return;
    if (!window.confirm("Are you REALLY sure?")) return;
    try {
      await deleteJobWorkOutSent(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete sent challan");
    }
  }

  async function handleDeleteReceipt(id: number) {
    if (!window.confirm("Are you sure you want to delete this receipt entry?")) return;
    if (!window.confirm("Are you REALLY sure?")) return;
    try {
      await deleteJobWorkOutReceipt(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete receipt");
    }
  }

  function handleExport() {
    const csvData = filteredItems.map(item => ({
      "Client": item.name,
      "Total Sent": item.total_sent,
      "Total Received": item.total_received,
      "Total Loss": item.total_loss,
      "Balance": item.balance
    }));
    exportToCsv("job_work_out_client_report", csvData);
  }

  // Generate Ledger View Rows
  const ledgerRows = useMemo(() => {
    if (!selectedClientLedger) return [];
    
    type Row = { type: 'sent' | 'receipt'; date: string; desc?: string; qty: number; short?: number; loss?: number; id: number };
    
    const rows: Row[] = [];
    selectedClientLedger.sents.forEach(s => {
      rows.push({ type: 'sent', date: s.challan_date, desc: s.description + (s.challan_no ? ` (Challan: ${s.challan_no})` : ""), qty: s.qty, short: s.short_qty, id: s.id });
    });
    selectedClientLedger.receipts.forEach(r => {
      rows.push({ type: 'receipt', date: r.receipt_date, desc: r.challan_no ? `Challan: ${r.challan_no}` : "", qty: r.receipt_qty, loss: r.process_loss, id: r.id });
    });
    
    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedClientLedger]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={900}>
          Job Work System (Outward)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleExport} disabled={items.length === 0}>
            Export Report
          </Button>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setClientOpen(true)}>
            Add Client
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSentClientId(""); setSentOpen(true); }}>
            Send Goods
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setReceiptClientId(""); setReceiptOpen(true); }}>
            Receive
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
              TOTAL SENT (NET)
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              {Math.round(totals.tSent).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL RECEIVED
            </Typography>
            <Typography variant="h5" fontWeight={900} color="success.main">
              {Math.round(totals.tReceived).toLocaleString()} kg
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
        <Typography color="text.secondary">No Job Work Out entries found.</Typography>
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
                <Box sx={{ textAlign: "right" }}>SENT (NET)</Box>
                <Box sx={{ textAlign: "right" }}>RECEIVED</Box>
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
                  <Box sx={{ textAlign: "right" }}>{item.total_sent.toFixed(3)}</Box>
                  <Box sx={{ textAlign: "right", color: "success.main" }}>{item.total_received.toFixed(3)}</Box>
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
                <Box sx={{ textAlign: "right" }}>{totals.tSent.toFixed(3)}</Box>
                <Box sx={{ textAlign: "right", color: "success.main" }}>{totals.tReceived.toFixed(3)}</Box>
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
          {selectedClientLedger?.name} - Job Work Out Ledger
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
              <Box sx={{ textAlign: "right" }}>SENT (QTY)</Box>
              <Box sx={{ textAlign: "right" }}>IN (QTY+LOSS)</Box>
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
                  bgcolor: row.type === 'sent' ? "rgba(0,100,255,0.03)" : "rgba(255,100,0,0.03)",
                }}
              >
                <Box>{row.date.split("T")[0]}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {row.type === 'sent' ? "SENT" : "RECEIPT"}
                  </Typography>
                  {row.desc && <Typography variant="caption" color="text.secondary">{row.desc}</Typography>}
                  {row.short && row.short > 0 ? <Typography variant="caption" color="error.main" display="block">Short: {row.short}</Typography> : null}
                  {row.loss && row.loss > 0 ? <Typography variant="caption" color="warning.main" display="block">Loss: {row.loss}</Typography> : null}
                </Box>
                <Box sx={{ textAlign: "right", fontWeight: row.type === 'sent' ? 700 : 400 }}>
                  {row.type === 'sent' ? (row.qty - (row.short || 0)).toFixed(3) : "—"}
                </Box>
                <Box sx={{ textAlign: "right", fontWeight: row.type === 'receipt' ? 700 : 400 }}>
                  {row.type === 'receipt' ? (row.qty + (row.loss || 0)).toFixed(3) : "—"}
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <IconButton size="small" color="error" onClick={() => row.type === 'sent' ? handleDeleteSent(row.id) : handleDeleteReceipt(row.id)}>
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

      {/* New Sent Challan Dialog */}
      <Dialog open={sentOpen} onClose={() => !savingSent && setSentOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Outward Challan</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Select Client"
              fullWidth
              value={sentClientId}
              onChange={(e) => setSentClientId(Number(e.target.value))}
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
              label="Challan Number"
              fullWidth
              value={sentChallanNo}
              onChange={(e) => setSentChallanNo(e.target.value)}
            />
            <TextField
              label="Item Description (DESP)"
              fullWidth
              placeholder="e.g. COPPER SCRAP TO VENDOR"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Gross Weight (kg)"
                type="number"
                fullWidth
                value={sentGross || ""}
                onChange={(e) => setSentGross(Number(e.target.value))}
              />
              <TextField
                label="Tare Weight (kg)"
                type="number"
                fullWidth
                value={sentTare || ""}
                onChange={(e) => setSentTare(Number(e.target.value))}
              />
            </Stack>
            <TextField
              label="Net Quantity Sent (QTY)"
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
          <Button onClick={() => setSentOpen(false)} disabled={savingSent}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSent} disabled={savingSent || !sentClientId || !description || qty <= 0}>
            {savingSent ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Receipt Dialog */}
      <Dialog open={receiptOpen} onClose={() => !savingReceipt && setReceiptOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Inward Receipt</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Select Client"
              fullWidth
              value={receiptClientId}
              onChange={(e) => setReceiptClientId(Number(e.target.value))}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            {receiptClientId && items.find(i => i.id === receiptClientId) && (
              <Typography variant="body2" color="text.secondary">
                Current Pending Balance: <b>{items.find(i => i.id === receiptClientId)?.balance.toFixed(3)} kg</b>
              </Typography>
            )}
            <TextField
              label="Receipt Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
            <TextField
              label="Challan Number"
              fullWidth
              value={receiptChallanNo}
              onChange={(e) => setReceiptChallanNo(e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Gross Weight (kg)"
                type="number"
                fullWidth
                value={receiptGross || ""}
                onChange={(e) => setReceiptGross(Number(e.target.value))}
              />
              <TextField
                label="Tare Weight (kg)"
                type="number"
                fullWidth
                value={receiptTare || ""}
                onChange={(e) => setReceiptTare(Number(e.target.value))}
              />
            </Stack>
            <TextField
              label="Net Receipt Weight (kg)"
              type="number"
              fullWidth
              value={receiptQty || ""}
              onChange={(e) => setReceiptQty(Number(e.target.value))}
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
          <Button onClick={() => setReceiptOpen(false)} disabled={savingReceipt}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddReceipt}
            disabled={savingReceipt || !receiptClientId || receiptQty <= 0}
          >
            {savingReceipt ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
