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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { 
  fetchDashboardSummary, 
  patchMinimumStock, 
  patchOpeningStock,
  fetchProductStockBreakdown,
  fetchProductLedger,
  fetchInventoryLedger,
  mergeInventoryItems,
  type ProductStockRow,
  type ProductLedgerRow,
  type InventoryLedgerRow
} from "../lib/api";
import { exportToCsv } from "../lib/export";

export function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [openingDialog, setOpeningDialog] = useState(false);
  const [openingInput, setOpeningInput] = useState<number>(0);
  const [savingOpening, setSavingOpening] = useState(false);
  const [minimumDialog, setMinimumDialog] = useState(false);
  const [minimumInput, setMinimumInput] = useState<number>(0);
  const [savingMinimum, setSavingMinimum] = useState(false);

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [sourceItem, setSourceItem] = useState("");
  const [targetItem, setTargetItem] = useState("");
  const [merging, setMerging] = useState(false);

  const [tab, setTab] = useState<"stock" | "ledger">("stock");
  const [ledgerRows, setLedgerRows] = useState<InventoryLedgerRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [productStock, setProductStock] = useState<ProductStockRow[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState<ProductLedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [selectedProductStr, setSelectedProductStr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchDashboardSummary(), fetchProductStockBreakdown()])
      .then(([s, pStock]) => {
        if (!alive) return;
        setSummary(s);
        setProductStock(pStock);
        setOpeningInput(s.opening_stock_kgs ?? 0);
        setMinimumInput(s.minimum_stock_kgs ?? 0);
        setErr(null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (tab === "ledger") {
      setLoadingLedger(true);
      fetchInventoryLedger()
        .then(setLedgerRows)
        .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load ledger"))
        .finally(() => setLoadingLedger(false));
    }
  }, [tab]);

  const filteredLedger = useMemo(() => {
    const useItems = ledgerRows || [];
    if (!ledgerSearch) return useItems;
    const lower = ledgerSearch.toLowerCase();
    return useItems.filter(
      (r) =>
        r.item.toLowerCase().includes(lower) ||
        r.size.toLowerCase().includes(lower) ||
        r.grade.toLowerCase().includes(lower) ||
        (r.reference_number && r.reference_number.toLowerCase().includes(lower)) ||
        (r.client_po && r.client_po.toLowerCase().includes(lower)) ||
        r.transaction_type.toLowerCase().includes(lower)
    );
  }, [ledgerRows, ledgerSearch]);

  const uniqueItemNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of productStock) {
      if (p.item) names.add(p.item);
    }
    return Array.from(names).sort();
  }, [productStock]);

  async function handleMerge() {
    if (!sourceItem || !targetItem || sourceItem === targetItem) return;
    setMerging(true);
    setErr(null);
    try {
      await mergeInventoryItems({ sourceName: sourceItem, targetName: targetItem });
      const [s, pStock] = await Promise.all([fetchDashboardSummary(), fetchProductStockBreakdown()]);
      setSummary(s);
      setProductStock(pStock);
      setMergeDialogOpen(false);
      setSourceItem("");
      setTargetItem("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to merge items");
    } finally {
      setMerging(false);
    }
  }

  const negative = (summary?.current_stock_kgs ?? 0) < -0.0001;

  async function saveOpening() {
    setSavingOpening(true);
    setErr(null);
    try {
      await patchOpeningStock(Math.max(0, Number(openingInput) || 0));
      const s = await fetchDashboardSummary();
      setSummary(s);
      setOpeningInput(s.opening_stock_kgs ?? 0);
      setOpeningDialog(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save opening stock");
    } finally {
      setSavingOpening(false);
    }
  }

  async function saveMinimum() {
    setSavingMinimum(true);
    setErr(null);
    try {
      await patchMinimumStock(Math.max(0, Number(minimumInput) || 0));
      const s = await fetchDashboardSummary();
      setSummary(s);
      setMinimumInput(s.minimum_stock_kgs ?? 0);
      setMinimumDialog(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save minimum stock");
    } finally {
      setSavingMinimum(false);
    }
  }

  async function openLedger(p: ProductStockRow) {
    setSelectedProductStr(`${p.item} - ${p.size} (${p.grade})`);
    setLedgerOpen(true);
    setLedgerLoading(true);
    setLedgerData([]);
    try {
      const data = await fetchProductLedger(p.product_id);
      setLedgerData(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLedgerLoading(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={900}>
          Inventory
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => {
              setOpeningInput(summary?.opening_stock_kgs ?? 0);
              setOpeningDialog(true);
            }}
          >
            Set opening stock (kg)
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setMinimumInput(summary?.minimum_stock_kgs ?? 0);
              setMinimumDialog(true);
            }}
          >
            Set minimum stock (kg)
          </Button>
          <Button
            variant="outlined"
            onClick={() => setMergeDialogOpen(true)}
          >
            Merge duplicate items
          </Button>
        </Stack>
      </Stack>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant={tab === "stock" ? "contained" : "outlined"}
          onClick={() => setTab("stock")}
          sx={{ fontWeight: 800, textTransform: "none" }}
        >
          Stock Breakdown
        </Button>
        <Button
          variant={tab === "ledger" ? "contained" : "outlined"}
          onClick={() => setTab("ledger")}
          sx={{ fontWeight: 800, textTransform: "none" }}
        >
          Inventory Ledger
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tab === "stock" ? (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography fontWeight={900} sx={{ mb: 1 }}>
                Overview
              </Typography>
              <Typography color="text.secondary">Purchase Required uses your formula (with receipts/dispatch/returns).</Typography>
              <Typography sx={{ mt: 1 }}>
                Minimum stock: <b>{Math.round(summary?.minimum_stock_kgs ?? 0)} kg</b> • Purchase required:{" "}
                <b>{Math.round(summary?.purchase_required_kgs ?? 0)} kg</b>
              </Typography>
              <Typography sx={{ mt: 0.5 }}>
                Current stock: <b style={{ color: negative ? "#dc2626" : undefined }}>{Math.round(summary?.current_stock_kgs ?? 0)} kg</b>
              </Typography>
              {summary?.breakdown ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Pending sales {Math.round(summary.breakdown.pending_sales_orders_kgs)} kg • Pending PO{" "}
                  {Math.round(summary.breakdown.pending_purchase_orders_kgs)} kg • Receipts{" "}
                  {Math.round(summary.breakdown.incoming_material_kgs)} kg • Dispatch{" "}
                  {Math.round(summary.breakdown.dispatch_kgs)} kg • Sales return{" "}
                  {Math.round(summary.breakdown.dispatch_return_kgs)} kg • Purchase return{" "}
                  {Math.round(summary.breakdown.incoming_rm_return_kgs)} kg
                </Typography>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography fontWeight={900} sx={{ mb: 2 }}>
                Product Breakdown
              </Typography>
              {productStock.length === 0 ? (
                <Typography color="text.secondary">No stock data available yet.</Typography>
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Box sx={{ minWidth: 900 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 150px 150px", p: 2, borderBottom: "1px solid rgba(0,0,0,0.1)", fontWeight: 800 }}>
                      <Box>Product</Box>
                      <Box>Receipts</Box>
                      <Box>Purchase Returns</Box>
                      <Box>Dispatches</Box>
                      <Box>Sales Returns</Box>
                      <Box>Current Stock</Box>
                      <Box>Actual Avg Price</Box>
                      <Box>Action</Box>
                    </Box>
                    {productStock.map((p) => {
                      const isNegative = p.current_stock < -0.0001;
                      return (
                        <Box key={p.product_id} sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 150px 150px", p: 2, borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "center" }}>
                          <Box fontWeight={700}>{p.item} <Typography variant="body2" component="span" color="text.secondary">({p.size} {p.grade})</Typography></Box>
                          <Box>{Math.round(p.receipts)} kg</Box>
                          <Box>{Math.round(p.purchase_returns)} kg</Box>
                          <Box>{Math.round(p.dispatches)} kg</Box>
                          <Box>{Math.round(p.sales_returns)} kg</Box>
                          <Box fontWeight={isNegative ? 900 : 400} color={isNegative ? "error.main" : "inherit"}>
                            {Math.round(p.current_stock)} kg
                          </Box>
                          <Box>
                            ₹{p.actual_avg_price ? p.actual_avg_price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"}
                          </Box>
                          <Box>
                            <Button size="small" variant="outlined" onClick={() => openLedger(p)}>Ledger</Button>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
              <Typography fontWeight={900} variant="h6">
                Inventory Ledger (All Stock Movements)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => exportToCsv("inventory_ledger", ledgerRows)}
                disabled={ledgerRows.length === 0}
              >
                Export Ledger
              </Button>
            </Stack>

            <TextField
              label="Search Ledger"
              placeholder="Search by item, grade, ref no, client PO, type..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />

            {loadingLedger ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : filteredLedger.length === 0 ? (
              <Typography color="text.secondary">No stock movement entries found.</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: 1100 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "100px 180px 140px 120px 120px 100px 100px 120px 140px",
                      p: 1.5,
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                      fontWeight: 800,
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Box>Date</Box>
                    <Box>Item</Box>
                    <Box>Transaction Type</Box>
                    <Box>Ref Number</Box>
                    <Box>Client PO</Box>
                    <Box textAlign="right">Inward (kg)</Box>
                    <Box textAlign="right">Outward (kg)</Box>
                    <Box textAlign="right">Balance (kg)</Box>
                    <Box textAlign="right">Rate / Avg Price</Box>
                  </Box>
                  {filteredLedger.map((row, idx) => {
                    const isInward = row.inward_quantity > 0;
                    const isOutward = row.outward_quantity > 0;

                    let typeColor = "text.primary";
                    if (row.transaction_type.includes("Receipt")) typeColor = "success.main";
                    if (row.transaction_type.includes("Dispatch")) typeColor = "error.main";
                    if (row.transaction_type.includes("Return")) typeColor = "warning.main";

                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "100px 180px 140px 120px 120px 100px 100px 120px 140px",
                          p: 1.5,
                          borderBottom: "1px solid rgba(0,0,0,0.05)",
                          alignItems: "center",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.01)" },
                        }}
                      >
                        <Box>{row.date.split("T")[0]}</Box>
                        <Box fontWeight={700}>
                          {row.item}{" "}
                          <Typography variant="caption" color="text.secondary" display="block">
                            ({row.size} {row.grade})
                          </Typography>
                        </Box>
                        <Box sx={{ color: typeColor, fontWeight: 700 }}>{row.transaction_type}</Box>
                        <Box color="text.secondary">{row.reference_number || "—"}</Box>
                        <Box color="text.secondary">{row.client_po || "—"}</Box>
                        <Box textAlign="right" color="success.main" fontWeight={isInward ? 700 : 400}>
                          {isInward ? `+${Math.round(row.inward_quantity)}` : "—"}
                        </Box>
                        <Box textAlign="right" color="error.main" fontWeight={isOutward ? 700 : 400}>
                          {isOutward ? `-${Math.round(row.outward_quantity)}` : "—"}
                        </Box>
                        <Box textAlign="right" fontWeight={800} color={row.balance_quantity < 0 ? "error.main" : "text.primary"}>
                          {Math.round(row.balance_quantity)} kg
                        </Box>
                        <Box textAlign="right" sx={{ fontSize: "0.8rem" }}>
                          <Typography variant="body2" sx={{ fontSize: "inherit", fontWeight: 700 }}>
                            Rate: ₹{row.rate ? row.rate.toFixed(2) : "0.00"}
                          </Typography>
                          {row.actual_avg_price > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", display: "block" }}>
                              Avg: ₹{row.actual_avg_price.toFixed(2)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={openingDialog} onClose={() => !savingOpening && setOpeningDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Opening stock</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total kg on hand before you started recording purchases and dispatches in this system. This is added to the
            stock formula on the dashboard.
          </Typography>
          <TextField
            label="Opening stock (kg)"
            type="number"
            fullWidth
            value={openingInput || ""}
            onChange={(e) => setOpeningInput(Number(e.target.value))}
            inputProps={{ min: 0, step: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpeningDialog(false)} disabled={savingOpening}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveOpening} disabled={savingOpening}>
            {savingOpening ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={minimumDialog} onClose={() => !savingMinimum && setMinimumDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Minimum stock</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Minimum stock buffer (kg) used in Purchase Required computation.
          </Typography>
          <TextField
            label="Minimum stock (kg)"
            type="number"
            fullWidth
            value={minimumInput || ""}
            onChange={(e) => setMinimumInput(Number(e.target.value))}
            inputProps={{ min: 0, step: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMinimumDialog(false)} disabled={savingMinimum}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveMinimum} disabled={savingMinimum}>
            {savingMinimum ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Ledger: {selectedProductStr}</DialogTitle>
        <DialogContent dividers>
          {ledgerLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : ledgerData.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>No transactions found.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 600 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "150px 150px 150px 1fr 1fr", p: 1, borderBottom: "1px solid rgba(0,0,0,0.1)", fontWeight: 800 }}>
                  <Box>Date</Box>
                  <Box>Type</Box>
                  <Box>Ref</Box>
                  <Box textAlign="right">Weight (kg)</Box>
                  <Box textAlign="right">Balance (kg)</Box>
                </Box>
                {ledgerData.map((row, i) => (
                  <Box key={i} sx={{ display: "grid", gridTemplateColumns: "150px 150px 150px 1fr 1fr", p: 1, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <Box>{row.date.split("T")[0]}</Box>
                    <Box>{row.type}</Box>
                    <Box>{row.ref || "-"}</Box>
                    <Box textAlign="right" color={row.weight < 0 ? "error.main" : "success.main"}>
                      {row.weight > 0 ? "+" : ""}{Math.round(row.weight)}
                    </Box>
                    <Box textAlign="right" fontWeight={700} color={row.balance < 0 ? "error.main" : "inherit"}>
                      {Math.round(row.balance)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLedgerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={mergeDialogOpen} onClose={() => !merging && setMergeDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Merge Duplicate Item Names</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will merge all records matching the Source Item Name into the Target Item Name. All existing transactions and products will point to the target item name.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Source Item Name (Duplicate)"
              select
              SelectProps={{ native: true }}
              fullWidth
              value={sourceItem}
              onChange={(e) => setSourceItem(e.target.value)}
            >
              <option value=""></option>
              {uniqueItemNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </TextField>
            <TextField
              label="Target Item Name (Correct)"
              select
              SelectProps={{ native: true }}
              fullWidth
              value={targetItem}
              onChange={(e) => setTargetItem(e.target.value)}
            >
              <option value=""></option>
              {uniqueItemNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)} disabled={merging}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleMerge}
            disabled={merging || !sourceItem || !targetItem || sourceItem === targetItem}
          >
            {merging ? "Merging..." : "Merge"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

