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
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import {
  fetchJobWorkOutList,
  createJobWorkOutSent,
  createJobWorkOutReceipt,
  deleteJobWorkOutSent,
  deleteJobWorkOutReceipt,
  type JobWorkOutSent,
} from "../lib/api";
import { exportToCsv } from "../lib/export";
import dayjs from "dayjs";

export function JobWorkOutPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<JobWorkOutSent[]>([]);
  const [search, setSearch] = useState("");

  // Dialogs
  const [sentOpen, setSentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedSent, setSelectedSent] = useState<JobWorkOutSent | null>(null);

  // Sent Form
  const [challanDate, setChallanDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [shortQty, setShortQty] = useState<number>(0);
  const [savingSent, setSavingSent] = useState(false);

  // Receipt Form
  const [receiptDate, setReceiptDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [receiptQty, setReceiptQty] = useState<number>(0);
  const [processLoss, setProcessLoss] = useState<number>(0);
  const [savingReceipt, setSavingReceipt] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchJobWorkOutList();
      setItems(data);
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
    return items.filter((item) =>
      item.description.toLowerCase().includes(lower) ||
      item.challan_date.includes(lower)
    );
  }, [items, search]);

  // Totals
  const totals = useMemo(() => {
    let tQty = 0;
    let tShort = 0;
    let tFinal = 0;
    let tBal = 0;

    // Receipts columns totals (up to 4 columns)
    const tReceipts = [0, 0, 0, 0];
    const tLosses = [0, 0, 0, 0];

    for (const item of filteredItems) {
      tQty += item.qty;
      tShort += item.short_qty || 0;
      tFinal += item.final_qty;
      tBal += item.balance;

      for (let i = 0; i < 4; i++) {
        const r = item.receipts?.[i];
        if (r) {
          tReceipts[i] += r.receipt_qty;
          tLosses[i] += r.process_loss || 0;
        }
      }
    }

    return { tQty, tShort, tFinal, tBal, tReceipts, tLosses };
  }, [filteredItems]);

  async function handleAddSent() {
    if (!description || qty <= 0) return;
    setSavingSent(true);
    try {
      await createJobWorkOutSent({
        challan_date: challanDate,
        description,
        qty,
        short_qty: shortQty,
      });
      setSentOpen(false);
      setDescription("");
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
    if (!selectedSent || receiptQty <= 0) return;
    setSavingReceipt(true);
    try {
      await createJobWorkOutReceipt({
        sent_id: selectedSent.id,
        receipt_date: receiptDate,
        receipt_qty: receiptQty,
        process_loss: processLoss,
      });
      setReceiptOpen(false);
      setReceiptQty(0);
      setProcessLoss(0);
      setSelectedSent(null);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add receipt");
    } finally {
      setSavingReceipt(false);
    }
  }

  async function handleDeleteSent(id: number) {
    if (!window.confirm("Are you sure you want to delete this outward job work?")) return;
    try {
      await deleteJobWorkOutSent(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete sent challan");
    }
  }

  async function handleDeleteReceipt(id: number) {
    if (!window.confirm("Delete this receipt?")) return;
    try {
      await deleteJobWorkOutReceipt(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete receipt");
    }
  }

  function handleExport() {
    const csvData = filteredItems.map(item => {
      return {
        "Dated": item.challan_date.split("T")[0],
        "Description": item.description,
        "Qty": item.qty,
        "Short Qty": item.short_qty || 0,
        "Final Qty": item.final_qty,
        "Rec-1 Date": item.receipts?.[0]?.receipt_date.split("T")[0] || "",
        "Rec-1 Qty": item.receipts?.[0]?.receipt_qty || "",
        "Rec-1 Loss": item.receipts?.[0]?.process_loss || "",
        "Rec-2 Date": item.receipts?.[1]?.receipt_date.split("T")[0] || "",
        "Rec-2 Qty": item.receipts?.[1]?.receipt_qty || "",
        "Rec-2 Loss": item.receipts?.[1]?.process_loss || "",
        "Rec-3 Date": item.receipts?.[2]?.receipt_date.split("T")[0] || "",
        "Rec-3 Qty": item.receipts?.[2]?.receipt_qty || "",
        "Rec-3 Loss": item.receipts?.[2]?.process_loss || "",
        "Rec-4 Date": item.receipts?.[3]?.receipt_date.split("T")[0] || "",
        "Rec-4 Qty": item.receipts?.[3]?.receipt_qty || "",
        "Rec-4 Loss": item.receipts?.[3]?.process_loss || "",
        "Balance": item.balance
      };
    });
    exportToCsv("job_work_out_report", csvData);
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={900}>
          Job Work Out System
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={items.length === 0}
          >
            Export Report
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSentOpen(true)}>
            Add Outward Challan
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
              TOTAL SENT QTY
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              {Math.round(totals.tFinal).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL RECEIVED
            </Typography>
            <Typography variant="h5" fontWeight={900} color="success.main">
              {Math.round(items.reduce((acc, x) => acc + x.total_received, 0)).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              PROCESS LOSS
            </Typography>
            <Typography variant="h5" fontWeight={900} color="warning.main">
              {Math.round(items.reduce((acc, x) => acc + (x.total_loss || 0), 0)).toLocaleString()} kg
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
        label="Search Description or Date"
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
            <Box sx={{ minWidth: 1550 }}>
              {/* Main Sheet Header */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "100px 220px 280px 200px 200px 200px 200px 100px 100px",
                  borderBottom: "2px solid rgba(0,0,0,0.12)",
                  fontWeight: 900,
                  bgcolor: "rgba(0,0,0,0.03)",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                <Box sx={{ borderRight: "1px solid rgba(0,0,0,0.08)", p: 1, gridColumn: "span 5" }}>OUTWARD DETAILS</Box>
                <Box sx={{ borderRight: "1px solid rgba(0,0,0,0.08)", p: 1, gridColumn: "span 3" }}>RECEIPT DETAILS</Box>
                <Box sx={{ p: 1 }}>BALANCE</Box>
              </Box>

              {/* Column Headers */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "100px 220px 90px 90px 100px 200px 200px 200px 200px 100px 100px",
                  borderBottom: "1px solid rgba(0,0,0,0.12)",
                  fontWeight: 800,
                  bgcolor: "rgba(0,0,0,0.01)",
                  fontSize: 12.5,
                  p: 0.5,
                }}
              >
                <Box sx={{ p: 0.5 }}>DATED</Box>
                <Box sx={{ p: 0.5 }}>DESP</Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>QTY</Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>SHORT QTY</Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>FINAL Qty</Box>

                <Box sx={{ p: 0.5, textAlign: "center" }}>REC-1 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>REC-2 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>REC-3 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>REC-4 DETAILS</Box>

                <Box sx={{ p: 0.5, textAlign: "right" }}>BAL</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>ACTIONS</Box>
              </Box>

              {/* Rows */}
              {filteredItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "100px 220px 90px 90px 100px 200px 200px 200px 200px 100px 100px",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    fontSize: 12.5,
                    p: 0.5,
                    alignItems: "center",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.01)" },
                  }}
                >
                  <Box sx={{ p: 0.5 }}>{item.challan_date.split("T")[0]}</Box>
                  <Box sx={{ p: 0.5, fontWeight: 700 }}>{item.description}</Box>
                  <Box sx={{ p: 0.5, textAlign: "right" }}>{item.qty.toFixed(3)}</Box>
                  <Box sx={{ p: 0.5, textAlign: "right", color: item.short_qty ? "error.main" : "text.secondary" }}>
                    {item.short_qty ? item.short_qty.toFixed(3) : "—"}
                  </Box>
                  <Box sx={{ p: 0.5, textAlign: "right", fontWeight: 700 }}>{item.final_qty.toFixed(3)}</Box>

                  {/* Receipts 1-4 */}
                  {[0, 1, 2, 3].map((idx) => {
                    const r = item.receipts?.[idx];
                    return (
                      <Box
                        key={idx}
                        sx={{
                          p: 0.5,
                          fontSize: 11.5,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderRight: "1px dashed rgba(0,0,0,0.06)",
                          minHeight: 28,
                        }}
                      >
                        {r ? (
                          <>
                            <span>{r.receipt_date.split("T")[0]}</span>
                            <span style={{ fontWeight: 700 }}>
                              {r.receipt_qty.toFixed(1)} / L: {(r.process_loss || 0).toFixed(1)}
                            </span>
                            <Tooltip title="Delete Receipt">
                              <IconButton size="small" onClick={() => handleDeleteReceipt(r.id)} color="error" sx={{ p: 0 }}>
                                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <span style={{ color: "rgba(0,0,0,0.25)", margin: "auto" }}>—</span>
                        )}
                      </Box>
                    );
                  })}

                  <Box
                    sx={{
                      p: 0.5,
                      textAlign: "right",
                      fontWeight: 800,
                      color: item.balance > 0.01 ? "error.main" : "text.primary",
                    }}
                  >
                    {item.balance.toFixed(3)}
                  </Box>

                  <Box sx={{ p: 0.5, textAlign: "center" }}>
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedSent(item);
                          setReceiptOpen(true);
                        }}
                        sx={{ fontSize: 10, px: 1, py: 0.25, textTransform: "none" }}
                        disabled={item.balance <= 0}
                      >
                        Receipt
                      </Button>
                      <IconButton size="small" color="error" onClick={() => handleDeleteSent(item.id)}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  </Box>
                </Box>
              ))}

              {/* Totals Row */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "100px 220px 90px 90px 100px 200px 200px 200px 200px 100px 100px",
                  fontWeight: 900,
                  bgcolor: "rgba(0,0,0,0.03)",
                  fontSize: 12.5,
                  p: 0.75,
                  borderTop: "2px solid rgba(0,0,0,0.12)",
                }}
              >
                <Box sx={{ p: 0.5 }}>TOTALS</Box>
                <Box sx={{ p: 0.5 }}></Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>{totals.tQty.toFixed(3)}</Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>{totals.tShort.toFixed(3)}</Box>
                <Box sx={{ p: 0.5, textAlign: "right" }}>{totals.tFinal.toFixed(3)}</Box>

                {/* Receipt Columns Totals */}
                {[0, 1, 2, 3].map((idx) => (
                  <Box key={idx} sx={{ p: 0.5, display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span>R: {totals.tReceipts[idx].toFixed(1)}</span>
                    <span>L: {totals.tLosses[idx].toFixed(1)}</span>
                  </Box>
                ))}

                <Box sx={{ p: 0.5, textAlign: "right" }}>{totals.tBal.toFixed(3)}</Box>
                <Box sx={{ p: 0.5 }}></Box>
              </Box>
            </Box>
          </Box>
        </Card>
      )}

      {/* New Outward Challan Dialog */}
      <Dialog open={sentOpen} onClose={() => !savingSent && setSentOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Outward Challan</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
              placeholder="e.g. COPPER SCRAP TO VENDOR"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <TextField
              label="Quantity Sent (QTY)"
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
          <Button onClick={() => setSentOpen(false)} disabled={savingSent}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddSent} disabled={savingSent || !description || qty <= 0}>
            {savingSent ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Receipt Dialog */}
      <Dialog open={receiptOpen} onClose={() => !savingReceipt && setReceiptOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Inward Receipt</DialogTitle>
        <DialogContent dividers>
          {selectedSent && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Item: <b>{selectedSent.description}</b> (Challan Date: {selectedSent.challan_date.split("T")[0]})
              <br />
              Final Qty: <b>{selectedSent.final_qty.toFixed(3)} kg</b> | Remaining Balance:{" "}
              <b>{selectedSent.balance.toFixed(3)} kg</b>
            </Typography>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Receipt Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
            <TextField
              label="Receipt Weight (kg)"
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
          <Button onClick={() => setReceiptOpen(false)} disabled={savingReceipt}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddReceipt}
            disabled={savingReceipt || receiptQty <= 0 || !!(selectedSent && receiptQty + processLoss > selectedSent.balance + 0.01)}
          >
            {savingReceipt ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
