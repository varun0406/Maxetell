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
  fetchJobWorkList,
  createJobWorkInward,
  createJobWorkOutward,
  deleteJobWorkInward,
  deleteJobWorkOutward,
  type JobWorkInward,
} from "../lib/api";
import { exportToCsv } from "../lib/export";
import dayjs from "dayjs";

export function JobWorkPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<JobWorkInward[]>([]);
  const [search, setSearch] = useState("");

  // Dialogs
  const [inwardOpen, setInwardOpen] = useState(false);
  const [outwardOpen, setOutwardOpen] = useState(false);
  const [selectedInward, setSelectedInward] = useState<JobWorkInward | null>(null);

  // Inward Form
  const [challanDate, setChallanDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [shortQty, setShortQty] = useState<number>(0);
  const [savingInward, setSavingInward] = useState(false);

  // Outward Form
  const [dispatchDate, setDispatchDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dispatchQty, setDispatchQty] = useState<number>(0);
  const [processLoss, setProcessLoss] = useState<number>(0);
  const [savingOutward, setSavingOutward] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchJobWorkList();
      setItems(data);
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

    // Dispatches columns totals (up to 4 columns)
    const tDispatches = [0, 0, 0, 0];
    const tLosses = [0, 0, 0, 0];

    for (const item of filteredItems) {
      tQty += item.qty;
      tShort += item.short_qty || 0;
      tFinal += item.final_qty;
      tBal += item.balance;

      for (let i = 0; i < 4; i++) {
        const d = item.dispatches?.[i];
        if (d) {
          tDispatches[i] += d.dispatch_qty;
          tLosses[i] += d.process_loss || 0;
        }
      }
    }

    return { tQty, tShort, tFinal, tBal, tDispatches, tLosses };
  }, [filteredItems]);

  async function handleAddInward() {
    if (!description || qty <= 0) return;
    setSavingInward(true);
    try {
      await createJobWorkInward({
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
    if (!selectedInward || dispatchQty <= 0) return;
    setSavingOutward(true);
    try {
      await createJobWorkOutward({
        inward_id: selectedInward.id,
        dispatch_date: dispatchDate,
        dispatch_qty: dispatchQty,
        process_loss: processLoss,
      });
      setOutwardOpen(false);
      setDispatchQty(0);
      setProcessLoss(0);
      setSelectedInward(null);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add dispatch");
    } finally {
      setSavingOutward(false);
    }
  }

  async function handleDeleteInward(id: number) {
    if (!window.confirm("Are you sure you want to delete this inward job work?")) return;
    try {
      await deleteJobWorkInward(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete inward");
    }
  }

  async function handleDeleteOutward(id: number) {
    if (!window.confirm("Delete this dispatch?")) return;
    try {
      await deleteJobWorkOutward(id);
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to delete dispatch");
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
        "Dis-1 Date": item.dispatches?.[0]?.dispatch_date.split("T")[0] || "",
        "Dis-1 Qty": item.dispatches?.[0]?.dispatch_qty || "",
        "Dis-1 Loss": item.dispatches?.[0]?.process_loss || "",
        "Dis-2 Date": item.dispatches?.[1]?.dispatch_date.split("T")[0] || "",
        "Dis-2 Qty": item.dispatches?.[1]?.dispatch_qty || "",
        "Dis-2 Loss": item.dispatches?.[1]?.process_loss || "",
        "Dis-3 Date": item.dispatches?.[2]?.dispatch_date.split("T")[0] || "",
        "Dis-3 Qty": item.dispatches?.[2]?.dispatch_qty || "",
        "Dis-3 Loss": item.dispatches?.[2]?.process_loss || "",
        "Dis-4 Date": item.dispatches?.[3]?.dispatch_date.split("T")[0] || "",
        "Dis-4 Qty": item.dispatches?.[3]?.dispatch_qty || "",
        "Dis-4 Loss": item.dispatches?.[3]?.process_loss || "",
        "Balance": item.balance
      };
    });
    exportToCsv("job_work_report", csvData);
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={900}>
          Job Work System
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={items.length === 0}
          >
            Export Report
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInwardOpen(true)}>
            Add Inward Challan
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
              TOTAL INWARD QTY
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              {Math.round(totals.tFinal).toLocaleString()} kg
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL DISPATCHED
            </Typography>
            <Typography variant="h5" fontWeight={900} color="success.main">
              {Math.round(items.reduce((acc, x) => acc + x.total_dispatched, 0)).toLocaleString()} kg
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
              CURRENT BALANCE
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
        <Typography color="text.secondary">No Job Work entries found.</Typography>
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
                <Box sx={{ borderRight: "1px solid rgba(0,0,0,0.08)", p: 1, gridColumn: "span 5" }}>INCOMING DETAILS</Box>
                <Box sx={{ borderRight: "1px solid rgba(0,0,0,0.08)", p: 1, gridColumn: "span 3" }}>OUT DETAILS</Box>
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

                <Box sx={{ p: 0.5, textAlign: "center" }}>DIS-1 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>DIS-2 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>DIS-3 DETAILS</Box>
                <Box sx={{ p: 0.5, textAlign: "center" }}>DIS-4 DETAILS</Box>

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

                  {/* Dispatches 1-4 */}
                  {[0, 1, 2, 3].map((idx) => {
                    const d = item.dispatches?.[idx];
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
                        {d ? (
                          <>
                            <span>{d.dispatch_date.split("T")[0]}</span>
                            <span style={{ fontWeight: 700 }}>
                              {d.dispatch_qty.toFixed(1)} / L: {(d.process_loss || 0).toFixed(1)}
                            </span>
                            <Tooltip title="Delete Dispatch">
                              <IconButton size="small" onClick={() => handleDeleteOutward(d.id)} color="error" sx={{ p: 0 }}>
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
                          setSelectedInward(item);
                          setOutwardOpen(true);
                        }}
                        sx={{ fontSize: 10, px: 1, py: 0.25, textTransform: "none" }}
                        disabled={item.balance <= 0}
                      >
                        Dispatch
                      </Button>
                      <IconButton size="small" color="error" onClick={() => handleDeleteInward(item.id)}>
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

                {/* Dispatch Columns Totals */}
                {[0, 1, 2, 3].map((idx) => (
                  <Box key={idx} sx={{ p: 0.5, display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span>D: {totals.tDispatches[idx].toFixed(1)}</span>
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

      {/* New Inward Challan Dialog */}
      <Dialog open={inwardOpen} onClose={() => !savingInward && setInwardOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Inward Challan</DialogTitle>
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
          <Button onClick={() => setInwardOpen(false)} disabled={savingInward}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddInward} disabled={savingInward || !description || qty <= 0}>
            {savingInward ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Dispatch Dialog */}
      <Dialog open={outwardOpen} onClose={() => !savingOutward && setOutwardOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Outward Dispatch</DialogTitle>
        <DialogContent dividers>
          {selectedInward && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Item: <b>{selectedInward.description}</b> (Challan Date: {selectedInward.challan_date.split("T")[0]})
              <br />
              Final Qty: <b>{selectedInward.final_qty.toFixed(3)} kg</b> | Remaining Balance:{" "}
              <b>{selectedInward.balance.toFixed(3)} kg</b>
            </Typography>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
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
          <Button onClick={() => setOutwardOpen(false)} disabled={savingOutward}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddOutward}
            disabled={savingOutward || dispatchQty <= 0 || !!(selectedInward && dispatchQty + processLoss > selectedInward.balance + 0.01)}
          >
            {savingOutward ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
